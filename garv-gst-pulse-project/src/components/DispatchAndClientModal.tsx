import React, { useState, useEffect } from 'react';
import {
  Send,
  Users,
  Bell,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Plus,
  Trash2,
  Upload,
  FileCheck,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  MailCheck,
  History,
  RotateCcw,
  LogIn,
} from 'lucide-react';
import {
  ClientRecipient,
  DispatchLog,
  NewsletterContent,
  PractitionerProfile,
} from '../types';
import { reminderAndMailService } from '../services/reminderAndMailService';
import { generatePdfBlob, getPdfFileName } from '../services/newsletterEngine';
import { googleSignIn, getPermanentConnectionDetails } from '../services/googleAuth';

interface DispatchAndClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  newsletter: NewsletterContent;
  profile: PractitionerProfile;
  accessToken: string | null;
  clients: ClientRecipient[];
  onUpdateClients: (clients: ClientRecipient[]) => void;
  onDispatchComplete: (log: DispatchLog) => void;
  onUpdateNewsletter?: (newsletter: NewsletterContent) => void;
}

export const DispatchAndClientModal: React.FC<DispatchAndClientModalProps> = ({
  isOpen,
  onClose,
  newsletter,
  profile,
  accessToken,
  clients,
  onUpdateClients,
  onDispatchComplete,
  onUpdateNewsletter,
}) => {
  const [activeTab, setActiveTab] = useState<'dispatch' | 'clients' | 'reminder' | 'history'>('dispatch');
  const [reminderConfig, setReminderConfig] = useState(reminderAndMailService.getReminderConfig());
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [reminderFeedback, setReminderFeedback] = useState<string | null>(null);

  // Permanent Unattended Connection state (Gmail App Password / SMTP)
  const [permanentEmail, setPermanentEmail] = useState(() => {
    try {
      return localStorage.getItem('gstpulse_permanent_smtp_email') || 'anshumadocuments@gmail.com';
    } catch {
      return 'anshumadocuments@gmail.com';
    }
  });
  const [permanentAppPassword, setPermanentAppPassword] = useState(() => {
    try {
      return localStorage.getItem('gstpulse_permanent_smtp_pass') || '';
    } catch {
      return '';
    }
  });
  const [isSavingPermanent, setIsSavingPermanent] = useState(false);
  const [permanentNotice, setPermanentNotice] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<any>(null);
  const [reminderViewUrl, setReminderViewUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem('gstpulse_last_view_url') || null;
    } catch {
      return null;
    }
  });

  const fetchServerStatus = async () => {
    try {
      const res = await fetch('/api/reminder/status');
      if (res.ok) {
        const data = await res.json();
        setServerStatus(data);
      }
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchServerStatus();
    }
  }, [isOpen, activeTab]);

  const handleSavePermanentCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permanentEmail) return;
    setIsSavingPermanent(true);
    setPermanentNotice(null);
    try {
      localStorage.setItem('gstpulse_permanent_smtp_email', permanentEmail.trim());
      if (permanentAppPassword) {
        localStorage.setItem('gstpulse_permanent_smtp_pass', permanentAppPassword.trim());
      }

      const res = await fetch('/api/reminder/configure-permanent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpEmail: permanentEmail.trim(),
          smtpAppPassword: permanentAppPassword.trim(),
          targetEmail: reminderConfig.targetEmail,
          reminderTime: reminderConfig.reminderTime,
        }),
      });
      if (res.ok) {
        setPermanentNotice('✅ Permanent connection saved! Unattended 10:00 AM dispatch is active on the server.');
        fetchServerStatus();
      }
    } catch (err: any) {
      setPermanentNotice('Failed to save permanent settings: ' + err.message);
    } finally {
      setIsSavingPermanent(false);
    }
  };

  // Client management state
  const [newClient, setNewClient] = useState<Partial<ClientRecipient>>({
    category: 'General',
    active: true,
  });
  const [bulkEmails, setBulkEmails] = useState('');
  const [showBulkInput, setShowBulkInput] = useState(false);

  // Dispatch state
  const [showConfirmSendDialog, setShowConfirmSendDialog] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState<{
    current: number;
    total: number;
    currentClient: string;
  } | null>(null);
  const [latestDispatchLog, setLatestDispatchLog] = useState<DispatchLog | null>(null);

  const [modalError, setModalError] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeClients = clients.filter((c) => c.active);
  const dispatchHistory = reminderAndMailService.getDispatchLogs();

  // Test send 10 AM Reminder
  const handleTestReminder = async () => {
    setIsSendingReminder(true);
    setReminderFeedback(null);
    setModalError(null);
    try {
      const res = await reminderAndMailService.sendPractitionerReminderEmail(
        reminderConfig.targetEmail,
        profile,
        newsletter
      );
      if (newsletter.driveWebViewLink && onUpdateNewsletter) {
        onUpdateNewsletter({ ...newsletter });
      }
      if (res.viewUrl) {
        setReminderViewUrl(res.viewUrl);
      }
      if (res.method === 'cloud_delivery_archive') {
        setReminderFeedback(`⚠️ Reminder compiled with latest TaxTMI data & archived to server (ID: ${res.messageId || 'OK'}). To deliver directly into your Gmail inbox (${reminderConfig.targetEmail}), please enter your 16-character Google App Password below.`);
      } else {
        const methodLabel = res.method === 'permanent_smtp'
          ? 'Permanent Gmail App Password (SMTP)'
          : 'Google OAuth Gmail API';
        setReminderFeedback(`✅ 10:00 AM Reminder successfully delivered directly to your Gmail inbox (${reminderConfig.targetEmail}) via ${methodLabel}! (Message ID: ${res.messageId || 'OK'})`);
      }
      fetchServerStatus();
    } catch (err: any) {
      const errStr = err?.message || String(err);
      if (errStr.includes('OAUTH_TOKEN_EXPIRED') || errStr.includes('401') || errStr.includes('not connected')) {
        // Automatically attempt to prompt googleSignIn
        try {
          const signResult = await googleSignIn();
          if (signResult?.accessToken) {
            const retryRes = await reminderAndMailService.sendPractitionerReminderEmail(
              reminderConfig.targetEmail,
              profile,
              newsletter
            );
            if (retryRes.viewUrl) setReminderViewUrl(retryRes.viewUrl);
            setReminderFeedback(`✅ Reconnected Google & successfully delivered 10:00 AM Reminder to ${reminderConfig.targetEmail}! (Message ID: ${retryRes.messageId || 'OK'})`);
            fetchServerStatus();
            return;
          }
        } catch (inner) {
          setReminderFeedback('Token expired. Please click "Connect Google Drive & Gmail" or set a Gmail App Password below.');
          return;
        }
      }
      setReminderFeedback('Reminder dispatch notice: ' + err.message);
    } finally {
      setIsSendingReminder(false);
    }
  };

  const handleDirectSignIn = async () => {
    try {
      setModalError(null);
      await googleSignIn();
    } catch (e: any) {
      setModalError(e?.message || 'Google sign-in could not be completed.');
    }
  };

  const handleResetTodayStatus = async () => {
    reminderAndMailService.setLastReminderSentDate('');
    try {
      await fetch('/api/reminder/reset', { method: 'POST' });
      await fetchServerStatus();
    } catch {}
    setReminderFeedback("Today's dispatch record has been reset on both client & server. The automated 10:00 AM scheduler is re-armed!");
  };

  // Add individual client
  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.email || !newClient.clientName) return;

    const created: ClientRecipient = {
      id: `cli-${Date.now()}`,
      clientName: newClient.clientName,
      tradeName: newClient.tradeName || newClient.clientName,
      email: newClient.email.trim(),
      gstin: newClient.gstin?.trim() || undefined,
      category: (newClient.category as any) || 'General',
      active: true,
    };

    const updated = [created, ...clients];
    reminderAndMailService.saveClients(updated);
    onUpdateClients(updated);
    setNewClient({ category: 'General', active: true, clientName: '', email: '', tradeName: '', gstin: '' });
  };

  // Bulk import email list
  const handleBulkImport = () => {
    const rawLines = bulkEmails.split(/[\n,;]+/);
    const newClientsList: ClientRecipient[] = [];

    rawLines.forEach((item) => {
      const email = item.trim();
      if (email && email.includes('@')) {
        // extract name from email or set default
        const namePart = email.split('@')[0].replace(/[._]/g, ' ');
        const capName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        newClientsList.push({
          id: `cli-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          clientName: `${capName} Enterprise`,
          tradeName: `${capName} Co.`,
          email: email,
          category: 'General',
          active: true,
        });
      }
    });

    if (newClientsList.length > 0) {
      const merged = [...clients, ...newClientsList];
      reminderAndMailService.saveClients(merged);
      onUpdateClients(merged);
      setBulkEmails('');
      setShowBulkInput(false);
    }
  };

  const handleToggleClient = (id: string) => {
    const updated = clients.map((c) => (c.id === id ? { ...c, active: !c.active } : c));
    reminderAndMailService.saveClients(updated);
    onUpdateClients(updated);
  };

  const handleDeleteClient = (id: string) => {
    const updated = clients.filter((c) => c.id !== id);
    reminderAndMailService.saveClients(updated);
    onUpdateClients(updated);
  };

  // Trigger Broadcast with PDF conversion
  const handleExecuteBroadcast = async () => {
    setModalError(null);
    if (!accessToken) {
      setModalError('Please connect your Google Account before sending emails.');
      return;
    }

    if (newsletter.verificationStatus !== 'VERIFIED') {
      setModalError('Please verify the newsletter in the editor before emailing clients.');
      return;
    }

    setShowConfirmSendDialog(false);
    setIsBroadcasting(true);
    setBroadcastProgress({ current: 0, total: activeClients.length, currentClient: 'Starting...' });

    try {
      // 1. Generate 2-page PDF Blob for client circulation
      const pdfBlob = generatePdfBlob(newsletter, profile);

      // 2. Broadcast via Gmail API with progress callback
      const log = await reminderAndMailService.broadcastNewsletterToClients(
        clients,
        newsletter,
        profile,
        pdfBlob,
        (current, total, clientName) => {
          setBroadcastProgress({ current, total, currentClient: clientName });
        }
      );

      setLatestDispatchLog(log);
      onDispatchComplete(log);
    } catch (err: any) {
      setModalError('Broadcast dispatch error: ' + err.message);
    } finally {
      setIsBroadcasting(false);
      setBroadcastProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Send className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">Client Email Dispatch & 10 AM Automation</h2>
              <p className="text-xs text-slate-400">
                PDF conversion, Gmail broadcasting, and 10 AM reminder scheduling
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-bold px-2 py-1 rounded"
          >
            ✕
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 text-xs font-bold">
          <button
            onClick={() => setActiveTab('dispatch')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 transition ${
              activeTab === 'dispatch'
                ? 'border-emerald-600 text-emerald-900 bg-white -mb-px'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Newsletter</span>
          </button>

          <button
            onClick={() => setActiveTab('clients')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 transition ${
              activeTab === 'clients'
                ? 'border-emerald-600 text-emerald-900 bg-white -mb-px'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Client Mailing List ({activeClients.length} active)</span>
          </button>

          <button
            onClick={() => setActiveTab('reminder')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 transition ${
              activeTab === 'reminder'
                ? 'border-emerald-600 text-emerald-900 bg-white -mb-px'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>10 AM Daily Reminder</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 transition ${
              activeTab === 'history'
                ? 'border-emerald-600 text-emerald-900 bg-white -mb-px'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Dispatch History ({dispatchHistory.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 text-slate-800">
          {modalError && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-rose-600">Notice:</span>
                <span>{modalError}</span>
              </div>
              <button
                onClick={() => setModalError(null)}
                className="text-rose-700 hover:text-rose-900 font-bold ml-2"
              >
                ✕
              </button>
            </div>
          )}
          
          {/* TAB 1: DISPATCH / SEND */}
          {activeTab === 'dispatch' && (
            <div className="space-y-6">
              {/* Verification Status Warning / Banner */}
              {newsletter.verificationStatus !== 'VERIFIED' ? (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start space-x-3">
                  <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm text-amber-950 mb-1">
                      Practitioner Verification Required Before Client Dispatch
                    </h4>
                    <p>
                      As a GST Practitioner, you must verify the case law ratio, CBIC circular notes, and compliance due dates before circulating to clients.
                    </p>
                    <p className="mt-2 font-semibold">
                      Current Status: <span className="underline">DRAFT (Unverified)</span>. Please close this modal, verify on the editor screen, or click verify if you have reviewed all items.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-start space-x-3">
                  <FileCheck className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm text-emerald-950 mb-1">
                      Newsletter Verified & Approved by Practitioner
                    </h4>
                    <p>
                      The 2-page newsletter has been vetted. It will be converted to a clean PDF and dispatched to <strong>{activeClients.length} active client emails</strong> via your connected Gmail account.
                    </p>
                  </div>
                </div>
              )}

              {/* Dispatch Summary Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs space-y-3">
                <h4 className="font-bold text-sm text-slate-900 border-b pb-2">
                  Broadcast Execution Summary
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-500 block">Newsletter Title:</span>
                    <span className="font-bold text-slate-800">{newsletter.title} ({newsletter.editionMonth})</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Recipient Pool:</span>
                    <span className="font-bold text-slate-800">{activeClients.length} Verified Clients</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Attachment:</span>
                    <span className="font-mono text-emerald-700 font-semibold">
                      {getPdfFileName(newsletter)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Google Drive Backup:</span>
                    <span className="text-blue-700 font-semibold">
                      {newsletter.driveWebViewLink ? '✓ Linked & Ready' : 'Saved in local storage'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Indicator */}
              {isBroadcasting && broadcastProgress && (
                <div className="p-4 bg-blue-50 border border-blue-300 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                    <span className="flex items-center">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin text-blue-600" />
                      Broadcasting via Gmail API... ({broadcastProgress.current} of {broadcastProgress.total})
                    </span>
                    <span>{Math.round((broadcastProgress.current / broadcastProgress.total) * 100)}%</span>
                  </div>
                  <div className="w-full bg-blue-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-2 transition-all duration-300"
                      style={{
                        width: `${(broadcastProgress.current / broadcastProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-blue-700">
                    Dispatching to: <strong>{broadcastProgress.currentClient}</strong>
                  </p>
                </div>
              )}

              {/* Success Result Box */}
              {latestDispatchLog && (
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-xs space-y-2">
                  <div className="flex items-center space-x-2 text-emerald-900 font-bold text-sm">
                    <MailCheck className="w-5 h-5 text-emerald-600" />
                    <span>Broadcast Completed Successfully!</span>
                  </div>
                  <p className="text-emerald-800">
                    Sent to <strong>{latestDispatchLog.successfulSends.length}</strong> client(s) with 2-page PDF attached.
                  </p>
                </div>
              )}

              {/* Big Action Send Button */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmSendDialog(true)}
                  disabled={isBroadcasting || newsletter.verificationStatus !== 'VERIFIED' || activeClients.length === 0}
                  className="w-full sm:w-auto flex-1 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-sm py-3.5 px-6 rounded-xl shadow-lg transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Click to Send Newsletter to {activeClients.length} Clients</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-5 py-3.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-300"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: CLIENT MAILING LIST */}
          {activeTab === 'clients' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Registered Client Directory</h4>
                  <p className="text-xs text-slate-500">
                    Manage client email IDs, GSTINs, and trade category.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowBulkInput(!showBulkInput)}
                    className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-100 flex items-center"
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" /> {showBulkInput ? 'Hide Bulk Import' : 'Paste Email List'}
                  </button>
                </div>
              </div>

              {/* Bulk Email Import Box */}
              {showBulkInput && (
                <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-2 text-xs">
                  <label className="block font-bold text-slate-800">
                    Paste Client Email IDs (separated by commas or new lines):
                  </label>
                  <textarea
                    rows={3}
                    placeholder="client1@company.com, client2@enterprise.in, accounts@retailer.com"
                    value={bulkEmails}
                    onChange={(e) => setBulkEmails(e.target.value)}
                    className="w-full border rounded-lg p-2.5 font-mono text-xs bg-white"
                  />
                  <button
                    onClick={handleBulkImport}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg"
                  >
                    Import Emails into Client List
                  </button>
                </div>
              )}

              {/* Add Single Client Form */}
              <form onSubmit={handleAddClient} className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company / Client Name:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Zenith Corp"
                    value={newClient.clientName || ''}
                    onChange={(e) => setNewClient({ ...newClient, clientName: e.target.value })}
                    className="w-full border rounded px-2.5 py-1.5 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Client Email:</label>
                  <input
                    type="email"
                    required
                    placeholder="accounts@zenith.com"
                    value={newClient.email || ''}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    className="w-full border rounded px-2.5 py-1.5 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GSTIN (Optional):</label>
                  <input
                    type="text"
                    placeholder="07AAAAA0000A1Z5"
                    value={newClient.gstin || ''}
                    onChange={(e) => setNewClient({ ...newClient, gstin: e.target.value })}
                    className="w-full border rounded px-2.5 py-1.5 bg-white font-mono"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Client
                  </button>
                </div>
              </form>

              {/* Client List Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 font-bold text-slate-700 border-b">
                    <tr>
                      <th className="p-2.5">Send</th>
                      <th className="p-2.5">Client Entity</th>
                      <th className="p-2.5">Email Address</th>
                      <th className="p-2.5">GSTIN</th>
                      <th className="p-2.5">Last Dispatched</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {clients.map((client) => (
                      <tr key={client.id} className="hover:bg-slate-50">
                        <td className="p-2.5">
                          <input
                            type="checkbox"
                            checked={client.active}
                            onChange={() => handleToggleClient(client.id)}
                            className="h-4 w-4 text-emerald-600 rounded border-slate-300 cursor-pointer"
                          />
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">
                          {client.clientName}
                          <span className="block font-normal text-[11px] text-slate-500">
                            {client.tradeName}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-slate-700">{client.email}</td>
                        <td className="p-2.5 font-mono text-slate-500">{client.gstin || '—'}</td>
                        <td className="p-2.5 text-slate-500 text-[11px]">
                          {client.lastSentAt ? new Date(client.lastSentAt).toLocaleDateString() : 'Pending'}
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            onClick={() => handleDeleteClient(client.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Remove Client"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: 10 AM DAILY REMINDER CONFIG */}
          {activeTab === 'reminder' && (
            <div className="space-y-5 max-w-2xl">
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-start space-x-3">
                <Clock className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-indigo-950 mb-1">
                      10:00 AM Automated Review Reminder Engine
                    </h4>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-600 text-white flex items-center gap-1 shadow-xs">
                      ● AUTOMATION ACTIVE
                    </span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">
                    Every morning at <strong>{reminderConfig.reminderTime || '10:00 AM'}</strong>, an automated reminder email is dispatched to <strong>{reminderConfig.targetEmail}</strong> alerting you that the daily GST newsletter has been synthesized with current indirect tax precedents, circulars, and compliance due dates, and archived in Google Drive for your review.
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] text-slate-600 font-medium">
                    <span>Target Inbox: <strong className="text-indigo-900">{reminderConfig.targetEmail}</strong></span>
                    <span>•</span>
                    <span>Server Time (IST): <strong className="text-slate-800">{serverStatus?.serverTimeIST || 'Active'}</strong></span>
                    <span>•</span>
                    <span>Status: <strong className="text-emerald-700">{serverStatus?.isSentToday ? `Dispatched for Today (${serverStatus.lastSentDate})` : 'Scheduled & Armed for 10:00 AM IST'}</strong></span>
                  </div>
                </div>
              </div>

              {/* SECTION: PERMANENT CONNECTION CHOICES */}
              <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-bold text-slate-900 text-sm">
                      Permanent Google Connection & Dispatch Channels
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    Ensures reminders arrive every day at 10 AM
                  </span>
                </div>

                {/* Option 1: Google OAuth Connection */}
                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-slate-800 text-xs">1. Google Workspace OAuth (Gmail & Drive API):</span>
                      <p className="text-[11px] text-slate-500">
                        Authorizes Google Drive archiving and direct Gmail API dispatch from your authenticated account.
                      </p>
                    </div>
                    {(accessToken || getPermanentConnectionDetails().isConnected) ? (
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded font-bold text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Drive: Permanently Connected
                        </span>
                        <button
                          onClick={handleDirectSignIn}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded border border-slate-300 transition cursor-pointer"
                        >
                          Refresh Token
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleDirectSignIn}
                        className="px-3 py-1.5 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-xs transition cursor-pointer"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Connect Google</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Option 2: Permanent Unattended Gmail Dispatch (Google App Password) */}
                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-slate-800 text-xs">
                          2. Permanent Unattended Dispatch (Google App Password):
                        </span>
                        {serverStatus?.hasPermanentSmtp ? (
                          <span className="text-emerald-700 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded font-bold text-[10px]">
                            ACTIVE (Runs 365 Days Unattended)
                          </span>
                        ) : (
                          <span className="text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded font-bold text-[10px]">
                            ⚠️ Action Required for Daily Inbox Delivery
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                        Google OAuth access tokens expire after 1 hour. A Google <strong>App Password</strong> gives the background server a permanent connection to dispatch your 10:00 AM reminders 365 days a year even if your browser is closed.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleSavePermanentCredentials} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                        Google Email Address:
                      </label>
                      <input
                        type="email"
                        value={permanentEmail}
                        onChange={(e) => setPermanentEmail(e.target.value)}
                        placeholder="e.g. anshumadocuments@gmail.com"
                        className="w-full border rounded px-2.5 py-1.5 bg-slate-50 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                        Google App Password (16 Letters):
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="password"
                          value={permanentAppPassword}
                          onChange={(e) => setPermanentAppPassword(e.target.value)}
                          placeholder="abcd efgh ijkl mnop"
                          className="w-full border rounded px-2.5 py-1.5 bg-slate-50 font-mono text-xs"
                        />
                        <button
                          type="submit"
                          disabled={isSavingPermanent}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded text-xs whitespace-nowrap shadow-xs transition"
                        >
                          {isSavingPermanent ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </form>
                  <p className="text-[10px] text-slate-500 italic">
                    Tip: Create a 16-character App Password at Google Account &gt; Security &gt; 2-Step Verification &gt; App Passwords.
                  </p>
                  {permanentNotice && (
                    <div className="p-2 bg-emerald-50 border border-emerald-300 rounded text-[11px] text-emerald-800 font-medium">
                      {permanentNotice}
                    </div>
                  )}
                </div>
              </div>

              {/* Target & Time Configuration */}
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Practitioner Reminder Time:
                    </label>
                    <input
                      type="time"
                      value={reminderConfig.reminderTime}
                      onChange={(e) => {
                        const updated = { ...reminderConfig, reminderTime: e.target.value };
                        setReminderConfig(updated);
                        reminderAndMailService.saveReminderConfig(updated);
                      }}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white font-mono text-xs"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">Default: 10:00 AM Indian Standard Time (IST)</span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Practitioner Notification Email:
                    </label>
                    <input
                      type="email"
                      value={reminderConfig.targetEmail}
                      onChange={(e) => {
                        const updated = { ...reminderConfig, targetEmail: e.target.value };
                        setReminderConfig(updated);
                        reminderAndMailService.saveReminderConfig(updated);
                      }}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white font-mono text-xs"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">Inbox where daily 10 AM review alerts land</span>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleTestReminder}
                    disabled={isSendingReminder}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow transition active:scale-95 flex items-center space-x-1.5"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>{isSendingReminder ? 'Dispatching to Inbox...' : 'Send 10 AM Reminder to Inbox Now'}</span>
                  </button>

                  <button
                    onClick={handleResetTodayStatus}
                    className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs px-3.5 py-2.5 rounded-lg shadow-xs transition flex items-center space-x-1.5"
                    title="Clear today's sent record so the automated scheduler will send again"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Today's Sent Status</span>
                  </button>
                </div>

                {reminderFeedback && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-900 space-y-2">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span className="font-semibold">{reminderFeedback}</span>
                    </div>
                    {reminderViewUrl && (
                      <div className="pt-1">
                        <a
                          href={reminderViewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold shadow-xs transition"
                        >
                          👉 Open & Preview Rendered Reminder Email
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {serverStatus?.lastError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-bold">Last Scheduler Error:</span> {serverStatus.lastError}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: DISPATCH HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-slate-900">Newsletter Dispatch Audit Trail</h4>
              {dispatchHistory.length === 0 ? (
                <p className="text-xs text-slate-500">No client broadcasts executed yet.</p>
              ) : (
                <div className="space-y-3">
                  {dispatchHistory.map((log) => (
                    <div key={log.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900">
                          {log.editionMonth} Edition Broadcast
                        </span>
                        <span className="text-slate-500">
                          {new Date(log.sentAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-700">
                        Dispatched to <strong>{log.successfulSends.length} / {log.totalRecipients}</strong> client emails.
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {log.successfulSends.map((email) => (
                          <span key={email} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono text-[10px]">
                            ✓ {email}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Explicit User Confirmation Dialog (MANDATORY per Workspace Integration skill for email sending) */}
      {showConfirmSendDialog && (
        <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-300">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 mb-4 mx-auto">
              <Send className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center mb-1">
              Confirm Email Broadcast to {activeClients.length} Clients?
            </h3>
            <p className="text-xs text-slate-600 text-center mb-4 leading-relaxed">
              This will send the verified <strong>2-Page GST Newsletter ({newsletter.editionMonth})</strong> converted as a PDF attachment to <strong>{activeClients.length} clients</strong> from your connected Gmail address.
            </p>

            <div className="bg-slate-100 p-3 rounded-lg text-xs space-y-1 mb-5 text-slate-700">
              <p>• <strong>Sender:</strong> {profile.practitionerName} ({profile.email})</p>
              <p>• <strong>Subject:</strong> GST Updates & Case Law Dispatch ({newsletter.editionMonth})</p>
              <p>• <strong>Attachment:</strong> 2-Page Executive PDF (A4 Format)</p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setShowConfirmSendDialog(false)}
                className="flex-1 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBroadcast}
                className="flex-1 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow"
              >
                Confirm & Send Emails
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
