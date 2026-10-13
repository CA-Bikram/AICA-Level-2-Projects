# CDRT — Client Document Request Tracker

**Amitava Majumder · AICA Level 2 · Batch L2 B95**

A local application for tracking client document requests, spotting overdue items, and preparing reminder drafts. An AICA Level 2 capstone prototype.

## Start here

1. Extract the entire project folder if you downloaded a ZIP.
2. On Windows, double-click **START_CDRT.bat**. Keep its window open while using the app.
3. CDRT opens in your browser. If it does not, use the address printed in the application window (normally `http://127.0.0.1:8765`).
4. Choose **Load sample data** to explore three fictional clients and eight document requests. Alternatively, go to **Clients → Add client** to start with your own records.
5. Stop the app with Ctrl+C in the application window. Your records remain saved.

Requires **Python 3.10 or later**. No third-party packages, API keys, cloud accounts, or internet connection are needed to run the app. The Windows launcher also supports the bundled Codex Python runtime when available. If Python is missing, install Python from [python.org](https://www.python.org/downloads/) and enable its command-line launcher.

For a terminal, macOS, or Linux:

```text
python app.py
```

Use `python3 app.py` if that is your Python command. A busy default port automatically falls back to a free port.

## The problem

Client documents often arrive through several channels. An accountant may need to look through messages or spreadsheets to work out what was requested, what has arrived, and what needs a follow-up. CDRT maintains one small register for that workflow.

## What works in version 1

- Add and edit clients, contact people, and email addresses.
- Create and edit document requests with a service, period/reference, due date, status, and notes.
- Mark a document received with one click. Its received date is recorded automatically.
- Track Pending, Received, and Not required states.
- Derive Overdue, Due today, and Upcoming labels for pending documents.
- See dashboard totals, collection progress, and a client summary.
- Search and filter the register, then export only the displayed rows to CSV for Excel.
- Generate polite, follow-up, or firm reminder drafts containing a client's pending requests.
- Edit, copy, or download the reminder as a text file. Nothing is sent automatically.
- Save records between restarts in a local SQLite database.
- Download a complete, consistent database backup with **Back up data**.

The app tracks whether documents have been received. It does **not** upload, store, read, or verify the actual document files.

## Demonstration

The sample workspace has 8 requests: 5 Pending, 2 Received, and 1 Not required. On the day it is loaded, 2 requests are overdue and 1 is due today. Dates are generated relative to the load date, so the demonstration stays useful. Collection progress starts at 29%: 2 received divided by 7 required requests, rounded to a whole percent.

See **DEMO_SCRIPT.md** for a five-minute walkthrough and **PROJECT_REPORT.md** for the project explanation.

## How the calculations work

| Item | Rule |
|---|---|
| Overdue | Status is Pending and due date is earlier than the laptop's current date |
| Due today | Status is Pending and due date equals today |
| Upcoming | Status is Pending and due date is later than today |
| Pending total | All Pending requests, including overdue and future requests |
| Collection progress | Received / (Received + Pending) × 100, rounded; zero when there are no required requests |
| Not required | Included in total records, excluded from collection progress and reminders |
| Received date | The date the request becomes Received; retained on ordinary edits and cleared if reopened |
| Reminder contents | All Pending requests for the chosen client; Received and Not required items excluded |

The tracker uses user-entered due dates. It does not calculate statutory filing deadlines.

## Files and architecture

```text
app.py                 Python server, validation, database, reminders and CSV exports
static/index.html      Four screens and data-entry forms
static/style.css       Responsive layout and appearance
static/app.js          Browser interactions and rendering
START_CDRT.bat         Windows launcher
requirements.txt       Confirms no external Python packages are required
tests/test_app.py      Automated checks using unittest
README.md              Setup and user guide
PROJECT_REPORT.md      Capstone explanation and limitations
DEMO_SCRIPT.md         Demonstration narration
PROMPTS.md             Project requirements and implementation brief
SUBMISSION_CHECKLIST.md GitHub and video submission checklist
TEST_RESULTS.md        Verification record
data/cdrt.sqlite3      Generated on first run; not part of the submission
```

Browser → local Python HTTP server → SQLite database. The server listens only on `127.0.0.1`. It uses Python's standard library: `http.server`, `sqlite3`, `datetime`, `csv`, and `json`. The frontend uses HTML, CSS, and JavaScript with no CDN or external font dependency.

## Application logic

Reminders use templates and overdue checks use dates. The application uses explicit, testable business rules.

This applies course learning in application development and workflow automation.

## Data, backup and limitations

This is a **single-user local capstone prototype**, not a production multi-user system. There is no login, encryption, statutory deadline engine, document upload, scheduled notification, or email integration.

Click **Back up data** to download a complete SQLite snapshot while the app is running. Keep the downloaded file private and somewhere safe. Alternatively, close the app and copy `data/cdrt.sqlite3`.

To restore: stop CDRT, keep a copy of the current database, then copy your backup into the `data` folder and name it `cdrt.sqlite3`. Restart CDRT. Restore uses the backup's records instead of the current records; it does not merge them. If running with `--db`, restore to that chosen database path instead. CSV export is a review report, not a full restorable database backup. Do not edit SQLite files in a text editor.

Sample data loads only into an empty tracker and never overwrites existing records. For a separate clean demonstration, run `python app.py --db data/demo.sqlite3`. That database is separate from the normal workspace. Individual request deletion is permanent and asks for confirmation. Clients can be edited but not deleted in version 1.

Use fictional data for the public GitHub submission and recorded demonstration. Keep generated databases outside the uploaded files; `.gitignore` excludes them when using Git, but browser uploads must be checked manually.

## Verification

From the project folder:

```text
python -m unittest discover -s tests -v
```

Tests cover due-date boundaries, received/not-required behavior, input validation, persistence, reminder exclusions, sample-data safeguards, deletion, CSV formula protection, and local HTTP operations.

## Troubleshooting

- **Python is missing:** install Python 3.10+; reopen the launcher.
- **Browser opens but cannot connect:** keep the application window open and use the address it prints.
- **Session expired:** refresh the browser after restarting the server.
- **No requests shown:** clear the search and filters.
- **No reminder generated:** choose a client with at least one Pending request.
- **Clipboard unavailable:** download the reminder, or select and copy its text manually.
- **Date labels look wrong:** check the laptop date and the request due date.

## Possible future additions

Bulk requests from a checklist, controlled spreadsheet import, reminder history, document storage integration, multi-user access, and customizable reminder templates. These are future ideas, not implemented features.
