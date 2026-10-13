"""
Creates sample_BCM_data.xlsx - demo data for every BCM section, using the same column headings as the
pivots in the BCM presentation. Use it as a TEMPLATE: keep the sheet names / headings and paste your SAP extracts.

    python make_sample.py                -> sample_BCM_data.xlsx            (current status)
    python make_sample.py previous       -> sample_BCM_previous.xlsx        (smaller "previous status" file)
"""
import datetime as dt
import random
import sys

import pandas as pd

PREV = len(sys.argv) > 1 and sys.argv[1].lower().startswith("prev")
random.seed(11 if PREV else 7)
N = 0.35 if PREV else 1.0
ASOF = dt.date(2026, 9, 30)

SZ = {
    "Bhubaneshwar": {"EZ_Retail": ["Bhubaneswar RRO", "Bilaspur RRO", "Sambalpur RRO", "Raipur RRO"],
                     "EZ_SOD": ["Balasore New IRD", "Paradeep Tml", "Raipur IRD", "Raipur IRD-II"]},
    "Guwahati": {"EZ_Retail": ["Guwahati RRO", "Dibrugarh Retail RO", "East Zone - Retail"],
                 "EZ_SOD": ["Guwahati IRD", "Kamardanga IRD", "Numaligarh TOP-NRL"]},
    "Kolkata": {"EZ_Retail": ["Kolkata RRO", "Siliguri RRO", "Durgapur RRO"],
                "EZ_SOD": ["Budge Budge Tml", "Haldia Tml", "Siliguri Depot"]},
}
VENDORS = [f"{n} {s}" for n in ["Shree", "Maa Tara", "Kalinga", "Brahmaputra", "Eastern", "Om Sai", "Jagannath", "Bharat"]
           for s in ["Traders", "Enterprises", "Engineering", "Logistics"]]


def n(k):
    return max(1, int(k * N))


def pick():
    sz = random.choice(list(SZ))
    sbu = random.choice(list(SZ[sz]))
    return sz, sbu, random.choice(SZ[sz][sbu])


def rdate(a, b):
    return a + dt.timedelta(days=random.randint(0, (b - a).days))


def grn_period(d):
    if d < dt.date(2024, 4, 1): return "Upto Mar 2024"
    if d < dt.date(2025, 4, 1): return "2024-2025"
    if d < dt.date(2025, 10, 1): return "Apr-25 to Sep-25"
    if d < dt.date(2026, 4, 1): return "Oct-25 to Mar-26"
    return "Apr-26 to June-26"


sheets = {}
rows = []
for _ in range(n(380)):
    sz, sbu, pc = pick(); d = rdate(dt.date(2023, 6, 1), dt.date(2026, 6, 30))
    rows.append({"GRN Posting Date": d, "Profit Center": f"PC{abs(hash(pc)) % 9000 + 1000}", "Profit center Decrip": pc,
                 "Vendor Code": f"V{random.randint(10000, 99999)}", "Vendor Name": random.choice(VENDORS),
                 "MSME?": random.choice(["MSME", "NON-MSME", "NA", "MSME", "NON-MSME"]),
                 "Rs. In Lakhs": -round(random.uniform(0.01, 25), 2), "SBU": sbu, "SubZone": sz,
                 "Period as per Posting Date": grn_period(d)})
sheets["Open_GRN"] = pd.DataFrame(rows)

rows = []
for i in range(n(420)):
    sz, sbu, pc = pick(); d = rdate(dt.date(2026, 3, 1), ASOF); age = (ASOF - d).days
    bucket = "0-30 days" if age <= 30 else "30-45 days" if age <= 45 else "45-90 days" if age <= 90 else "90-180 days"
    rows.append({"SubZone": sz, "SBU": sbu, "Plant Name": pc.upper(), "VIT/PRF Posting Date": d, "Financial Year": "2025-26",
                 "Proc Type Text": random.choice(["Material", "Service", "Capex"]), "Reference No": f"VP{700000 + i}",
                 "Vendor Name": random.choice(VENDORS), "Gross Amount": random.randint(2000, 2500000), "Ageing": bucket})
sheets["VIT_PRF"] = pd.DataFrame(rows)

rows = []
for i in range(n(160)):
    sz, sbu, pc = pick()
    rows.append({"SubZone": sz, "SBU": "Retail" if sbu == "EZ_Retail" else "SOD",
                 "ERP_LOCNNAME": random.choice(["NATIONAL SERVICE STATION", "HIGHWAY SERVICE CENTRE", "MAA FILLING STATION",
                                                "SORO SERVICE STATION", "SITARAM SERVICE STATION", "THANGKHEW SERVICE STATION",
                                                "OM SAI FILLING STATION", pc.upper()]),
                 "ERP_ASSETNO": 10000000 + i, "Asset Description": random.choice(["Dispensing Unit", "Canopy", "Compressor", "DG Set"]),
                 "Status": random.choice(["TO BE WRITTEN OFF"] * 6 + ["DISPOSED OFF", "TRANSFERRED"])})
sheets["FA_Discrepancy"] = pd.DataFrame(rows)

rows = []
for sz, sbus in SZ.items():
    for locs in sbus.values():
        for loc in locs:
            tot = random.randint(20, 1500); ver = tot if random.random() < 0.6 else random.randint(0, tot)
            rows.append({"SubZone": sz, "Location Name": loc, "Total Items": tot, "Verified item": ver})
