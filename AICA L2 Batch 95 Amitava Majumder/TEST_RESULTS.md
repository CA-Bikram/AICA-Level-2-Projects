# Verification record

**CDRT v1.1 | Amitava Majumder | L2 B95 | 4 October 2026**

## Automated verification

Command: `python -m unittest discover -s tests -v`

Result: **25 tests passed** using Python's built-in unittest runner.

Covered:

- Yesterday/today/tomorrow boundaries for Pending requests.
- Received and Not required records never becoming overdue.
- Invalid dates, blank required values, unknown clients and invalid status values.
- Duplicate client names.
- Records persisting when the database is reopened.
- Received date retention on editing and clearing on reopening.
- Reminder drafts excluding closed requests and rejecting clients with no pending items.
- Sample data counts and protection against overwriting an existing workspace.
- Request deletion without removing the client, and missing-record handling.
- Correct CSV quoting and spreadsheet formula protection.
- Serving the interface and assets, and client/request creation through the HTTP API.
- Export response containing the requested records.
- Local Host checks, per-launch write tokens and malformed request handling.
- Downloadable backups, database integrity after restoring a backup, independent snapshots, and rejection of backup requests without a session token.

JavaScript syntax check: `node --check static/app.js` passed. Node is used only for development verification and is not required to run CDRT.

## Browser workflow checks

Using a separate temporary demonstration database:

- Loaded the sample workspace and confirmed 8 total, 5 pending, 2 overdue, 2 received, 1 not required, and 29% collection progress.
- Applied the Overdue filter and confirmed it displayed two records.
- Marked the ABC Traders bank statement Received and generated its reminder: the draft contained only the still-pending purchase invoices.
- Added a fictional client and a Cash book request through the forms.
- Searched for that client and confirmed the register showed one matching row.
- Reloaded the browser and confirmed saved records and updated dashboard totals persisted.
- Inspected the narrow and desktop layouts and found no page-level overlap in the reviewed dashboard views.
- Checked the browser error log: no errors reported during the checked workflow.

## Fresh-package verification (v1.1)

The exact submission ZIP was extracted into a new temporary directory. It started successfully from outside its own folder, created an empty database, loaded the sample records, exported a one-record CSV, and produced a backup that passed SQLite's integrity check. After stopping and restarting the extracted application, all three clients and eight sample requests remained present. The archive contains 14 source/documentation files and no generated database or Python cache.

The updated local browser interface was reloaded and the new Back up data button was verified as present. Backup generation and restoration were tested through the API; final saving of the new backup download by each browser is not independently certified.

## User confirmation of original downloads

On 4 October 2026, the user confirmed that the requested workflow and downloads worked in their browser. This confirmation covers the CSV report and reminder text download. Additional server checks confirmed that the full CSV matched the register, a filtered export contained exactly the selected record, and the reminder contained the selected client's pending items.

## Verification limits

Clipboard copying was not independently verified end to end. The app provides editable reminder text and a text-file download as alternatives.

This is not a security audit, a cross-browser certification or a production deployment test. GitHub upload, video recording and course form submission are separate user steps.

