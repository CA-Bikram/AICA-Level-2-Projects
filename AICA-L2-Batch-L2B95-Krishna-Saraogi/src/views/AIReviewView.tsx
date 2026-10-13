/**
 * OneHR Payroll Manager - AI Review
 *
 * 1. Month-on-month totals and exception checks - computed by deterministic code.
 * 2. Management commentary - written by Gemini from those figures.
 * 3. Payslip questions - answered by Gemini from one employee's stored computation.
 */

import React, { useEffect, useState } from 'react';
import { Sparkles, AlertTriangle, AlertCircle, Info, MessageSquare } from 'lucide-react';
import { api, PayrollReview } from '../services/api';
import { PayrollRecord } from '../types/payroll';
import { formatIndianCurrency, formatPayrollMonth } from '../utils/indianNumber';

interface Props {
  currentMonth: string;
  records: PayrollRecord[];
}

const SEVERITY_STYLE = {
  HIGH: { cls: 'bg-rose-50 text-rose-800 border-rose-200', Icon: AlertTriangle },
  MEDIUM: { cls: 'bg-amber-50 text-amber-800 border-amber-200', Icon: AlertCircle },
  INFO: { cls: 'bg-slate-50 text-slate-700 border-slate-200', Icon: Info }
};

const SAMPLE_QUESTIONS = [
  'Why is my TDS this amount?',
  'Why is my take-home lower than my gross?',
  'How was my PF calculated?'
];

