# GujRERA Site Banner Generator

**AICA Level 2 Capstone Project: case study** · Developed and automated by CA Priyank Patel (PK)

| | |
|---|---|
| **Author** | CA Priyank Patel (PK), ICAI Membership No. 166965 |
| **Batch** | AICA-L2-B46, Ahmedabad (online: 16–17 May 2026; offline: 19–21 May 2026) |
| **Domain** | Real estate regulatory compliance (GujRERA) |
| **Type** | Offline HTML tool. It fetches public data, generates a PDF and checks compliance. |

---

## 1. Background

GujRERA issued **Order No. 112-A dated 20.12.2025**, under RERA Act 2016 s.11 and s.37 read with the Gujarat RERA (General) Regulations 2017, Reg. 5. It requires every ongoing registered project to display a board, banner, hoarding or digital display at the site. The board must follow a prescribed Gujarati format (the Annexure to the order).

| Clause | Requirement |
|---|---|
| 4.3.1 | Minimum 1.20 m wide × 2.00 m high |
| 4.3.2 | Placed at the main entrance or visible from the main road, 1.50–2.00 m above ground |
| 4.3.3 | Waterproof material; white or yellow background |
| 4.3.4 | Minimum letter height 2.50 cm; colours exactly as in the sample |
| 4.3.5 | RERA registration no. and collection bank account details in red |
| 4.3.6 | QR code at least 15 × 15 cm, scannable by mobile |
| 5 | Geotagged photo of the board uploaded with every QPR |
| 6 | Non-compliance attracts penalty |
| 9 | Not required where the project's QE is uploaded and verified |

The Annexure lists the fields every board must show:

- project and promoter details
- completion date and construction use
- units per block, split into shops, offices and residences
- specifications and amenities
- RERA collection account name and number (last 4 digits only)
- project loan lender
- a QR code to the project page on GujRERA
- a 5-point public notice to allottees

## 2. The problem

A CA or finance team that handles several projects has to produce this board for each one. Done by hand, the process is slow and error-prone:

- Data sits in several places: the registration certificate, Form 3, bank letters and loan sanctions. It is copied into a design file manually.
- Formatting rules are easy to get wrong: red vs black text, a 2.5 cm minimum letter height, only the last 4 account digits, and the QR size.
- A designer and the site team go back and forth on every change, such as an extension of the completion date or a change of bank.
- A wrong board creates penalty risk and a mismatch with QPR filings.

## 3. The solution

A single HTML file that runs in Google Chrome. It needs no installation and no login, and the fonts and QR library are built in.

1. **Enter the RERA registration number** (or project name) and press Enter.
2. The tool **fetches the project's details from the GujRERA website** automatically.
3. It **builds the banner in the exact Annexure format** (Gujarati labels in black, details in red).
4. It **checks compliance with Order 112-A** live and flags anything to fix.
5. It **saves a print-ready PDF at the actual board size**, for example 244 × 305 cm.

### Fields filled automatically from GujRERA

| Banner field | GujRERA source |
|---|---|
| Project name, RERA reg. no., promoter | Project registration record |
| Promoter e-mail and mobile | Project registration record |
| Authorised signatory | Promoter profile on GujRERA |
| Completion date (including extension) | Project details |
| Units per block (shops / offices / residences) | Form 3 inventory (latest QPR) |
| Construction use (Residential / Commercial / Mix) | Derived from unit mix and project type |
| RERA collection account name and number | Collection account details |
| Project loan lender | Form 3 loan details |
| Specifications | Compiled from registered project figures: project type and description, block height, floors and lifts (where filed), built-up area, land area, carpet area, parking |
| Amenities | Common facilities marked YES in Form 1 Part B |
| QR code | Generated link to the project's public page on GujRERA |

All 15 Annexure fields are filled in automatically. The promoter's own specification document is published only as an uploaded PDF (often a scanned image), so the tool builds the specifications from registered figures and links the PDF for reference. Everything can still be edited before printing.

### How each rule is built into the tool

| Rule | How the tool handles it |
|---|---|
| Size ≥ 1.20 × 2.00 m | Board sizes from 4×7 ft to 10×12 ft. The board grows taller to fit the content, and "Find smallest width" sizes it to a height you choose. |
| Letter height ≥ 2.5 cm | Measures the printed height of Gujarati letters, English lower-case letters and digits in the embedded font, then sets the font size (about 4.7 cm) so the **smallest** letter is at least 2.5 cm. |
| Colours as per sample | Labels are fixed in black and details in red. Notice point 2 is red. The account name is in CAPITALS. |
| Reg. no. and bank details in red | Built into the template |
| Last 4 digits of the account | The number is masked automatically, e.g. `*******2204` |
| QR ≥ 15 × 15 cm | Size input with a 15 cm minimum. The QR is a vector (sharp at any size). |
| White or yellow background | Choose from a list |
| Site rules (height, waterproof, QPR photo) | Shown as a site checklist |

## 4. How it works

```
RERA reg. no.
   │
   ▼
GujRERA public search  ──► project ID
   │
   ├─► registration record   (name, promoter, e-mail, mobile)
   ├─► promoter profile      (authorised signatory)
   ├─► project details       (completion / extension date, blocks, areas, parking)
   ├─► collection account    (account name, number)
   ├─► Form 3                (units per block and use, loan lender)
   ├─► Form 1 Part B         (amenities)
   └─► public project link   (QR code)
   │
   ▼
Auto-fill form ──► Banner layout (Annexure format, sized to the letter-height rule)
   │                         │
   ▼                         ▼
Compliance checks      Chrome "Save as PDF" at actual size (vector, fonts embedded)
```

