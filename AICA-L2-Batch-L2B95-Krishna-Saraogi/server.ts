/**
 * OneHR Payroll Manager - Full Stack Server
 * Node.js + Express + Native SQLite (better-sqlite3) + Vite Middlewares
 * 
 * Features:
 * - WAL mode native SQLite data layer
 * - Clean repository pattern (Employee, Attendance, Payroll, Settings, Reports)
 * - Atomic transactional operations for all multi-step writes
 * - Online WAL-safe database backup API
 * - Comprehensive database health check reporting engine, PRAGMAs, and metrics
 * - Sign-in with three roles (maker / checker / admin) and an audit trail of every change
 * - Listens on PORT (default 3000) for localhost, office LAN or cloud hosting
 * - Sanitized logging and secure error handling
 */

import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  backupDatabase,
  getDbHealth,
  applyMigrations,
  getNativeDb,
  employeeRepository,
  attendanceRepository,
  payrollRepository,
  settingsRepository,
  reportRepository
} from './src/backend/db';
import { runAllTests } from './src/tests/payrollEngine.test';
import { apiGuard, getAuditLog, getSessionUser, login, logout, seedUsersIfEmpty } from './src/backend/auth';
import { seedDemoDataIfEmpty } from './src/backend/demoSeed';
import { buildPayrollReview, explainPayslip, generateCommentary } from './src/backend/aiReview';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Behind a hosting proxy (Render, Cloud Run, etc.) the original protocol arrives in a header
app.set('trust proxy', 1);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure database schema migrations are applied on startup
try {
  const db = getNativeDb();
  const mig = applyMigrations(db);
  console.log(`Database initialized. Version: ${mig.currentVersion}, Migrations applied: ${mig.applied}`);
  seedUsersIfEmpty();
  seedDemoDataIfEmpty();
} catch (err) {
  console.error('Fatal: Failed to initialize database schema:', err);
}

// Sanitized technical logging helper (never logs PAN, Bank Account, UAN, ESIC, Salary)
function logError(context: string, err: any) {
  console.error(`[${new Date().toISOString()}] Error in ${context}:`, err.message || err);
}

// ==========================================
// 0. SIGN-IN, ROLES & AUDIT TRAIL
// ==========================================
// Every /api route below this line needs a signed-in user with a permitted role,
// except /api/health and /api/auth/*.
app.use('/api', apiGuard);

app.post('/api/auth/login', login);
app.post('/api/auth/logout', logout);
// Demo sign-ins are shown on the login screen only in demo mode with the built-in passwords
app.get('/api/auth/demo', (req: Request, res: Response) => {
  const demo = process.env.SEED_DEMO === 'true';
  const builtIn = !process.env.ADMIN_PASSWORD && !process.env.MAKER_PASSWORD && !process.env.CHECKER_PASSWORD;
  res.json({
    demo,
    users: demo && builtIn
      ? [
          { username: 'maker', password: 'Maker@2026', role: 'Maker: masters, attendance, processing' },
          { username: 'checker', password: 'Checker@2026', role: 'Checker: review, lock, audit trail' },
          { username: 'admin', password: 'Admin@2026', role: 'Admin: settings and everything else' }
        ]
      : []
  });
});
app.get('/api/auth/me', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not signed in' });
  }
  res.json({ user });
});

app.get('/api/audit', (req: Request, res: Response) => {
  try {
    res.json(getAuditLog(Number(req.query.limit) || 200));
  } catch (err: any) {
    logError('GET /api/audit', err);
    res.status(500).json({ error: 'Failed to load audit trail' });
  }
});

