"""
bcm_config.py - one place to describe every open-item "slide" of the BCM dashboard.

Each SECTION tells the app
  * which Excel sheet(s) hold the data          -> "sheets"  (matched ignoring case/spaces/_)
  * which columns to read                       -> "fields"  (each with a list of header aliases)
  * how to pivot it, in the same style as the BCM PowerPoint slides
        rows     : row fields, outer -> inner (merged cells like an Excel pivot)
        column   : field whose values become the column buckets (or None)
        metrics  : ("count", label) and/or ("sum", label) shown for every bucket
  * units, guidance text and side cards shown on the slide.

If a sheet in your Excel uses a different heading, just add it to the alias list of that field.
"""

# Common aliases ---------------------------------------------------------------
SUBZONE = ["Sub Zone", "SubZone", "Sub-Zone", "Sub Zone as Sender/receiver", "Sub Zone as Sender/Receiver",
           "ZONE_C", "Zone_C", "ZONE C", "Contr. Zone", "Controlling Zone", "Zone"]
SBU = ["SBU", "Business Unit", "BU"]
AMOUNT = ["Amount", "Amount in Rs", "Amount (Rs)", "Value", "Open Amount", "Net Amount", "Gross Amount",
          "Amount in local currency", "Amount in LC", "Amt", "Rs"]
POSTING_DATE = ["Posting Date", "Document Date", "Doc Date", "Entry Date", "Date", "Created On", "Creation Date"]

# Ordered bucket lists (anything not listed is placed after, in date / numeric order)
GRN_PERIODS = ["Upto Mar 2024", "2024-2025", "Apr-25 to Sep-25", "Oct-25 to Mar-26", "Apr-26 to June-26",
               "Apr-26", "May-26", "June-26 Onwards"]
VIT_AGES = ["> 6 months", "90-180 days", "45-90 days", "30-45 days", "0-30 days"]  # oldest first, as on the slide
AMTA_STATUS = ["PENDING FOR DISPATCH", "DRAFT", "ERROR", "DISPATCHED", "RECEIVER L1", "RECEIVER L2"]
FA_STATUS = ["DISPOSED OFF", "TO BE WRITTEN OFF", "TRANSFERRED"]
ROAD_AGES = ["<1 Year", "1-2 Year", "2-3 Year", "3-5 Year", ">5 Year"]
MSTC_AGES = ["0-30", "30-60", ">60"]

FA_ACTIONS = [
    ("Disposed off", "During the verification process, verifying officer selected the option disposed off but the same "
                     "asset is appearing active in the system. Kindly <b>take the necessary action for disposal</b> of "
                     "such assets from the system at the earliest."),
    ("To be Written Off", "During the verification process, verifying officer selected the option of \"to be written off\" "
                          "but the same asset is appearing in the system. Request you to initiate necessary action as per "
                          "EAM and <b>take up with your SBU commercial for asset related accounting in SAP</b> at the earliest."),
    ("Transferred", "In case an asset has been transferred from one location to another, request you to <b>prepare the "
                    "AMTA</b> for the same and provide the details of both the sending and receiving locations, along "
                    "with the AMTA reference number. If already completed then please confirm the same."),
]

AMTA_ACTIONS = {
    "PENDING FOR DISPATCH": "Creator need to be cancel it or complete the invoice printing from Pending for Dispatch radio button",
    "DRAFT": "Creator need to process further or Cancel it",
    "ERROR": "Pls reapprove it with current date and if after this also receiving document no not generated then raise a ITSM",
    "DISPATCHED": "Receipt to be completed by the L1 and L2 receiver",
    "RECEIVER L1": "Receipt to be completed by the L2 receiver",
}