- **Technology:** plain HTML, CSS and JavaScript in one file (about 225 KB). It embeds the Noto Sans Gujarati font and a QR generator, so it works offline except for the GujRERA lookup.
- **Data:** only public GujRERA data, fetched straight from the website into your browser. The tool has no server or database, and nothing is uploaded anywhere.
- **Output:** a one-page PDF at the real board size (for example 6917 × 8646 pt = 244 × 305 cm), with text kept as vector and the font embedded. Flex printers can use it directly.

## 5. How to use

1. Open `04_Executable/GujRERA_Banner_Generator.html` in **Google Chrome**.
2. Click **Blank form**.
3. Type the **RERA registration number** and press **Enter** (or click **Fetch details from GujRERA**). If several projects match, click the right one.
4. Read the green message. It lists what was filled in and links the registration certificate and the promoter's specification PDF.
5. Review the fetched **authorised signatory**, **specifications** and **amenities**, and edit them if needed (one item per line).
6. Choose the **board size** (8 × 10 ft suits most projects), the **background** (white or yellow) and the **QR size** (at least 15 cm).
7. Check the **Order 112-A compliance** panel. Every item should show **OK**. **SITE** items are reminders for the site team.
8. Compare the details with the **registration certificate** (there is a link in the green message).
9. Click **Save banner as PDF**. In Chrome's print window, choose **Destination: Save as PDF** and keep **Background graphics** on. Then save.
10. Send the PDF to the printer for **waterproof flex** printing.
11. After installation, take a **geotagged photo** and upload it with every **QPR**.
12. Optional: **Save project data** keeps a `.json` file so you can reopen and update the banner later, for example after a date extension or a bank change.

## 6. Role of AI in this project

The project was built with the help of an AI assistant (Claude by Anthropic). The CA stayed in the loop throughout.

| Stage | What AI did | What the CA did |
|---|---|---|
| Understanding the law | Read the scanned Gujarati order, extracted every clause and the Annexure format | Confirmed the reading of the rules, including the strict letter-height test |
| Data discovery | Found GujRERA's public data sources and checked they work without login | Decided which fields can be relied on |
| Building | Wrote the tool, embedded the fonts and QR generator, built the compliance checks | Set the requirements and reviewed the output |
| Testing | Produced sample PDFs, checked page size, fonts and letter height, tested the lookup | Checked against real project certificates |

## 7. Results

- **All 15 Annexure fields** are filled in automatically from GujRERA (the first version filled 12; testing found the gaps, which were then fixed).
- **7 of the order's rules** are checked automatically, with clause references. Four site-level reminders are also shown.
- Generating the PDF takes minutes instead of rounds of back-and-forth with a designer.
- Updates are easy: re-fetch after a date extension, bank change or new QPR, and print again.
- The same tool works for any number of projects and needs no licence or installation.

## 8. Limitations and controls

- Accuracy depends on the data the promoter has filed on GujRERA. Always check the board against the registration certificate before printing.
- Specifications are compiled from registered figures, not copied from the promoter's specification document (often a scanned PDF). Review and edit them before printing.
- The GujRERA website must be reachable for the lookup. If it isn't, the form can be filled by hand.
- The letter-height test is applied strictly to the smallest printed letter, which makes boards larger than a font-size reading would. This is a deliberate, conservative choice.
- A saved project `.json` file contains the full account number, so store it securely.
- The tool supports compliance. It is not legal advice, and the Authority's interpretation is final (cl. 8).

## 9. Future scope

- Batch generation of banners for all of a group's projects from one Excel sheet
- A QPR photo checklist with geotag verification
- Templates for other states' RERA orders
- A shared web version for a team, with an approval log

## 10. Files in this folder

| Folder / file | What it is |
|---|---|
| `01_Project_Summary/Project_Summary_GujRERA_Banner_Generator.pdf` | Project summary document (this case study as a printable PDF) |
| `02_Prompts/Prompts_Used.md` | The prompts used to build the project, what the AI produced for each, and a reusable prompt template |
| `03_Examples/Sample_Banner_8x10ft.pdf` | Example output: 244 × 305 cm banner PDF (fictional data) |
| `03_Examples/Sample_Project_Data.json` | Example project data. Open it in the tool with "Open project data". |
| `03_Examples/Tool_Screenshot.png` | Screenshot of the tool with the example data |
| `04_Executable/GujRERA_Banner_Generator.html` | The tool. Open it in Google Chrome. |
| `05_Supporting_Documents/GujRERA_Order_112-A.pdf` | Source regulation: GujRERA Order No. 112-A dated 20.12.2025 |
| `05_Supporting_Documents/Order_112-A_Rules_Summary.md` | Clause-by-clause summary of the order and the Annexure format |
| `05_Supporting_Documents/GujRERA_Public_Data_Sources.md` | The public GujRERA data the tool uses |
| `README.md` | This file |

**Demo video:** submitted separately through the ICAI Google Form (YouTube unlisted or Google Drive link).

No passwords, API keys or confidential data are included. The examples use fictional data.
