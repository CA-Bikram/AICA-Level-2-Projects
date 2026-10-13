import { getAccessToken } from './googleAuth';
import { ClientRecipient, DispatchLog, NewsletterContent, PractitionerProfile } from '../types';
import { getPdfFileName, generatePdfBlob } from './newsletterEngine';
import { driveService } from './driveService';
import { firestoreService } from './firestoreService';

const CLIENTS_STORAGE_KEY = 'gstpulse_clients';
const DISPATCH_HISTORY_KEY = 'gstpulse_dispatch_logs';
const REMINDER_STORAGE_KEY = 'gstpulse_reminder_settings';

export const INITIAL_CLIENTS: ClientRecipient[] = [
  {
    id: 'cli-01',
    clientName: 'Apex Precision Tools Pvt Ltd',
    tradeName: 'Apex Tools India',
    gstin: '07AAACA4512B1Z8',
    email: 'finance@apextoolsindia.com',
    category: 'Manufacturing',
    active: true,
  },
  {
    id: 'cli-02',
    clientName: 'Vanguard Software Solutions LLP',
    tradeName: 'Vanguard Cloud',
    gstin: '07AAIFV8945K1ZK',
    email: 'taxation@vanguardcloud.io',
    category: 'IT & Services',
    active: true,
  },
  {
    id: 'cli-03',
    clientName: 'Kaveri Global Enterprises',
    tradeName: 'Kaveri Exim',
    gstin: '07AAHFK2134L1ZT',
    email: 'director@kaveriexim.com',
    category: 'Exporters',
    active: true,
  },
  {
    id: 'cli-04',
    clientName: 'Metro Distributors & Logistics',
    tradeName: 'Metro Logistics',
    gstin: '07AABCD9981M1ZR',
    email: 'accounts@metrologistics.co.in',
    category: 'Trading & Retail',
    active: true,
  },
  {
    id: 'cli-05',
    clientName: 'Practitioner Review Copy (Self)',
    tradeName: 'Internal Audit',
    gstin: '07AAAAA0000A1Z5',
    email: 'anshumadocuments@gmail.com',
    category: 'General',
    active: true,
  },
];

