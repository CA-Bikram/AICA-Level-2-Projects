export interface TaxTMICredentials {
  userId: string;
  password?: string;
  subscriptionPlan: 'Professional' | 'Corporate' | 'Enterprise';
  lastSyncedAt?: string;
  autoSyncEnabled: boolean;
  syncFrequencyHours: number;
}

export interface GSTCaseLaw {
  id: string;
  title: string;
  citation: string;
  court: 'Supreme Court' | 'High Court' | 'GSTAT / Tribunal' | 'AAR / AAAR';
  stateOrBench: string;
  date: string;
  tmiReference: string;
  keyIssue: string;
  rulingSummary: string;
  practitionerTakeaway: string;
  category: 'Input Tax Credit' | 'Classification & Rate' | 'Refund & Inverted Duty' | 'Assessment & Notice (S.73/74)' | 'E-way Bill & Detention' | 'Registration & Cancellation';
  selectedForNewsletter: boolean;
  sourceUrl?: string;
  isRealTimeScraped?: boolean;
  sectionsInvolved?: string;
  fullAnalysis?: string;
}

export interface GSTRegulatoryUpdate {
  id: string;
  type: 'Circular' | 'Notification' | 'Advisory' | 'Instruction';
  number: string;
  date: string;
  title: string;
  brief: string;
  impactOnTaxpayers?: string;
  impactOnClients?: string;
  selectedForNewsletter: boolean;
  sourceUrl?: string;
  isRealTimeScraped?: boolean;
  issuingAuthority?: string;
  effectiveDate?: string;
  fullAnalysis?: string;
}

export interface ComplianceDueDate {
  form: string;
  description: string;
  period: string;
  dueDate: string;
  applicability: string;
}

export interface FirmTouchpoint {
  city: string;
  address: string;
}

export interface PractitionerProfile {
  practitionerName: string;
  firmName: string;
  designation: string; // e.g. "Chartered Accountants"
  enrollmentNo: string; // e.g. "Building Trust Since 1949"
  email: string;
  phone: string;
  officeAddress: string;
  websiteOrPortal?: string;
  touchpoints?: FirmTouchpoint[];
}

export interface NewsletterContent {
  id: string;
  title: string;
  subtitle?: string; // e.g. "Landmark Precedents • Statutory Notifications & Circulars • Compliance Due Dates"
  editionMonth: string; // e.g., "October 2026"
  volumeNo: string; // e.g., "Vol. 10 / Issue 10"
  generatedDate: string;
  badgeText?: string; // e.g. "Official Client Guidance"
  editorialHeading?: string; // e.g. "Executive Tax Editorial & Practitioner's Desk"
  editorialNote: string;
  casesHeading?: string; // e.g. "Landmark Judicial Precedents & Case Laws"
  caseLaws: GSTCaseLaw[];
  regulatoryHeading?: string; // e.g. "Key CBIC Notifications, Circulars & Advisories"
  regulatoryUpdates: GSTRegulatoryUpdate[];
  calendarHeading?: string; // e.g. "Statutory Compliance Calendar"
  dueDates: ComplianceDueDate[];
  checklistHeading?: string; // e.g. "Practitioner's Action Checklist for Taxpayers"
  clientActionPoints: string[];
  disclaimerHeading?: string; // e.g. "Statutory Confidentiality & Legal Disclaimer"
  disclaimerText: string;
  footerNote?: string; // e.g. "Monthly GST Intelligence & Jurisprudence Bulletin"
  confidentialBanner?: string; // e.g. "CONFIDENTIAL INTERNAL CIRCULATION ONLY"
  verificationStatus: 'DRAFT' | 'VERIFIED' | 'DISPATCHED';
  verifiedAt?: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveDocxLink?: string;
}

export interface ClientRecipient {
  id: string;
  clientName: string;
  tradeName: string;
  gstin?: string;
  email: string;
  category: 'Manufacturing' | 'IT & Services' | 'Trading & Retail' | 'Exporters' | 'General';
  active: boolean;
  lastSentAt?: string;
}

export interface DispatchLog {
  id: string;
  newsletterId: string;
  editionMonth: string;
  sentAt: string;
  totalRecipients: number;
  successfulSends: string[];
  failedSends: { email: string; reason: string }[];
  driveLinkUsed?: string;
}

export interface ReminderConfig {
  reminderTime: string; // "10:00"
  targetEmail: string;
  enabled: boolean;
  lastSentDate?: string;
}