// ==========================================
// 1. HEALTH & TESTS API
// ==========================================
app.get('/api/health', (req: Request, res: Response) => {
  try {
    // Public endpoint for uptime checks: no database details
    getDbHealth();
    res.json({
      status: 'ok',
      app: 'OneHR Payroll Manager',
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    logError('GET /api/health', err);
    res.status(500).json({ status: 'error', error: 'Database health check failed' });
  }
});

app.get('/api/db/health', (req: Request, res: Response) => {
  try {
    const health = getDbHealth();
    res.json(health);
  } catch (err: any) {
    logError('GET /api/db/health', err);
    res.status(500).json({ error: 'Failed to retrieve database health' });
  }
});

app.post('/api/tests/run', (req: Request, res: Response) => {
  try {
    const testResults = runAllTests();
    res.json(testResults);
  } catch (err: any) {
    logError('POST /api/tests/run', err);
    res.status(500).json({ error: 'Failed to run test suite' });
  }
});

// ==========================================
// 2. COMPANY PROFILE API
// ==========================================
app.get('/api/company', (req: Request, res: Response) => {
  try {
    const company = settingsRepository.getCompany();
    res.json(company);
  } catch (err: any) {
    logError('GET /api/company', err);
    res.status(500).json({ error: 'Failed to load company profile' });
  }
});

app.put('/api/company', (req: Request, res: Response) => {
  try {
    const updated = settingsRepository.updateCompany(req.body);
    res.json({ success: true, company: updated });
  } catch (err: any) {
    logError('PUT /api/company', err);
    res.status(500).json({ error: 'Failed to update company profile' });
  }
});

// ==========================================
// 3. SETTINGS & STATUTORY SLABS API
// ==========================================
app.get('/api/settings', (req: Request, res: Response) => {
  try {
    const settings = settingsRepository.getSettings();
    res.json(settings);
  } catch (err: any) {
    logError('GET /api/settings', err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

app.put('/api/settings', (req: Request, res: Response) => {
  try {
    const updated = settingsRepository.updateSettings(req.body);
    res.json({ success: true, settings: updated });
  } catch (err: any) {
    logError('PUT /api/settings', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

app.post('/api/settings/reset', (req: Request, res: Response) => {
  try {
    const reset = settingsRepository.resetSettings();
    res.json({ success: true, settings: reset });
  } catch (err: any) {
    logError('POST /api/settings/reset', err);
    res.status(500).json({ error: 'Failed to reset settings' });
  }
});

app.get('/api/pt-slabs', (req: Request, res: Response) => {
  try {
    const slabs = settingsRepository.getPTSlabs();
    res.json(slabs);
  } catch (err: any) {
    logError('GET /api/pt-slabs', err);
    res.status(500).json({ error: 'Failed to load PT slabs' });
  }
});

app.put('/api/pt-slabs', (req: Request, res: Response) => {
  try {
    const slabs = req.body.slabs || req.body;
    const updated = settingsRepository.updatePTSlabs(slabs);
    res.json({ success: true, slabs: updated });
  } catch (err: any) {
    logError('PUT /api/pt-slabs', err);
    res.status(500).json({ error: 'Failed to update PT slabs' });
  }
});

app.get('/api/tax-slabs', (req: Request, res: Response) => {
  try {
    const slabs = settingsRepository.getTaxSlabs();
    res.json(slabs);
  } catch (err: any) {
    logError('GET /api/tax-slabs', err);
    res.status(500).json({ error: 'Failed to load tax slabs' });
  }
});

app.put('/api/tax-slabs', (req: Request, res: Response) => {
  try {
    const slabs = req.body.slabs || req.body;
    const updated = settingsRepository.updateTaxSlabs(slabs);
    res.json({ success: true, slabs: updated });
  } catch (err: any) {
    logError('PUT /api/tax-slabs', err);
    res.status(500).json({ error: 'Failed to update tax slabs' });
  }
});

// ==========================================
// 4. EMPLOYEE MASTER API
// ==========================================
app.get('/api/employees', (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const employees = employeeRepository.getAll(status);
    res.json(employees);
  } catch (err: any) {
    logError('GET /api/employees', err);
    res.status(500).json({ error: 'Failed to retrieve employees' });
  }
});

app.get('/api/employees/:id', (req: Request, res: Response) => {
  try {
    const employee = employeeRepository.getById(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(employee);
  } catch (err: any) {
    logError(`GET /api/employees/${req.params.id}`, err);
    res.status(500).json({ error: 'Failed to retrieve employee' });
  }
});

app.post('/api/employees', (req: Request, res: Response) => {
  try {
    const created = employeeRepository.create(req.body);
    res.json({ success: true, employee: created });
  } catch (err: any) {
    logError('POST /api/employees', err);
    res.status(500).json({ error: err.message || 'Failed to create employee' });
  }
});

app.put('/api/employees/:id', (req: Request, res: Response) => {
  try {
    const updated = employeeRepository.update(req.params.id, req.body);
    res.json({ success: true, employee: updated });
  } catch (err: any) {
    logError(`PUT /api/employees/${req.params.id}`, err);
    res.status(500).json({ error: err.message || 'Failed to update employee' });
  }
});

app.delete('/api/employees/:id', (req: Request, res: Response) => {
  try {
    const success = employeeRepository.delete(req.params.id);
    res.json({ success, message: success ? 'Employee deleted' : 'Employee not found' });
  } catch (err: any) {
    logError(`DELETE /api/employees/${req.params.id}`, err);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

app.post('/api/employees/bulk-import', (req: Request, res: Response) => {
  try {
    const { rows, mode = 'SIMPLE' } = req.body;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: 'Payload must contain rows array' });
    }
    const report = employeeRepository.bulkImport(rows, mode);
    res.json(report);
  } catch (err: any) {
    logError('POST /api/employees/bulk-import', err);
    res.status(500).json({ error: err.message || 'Bulk employee import failed' });
  }
});

// ==========================================
// 5. ATTENDANCE API
// ==========================================
app.get('/api/attendance', (req: Request, res: Response) => {
  try {
    const month = req.query.month as string;
    if (!month) {
      return res.status(400).json({ error: 'Missing month parameter' });
    }
    const records = attendanceRepository.getByMonth(month);
    res.json(records);
  } catch (err: any) {
    logError('GET /api/attendance', err);
    res.status(500).json({ error: 'Failed to retrieve attendance' });
  }
});

app.post('/api/attendance/update', (req: Request, res: Response) => {
  try {
    const { employee_id, payroll_month, days_map, overtime_amount, bonus_amount, remarks } = req.body;
    if (!employee_id || !payroll_month || !days_map) {
      return res.status(400).json({ error: 'Missing required attendance fields' });
    }
    if (payrollRepository.isLocked(payroll_month)) {
      return res.status(400).json({ error: `Payroll for ${payroll_month} is LOCKED. Attendance cannot be changed.` });
    }
    const summary = attendanceRepository.saveRecord(
      employee_id,
      payroll_month,
      days_map,
      Number(overtime_amount || 0),
      Number(bonus_amount || 0),
      remarks || ''
    );
    res.json({ success: true, summary });
  } catch (err: any) {
    logError('POST /api/attendance/update', err);
    res.status(500).json({ error: err.message || 'Failed to update attendance' });
  }
});

app.post('/api/attendance/bulk-import', (req: Request, res: Response) => {
  try {
    const { month, rows } = req.body;
    if (!month || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'Missing month or rows array' });
    }
    if (payrollRepository.isLocked(month)) {
      return res.status(400).json({ error: `Payroll for ${month} is LOCKED. Attendance cannot be changed.` });
    }
    const report = attendanceRepository.bulkImport(month, rows);
    res.json(report);
  } catch (err: any) {
    logError('POST /api/attendance/bulk-import', err);
    res.status(500).json({ error: err.message || 'Bulk attendance import failed' });
  }
});

// ==========================================
// 6. PAYROLL PROCESSING API
// ==========================================
app.get('/api/payroll/runs', (req: Request, res: Response) => {
  try {
    const runs = payrollRepository.getRuns();
    res.json(runs);
  } catch (err: any) {
    logError('GET /api/payroll/runs', err);
    res.status(500).json({ error: 'Failed to retrieve payroll runs' });
  }
});

app.get('/api/payroll/run/:month', (req: Request, res: Response) => {
  try {
    const { month } = req.params;
    const data = payrollRepository.getRunByMonth(month);
    res.json(data);
  } catch (err: any) {
    logError(`GET /api/payroll/run/${req.params.month}`, err);
    res.status(500).json({ error: 'Failed to retrieve payroll run details' });
  }
});

app.get('/api/payroll/worksheet/:month/:employeeId', (req: Request, res: Response) => {
  try {
    const sheet = payrollRepository.getTaxWorksheet(req.params.month, req.params.employeeId);
    if (!sheet) {
      return res.status(404).json({ error: 'No payroll record for this employee and month' });
    }
    res.json(sheet);
  } catch (err: any) {
    logError('GET /api/payroll/worksheet', err);
    res.status(500).json({ error: 'Failed to build the tax worksheet' });
  }
});

app.post('/api/payroll/process', (req: Request, res: Response) => {
  try {
    const { month } = req.body;
    if (!month) {
      return res.status(400).json({ error: 'Payroll month is required' });
    }
    const result = payrollRepository.processPayroll(month);
    res.json(result);
  } catch (err: any) {
    logError('POST /api/payroll/process', err);
    const statusCode = err.message?.includes('LOCKED') ? 400 : 500;
    res.status(statusCode).json({ error: err.message || 'Payroll processing failed' });
  }
});

app.post('/api/payroll/lock', (req: Request, res: Response) => {
  try {
    const { month } = req.body;
    if (!month) {
      return res.status(400).json({ error: 'Payroll month is required' });
    }
    // Locked by the signed-in user, not a name supplied by the browser
    const success = payrollRepository.lockPayroll(month, (req as any).user?.username || 'unknown');
    res.json({ success, status: 'Locked', message: success ? `Payroll for ${month} locked` : 'Payroll run not found' });
  } catch (err: any) {
    logError('POST /api/payroll/lock', err);
    res.status(500).json({ error: err.message || 'Failed to lock payroll' });
  }
});

app.post('/api/payroll/unlock', (req: Request, res: Response) => {
  try {
    const { month, reason } = req.body;
    if (!month) {
      return res.status(400).json({ error: 'Payroll month is required' });
    }
    if (!reason || String(reason).trim().length < 5) {
      return res.status(400).json({ error: 'A reason is required to unlock a payroll (recorded in the audit trail)' });
    }
    const success = payrollRepository.unlockPayroll(month);
    res.json({ success, status: 'Processed', message: success ? `Payroll for ${month} unlocked` : 'Payroll run not found' });
  } catch (err: any) {
    logError('POST /api/payroll/unlock', err);
    res.status(500).json({ error: err.message || 'Failed to unlock payroll' });
  }
});

app.post('/api/payroll/status', (req: Request, res: Response) => {
  try {
    const { month, status } = req.body;
    if (!month || !status) {
      return res.status(400).json({ error: 'Missing month or status' });
    }
    const success = payrollRepository.setPayrollStatus(month, status);
    res.json({ success, status });
  } catch (err: any) {
    logError('POST /api/payroll/status', err);
    const statusCode = /LOCKED|Lock Payroll/.test(err.message || '') ? 400 : 500;
    res.status(statusCode).json({ error: err.message || 'Failed to update payroll status' });
  }
});

// ==========================================
// 6A. AI-ASSISTED REVIEW
// ==========================================
// The exception review is deterministic. Gemini only writes commentary / explanations
// from those figures; it never calculates pay. No names, PAN or bank details are sent.
app.get('/api/ai/review/:month', (req: Request, res: Response) => {
  try {
    res.json(buildPayrollReview(req.params.month));
  } catch (err: any) {
    logError('GET /api/ai/review', err);
    res.status(500).json({ error: 'Failed to build payroll review' });
  }
});

app.post('/api/ai/commentary', async (req: Request, res: Response) => {
  try {
    const { month } = req.body;
    if (!month) {
      return res.status(400).json({ error: 'Payroll month is required' });
    }
    res.json({ commentary: await generateCommentary(month) });
  } catch (err: any) {
    logError('POST /api/ai/commentary', err);
    res.status(400).json({ error: err.message || 'AI commentary failed' });
  }
});

app.post('/api/ai/explain', async (req: Request, res: Response) => {
  try {
    const { month, employee_id, question } = req.body;
    if (!month || !employee_id || !question) {
      return res.status(400).json({ error: 'Month, employee and question are required' });
    }
    res.json({ answer: await explainPayslip(month, employee_id, question) });
  } catch (err: any) {
    logError('POST /api/ai/explain', err);
    res.status(400).json({ error: err.message || 'AI explanation failed' });
  }
});

// ==========================================
// 7. DASHBOARD API
// ==========================================
app.get('/api/dashboard/stats', (req: Request, res: Response) => {
  try {
    const stats = reportRepository.getDashboardStats();
    res.json(stats);
  } catch (err: any) {
    logError('GET /api/dashboard/stats', err);
    res.status(500).json({ error: 'Failed to retrieve dashboard statistics' });
  }
});

// ==========================================
// 8. BACKUP & RESTORE API
// ==========================================
app.get('/api/backup/export', (req: Request, res: Response) => {
  try {
    const backupData = reportRepository.exportAllToJson();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=onehr_payroll_backup_${Date.now()}.json`);
    res.json(backupData);
  } catch (err: any) {
    logError('GET /api/backup/export', err);
    res.status(500).json({ error: 'Failed to export backup data' });
  }
});

app.post('/api/backup/import', (req: Request, res: Response) => {
  try {
    const { data } = req.body;
    const result = reportRepository.importAllFromJson(data);
    res.json(result);
  } catch (err: any) {
    logError('POST /api/backup/import', err);
    res.status(500).json({ error: err.message || 'Failed to import backup data' });
  }
});

app.post('/api/backup/database', async (req: Request, res: Response) => {
  try {
    const result = await backupDatabase();
    res.json({
      success: true,
      message: 'Native SQLite WAL database backup created successfully',
      ...result
    });
  } catch (err: any) {
    logError('POST /api/backup/database', err);
    res.status(500).json({ error: err.message || 'Failed to create live database backup' });
  }
});

// ==========================================
// 9. VITE MIDDLEWARES & DEV / PROD SERVER
// ==========================================
async function startServer() {
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    import.meta.url.includes('/dist/') ||
    import.meta.url.includes('\\dist\\') ||
    Boolean(process.argv[1] && process.argv[1].includes('dist'));
  const isDev = !isProduction;

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve built static files from dist
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req: Request, res: Response) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    } else {
      console.warn(`[WARN] Production dist directory not found at: ${distPath}`);
    }
  }

  const portNum = PORT;
  app.listen(portNum, '0.0.0.0', () => {
    console.log(`OneHR Payroll Manager Server running on http://0.0.0.0:${portNum}`);
    console.log(`Local Access: http://localhost:${portNum}/`);
    console.log(`Mode: ${isProduction ? 'Production (serving built frontend & API)' : 'Development (Vite middleware)'}`);
    console.log(`Database Engine: Native SQLite (better-sqlite3) in WAL mode`);
  });
}

startServer();
