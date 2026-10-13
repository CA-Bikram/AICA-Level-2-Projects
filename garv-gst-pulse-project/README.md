# Garv GST Pulse ⚖️📊
### Autonomous GST Intelligence, AI Synthesis & Practitioner Newsletter Automation

[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Google Gemini API](https://img.shields.io/badge/Google_Gemini-3.8_Flash-8E75B2?logo=google&logoColor=white)](https://ai.google.dev/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📌 Executive Summary

**Garv GST Pulse** is a full-stack, autonomous legal intelligence and publication platform engineered specifically for Chartered Accountants, GST Practitioners, and Tax Law Firms. 

In India's fast-moving Indirect Tax regime, staying compliant requires tracking dozens of High Court, Supreme Court, and GST Appellate Tribunal (GSTAT) rulings, alongside CBIC circulars and fluctuating statutory due dates. Manually curating, summarizing, and formatting these developments into professional client advisories takes practitioners 10–15 hours every week.

**Garv GST Pulse automates this entire lifecycle end-to-end**:
1. **Real-Time Legal Scraping**: Continuously tracks and extracts the latest GST court precedents, legal issues, and CBIC notifications.
2. **AI Editorial Synthesis**: Uses Google Gemini to synthesize judicial precedents into cohesive, executive-level editorial commentary and taxpayer perspectives.
3. **Automated Daily 10:00 AM Scheduler**: Triggers every morning at 10:00 AM IST to compile today's fresh edition and dispatch an executive review digest.
4. **Multi-Format Publication Engine**: Generates publication-grade Microsoft Word (`.docx`) and print-ready PDF bulletins with 2-page grid layouts, practitioner mastheads, compliance calendars, and action checklists.
5. **Permanent Drive & Cloud Archiving**: Saves generated editions to a permanent server archive with permanent web preview links.
6. **Client Directory CRM & Batch Email Broadcaster**: Manages client lists with trade categories and GSTINs, broadcasting newsletters in seconds.

---

## 🚀 Key Features & Innovations

### 1. 🔍 Real-Time TaxTMI Legal Precedent Engine
- Scrapes live court judgements across High Courts (Delhi, Karnataka, Bombay, Punjab & Haryana), GSTAT, and Supreme Court.
- Automatically extracts:
  - **Case Title & Citation** (e.g., `2026 (9) TMI 985`)
  - **Court & Bench**
  - **Relevant Statutory Sections** (e.g., Section 73, Section 75(4), Section 129, Form GST DRC-01)
  - **Key Legal Dispute**
  - **Court Ruling & Ratio Decidendi**
  - **Actionable Practitioner Takeaway**

### 2. 🤖 Gemini AI-Powered "Editorial Commentary & Perspective"
- Integrated with the **`@google/genai` SDK** (`gemini-3.8-flash` and `gemini-3.1-flash-lite`).
- Generates a 3–4 sentence executive editorial connecting judicial rulings to strategic business decisions for CFOs and tax heads.
- **Fail-Safe Fallback**: Includes a deterministic legal synthesis engine that extracts core holdings directly from scraped content if network or rate-limit spikes occur.

### 3. ⏰ 10:00 AM Unattended Automation & Multi-Transport Dispatch
- Background server daemon checking schedule every 30 seconds.
- Automatically scrapes fresh daily data every morning at **10:00 AM Indian Standard Time (IST)**.
- **Multi-Transport Email Delivery**:
  - **Primary**: Permanent 365-day Google App Password (direct SMTP over port 587) that never expires overnight.
  - **Secondary**: Google OAuth Bearer Token via Gmail API.
  - **Resilient Fallback**: Cloud Delivery Archive (`reminder_archive/`) ensuring no daily bulletin is ever lost.

### 4. 📄 Multi-Format Publication Engine
- **Word (`.docx`)**: Custom-styled document using the `docx` library with tables, colored callout cards, practitioner headers, and page layout.
- **Print-Ready PDF**: Uses `jspdf` and `html2canvas` for crisp multi-page vectors and print margins.
- **Dynamic 2-Page Layout**:
  - **Page 1**: Firm Masthead, Edition & Volume Bar, Executive Editorial Desk, Top Landmark Precedents.
  - **Page 2**: CBIC Circulars & Instructions, Statutory Compliance Calendar, Practitioner's Action Checklist, Multi-City Office Touchpoints, and Legal Disclaimer.

### 5. 👥 Client CRM & Batch Broadcaster
- Integrated client database categorized by industry (FMCG, Infrastructure, Real Estate, Pharma, Retail).
- One-click bulk paste import for email lists.
- Real-time broadcast progress indicator with automated dispatch logging.

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (React 19 SPA)                        │
│  - Interactive 2-Page Newsletter Live Preview                         │
│  - Editorial Desk Editor & Gemini AI Auto-Summarize Trigger           │
│  - TaxTMI Precedents & Circulars Selector                             │
│  - Client Directory & Bulk Dispatch Modal                             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST API
┌───────────────────────────────────▼────────────────────────────────────┐
│                       EXPRESS NODE.JS BACKEND                          │
│                                                                        │
│  ┌──────────────────────┐  ┌────────────────────────────────────────┐  │
│  │ Real-Time Scraper    │  │ Gemini AI Synthesizer                  │  │
│  │ (TaxTMI / Legal Web) │  │ (@google/genai SDK)                    │  │
│  └──────────┬───────────┘  └───────────────────┬────────────────────┘  │
│             │                                  │                       │
│  ┌──────────▼──────────────────────────────────▼────────────────────┐  │
│  │             10:00 AM Autonomous Background Scheduler            │  │
│  │   - IST Timezone Clock (Asia/Kolkata)                            │  │
│  │   - Automated Daily Scrape & Edition Builder                     │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
│                                 │                                      │
│  ┌──────────────────────────────▼───────────────────────────────────┐  │
│  │              Multi-Transport Email Dispatch Engine               │  │
│  │   1. Permanent Google App Password (SMTP :587)                   │  │
│  │   2. Google OAuth Bearer Token (Gmail API)                       │  │
│  │   3. Cloud Delivery Archive (reminder_archive/)                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 💻 Tech Stack

| Category | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Lucide React, Motion |
| **Backend** | Node.js, Express, tsx |
| **AI / LLM** | Google Gemini API (`@google/genai` TypeScript SDK) |
| **Document Generation** | `docx` v9, `jspdf` v4, `html2canvas` |
| **Email Transport** | Nodemailer (SMTP :587), Google Workspace Gmail REST API |
| **Database & Auth** | Firebase Firestore, Firebase Authentication |
| **Bundler** | Vite 8 |

---

## ⚙️ Installation & Local Setup

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** or **bun**
- A **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/)

