import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  Packer,
  PageBreak,
  Header,
  Footer,
  convertInchesToTwip,
  ShadingType,
  ImageRun,
} from 'docx';
import { jsPDF } from 'jspdf';
import {
  NewsletterContent,
  PractitionerProfile,
  ComplianceDueDate,
  GSTCaseLaw,
  GSTRegulatoryUpdate,
} from '../types';
import { getGarvLogoDataUrl } from '../components/GarvLogo';

export const DEFAULT_PRACTITIONER_PROFILE: PractitionerProfile = {
  practitionerName: 'GARV & Associates',
  firmName: 'GARV & Associates',
  designation: 'Chartered Accountants',
  enrollmentNo: 'Building Trust Since 1949',
  email: 'info@garvca.com',
  phone: '+91 33 4040 4743/ 44',
  officeAddress: '27A Hazra Road, Kolkata 700029',
  websiteOrPortal: 'www.garvca.com',
  touchpoints: [
    { city: 'KOLKATA (HQ)', address: '27A Hazra Road, Kolkata 700029' },
    { city: 'DELHI', address: 'Barakhamba Road, Connaught Place, New Delhi – 110 001' },
    { city: 'MUMBAI', address: 'Khatau Building, 1st Floor, 8/10 Alkesh Dinesh Modi Marg, Fort, Mumbai – 400 023' },
    { city: 'BENGALURU', address: 'Dassappa Reddy Complex, Unit 12 Balagere, Bengaluru – 560 087' },
    { city: 'CHENNAI', address: 'Vimalachal, Unit A 1103, 1088, Poonamallee High Road, Vepery, Chennai – 600 007' },
    { city: 'ASSAM', address: 'K C C Road, 2nd Floor, Chatribari, Guwahati – 781 008' },
  ],
};

export const DEFAULT_COMPLIANCE_DUE_DATES: ComplianceDueDate[] = [
  {
    form: 'GSTR-7',
    description: 'Monthly return for Tax Deducted at Source (TDS)',
    period: 'September 2026',
    dueDate: '10th October 2026',
    applicability: 'Govt departments & entities liable to deduct TDS',
  },
  {
    form: 'GSTR-8',
    description: 'Monthly statement for Tax Collected at Source (TCS)',
    period: 'September 2026',
    dueDate: '10th October 2026',
    applicability: 'E-commerce Operators collecting TCS',
  },
  {
    form: 'GSTR-1',
    description: 'Details of outward supplies (Monthly filers)',
    period: 'September 2026',
    dueDate: '11th October 2026',
    applicability: 'Taxpayers with TO > ₹5 Cr or non-QRMP opted',
  },
  {
    form: 'IFF (QRMP)',
    description: 'Invoice Furnishing Facility (Optional)',
    period: 'September 2026 (M3)',
    dueDate: '13th October 2026',
    applicability: 'Quarterly filers wanting to pass B2B ITC',
  },
  {
    form: 'GSTR-3B',
    description: 'Summary return & Tax Payment (Monthly filers)',
    period: 'September 2026',
    dueDate: '20th October 2026',
    applicability: 'All taxpayers exceeding ₹5 Cr turnover',
  },
  {
    form: 'GSTR-3B (QRMP)',
    description: 'Quarterly summary return & settlement',
    period: 'July - Sept 2026',
    dueDate: '22nd / 24th Oct 2026',
    applicability: 'QRMP taxpayers based on State Group A / B',
  },
  {
    form: 'PMT-06',
    description: 'Monthly GST Challan Payment for QRMP scheme',
    period: 'October 2026',
    dueDate: '25th October 2026',
    applicability: 'QRMP filers using 35% Fixed or Self-assessment method',
  },
];

export const INITIAL_ACTION_POINTS: string[] = [
  'IMS Reconciliation: Taxpayers\' accounting teams must log into GST Portal to action vendor invoices on the Invoice Management System before 14th of the month.',
  'Section 128A Amnesty: Review all pending SCNs for FY 2017-18 to 2019-20 under Section 73. Taxpayers can discharge tax liability without interest or penalty.',
  'Safari Retreats ITC Check: Taxpayers incurring capital expenditure on commercial spaces and leased premises should audit eligible ITC under the Hon\'ble Supreme Court ruling.',
  'Corporate Guarantee Compliance: Taxpayers executing parental / group corporate guarantees must benchmark 1% annual fee under Rule 28(2).',
  'Rule 86A Verification: Taxpayers should audit Electronic Credit Ledger balances to ensure no arbitrary credit freezing remains active beyond the 12-month limit.',
];