# -----------------------------------------------------------------------------
# SECTIONS
#   type "pivot"   : grouped pivot with buckets (most slides)
#   type "listing" : line-item table with merged group cells + numeric totals (CWIP)
#   type "summary" : location summary with computed % (Fixed Asset verification)
# amount units: "lakhs" | "rupees" | "crores"   (source = as in Excel, display = on screen)
# -----------------------------------------------------------------------------
SECTIONS = [
    dict(
        key="grn", agenda="Open GRN / SRNs", title="Open GRN / SRNs (RNV)", icon="grn",
        sheets=["Open_GRN", "Open GRN", "GRN", "GRN_SRN", "Open GRN SRN"],
        fields=dict(
            subzone=SUBZONE, sbu=SBU,
            msme=["MSME?", "MSME", "MSME Classfication", "MSME Classification", "MSME Status"],
            pc=["Profit center Decrip", "Profit Center Decrip", "Profit center Description", "Profit Center Name",
                "Profit Centre Name", "Plant Name"],
            period=["Period as per Posting Date", "Period/Year", "Period", "Ageing", "Age Bucket"],
            amount=["Rs. In Lakhs", "Rs In Lakhs", "Amount in Lakhs", "Amount Rs Lakhs"] + AMOUNT,
            date=["GRN Posting Date"] + POSTING_DATE,
            vendor=["Vendor Name", "Supplier Name"],
        ),
        transforms=dict(msme="msme"),
        derive=dict(fy=("fy_from", "date")),
        rows=[("subzone", "SubZone"), ("sbu", "SBU"), ("msme", "MSME?"), ("pc", "Profit center Decrip")],
        column=("period", GRN_PERIODS, "asc"),
        metrics=[("count", "Nos"), ("sum", "Rs. In Lakhs")],
        amount_source="lakhs", amount_display="lakhs",
        filters=["fy"],
        note="Review for timely clearance of Open GRNs / SRNs and, if the same is not required for payment, "
             "please arrange to reverse the GRN with the concerned team.",
    ),
    dict(
        key="vitprf", agenda="Open PRF / VIT", title="Open PRF / VIT", icon="invoice",
        sheets=["VIT_PRF", "VIT PRF", "PRF_VIT", "Open VIT", "Open PRF", "Open PRF VIT"],
        fields=dict(
            subzone=SUBZONE, sbu=SBU,
            plant=["Plant Name", "Profit center Decrip", "Profit Center Name", "Location"],
            age=["Ageing", "Age Bucket", "Ageing Bucket", "Period as per Posting Date", "Period"],
            fy=["Financial Year", "FY", "Fiscal Year"],
            days=["No. of days", "Days", "Age (Days)"],
            amount=["Gross Amount"] + AMOUNT,
            date=["VIT/PRF Posting Date", "VIT Posting Date", "PRF Posting Date"] + POSTING_DATE,
            vendor=["Vendor Name", "Supplier Name"],
        ),
        transforms=dict(age="vit_age"),
        derive=dict(fy=("fy_from", "date"),
                    age=("days_bucket", "days", "date", [(30, "0-30 days"), (45, "30-45 days"), (90, "45-90 days"),
                                                         (180, "90-180 days"), (None, "> 6 months")])),
        rows=[("subzone", "SubZone"), ("sbu", "SBU"), ("plant", "Plant Name")],
        column=("age", VIT_AGES, "desc"),
        metrics=[("count", "Nos")],
        amount_source="rupees", amount_display="rupees",
        filters=["fy"],
        note="Open PRFs / VITs are to be processed promptly; items ageing beyond 45 days need immediate attention.",
    ),
    dict(
        key="fa_disc", agenda="Fixed Assets – Discrepancies", title="Fixed Assets Verification: Discrepancies",
        icon="asset",
        sheets=["FA_Discrepancy", "FA_Discrepancies", "FAV_Discrepancy", "FA Discrepancies", "Asset Discrepancies"],
        fields=dict(
            subzone=SUBZONE, sbu=SBU,
            location=["ERP_LOCNNAME", "Location Name", "Location", "Plant Name"],
            status=["Status", "Verification Status", "Remarks"],
            asset=["ERP_ASSETNO", "Asset No", "Asset Number", "Asset"],
        ),
        transforms=dict(status="upper"),
        rows=[("subzone", "SubZone"), ("sbu", "SBU"), ("location", "ERP_LOCNNAME")],
        column=("status", FA_STATUS, "asc"),
        metrics=[("count", "Count of ERP_ASSETNO")],
        actions=FA_ACTIONS,
    ),
    dict(
        key="fa_status", agenda="Fixed Assets – Verification status", title="Fixed Assets Verification", icon="clipboard",
        type="summary",
        sheets=["FA_Verification", "FAV_Status", "FA Verification", "Fixed Asset Verification", "FA_Status"],
        fields=dict(
            subzone=SUBZONE,
            location=["Location Name", "ERP_LOCNNAME", "Location", "Plant Name"],
            total=["Total Items", "Total Item", "Total Assets", "Total"],
            verified=["Verified item", "Verified Items", "Verified"],
        ),
        rows=[("subzone", "SubZone"), ("location", "Location Name")],
        note="Locations with pending verification are listed first; switch on 'show fully verified' to see all.",
    ),
    dict(
        key="mstc", agenda="MSTC Commission clearing", title="Status of MSTC Commission Clearing", icon="gavel",
        sheets=["MSTC", "MSTC_Commission", "MSTC Commission", "MSTC Clearing"],
        fields=dict(
            subzone=SUBZONE, sbu=SBU,
            pc=["PC Name", "Profit Center Name", "Profit center Decrip", "Profit Center: Short Text", "Plant Name"],
            age=["Age Bracket", "Age Bracket (No. of days)", "Ageing", "Age Bucket"],
            days=["No. of days", "No of days", "Days", "Age (Days)", "Age"],
            amount=["Commission Amount", "MSTC Commission"] + AMOUNT,
            date=["Invoice Date"] + POSTING_DATE,
        ),
        derive=dict(age=("days_bucket", "days", "date", [(30, "0-30"), (60, "30-60"), (None, ">60")])),
        rows=[("subzone", "SubZone"), ("sbu", "SBU"), ("pc", "PC Name")],
        column=("age", MSTC_AGES, "asc"),
        column_caption="Age Bracket (No. of days)",
        metrics=[("sum", "Amount (Rs)")],
        amount_source="rupees", amount_display="rupees",
        bullets=["Vide Circular dtd. 20-Aug-25, guidelines were issued to ensure proper financial control and timely "
                 "accounting of expenses.",
                 "All concerned were sensitised to process MSTC invoices within 15 days of receipt of invoice, for "
                 "timely completion of MSTC commission accounting.",
                 "It is still observed that, even with time-to-time reminders, actions are pending."],
    ),
    dict(
        key="road", agenda="Open Road Claims", title="Open Road Claim", icon="truck",
        sheets=["Road_Claim", "Road Claim", "Open Road Claim", "Road Claims"],
        fields=dict(
            subzone=SUBZONE,
            pc=["Profit Center: Short Text", "Profit Center Short Text", "Profit Center Name", "Profit center Decrip",
                "Plant Name"],
            age=["Ageing", "Age Bucket", "Ageing Bucket"],
            amount=["Claim Amount"] + AMOUNT,
            date=["Claim Date"] + POSTING_DATE,
        ),
        derive=dict(age=("years_bucket", "date", [(1, "<1 Year"), (2, "1-2 Year"), (3, "2-3 Year"),
                                                   (5, "3-5 Year"), (None, ">5 Year")])),
        rows=[("subzone", "Sub Zone"), ("pc", "Profit Center: Short Text")],
        column=("age", ROAD_AGES, "asc"),
        column_caption="Ageing",
        metrics=[("sum", "Amount (Rs)")],
        amount_source="rupees", amount_display="rupees",
    ),
    dict(
        key="cwip_exp", agenda="CWIP – Expired projects", title="Open CWIP : Time Overrun – Expired Projects",
        icon="crane", type="listing",
        sheets=["CWIP_Expired", "CWIP Expired", "Expired Projects", "CWIP_Time_Overrun"],
        fields=dict(
            subzone=SUBZONE, sbu=SBU,
            location=["Controlling Location Descp", "Controlling Location", "Location"],
            project=["Project Title( project description )", "Project Title", "Project Description", "Project"],
            end_date=["End date", "End Date", "Extended End Date"],
            orig_date=["Original Completion date", "Original Completion Date", "Completion Date"],
            ar_no=["No of AR", "No. of AR", "AR Count"],
            ar_value=["AR Value (Rs in Cr)", "AR Value", "AR Value Rs Cr"],
            cum_exp=["Cum Exp Rs in Crs", "Cum Exp", "Cumulative Expenditure"],
            cum_capex=["Cum Capx (Rs in Cr)", "Cum Capex (Rs in Cr)", "Cum Capx", "Cum Capex"],
            open_cwip=["Open CWIP Rs. Crs", "Open CWIP", "Open CWIP Rs Crs"],
        ),
        group_cols=[("subzone", "Sub Zone"), ("sbu", "SBU"), ("location", "Controlling Location Descp")],
        detail_cols=[("project", "Project Title (project description)", "text"), ("end_date", "End date", "date"),
                     ("orig_date", "Original Completion date", "date")],
        num_cols=[("ar_no", "No of AR", "int"), ("ar_value", "AR Value (Rs in Cr)", "2dp"),
                  ("cum_exp", "Cum Exp Rs in Crs", "2dp"), ("cum_capex", "Cum Capx (Rs in Cr)", "2dp"),
                  ("open_cwip", "Open CWIP Rs. Crs", "2dp")],
        bullets=["As per the recent HQO guidelines strict adherence is required for review of project timelines.",
                 "All pending approvals to be obtained and no post facto approval will be permitted henceforth.",
                 "Zonal and Regions should review and submit the proposals to the competent authority and to be updated in system.",
                 "Henceforth, all extension / time overrun proposals must be initiated at least 3 months before scheduled project closure."],
    ),
    dict(
        key="cwip_60", agenda="CWIP – Expiring in 60 days", title="Open CWIP : Time Overrun – Projects about to expire in 60 days",
        icon="crane", type="listing",
        sheets=["CWIP_60", "CWIP 60 days", "CWIP_About_to_Expire", "CWIP About to Expire", "CWIP_60_Days"],
        fields=None,  # same as cwip_exp (filled below)
    ),
    dict(
        key="rfd", agenda="RFD – Assets held for sale", title="Open RFD – Assets Held for Sale > 12 M", icon="tag",
        sheets=["RFD", "Open_RFD", "Open RFD", "Assets Held for Sale", "Assets_Held_for_Sale"],
        fields=dict(
            subzone=SUBZONE, sbu=SBU,
            plant=["Plant Name", "Location", "Profit center Decrip"],
            fy=["Financial Year", "FY", "Fiscal Year", "RFD Year"],
            date=["RFD Date", "Date of RFD"] + POSTING_DATE,
            asset=["Asset No", "Asset Number", "ERP_ASSETNO", "Asset"],
        ),
        derive=dict(fy=("fy_from", "date")),
        rows=[("subzone", "Sub Zone"), ("sbu", "SBU"), ("plant", "Plant Name")],
        column=("fy", [], "asc"),
        metrics=[("count", "Nos")],
        cards=[("#E31B23", ">12 M", "Requires management review and appropriate accounting assessment."),
               ("#1E4A8A", "12 M", "Expected completion window"),
               ("#E07B00", "NO DEP.", "After classification, no depreciation / amortisation"),
               ("#1F8A5B", "ACTION", "Review / dispose – avoid indefinite holding")],
    ),
    dict(
        key="amta", agenda="Open AMTA", title="Open AMTA", icon="transfer",
        sheets=["AMTA", "Open_AMTA", "Open AMTA"],
        fields=dict(
            subzone=SUBZONE, sbu=SBU,
            status=["Status", "AMTA Status", "Document Status"],
            doc=["AMTA No", "Document No", "AMTA Number"],
        ),
        transforms=dict(status="upper"),
        rows=[("subzone", "Sub Zone as Sender/receiver"), ("sbu", "SBU")],
        column=("status", AMTA_STATUS, "asc"),
        column_actions=AMTA_ACTIONS,
        metrics=[("count", "Nos")],
        cards=[("#E31B23", "OPEN", "AMTA items – physical movement initiated"),
               ("#E07B00", "PENDING", "Receipt / deletion / approval – subsequent actions"),
               ("#0E7C86", "RECEIVE", "Closure: receipt at destination"),
               ("#E07B00", "UPDATE", "Closure: deletion / approval / SAP update")],
        note="Physical movement has been initiated; however, the subsequent actions such as receipt, deletion or approval "
             "are pending. Kindly take up the matter with the concerned teams and ensure timely completion.",
    ),
    dict(
        key="dc", agenda="Open Delivery Confirmations", title="Open Delivery Confirmations", icon="package",
        sheets=["Delivery_Confirmation", "Delivery Confirmations", "Open DC", "DC", "Open_Delivery_Confirmation"],
        fields=dict(
            subzone=SUBZONE, sbu=SBU,
            salesorg=["Sales Org Desc", "Sales Org Description", "Sales Organization", "Sales Org"],
            month=["Month", "Period"],
            date=["Delivery Date", "Billing Date", "Actual GI Date"] + POSTING_DATE,
            doc=["Delivery No", "Delivery", "Document No"],
        ),
        derive=dict(month=("month_from", "date")),
        rows=[("subzone", "Sub Zone"), ("sbu", "SBU"), ("salesorg", "Sales Org Desc")],
        column=("month", [], "asc"),
        metrics=[("count", "Nos")],
        cards=[("#2F6DB5", "01 Identify", "Review all open delivery confirmations"),
               ("#E07B00", "02 Confirm delivery", "Complete delivery confirmation where goods have been delivered.")],
    ),
    dict(
        key="other_rec", agenda="Open Other Receivables", title="Open Other Receivables", icon="wallet",
        sheets=["Other_Receivables", "Other Receivables", "Open Other Receivables", "Other_Receivable"],
        fields=dict(
            subzone=SUBZONE, sbu=SBU,
            pc=["Profit Center: Short Text", "Profit Center Short Text", "Profit Center Name", "Profit center Decrip"],
            user=["User Name2", "User Name", "Created By", "User"],
            customer=["Customer Name", "Customer", "Name of Customer"],
            entry_date=["Entry Date", "Document Date", "Posting Date", "Date"],
            amount=AMOUNT,
        ),
        derive=dict(year=("year_from", "entry_date"), entry=("date_text", "entry_date")),
        rows=[("subzone", "SubZone"), ("sbu", "SBU"), ("pc", "Profit Center: Short Text"), ("user", "User Name2"),
              ("customer", "Customer Name"), ("entry", "Entry Date")],
        column=("year", [], "asc"),
        metrics=[("sum", "Amount (Rs)")],
        amount_source="rupees", amount_display="rupees",
    ),
    dict(
        key="cash", agenda="Pending Cash Receipts", title="Pending Cash Receipts", icon="receipt",
        sheets=["Cash_Receipts", "Pending_CR", "Pending CR", "Pending Cash Receipts", "CR"],
        fields=dict(
            subzone=SUBZONE, sbu=SBU,
            period=["Period", "Quarter"],
            date=["Receipt Date", "Value Date", "Credit Date"] + POSTING_DATE,
            amount=AMOUNT,
        ),
        derive=dict(period=("quarter_from", "date")),
        rows=[("period", "Period")],
        column=None,
        metrics=[("count", "Count"), ("sum", "Amt (Lakhs)")],
        amount_source="rupees", amount_display="lakhs",
        headline="cash",
    ),
]

# CWIP "about to expire" uses exactly the same columns as CWIP expired
_cw = next(s for s in SECTIONS if s["key"] == "cwip_exp")
_c6 = next(s for s in SECTIONS if s["key"] == "cwip_60")
for _k in ("fields", "group_cols", "detail_cols", "num_cols"):
    _c6[_k] = _cw[_k]

SECTION_BY_KEY = {s["key"]: s for s in SECTIONS}
