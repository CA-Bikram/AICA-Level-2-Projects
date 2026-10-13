import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  FileText,
  Scale,
  Users,
  Clock,
  HardDrive,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Download,
  Calendar,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Header } from './components/Header';
import { TaxTMIPanel } from './components/TaxTMIPanel';
import { NewsletterEditorAndPreview } from './components/NewsletterEditorAndPreview';
import { DispatchAndClientModal } from './components/DispatchAndClientModal';
import {
  ClientRecipient,
  DispatchLog,
  GSTCaseLaw,
  GSTRegulatoryUpdate,
  NewsletterContent,
  PractitionerProfile,
  TaxTMICredentials,
} from './types';
import { taxtmiService } from './services/taxtmiService';
import {
  createDefaultNewsletter,
  DEFAULT_PRACTITIONER_PROFILE,
  getFormattedCurrentDate,
} from './services/newsletterEngine';
import { reminderAndMailService } from './services/reminderAndMailService';
import { initAuth, googleSignIn } from './services/googleAuth';

export default function App() {
  // Google Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Core Data States
  const [credentials, setCredentials] = useState<TaxTMICredentials>(taxtmiService.getCredentials());
  const [caseLaws, setCaseLaws] = useState<GSTCaseLaw[]>(taxtmiService.getCaseLaws());
  const [regulatoryUpdates, setRegulatoryUpdates] = useState<GSTRegulatoryUpdate[]>(
    taxtmiService.getRegulatoryUpdates()
  );
  const [profile, setProfile] = useState<PractitionerProfile>(DEFAULT_PRACTITIONER_PROFILE);
  const [clients, setClients] = useState<ClientRecipient[]>(reminderAndMailService.getClients());
  const [reminderConfig, setReminderConfig] = useState(reminderAndMailService.getReminderConfig());

  // Active Newsletter
  const [newsletter, setNewsletter] = useState<NewsletterContent>(() =>
    createDefaultNewsletter(caseLaws, regulatoryUpdates, profile)
  );

  // Daily Edition & Automated TaxTMI Scraping States
  const [isAutoScrapingTaxTMI, setIsAutoScrapingTaxTMI] = useState(false);
  const [dailyEditionNotice, setDailyEditionNotice] = useState<string | null>(null);

  // Server Reminder Status & Quick Dispatch States
  const [serverReminderStatus, setServerReminderStatus] = useState<any>(null);
  const [isQuickSendingReminder, setIsQuickSendingReminder] = useState(false);
  const [reminderBannerDismissed, setReminderBannerDismissed] = useState(false);

  const fetchServerReminderStatus = async () => {
    try {
      const res = await fetch('/api/reminder/status');
      if (res.ok) {
        const data = await res.json();
        setServerReminderStatus(data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchServerReminderStatus();
    const srvInterval = setInterval(fetchServerReminderStatus, 30000);
    return () => clearInterval(srvInterval);
  }, []);

  const handleQuickDispatchReminder = async () => {
    setIsQuickSendingReminder(true);
    try {
      const res = await reminderAndMailService.sendPractitionerReminderEmail(
        reminderConfig.targetEmail,
        profile,
        newsletter
      );
      if (res.method === 'cloud_delivery_archive') {
        setDailyEditionNotice(`⚠️ Reminder compiled with latest data & archived to server. To deliver directly to your Gmail inbox (${reminderConfig.targetEmail}), configure your 16-character Google App Password in Broadcast settings.`);
      } else {
        setDailyEditionNotice(`✅ 10:00 AM Daily Review Reminder dispatched directly into ${reminderConfig.targetEmail}'s inbox! (ID: ${res.messageId || 'OK'})`);
      }
      setTimeout(() => setDailyEditionNotice(null), 9000);
      fetchServerReminderStatus();
    } catch (err: any) {
      const errStr = err?.message || String(err);
      if (errStr.includes('OAUTH_TOKEN_EXPIRED') || errStr.includes('401') || errStr.includes('not connected')) {
        try {
          const signRes = await googleSignIn();
          if (signRes?.accessToken) {
            setAccessToken(signRes.accessToken);
            const retry = await reminderAndMailService.sendPractitionerReminderEmail(
              reminderConfig.targetEmail,
              profile,
              newsletter
            );
            setDailyEditionNotice(`✅ Connected Google & dispatched 10:00 AM Reminder to ${reminderConfig.targetEmail}!`);
            setTimeout(() => setDailyEditionNotice(null), 8000);
            fetchServerReminderStatus();
            return;
          }
        } catch (inner: any) {
          setDailyEditionNotice('Google connection required to dispatch: ' + (inner?.message || 'Cancelled'));
          setTimeout(() => setDailyEditionNotice(null), 6000);
          return;
        }
      }
      setDailyEditionNotice('Reminder dispatch: ' + (err?.message || 'Check connection settings'));
      setTimeout(() => setDailyEditionNotice(null), 6000);
    } finally {
      setIsQuickSendingReminder(false);
    }
  };

  // UI Navigation
  const [activeMainTab, setActiveMainTab] = useState<'newsletter' | 'taxtmi' | 'clients'>('newsletter');
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [driveSavedLink, setDriveSavedLink] = useState<string | null>(null);

  // Initialize Auth
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
        // Automatically align reminder target email with authenticated Google account if desired
        if (user?.email) {
          const currentConfig = reminderAndMailService.getReminderConfig();
          if (!currentConfig.targetEmail || currentConfig.targetEmail === 'info@garvca.com') {
            const updated = { ...currentConfig, targetEmail: user.email };
            reminderAndMailService.saveReminderConfig(updated);
            setReminderConfig(updated);
          }
        }
      },
      () => {
        // No cached token in memory yet
      }
    );
    return () => unsubscribe();
  }, []);

  // Automated 10:00 AM Daily Review Reminder Background Interval
  useEffect(() => {
    const runReminderCheck = async () => {
      try {
        const result = await reminderAndMailService.checkAndSendScheduledReminder(profile, newsletter);
        if (result.sent) {
          console.log(`[10:00 AM Automation] ${result.reason}`);
          fetchServerReminderStatus();
        }
      } catch (err) {
        console.warn('[10:00 AM Automation] Background scheduler notice:', err);
      }
    };

    const intervalId = setInterval(runReminderCheck, 30000); // Check every 30 seconds
    runReminderCheck(); // Check on load and when accessToken changes

    return () => clearInterval(intervalId);
  }, [newsletter, profile, accessToken]);

  // Register token with backend server background scheduler whenever token is available
  useEffect(() => {
    if (accessToken && accessToken !== 'permanent-google-drive-session') {
      fetch('/api/reminder/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: accessToken,
          targetEmail: reminderConfig.targetEmail,
          reminderTime: reminderConfig.reminderTime,
          profile,
          newsletter,
        }),
      }).catch((e) => console.warn('Server registration notice:', e));
    }
  }, [accessToken, reminderConfig, newsletter, profile]);

  // Rebuild Newsletter when TaxTMI selection changes
  const handleRebuildNewsletter = (
    customCases?: GSTCaseLaw[],
    customUpdates?: GSTRegulatoryUpdate[]
  ) => {
    const casesToUse = customCases || caseLaws;
    const updatesToUse = customUpdates || regulatoryUpdates;
    const updated = createDefaultNewsletter(casesToUse, updatesToUse, profile);
    setNewsletter((prev) => ({
      ...updated,
      id: prev.id,
      verificationStatus: prev.verificationStatus,
      driveFileId: prev.driveFileId,
      driveWebViewLink: prev.driveWebViewLink,
      driveDocxLink: prev.driveDocxLink,
    }));
  };

  // Automatically scrape fresh TaxTMI data and generate today's fresh daily newsletter edition
  const handleGenerateDailyEdition = async (silent = false) => {
    setIsAutoScrapingTaxTMI(true);
    if (!silent) {
      setDailyEditionNotice("🔄 Scraping fresh TaxTMI precedents & CBIC circulars for today's daily newsletter...");
    }
    try {
      const res = await taxtmiService.syncWithTaxTMI(credentials);
      if (res.cases && res.cases.length > 0) {
        setCaseLaws(res.cases);
        setCredentials(taxtmiService.getCredentials());
        if (res.regulatoryUpdates && res.regulatoryUpdates.length > 0) {
          setRegulatoryUpdates(res.regulatoryUpdates);
        }
        handleRebuildNewsletter(res.cases, res.regulatoryUpdates);
        setDailyEditionNotice(`✨ Today's daily newsletter generated with fresh TaxTMI data! (${res.cases.length} court rulings, ${res.regulatoryUpdates.length} statutory updates)`);
        setTimeout(() => setDailyEditionNotice(null), 8000);
      }
    } catch (e: any) {
      console.warn('Auto scrape TaxTMI notice:', e);
      if (!silent) {
        setDailyEditionNotice('Scrape notice: ' + (e?.message || 'Using verified real-time cache'));
        setTimeout(() => setDailyEditionNotice(null), 6000);
      }
    } finally {
      setIsAutoScrapingTaxTMI(false);
    }
  };

  // Automatically trigger TaxTMI scrape on load if new day or not synced today, plus midnight rollover timer
  useEffect(() => {
    const today = new Date().toDateString();
    const lastSyncDate = credentials.lastSyncedAt ? new Date(credentials.lastSyncedAt).toDateString() : null;
    const isNewDay = lastSyncDate !== today || taxtmiService.isSyncNeededToday() || !credentials.lastSyncedAt;

    if (isNewDay) {
      console.log("[Auto-Scrape Engine] New day detected or not synced today. Triggering automatic TaxTMI scrape...");
      handleGenerateDailyEdition(false);
    }

    // 60-second rollover check for midnight transitions into a new day
    const dayRolloverInterval = setInterval(() => {
      const currentDay = new Date().toDateString();
      const currentCreds = taxtmiService.getCredentials();
      const currentSyncDay = currentCreds.lastSyncedAt ? new Date(currentCreds.lastSyncedAt).toDateString() : null;
      if (currentSyncDay !== currentDay) {
        console.log("[Auto-Scrape Engine] Midnight passed into a new day! Automatically scraping fresh TaxTMI data...");
        handleGenerateDailyEdition(false);
      }
    }, 60000);

    return () => clearInterval(dayRolloverInterval);
  }, []);

  const handleDispatchComplete = (log: DispatchLog) => {
    setNewsletter((prev) => ({
      ...prev,
      verificationStatus: 'DISPATCHED',
    }));
  };

  // Determine whether 10:00 AM daily reminder is due and unsent for today
  const isPast10Am = (() => {
    try {
      const now = new Date();
      const istStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now);
      const [h, m] = istStr.split(':').map(Number);
      return h > 10 || (h === 10 && m >= 0);
    } catch {
      return false;
    }
  })();

  const isReminderDueToday =
    isPast10Am &&
    !reminderBannerDismissed &&
    serverReminderStatus &&
    !serverReminderStatus.isSentToday &&
    reminderConfig.enabled;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        user={currentUser}
        accessToken={accessToken}
        onAuthChange={(user, token) => {
          setCurrentUser(user);
          setAccessToken(token);
        }}
        taxtmiSynced={!!credentials.lastSyncedAt}
        newsletterStatus={newsletter.verificationStatus}
        driveSaved={!!(newsletter.driveWebViewLink || driveSavedLink)}
      />

      {/* Daily Fresh Edition / Auto-Scrape Status Banner */}
      {(dailyEditionNotice || isAutoScrapingTaxTMI) && (
        <div className="bg-blue-900 text-blue-100 px-4 py-2 text-xs border-b border-blue-800 shadow-xs">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className={`w-4 h-4 text-amber-400 ${isAutoScrapingTaxTMI ? 'animate-spin' : ''}`} />
              <span className="font-semibold">
                {dailyEditionNotice || "⚡ Automated Daily Edition: Fetching fresh TaxTMI case laws & CBIC circulars for today..."}
              </span>
            </div>
            {dailyEditionNotice && (
              <button
                onClick={() => setDailyEditionNotice(null)}
                className="text-blue-300 hover:text-white font-bold ml-4 text-sm cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* 10:00 AM Daily Review Reminder Attention Banner */}
      {isReminderDueToday && (
        <div className="bg-amber-600 text-white px-4 py-2.5 text-xs border-b border-amber-700 shadow-md">
          <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2.5">
              <Clock className="w-4 h-4 text-amber-200 flex-shrink-0 animate-pulse" />
              <div>
                <span className="font-bold mr-1.5">📌 10:00 AM Review Reminder Due:</span>
                <span className="opacity-95">
                  Today's GST Newsletter edition is compiled with fresh TaxTMI case laws and ready for your review.
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              <button
                onClick={handleQuickDispatchReminder}
                disabled={isQuickSendingReminder}
                className="bg-white text-amber-900 hover:bg-amber-50 font-bold px-3 py-1.5 rounded-lg shadow-xs text-xs flex items-center gap-1.5 cursor-pointer transition active:scale-95 disabled:opacity-50"
              >
                {isQuickSendingReminder ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-800" /> : <Send className="w-3.5 h-3.5 text-amber-800" />}
                <span>Send Review Copy to {reminderConfig.targetEmail}</span>
              </button>
              <button
                onClick={() => setIsDispatchModalOpen(true)}
                className="bg-amber-700 hover:bg-amber-800 text-amber-100 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition"
              >
                Settings
              </button>
              <button
                onClick={() => setReminderBannerDismissed(true)}
                className="text-amber-200 hover:text-white px-1.5 text-sm cursor-pointer"
                title="Dismiss Banner"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Stepper Bar */}
      <div className="bg-slate-900 border-b border-slate-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            
            {/* Step Pipeline */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/70 border border-indigo-500/30 text-indigo-200">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[11px]">1</span>
                <span>TaxTMI Lookup (taxtmi.com)</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />

              <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-950/70 border border-blue-500/30 text-blue-200">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[11px]">2</span>
                <span>2-Page Word Document</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />

              <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                <span className="w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-[11px]">3</span>
                <span>Keep in Google Drive & 10 AM Alert</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />

              <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border ${
                newsletter.verificationStatus === 'VERIFIED'
                  ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}>
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[11px]">4</span>
                <span>Verify & Email Clients</span>
              </div>
            </div>

            {/* Quick Action to Send */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsDispatchModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-1.5 rounded-lg flex items-center space-x-1.5 shadow transition active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Client Dispatch & 10 AM Scheduler</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveMainTab('newsletter')}
              className={`py-3.5 text-xs font-bold border-b-2 flex items-center space-x-2 transition ${
                activeMainTab === 'newsletter'
                  ? 'border-blue-600 text-blue-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>2-Page Newsletter Studio & Word Preview</span>
            </button>

            <button
              onClick={() => setActiveMainTab('taxtmi')}
              className={`py-3.5 text-xs font-bold border-b-2 flex items-center space-x-2 transition ${
                activeMainTab === 'taxtmi'
                  ? 'border-blue-600 text-blue-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>TaxTMI Legal Feed & Credentials (www.taxtmi.com)</span>
            </button>

            <button
              onClick={() => setActiveMainTab('clients')}
              className={`py-3.5 text-xs font-bold border-b-2 flex items-center space-x-2 transition ${
                activeMainTab === 'clients'
                  ? 'border-blue-600 text-blue-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Client Directory & 10 AM Reminder Setup</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {activeMainTab === 'newsletter' && (
          <NewsletterEditorAndPreview
            newsletter={newsletter}
            onUpdateNewsletter={setNewsletter}
            profile={profile}
            onUpdateProfile={setProfile}
            accessToken={accessToken}
            onOpenDispatchModal={() => setIsDispatchModalOpen(true)}
            onDriveSaved={(link) => setDriveSavedLink(link)}
            onGenerateTodayEdition={() => handleGenerateDailyEdition(false)}
            isGeneratingEdition={isAutoScrapingTaxTMI}
          />
        )}

        {activeMainTab === 'taxtmi' && (
          <TaxTMIPanel
            credentials={credentials}
            onUpdateCredentials={setCredentials}
            caseLaws={caseLaws}
            onUpdateCaseLaws={setCaseLaws}
            regulatoryUpdates={regulatoryUpdates}
            onUpdateRegulatoryUpdates={setRegulatoryUpdates}
            onRebuildNewsletter={handleRebuildNewsletter}
          />
        )}

        {activeMainTab === 'clients' && (
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Client Dispatch & 10:00 AM Automation Controls
                </h3>
                <p className="text-xs text-slate-500">
                  Configure recipient email list, manage active clients, and automate daily review reminders.
                </p>
              </div>
              <button
                onClick={() => setIsDispatchModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow flex items-center space-x-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Open Broadcast Modal</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>10:00 AM Practitioner Reminder Notice</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Every morning at <strong>{reminderConfig.reminderTime || '10:00 AM'}</strong>, the system automatically sends a reminder email to <strong>{reminderConfig.targetEmail}</strong> alerting you that the GST newsletter has been synthesized with current indirect tax precedents and statutory circulars, and archived in Google Drive for your review.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setIsDispatchModalOpen(true)}
                    className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline"
                  >
                    Adjust Reminder Time & Test Send →
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span>Client Mailing List ({clients.length} Registered)</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your client directory holds trade names, GSTINs, and accounts emails. Once you verify the newsletter, 1-click sends the executive 2-page PDF copy via your Gmail account.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setIsDispatchModalOpen(true)}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline"
                  >
                    Manage Client Emails & Import →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Broadcast / Client / 10 AM Modal */}
      <DispatchAndClientModal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        newsletter={newsletter}
        profile={profile}
        accessToken={accessToken}
        clients={clients}
        onUpdateClients={setClients}
        onDispatchComplete={handleDispatchComplete}
        onUpdateNewsletter={setNewsletter}
      />

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 text-[11px] py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            GST Pulse Automation for Indirect Tax Practitioners • Statutory Precedents, Circulars &amp; Compliance Intelligence
          </div>
          <div className="flex items-center space-x-4">
            <span>Word (.docx) Generator</span>
            <span>Google Drive v3 API</span>
            <span>Gmail API</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
