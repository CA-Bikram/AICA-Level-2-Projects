#!/usr/bin/env python3
"""Anti-hallucination check: is every dataset row literally in the gazette?

For each entry we take its block in source/nn-09-layout.txt (the S.No line up to
the next S.No) and require
  1. every word of the description to appear, in order, in that block, and
  2. every HSN digit group to appear, in order, in that block.
Word-order matching (not substring) is deliberate: the gazette is a 3-column
table, so a long HSN list can wrap into the middle of the description text.
Bilingual page-break headers are dropped first. Exit 1 on any miss.
"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
JUNK = re.compile(r"[ऀ-ॿ]|THE GAZETTE OF INDIA|\[PART II")  # Devanagari page headers
ENTRY = re.compile(r"^\s{0,12}(\d{1,3})\.\s")


def tokens(s):
    return re.findall(r"[^\W_]+|%", s.lower())


def schedule_lines(start_pat, end_pat):
    lines = (ROOT / "source" / "nn-09-layout.txt").read_text().splitlines()
    a = next(i for i, l in enumerate(lines) if re.search(start_pat, l))
    b = next(i for i, l in enumerate(lines) if i > a and re.search(end_pat, l))
    return [l for l in lines[a:b] if not JUNK.search(l)]


def blocks(lines):
    """S.No -> list of candidate blocks (an S.No can recur in preamble text)."""
    out, cur, n = {}, [], None
    for l in lines:
        m = ENTRY.match(l)
        if m:
            if n is not None:
                out.setdefault(n, []).append(" ".join(cur))
            n, cur = int(m.group(1)), [l]
        elif n is not None:
            cur.append(l)
    if n is not None:
        out.setdefault(n, []).append(" ".join(cur))
    return out


def in_order(words, block):
    """Each word found, in order, in the block with whitespace removed.
    Squashing also absorbs pdftotext splitting a word across a wrap ("res idues")."""
    sq, pos = "".join(tokens(block)), 0
    for w in words:
        i = sq.find(w, pos)
        if i < 0:
            return False
        pos = i + len(w)
    return True


def grounded(entry, cands):
    codes = re.findall(r"\d+", entry["hsn"])  # digit groups of every code, in order
    want = tokens(entry["description"])
    return any(in_order(codes, blk) and in_order(want, blk) for blk in cands)


def check(entries):
    sched = {"I": blocks(schedule_lines(r"Schedule I – 2\.5%", r"Schedule II – 9\s?%"))}
    return [e["source_entry"] for e in entries
            if e["schedule"] in sched and not grounded(e, sched[e["schedule"]].get(e["s_no"], []))]


if __name__ == "__main__":
    data = json.loads((ROOT / "data" / "gst-rates.json").read_text())["entries"]
    miss = check(data)
    print(f"checked {len(data)} entries, {len(miss)} not grounded")
    for m in miss[:20]:
        print("  MISS", m)
    sys.exit(1 if miss else 0)
