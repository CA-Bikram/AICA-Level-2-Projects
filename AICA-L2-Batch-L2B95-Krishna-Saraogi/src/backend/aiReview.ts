/**
 * OneHR Payroll Manager - AI-assisted payroll review
 *
 * Division of work:
 * - All payroll numbers and all exception checks are computed by deterministic code.
 * - The language model (Google Gemini) is used only to (a) write management commentary on
 *   those numbers and (b) explain one employee's computation in plain language.
 *   It never calculates pay or tax.
 *
 * Privacy: only employee IDs, departments and amounts are sent to the model.
 * Names, PAN, bank account, UAN and ESIC numbers are never sent.
 *
 * Needs GEMINI_API_KEY in the environment. Without it the exception review still works
 * and the two AI functions return a clear "not configured" message.
 */

import { GoogleGenAI } from '@google/genai';
import { getDb } from './db/database';
import { getEmploymentWindow } from '../services/payrollEngine';

export interface ReviewException {
  severity: 'HIGH' | 'MEDIUM' | 'INFO';
  employee_id: string;
  check: string;
  detail: string;
}

export interface PayrollReview {
  month: string;
  previous_month: string | null;
  totals: Record<string, { current: number; previous: number | null; change: number | null; change_pct: number | null }>;
  exceptions: ReviewException[];
  ai_configured: boolean;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function previousMonthOf(month: string): string {
  const [y, m] = month.split('-').map(v => parseInt(v, 10));
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Deterministic pre-lock review: month-on-month totals and a list of exceptions
 * a checker should look at before locking the payroll.
 */
export function buildPayrollReview(month: string): PayrollReview {
  const db = getDb();
  const prevMonth = previousMonthOf(month);

  const current = db.prepare('SELECT * FROM payroll WHERE payroll_month = ? ORDER BY employee_id').all(month) as any[];
  const previous = db.prepare('SELECT * FROM payroll WHERE payroll_month = ?').all(prevMonth) as any[];
  const prevMap = new Map<string, any>(previous.map(r => [r.employee_id, r]));
  const currentIds = new Set<string>(current.map(r => r.employee_id));

  const employees = db.prepare('SELECT * FROM employees').all() as any[];
  const empMap = new Map<string, any>(employees.map(e => [e.employee_id, e]));
  const attendanceIds = new Set<string>(
    (db.prepare('SELECT employee_id FROM attendance WHERE payroll_month = ?').all(month) as any[]).map(a => a.employee_id)
  );
  const settings = db.prepare('SELECT esic_salary_ceiling FROM settings LIMIT 1').get() as any;
  const esicCeiling = settings?.esic_salary_ceiling ?? 21000;

  const sum = (rows: any[], f: (r: any) => number) => rows.reduce((a, r) => a + (f(r) || 0), 0);
  const employerCost = (r: any) => (r.employer_pf || 0) + (r.employer_edli || 0) + (r.employer_pf_admin || 0) + (r.employer_esic || 0) + (r.gratuity || 0);

  const metrics: Array<[string, (r: any) => number]> = [
    ['Gross earned', r => r.gross_earned],
    ['Overtime', r => r.overtime_amount],
    ['Bonus', r => r.bonus_amount],
    ['Employee PF', r => r.employee_pf],
    ['Employee ESIC', r => r.employee_esic],
    ['Professional tax', r => r.professional_tax],
    ['TDS', r => r.tds],
    ['Net pay', r => r.take_home_pay],
    ['Employer contributions and gratuity', employerCost],
    ['Company cost', r => r.company_cost]
  ];

  const totals: PayrollReview['totals'] = {};
  const hasPrev = previous.length > 0;
  totals['Headcount'] = {
    current: current.length,
    previous: hasPrev ? previous.length : null,
    change: hasPrev ? current.length - previous.length : null,
    change_pct: null
  };
  for (const [label, f] of metrics) {
    const c = Math.round(sum(current, f));
    const p = hasPrev ? Math.round(sum(previous, f)) : null;
    totals[label] = {
      current: c,
      previous: p,
      change: p === null ? null : c - p,
      change_pct: p ? Math.round(((c - p) / p) * 1000) / 10 : null
    };
  }

  const exceptions: ReviewException[] = [];
  const add = (severity: ReviewException['severity'], employee_id: string, check: string, detail: string) =>
    exceptions.push({ severity, employee_id, check, detail });

  for (const r of current) {
    const emp = empMap.get(r.employee_id);
    const prev = prevMap.get(r.employee_id);
    const window = emp ? getEmploymentWindow(emp, month) : null;

    if (r.take_home_pay <= 0) {
      add('HIGH', r.employee_id, 'Net pay is nil or negative', `Net pay ${inr(r.take_home_pay)} on gross ${inr(r.gross_earned)}`);
    } else if (r.gross_earned > 0 && r.total_deductions > r.gross_earned * 0.5) {
      add('MEDIUM', r.employee_id, 'Deductions exceed 50% of gross', `Deductions ${inr(r.total_deductions)} on gross ${inr(r.gross_earned)}`);
    }

    if (!attendanceIds.has(r.employee_id)) {
      add('MEDIUM', r.employee_id, 'No attendance record', `Paid for ${r.days_payable} of ${r.calendar_days} days by default. Confirm attendance was not missed.`);
    }

    if (window && window.days < window.calendarDays) {
      const what = window.fromDay > 1 ? `joined on day ${window.fromDay}` : `left on day ${window.toDay}`;
      add('INFO', r.employee_id, 'Part-month service', `Employee ${what}; paid for ${r.days_payable} days.`);
    }

    if (!prev && hasPrev) {
      add('INFO', r.employee_id, 'New on payroll this month', `Gross ${inr(r.gross_earned)}. Confirm joining documents and bank details.`);
    }

    if (prev && prev.gross_earned > 0) {
      const pct = ((r.gross_earned - prev.gross_earned) / prev.gross_earned) * 100;
      if (Math.abs(pct) >= 10) {
        const reasons: string[] = [];
        if (r.bonus_amount !== prev.bonus_amount) reasons.push(`bonus ${inr(prev.bonus_amount)} to ${inr(r.bonus_amount)}`);
        if (r.overtime_amount !== prev.overtime_amount) reasons.push(`overtime ${inr(prev.overtime_amount)} to ${inr(r.overtime_amount)}`);
        const lostDays = (x: any) => (x.calendar_days || 0) - (x.days_payable || 0);
        if (lostDays(r) !== lostDays(prev)) reasons.push(`payable days ${prev.days_payable}/${prev.calendar_days} to ${r.days_payable}/${r.calendar_days}`);
        if (r.fixed_gross !== prev.fixed_gross) reasons.push(`fixed gross ${inr(prev.fixed_gross)} to ${inr(r.fixed_gross)}`);
        add(
          Math.abs(pct) >= 25 ? 'HIGH' : 'MEDIUM',
          r.employee_id,
          'Gross changed by 10% or more',
          `${inr(prev.gross_earned)} to ${inr(r.gross_earned)} (${pct > 0 ? '+' : ''}${pct.toFixed(1)}%)${reasons.length ? '. Drivers: ' + reasons.join('; ') : '. No driver identified - check master changes.'}`
        );
      }
      if (r.fixed_gross !== prev.fixed_gross && Math.abs(pct) < 10) {
        add('INFO', r.employee_id, 'Fixed salary changed', `Fixed gross ${inr(prev.fixed_gross)} to ${inr(r.fixed_gross)}. Confirm approval for the revision.`);
      }
      if (Math.abs(r.tds - prev.tds) > 1000 && prev.tds > 0 && Math.abs(r.tds - prev.tds) / prev.tds > 0.25) {
        add('MEDIUM', r.employee_id, 'TDS changed by more than 25%', `${inr(prev.tds)} to ${inr(r.tds)}`);
      }
    }

    if (r.employee_esic > 0 && r.fixed_gross > esicCeiling) {
      add('INFO', r.employee_id, 'ESIC continued above ceiling', `Fixed gross ${inr(r.fixed_gross)} exceeds ${inr(esicCeiling)}; coverage continues to the end of the contribution period.`);
    }
    if (r.employee_pf > 0 && !r.uan) add('MEDIUM', r.employee_id, 'PF deducted without UAN', 'UAN is needed for the ECR filing.');
    if (r.employee_esic > 0 && !r.esic_number) add('MEDIUM', r.employee_id, 'ESIC deducted without insurance number', 'IP number is needed for the ESIC return.');
    if (r.tds > 0 && !r.pan) add('HIGH', r.employee_id, 'TDS deducted without PAN', 'Without PAN, tax is deductible at a higher rate and Form 24Q will be defective.');
    if (r.bank_name && !r.account_number) add('HIGH', r.employee_id, 'No bank account number', 'Salary cannot be paid by bank transfer.');
  }

  for (const p of previous) {
    if (!currentIds.has(p.employee_id)) {
      const emp = empMap.get(p.employee_id);
      add(
        emp?.date_of_leaving ? 'INFO' : 'MEDIUM',
        p.employee_id,
        'Paid last month, not on this payroll',
        emp?.date_of_leaving ? `Left on ${emp.date_of_leaving}. Confirm full and final settlement.` : 'No date of leaving recorded. Confirm this is intended.'
      );
    }
  }

  const order = { HIGH: 0, MEDIUM: 1, INFO: 2 };
  exceptions.sort((a, b) => order[a.severity] - order[b.severity] || a.employee_id.localeCompare(b.employee_id));

  return { month, previous_month: hasPrev ? prevMonth : null, totals, exceptions, ai_configured: isAiConfigured() };
}

async function askModel(systemInstruction: string, prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('AI is not configured. Set GEMINI_API_KEY on the server to enable AI commentary. The exception review above does not need it.');
  }
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    contents: prompt,
    config: { systemInstruction, temperature: 0.2 }
  });
  return (response.text || '').trim();
}

