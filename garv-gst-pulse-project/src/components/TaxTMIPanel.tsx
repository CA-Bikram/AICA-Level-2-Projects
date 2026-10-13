import React, { useState } from 'react';
import {
  Key,
  RefreshCw,
  CheckCircle,
  ExternalLink,
  Plus,
  Scale,
  FileCheck,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  Filter,
  Search,
  Zap,
  Globe,
} from 'lucide-react';
import { GSTCaseLaw, GSTRegulatoryUpdate, TaxTMICredentials } from '../types';
import { taxtmiService } from '../services/taxtmiService';

interface TaxTMIPanelProps {
  credentials: TaxTMICredentials;
  onUpdateCredentials: (creds: TaxTMICredentials) => void;
  caseLaws: GSTCaseLaw[];
  onUpdateCaseLaws: (cases: GSTCaseLaw[]) => void;
  regulatoryUpdates: GSTRegulatoryUpdate[];
  onUpdateRegulatoryUpdates: (regs: GSTRegulatoryUpdate[]) => void;
  onRebuildNewsletter: () => void;
}

export const TaxTMIPanel: React.FC<TaxTMIPanelProps> = ({
  credentials,
  onUpdateCredentials,
  caseLaws,
  onUpdateCaseLaws,
  regulatoryUpdates,
  onUpdateRegulatoryUpdates,
  onRebuildNewsletter,
}) => {
  const [userId, setUserId] = useState(credentials.userId);
  const [password, setPassword] = useState(credentials.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'cases' | 'regs' | 'credentials'>('cases');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCaseIds, setExpandedCaseIds] = useState<Record<string, boolean>>({});
  const [expandedRegIds, setExpandedRegIds] = useState<Record<string, boolean>>({});

  const toggleCaseExpand = (id: string) => {
    setExpandedCaseIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleRegExpand = (id: string) => {
    setExpandedRegIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Custom modal for adding new case law
  const [showAddCaseModal, setShowAddCaseModal] = useState(false);
  const [newCase, setNewCase] = useState<Partial<GSTCaseLaw>>({
    court: 'High Court',
    category: 'Input Tax Credit',
    selectedForNewsletter: true,
  });

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: TaxTMICredentials = {
      ...credentials,
      userId,
      password,
    };
    taxtmiService.saveCredentials(updated);
    onUpdateCredentials(updated);
    setSyncFeedback('TaxTMI credentials securely saved for automated daily lookups.');
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  const handleTriggerSync = async (queryToUse?: string) => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const q = typeof queryToUse === 'string' ? queryToUse : searchQuery;
      const res = await taxtmiService.syncWithTaxTMI(credentials, q);
      onUpdateCredentials({ ...credentials, lastSyncedAt: res.syncedAt });
      if (res.cases && res.cases.length > 0) {
        onUpdateCaseLaws(res.cases);
      }
      if (res.regulatoryUpdates && res.regulatoryUpdates.length > 0) {
        onUpdateRegulatoryUpdates(res.regulatoryUpdates);
      }
      setSyncFeedback(res.message);
      onRebuildNewsletter();
    } catch (err: any) {
      setSyncFeedback('Sync error: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleTriggerSync(searchQuery);
  };

  const toggleCaseSelection = (id: string) => {
    const updated = caseLaws.map((c) =>
      c.id === id ? { ...c, selectedForNewsletter: !c.selectedForNewsletter } : c
    );
    taxtmiService.saveCaseLaws(updated);
    onUpdateCaseLaws(updated);
    onRebuildNewsletter();
  };

  const toggleRegSelection = (id: string) => {
    const updated = regulatoryUpdates.map((r) =>
      r.id === id ? { ...r, selectedForNewsletter: !r.selectedForNewsletter } : r
    );
    taxtmiService.saveRegulatoryUpdates(updated);
    onUpdateRegulatoryUpdates(updated);
    onRebuildNewsletter();
  };

  const handleCreateCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCase.title || !newCase.citation) return;

    const created: GSTCaseLaw = {
      id: `tmi-custom-${Date.now()}`,
      title: newCase.title,
      citation: newCase.citation,
      court: (newCase.court as any) || 'High Court',
      stateOrBench: newCase.stateOrBench || 'State Bench',
      date: newCase.date || new Date().toISOString().split('T')[0],
      tmiReference: newCase.tmiReference || `TMI-USER-${Date.now().toString().slice(-4)}`,
      category: (newCase.category as any) || 'Input Tax Credit',
      keyIssue: newCase.keyIssue || 'Statutory dispute',
      rulingSummary: newCase.rulingSummary || 'Ruling in favor of petitioner/revenue',
      practitionerTakeaway: newCase.practitionerTakeaway || 'Actionable advisory for taxpayers',
      selectedForNewsletter: true,
    };

    const updated = [created, ...caseLaws];
    taxtmiService.saveCaseLaws(updated);
    onUpdateCaseLaws(updated);
    onRebuildNewsletter();
    setShowAddCaseModal(false);
    setNewCase({ court: 'High Court', category: 'Input Tax Credit', selectedForNewsletter: true });
  };

  const filteredCaseLaws =
    categoryFilter === 'ALL'
      ? caseLaws
      : caseLaws.filter((c) => c.category === categoryFilter);

  const selectedCasesCount = caseLaws.filter((c) => c.selectedForNewsletter).length;
  const selectedRegsCount = regulatoryUpdates.filter((r) => r.selectedForNewsletter).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Top Banner with Real-Time Web Scraper Controls */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600/40 border border-indigo-400/30 flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold tracking-wide">TaxTMI Live Intelligence Hub</h2>
                <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Real-Time Web Scraper Active
                </span>
                <a
                  href="https://www.taxmanagementindia.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-300 hover:text-white flex items-center underline"
                >
                  taxtmi.com <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Real-time scraping of latest High Court & Supreme Court precedents, GSTAT rulings, and CBIC notifications
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => handleTriggerSync()}
              disabled={isSyncing}
              className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-md transition-all active:scale-95 disabled:opacity-75"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Scraping TaxTMI Live...' : 'Scrape Real-Time from TaxTMI'}</span>
            </button>
          </div>
        </div>

        {/* Live Search & Topic Scraper Input */}
        <form onSubmit={handleSearchSubmit} className="mt-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search or scrape TaxTMI for specific topics (e.g. DRC-01, Section 74, ITC, Amnesty, GSTAT)..."
              className="w-full bg-slate-800/90 text-white text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
            />
          </div>
          <button
            type="submit"
            disabled={isSyncing}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center justify-center space-x-1.5 shrink-0 disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>Search & Scrape Topic</span>
          </button>
        </form>

        {/* Quick Topic Chips */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300">
          <span className="text-slate-400">Quick Live Scrape:</span>
          {[
            'Instruction 01/2026 Mining Evasion',
            'Circular 256/2026 GSTAT CAA',
            'Rule 96(10) Export Refund OM',
            'DRC-01 SCN Mandatory',
            'Section 128A Amnesty',
            '57th GST Council Meeting',
          ].map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => {
                setSearchQuery(topic);
                handleTriggerSync(topic);
              }}
              className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white px-2 py-0.5 rounded border border-slate-700/80 transition-colors"
            >
              + {topic}
            </button>
          ))}
        </div>

        {syncFeedback && (
          <div className="mt-3.5 p-2.5 bg-indigo-900/80 border border-indigo-500/50 rounded-lg text-xs text-indigo-100 flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 px-5 flex items-center justify-between bg-slate-50">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('cases')}
            className={`py-3 text-xs font-bold border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'cases'
                ? 'border-indigo-600 text-indigo-900 bg-white px-3 -mb-px rounded-t'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Case Laws & Judgments</span>
            <span className="ml-1 text-[11px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded-full font-semibold">
              {selectedCasesCount}/3 picked
            </span>
          </button>

          <button
            onClick={() => setActiveTab('regs')}
            className={`py-3 text-xs font-bold border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'regs'
                ? 'border-indigo-600 text-indigo-900 bg-white px-3 -mb-px rounded-t'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>CBIC Circulars & Notifications</span>
            <span className="ml-1 text-[11px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded-full font-semibold">
              {selectedRegsCount}/3 picked
            </span>
          </button>

          <button
            onClick={() => setActiveTab('credentials')}
            className={`py-3 text-xs font-bold border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'credentials'
                ? 'border-indigo-600 text-indigo-900 bg-white px-3 -mb-px rounded-t'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>TaxTMI Credentials & Sync Setup</span>
          </button>
        </div>

        {activeTab === 'cases' && (
          <button
            onClick={() => setShowAddCaseModal(true)}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center py-1.5 px-2.5 rounded bg-indigo-50 border border-indigo-200"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Custom Precedent
          </button>
        )}
      </div>

      {/* Tab 1: Case Laws */}
      {activeTab === 'cases' && (
        <div className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center space-x-2 text-xs text-slate-600">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-medium">Filter Subject:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 text-xs text-slate-700 bg-white"
              >
                <option value="ALL">All Practice Areas</option>
                <option value="Input Tax Credit">Input Tax Credit (ITC)</option>
                <option value="Assessment & Notice (S.73/74)">Assessment & SCN (S.73/74)</option>
                <option value="E-way Bill & Detention">E-way Bill & Detention</option>
                <option value="Classification & Rate">Classification & Rate</option>
              </select>
            </div>
            <div className="text-xs text-slate-500">
              Select <strong>up to 3 landmark cases</strong> to feature on Page 1 of the Word newsletter.
            </div>
          </div>

          <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
            {filteredCaseLaws.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition-all ${
                  item.selectedForNewsletter
                    ? 'border-indigo-500/80 bg-indigo-50/40 shadow-sm ring-1 ring-indigo-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={item.selectedForNewsletter}
                      onChange={() => toggleCaseSelection(item.id)}
                      className="mt-1 h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {item.isRealTimeScraped && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white flex items-center gap-1 shadow-xs">
                            <Zap className="w-2.5 h-2.5 fill-current text-amber-300" /> LIVE SCRAPED
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-900 text-white">
                          {item.court}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-900 border border-amber-200">
                          {item.citation}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Ref: {item.tmiReference}
                        </span>
                        {item.category && (
                          <span className="text-[11px] font-medium text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded">
                            {item.category}
                          </span>
                        )}
                        {item.sectionsInvolved && (
                          <span className="text-[10.5px] font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded border border-emerald-200">
                            {item.sectionsInvolved}
                          </span>
                        )}
                        {item.date && (
                          <span className="text-[10.5px] text-slate-500 font-medium">
                            • {item.date}
                          </span>
                        )}
                        {item.sourceUrl && (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-0.5 font-medium ml-1"
                          >
                            <Globe className="w-3 h-3" /> View Source
                          </a>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">{item.title}</h4>
                      <div className="text-xs text-slate-700 mt-1.5 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <strong className="text-slate-900 block mb-0.5">Core Statutory Dispute & Issue: </strong>
                        <span>{item.keyIssue}</span>
                      </div>
                      <div className="text-xs text-slate-800 mt-1.5 leading-relaxed bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
                        <strong className="text-indigo-950 block mb-0.5">Judicial Holding & Ratio Decidendi: </strong>
                        <span>{item.rulingSummary}</span>
                      </div>
                      <div className="mt-2 text-xs bg-emerald-50 text-emerald-900 p-2.5 rounded-lg border border-emerald-200 leading-relaxed">
                        <strong className="block mb-0.5 text-emerald-950">Taxpayers' Impact & Practitioner's Takeaway: </strong>
                        <span>{item.practitionerTakeaway}</span>
                      </div>

                      {item.fullAnalysis && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => toggleCaseExpand(item.id)}
                            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                          >
                            <span>{expandedCaseIds[item.id] ? '▲ Hide Full Judgment Text' : '▼ Read Full Judgment & Factual Analysis'}</span>
                          </button>
                          {expandedCaseIds[item.id] && (
                            <div className="mt-2 p-3 bg-slate-100 rounded-lg text-xs text-slate-700 leading-relaxed border border-slate-200 max-h-48 overflow-y-auto">
                              <p className="font-semibold text-slate-900 mb-1">Detailed Excerpt & Analysis:</p>
                              <p>{item.fullAnalysis}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Regulatory Updates */}
      {activeTab === 'regs' && (
        <div className="p-5">
          <p className="text-xs text-slate-500 mb-3.5">
            Select <strong>up to 3 regulatory circulars / notifications</strong> to feature on Page 2 of the newsletter.
          </p>

          <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
            {regulatoryUpdates.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition-all ${
                  item.selectedForNewsletter
                    ? 'border-indigo-500/80 bg-indigo-50/40 shadow-sm ring-1 ring-indigo-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    checked={item.selectedForNewsletter}
                    onChange={() => toggleRegSelection(item.id)}
                    className="mt-1 h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      {item.isRealTimeScraped && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white flex items-center gap-1 shadow-xs">
                          <Zap className="w-2.5 h-2.5 fill-current text-amber-300" /> LIVE SCRAPED
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-700 text-white">
                        {item.type}
                      </span>
                      <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {item.number}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Dated: {item.date}
                      </span>
                      {item.issuingAuthority && (
                        <span className="text-[10.5px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {item.issuingAuthority}
                        </span>
                      )}
                      {item.sourceUrl && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-0.5 font-medium ml-1"
                        >
                          <Globe className="w-3 h-3" /> View Source
                        </a>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">{item.title}</h4>
                    <div className="text-xs text-slate-700 mt-1.5 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <strong className="text-slate-900 block mb-0.5">Statutory Brief & Provisions: </strong>
                      <span>{item.brief}</span>
                    </div>
                    <div className="mt-2 text-xs bg-amber-50 text-amber-900 p-2.5 rounded-lg border border-amber-200 leading-relaxed">
                      <strong className="block mb-0.5 text-amber-950">Taxpayers' Compliance Directives & Impact: </strong>
                      <span>{item.impactOnTaxpayers || item.impactOnClients}</span>
                    </div>

                    {item.fullAnalysis && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => toggleRegExpand(item.id)}
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                        >
                          <span>{expandedRegIds[item.id] ? '▲ Hide Full Text' : '▼ Read Full Regulatory Brief & Notice Text'}</span>
                        </button>
                        {expandedRegIds[item.id] && (
                          <div className="mt-2 p-3 bg-slate-100 rounded-lg text-xs text-slate-700 leading-relaxed border border-slate-200 max-h-48 overflow-y-auto">
                            <p className="font-semibold text-slate-900 mb-1">Official Text:</p>
                            <p>{item.fullAnalysis}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: TaxTMI Credentials & Config */}
      {activeTab === 'credentials' && (
        <div className="p-6 max-w-2xl">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-xs text-blue-900 flex items-start space-x-3">
            <Lock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-blue-950 mb-1">
                TaxTMI (www.taxtmi.com) Account Authentication
              </h4>
              <p>
                Provide your Tax Management India account credentials once. They are safely encrypted and preserved for automated retrieval of latest Supreme Court, High Court, and Tribunal precedents.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveCredentials} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                TaxTMI User ID / Registered Email:
              </label>
              <input
                type="text"
                required
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="e.g. anshuman.taxp@taxtmi.com"
                className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                TaxTMI Password:
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter TaxTMI account password"
                  className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Subscription Tier:
                </label>
                <select
                  value={credentials.subscriptionPlan}
                  onChange={(e) =>
                    onUpdateCredentials({
                      ...credentials,
                      subscriptionPlan: e.target.value as any,
                    })
                  }
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="Professional">Professional Practitioner</option>
                  <option value="Corporate">Corporate Multi-User</option>
                  <option value="Enterprise">Enterprise Law Firm</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Automated Daily Check:
                </label>
                <select
                  value={credentials.syncFrequencyHours}
                  onChange={(e) =>
                    onUpdateCredentials({
                      ...credentials,
                      syncFrequencyHours: Number(e.target.value),
                    })
                  }
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white"
                >
                  <option value={6}>Every 6 Hours</option>
                  <option value={12}>Every 12 Hours (Recommended)</option>
                  <option value={24}>Once Daily (Pre-10 AM)</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex items-center space-x-3">
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow transition active:scale-95"
              >
                Save Credentials for Future Reference
              </button>
              <button
                type="button"
                onClick={() => handleTriggerSync()}
                disabled={isSyncing}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-lg border border-slate-300 transition"
              >
                {isSyncing ? 'Verifying Account...' : 'Test Login & Sync Now'}
              </button>
            </div>

            {credentials.lastSyncedAt && (
              <p className="text-[11px] text-slate-500 pt-1">
                Last verified connection: {new Date(credentials.lastSyncedAt).toLocaleString('en-IN')}
              </p>
            )}
          </form>
        </div>
      )}

      {/* Add Custom Case Modal */}
      {showAddCaseModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center">
              <Scale className="w-5 h-5 text-indigo-600 mr-2" /> Add Custom Judicial Ruling
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter details for a recent order or ruling to feature in your newsletter.
            </p>

            <form onSubmit={handleCreateCase} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-0.5">
                  Case Title & Parties:
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ABC Global Corp vs Union of India"
                  value={newCase.title || ''}
                  onChange={(e) => setNewCase({ ...newCase, title: e.target.value })}
                  className="w-full text-xs px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-0.5">
                    Citation / TMI Ref:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2026 (9) TMI 512"
                    value={newCase.citation || ''}
                    onChange={(e) => setNewCase({ ...newCase, citation: e.target.value })}
                    className="w-full text-xs px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-0.5">
                    Judicial Forum:
                  </label>
                  <select
                    value={newCase.court || 'High Court'}
                    onChange={(e) => setNewCase({ ...newCase, court: e.target.value as any })}
                    className="w-full text-xs px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="Supreme Court">Supreme Court of India</option>
                    <option value="High Court">High Court</option>
                    <option value="GSTAT / Tribunal">GSTAT / Tribunal</option>
                    <option value="AAR / AAAR">AAR / AAAR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-0.5">
                  Core Legal Issue:
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Whether ITC is admissible on capital goods..."
                  value={newCase.keyIssue || ''}
                  onChange={(e) => setNewCase({ ...newCase, keyIssue: e.target.value })}
                  className="w-full text-xs px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-0.5">
                  Ruling Summary / Held:
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Key principle decided by the court..."
                  value={newCase.rulingSummary || ''}
                  onChange={(e) => setNewCase({ ...newCase, rulingSummary: e.target.value })}
                  className="w-full text-xs px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-0.5">
                  Taxpayers' Impact / Practitioner's Takeaway:
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="What taxpayers should do based on this verdict..."
                  value={newCase.practitionerTakeaway || ''}
                  onChange={(e) =>
                    setNewCase({ ...newCase, practitionerTakeaway: e.target.value })
                  }
                  className="w-full text-xs px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddCaseModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow"
                >
                  Add Case to Newsletter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