// Helper to convert ArrayBuffer/Blob to Base64
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Convert string to base64url encoding required by Gmail API
function toBase64Url(str: string): string {
  // UTF-8 safe base64
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export const reminderAndMailService = {
  getClients(): ClientRecipient[] {
    const raw = localStorage.getItem(CLIENTS_STORAGE_KEY);
    if (!raw) return INITIAL_CLIENTS;
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_CLIENTS;
    }
  },

  saveClients(clients: ClientRecipient[]): void {
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
  },

  getDispatchLogs(): DispatchLog[] {
    const raw = localStorage.getItem(DISPATCH_HISTORY_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveDispatchLog(log: DispatchLog): void {
    const logs = this.getDispatchLogs();
    logs.unshift(log);
    localStorage.setItem(DISPATCH_HISTORY_KEY, JSON.stringify(logs));
  },

  getReminderConfig() {
    const raw = localStorage.getItem(REMINDER_STORAGE_KEY);
    if (!raw) {
      return {
        reminderTime: '10:00',
        targetEmail: 'anshumadocuments@gmail.com',
        enabled: true,
      };
    }
    try {
      return JSON.parse(raw);
    } catch {
      return {
        reminderTime: '10:00',
        targetEmail: 'anshumadocuments@gmail.com',
        enabled: true,
      };
    }
  },

  saveReminderConfig(config: { reminderTime: string; targetEmail: string; enabled: boolean }) {
    localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(config));
  },

  getLastReminderSentDate(): string | null {
    return localStorage.getItem('gstpulse_last_10am_reminder_date');
  },

  setLastReminderSentDate(dateStr: string): void {
    localStorage.setItem('gstpulse_last_10am_reminder_date', dateStr);
  },

  getDeliveryAuditInfo() {
    return {
      lastSentDate: localStorage.getItem('gstpulse_last_10am_reminder_date'),
      lastSentTimestamp: localStorage.getItem('gstpulse_last_sent_timestamp'),
      lastMessageId: localStorage.getItem('gstpulse_last_message_id'),
    };
  },

  async syncWithFirestore() {
    try {
      const remote = await firestoreService.getReminderConfig();
      if (remote) {
        if (remote.lastSentDate) {
          localStorage.setItem('gstpulse_last_10am_reminder_date', remote.lastSentDate);
        }
        if (remote.lastMessageId) {
          localStorage.setItem('gstpulse_last_message_id', remote.lastMessageId);
        }
        if (remote.lastSentTime) {
          localStorage.setItem('gstpulse_last_sent_timestamp', remote.lastSentTime);
        }
        const current = this.getReminderConfig();
        const merged = {
          reminderTime: remote.reminderTime || current.reminderTime,
          targetEmail: remote.targetEmail || current.targetEmail,
          enabled: remote.enabled !== undefined ? remote.enabled : current.enabled,
        };
        this.saveReminderConfig(merged);
        return merged;
      }
    } catch (e) {
      console.warn('Sync with firestore notice:', e);
    }
    return this.getReminderConfig();
  },

  /**
   * Automatically evaluates whether 10:00 AM scheduled reminder is due,
   * checking both local time and Indian Standard Time (IST - Asia/Kolkata),
   * and dispatches via Gmail API to targetEmail if not already sent today.
   */
  async checkAndSendScheduledReminder(
    profile: PractitionerProfile,
    newsletter: NewsletterContent
  ): Promise<{ sent: boolean; reason?: string }> {
    const config = this.getReminderConfig();
    if (!config.enabled) {
      return { sent: false, reason: 'Reminder disabled in settings' };
    }

    const now = new Date();
    const istDateToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
    const lastSentDate = this.getLastReminderSentDate();

    if (lastSentDate === istDateToday) {
      return { sent: false, reason: `Reminder already dispatched for today (${istDateToday})` };
    }

    const [targetHour, targetMinute] = (config.reminderTime || '10:00').split(':').map(Number);

    // 1. Current local browser time comparison
    const localHour = now.getHours();
    const localMinute = now.getMinutes();
    const isPastLocalTime = (localHour > targetHour) || (localHour === targetHour && localMinute >= targetMinute);

    // 2. Indian Standard Time (IST) comparison
    let isPastIstTime = false;
    try {
      const istStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now);
      const [istHour, istMinute] = istStr.split(':').map(Number);
      isPastIstTime = (istHour > targetHour) || (istHour === targetHour && istMinute >= targetMinute);
    } catch {}

    const isDue = isPastLocalTime || isPastIstTime;
    if (!isDue) {
      return { sent: false, reason: `Scheduled for ${config.reminderTime || '10:00 AM'} (Not due yet)` };
    }

    // Register token with backend server background scheduler if token is available
    const token = await getAccessToken();
    if (token) {
      try {
        fetch('/api/reminder/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            targetEmail: config.targetEmail,
            reminderTime: config.reminderTime || '10:00',
            profile,
            newsletter,
          }),
        }).catch(() => {});
      } catch {}
    }

    try {
      const res = await this.sendPractitionerReminderEmail(config.targetEmail, profile, newsletter);
      this.setLastReminderSentDate(istDateToday);
      return { sent: true, reason: `Dispatched automated 10 AM reminder to ${config.targetEmail} (ID: ${res.messageId || 'OK'})` };
    } catch (err: any) {
      this.setLastReminderSentDate('');
      return { sent: false, reason: err?.message || 'Reminder dispatch failed' };
    }
  },

  /**
   * Sends 10:00 AM practitioner reminder email to review the newsletter
   */
  async sendPractitionerReminderEmail(
    practitionerEmail: string,
    profile: PractitionerProfile,
    newsletter: NewsletterContent
  ): Promise<{ success: boolean; messageId?: string; method?: string; viewUrl?: string }> {
    const accessToken = await getAccessToken();

    // 1. Attempt server-side multi-transport trigger first (supports Permanent SMTP / Gmail App Password and OAuth)
    try {
      const srvRes = await fetch('/api/reminder/trigger-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: accessToken,
          targetEmail: practitionerEmail,
          profile,
          newsletter,
        }),
      });
      if (srvRes.ok) {
        const srvData = await srvRes.json();
        if (srvData.success) {
          const todayDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
          const nowIso = new Date().toISOString();
          this.setLastReminderSentDate(todayDateStr);
          try {
            localStorage.setItem('gstpulse_last_sent_timestamp', nowIso);
            if (srvData.messageId) {
              localStorage.setItem('gstpulse_last_message_id', srvData.messageId);
            }
            if (srvData.viewUrl) {
              localStorage.setItem('gstpulse_last_view_url', srvData.viewUrl);
            }
          } catch {}
          return {
            success: true,
            messageId: srvData.messageId,
            method: srvData.method,
            viewUrl: srvData.viewUrl,
          };
        }
      }
    } catch (e) {
      console.warn('Server trigger call failed, falling back to direct client Gmail API:', e);
    }

    if (!accessToken) {
      throw new Error('Google Account is not connected. Please click "Connect Google Drive & Gmail" or set a Permanent Gmail App Password.');
    }

    // 2. Resolve web portal URL for direct one-click review
    const portalUrl =
      typeof window !== 'undefined' && window.location?.origin
        ? `${window.location.origin}/?view=newsletter`
        : 'https://ais-dev-wboznb7h64rnuneltdy7cq-748555339680.asia-southeast1.run.app';

    // 2. Ensure Google Drive link is available: if not yet uploaded, auto-upload PDF to Google Drive
    let driveLink = newsletter.driveWebViewLink || null;
    if (!driveLink && accessToken) {
      try {
        const pdfBlob = generatePdfBlob(newsletter, profile);
        const fileName = getPdfFileName(newsletter);
        const uploadRes = await driveService.uploadFile(pdfBlob, fileName, 'application/pdf');
        if (uploadRes?.webViewLink) {
          driveLink = uploadRes.webViewLink;
          newsletter.driveWebViewLink = uploadRes.webViewLink;
          newsletter.driveFileId = uploadRes.fileId;
        }
      } catch (err) {
        console.warn('Could not auto-upload PDF to Google Drive during reminder creation:', err);
      }
    }

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; color: #1e293b;">
        <div style="background-color: #1e3a8a; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">📌 10:00 AM GST NEWSLETTER REVIEW REMINDER</h2>
          <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 13px;">${profile.firmName} | Daily Automation Dispatch</p>
        </div>
        <div style="padding: 24px;">
          <p style="font-size: 15px;">Respected <strong>${profile.practitionerName}</strong>,</p>
          <p style="font-size: 14px; line-height: 1.6;">
            Your automated 2-page GST newsletter for <strong>${newsletter.editionMonth}</strong> (${newsletter.volumeNo}) has been synthesized with current indirect tax precedents and statutory updates, and is ready for your review.
          </p>

          <div style="background-color: #f8fafc; border-left: 4px solid #1e3a8a; padding: 14px 18px; margin: 18px 0; border-radius: 0 6px 6px 0;">
            <p style="margin: 0 0 8px 0; font-weight: bold; color: #1e3a8a; font-size: 14px;">Included Key Highlights:</p>
            <ul style="margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.6;">
              ${newsletter.caseLaws.map(cl => `<li><strong>${cl.court}:</strong> ${cl.title.slice(0, 75)}...</li>`).join('')}
              ${newsletter.regulatoryUpdates.map(ru => `<li><strong>${ru.type}:</strong> ${ru.number}</li>`).join('')}
            </ul>
          </div>

          <!-- DIRECT EMBEDDED NEWSLETTER ACCESS CARD -->
          <div style="margin: 22px 0; padding: 18px 20px; background-color: #f0f7ff; border: 2px solid #2563eb; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 10px 0; font-size: 15px; font-weight: bold; color: #1e3a8a;">
              📄 Direct Link to Review Newsletter (${newsletter.volumeNo}):
            </p>
            <div style="margin: 14px 0;">
              <a href="${portalUrl}" style="background-color: #1e3a8a; color: #ffffff; padding: 12px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block; margin: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
                👉 Open & Review Newsletter (Web Portal)
              </a>
              ${driveLink ? `
              <a href="${driveLink}" style="background-color: #059669; color: #ffffff; padding: 12px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block; margin: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
                📂 View 2-Page PDF in Google Drive
              </a>` : ''}
            </div>
            <p style="margin: 8px 0 0 0; font-size: 12px; color: #475569;">
              Portal Link: <a href="${portalUrl}" style="color: #2563eb; font-weight: bold; text-decoration: underline;">${portalUrl}</a>
            </p>
            ${driveLink ? `
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #475569;">
              Google Drive PDF: <a href="${driveLink}" style="color: #059669; font-weight: bold; text-decoration: underline;">${driveLink}</a>
            </p>` : ''}
          </div>

          <div style="margin-top: 20px; padding: 14px 18px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px;">
            <p style="margin: 0; font-size: 13px; color: #065f46; line-height: 1.6;">
              <strong>Next Action:</strong> <a href="${portalUrl}" style="color: #047857; font-weight: bold; text-decoration: underline;">Click here to open GST Pulse</a> to verify the newsletter contents. Once verified, click <em>"Send Newsletter to Clients"</em> to broadcast the converted PDF to your verified client mailing list.
            </p>
          </div>
        </div>
        <div style="background-color: #f1f5f9; padding: 12px 20px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0;">
          Automated GST Practitioner Compliance Robot | ${profile.officeAddress}
        </div>
      </div>
    `;

    const subject = `📌 10:00 AM Reminder: GST Newsletter (${newsletter.editionMonth}) Ready for Review`;

    const emailLines = [
      `To: ${practitionerEmail}`,
      `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      htmlBody,
    ];

    const rawEmail = emailLines.join('\r\n');
    const base64UrlEmail = toBase64Url(rawEmail);

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: base64UrlEmail }),
    });

    if (!res.ok) {
      const err = await res.text();
      if (res.status === 401 || err.includes('invalid_grant') || err.includes('Invalid Credentials')) {
        throw new Error('OAUTH_TOKEN_EXPIRED: Your Google OAuth session has expired (tokens expire after 1 hour). Please click "Refresh Google Connection" in the top bar to restore Google Drive & Gmail connectivity.');
      }
      throw new Error(`Failed to send 10 AM reminder via Gmail API (${res.status}): ${err}`);
    }

    const data = await res.json();
    const todayDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const nowIso = new Date().toISOString();
    this.setLastReminderSentDate(todayDateStr);
    try {
      localStorage.setItem('gstpulse_last_sent_timestamp', nowIso);
      if (data.id) {
        localStorage.setItem('gstpulse_last_message_id', data.id);
      }
    } catch {}

    const config = this.getReminderConfig();
    // Persist to Cloud Firestore for permanent cross-session records
    firestoreService.saveReminderConfig({
      reminderTime: config.reminderTime || '10:00',
      targetEmail: practitionerEmail,
      enabled: true,
      lastSentDate: todayDateStr,
      lastSentTime: nowIso,
      lastMessageId: data.id,
      googleConnectedEmail: practitionerEmail,
    }).catch(() => {});

    // Notify backend server runner
    fetch('/api/reminder/mark-sent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: todayDateStr,
        messageId: data.id,
        timestamp: nowIso,
      }),
    }).catch(() => {});

    return { success: true, messageId: data.id };
  },

  /**
   * Broadcasts the verified 2-Page PDF newsletter to all active clients
   */
  async broadcastNewsletterToClients(
    clients: ClientRecipient[],
    newsletter: NewsletterContent,
    profile: PractitionerProfile,
    pdfBlob: Blob,
    onProgress?: (sentCount: number, total: number, currentClient: string) => void
  ): Promise<DispatchLog> {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error('Google Account is not connected. Please authenticate with Google first.');
    }

    if (newsletter.verificationStatus !== 'VERIFIED') {
      throw new Error('Cannot send unverified newsletter. Please click "Verify & Approve" first.');
    }

    const pdfBase64 = await blobToBase64(pdfBlob);
    const pdfFileName = getPdfFileName(newsletter);

    const successfulSends: string[] = [];
    const failedSends: { email: string; reason: string }[] = [];

    const activeClients = clients.filter((c) => c.active);
    const boundary = '===GST_NEWSLETTER_ATTACHMENT_BOUNDARY===';

    for (let i = 0; i < activeClients.length; i++) {
      const client = activeClients[i];
      if (onProgress) {
        onProgress(i + 1, activeClients.length, client.clientName);
      }

      try {
        const subject = `Garv GST Pulse (${newsletter.editionMonth}) - Indirect Tax Intelligence`;
        const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #1e3a8a; color: white; padding: 22px; text-align: center;">
              <h2 style="margin: 0; font-size: 22px; letter-spacing: 0.5px;">GARV GST PULSE</h2>
              <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.9;">${newsletter.editionMonth} • Confidential Internal Circulation Only</p>
            </div>

            <div style="padding: 24px;">
              <p style="font-size: 15px;">Dear <strong>${client.clientName}</strong> Team,</p>
              <p style="font-size: 14px; line-height: 1.6;">
                Please find attached the official <strong>2-Page Garv GST Pulse Newsletter for ${newsletter.editionMonth}</strong> (${newsletter.volumeNo}), curated with high-level indirect tax intelligence, statutory circulars, and taxpayers' compliance due dates.
              </p>

              <div style="background-color: #f8fafc; border-left: 4px solid #1e3a8a; padding: 14px 16px; margin: 18px 0; border-radius: 0 6px 6px 0;">
                <p style="margin: 0 0 8px 0; font-weight: bold; color: #1e3a8a; font-size: 14px;">In This Edition:</p>
                <ul style="margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.6;">
                  ${newsletter.caseLaws.map(cl => `<li><strong>${cl.court}:</strong> ${cl.title}</li>`).join('')}
                  ${newsletter.regulatoryUpdates.map(ru => `<li><strong>${ru.type}:</strong> ${ru.number} - ${ru.title}</li>`).join('')}
                  <li><strong>Statutory Compliance Calendar:</strong> Filing deadlines for GSTR-1, GSTR-3B & IMS</li>
                </ul>
              </div>

              <p style="font-size: 13px; color: #475569; line-height: 1.6;">
                <strong>Attached Document:</strong> Complete 2-Page Executive PDF (<code>${pdfFileName}</code>). You may retain this copy for your statutory audit and compliance records.
              </p>

              ${newsletter.driveWebViewLink ? `
                <p style="margin-top: 14px;">
                  <a href="${newsletter.driveWebViewLink}" style="color: #1e3a8a; font-weight: bold; text-decoration: underline; font-size: 13px;">
                    🔗 View / Download via Google Drive Repository
                  </a>
                </p>
              ` : ''}

              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 13px; line-height: 1.5;">
                <p style="margin: 0 0 4px 0;">Warm regards,</p>
                <p style="margin: 0; font-weight: bold; color: #1e3a8a;">${profile.practitionerName}</p>
                <p style="margin: 0; color: #64748b;">${profile.firmName} | ${profile.designation}</p>
                <p style="margin: 0; color: #64748b;">Head Office: ${profile.officeAddress}</p>
                <p style="margin: 0; color: #64748b;">Phone: ${profile.phone} | Email: ${profile.email}</p>
              </div>
            </div>

            <div style="background-color: #f1f5f9; padding: 10px 18px; font-size: 10px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0;">
              Confidential internal circulation only. Not for general public advertising.
            </div>
          </div>
        `;

        // Assemble RFC 2822 multipart email with attachment
        const emailMime = [
          `To: ${client.email}`,
          `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
          'MIME-Version: 1.0',
          `Content-Type: multipart/mixed; boundary="${boundary}"`,
          '',
          `--${boundary}`,
          'Content-Type: text/html; charset=UTF-8',
          'Content-Transfer-Encoding: 7bit',
          '',
          htmlContent,
          '',
          `--${boundary}`,
          `Content-Type: application/pdf; name="${pdfFileName}"`,
          `Content-Disposition: attachment; filename="${pdfFileName}"`,
          'Content-Transfer-Encoding: base64',
          '',
          pdfBase64,
          '',
          `--${boundary}--`,
        ].join('\r\n');

        const base64Url = toBase64Url(emailMime);

        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw: base64Url }),
        });

        if (res.ok) {
          successfulSends.push(client.email);
          client.lastSentAt = new Date().toISOString();
        } else {
          const errText = await res.text();
          failedSends.push({ email: client.email, reason: `HTTP ${res.status}: ${errText}` });
        }
      } catch (err: any) {
        failedSends.push({ email: client.email, reason: err.message || 'Unknown network error' });
      }

      // Small throttling delay to avoid API rate limits
      await new Promise((r) => setTimeout(r, 400));
    }

    // Update clients store with lastSentAt
    this.saveClients(clients);

    const log: DispatchLog = {
      id: `disp-${Date.now()}`,
      newsletterId: newsletter.id,
      editionMonth: newsletter.editionMonth,
      sentAt: new Date().toISOString(),
      totalRecipients: activeClients.length,
      successfulSends,
      failedSends,
      driveLinkUsed: newsletter.driveWebViewLink,
    };

    this.saveDispatchLog(log);
    return log;
  },
};
