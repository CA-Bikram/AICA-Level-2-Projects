#!/usr/bin/env python3
"""Chunk NN-09/2025-CTR (goods) layout text into fanout-sized pieces.

Usage: python scripts/chunk.py [I II III]   (default: I)

Splits each schedule's line range into ~220-line chunks, cutting only at
entry boundaries (lines starting with a serial number like "  123.  ").
Each chunk file carries a header telling the model its schedule + rate.
"""
import re, sys, pathlib

SRC = pathlib.Path(__file__).resolve().parent.parent / "source" / "nn-09-layout.txt"
OUT = pathlib.Path(__file__).resolve().parent.parent / "chunks"
OUT.mkdir(exist_ok=True)

lines = SRC.read_text().splitlines()

# schedule -> (start_line_idx, end_line_idx_exclusive, cgst, gst)
# List 1 (renewable-energy parts list) kept inside Schedule I's last chunk.
schedules = []
bounds = {}
for i, l in enumerate(lines):
    if re.search(r"Schedule I – 2\.5%", l):
        bounds["I"] = i
    elif re.search(r"Schedule II – 9\s?%", l):
        bounds["II"] = i
    elif re.search(r"Schedule III[–-]\s?20%", l):
        bounds["III"] = i

schedules = [
    ("I", bounds["I"], bounds["II"], "2.5%", "5%"),
    ("II", bounds["II"], bounds["III"], "9%", "18%"),
    ("III", bounds["III"], len(lines), "20%", "40%"),
]

ENTRY = re.compile(r"^\s{0,8}(\d{1,3})\.\s")
TARGET = 220  # lines per chunk

WANT = sys.argv[1:] or ["I"]
n_chunks = 0
for name, a, b, cgst, gst in schedules:
    if name not in WANT:
        continue
    body = lines[a:b]
    # find entry-boundary indices within body
    marks = [i for i, l in enumerate(body) if ENTRY.match(l)]
    chunks, start = [], 0
    while start < len(body):
        cut = start + TARGET
        if cut >= len(body):
            chunks.append((start, len(body)))
            break
        nxt = [m for m in marks if m >= cut]
        cut = nxt[0] if nxt else len(body)
        chunks.append((start, cut))
        start = cut
    for ci, (x, y) in enumerate(chunks):
        n_chunks += 1
        p = OUT / f"sch{name}-{ci:02d}.txt"
        hdr = (
            f"SOURCE: Notification No. 9/2025-Central Tax (Rate) dated 17.09.2025, "
            f"Schedule {name} (CGST {cgst} => total GST {gst}). "
            f"Chunk {ci + 1}/{len(chunks)}.\n---\n"
        )
        p.write_text(hdr + "\n".join(body[x:y]) + "\n")
        first = next((ENTRY.match(l).group(1) for l in body[x:y] if ENTRY.match(l)), "?")
        print(f"{p.name}: lines {a + x}-{a + y}, first s_no {first}")
print(f"total chunks: {n_chunks}")
