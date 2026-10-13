# GST Rate Finder — a citation-first, two-model extraction pipeline

AICA Level 2 capstone · Harun Raaj, Chartered Accountant

**Question this project answers:** can LLMs be trusted to turn a government gazette into a
lookup table a CA would stand behind? Our answer: *not on their own, but yes if the AI only
copies, two independent models must agree, and every row can be machine-checked against the
source.* The result here is the post-GST-rationalisation rate for **516 goods entries
(Schedule I, 5%)** of Notification No. 9/2025-Central Tax (Rate) dated 17.09.2025
(G.S.R. 641(E), effective 22.09.2025), each carrying its notification and serial number.

> ⚠ Educational sample. Every row is `verified: false` — **not CA-verified, not tax advice.**
> Schedule I only; absence from this file does **not** mean a good is exempt or at another rate.
> Exemption (NN 10/2025), Schedules II/III and services are out of scope.

## Why this design (the AI lesson)

| Risk | Control in this repo |
|---|---|
| Model "recalls" a rate from memory | Models never see a question — they only **extract verbatim** from the inlined gazette text. The rate is set by the Schedule heading, not by the model. |
| One model silently mis-copies | **Two independent lanes** (Mistral `mistral-small-latest`, OpenRouter `poolside/laguna-s-2.1:free`) extract the same chunks. Only exact agreement is auto-accepted. |
| Disagreement gets "fixed" by the same AI | Disputes go to `data/adjudications.json` and need the winning text **plus the gazette line that proves it**. Here: 2 of 516 rows (0.4%) disputed — a dropped "s", "car" vs "cars". |
| Plausible-looking row that isn't in the source | `scripts/verify_grounding.py` re-checks **every** row: all description words, in order, and all HSN digit groups must sit in that serial number's block of the gazette text. Tests prove the check *fails* on a changed word or HSN. |
| Over-trust of the output | Every row has `verified: false`; the lookup prints the citation and says "No match… Not guessing" instead of inventing an answer. |

## Pipeline

```
source/nn-09-layout.txt   gazette text (pdftotext -layout of the notification PDF, from a public gazette mirror; CBIC-portal cross-check pending)
   │ scripts/chunk.py        entry-aligned chunks of ~220 lines            → chunks/
   │ scripts/fanout.py       each chunk → lane A and lane B (JSON rows)    → out/*.mistral.json, out/*.laguna.json
   │ scripts/compare.py      exact agreement → dataset; disputes → adjudications.json
   │                                                                       → data/gst-rates.json, disagreements.md
   │ scripts/verify_grounding.py   every row literally in the gazette?
   └ scripts/lookup.py       HSN-prefix / keyword search with citations
```

The model outputs are committed in `out/`, so everything after the extraction step runs with
**no API key and no dependencies** (Python 3.9+, standard library only).

## Run it

```bash
python scripts/compare.py            # rebuild data/gst-rates.json from out/ (516 entries, 2 adjudicated)
python scripts/verify_grounding.py   # checked 516 entries, 0 not grounded
python -m unittest discover -s tests -v
python scripts/lookup.py 0405        # HSN prefix  -> 5% GST, cites Schedule I, S.No. 7
python scripts/lookup.py ghee        # keyword
```

Re-running the extraction yourself (optional; free tiers are enough):

```bash
export MISTRAL_API_KEY=...  OPENROUTER_API_KEY=...
rm out/*.json && python scripts/fanout.py     # resumable; skips existing outputs
```

## Data format (`data/gst-rates.json`)

```json
{"schedule": "I", "s_no": 7, "hsn": "0405",
 "description": "Butter and other fats and oils derived from milk, including ghee; dairy spreads",
 "cgst_rate": "2.5%", "gst_rate": "5%",
 "source_notification": "Notification No. 9/2025-Central Tax (Rate) dt. 17.09.2025",
 "source_entry": "Schedule I, S.No. 7", "effective_from": "2025-09-22", "verified": false}
```

## Limits and what I would do next

- Schedule I only. The same pipeline handles Schedules II (18%) and III (40%): `python scripts/chunk.py I II III`.
- The grounding check proves a row *is in the gazette*; it cannot prove the gazette text is the
  latest. Later amendments and the CBIC portal copy must be cross-checked before real use.
- HSN matching is prefix-based on the codes as printed; conditional entries ("other than …")
  are shown as written and need professional reading.
- Human sign-off (`verified: true`) is deliberately left to a practising CA.

Source: Gazette of India, Extraordinary, Part II Sec. 3(i), Notification No. 9/2025-Central Tax (Rate),
Ministry of Finance, 17 Sept 2025 — a public document.
