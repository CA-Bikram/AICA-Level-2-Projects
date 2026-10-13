# TDS Challan Extractor & SAP Reconciliation Engine

An enterprise-grade financial technology application for extracting Indian Income Tax **Form ITNS 281 TDS Challans**, validating tax components (Tax, Surcharge, Cess, Interest, Penalty, Fee 234E), and performing automated reconciliation against **SAP ERP Payment Records** to detect and resolve statutory compliance gaps under Sections 194C, 194J, 194I, and 192.

---

## 🚀 Key Features

1. **Automated ITNS 281 Challan Extraction**:
   - Ingests PDF receipts, scanned challans, and images.
   - Extracts critical statutory attributes: Challan Number, BSR Code, Date of Payment, TAN, Major/Minor Head, Nature of Payment (e.g., 94C), CIN, and bank transaction details.
   - Full component breakdown (Tax, Surcharge, Cess, Interest, Penalty, Total) with Indian currency words-to-number parsing.

2. **SAP Payment File Importer**:
   - Parses standard SAP ERP accounting exports (FBL1N, FBL3N, J1INCHLN, F110).
   - Auto-detects columns: Document Number, Challan Reference, BSR Code, Payment Date, Tax Amount, and Gross Total.
   - Includes standard downloadable Excel template.

3. **Intelligent Financial Reconciliation Engine**:
   - **Tier 1 (Challan No + Amount)**: Exact matching down to the rupee.
   - **Tier 2 (Amount-First Match)**: If Challan No is unentered or pending in SAP ledger, matches matching payment amounts into a consolidated **`Reconciled`** line item with ₹0 variance.
   - **Discrepancy Detection**: Highlights Excess Deposits, Shortfalls (triggering Section 201(1A) warnings), and Missing Challan receipts.

4. **Statutory Excel Exports**:
   - Generates formatted **TDS Challan Summary** spreadsheets matching statutory submission standards.
   - Exports executive audit reports with KPI summaries, gap breakdowns, and actionable resolution steps.

5. **Offline Standalone Edition**:
   - Includes a self-contained single-file HTML version (`tds-challan-reconciliation-standalone.html`) that works completely offline in any web browser without server installations.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons
- **Document Processing**: PDF.js, SheetJS (XLSX)
- **AI Acceleration**: Google Gemini API (@google/genai)
- **Tooling & Build**: Vite, Express / Node.js

---

## 💻 How to Run Locally

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation & Launch

1. Clone or extract the project folder:
   ```bash
   cd tds-challan-extractor
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

5. Build for production:
   ```bash
   npm run build
   ```

---

## 📁 Project Structure

```
├── public/                     # Static assets & standalone offline tool
│   └── tds-challan-reconciliation-standalone.html
├── src/
│   ├── components/             # React UI components
│   │   ├── ChallanExtractor.tsx # TDS Challan upload & extraction table
│   │   ├── SapUploader.tsx      # SAP payment file reader & editor
│   │   ├── ReconciliationView.tsx # Reconciliation engine & audit table
│   │   ├── Navbar.tsx           # Navigation, demo loader, and export tools
│   │   ├── ConfirmModal.tsx     # In-app confirmation dialogs
│   │   └── FolderSelectorModal.tsx # Output directory selector
│   ├── data/
│   │   └── sampleData.ts        # ITNS 281 benchmark test data
│   ├── types/
│   │   └── tds.ts               # TypeScript data schemas & types
│   ├── utils/
│   │   ├── challanParser.ts     # PDF / OCR & words-to-number parser
│   │   ├── excelGenerator.ts    # SheetJS XLSX builder & SAP file parser
│   │   └── reconciliationEngine.ts # Multi-tier financial matching logic
│   ├── App.tsx                  # Main application orchestrator
│   └── main.tsx                 # React DOM entry point
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```
