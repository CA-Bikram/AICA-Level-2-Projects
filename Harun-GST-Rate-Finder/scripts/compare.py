#!/usr/bin/env python3
"""Merge the two model lanes into a cited dataset + a disagreement report.

Rule: a row (keyed schedule + S.No) whose HSN *and* normalised description match
across both lanes is auto-accepted. Anything else is written to
disagreements.md and may enter the dataset ONLY through data/adjudications.json,
where a reviewer names the winning text and the gazette line that proves it.
Every entry ships verified:false -- a CA must sign off before any real use.
"""
import json, pathlib, re
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "out"
DATA = ROOT / "data"

SCHED_META = {
    "I": {"cgst": "2.5%", "gst": "5%"},
    "II": {"cgst": "9%", "gst": "18%"},
    "III": {"cgst": "20%", "gst": "40%"},
}
SOURCE = "Notification No. 9/2025-Central Tax (Rate) dt. 17.09.2025"
META = {
    "dataset": "GST rates on goods (CGST) - Schedule I sample",
    "source": SOURCE,
    "gsr": "G.S.R. 641(E)",
    "effective_from": "2025-09-22",
    "method": "two independent LLM lanes extract verbatim from the gazette text; "
              "exact-agreement rows auto-accepted; disputes resolved only via data/adjudications.json",
    "verification": "ALL entries verified:false - not CA-verified, not tax advice",
}


def norm(s):
    return re.sub(r"[^a-z0-9%]+", " ", str(s).lower()).strip()


def load_lane(lane):
    rows = {}
    for f in sorted(OUT.glob(f"sch*.{lane}.json")):
        sched = re.match(r"sch(I+)-", f.name).group(1)
        for r in json.loads(f.read_text()):
            if r.get("list"):  # "List 1" items have no HSN/S.No: out of scope here
                continue
            k = (sched, r.get("s_no"))
            if k in rows and len(str(r.get("description", ""))) <= len(str(rows[k].get("description", ""))):
                continue  # chunk-boundary duplicate: keep the longer (untruncated) one
            rows[k] = r
    return rows


def entry(sched, s_no, hsn, desc, note=None):
    e = {
        "schedule": sched, "s_no": s_no, "hsn": hsn.strip(), "description": desc.strip(),
        "cgst_rate": SCHED_META[sched]["cgst"], "gst_rate": SCHED_META[sched]["gst"],
        "source_notification": SOURCE,
        "source_entry": f"Schedule {sched}, S.No. {s_no}",
        "effective_from": "2025-09-22", "verified": False,
    }
    if note:
        e["adjudication"] = note
    return e


def main():
    a, b = load_lane("mistral"), load_lane("laguna")
    adj = {k: v for k, v in json.loads((DATA / "adjudications.json").read_text()).items() if not k.startswith("_")}
    entries, open_disputes, n_adj = [], [], 0
    for k in sorted(set(a) | set(b), key=lambda x: (x[0], x[1] if isinstance(x[1], int) else 0)):
        A, B = a.get(k), b.get(k)
        sched, s_no = k
        if A and B and norm(A.get("hsn")) == norm(B.get("hsn")) and norm(A.get("description")) == norm(B.get("description")):
            entries.append(entry(sched, s_no, A["hsn"], A["description"]))
        elif f"{sched}:{s_no}" in adj:
            r = adj[f"{sched}:{s_no}"]
            entries.append(entry(sched, s_no, r["hsn"], r["description"], r["evidence"]))
            n_adj += 1
        else:
            open_disputes.append((k, A, B))

    total = len(entries) + len(open_disputes)
    with open(ROOT / "disagreements.md", "w") as f:
        f.write(f"# Lane disagreements: {n_adj + len(open_disputes)} of {total} rows ({n_adj} adjudicated, {len(open_disputes)} open)\n\n")
        for k, A, B in open_disputes:
            f.write(f"## Sch {k[0]} S.No {k[1]}\n- mistral: `{json.dumps(A, ensure_ascii=False)}`\n- laguna: `{json.dumps(B, ensure_ascii=False)}`\n\n")
    (DATA / "gst-rates.json").write_text(json.dumps({"meta": META, "entries": entries}, ensure_ascii=False, indent=1))
    per = defaultdict(int)
    for e in entries:
        per[e["schedule"]] += 1
    print(f"entries: {len(entries)}  adjudicated: {n_adj}  open disputes: {len(open_disputes)}  per schedule: {dict(per)}")


if __name__ == "__main__":
    main()
