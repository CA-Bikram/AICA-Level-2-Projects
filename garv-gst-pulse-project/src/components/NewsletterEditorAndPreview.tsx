import React, { useState } from 'react';
import {
  FileText,
  Download,
  HardDrive,
  CheckCircle2,
  Calendar,
  Send,
  ExternalLink,
  Edit3,
  Building,
  UserCheck,
  AlertTriangle,
  FileCheck,
  Sparkles,
  RefreshCw,
  Scale,
  FileSpreadsheet,
  ListChecks,
  Shield,
  Plus,
  Trash2,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import {
  NewsletterContent,
  PractitionerProfile,
  GSTCaseLaw,
  GSTRegulatoryUpdate,
  ComplianceDueDate,
} from '../types';
import {
  generateDocxBlob,
  generatePdfBlob,
  getPdfFileName,
  getDocxFileName,
  generateExecutiveTaxEditorial,
  getDailySerialVolumeAndIssue,
  resetDailyIssueTracker,
} from '../services/newsletterEngine';
import { driveService } from '../services/driveService';
import { GarvLogo } from './GarvLogo';

interface NewsletterEditorAndPreviewProps {
  newsletter: NewsletterContent;
  onUpdateNewsletter: (updated: NewsletterContent) => void;
  profile: PractitionerProfile;
  onUpdateProfile: (profile: PractitionerProfile) => void;
  accessToken: string | null;
  onOpenDispatchModal: () => void;
  onDriveSaved: (link: string) => void;
  onGenerateTodayEdition?: () => void;
  isGeneratingEdition?: boolean;
}

type EditSection =
  | 'none'
  | 'header'
  | 'editorial'
  | 'cases'
  | 'regulatory'
  | 'calendar'
  | 'checklist'
  | 'disclaimer'
  | 'profile';

export const NewsletterEditorAndPreview: React.FC<NewsletterEditorAndPreviewProps> = ({
  newsletter,
  onUpdateNewsletter,
  profile,
  onUpdateProfile,
  accessToken,
  onOpenDispatchModal,
  onDriveSaved,
  onGenerateTodayEdition,
  isGeneratingEdition,
}) => {
  const [activePreviewPage, setActivePreviewPage] = useState<1 | 2>(1);
  const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSavingToDrive, setIsSavingToDrive] = useState(false);
  const [driveSuccessNotice, setDriveSuccessNotice] = useState<string | null>(null);

  const [activeEditSection, setActiveEditSection] = useState<EditSection>('none');
  const [actionError, setActionError] = useState<string | null>(null);
  const [editorialAutoNotice, setEditorialAutoNotice] = useState<string | null>(null);
  const [isAutoSummarizingEditorial, setIsAutoSummarizingEditorial] = useState(false);

  const handleAutoSummarizeEditorial = async () => {
    setIsAutoSummarizingEditorial(true);
    setEditorialAutoNotice('⚡ Auto-summarizing editorial commentary from case laws & circulars...');
    try {
      const res = await fetch('/api/gemini/summarize-editorial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cases: newsletter.caseLaws,
          regulatoryUpdates: newsletter.regulatoryUpdates,
          editionMonth: newsletter.editionMonth,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.summary && data.summary.trim().length > 30) {
          onUpdateNewsletter({ ...newsletter, editorialNote: data.summary.trim() });
          setEditorialAutoNotice('✨ Editorial Commentary & Perspective auto-summarized from current case laws & circulars!');
          setTimeout(() => setEditorialAutoNotice(null), 4000);
          return;
        }
      }
    } catch (err) {
      console.warn('AI Editorial summarization notice, using algorithmic engine:', err);
    } finally {
      setIsAutoSummarizingEditorial(false);
    }

    const autoSummary = generateExecutiveTaxEditorial(
      newsletter.caseLaws,
      newsletter.regulatoryUpdates,
      newsletter.editionMonth
    );
    onUpdateNewsletter({ ...newsletter, editorialNote: autoSummary });
    setEditorialAutoNotice('✨ Editorial Commentary & Perspective auto-summarized from current case laws & circulars!');
    setTimeout(() => setEditorialAutoNotice(null), 4000);
  };

  // Trigger real .docx download
  const handleDownloadDocx = async () => {
    setIsGeneratingDocx(true);
    setActionError(null);
    try {
      const blob = await generateDocxBlob(newsletter, profile);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getDocxFileName(newsletter);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setActionError(err.message || 'Failed to generate Word .docx');
    } finally {
      setIsGeneratingDocx(false);
    }
  };

  // Trigger real PDF download
  const handleDownloadPdf = () => {
    setIsGeneratingPdf(true);
    setActionError(null);
    try {
      const blob = generatePdfBlob(newsletter, profile);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getPdfFileName(newsletter);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setActionError(err.message || 'Failed to generate PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Save both Docx and PDF to Google Drive / Cloud Archive
  const handleSaveToDrive = async () => {
    setIsSavingToDrive(true);
    setActionError(null);
    setDriveSuccessNotice(null);
    try {
      const docxBlob = await generateDocxBlob(newsletter, profile);
      const docxName = getDocxFileName(newsletter);
      const docxResult = await driveService.uploadFile(
        docxBlob,
        docxName,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );

      const pdfBlob = generatePdfBlob(newsletter, profile);
      const pdfName = getPdfFileName(newsletter);
      const pdfResult = await driveService.uploadFile(
        pdfBlob,
        pdfName,
        'application/pdf'
      );

      onUpdateNewsletter({
        ...newsletter,
        driveFileId: pdfResult.fileId,
        driveWebViewLink: pdfResult.webViewLink,
        driveDocxLink: docxResult.webViewLink,
      });

      onDriveSaved(pdfResult.webViewLink);
      setDriveSuccessNotice('Saved to Google Drive: 2-Page PDF & Word (.docx) archived!');
      setTimeout(() => setDriveSuccessNotice(null), 8000);
    } catch (err: any) {
      setActionError('Google Drive Save Failed: ' + err.message);
    } finally {
      setIsSavingToDrive(false);
    }
  };

  // Toggle Verification status
  const handleToggleVerification = () => {
    const nextStatus = newsletter.verificationStatus === 'VERIFIED' ? 'DRAFT' : 'VERIFIED';
    onUpdateNewsletter({
      ...newsletter,
      verificationStatus: nextStatus,
      verifiedAt: nextStatus === 'VERIFIED' ? new Date().toISOString() : undefined,
    });
  };

  // Case Law editing helpers
  const handleUpdateCase = (index: number, updatedFields: Partial<GSTCaseLaw>) => {
    const updated = [...newsletter.caseLaws];
    updated[index] = { ...updated[index], ...updatedFields };
    const autoSummary = generateExecutiveTaxEditorial(
      updated,
      newsletter.regulatoryUpdates,
      newsletter.editionMonth
    );
    onUpdateNewsletter({
      ...newsletter,
      caseLaws: updated,
      editorialNote: autoSummary,
    });
  };

  const handleAddCase = () => {
    const newCase: GSTCaseLaw = {
      id: `case-custom-${Date.now()}`,
      title: 'New High Court Landmark Precedent on Section 73/74 Proceedings',
      citation: '2026-VIL-999-HC',
      court: 'High Court',
      stateOrBench: 'High Court',
      date: new Date().toLocaleDateString('en-GB'),
      tmiReference: 'Custom Precedent',
      keyIssue: 'Challenge against arbitrary assessment orders passed without adhering to Section 75(4) personal hearing requirements.',
      rulingSummary: 'The High Court quashed the demand order, holding that mechanical DRC-07 orders without an effective hearing violate statutory principles.',
      practitionerTakeaway: 'Ensures strict enforcement of natural justice; taxpayers can seek unconditional remand for lack of personal hearing.',
      category: 'Assessment & Notice (S.73/74)',
      selectedForNewsletter: true,
      sectionsInvolved: 'Section 73, Section 75(4)',
    };
    const updatedCases = [newCase, ...newsletter.caseLaws];
    const autoSummary = generateExecutiveTaxEditorial(
      updatedCases,
      newsletter.regulatoryUpdates,
      newsletter.editionMonth
    );
    onUpdateNewsletter({
      ...newsletter,
      caseLaws: updatedCases,
      editorialNote: autoSummary,
    });
  };

  const handleDeleteCase = (index: number) => {
    const updatedCases = newsletter.caseLaws.filter((_, i) => i !== index);
    const autoSummary = generateExecutiveTaxEditorial(
      updatedCases,
      newsletter.regulatoryUpdates,
      newsletter.editionMonth
    );
    onUpdateNewsletter({
      ...newsletter,
      caseLaws: updatedCases,
      editorialNote: autoSummary,
    });
  };

  // Regulatory update helpers
  const handleUpdateRegulatory = (index: number, updatedFields: Partial<GSTRegulatoryUpdate>) => {
    const updated = [...newsletter.regulatoryUpdates];
    updated[index] = { ...updated[index], ...updatedFields };
    const autoSummary = generateExecutiveTaxEditorial(
      newsletter.caseLaws,
      updated,
      newsletter.editionMonth
    );
    onUpdateNewsletter({
      ...newsletter,
      regulatoryUpdates: updated,
      editorialNote: autoSummary,
    });
  };

  const handleAddRegulatory = () => {
    const newReg: GSTRegulatoryUpdate = {
      id: `reg-custom-${Date.now()}`,
      type: 'Circular',
      number: 'Circular No. 257/03/2026-GST',
      date: new Date().toLocaleDateString('en-GB'),
      title: 'Clarification on Statutory Input Tax Credit Procedures & System Reconciliations',
      brief: 'Provides standard operating procedures for field formations and registered taxpayers regarding GSTR-2B ITC reconciliations and refund verifications.',
      impactOnTaxpayers: 'Eliminates arbitrary show-cause notices for genuine vendor mismatches; establishes documentary audit protection.',
      selectedForNewsletter: true,
      issuingAuthority: 'CBIC GST Policy Wing',
    };
    const updatedRegs = [newReg, ...newsletter.regulatoryUpdates];
    const autoSummary = generateExecutiveTaxEditorial(
      newsletter.caseLaws,
      updatedRegs,
      newsletter.editionMonth
    );
    onUpdateNewsletter({
      ...newsletter,
      regulatoryUpdates: updatedRegs,
      editorialNote: autoSummary,
    });
  };

  const handleDeleteRegulatory = (index: number) => {
    const updatedRegs = newsletter.regulatoryUpdates.filter((_, i) => i !== index);
    const autoSummary = generateExecutiveTaxEditorial(
      newsletter.caseLaws,
      updatedRegs,
      newsletter.editionMonth
    );
    onUpdateNewsletter({
      ...newsletter,
      regulatoryUpdates: updatedRegs,
      editorialNote: autoSummary,
    });
  };

  // Due Dates Calendar helpers
  const handleUpdateDueDate = (index: number, updatedFields: Partial<ComplianceDueDate>) => {
    const updated = [...newsletter.dueDates];
    updated[index] = { ...updated[index], ...updatedFields };
    onUpdateNewsletter({ ...newsletter, dueDates: updated });
  };

  const handleAddDueDate = () => {
    const newDue: ComplianceDueDate = {
      form: 'GSTR-3B',
      description: 'Monthly Summary Return',
      period: newsletter.editionMonth,
      dueDate: '20th of the Month',
      applicability: 'All regular registered taxpayers',
    };
    onUpdateNewsletter({
      ...newsletter,
      dueDates: [...newsletter.dueDates, newDue],
    });
  };

  const handleDeleteDueDate = (index: number) => {
    const updated = newsletter.dueDates.filter((_, i) => i !== index);
    onUpdateNewsletter({ ...newsletter, dueDates: updated });
  };

  // Client Action Points helpers
  const handleUpdateActionPoint = (index: number, value: string) => {
    const updated = [...newsletter.clientActionPoints];
    updated[index] = value;
    onUpdateNewsletter({ ...newsletter, clientActionPoints: updated });
  };

  const handleAddActionPoint = () => {
    onUpdateNewsletter({
      ...newsletter,
      clientActionPoints: [
        ...newsletter.clientActionPoints,
        'Review supplier return filing status on the GST portal before finalizing monthly liabilities.',
      ],
    });
  };

  const handleDeleteActionPoint = (index: number) => {
    const updated = newsletter.clientActionPoints.filter((_, i) => i !== index);
    onUpdateNewsletter({ ...newsletter, clientActionPoints: updated });
  };

  return (
    <div className="space-y-6">
      {/* Top Action Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Interactive 2-Page Executive Newsletter
            </span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded ${
                newsletter.verificationStatus === 'VERIFIED'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {newsletter.verificationStatus}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Edit all sections, review live layout, export Word (.docx) or PDF, and broadcast to clients.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {onGenerateTodayEdition && (
            <button
              onClick={onGenerateTodayEdition}
              disabled={isGeneratingEdition}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs flex items-center space-x-1.5 transition active:scale-95 disabled:opacity-70 cursor-pointer"
              title="Scrape live TaxTMI precedents and CBIC circulars to generate today's fresh daily newsletter"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingEdition ? 'animate-spin' : ''}`} />
              <span>{isGeneratingEdition ? 'Scraping TaxTMI...' : "Generate Today's Edition"}</span>
            </button>
          )}

          <button
            onClick={handleToggleVerification}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition ${
              newsletter.verificationStatus === 'VERIFIED'
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{newsletter.verificationStatus === 'VERIFIED' ? 'Mark as Draft' : 'Verify & Approve'}</span>
          </button>

          <button
            onClick={handleDownloadDocx}
            disabled={isGeneratingDocx}
            className="px-3 py-2 rounded-lg text-xs font-bold bg-blue-900 hover:bg-blue-950 text-white shadow-xs flex items-center space-x-1.5 transition active:scale-95 disabled:opacity-70"
            title="Download formatted 2-page Microsoft Word document"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isGeneratingDocx ? 'Exporting Word...' : 'Download Word (.docx)'}</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white shadow-xs flex items-center space-x-1.5 transition active:scale-95 disabled:opacity-70"
            title="Download verified 2-page PDF document"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isGeneratingPdf ? 'Rendering PDF...' : 'Download PDF'}</span>
          </button>

          <button
            onClick={handleSaveToDrive}
            disabled={isSavingToDrive}
            className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs flex items-center space-x-1.5 transition active:scale-95 disabled:opacity-70"
            title="Save both 2-page PDF and Docx to Google Drive"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>{isSavingToDrive ? 'Uploading to Drive...' : 'Save to Google Drive'}</span>
          </button>

          <button
            onClick={onOpenDispatchModal}
            className="px-3.5 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center space-x-1.5 transition active:scale-95"
            title="Configure mailing lists, schedule 10 AM reminder, and broadcast"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Dispatch & Reminders</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-red-500 hover:text-red-800 font-bold text-sm">
            ✕
          </button>
        </div>
      )}

      {driveSuccessNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{driveSuccessNotice}</span>
          </div>
          {newsletter.driveWebViewLink && (
            <a
              href={newsletter.driveWebViewLink}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-700 hover:text-emerald-900 underline font-semibold flex items-center space-x-1"
            >
              <span>Open in Drive</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* Comprehensive Section Editor Navigation Bar */}
      <div className="bg-slate-900 text-white rounded-xl p-3 shadow-md space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Edit3 className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-slate-100 uppercase tracking-wide">
              Edit Newsletter Portions:
            </span>
          </div>
          {activeEditSection !== 'none' && (
            <button
              onClick={() => setActiveEditSection('none')}
              className="text-xs text-slate-300 hover:text-white flex items-center gap-1 font-semibold self-start sm:self-auto bg-slate-800 px-2.5 py-1 rounded border border-slate-700"
            >
              <Check className="w-3 h-3 text-emerald-400" /> Done Editing
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs">
          <button
            onClick={() => setActiveEditSection(activeEditSection === 'header' ? 'none' : 'header')}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeEditSection === 'header'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span>Header & Masthead</span>
          </button>

          <button
            onClick={() => setActiveEditSection(activeEditSection === 'editorial' ? 'none' : 'editorial')}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeEditSection === 'editorial'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Editorial Desk</span>
          </button>

          <button
            onClick={() => {
              setActivePreviewPage(1);
              setActiveEditSection(activeEditSection === 'cases' ? 'none' : 'cases');
            }}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeEditSection === 'cases'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-indigo-400" />
            <span>Case Laws (Page 1)</span>
          </button>

          <button
            onClick={() => {
              setActivePreviewPage(2);
              setActiveEditSection(activeEditSection === 'regulatory' ? 'none' : 'regulatory');
            }}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeEditSection === 'regulatory'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Circulars & Updates (Page 2)</span>
          </button>

          <button
            onClick={() => {
              setActivePreviewPage(2);
              setActiveEditSection(activeEditSection === 'calendar' ? 'none' : 'calendar');
            }}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeEditSection === 'calendar'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-red-400" />
            <span>Due Dates Calendar (Page 2)</span>
          </button>

          <button
            onClick={() => {
              setActivePreviewPage(2);
              setActiveEditSection(activeEditSection === 'checklist' ? 'none' : 'checklist');
            }}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeEditSection === 'checklist'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5 text-teal-400" />
            <span>Action Checklist (Page 2)</span>
          </button>

          <button
            onClick={() => {
              setActivePreviewPage(2);
              setActiveEditSection(activeEditSection === 'disclaimer' ? 'none' : 'disclaimer');
            }}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeEditSection === 'disclaimer'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-amber-300" />
            <span>Disclaimer</span>
          </button>

          <button
            onClick={() => {
              setActivePreviewPage(2);
              setActiveEditSection(activeEditSection === 'profile' ? 'none' : 'profile');
            }}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeEditSection === 'profile'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Building className="w-3.5 h-3.5 text-purple-400" />
            <span>Firm Profile & Sign-off</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION EDITORS (DRAWERS) */}
      {/* ======================================================== */}

      {/* 1. Header & Edition Drawer */}
      {activeEditSection === 'header' && (
        <div className="bg-slate-50 border-2 border-blue-400/40 rounded-xl p-4 text-xs space-y-3 shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b pb-2">
            <h4 className="font-bold text-slate-900 flex items-center text-sm">
              <FileText className="w-4 h-4 text-blue-900 mr-2" /> Newsletter Heading & Publication Details
            </h4>
            <button
              onClick={() => setActiveEditSection('none')}
              className="text-slate-500 hover:text-slate-800 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Newsletter Main Heading:</label>
              <input
                type="text"
                value={newsletter.title}
                onChange={(e) => onUpdateNewsletter({ ...newsletter, title: e.target.value })}
                placeholder="e.g. GST NEWSLETTER"
                className="w-full border rounded px-2.5 py-1.5 bg-white font-bold text-blue-950 uppercase"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Edition Month:</label>
              <input
                type="text"
                value={newsletter.editionMonth}
                onChange={(e) => onUpdateNewsletter({ ...newsletter, editionMonth: e.target.value })}
                placeholder="e.g. October 2026"
                className="w-full border rounded px-2.5 py-1.5 bg-white font-medium"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Publication Date:</label>
              <input
                type="text"
                value={newsletter.generatedDate}
                onChange={(e) => onUpdateNewsletter({ ...newsletter, generatedDate: e.target.value })}
                placeholder="e.g. 28 September 2026"
                className="w-full border rounded px-2.5 py-1.5 bg-white font-medium"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700">Volume & Issue No:</label>
                <button
                  type="button"
                  onClick={() => {
                    resetDailyIssueTracker(1, 1);
                    const freshVol = getDailySerialVolumeAndIssue();
                    onUpdateNewsletter({ ...newsletter, volumeNo: freshVol });
                  }}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold underline flex items-center gap-0.5"
                  title="Restart counter from Vol. I / Issue 01"
                >
                  <RefreshCw className="w-2.5 h-2.5" /> Start Scratch
                </button>
              </div>
              <input
                type="text"
                value={newsletter.volumeNo}
                onChange={(e) => onUpdateNewsletter({ ...newsletter, volumeNo: e.target.value })}
                placeholder="e.g. Vol. I / Issue 01"
                className="w-full border rounded px-2.5 py-1.5 bg-white font-medium text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Masthead Subtitle / Tagline:</label>
              <input
                type="text"
                value={newsletter.subtitle || ''}
                onChange={(e) => onUpdateNewsletter({ ...newsletter, subtitle: e.target.value })}
                placeholder="e.g. Landmark Precedents • Statutory Notifications & Circulars • Compliance Due Dates"
                className="w-full border rounded px-2.5 py-1.5 bg-white text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Banner Badge / Pill Text:</label>
              <input
                type="text"
                value={newsletter.badgeText || ''}
                onChange={(e) => onUpdateNewsletter({ ...newsletter, badgeText: e.target.value })}
                placeholder="e.g. Official Client Guidance"
                className="w-full border rounded px-2.5 py-1.5 bg-white text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Footer Bulletin Tagline:</label>
              <input
                type="text"
                value={newsletter.footerNote || ''}
                onChange={(e) => onUpdateNewsletter({ ...newsletter, footerNote: e.target.value })}
                placeholder="e.g. Monthly GST Intelligence & Jurisprudence Bulletin"
                className="w-full border rounded px-2.5 py-1.5 bg-white text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Confidentiality Pill / Watermark Label:</label>
              <input
                type="text"
                value={newsletter.confidentialBanner || ''}
                onChange={(e) => onUpdateNewsletter({ ...newsletter, confidentialBanner: e.target.value })}
                placeholder="e.g. CONFIDENTIAL INTERNAL CIRCULATION ONLY"
                className="w-full border rounded px-2.5 py-1.5 bg-white text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. Editorial Note Drawer */}
      {activeEditSection === 'editorial' && (
        <div className="bg-slate-50 border-2 border-amber-400/40 rounded-xl p-4 text-xs space-y-2.5 shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h4 className="font-bold text-slate-900 flex items-center text-sm">
                <Sparkles className="w-4 h-4 text-amber-600 mr-2" /> Executive Tax Editorial & Practitioner's Desk
              </h4>
              <button
                type="button"
                onClick={handleAutoSummarizeEditorial}
                disabled={isAutoSummarizingEditorial}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold text-xs px-2.5 py-1 rounded-md flex items-center gap-1 shadow-xs transition cursor-pointer"
              >
                {isAutoSummarizingEditorial ? (
                  <>
                    <Loader2 className="w-3 h-3 text-amber-300 animate-spin" />
                    <span>Auto-Summarizing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    <span>Auto-Summarize from Content</span>
                  </>
                )}
              </button>
            </div>
            <button
              onClick={() => setActiveEditSection('none')}
              className="text-slate-500 hover:text-slate-800 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Editorial Section Heading:</label>
            <input
              type="text"
              value={newsletter.editorialHeading || ''}
              onChange={(e) => onUpdateNewsletter({ ...newsletter, editorialHeading: e.target.value })}
              placeholder="e.g. Executive Tax Editorial & Practitioner's Desk"
              className="w-full border rounded px-2.5 py-1.5 bg-white font-bold text-blue-950 text-xs mb-2"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-semibold text-slate-700">Editorial Commentary & Perspective:</label>
              <button
                type="button"
                onClick={handleAutoSummarizeEditorial}
                disabled={isAutoSummarizingEditorial}
                className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-60 border border-indigo-200 px-2.5 py-1 rounded-md flex items-center gap-1 shadow-2xs transition cursor-pointer"
                title="Auto-summarize editorial commentary directly from current case laws & circulars"
              >
                {isAutoSummarizingEditorial ? (
                  <>
                    <Loader2 className="w-3 h-3 text-amber-500 animate-spin" />
                    <span>Auto-Summarizing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>Auto-Summarize Content</span>
                  </>
                )}
              </button>
            </div>
            {editorialAutoNotice && (
              <div className="mb-2 p-2 bg-emerald-50 border border-emerald-300 rounded text-[11px] font-medium text-emerald-800 flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{editorialAutoNotice}</span>
              </div>
            )}
            <textarea
              rows={5}
              value={newsletter.editorialNote}
              onChange={(e) => onUpdateNewsletter({ ...newsletter, editorialNote: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-3 bg-white text-xs leading-relaxed focus:ring-2 focus:ring-blue-500 font-sans text-slate-800"
              placeholder="Enter customized editorial summary and practitioner perspective..."
            />
          </div>
        </div>
      )}

      {/* 3. Landmark Case Laws Drawer */}
      {activeEditSection === 'cases' && (
        <div className="bg-slate-50 border-2 border-indigo-400/40 rounded-xl p-4 text-xs space-y-4 shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b pb-2">
            <div>
              <h4 className="font-bold text-slate-900 flex items-center text-sm">
                <Scale className="w-4 h-4 text-indigo-700 mr-2" /> Landmark Judicial Precedents & Case Laws (Page 1)
              </h4>
              <p className="text-[11px] text-slate-500">
                Edit rulings, core issues, court citations, and taxpayers' takeaways. You can reorder, add, or delete cases.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddCase}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Case Law
              </button>
              <button
                onClick={() => setActiveEditSection('none')}
                className="text-slate-500 hover:text-slate-800 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
            <label className="block font-semibold text-slate-700 mb-1">Case Laws Section Heading:</label>
            <input
              type="text"
              value={newsletter.casesHeading || ''}
              onChange={(e) => onUpdateNewsletter({ ...newsletter, casesHeading: e.target.value })}
              placeholder="e.g. Landmark Judicial Precedents & Case Laws"
              className="w-full border rounded px-2.5 py-1.5 bg-white font-bold text-blue-950 text-xs"
            />
          </div>

          <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
            {newsletter.caseLaws.map((cl, idx) => (
              <div key={cl.id || idx} className="p-3 bg-white rounded-xl border border-slate-300 space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b pb-1.5">
                  <span className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                    <span className="bg-indigo-100 text-indigo-800 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    Case Law #{idx + 1}
                  </span>
                  <button
                    onClick={() => handleDeleteCase(idx)}
                    className="text-red-500 hover:text-red-700 flex items-center gap-1 text-[11px] font-semibold"
                    title="Delete this case law"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-0.5">Ruling Title:</label>
                    <input
                      type="text"
                      value={cl.title}
                      onChange={(e) => handleUpdateCase(idx, { title: e.target.value })}
                      className="w-full border rounded px-2.5 py-1 bg-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-0.5">Citation:</label>
                    <input
                      type="text"
                      value={cl.citation}
                      onChange={(e) => handleUpdateCase(idx, { citation: e.target.value })}
                      className="w-full border rounded px-2.5 py-1 bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-0.5">Court / Forum:</label>
                    <select
                      value={cl.court}
                      onChange={(e) => handleUpdateCase(idx, { court: e.target.value as any })}
                      className="w-full border rounded px-2.5 py-1 bg-white"
                    >
                      <option value="Supreme Court">Supreme Court</option>
                      <option value="High Court">High Court</option>
                      <option value="GSTAT / Tribunal">GSTAT / Tribunal</option>
                      <option value="AAR / AAAR">AAR / AAAR</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-0.5">State / Bench:</label>
                    <input
                      type="text"
                      value={cl.stateOrBench}
                      onChange={(e) => handleUpdateCase(idx, { stateOrBench: e.target.value })}
                      className="w-full border rounded px-2.5 py-1 bg-white"
                      placeholder="e.g. Delhi, Karnataka"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-0.5">Sections Involved:</label>
                    <input
                      type="text"
                      value={cl.sectionsInvolved || ''}
                      onChange={(e) => handleUpdateCase(idx, { sectionsInvolved: e.target.value })}
                      className="w-full border rounded px-2.5 py-1 bg-white"
                      placeholder="e.g. Section 167, Section 75(4)"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">Core Legal Issue:</label>
                  <textarea
                    rows={2}
                    value={cl.keyIssue}
                    onChange={(e) => handleUpdateCase(idx, { keyIssue: e.target.value })}
                    className="w-full border rounded p-2 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">Judicial Holding / Ruling Summary:</label>
                  <textarea
                    rows={2}
                    value={cl.rulingSummary}
                    onChange={(e) => handleUpdateCase(idx, { rulingSummary: e.target.value })}
                    className="w-full border rounded p-2 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-emerald-800 mb-0.5">Taxpayers' Impact / Practitioner Takeaway:</label>
                  <textarea
                    rows={2}
                    value={cl.practitionerTakeaway}
                    onChange={(e) => handleUpdateCase(idx, { practitionerTakeaway: e.target.value })}
                    className="w-full border border-emerald-300 rounded p-2 bg-emerald-50/50 text-emerald-950"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Circulars & Regulatory Updates Drawer */}
      {activeEditSection === 'regulatory' && (
        <div className="bg-slate-50 border-2 border-emerald-400/40 rounded-xl p-4 text-xs space-y-4 shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b pb-2">
            <div>
              <h4 className="font-bold text-slate-900 flex items-center text-sm">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700 mr-2" /> CBIC Circulars, Notifications & Advisories (Page 2)
              </h4>
              <p className="text-[11px] text-slate-500">
                Modify official circular numbers, statutory briefs, dates, and compliance impact on clients.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddRegulatory}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Circular
              </button>
              <button
                onClick={() => setActiveEditSection('none')}
                className="text-slate-500 hover:text-slate-800 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
            <label className="block font-semibold text-slate-700 mb-1">Circulars & Regulatory Section Heading:</label>
            <input
              type="text"
              value={newsletter.regulatoryHeading || ''}
              onChange={(e) => onUpdateNewsletter({ ...newsletter, regulatoryHeading: e.target.value })}
              placeholder="e.g. Key CBIC Notifications, Circulars & Advisories"
              className="w-full border rounded px-2.5 py-1.5 bg-white font-bold text-blue-950 text-xs"
            />
          </div>

          <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
            {newsletter.regulatoryUpdates.map((ru, idx) => (
              <div key={ru.id || idx} className="p-3 bg-white rounded-xl border border-slate-300 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between border-b pb-1.5">
                  <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                    <span className="bg-emerald-100 text-emerald-800 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    Update #{idx + 1}
                  </span>
                  <button
                    onClick={() => handleDeleteRegulatory(idx)}
                    className="text-red-500 hover:text-red-700 flex items-center gap-1 text-[11px] font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-0.5">Type:</label>
                    <select
                      value={ru.type}
                      onChange={(e) => handleUpdateRegulatory(idx, { type: e.target.value as any })}
                      className="w-full border rounded px-2.5 py-1 bg-white font-medium"
                    >
                      <option value="Circular">Circular</option>
                      <option value="Notification">Notification</option>
                      <option value="Instruction">Instruction</option>
                      <option value="Advisory">Advisory</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-0.5">Number / Reference:</label>
                    <input
                      type="text"
                      value={ru.number}
                      onChange={(e) => handleUpdateRegulatory(idx, { number: e.target.value })}
                      className="w-full border rounded px-2.5 py-1 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-0.5">Date:</label>
                    <input
                      type="text"
                      value={ru.date}
                      onChange={(e) => handleUpdateRegulatory(idx, { date: e.target.value })}
                      className="w-full border rounded px-2.5 py-1 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-0.5">Issuing Authority:</label>
                    <input
                      type="text"
                      value={ru.issuingAuthority || ''}
                      onChange={(e) => handleUpdateRegulatory(idx, { issuingAuthority: e.target.value })}
                      className="w-full border rounded px-2.5 py-1 bg-white"
                      placeholder="e.g. CBIC GST Policy Wing"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">Subject / Title:</label>
                  <input
                    type="text"
                    value={ru.title}
                    onChange={(e) => handleUpdateRegulatory(idx, { title: e.target.value })}
                    className="w-full border rounded px-2.5 py-1 bg-white font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">Statutory Brief:</label>
                  <textarea
                    rows={2}
                    value={ru.brief}
                    onChange={(e) => handleUpdateRegulatory(idx, { brief: e.target.value })}
                    className="w-full border rounded p-2 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-amber-900 mb-0.5">Taxpayers' Impact / Compliance Action:</label>
                  <textarea
                    rows={2}
                    value={ru.impactOnTaxpayers || ru.impactOnClients || ''}
                    onChange={(e) => handleUpdateRegulatory(idx, { impactOnTaxpayers: e.target.value })}
                    className="w-full border border-amber-300 rounded p-2 bg-amber-50/50 text-amber-950"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Statutory Compliance Due Dates Calendar Drawer */}
      {activeEditSection === 'calendar' && (
        <div className="bg-slate-50 border-2 border-red-400/40 rounded-xl p-4 text-xs space-y-4 shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b pb-2">
            <div>
              <h4 className="font-bold text-slate-900 flex items-center text-sm">
                <Calendar className="w-4 h-4 text-red-700 mr-2" /> Statutory Compliance Calendar Deadlines (Page 2)
              </h4>
              <p className="text-[11px] text-slate-500">
                Configure GST filing deadlines, return types, applicability scopes, and periods.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddDueDate}
                className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Deadline
              </button>
              <button
                onClick={() => setActiveEditSection('none')}
                className="text-slate-500 hover:text-slate-800 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
            <label className="block font-semibold text-slate-700 mb-1">Calendar Section Heading:</label>
            <input
              type="text"
              value={newsletter.calendarHeading || ''}
              onChange={(e) => onUpdateNewsletter({ ...newsletter, calendarHeading: e.target.value })}
              placeholder="e.g. Statutory Compliance Calendar"
              className="w-full border rounded px-2.5 py-1.5 bg-white font-bold text-blue-950 text-xs"
            />
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {newsletter.dueDates.map((dd, idx) => (
              <div key={idx} className="p-3 bg-white rounded-lg border border-slate-300 grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">Form / Return:</label>
                  <input
                    type="text"
                    value={dd.form}
                    onChange={(e) => handleUpdateDueDate(idx, { form: e.target.value })}
                    className="w-full border rounded px-2.5 py-1 bg-white font-bold text-slate-900"
                    placeholder="e.g. GSTR-1"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">Tax Period:</label>
                  <input
                    type="text"
                    value={dd.period}
                    onChange={(e) => handleUpdateDueDate(idx, { period: e.target.value })}
                    className="w-full border rounded px-2.5 py-1 bg-white"
                    placeholder="e.g. September 2026"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">Statutory Due Date:</label>
                  <input
                    type="text"
                    value={dd.dueDate}
                    onChange={(e) => handleUpdateDueDate(idx, { dueDate: e.target.value })}
                    className="w-full border rounded px-2.5 py-1 bg-white font-bold text-red-600"
                    placeholder="e.g. 11th October 2026"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block font-semibold text-slate-700 mb-0.5">Applicability:</label>
                    <input
                      type="text"
                      value={dd.applicability}
                      onChange={(e) => handleUpdateDueDate(idx, { applicability: e.target.value })}
                      className="w-full border rounded px-2.5 py-1 bg-white"
                      placeholder="e.g. Monthly filers"
                    />
                  </div>
                  <button
                    onClick={() => handleDeleteDueDate(idx)}
                    className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 mb-0.5"
                    title="Remove deadline"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Client Action Checklist Drawer */}
      {activeEditSection === 'checklist' && (
        <div className="bg-slate-50 border-2 border-teal-400/40 rounded-xl p-4 text-xs space-y-3 shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b pb-2">
            <div>
              <h4 className="font-bold text-slate-900 flex items-center text-sm">
                <ListChecks className="w-4 h-4 text-teal-700 mr-2" /> Practitioner's Action Checklist for Taxpayers (Page 2)
              </h4>
              <p className="text-[11px] text-slate-500">
                Action points and advisory recommendations for corporate clients and taxpayers.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddActionPoint}
                className="bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Action Point
              </button>
              <button
                onClick={() => setActiveEditSection('none')}
                className="text-slate-500 hover:text-slate-800 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
            <label className="block font-semibold text-slate-700 mb-1">Checklist Section Heading:</label>
            <input
              type="text"
              value={newsletter.checklistHeading || ''}
              onChange={(e) => onUpdateNewsletter({ ...newsletter, checklistHeading: e.target.value })}
              placeholder="e.g. Practitioner's Action Checklist for Taxpayers"
              className="w-full border rounded px-2.5 py-1.5 bg-white font-bold text-blue-950 text-xs"
            />
          </div>

          <div className="space-y-2">
            {newsletter.clientActionPoints.map((ap, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-300">
                <span className="font-bold text-teal-800 text-xs w-5 text-center">#{idx + 1}</span>
                <input
                  type="text"
                  value={ap}
                  onChange={(e) => handleUpdateActionPoint(idx, e.target.value)}
                  className="flex-1 border rounded px-2.5 py-1 bg-white text-slate-800"
                />
                <button
                  onClick={() => handleDeleteActionPoint(idx)}
                  className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                  title="Remove point"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Statutory Disclaimer Drawer */}
      {activeEditSection === 'disclaimer' && (
        <div className="bg-slate-50 border-2 border-amber-400/40 rounded-xl p-4 text-xs space-y-3 shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b pb-2">
            <div>
              <h4 className="font-bold text-slate-900 flex items-center text-sm">
                <Shield className="w-4 h-4 text-amber-600 mr-2" /> Statutory Confidentiality & Legal Disclaimer
              </h4>
              <p className="text-[11px] text-slate-500">
                Printed on Page 2 for statutory regulatory compliance and client guidance limitations.
              </p>
            </div>
            <button
              onClick={() => setActiveEditSection('none')}
              className="text-slate-500 hover:text-slate-800 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Disclaimer Section Heading:</label>
            <input
              type="text"
              value={newsletter.disclaimerHeading || ''}
              onChange={(e) => onUpdateNewsletter({ ...newsletter, disclaimerHeading: e.target.value })}
              placeholder="e.g. Statutory Confidentiality & Legal Disclaimer"
              className="w-full border rounded px-2.5 py-1.5 bg-white font-bold text-blue-950 text-xs mb-2"
            />
          </div>
          <textarea
            rows={4}
            value={newsletter.disclaimerText}
            onChange={(e) => onUpdateNewsletter({ ...newsletter, disclaimerText: e.target.value })}
            className="w-full border border-slate-300 rounded-lg p-3 bg-white text-xs leading-relaxed focus:ring-2 focus:ring-blue-500 font-sans text-slate-800"
          />
        </div>
      )}

      {/* 8. Profile & Firm Details Drawer */}
      {activeEditSection === 'profile' && (
        <div className="bg-slate-50 border-2 border-purple-400/40 rounded-xl p-4 text-xs space-y-3 shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b pb-2">
            <div>
              <h4 className="font-bold text-slate-900 flex items-center text-sm">
                <Building className="w-4 h-4 text-purple-700 mr-2" /> Practitioner & Advisory Firm Circulation Details (Page 2 Sign-off)
              </h4>
              <p className="text-[11px] text-slate-500">
                Sign-off credentials, bar registration, Head Office address, and multi-city touchpoints.
              </p>
            </div>
            <button
              onClick={() => setActiveEditSection('none')}
              className="text-slate-500 hover:text-slate-800 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Firm / Practice Name:</label>
              <input
                type="text"
                value={profile.firmName}
                onChange={(e) => onUpdateProfile({ ...profile, firmName: e.target.value })}
                className="w-full border rounded px-2.5 py-1.5 bg-white font-medium"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Practitioner Name:</label>
              <input
                type="text"
                value={profile.practitionerName}
                onChange={(e) => onUpdateProfile({ ...profile, practitionerName: e.target.value })}
                className="w-full border rounded px-2.5 py-1.5 bg-white font-medium"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Enrollment / Bar No / Heritage:</label>
              <input
                type="text"
                value={profile.enrollmentNo}
                onChange={(e) => onUpdateProfile({ ...profile, enrollmentNo: e.target.value })}
                className="w-full border rounded px-2.5 py-1.5 bg-white font-mono text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Designation:</label>
              <input
                type="text"
                value={profile.designation}
                onChange={(e) => onUpdateProfile({ ...profile, designation: e.target.value })}
                className="w-full border rounded px-2.5 py-1.5 bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email:</label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => onUpdateProfile({ ...profile, email: e.target.value })}
                className="w-full border rounded px-2.5 py-1.5 bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone:</label>
              <input
                type="text"
                value={profile.phone}
                onChange={(e) => onUpdateProfile({ ...profile, phone: e.target.value })}
                className="w-full border rounded px-2.5 py-1.5 bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Head Office Address:</label>
            <input
              type="text"
              value={profile.officeAddress}
              onChange={(e) => onUpdateProfile({ ...profile, officeAddress: e.target.value })}
              className="w-full border rounded px-2.5 py-1.5 bg-white"
            />
          </div>
        </div>
      )}

      {/* Page Selector Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActivePreviewPage(1)}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
              activePreviewPage === 1
                ? 'bg-blue-900 text-white shadow'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            Page 1: Masthead & Case Laws
          </button>
          <button
            onClick={() => setActivePreviewPage(2)}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
              activePreviewPage === 2
                ? 'bg-blue-900 text-white shadow'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            Page 2: Circulars, Calendar & Advisory
          </button>
        </div>
      </div>

      {/* Interactive 2-Page WYSIWYG Document Canvas */}
      <div className="bg-slate-300/80 p-4 sm:p-8 rounded-2xl flex justify-center overflow-x-auto shadow-inner">
        <div className="w-[794px] min-h-[1123px] bg-white shadow-2xl rounded-sm p-10 border border-slate-300 text-slate-900 flex flex-col justify-between font-serif relative">
          
          {/* Watermark for Verification Status */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden opacity-5">
            <span className="text-8xl font-black rotate-[-35deg] tracking-widest text-slate-900">
              {newsletter.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'DRAFT'}
            </span>
          </div>

          {/* PAGE 1 CONTENT */}
          {activePreviewPage === 1 && (
            <div className="space-y-5">
              {/* Masthead */}
              <div className="border-b-2 border-blue-950 pb-3 pt-1 font-sans relative group">
                <button
                  onClick={() => setActiveEditSection('header')}
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-900 hover:bg-blue-800 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" /> Edit Masthead
                </button>

                {/* Newsletter Main Heading */}
                <div className="text-center py-2">
                  <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-blue-950 uppercase font-sans">
                    {newsletter.title}
                  </h1>
                  <p className="text-[11px] tracking-wide text-slate-600 font-semibold mt-1">
                    {newsletter.subtitle || 'Landmark Precedents • Statutory Notifications & Circulars • Compliance Due Dates'}
                  </p>
                </div>

                {/* Newsletter Edition / Volume Bar */}
                <div className="mt-2.5 bg-blue-950 text-white px-4 py-2 rounded flex flex-wrap items-center justify-between text-xs font-semibold">
                  <div className="flex items-center space-x-3">
                    <span className="bg-blue-800 px-2.5 py-0.5 rounded text-[11px] uppercase tracking-wide font-bold">
                      {newsletter.generatedDate.toUpperCase()}
                    </span>
                    <span className="text-blue-200 text-[11px]">{newsletter.volumeNo}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-[11px]">
                    <span className="text-blue-200 font-medium">
                      {newsletter.badgeText || 'Official Client Guidance'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Executive Tax Editorial / Practitioner's Desk */}
              <div className="relative group">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 font-sans">
                    {newsletter.editorialHeading || "Executive Tax Editorial & Practitioner's Desk"}
                  </h3>
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={handleAutoSummarizeEditorial}
                      disabled={isAutoSummarizingEditorial}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-1 cursor-pointer"
                      title="Auto-summarize editorial commentary directly from current cases & circulars"
                    >
                      {isAutoSummarizingEditorial ? (
                        <>
                          <Loader2 className="w-2.5 h-2.5 text-amber-300 animate-spin" />
                          <span>Summarizing...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                          <span>Auto-Summarize</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setActiveEditSection('editorial')}
                      className="bg-blue-900 hover:bg-blue-800 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" /> Edit Editorial
                    </button>
                  </div>
                </div>
                <p className="text-[12px] leading-relaxed text-slate-800 italic bg-slate-50 p-3 rounded border border-slate-200">
                  "{newsletter.editorialNote}"
                </p>
              </div>

              {/* Landmark Judicial Precedents */}
              <div className="relative group">
                <div className="flex items-center justify-between border-b border-blue-900 pb-1 mb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 font-sans">
                    {newsletter.casesHeading || 'Landmark Judicial Precedents & Case Laws'}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveEditSection('cases')}
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-900 hover:bg-blue-800 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" /> Edit Case Laws
                    </button>
                    <span className="text-[10px] font-sans text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-semibold">
                      {newsletter.caseLaws.length} Active Rulings
                    </span>
                  </div>
                </div>

                <div className="space-y-3 font-sans">
                  {newsletter.caseLaws.slice(0, 3).map((cl, idx) => (
                    <div
                      key={cl.id || idx}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 relative group/item"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                        <span className="text-[11px] font-bold text-slate-900">
                          {idx + 1}. {cl.title}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {cl.sectionsInvolved && (
                            <span className="text-[9.5px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              {cl.sectionsInvolved}
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100/60 px-1.5 py-0.5 rounded">
                            {cl.citation}
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 mb-1">
                        Ref: {cl.tmiReference} | Forum: {cl.court} ({cl.stateOrBench})
                      </p>
                      <p className="text-[11px] text-slate-700 leading-snug mb-1">
                        <strong className="text-slate-900">Core Issue: </strong>
                        {cl.keyIssue}
                      </p>
                      <p className="text-[11px] text-slate-800 leading-snug mb-1.5">
                        <strong className="text-blue-900">Ruling: </strong>
                        {cl.rulingSummary}
                      </p>
                      <div className="text-[10.5px] text-emerald-900 bg-emerald-50/90 p-1.5 rounded border border-emerald-200">
                        <strong>Taxpayers' Impact: </strong>
                        {cl.practitionerTakeaway}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Page 1 Footer */}
              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] font-sans text-slate-500">
                <span className="font-semibold text-slate-600 uppercase tracking-wide">
                  {newsletter.footerNote || 'Monthly GST Intelligence & Jurisprudence Bulletin'}
                </span>
                <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold text-[9px] self-center">
                  {(newsletter.confidentialBanner || 'CONFIDENTIAL INTERNAL CIRCULATION ONLY').toUpperCase()}
                </span>
                <span>Page 1 of 2 • {newsletter.title}</span>
              </div>
            </div>
          )}

          {/* PAGE 2 CONTENT */}
          {activePreviewPage === 2 && (
            <div className="space-y-5">
              {/* Header Mini */}
              <div className="flex items-center justify-between border-b border-blue-900 pb-2 text-[11px] font-sans">
                <span className="font-bold text-blue-900">
                  {newsletter.title} - {(newsletter.regulatoryHeading || 'STATUTORY COMPLIANCE & ADVISORY').toUpperCase()}
                </span>
                <span className="text-slate-500 font-semibold">{newsletter.editionMonth}</span>
              </div>

              {/* CBIC Notifications & Circulars */}
              <div className="relative group">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 font-sans">
                    {newsletter.regulatoryHeading || 'Key CBIC Notifications, Circulars & Advisories'}
                  </h3>
                  <button
                    onClick={() => setActiveEditSection('regulatory')}
                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-900 hover:bg-blue-800 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" /> Edit Circulars
                  </button>
                </div>
                <div className="space-y-2.5 font-sans">
                  {newsletter.regulatoryUpdates.slice(0, 3).map((ru, idx) => (
                    <div
                      key={ru.id || idx}
                      className="p-2.5 rounded border border-slate-200 bg-slate-50/60"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1 mb-0.5">
                        <span className="text-[11px] font-bold text-blue-900">
                          {idx + 1}. [{ru.type}] {ru.number}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {ru.issuingAuthority && (
                            <span className="text-[9.5px] text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                              {ru.issuingAuthority}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 font-medium">Dated: {ru.date}</span>
                        </div>
                      </div>
                      <h4 className="text-[11px] font-bold text-slate-900 mb-1">{ru.title}</h4>
                      <p className="text-[10.5px] text-slate-700 leading-snug mb-1">{ru.brief}</p>
                      <p className="text-[10.5px] text-amber-900 bg-amber-50 p-1 rounded font-medium">
                        <strong>Taxpayers' Impact: </strong> {ru.impactOnTaxpayers || ru.impactOnClients}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Statutory Compliance Calendar Table */}
              <div className="relative group">
                <div className="flex items-center justify-between border-b border-blue-900 pb-1 mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 font-sans">
                    {(newsletter.calendarHeading || 'Statutory Compliance Calendar')} - {newsletter.editionMonth.toUpperCase()}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveEditSection('calendar')}
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-900 hover:bg-blue-800 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" /> Edit Calendar
                    </button>
                    <span className="text-[10px] text-red-600 font-bold font-sans">
                      Strict Filing Deadlines
                    </span>
                  </div>
                </div>

                <div className="border border-slate-300 rounded overflow-hidden font-sans">
                  <table className="w-full text-left border-collapse text-[10.5px]">
                    <thead className="bg-blue-950 text-white font-bold">
                      <tr>
                        <th className="p-1.5 border-r border-blue-900">Form / Return</th>
                        <th className="p-1.5 border-r border-blue-900">Statutory Due Date</th>
                        <th className="p-1.5">Class of Taxpayers & Applicability</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {newsletter.dueDates.slice(0, 6).map((dd, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                          <td className="p-1.5 font-bold text-slate-900 border-r border-slate-200">
                            {dd.form} <span className="text-[9px] text-slate-500 font-normal">({dd.period})</span>
                          </td>
                          <td className="p-1.5 font-bold text-red-600 border-r border-slate-200">
                            {dd.dueDate}
                          </td>
                          <td className="p-1.5 text-slate-600">{dd.applicability}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Practitioner's Action Checklist */}
              <div className="relative group">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 font-sans">
                    {newsletter.checklistHeading || "Practitioner's Action Checklist for Taxpayers"}
                  </h3>
                  <button
                    onClick={() => setActiveEditSection('checklist')}
                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-900 hover:bg-blue-800 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" /> Edit Checklist
                  </button>
                </div>
                <ul className="space-y-1 font-sans text-[11px] text-slate-800 list-disc pl-4">
                  {newsletter.clientActionPoints.slice(0, 4).map((ap, i) => (
                    <li key={i} className="leading-snug">
                      {ap}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Statutory Disclaimer */}
              <div className="relative group p-2.5 bg-slate-100 rounded border border-slate-200 text-[9.5px] font-sans text-slate-500 leading-snug italic">
                <div className="flex items-center justify-between mb-1 not-italic font-bold text-slate-700 uppercase tracking-wide">
                  <span>{newsletter.disclaimerHeading || 'Statutory Confidentiality & Legal Disclaimer'}</span>
                  <button
                    onClick={() => setActiveEditSection('disclaimer')}
                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-900 hover:bg-blue-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1"
                  >
                    <Edit3 className="w-2.5 h-2.5" /> Edit Disclaimer
                  </button>
                </div>
                {newsletter.disclaimerText}
              </div>

              {/* Comprehensive Firm Details of GARV & Associates */}
              <div className="relative group text-center pt-3 pb-2 font-sans border-t border-slate-200 bg-slate-50/80 p-3 rounded-lg flex flex-col items-center">
                <button
                  onClick={() => setActiveEditSection('profile')}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-900 hover:bg-blue-800 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" /> Edit Sign-off & Contacts
                </button>
                <div className="mb-2">
                  <GarvLogo className="h-10 sm:h-11 shadow-xs" />
                </div>
                <p className="text-[11px] font-bold text-blue-950">
                  Published for Confidential Internal Circulation by: {profile.firmName} | {profile.designation} ({profile.enrollmentNo})
                </p>
                <p className="text-[10px] font-semibold text-slate-700 mt-0.5">
                  Head Office: {profile.officeAddress}
                </p>
                <p className="text-[9.5px] text-slate-500 mt-0.5">
                  Firm Touchpoints: Kolkata (HQ) • Delhi • Mumbai • Bengaluru • Chennai • Guwahati (Assam)
                </p>
                <p className="text-[9.5px] text-slate-500 mt-0.5">
                  Contact: {profile.email} | Tel: {profile.phone} | Portal: {profile.websiteOrPortal || 'www.garvca.com'}
                </p>
              </div>

              {/* Page 2 Footer */}
              <div className="pt-2.5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] font-sans text-slate-500">
                <span className="font-semibold text-slate-600 uppercase tracking-wide">
                  {newsletter.footerNote || 'Monthly GST Intelligence & Jurisprudence Bulletin'}
                </span>
                <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold text-[9px] self-center">
                  {(newsletter.confidentialBanner || 'CONFIDENTIAL INTERNAL CIRCULATION ONLY').toUpperCase()}
                </span>
                <span>Page 2 of 2 • End of Publication</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
