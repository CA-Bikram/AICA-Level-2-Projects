# CDRT demonstration — approximately five minutes

**Amitava Majumder | AICA Level 2 | L2 B95**

Keep your face visible alongside the screen recording, as requested in the course material. Use the fictional sample data. The following wording is a practice script: change it to match your own understanding and how you actually used the tools.

## 0:00–0:40 · Introduce the problem

“Hello, I am Amitava Majumder from AICA Level 2, Batch L2 B95. My capstone is CDRT, the Client Document Request Tracker. It addresses a routine office problem: knowing which client documents have been requested, which have arrived, and which need follow-up.”

## 0:40–1:20 · Show the dashboard

Open CDRT and click Load sample data if the tracker is empty. Explain the four totals, the attention list and collection progress.

“This example has eight requests. Five are pending, two received and one is not required. Two are overdue. Progress is 29 percent because two of the seven required documents have been received. Items marked not required are excluded from that percentage.”

Dates are relative to the day the sample is loaded. If you demonstrate on a later day, use the displayed counts rather than repeating the above numbers blindly.

## 1:20–2:00 · Add a request

Choose New request. Select ABC Traders (Demo), enter “Cash book”, choose Bookkeeping, enter a period, choose a due date and save.

“Every request records the client, document, service, period, due date, status and optional notes. The records remain available after restarting the app.”

## 2:00–2:50 · Update and filter

Open Document requests. Filter by Overdue. Mark the ABC Traders bank statement Received. Explain that it disappears from the overdue filter because the status is now Received. Reset the filters and show its received date.

“Overdue is calculated only for pending documents when their due date is before today. The rule uses the request status and due date.”

## 2:50–3:40 · Prepare a reminder

Open Reminder drafts. Select ABC Traders, choose a tone and generate a draft. Show that the received bank statement is absent and pending items remain. Edit the closing text and download the draft.

“The app uses templates and the pending records to prepare this message. A person reviews and sends it separately. CDRT does not send emails automatically.”

## 3:40–4:10 · Export

Open Document requests, filter to a client or status, and click Export shown rows. Open the CSV to demonstrate that the selected rows are present.

## 4:10–5:00 · Explain the build and limits

“The application uses Python, SQLite, HTML, CSS and JavaScript. The project applies concepts in application development, Python and workflow automation.

“This version is a single-user local prototype. It tracks document status rather than storing actual files. Future improvements could include bulk checklists, reminder history and controlled email integration.”

## Questions to practise

- **Where is the data stored?** In `data/cdrt.sqlite3` on the same laptop.
- **How are reminders generated?** The app combines templates with the selected client’s pending requests.
- **Why is a due-today item not overdue?** The overdue rule uses due date strictly earlier than today.
- **How is progress calculated?** Received divided by Received plus Pending; Not required is excluded.
- **How do you back it up?** Close the app, then copy its SQLite database.
- **What was tested?** Date boundaries, status transitions, saved records, reminder contents, input validation, exports and HTTP actions; see TEST_RESULTS.md.
- **What is not implemented?** Email sending, document storage and multi-user access.
