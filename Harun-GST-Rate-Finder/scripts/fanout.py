#!/usr/bin/env python3
"""Dual-lane fleet extraction of NN-09/2025-CTR chunks -> JSON rows.

Lanes (independent models, so their mistakes are uncorrelated):
  mistral  Mistral API, mistral-small-latest        (env MISTRAL_API_KEY)
  laguna   OpenRouter, poolside/laguna-s-2.1:free   (env OPENROUTER_API_KEY)
Each chunk goes to BOTH lanes; compare.py then diffs them so a human (or a
stronger model) adjudicates only the disagreements, against the gazette text.
Free-tier friendly: sequential per lane, retries, resumable (skips done files).
Outputs already in out/ are kept, so the repo runs end-to-end without any key.
"""
import json, os, pathlib, re, sys, time, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHUNKS = sorted((ROOT / "chunks").glob("sch*.txt"))
OUT = ROOT / "out"
OUT.mkdir(exist_ok=True)

PROMPT = """You are a data-extraction machine. OUTPUT ONLY A JSON ARRAY. NO PREAMBLE, NO MARKDOWN FENCES.

Below is one chunk of a Schedule from Notification No. 9/2025-Central Tax (Rate) (GST rates on goods). It is a 3-column table flattened to text: S.No | Chapter/Heading/Sub-heading/Tariff item | Description of goods. Descriptions wrap across lines; page-break junk lines (Hindi gazette headers, page numbers, [PART II—SEC. 3(i)], THE GAZETTE OF INDIA) are noise - ignore them.

Extract EVERY serial-numbered row in this chunk as:
{"s_no": <int>, "hsn": "<column 2 verbatim, comma-separated codes kept>", "description": "<column 3 verbatim, joined into one line, keep bracketed inclusions/exclusions exactly>"}

If the chunk contains a section titled "List 1" (numbered items without HSN), emit those as:
{"list": "1", "item_no": <int>, "description": "<verbatim>"}

Rules:
- NEVER invent, shorten, or paraphrase a description. Verbatim text only.
- A row may continue past the end of the chunk; if its description is cut off, still emit it with what is visible and add "truncated": true.
- If the first row seems to start mid-description (no s_no), skip that fragment.

CHUNK:
"""


def post(url, headers, payload, timeout=180):
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json", **headers}
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def key(env):
    v = os.environ.get(env)
    if not v:
        sys.exit(f"set {env} to run this lane")
    return v


LANES = {
    "mistral": lambda msgs, mt: post(
        "https://api.mistral.ai/v1/chat/completions",
        {"Authorization": f"Bearer {key('MISTRAL_API_KEY')}"},
        {"model": "mistral-small-latest", "messages": msgs, "max_tokens": mt, "temperature": 0},
    ),
    "laguna": lambda msgs, mt: post(
        "https://openrouter.ai/api/v1/chat/completions",
        {"Authorization": f"Bearer {key('OPENROUTER_API_KEY')}"},
        {"model": "poolside/laguna-s-2.1:free", "messages": msgs, "max_tokens": mt, "temperature": 0},
    ),
}


def extract_json(text):
    text = text.strip()
    text = re.sub(r"^```(json)?|```$", "", text, flags=re.M).strip()
    a, b = text.find("["), text.rfind("]")
    if a == -1 or b == -1:
        raise ValueError("no JSON array found")
    return json.loads(text[a : b + 1])


def run_lane(lane, chunk, mt=8000, tries=3):
    fn = LANES[lane]
    msgs = [{"role": "user", "content": PROMPT + chunk.read_text()}]
    for t in range(tries):
        try:
            resp = fn(msgs, mt)
            content = resp["choices"][0]["message"]["content"]
            rows = extract_json(content)
            if not isinstance(rows, list) or not rows:
                raise ValueError("empty/non-list")
            return rows
        except Exception as e:
            print(f"    {lane} try{t + 1} failed: {e}", flush=True)
            time.sleep(8 * (t + 1))
    return None


def main():
    lanes = sys.argv[1:] or ["mistral", "laguna"]
    for chunk in CHUNKS:
        for lane in lanes:
            outp = OUT / f"{chunk.stem}.{lane}.json"
            if outp.exists():
                continue
            print(f"{chunk.stem} -> {lane}", flush=True)
            rows = run_lane(lane, chunk)
            if rows is not None:
                outp.write_text(json.dumps(rows, ensure_ascii=False, indent=1))
                print(f"    ok: {len(rows)} rows", flush=True)
            else:
                print("    lane failed for this chunk", flush=True)
            time.sleep(4)  # free-tier RPM headroom


if __name__ == "__main__":
    main()
