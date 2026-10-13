# CDRT — Project requirements and implementation brief

**Project:** Client Document Request Tracker

**Participant:** Amitava Majumder | L2 B95

## Functional requirements

Maintain client records and document requests with service, period, due date, notes and Pending/Received/Not required states. Display dashboard totals, overdue items and collection progress. Support search, filters, CSV export and editable reminder drafts for pending requests.

## Implementation requirements

Use Python’s standard library and SQLite for a local application. Build the browser interface with HTML, CSS and JavaScript. Use explicit date rules and reminder templates. Keep actual document files outside the tracker. Require no third-party packages or API keys.

## Validation requirements

Check required fields, dates, statuses and client references. Exclude closed requests from reminders and overdue counts. Preserve saved records after restart. Test CSV exports, backups, status transitions and sample-data safeguards. Record verification results in TEST_RESULTS.md.

## Version 1.1 improvements

Provide a downloadable database backup, clear stale reminder drafts when refreshed records change, and display overdue badges consistently. Include fictional sample data, setup instructions, a demonstration script and automated tests.