sheets["FA_Verification"] = pd.DataFrame(rows)

rows = []
for i in range(n(30)):
    sz, sbu, pc = pick(); d = rdate(dt.date(2026, 5, 1), dt.date(2026, 9, 10))
    rows.append({"SubZone": sz, "SBU": sbu, "PC Name": pc, "Invoice No": f"MSTC/{i:04d}", "Invoice Date": d,
                 "No. of days": (ASOF - d).days, "Amount": random.choice([1160, 13920, 13630, 17455, 4720, 9440])})
sheets["MSTC"] = pd.DataFrame(rows)

rows = []
for i in range(n(90)):
    sz, sbu, pc = pick()
    rows.append({"Sub Zone": sz, "Profit Center: Short Text": pc, "Claim No": f"RC{i:05d}",
                 "Claim Date": rdate(dt.date(2021, 10, 1), dt.date(2026, 9, 1)), "Transporter": random.choice(VENDORS),
                 "Amount": random.randint(1000, 300000)})
sheets["Road_Claim"] = pd.DataFrame(rows)


def cwip(k, end):
    out = []
    for i in range(n(k)):
        sz, sbu, pc = pick(); ar = round(random.uniform(0.15, 1.8), 2); exp = round(ar * random.uniform(.2, .99), 2)
        cap = round(exp * random.uniform(0, .9), 2)
        out.append({"Sub Zone": sz, "SBU": "RET" if sbu == "EZ_Retail" else "SOD",
                    "Controlling Location Descp": pc.upper(),
                    "Project Title( project description )": f"EZ_{pc.split()[0].upper()}_NRO_{random.choice(['CFS', 'DC', 'EVCS', 'MOD'])}_{i:02d}",
                    "End date": end, "Original Completion date": rdate(dt.date(2023, 3, 31), dt.date(2026, 6, 30)),
                    "No of AR": 1, "AR Value (Rs in Cr)": ar, "Cum Exp Rs in Crs": exp, "Cum Capx (Rs in Cr)": cap,
                    "Open CWIP Rs. Crs": round(exp - cap, 2)})
    return pd.DataFrame(out)


sheets["CWIP_Expired"] = cwip(6, dt.date(2026, 6, 30))
sheets["CWIP_60"] = cwip(25, dt.date(2026, 9, 30))

rows = []
for i in range(n(60)):
    sz, sbu, pc = pick()
    rows.append({"Sub Zone": sz, "SBU": "Retail" if sbu == "EZ_Retail" else "SOD", "Plant Name": pc.upper(),
                 "Asset No": 20000000 + i, "RFD Date": rdate(dt.date(2017, 6, 1), dt.date(2025, 9, 1))})
sheets["RFD"] = pd.DataFrame(rows)

rows = []
for i in range(n(80)):
    sz, sbu, pc = pick()
    rows.append({"Sub Zone as Sender/receiver": sz, "SBU": sbu, "AMTA No": f"AMTA{i:05d}",
                 "Sending Location": pc, "Status": random.choice(["PENDING FOR DISPATCH"] * 3 + ["DRAFT", "ERROR", "DISPATCHED", "DISPATCHED", "RECEIVER L1"])})
sheets["AMTA"] = pd.DataFrame(rows)

rows = []
for i in range(n(30)):
    sz, sbu, pc = pick()
    rows.append({"Sub Zone": sz, "SBU": "SOD", "Sales Org Desc": random.choice(["HPCL Mkt Retail", "HPCL Mkt DS I&C"]),
                 "Delivery No": 80000000 + i, "Delivery Date": rdate(dt.date(2026, 6, 1), dt.date(2026, 8, 31))})
sheets["Delivery_Confirmation"] = pd.DataFrame(rows)

rows = []
for i in range(n(15)):
    sz, sbu, pc = pick()
    rows.append({"SubZone": sz, "SBU": "Retail" if sbu == "EZ_Retail" else "SOD", "Profit Center: Short Text": pc,
                 "User Name2": random.choice(["MOHAPATRA JAGANNATH", "MISHRA DINABANDHU", "ACN_DM_FI2"]),
                 "Customer Name": random.choice(["Reconstitution Fee (OTC)", "BABA CONTAINER MANUFACTURERS", "GLOBAL ENTERPRISE"]),
                 "Entry Date": rdate(dt.date(2023, 8, 1), dt.date(2026, 9, 20)),
                 "Amount": random.choice([-29500, 45528, 5769, 180355, 12000])})
sheets["Other_Receivables"] = pd.DataFrame(rows)

rows = []
for i in range(n(212)):
    sz, sbu, pc = pick()
    rows.append({"SubZone": sz, "SBU": sbu, "Profit Center": pc, "Receipt Date": rdate(dt.date(2024, 1, 1), ASOF),
                 "Reference": f"CR{i:05d}", "Amount": random.randint(500, 900000)})
sheets["Pending_CR"] = pd.DataFrame(rows)

out = "sample_BCM_previous.xlsx" if PREV else "sample_BCM_data.xlsx"
with pd.ExcelWriter(out, engine="openpyxl") as w:
    for name, df in sheets.items():
        df.to_excel(w, sheet_name=name, index=False)
print("written", out, {k: len(v) for k, v in sheets.items()})
