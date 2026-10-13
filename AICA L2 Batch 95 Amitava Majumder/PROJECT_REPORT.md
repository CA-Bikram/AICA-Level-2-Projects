# CDRT — Client Document Request Tracker

**Prepared for: Amitava Majumder | AICA Level 2 | Batch L2 B95**

## Problem statement

Accountants and CA offices repeatedly request bank statements, invoices, registers, and supporting records from clients. When requests are tracked across messages and spreadsheets, it is difficult to see which documents remain outstanding. Repeated manual follow-ups also take time.

## Objective

Build a small application that maintains a client-wise document register, makes pending and overdue requests visible, and prepares accurate reminder drafts for human review.

## Intended users

An individual accountant, audit assistant, or CA office staff member using a local computer. Version 1 has one local workspace and no user-role system.

## Scope and workflow

1. Create a client with optional contact details.
2. Record a requested document, service, period, and due date.
3. Mark the request Pending, Received, or Not required.
4. Review dashboard metrics and the filtered document register.
5. Generate a reminder draft for a chosen client.
6. Review and copy/download the draft, or export the register to CSV.
7. Download a consistent SQLite backup for safekeeping.

This is a status register, not a document storage system. The accountant continues using their existing channels to receive document files.

## Technologies

| Technology | Purpose |
|---|---|
| Python standard library | Local server, validation, calculations and exports |
| SQLite | Persistent client and request records |
| HTML and CSS | Forms, dashboard and responsive presentation |
| JavaScript | Search, filters, form actions and downloads |

No API key or third-party Python package is required. The app runs locally in a browser and saves its database on the same computer.

## Course learning applied

- **Application development:** turning a business problem into requirements, source code and tests.
- **Python fundamentals:** functions, dictionaries, input validation, date arithmetic, file output and database queries.
- **Web application development:** browser interface, local HTTP API, and persistent storage.
- **Workflow automation:** deriving overdue status and assembling reminder text from live records.
- **Data presentation:** dashboard totals, progress indicator, status labels, and downloadable reports.

The application uses deterministic business rules for status calculations and reminder templates.

## Data model

**Clients:** ID, name, email, contact person.

**Requests:** ID, client ID, document, service, period/reference, due date, status, notes, received date and creation date. Each request references one existing client. Overdue labels and days overdue are calculated when the app reads the records, rather than stored as values that become stale.

## Controls and checks

- Required fields and valid calendar dates are checked by the server.
- Duplicate client names are rejected without regard to letter case for ordinary ASCII names.
- Received and Not required items cannot appear as overdue or in reminder drafts.
- Sample records load only into an empty database.
- Request deletion asks for confirmation.
- CSV cells beginning with formula-like characters are exported as text.
- User-entered values are escaped before being rendered in the browser.
- Database queries use parameters rather than concatenated user input.
- The server binds to the local computer; write actions require a per-launch token.

These controls support a local demonstration. They do not make the application suitable for public internet hosting or shared office use without additional work.

## Expected benefits

The intended benefits are better visibility of missing records, less repeated typing in reminders, and an exportable collection register. Time savings have not been measured in a real office, so no numerical productivity claim is made.

## Testing and example

The supplied fictional sample contains three clients and eight requests. On loading day, five are pending, two received, and one not required. Two pending items are overdue and one is due today. Automated tests verify the business rules and local HTTP API. See TEST_RESULTS.md for the actual verification record.

## Limitations and future scope

No automatic email sending, scheduled alerts, document contents verification, attachments, authentication, user roles, audit history, or statutory deadline calculation is implemented. The database is stored locally without encryption. Future versions could add controlled CSV imports, reusable checklists, reminder history, and customizable reminder templates.

## Conclusion

CDRT demonstrates a complete, limited workflow from recording a client request to reviewing outstanding documents and preparing a reminder. It uses transparent, testable rules and can be demonstrated locally without external services.