export function getFormattedCurrentDate(): string {
  return new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Generates the standardized filename for the PDF export using the issue date.
 * Example: "Garv_GST_Pulse_28_September_2026.pdf"
 */
export function getPdfFileName(newsletter: NewsletterContent): string {
  const dateStr = (newsletter.generatedDate || getFormattedCurrentDate())
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_');
  return `Garv_GST_Pulse_${dateStr}.pdf`;
}

/**
 * Generates the standardized filename for the Word (.docx) export using the issue date.
 * Example: "Garv_GST_Pulse_28_September_2026.docx"
 */
export function getDocxFileName(newsletter: NewsletterContent): string {
  const dateStr = (newsletter.generatedDate || getFormattedCurrentDate())
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_');
  return `Garv_GST_Pulse_${dateStr}.docx`;
}

/**
 * Daily Serial Volume and Issue Generator starting from scratch (Vol. I / Issue 01).
 * Automatically increments the issue number serially each calendar day.
 */
const ISSUE_TRACKER_STORAGE_KEY = 'gstpulse_daily_issue_tracker';
const ANCHOR_START_DATE = '2026-09-28'; // Reference launch date when numbering started from scratch

export interface DailyIssueTracker {
  startVolume: number; // Volume 1 = Vol. I
  currentIssue: number; // Starts at 1
  anchorDate: string; // "YYYY-MM-DD"
  lastCalculatedDate: string; // "YYYY-MM-DD"
}

export function toRomanNumeral(num: number): string {
  const romanMap: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let result = '';
  let n = num;
  for (const [val, sym] of romanMap) {
    while (n >= val) {
      result += sym;
      n -= val;
    }
  }
  return result || 'I';
}

export function getDailySerialVolumeAndIssue(targetDate: Date = new Date()): string {
  const todayStr = targetDate.toISOString().split('T')[0];

  let tracker: DailyIssueTracker;
  const stored = typeof window !== 'undefined' ? localStorage.getItem(ISSUE_TRACKER_STORAGE_KEY) : null;
  if (stored) {
    try {
      tracker = JSON.parse(stored);
    } catch {
      tracker = {
        startVolume: 1,
        currentIssue: 1,
        anchorDate: ANCHOR_START_DATE,
        lastCalculatedDate: todayStr,
      };
    }
  } else {
    tracker = {
      startVolume: 1,
      currentIssue: 1,
      anchorDate: ANCHOR_START_DATE,
      lastCalculatedDate: todayStr,
    };
  }

  // Calculate calendar days elapsed between anchor date and current date
  const anchorTime = new Date(tracker.anchorDate || ANCHOR_START_DATE).getTime();
  const currentTime = new Date(todayStr).getTime();
  const daysDiff = Math.max(0, Math.floor((currentTime - anchorTime) / (1000 * 60 * 60 * 24)));

  // Each day advances serially from Issue 1
  const serialIssue = Math.max(1, 1 + daysDiff);
  const volumeRoman = toRomanNumeral(tracker.startVolume || 1);
  const formattedIssue = serialIssue < 10 ? `0${serialIssue}` : `${serialIssue}`;

  // Update tracker state in storage
  if (typeof window !== 'undefined') {
    tracker.currentIssue = serialIssue;
    tracker.lastCalculatedDate = todayStr;
    localStorage.setItem(ISSUE_TRACKER_STORAGE_KEY, JSON.stringify(tracker));
  }

  return `Vol. ${volumeRoman} / Issue ${formattedIssue}`;
}

export function resetDailyIssueTracker(startVolume: number = 1, startIssue: number = 1): void {
  if (typeof window === 'undefined') return;
  const todayStr = new Date().toISOString().split('T')[0];
  const tracker: DailyIssueTracker = {
    startVolume,
    currentIssue: startIssue,
    anchorDate: todayStr,
    lastCalculatedDate: todayStr,
  };
  localStorage.setItem(ISSUE_TRACKER_STORAGE_KEY, JSON.stringify(tracker));
}

/**
 * Automatically synthesizes an Executive Tax Editorial dynamically from the active cases and circulars.
 */
export function generateExecutiveTaxEditorial(
  cases: GSTCaseLaw[],
  regs: GSTRegulatoryUpdate[],
  editionMonth: string = 'October 2026'
): string {
  const activeCases = (Array.isArray(cases) && cases.filter((c) => c.selectedForNewsletter).length > 0
    ? cases.filter((c) => c.selectedForNewsletter)
    : Array.isArray(cases) ? cases : []).slice(0, 3);

  const activeRegs = (Array.isArray(regs) && regs.filter((r) => r.selectedForNewsletter).length > 0
    ? regs.filter((r) => r.selectedForNewsletter)
    : Array.isArray(regs) ? regs : []).slice(0, 3);

  // Helper to clean HTML entities and court suffixes from case titles
  const cleanTitle = (raw: string): string => {
    return raw
      .replace(/&#038;/g, '&')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#8211;/g, '–')
      .replace(/:\s*(GSTAT|High Court|HC|Supreme Court|SC|Tribunal).*$/i, '')
      .replace(/\s*-\s*(GSTAT|High Court|HC|Supreme Court|SC|Tribunal).*$/i, '')
      .trim();
  };

  // Helper to extract clean core legal takeaway
  const cleanTakeaway = (c: GSTCaseLaw): string => {
    let raw = (c.practitionerTakeaway || '').trim();
    if (!raw || raw.length < 15) {
      raw = (c.rulingSummary || '').trim();
    }
    if (!raw || raw.length < 15) {
      raw = (c.keyIssue || '').trim();
    }
    if (!raw) return '';

    // Strip common prefixes
    let text = raw
      .replace(/^vital\s+(defense\s+)?precedent(\s*[:–-])?\s*(to\s+)?/i, '')
      .replace(/^(summary|takeaway|key takeaway|practitioner takeaway|note)(\s*[:–-])?\s*/i, '')
      .replace(/^the\s+(hon'ble\s+)?(high court|court|supreme court|gstat|tribunal)\s+(held|ruled|observed|clarified)\s+that\s+/i, '')
      .trim();

    const firstSentence = text.split(/(?<=[.!?])\s+/)[0]?.trim() || text;
    if (firstSentence.length > 15) {
      const trimmed = firstSentence.replace(/[.!?]+$/, '').trim();
      return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
    }
    return '';
  };

  // Synthesize Judicial Precedents dynamically from actual content
  const caseThemes: string[] = [];
  activeCases.forEach((c) => {
    const rawTitle = cleanTitle(c.title || '');
    if (!rawTitle) return;

    const courtName = c.court || 'Judicial Authority';
    const sectionStr = c.sectionsInvolved ? ` under ${c.sectionsInvolved}` : '';
    const takeaway = cleanTakeaway(c);

    if (takeaway) {
      caseThemes.push(
        `${courtName}'s landmark ruling in "${rawTitle}"${sectionStr} (affirming that ${takeaway})`
      );
    } else {
      caseThemes.push(
        `${courtName}'s authoritative ruling in "${rawTitle}"${sectionStr}`
      );
    }
  });

  // Helper to clean statutory circular takeaways
  const cleanRegImpact = (r: GSTRegulatoryUpdate): string => {
    let raw = (r.impactOnTaxpayers || '').trim();
    if (!raw || raw.length < 15) {
      raw = (r.brief || '').trim();
    }
    if (!raw) return '';

    let text = raw
      .replace(/^(summary|impact|takeaway|brief|guidance)(\s*[:–-])?\s*/i, '')
      .trim();

    const firstSentence = text.split(/(?<=[.!?])\s+/)[0]?.trim() || text;
    if (firstSentence.length > 15) {
      const trimmed = firstSentence.replace(/[.!?]+$/, '').trim();
      return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
    }
    return '';
  };

  // Synthesize Statutory Circulars & Notifications dynamically from actual content
  const regThemes: string[] = [];
  activeRegs.forEach((r) => {
    const cleanRegTitle = (r.title || '')
      .replace(/&#038;/g, '&')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .trim();
    if (!cleanRegTitle) return;

    const numStr = r.number ? ` (${r.number})` : '';
    const impact = cleanRegImpact(r);

    if (impact) {
      regThemes.push(
        `pivotal guidance on "${cleanRegTitle}"${numStr}, mandating that ${impact}`
      );
    } else {
      regThemes.push(
        `pivotal guidance on "${cleanRegTitle}"${numStr}`
      );
    }
  });

  const judicialSummary =
    caseThemes.length > 0
      ? `On the judicial front, this edition spotlights landmark precedents, notably ${caseThemes.slice(0, 2).join('; alongside ')}.`
      : 'On the judicial front, this edition analyzes critical judicial decisions reinforcing procedural due process, natural justice, and taxpayer safeguards under GST.';

  const regulatorySummary =
    regThemes.length > 0
      ? `On the regulatory canvas, the Central Board and GST authorities have issued key directives including ${regThemes.slice(0, 2).join(' alongside ')}.`
      : 'On the regulatory canvas, recent circulars and administrative instructions emphasize compliance reconciliation, audit preparedness, and standard operating procedures.';

  return `We present this edition of Garv GST Pulse for ${editionMonth}, delivering essential indirect tax intelligence, judicial jurisprudence, and statutory compliance updates. ${judicialSummary} ${regulatorySummary} Corporate leadership, CFOs, and tax heads are advised to align internal enterprise systems with these evolving benchmarks and review the compliance calendar to ensure seamless statutory adherence.`;
}

export const createDefaultNewsletter = (
  cases: GSTCaseLaw[],
  regs: GSTRegulatoryUpdate[],
  profile: PractitionerProfile = DEFAULT_PRACTITIONER_PROFILE
): NewsletterContent => {
  const selectedCases = cases.filter((c) => c.selectedForNewsletter).slice(0, 3);
  const selectedRegs = regs.filter((r) => r.selectedForNewsletter).slice(0, 3);
  const dailyVolumeNo = getDailySerialVolumeAndIssue();
  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const dynamicEditorial = generateExecutiveTaxEditorial(selectedCases, selectedRegs, currentMonth);

  return {
    id: `gst-newsletter-${Date.now()}`,
    title: 'Garv GST Pulse',
    subtitle: 'Landmark Precedents • Statutory Notifications & Circulars • Compliance Due Dates',
    editionMonth: currentMonth,
    volumeNo: dailyVolumeNo,
    generatedDate: getFormattedCurrentDate(),
    badgeText: 'Official Client Guidance',
    editorialHeading: "Executive Tax Editorial & Practitioner's Desk",
    editorialNote: dynamicEditorial,
    casesHeading: 'Landmark Judicial Precedents & Case Laws',
    caseLaws: selectedCases,
    regulatoryHeading: 'Key CBIC Notifications, Circulars & Advisories',
    regulatoryUpdates: selectedRegs,
    calendarHeading: 'Statutory Compliance Calendar',
    dueDates: DEFAULT_COMPLIANCE_DUE_DATES,
    checklistHeading: "Practitioner's Action Checklist for Taxpayers",
    clientActionPoints: INITIAL_ACTION_POINTS,
    disclaimerHeading: 'Statutory Confidentiality & Legal Disclaimer',
    disclaimerText:
      'Disclaimer: This newsletter is compiled for confidential internal circulation only for general informational guidance. It does not constitute formal tax opinion or substitute for specific professional advice on individual transactions. While all care is taken to verify citations and official notifications, taxpayers must consult our office before taking operational tax positions.',
    footerNote: 'Monthly GST Intelligence & Jurisprudence Bulletin',
    confidentialBanner: 'CONFIDENTIAL INTERNAL CIRCULATION ONLY',
    verificationStatus: 'DRAFT',
  };
};

/**
 * Generates an authentic Microsoft Word (.docx) document strictly formatted into 2 Pages.
 */
export async function generateDocxBlob(
  newsletter: NewsletterContent,
  profile: PractitionerProfile
): Promise<Blob> {
  const navyColor = '1E3A8A'; // Deep Corporate Navy
  const charcoalColor = '1F2937';
  const slateGray = '4B5563';
  const amberColor = 'B45309';
  const lightBg = 'F3F4F6';

  // Embed Logo image into docx if available
  let logoParagraph: Paragraph | null = null;
  try {
    const logoDataUrl = getGarvLogoDataUrl();
    if (logoDataUrl) {
      const base64 = logoDataUrl.split(',')[1];
      if (base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        logoParagraph = new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 60 },
          children: [
            new ImageRun({
              data: bytes,
              transformation: {
                width: 220,
                height: 50,
              },
              type: 'png',
            }),
          ],
        });
      }
    }
  } catch (e) {
    console.warn('Could not embed logo in docx', e);
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.45),
              bottom: convertInchesToTwip(0.45),
              left: convertInchesToTwip(0.55),
              right: convertInchesToTwip(0.55),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `${newsletter.title} | ${newsletter.editionMonth}`,
                    size: 15,
                    color: slateGray,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `${(newsletter.footerNote || 'MONTHLY GST INTELLIGENCE & JURISPRUDENCE BULLETIN').toUpperCase()}  •  ${(newsletter.confidentialBanner || 'CONFIDENTIAL INTERNAL CIRCULATION ONLY').toUpperCase()}  •  ${newsletter.title}`,
                    size: 13,
                    color: slateGray,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // ================= PAGE 1 =================
          // True Newsletter Publication Heading (Garv GST Pulse - Starts directly as newsletter)
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 20, after: 20 },
            children: [
              new TextRun({
                text: newsletter.title.toUpperCase(),
                bold: true,
                size: 40,
                color: navyColor,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: newsletter.subtitle || 'Landmark Precedents • Statutory Notifications & Circulars • Compliance Due Dates',
                size: 17,
                color: slateGray,
                font: 'Calibri',
              }),
            ],
          }),

          // Newsletter Edition & Issue Banner Bar (No date on top)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 36, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: '1E3A8A' },
                    margins: { top: 80, bottom: 80, left: 140, right: 140 },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.LEFT,
                        children: [
                          new TextRun({
                            text: newsletter.generatedDate.toUpperCase(),
                            bold: true,
                            size: 16,
                            color: 'FFFFFF',
                            font: 'Calibri',
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 36, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: '1E3A8A' },
                    margins: { top: 80, bottom: 80, left: 140, right: 140 },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: newsletter.volumeNo.toUpperCase(),
                            bold: true,
                            size: 16,
                            color: 'E0E7FF',
                            font: 'Calibri',
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 28, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: '0F172A' },
                    margins: { top: 80, bottom: 80, left: 140, right: 140 },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                          new TextRun({
                            text: (newsletter.badgeText || 'OFFICIAL CLIENT GUIDANCE').toUpperCase(),
                            bold: true,
                            size: 15,
                            color: 'FDE68A',
                            font: 'Calibri',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // Editorial Note
          new Paragraph({
            spacing: { before: 160, after: 60 },
            children: [
              new TextRun({
                text: (newsletter.editorialHeading || "PRACTITIONER'S DESK & EXECUTIVE OVERVIEW").toUpperCase(),
                bold: true,
                size: 20,
                color: navyColor,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 160 },
            children: [
              new TextRun({
                text: newsletter.editorialNote,
                size: 19,
                color: charcoalColor,
                font: 'Calibri',
              }),
            ],
          }),

          // Landmark GST Case Laws
          new Paragraph({
            spacing: { before: 140, after: 80 },
            children: [
              new TextRun({
                text: (newsletter.casesHeading || 'LANDMARK JUDICIAL PRECEDENTS & CASE LAWS').toUpperCase(),
                bold: true,
                size: 20,
                color: navyColor,
                font: 'Calibri',
              }),
            ],
          }),

          ...newsletter.caseLaws.flatMap((cl, idx) => [
            new Paragraph({
              spacing: { before: 80, after: 40 },
              children: [
                new TextRun({
                  text: `${idx + 1}. ${cl.title}`,
                  bold: true,
                  size: 20,
                  color: charcoalColor,
                  font: 'Calibri',
                }),
                new TextRun({
                  text: cl.sectionsInvolved
                    ? `  [Citation: ${cl.citation} | Ref: ${cl.tmiReference} | ${cl.sectionsInvolved}]`
                    : `  [Citation: ${cl.citation} | Ref: ${cl.tmiReference}]`,
                  italics: true,
                  size: 16,
                  color: amberColor,
                  font: 'Calibri',
                }),
              ],
            }),
            new Paragraph({
              spacing: { after: 30 },
              indent: { left: 240 },
              children: [
                new TextRun({
                  text: 'Core Issue: ',
                  bold: true,
                  size: 17,
                  color: slateGray,
                }),
                new TextRun({
                  text: cl.keyIssue,
                  size: 17,
                  color: charcoalColor,
                }),
              ],
            }),
            new Paragraph({
              spacing: { after: 30 },
              indent: { left: 240 },
              children: [
                new TextRun({
                  text: 'Ruling Ratio: ',
                  bold: true,
                  size: 17,
                  color: navyColor,
                }),
                new TextRun({
                  text: cl.rulingSummary,
                  size: 17,
                  color: charcoalColor,
                }),
              ],
            }),
            new Paragraph({
              spacing: { after: 100 },
              indent: { left: 240 },
              children: [
                new TextRun({
                  text: 'Taxpayers\' Impact: ',
                  bold: true,
                  size: 17,
                  color: '059669', // Emerald
                }),
                new TextRun({
                  text: cl.practitionerTakeaway,
                  size: 17,
                  color: charcoalColor,
                }),
              ],
            }),
          ]),

          // Page 1 Bottom Footer
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: 20 },
            children: [
              new TextRun({
                text: `${(newsletter.footerNote || 'MONTHLY GST INTELLIGENCE & JURISPRUDENCE BULLETIN').toUpperCase()}  •  ${(newsletter.confidentialBanner || 'CONFIDENTIAL INTERNAL CIRCULATION ONLY').toUpperCase()}  •  Page 1 of 2`,
                size: 13,
                italics: true,
                color: slateGray,
                font: 'Calibri',
              }),
            ],
          }),

          // PAGE BREAK TO ENFORCE EXACT 2 PAGES
          new Paragraph({
            children: [new PageBreak()],
          }),

          // ================= PAGE 2 =================
          // Section: Key CBIC Notifications & Circulars
          new Paragraph({
            spacing: { before: 80, after: 80 },
            children: [
              new TextRun({
                text: (newsletter.regulatoryHeading || 'KEY CBIC NOTIFICATIONS, CIRCULARS & ADVISORIES').toUpperCase(),
                bold: true,
                size: 20,
                color: navyColor,
                font: 'Calibri',
              }),
            ],
          }),

          ...newsletter.regulatoryUpdates.flatMap((ru, idx) => [
            new Paragraph({
              spacing: { before: 60, after: 30 },
              children: [
                new TextRun({
                  text: `${idx + 1}. [${ru.type}] ${ru.number} (${ru.date}) - `,
                  bold: true,
                  size: 18,
                  color: navyColor,
                }),
                new TextRun({
                  text: ru.title,
                  bold: true,
                  size: 18,
                  color: charcoalColor,
                }),
              ],
            }),
            new Paragraph({
              spacing: { after: 30 },
              indent: { left: 200 },
              children: [
                new TextRun({
                  text: 'Summary: ',
                  bold: true,
                  size: 17,
                  color: slateGray,
                }),
                new TextRun({
                  text: ru.brief,
                  size: 17,
                  color: charcoalColor,
                }),
              ],
            }),
            new Paragraph({
              spacing: { after: 80 },
              indent: { left: 200 },
              children: [
                new TextRun({
                  text: 'Taxpayers\' Impact: ',
                  bold: true,
                  size: 17,
                  color: amberColor,
                }),
                new TextRun({
                  text: ru.impactOnTaxpayers || ru.impactOnClients || '',
                  size: 17,
                  color: charcoalColor,
                }),
              ],
            }),
          ]),

          // Section: Statutory Compliance Calendar Table
          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({
                text: `${(newsletter.calendarHeading || 'STATUTORY COMPLIANCE CALENDAR').toUpperCase()} - ${newsletter.editionMonth.toUpperCase()}`,
                bold: true,
                size: 20,
                color: navyColor,
                font: 'Calibri',
              }),
            ],
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: '1E3A8A' },
                    margins: { top: 60, bottom: 60, left: 80, right: 80 },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'Form / Return',
                            bold: true,
                            size: 17,
                            color: 'FFFFFF',
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: '1E3A8A' },
                    margins: { top: 60, bottom: 60, left: 80, right: 80 },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'Statutory Due Date',
                            bold: true,
                            size: 17,
                            color: 'FFFFFF',
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: '1E3A8A' },
                    margins: { top: 60, bottom: 60, left: 80, right: 80 },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'Applicability & Class of Taxpayers',
                            bold: true,
                            size: 17,
                            color: 'FFFFFF',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              ...newsletter.dueDates.slice(0, 6).map(
                (dd, i) =>
                  new TableRow({
                    children: [
                      new TableCell({
                        shading: {
                          type: ShadingType.CLEAR,
                          fill: i % 2 === 0 ? 'F9FAFB' : 'FFFFFF',
                        },
                        margins: { top: 50, bottom: 50, left: 80, right: 80 },
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: `${dd.form} (${dd.period})`,
                                bold: true,
                                size: 16,
                                color: charcoalColor,
                              }),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        shading: {
                          type: ShadingType.CLEAR,
                          fill: i % 2 === 0 ? 'F9FAFB' : 'FFFFFF',
                        },
                        margins: { top: 50, bottom: 50, left: 80, right: 80 },
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: dd.dueDate,
                                bold: true,
                                size: 16,
                                color: 'DC2626', // Red emphasis
                              }),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        shading: {
                          type: ShadingType.CLEAR,
                          fill: i % 2 === 0 ? 'F9FAFB' : 'FFFFFF',
                        },
                        margins: { top: 50, bottom: 50, left: 80, right: 80 },
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: dd.applicability,
                                size: 15,
                                color: slateGray,
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  })
              ),
            ],
          }),

          // Section: Practical Advisory & Action Points
          new Paragraph({
            spacing: { before: 120, after: 50 },
            children: [
              new TextRun({
                text: (newsletter.checklistHeading || "PRACTITIONER'S ACTION CHECKLIST FOR TAXPAYERS").toUpperCase(),
                bold: true,
                size: 19,
                color: navyColor,
                font: 'Calibri',
              }),
            ],
          }),

          ...newsletter.clientActionPoints.slice(0, 4).map(
            (ap) =>
              new Paragraph({
                spacing: { after: 40 },
                bullet: { level: 0 },
                children: [
                  new TextRun({
                    text: ap,
                    size: 16,
                    color: charcoalColor,
                    font: 'Calibri',
                  }),
                ],
              })
          ),

          // Professional Disclaimer
          new Paragraph({
            spacing: { before: 80, after: 60 },
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text: newsletter.disclaimerText,
                size: 13,
                italics: true,
                color: slateGray,
                font: 'Calibri',
              }),
            ],
          }),

          // Comprehensive Firm Details of GARV & Associates (Page 2 Bottom)
          ...(logoParagraph ? [logoParagraph] : []),
          new Paragraph({
            spacing: { before: 40, after: 20 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `Published for Confidential Internal Circulation by: ${profile.firmName} | ${profile.designation} (${profile.enrollmentNo})`,
                bold: true,
                size: 15,
                color: navyColor,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 20 },
            children: [
              new TextRun({
                text: `Head Office: ${profile.officeAddress}`,
                size: 13,
                color: slateGray,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 20 },
            children: [
              new TextRun({
                text: 'Firm Touchpoints: Kolkata (HQ) • Delhi • Mumbai • Bengaluru • Chennai • Guwahati (Assam)',
                size: 13,
                color: slateGray,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 30 },
            children: [
              new TextRun({
                text: `Email: ${profile.email} | Tel: ${profile.phone} | Portal: ${profile.websiteOrPortal || 'www.garvca.com'}`,
                size: 13,
                color: slateGray,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `${(newsletter.footerNote || 'MONTHLY GST INTELLIGENCE & JURISPRUDENCE BULLETIN').toUpperCase()}  •  ${(newsletter.confidentialBanner || 'CONFIDENTIAL INTERNAL CIRCULATION ONLY').toUpperCase()}  •  Page 2 of 2`,
                size: 13,
                italics: true,
                color: slateGray,
                font: 'Calibri',
              }),
            ],
          }),
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Generates an executive 2-Page PDF document matching the Word newsletter layout.
 */
export function generatePdfBlob(
  newsletter: NewsletterContent,
  profile: PractitionerProfile
): Blob {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  // Executive Color Palette
  const darkNavy = [15, 23, 42];      // #0f172a
  const royalNavy = [30, 58, 138];    // #1e3a8a
  const pillBlue = [30, 64, 175];     // #1e40af
  const lightBlueText = [191, 219, 254]; // #bfdbfe
  const charcoal = [15, 23, 42];      // #0f172a
  const bodyColor = [51, 65, 85];     // #334155
  const slateMuted = [100, 116, 139]; // #64748b
  const cardBorder = [226, 232, 240]; // #e2e8f0
  const cardBg = [248, 250, 252];     // #f8fafc
  const amberBadgeBg = [254, 243, 199]; // #fef3c7
  const amberBadgeBorder = [253, 230, 138]; // #fde68a
  const amberText = [146, 64, 14];    // #92400e
  const amberTag = [180, 83, 9];      // #b45309
  const goldText = [253, 230, 138];   // #fde68a
  const greenBg = [240, 253, 244];    // #f0fdf4
  const greenBorder = [187, 247, 208]; // #bbf7d0
  const greenText = [21, 128, 61];    // #15803d
  const dueRed = [220, 38, 38];       // #dc2626

  // Sanitizer: Replace Indian Rupee symbol (₹) with 'INR ' to avoid Latin-1 font corruption
  const sanitizeText = (str: string): string => {
    return (str || '')
      .replace(/₹/g, 'INR ')
      .replace(/•/g, '-');
  };

  // Helper to render text with line wrapping and return bottom Y
  const renderWrappedText = (
    text: string,
    x: number,
    startY: number,
    maxWidth: number,
    lineHeight: number,
    maxLines: number = 99
  ): number => {
    const lines = doc.splitTextToSize(sanitizeText(text), maxWidth);
    const toRender = lines.slice(0, maxLines);
    toRender.forEach((line: string, i: number) => {
      doc.text(line, x, startY + i * lineHeight);
    });
    return startY + toRender.length * lineHeight;
  };

  // Common Header-Rule & Footer Renderer for Page 1 & Page 2
  const renderPageFooter = (pageNum: number, totalPages: number) => {
    const footerY = pageHeight - 9;
    // Top separator rule
    doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
    doc.setLineWidth(0.35);
    doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

    // Left title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
    doc.text((newsletter.footerNote || 'MONTHLY GST INTELLIGENCE & JURISPRUDENCE').toUpperCase(), margin, footerY);

    // Center amber pill: CONFIDENTIAL INTERNAL CIRCULATION ONLY
    const pillW = 66;
    const pillH = 4.8;
    const pillX = (pageWidth - pillW) / 2;
    const pillY = footerY - 3.4;
    doc.setFillColor(amberBadgeBg[0], amberBadgeBg[1], amberBadgeBg[2]);
    doc.setDrawColor(amberBadgeBorder[0], amberBadgeBorder[1], amberBadgeBorder[2]);
    doc.roundedRect(pillX, pillY, pillW, pillH, 0.9, 0.9, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(amberText[0], amberText[1], amberText[2]);
    doc.text((newsletter.confidentialBanner || 'CONFIDENTIAL INTERNAL CIRCULATION ONLY').toUpperCase(), pageWidth / 2, footerY - 0.2, { align: 'center' });

    // Right page number
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
    doc.text(`Page ${pageNum} of ${totalPages} • ${newsletter.title}`, pageWidth - margin, footerY, {
      align: 'right',
    });
  };

  // =========================================================================
  // PAGE 1: MASTHEAD, EDITORIAL & LANDMARK PRECEDENTS
  // =========================================================================
  let y = margin + 1;

  // Masthead Title: GARV GST PULSE (Clean and unhampered by any background box)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text(newsletter.title.toUpperCase(), pageWidth / 2, y + 6.5, { align: 'center' });
  y += 9.5;

  // Subtitle / Tagline
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
  doc.text(
    newsletter.subtitle || 'Landmark Precedents - Statutory Notifications & Circulars - Compliance Due Dates',
    pageWidth / 2,
    y + 2,
    { align: 'center' }
  );
  y += 4.5;

  // Masthead Divider Line
  doc.setDrawColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);
  y += 2.2;

  // Newsletter Edition & Volume Bar (Dark Navy Pill Bar)
  const bannerH = 7.6;
  doc.setFillColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.roundedRect(margin, y, contentWidth, bannerH, 1, 1, 'F');

  // Left Date Pill (Current Date)
  const datePillW = 38;
  const datePillH = 5.2;
  const datePillX = margin + 2;
  const datePillY = y + (bannerH - datePillH) / 2;
  doc.setFillColor(pillBlue[0], pillBlue[1], pillBlue[2]);
  doc.roundedRect(datePillX, datePillY, datePillW, datePillH, 0.8, 0.8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text(newsletter.generatedDate.toUpperCase(), datePillX + datePillW / 2, y + 4.9, { align: 'center' });

  // Volume & Issue No
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(lightBlueText[0], lightBlueText[1], lightBlueText[2]);
  doc.text(newsletter.volumeNo.toUpperCase(), datePillX + datePillW + 5, y + 4.9);

  // Right: Official Client Circulation
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(goldText[0], goldText[1], goldText[2]);
  doc.text((newsletter.badgeText || 'OFFICIAL CLIENT GUIDANCE').toUpperCase(), pageWidth - margin - 4, y + 4.9, { align: 'right' });

  y += bannerH + 4;

  // Executive Tax Editorial & Practitioner's Desk
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(royalNavy[0], royalNavy[1], royalNavy[2]);
  doc.text((newsletter.editorialHeading || "EXECUTIVE TAX EDITORIAL & PRACTITIONER'S DESK").toUpperCase(), margin, y);
  y += 2.8;

  // Editorial Text in Light Gray Tinted Card
  const editorialLines = doc.splitTextToSize(`"${newsletter.editorialNote}"`, contentWidth - 8);
  const editorialH = editorialLines.length * 3.3 + 5;
  doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
  doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, editorialH, 1, 1, 'FD');

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.3);
  doc.setTextColor(bodyColor[0], bodyColor[1], bodyColor[2]);
  editorialLines.forEach((line: string, i: number) => {
    doc.text(line, margin + 4, y + 3.8 + i * 3.3);
  });
  y += editorialH + 4.5;

  // Landmark GST Case Laws & Judicial Precedents
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(royalNavy[0], royalNavy[1], royalNavy[2]);
  doc.text((newsletter.casesHeading || 'LANDMARK GST CASE LAWS & JUDICIAL PRECEDENTS').toUpperCase(), margin, y);
  y += 1.8;
  doc.setDrawColor(royalNavy[0], royalNavy[1], royalNavy[2]);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 3.5;

  // Render 3 Distinct Executive Precedent Cards
  const caseList = newsletter.caseLaws.slice(0, 3);
  caseList.forEach((cl, idx) => {
    const titleText = `${idx + 1}. ${cl.title}`;
    const titleLines = doc.splitTextToSize(titleText, contentWidth - 8);
    const issueLines = doc.splitTextToSize(cl.keyIssue, contentWidth - 22);
    const ratioLines = doc.splitTextToSize(cl.rulingSummary, contentWidth - 22);
    const impactLines = doc.splitTextToSize(cl.practitionerTakeaway, contentWidth - 36);

    // Compute dynamic height for the card
    const titleH = titleLines.length * 3.6;
    const citationH = 3.6;
    const issueH = Math.min(issueLines.length, 3) * 3.2;
    const ratioH = Math.min(ratioLines.length, 3) * 3.2;
    const impactH = Math.min(impactLines.length, 2) * 3.2 + 3.5;
    const cardHeight = titleH + citationH + issueH + ratioH + impactH + 11;

    // Card background & border
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, cardHeight, 1.2, 1.2, 'FD');

    let curY = y + 4;

    // Case Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
    titleLines.forEach((tl: string, i: number) => {
      doc.text(tl, margin + 4, curY + i * 3.6);
    });
    curY += titleH;

    // Citation tag
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(amberTag[0], amberTag[1], amberTag[2]);
    const citationTag = cl.sectionsInvolved
      ? `[${cl.citation} | Ref: ${cl.tmiReference} | ${cl.sectionsInvolved}]`
      : `[${cl.citation} | Ref: ${cl.tmiReference}]`;
    doc.text(citationTag, margin + 4, curY);
    curY += 3.8;

    // Key Issue
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(royalNavy[0], royalNavy[1], royalNavy[2]);
    doc.text('Issue: ', margin + 4, curY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(bodyColor[0], bodyColor[1], bodyColor[2]);
    issueLines.slice(0, 3).forEach((il: string, i: number) => {
      doc.text(il, margin + 15, curY + i * 3.2);
    });
    curY += issueH + 1.2;

    // Ratio Decidendi
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(royalNavy[0], royalNavy[1], royalNavy[2]);
    doc.text('Ratio: ', margin + 4, curY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(bodyColor[0], bodyColor[1], bodyColor[2]);
    ratioLines.slice(0, 3).forEach((rl: string, i: number) => {
      doc.text(rl, margin + 15, curY + i * 3.2);
    });
    curY += ratioH + 2;

    // Taxpayers' Impact (Styled Green Callout Box)
    const impactBoxW = contentWidth - 8;
    const impactBoxH = impactH;
    doc.setFillColor(greenBg[0], greenBg[1], greenBg[2]);
    doc.setDrawColor(greenBorder[0], greenBorder[1], greenBorder[2]);
    doc.roundedRect(margin + 4, curY - 2.2, impactBoxW, impactBoxH, 0.8, 0.8, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.1);
    doc.setTextColor(greenText[0], greenText[1], greenText[2]);
    doc.text("Taxpayers' Impact: ", margin + 6, curY + 1.2);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
    impactLines.slice(0, 2).forEach((ipl: string, i: number) => {
      doc.text(ipl, margin + 33, curY + 1.2 + i * 3.2);
    });

    y += cardHeight + 3.2;
  });

  // Render Page 1 Footer
  renderPageFooter(1, 2);

  // =========================================================================
  // PAGE 2: STATUTORY CIRCULARS, CALENDAR & FIRM SIGN-OFF
  // =========================================================================
  doc.addPage('a4', 'portrait');
  let y2 = margin + 1;

  // Page 2 Mini Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(royalNavy[0], royalNavy[1], royalNavy[2]);
  doc.text(`${newsletter.title.toUpperCase()} - ${(newsletter.calendarHeading || 'STATUTORY COMPLIANCE & ADVISORY').toUpperCase()}`, margin, y2 + 3);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
  doc.text(newsletter.generatedDate.toUpperCase(), pageWidth - margin, y2 + 3, { align: 'right' });
  y2 += 4.5;

  doc.setDrawColor(royalNavy[0], royalNavy[1], royalNavy[2]);
  doc.setLineWidth(0.4);
  doc.line(margin, y2, pageWidth - margin, y2);
  y2 += 3.5;

  // Section 1: Key CBIC Notifications, Circulars & Advisories
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(royalNavy[0], royalNavy[1], royalNavy[2]);
  doc.text((newsletter.regulatoryHeading || 'KEY CBIC NOTIFICATIONS, CIRCULARS & ADVISORIES').toUpperCase(), margin, y2);
  y2 += 2.8;

  newsletter.regulatoryUpdates.slice(0, 3).forEach((ru, idx) => {
    const cardW = contentWidth;
    const titleLines = doc.splitTextToSize(ru.title, cardW - 8);
    const briefLines = doc.splitTextToSize(ru.brief, cardW - 8);
    const impactText = ru.impactOnTaxpayers || ru.impactOnClients || '';
    const impactLines = doc.splitTextToSize(impactText, cardW - 38);

    const titleH = titleLines.length * 3.2;
    const briefH = Math.min(briefLines.length, 3) * 3.1;
    const impactH = Math.min(impactLines.length, 2) * 3.1 + 3.2;
    const cardH = 5 + titleH + briefH + impactH + 5;

    // Card background
    doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
    doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y2, cardW, cardH, 1, 1, 'FD');

    let subY = y2 + 3.6;

    // Header line: Number + Type + Date
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(royalNavy[0], royalNavy[1], royalNavy[2]);
    doc.text(`${idx + 1}. [${ru.type}] ${ru.number}`, margin + 4, subY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
    doc.text(`Dated: ${ru.date}`, margin + cardW - 4, subY, { align: 'right' });
    subY += 3.6;

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
    titleLines.forEach((tl: string, i: number) => {
      doc.text(tl, margin + 4, subY + i * 3.2);
    });
    subY += titleH + 0.8;

    // Brief
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(bodyColor[0], bodyColor[1], bodyColor[2]);
    briefLines.slice(0, 3).forEach((bl: string, i: number) => {
      doc.text(bl, margin + 4, subY + i * 3.1);
    });
    subY += briefH + 1.5;

    // Taxpayers' Impact Callout
    doc.setFillColor(amberBadgeBg[0], amberBadgeBg[1], amberBadgeBg[2]);
    doc.setDrawColor(amberBadgeBorder[0], amberBadgeBorder[1], amberBadgeBorder[2]);
    doc.roundedRect(margin + 4, subY - 2.2, cardW - 8, impactH, 0.8, 0.8, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(amberText[0], amberText[1], amberText[2]);
    doc.text("Taxpayers' Impact: ", margin + 6, subY + 1);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
    impactLines.slice(0, 2).forEach((ipl: string, i: number) => {
      doc.text(ipl, margin + 35, subY + 1 + i * 3.1);
    });

    y2 += cardH + 2.5;
  });

  y2 += 1.5;

  // Section 2: Statutory Compliance Calendar Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(royalNavy[0], royalNavy[1], royalNavy[2]);
  doc.text(`${(newsletter.calendarHeading || 'STATUTORY COMPLIANCE CALENDAR').toUpperCase()} - ${newsletter.editionMonth.toUpperCase()}`, margin, y2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(dueRed[0], dueRed[1], dueRed[2]);
  doc.text('Strict Filing Deadlines', pageWidth - margin, y2, { align: 'right' });
  y2 += 2.8;

  // Table dimensions
  const col1W = 50;  // Form / Return
  const col2W = 38;  // Statutory Due Date
  const col3W = contentWidth - col1W - col2W; // 94mm - Class of Taxpayers & Applicability
  const rowH = 5.2;

  // Table Header
  doc.setFillColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.roundedRect(margin, y2, contentWidth, rowH, 0.8, 0.8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(255, 255, 255);
  doc.text('Form / Return', margin + 3, y2 + 3.6);
  doc.text('Statutory Due Date', margin + col1W + 3, y2 + 3.6);
  doc.text('Class of Taxpayers & Applicability', margin + col1W + col2W + 3, y2 + 3.6);
  y2 += rowH;

  // Table Rows (6 entries)
  newsletter.dueDates.slice(0, 6).forEach((dd, i) => {
    // Alternating rows
    if (i % 2 === 0) {
      doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
    doc.setLineWidth(0.25);
    doc.rect(margin, y2, contentWidth, rowH, 'FD');

    // Vertical column divider lines
    doc.line(margin + col1W, y2, margin + col1W, y2 + rowH);
    doc.line(margin + col1W + col2W, y2, margin + col1W + col2W, y2 + rowH);

    // Form name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
    const formStr = `${dd.form} (${dd.period})`;
    doc.text(doc.splitTextToSize(formStr, col1W - 5)[0], margin + 3, y2 + 3.6);

    // Due Date
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(dueRed[0], dueRed[1], dueRed[2]);
    doc.text(dd.dueDate, margin + col1W + 3, y2 + 3.6);

    // Applicability (With Indian Rupee symbol replaced to prevent Latin-1 encoding distortion)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(bodyColor[0], bodyColor[1], bodyColor[2]);
    const appStr = sanitizeText(dd.applicability);
    doc.text(doc.splitTextToSize(appStr, col3W - 5)[0], margin + col1W + col2W + 3, y2 + 3.6);

    y2 += rowH;
  });

  y2 += 3.5;

  // Section 3: Practitioner's Action Checklist for Taxpayers
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(royalNavy[0], royalNavy[1], royalNavy[2]);
  doc.text((newsletter.checklistHeading || "PRACTITIONER'S ACTION CHECKLIST FOR TAXPAYERS").toUpperCase(), margin, y2);
  y2 += 2.8;

  newsletter.clientActionPoints.slice(0, 4).forEach((ap) => {
    // Solid circular bullet
    doc.setFillColor(royalNavy[0], royalNavy[1], royalNavy[2]);
    doc.circle(margin + 2.5, y2 + 1.2, 0.65, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
    const apLines = doc.splitTextToSize(sanitizeText(ap), contentWidth - 7);
    apLines.slice(0, 2).forEach((line: string, i: number) => {
      doc.text(line, margin + 6, y2 + 2 + i * 3.1);
    });
    y2 += apLines.length * 3.1 + 0.8;
  });

  y2 += 2.5;

  // Section 4: Statutory Disclaimer Box
  const disclaimerLines = doc.splitTextToSize(newsletter.disclaimerText, contentWidth - 8);
  const disclaimerH = disclaimerLines.length * 2.8 + 4;
  doc.setFillColor(241, 245, 249); // #f1f5f9
  doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
  doc.roundedRect(margin, y2, contentWidth, disclaimerH, 1, 1, 'FD');

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.2);
  doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
  disclaimerLines.forEach((dl: string, i: number) => {
    doc.text(dl, margin + 4, y2 + 3.2 + i * 2.8);
  });
  y2 += disclaimerH + 3.5;

  // Section 5: Official GARV & Associates Comprehensive Sign-Off
  const signoffH = 34;
  doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
  doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
  doc.roundedRect(margin, y2, contentWidth, signoffH, 1.2, 1.2, 'FD');

  let signY = y2 + 3;

  // Embed High-Res Brand Logo with CA India Emblem
  try {
    const logoDataUrl = getGarvLogoDataUrl();
    if (logoDataUrl) {
      const logoW = 50;
      const logoH = 10.3;
      doc.addImage(logoDataUrl, 'PNG', (pageWidth - logoW) / 2, signY, logoW, logoH);
      signY += logoH + 2.5;
    }
  } catch (e) {
    console.warn('Could not embed CA logo in PDF:', e);
    signY += 4;
  }

  // Firm Name & Practice Designation
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text(
    `Published for Confidential Internal Circulation by: ${profile.firmName} | ${profile.designation} (${profile.enrollmentNo})`,
    pageWidth / 2,
    signY,
    { align: 'center' }
  );
  signY += 3.5;

  // Head Office Address
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(bodyColor[0], bodyColor[1], bodyColor[2]);
  doc.text(`Head Office: ${profile.officeAddress}`, pageWidth / 2, signY, { align: 'center' });
  signY += 3.2;

  // Touchpoints (Including Delhi)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
  doc.text(
    'Firm Touchpoints: Kolkata (HQ) - Delhi - Mumbai - Bengaluru - Chennai - Guwahati (Assam)',
    pageWidth / 2,
    signY,
    { align: 'center' }
  );
  signY += 3.2;

  // Contact & Website
  doc.text(
    `Email: ${profile.email} | Tel: ${profile.phone} | Portal: ${profile.websiteOrPortal || 'www.garvca.com'}`,
    pageWidth / 2,
    signY,
    { align: 'center' }
  );

  // Render Page 2 Footer
  renderPageFooter(2, 2);

  return doc.output('blob');
}