/** Management commentary on the month's payroll, written by the model from the deterministic review */
export async function generateCommentary(month: string): Promise<string> {
  const review = buildPayrollReview(month);
  if (review.totals['Headcount'].current === 0) {
    throw new Error(`No processed payroll found for ${month}. Process the payroll first.`);
  }
  const system =
    'You are a payroll controller writing for the Finance Head of an Indian company. ' +
    'Use only the figures supplied; never compute or invent a number that is not given. ' +
    'Amounts are in Indian rupees; use Indian digit grouping. Be concise and specific. ' +
    'Structure: (1) one-line conclusion, (2) key movements versus the previous month with their drivers, ' +
    '(3) points the checker should resolve before locking, most serious first, (4) one line on anything that looks unusual. ' +
    'If there is no previous month, say so and comment on the current month only. Do not give legal advice.';
  const prompt = `Payroll review data (JSON). Employees are identified only by ID.\n\n${JSON.stringify(review, null, 1)}`;
  return askModel(system, prompt);
}

/** Plain-language answer to a question about one employee's payslip, grounded in the stored computation */
export async function explainPayslip(month: string, employeeId: string, question: string): Promise<string> {
  const db = getDb();
  const r = db.prepare('SELECT * FROM payroll WHERE payroll_month = ? AND employee_id = ?').get(month, employeeId) as any;
  if (!r) {
    throw new Error(`No payroll record for ${employeeId} in ${month}.`);
  }

  // Send the computation only - no name, PAN, bank, UAN or ESIC number
  const facts = {
    employee_id: r.employee_id,
    payroll_month: r.payroll_month,
    calendar_days: r.calendar_days,
    days_payable: r.days_payable,
    lop_days: r.lop_days,
    fixed: { basic: r.fixed_basic, da: r.fixed_da, hra: r.fixed_hra, conveyance: r.fixed_conveyance, medical: r.fixed_medical, special: r.fixed_special, gross: r.fixed_gross },
    earned: { basic: r.earned_basic, da: r.earned_da, hra: r.earned_hra, conveyance: r.earned_conveyance, medical: r.earned_medical, special: r.earned_special, overtime: r.overtime_amount, bonus: r.bonus_amount, gross: r.gross_earned },
    wage_rule_50pct: { applied: Boolean(r.wage_rule_applied), excess_added_to_wages: r.wage_rule_excess },
    pf: { wages: r.eligible_pf_wages, employee: r.employee_pf, employer: r.employer_pf, eps: r.employer_eps, epf: r.employer_epf },
    esic: { wages: r.eligible_esic_wages, employee: r.employee_esic, employer: r.employer_esic },
    professional_tax: r.professional_tax,
    tds: r.tds,
    tds_computation: JSON.parse(r.tds_details_json || '{}'),
    total_deductions: r.total_deductions,
    net_pay: r.take_home_pay
  };

  const system =
    'You explain an Indian salary computation to the employee or to a finance reviewer. ' +
    'Answer only from the computation supplied; quote its figures and show the arithmetic briefly. ' +
    'Do not recalculate tax yourself and do not invent figures. If the data does not answer the question, say what is missing. ' +
    'Amounts are in rupees with Indian digit grouping. Keep the answer under 150 words. This is an explanation, not tax advice.';
  const prompt = `Question: ${String(question).slice(0, 500)}\n\nStored computation (JSON):\n${JSON.stringify(facts, null, 1)}`;
  return askModel(system, prompt);
}