export const AIReviewView: React.FC<Props> = ({ currentMonth, records }) => {
  const [review, setReview] = useState<PayrollReview | null>(null);
  const [error, setError] = useState('');
  const [commentary, setCommentary] = useState('');
  const [commentaryError, setCommentaryError] = useState('');
  const [commentaryBusy, setCommentaryBusy] = useState(false);

  const [empId, setEmpId] = useState('');
  const [question, setQuestion] = useState(SAMPLE_QUESTIONS[0]);
  const [answer, setAnswer] = useState('');
  const [answerError, setAnswerError] = useState('');
  const [answerBusy, setAnswerBusy] = useState(false);

  useEffect(() => {
    setReview(null);
    setCommentary('');
    setCommentaryError('');
    setAnswer('');
    setAnswerError('');
    setError('');
    api.getPayrollReview(currentMonth).then(setReview).catch(err => setError(err.message || 'Could not load the review'));
  }, [currentMonth, records.length]);

  useEffect(() => {
    if (records.length > 0 && !records.some(r => r.employee_id === empId)) {
      setEmpId(records[0].employee_id);
    }
  }, [records, empId]);

  const runCommentary = async () => {
    setCommentaryBusy(true);
    setCommentaryError('');
    try {
      setCommentary((await api.getAiCommentary(currentMonth)).commentary);
    } catch (err: any) {
      setCommentaryError(err.message || 'AI commentary failed');
    } finally {
      setCommentaryBusy(false);
    }
  };

  const runExplain = async () => {
    setAnswerBusy(true);
    setAnswerError('');
    try {
      setAnswer((await api.explainPayslip(currentMonth, empId, question)).answer);
    } catch (err: any) {
      setAnswerError(err.message || 'AI explanation failed');
    } finally {
      setAnswerBusy(false);
    }
  };

  const isMoney = (label: string) => label !== 'Headcount';
  const fmt = (label: string, n: number | null) =>
    n === null ? '-' : isMoney(label) ? `${n < 0 ? '−' : ''}${formatIndianCurrency(Math.abs(n))}` : String(n);

  return (
    <div className="space-y-6 select-text">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          AI Review • {formatPayrollMonth(currentMonth)}
        </h2>
        <p className="text-xs text-slate-500">
          Figures and exception checks are computed by the payroll engine. AI writes the commentary and explanations from those figures only;
          it does not calculate pay. Employee names, PAN and bank details are never sent to the AI model.
        </p>
      </div>

      {error && <div className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}

      {review && review.totals['Headcount'].current === 0 && (
        <div className="text-sm text-slate-600 bg-white border border-slate-200 rounded-xl p-6">
          No processed payroll for {formatPayrollMonth(currentMonth)}. Process the payroll first.
        </div>
      )}

      {review && review.totals['Headcount'].current > 0 && (
        <>
          {/* Month-on-month */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-900">
              Month-on-month movement
              {review.previous_month ? ` vs ${formatPayrollMonth(review.previous_month)}` : ' (no previous month processed)'}
            </div>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="py-2 px-4 text-left font-semibold">Item</th>
                  <th className="py-2 px-4 text-right font-semibold">This month</th>
                  <th className="py-2 px-4 text-right font-semibold">Previous month</th>
                  <th className="py-2 px-4 text-right font-semibold">Change</th>
                  <th className="py-2 px-4 text-right font-semibold">Change %</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(review.totals).map(([label, t]) => (
                  <tr key={label} className="border-t border-slate-100">
                    <td className="py-2 px-4 font-medium text-slate-800">{label}</td>
                    <td className="py-2 px-4 text-right font-semibold text-slate-900">{fmt(label, t.current)}</td>
                    <td className="py-2 px-4 text-right text-slate-600">{fmt(label, t.previous)}</td>
                    <td className={`py-2 px-4 text-right ${t.change && t.change !== 0 ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>{fmt(label, t.change)}</td>
                    <td className="py-2 px-4 text-right text-slate-600">{t.change_pct === null ? '-' : `${t.change_pct > 0 ? '+' : ''}${t.change_pct}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Exceptions */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-900">
              Pre-lock exceptions ({review.exceptions.length})
            </div>
            {review.exceptions.length === 0 ? (
              <div className="p-4 text-xs text-slate-500">No exceptions found by the checks.</div>
            ) : (
              <table className="w-full text-xs">
                <tbody>
                  {review.exceptions.map((ex, i) => {
                    const { cls, Icon } = SEVERITY_STYLE[ex.severity];
                    return (
                      <tr key={i} className="border-t border-slate-100 first:border-0 align-top">
                        <td className="py-2 px-4 w-24">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-semibold text-[10px] ${cls}`}>
                            <Icon className="w-3 h-3" />
                            {ex.severity}
                          </span>
                        </td>
                        <td className="py-2 px-2 w-20 font-mono font-semibold text-slate-800">{ex.employee_id}</td>
                        <td className="py-2 px-2 w-64 font-medium text-slate-900">{ex.check}</td>
                        <td className="py-2 px-4 text-slate-600">{ex.detail}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {!review.ai_configured && (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              AI is not configured on this server (no GEMINI_API_KEY). The review above works without it; the two AI functions below need the key.
            </div>
          )}

          {/* Commentary */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Management commentary (AI)</div>
              <button
                onClick={runCommentary}
                disabled={commentaryBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-semibold"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {commentaryBusy ? 'Writing…' : commentary ? 'Regenerate' : 'Generate commentary'}
              </button>
            </div>
            {commentaryError && <div className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{commentaryError}</div>}
            {commentary && (
              <>
                <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{commentary}</div>
                <div className="text-[11px] text-slate-500">AI-generated from the figures above. Review before circulating.</div>
              </>
            )}
          </div>

          {/* Payslip Q&A */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-indigo-600" />
              Ask about a payslip (AI)
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={empId}
                onChange={e => setEmpId(e.target.value)}
                aria-label="Employee"
                className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
              >
                {records.map(r => (
                  <option key={r.employee_id} value={r.employee_id}>
                    {r.employee_id} - {r.employee_name}
                  </option>
                ))}
              </select>
              <input
                value={question}
                onChange={e => setQuestion(e.target.value)}
                aria-label="Question"
                className="flex-1 min-w-64 px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
              />
              <button
                onClick={runExplain}
                disabled={answerBusy || !empId || !question.trim()}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-semibold"
              >
                {answerBusy ? 'Answering…' : 'Ask'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_QUESTIONS.map(q => (
                <button key={q} onClick={() => setQuestion(q)} className="px-2 py-1 text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full hover:bg-indigo-100">
                  {q}
                </button>
              ))}
            </div>
            {answerError && <div className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{answerError}</div>}
            {answer && (
              <>
                <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{answer}</div>
                <div className="text-[11px] text-slate-500">AI explanation of the stored computation. Not tax advice.</div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};
