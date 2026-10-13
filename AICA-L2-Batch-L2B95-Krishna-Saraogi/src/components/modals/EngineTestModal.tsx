/**
 * OneHR Payroll Manager - Statutory Engine Test Runner Modal
 */

import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, XCircle, RefreshCw, ShieldCheck, TestTube2 } from 'lucide-react';
import { api } from '../../services/api';

interface Props {
  onClose: () => void;
}

export const EngineTestModal: React.FC<Props> = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [testData, setTestData] = useState<{
    passed: boolean;
    total: number;
    passedCount: number;
    failedCount: number;
    results: Array<{ suiteName: string; testName: string; passed: boolean; message: string; expected?: any; actual?: any }>;
  } | null>(null);

  const runTests = async () => {
    setLoading(true);
    try {
      const res = await api.runTests();
      setTestData(res);
    } catch (err: any) {
      alert(`Test error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runTests();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <TestTube2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Statutory Calculation Test Suite</h3>
              <p className="text-xs text-slate-300">
                Automated deterministic unit tests for Indian payroll rules & demo cases
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-sm">
          
          {loading ? (
            <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
              <span>Executing payroll calculation test assertions...</span>
            </div>
          ) : testData ? (
            <div className="space-y-4">
              
              {/* Top Banner */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${testData.passed ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                <div className="flex items-center gap-3">
                  {testData.passed ? (
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-8 h-8 text-rose-600 shrink-0" />
                  )}
                  <div>
                    <h4 className="font-bold text-base">
                      {testData.passed ? 'All Statutory Payroll Tests Passed Successfully!' : 'Some Test Assertions Failed!'}
                    </h4>
                    <p className="text-xs opacity-90">
                      Covering: Simple/Detailed Salary, Pro-Rata, 50% Wage Rule, PF Ceiling, EPS Cap, ESIC Ceiling, PT Slabs, TDS New Regime (Nil ≤ 12L), Gratuity & Demo Cases (₹12k, ₹35k, ₹1.5L)
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black">{testData.passedCount} / {testData.total}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider">Passed</div>
                </div>
              </div>

              {/* Test List */}
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-96 overflow-y-auto bg-slate-50/50">
                {testData.results.map((r, idx) => (
                  <div key={idx} className="p-3 flex items-start justify-between text-xs hover:bg-white transition">
                    <div className="flex items-start gap-2.5">
                      {r.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-semibold text-slate-800">
                          <span className="text-indigo-600 font-bold">[{r.suiteName}]</span> {r.testName}
                        </div>
                        <div className="text-slate-500 mt-0.5">{r.message}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${r.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {r.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                ))}
              </div>

            </div>
          ) : null}

        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-between items-center">
          <button
            onClick={runTests}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Re-run Tests
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900 transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
