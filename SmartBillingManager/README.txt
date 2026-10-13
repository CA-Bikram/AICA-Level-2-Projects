SMART BILLING MANAGER
=====================

HOW TO START
  1. Install Python 3.9 or newer (python.org) - tick "Add Python to PATH".
  2. Double-click  Run_Smart_Billing_Manager.bat
     - First run installs PyQt6, reportlab and openpyxl (internet needed once).
     - After that it works fully offline.

FIRST STEP IN THE APP
  Click "Seller Details" and enter your trade name, address, GSTIN, logo,
  bank details and declaration. These appear on every invoice.

BUTTONS
  New / Save / Preview / Print / Export PDF / Search / Receipts / Clear / Delete
  Bill Register (Excel), Outstanding Register (Excel), Seller Details
  Shortcuts: Ctrl+N new, Ctrl+S save, Ctrl+P print, Ctrl+F search

ITEMS
  Type item, qty, rate, GST % and press "Add Item" (or Enter).
  Double-click a row (or "Edit Selected Item") to change it.

RECEIPTS
  "Receipts" records full or part payments with date, mode and note.
  Outstanding amount and status are updated automatically.

WHERE YOUR DATA IS (created automatically next to the program)
  database\invoices.json   all invoices, items, tax summary, receipts
  database\settings.json   seller details
  invoices_pdf\            exported invoice PDFs
  excel_registers\         default folder for Excel registers
  Backup: copy the "database" folder. A .bak copy is kept on every save.

MAKE AN .EXE (optional)
  Double-click Build_EXE.bat -> dist\SmartBillingManager.exe

FILES
  main.py                 start file (installs missing libraries once)
  sbm\config.py           folders and paths
  sbm\calculations.py     GST, totals, round off, amount in words
  sbm\database.py         JSON database
  sbm\pdf_generator.py    invoice PDF (reportlab)
  sbm\excel_export.py     Excel registers
  sbm\main_window.py      main screen
  sbm\dialogs.py          seller, search, receipts, preview, print
  sbm\theme.py            white / blue / red theme
