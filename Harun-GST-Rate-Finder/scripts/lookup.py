#!/usr/bin/env python3
"""Look up a GST rate by HSN prefix or keyword. Every answer carries its citation.

  python scripts/lookup.py 0402          # HSN / heading prefix
  python scripts/lookup.py "ghee"        # keyword in the description
Prints nothing-found rather than guessing: the dataset is the only source.
"""
import json, pathlib, re, sys

DATA = pathlib.Path(__file__).resolve().parent.parent / "data" / "gst-rates.json"


def search(query, entries):
    q = query.strip().lower()
    if re.fullmatch(r"[\d ]+", q):  # numeric -> HSN prefix match on any listed code
        digits = q.replace(" ", "")
        return [e for e in entries
                if any(c.replace(" ", "").startswith(digits) for c in re.findall(r"\d[\d ]*\d|\d", e["hsn"]))]
    return [e for e in entries if q in e["description"].lower()]


def fmt(e):
    return (f"{e['gst_rate']:>4} GST (CGST {e['cgst_rate']})  HSN {e['hsn']}\n"
            f"     {e['description']}\n"
            f"     cite: {e['source_notification']}, {e['source_entry']}; "
            f"effective {e['effective_from']}; CA-verified: {e['verified']}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    hits = search(" ".join(sys.argv[1:]), json.loads(DATA.read_text())["entries"])
    print("\n\n".join(fmt(e) for e in hits[:15]) or "No match in the dataset (Schedule I sample). Not guessing.")
    if len(hits) > 15:
        print(f"\n... {len(hits) - 15} more")