### Step 1: Clone Repository
```bash
git clone https://github.com/your-username/garv-gst-pulse.git
cd garv-gst-pulse
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Create a `.env` file in the root directory:
```env
# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Application URL
APP_URL=http://localhost:3000

# Server Port
PORT=3000
```

### Step 4: Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Step 5: Build for Production
```bash
npm run build
npm start
```

---

## 🏆 Competition Showcase & Pitch Guide

Use this section to present the project during hackathons, innovation competitions, or technology presentations:

### 1. Problem Statement (The "Why")
> *"Indirect Tax in India is a hyper-dynamic domain. Over 1,200 notifications and 8,000 court judgments are issued annually. GST practitioners and chartered accountants spend 10+ hours every week manually reviewing case law portals, summarizing orders, designing PDF circulars, and emailing clients. A delayed notification can cost a client lakhs of rupees in blocked Input Tax Credit or unaddressed Show Cause Notices."*

### 2. The Innovation (The "How")
> *"Garv GST Pulse transforms this manual chore into an autonomous, AI-driven workflow. Every morning at 10:00 AM, the server wakes up, scrapes the latest court rulings from TaxTMI, uses Google Gemini to generate high-impact executive editorial commentary, compiles a professional 2-page publication-grade bulletin in Word and PDF, and dispatches a review digest directly to the practitioner."*

### 3. Engineering Highlights (The "Tech")
1. **Resilient Dual-Engine AI Summarization**: Server-side Gemini API integration coupled with a deterministic AST-based legal takeaway parser that guarantees zero-downtime summaries even during API spikes.
2. **Permanent 365-Day Unattended Scheduler**: Solves the common problem of OAuth token expiration by combining client Google Sign-In with permanent Google App Password SMTP delivery.
3. **Enterprise Document Compilation**: Custom programmatic XML document assembly via `docx` that creates pixel-perfect Word files suitable for Fortune 500 corporate clients.
4. **Zero-Pill Minimalist UI**: Clean, high-density desktop workflow designed specifically for legal and accounting professionals.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
