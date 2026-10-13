"""
bcm_render.py - HTML for the BCM "slides": banner with subtle topic illustration, presentation-style
pivots (every figure is a drill-down link), CWIP listings and the FA verification summary.
"""
from __future__ import annotations

import html

import pandas as pd

from bcm_core import indian_2dp, indian_int
from bcm_engine import fmt_metric

E = html.escape

# ----------------------------------------------------------------------------- illustrations
# Simple line-art (64x64, stroke only). Drawn faint so they never compete with the numbers.
ICONS = {
    "overview": '<path d="M8 56h50"/><path d="M14 50V36M26 50V24M38 50V32M50 50V14"/><path d="M12 30l12-10 12 8 14-14"/>',
    "grn": '<rect x="4" y="22" width="34" height="22" rx="2"/><path d="M38 29h11l9 10v5H38z"/><circle cx="16" cy="48" r="5"/>'
           '<circle cx="48" cy="48" r="5"/><path d="M12 22V12h16v10M20 12v10"/>',
    "invoice": '<path d="M16 6h24l10 10v42H16z"/><path d="M40 6v10h10"/><path d="M22 26h20M22 33h20M22 40h11"/>'
               '<path d="M36 49l4 4 8-9"/>',
    "asset": '<path d="M8 56V26l16-11 16 11v30"/><path d="M4 56h56"/><rect x="18" y="34" width="12" height="22"/>'
             '<circle cx="48" cy="20" r="9"/><path d="M44 20l3 3 6-6"/>',
    "clipboard": '<rect x="14" y="10" width="36" height="46" rx="3"/><rect x="24" y="6" width="16" height="8" rx="2"/>'
                 '<path d="M21 26l3 3 6-6M34 27h10M21 39l3 3 6-6M34 40h10M22 50h20"/>',
    "gavel": '<path d="M24 8l18 18M18 14l18 18M21 11l-6 6M39 29l-6 6"/><path d="M30 26L10 46"/><path d="M34 56h24M38 50h16v6"/>',
    "truck": '<path d="M2 62l16-24M62 62L46 38M32 42v5M32 52v6"/><rect x="10" y="10" width="26" height="18" rx="2"/>'
             '<path d="M36 15h10l7 8v5H36z"/><circle cx="19" cy="31" r="4"/><circle cx="45" cy="31" r="4"/>',
    "crane": '<path d="M16 58V8M16 8h40M16 16l8-8M8 58h20M16 30L28 8M52 8v14"/><rect x="47" y="22" width="10" height="9"/>'
             '<path d="M36 58V44h14v14"/>',
    "tag": '<path d="M34 6h20v20L28 52 8 32z"/><circle cx="45" cy="15" r="4"/><path d="M22 30l10 10M18 36l6 6"/>',
    "transfer": '<rect x="4" y="28" width="18" height="26" rx="1"/><rect x="42" y="28" width="18" height="26" rx="1"/>'
                '<path d="M20 18h26l-6-6M44 18l-4 6M44 42H18l6 6M20 42l4-6"/>',
    "package": '<path d="M30 6l22 11v26L30 54 8 43V17z"/><path d="M8 17l22 11 22-11M30 28v26"/>'
               '<circle cx="50" cy="50" r="9"/><path d="M46 50l3 3 5-6"/>',
    "wallet": '<rect x="6" y="18" width="48" height="34" rx="4"/><path d="M42 30h14v12H42z"/><circle cx="47" cy="36" r="1.5"/>'
              '<path d="M14 18l24-10 4 10"/>',
    "receipt": '<path d="M14 6h36v52l-6-4-6 4-6-4-6 4-6-4-6 4z"/><path d="M22 18h20M22 26h20M22 34h12"/>'
               '<path d="M30 44h12M34 40v8"/>',
}

ACCENTS = ["#0072bc", "#14B8A6", "#F97316", "#8B5CF6", "#16A34A", "#EC4899", "#0EA5E9", "#E11D48", "#6366F1",
           "#D97706", "#0891B2", "#7C3AED", "#059669"]


def icon_svg(name: str, size: int = 120, color: str = "#ffffff", opacity: float = 0.32, width: float = 2.0) -> str:
    body = ICONS.get(name, ICONS["overview"])
    return (f"<svg viewBox='0 0 64 64' width='{size}' height='{size}' fill='none' stroke='{color}' stroke-width='{width}' "
            f"stroke-linecap='round' stroke-linejoin='round' style='opacity:{opacity}'>{body}</svg>")


def banner(title: str, subtitle: str, icon: str, accent: str, number: str = "") -> str:
    return (f"<div class='slide-banner' style='background:linear-gradient(115deg,{accent} 0%,#1E3A8A 70%,#312E81 100%)'>"
            f"<div class='txt'>{f'<div class=kicker>{E(number)}</div>' if number else ''}<h1>{E(title)}</h1>"
            f"{f'<div class=sub>{subtitle}</div>' if subtitle else ''}</div>"
            f"<div class='art'>{icon_svg(icon)}</div></div>")


def bullets(items) -> str:
    return "<ul class='slide-bullets'>" + "".join(f"<li>{t}</li>" for t in items) + "</ul>"


def cards(items) -> str:
    return "<div class='slide-cards'>" + "".join(
        f"<div class='scard' style='border-left-color:{c}'><b style='color:{c}'>{E(h)}</b><span>{E(t)}</span></div>"
        for c, h, t in items) + "</div>"


def actions_table(items) -> str:
    return ("<table class='act'><tr><th>Status</th><th>Action Required</th></tr>" +
            "".join(f"<tr><td class='st'>{E(s)}</td><td>{a}</td></tr>" for s, a in items) + "</table>")


# ----------------------------------------------------------------------------- component CSS
PIVOT_CSS = """
:host { display:block; }
.wrap { overflow-x:auto; border-radius:12px; box-shadow:0 6px 20px rgba(15,40,90,.10); background:#fff; }
table.pv { border-collapse:collapse; width:100%; font-family:'Segoe UI',Inter,Arial,sans-serif; font-size:13px; color:#0b1f33; }
table.pv th { background:#00B0F0; color:#08223f; font-weight:800; padding:6px 6px; border:1px solid #7fb9e0; text-align:center; }
table.pv th.cap { background:#d6ecff; color:#0b3d91; font-size:12.5px; }
table.pv th.act { background:#c9f2d3; color:#0b3a1e; font-weight:700; font-size:11.5px; line-height:1.25; }
table.pv th.met { background:#5cc8f5; font-size:12px; }
table.pv td { padding:4px 7px; border:1px solid #c5d6ea; text-align:center; white-space:nowrap; }
table.pv td.g { font-weight:700; background:#f7fbff; white-space:normal; }
table.pv td.leaf { white-space:nowrap; text-align:left; }
table.pv td.w { white-space:normal; text-align:left; min-width:220px; }
table.pv td.n { text-align:right; font-variant-numeric:tabular-nums; }
table.pv td.tot { background:#eef6ff; font-weight:700; }
table.pv tr.sub td { background:#FFF2CC; font-weight:800; }
table.pv tr.grand td { background:#FFC000; font-weight:900; color:#1a1300; }
table.pv tr:hover td.n { background:#f0f8ff; }
table.pv a { color:#0b3d91; text-decoration:none; border-bottom:1px dotted #6ea8dc; cursor:pointer; font-weight:600; padding:0 2px; border-radius:3px; }
table.pv a:hover { background:#dbeeff; border-bottom-color:#0b3d91; }
table.pv tr.grand a, table.pv tr.sub a { color:#1a1300; border-bottom-color:#7a5b00; font-weight:900; }
.dot { display:inline-block; width:12px; height:12px; border-radius:50%; margin-right:6px; vertical-align:-1px; }
.empty { padding:26px; text-align:center; font-size:20px; font-weight:800; color:#64748b; }
"""

PIVOT_JS = """
export default function(component) {
  const { data, setTriggerValue, parentElement } = component;
  let root = parentElement.querySelector('.bcm-root');
  if (!root) { root = document.createElement('div'); root.className = 'bcm-root'; parentElement.appendChild(root); }
  root.innerHTML = (data && data.html) || '';
  root.querySelectorAll('[data-k]').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); setTriggerValue('cell', el.getAttribute('data-k')); });
  });
}
"""


class LinkMap(dict):
    """key -> (drill title, list of row ids)."""

    def add(self, title, ids) -> str:
        k = f"k{len(self)}"
        self[k] = (title, list(ids))
        return k


def _a(lm: LinkMap, text: str, title: str, ids) -> str:
    if not text:
        return ""
    return f"<a data-k='{lm.add(title, ids)}' title='Click for item list'>{E(text)}</a>"


# ----------------------------------------------------------------------------- pivot
def pivot_html(model: dict, sec, lm: LinkMap, prefix: str = "") -> str:
    rows_hdr = [r[1] for r in sec["rows"]]
    buckets, metrics, leaves = model["buckets"], model["metrics"], model["leaves"]
    if not leaves:
        return "<div class='wrap'><div class='empty'>NIL</div></div>"
    nm = len(metrics)
    col = sec.get("column")
    actions = sec.get("column_actions") or {}
    caption = sec.get("column_caption")
    multi_hdr = nm > 1 and col
    groups = list(dict.fromkeys(l["keys"][0] for l in leaves))
    single_group = len(groups) == 1 and len(model["rows_f"]) > 1
    total_lbl = "Grand Total" if col else "Total"

    h = ["<div class='wrap'><table class='pv'><thead>"]
    top_rows = (1 if caption else 0) + (1 if actions else 0)
    hdr_depth = top_rows + (2 if multi_hdr else 1)
    if caption:
        h.append(f"<tr><th class='cap' colspan='{len(rows_hdr)}'></th><th class='cap' colspan='{len(buckets) * nm}'>"
                 f"{E(caption)}</th><th class='cap' colspan='{nm}'></th></tr>")
    if actions:
        h.append(f"<tr><th class='cap' colspan='{len(rows_hdr)}'></th>" +
                 "".join(f"<th class='act' colspan='{nm}'>{E(actions.get(b, ''))}</th>" for b in buckets) +
                 f"<th class='cap' colspan='{nm}'></th></tr>")
    h.append("<tr>")
    for r in rows_hdr:
        h.append(f"<th rowspan='{2 if multi_hdr else 1}'>{E(r)}</th>")
    if col:
        for b in buckets:
            h.append(f"<th colspan='{nm}'>{E(b)}</th>" if multi_hdr else f"<th>{E(b)}</th>")
        h.append(f"<th colspan='{nm}'>{total_lbl}</th>" if multi_hdr else f"<th>{total_lbl}</th>")
    else:
        for _, lbl in metrics:
            h.append(f"<th>{E(lbl)}</th>")
    h.append("</tr>")
    if multi_hdr:
        h.append("<tr>" + "".join(f"<th class='met'>{E(lbl)}</th>" for _ in buckets + [None] for _, lbl in metrics) + "</tr>")
    h.append("</thead><tbody>")

    def metric_cells(agg_cells, agg_total, title, cls=""):
        out = []
        for b in buckets:
            c = agg_cells.get(b)
            for kind, _ in metrics:
                txt = fmt_metric(kind, c[kind], sec) if c else ""
                out.append(f"<td class='n{cls}'>{_a(lm, txt, f'{title} | {b}', c['ids']) if c else ''}</td>")
        for kind, _ in metrics:
            txt = fmt_metric(kind, agg_total[kind], sec)
            out.append(f"<td class='n tot{cls}'>{_a(lm, txt, f'{title} | {total_lbl}', agg_total['ids'])}</td>")
        return "".join(out)

    depth = len(model["rows_f"])
    for gi, g in enumerate(groups):
        gl = [l for l in leaves if l["keys"][0] == g]
        for i, leaf in enumerate(gl):
            h.append("<tr>")
            for lvl in range(depth):
                is_leaf = lvl == depth - 1
                if is_leaf:
                    h.append(f"<td class='leaf'>{E(leaf['keys'][lvl])}</td>")
                    continue
                pref = leaf["keys"][:lvl + 1]
                if i > 0 and gl[i - 1]["keys"][:lvl + 1] == pref:
                    continue
                span = 0  # consecutive rows sharing this prefix
                for x in gl[i:]:
                    if x["keys"][:lvl + 1] == pref:
                        span += 1
                    else:
                        break
                h.append(f"<td class='g' rowspan='{span}'>{E(leaf['keys'][lvl])}</td>")
            title = " › ".join(leaf["keys"])
            h.append(metric_cells(leaf["cells"], leaf["total"], title) + "</tr>")
        if len(groups) > 1 and depth > 1:
            st_ = model["subtotals"][g]
            h.append(f"<tr class='sub'><td colspan='{depth}'>{E(g)} Total</td>"
                     f"{metric_cells(st_['cells'], st_['total'], f'{g} Total')}</tr>")
    grand_lbl = f"{groups[0]} Total" if single_group else "Grand Total"
    gr = model["grand"]
    h.append(f"<tr class='grand'><td colspan='{depth}'>{E(grand_lbl)}</td>{metric_cells(gr['cells'], gr['total'], grand_lbl)}</tr>")
    h.append("</tbody></table></div>")
    return "".join(h)


# ----------------------------------------------------------------------------- CWIP listing
def listing_html(df: pd.DataFrame, sec, lm: LinkMap) -> str:
    if df.empty:
        return "<div class='wrap'><div class='empty'>NIL</div></div>"
    gcols, dcols, ncols = sec["group_cols"], sec["detail_cols"], sec["num_cols"]
    df = df.sort_values([g[0] for g in gcols] + [dcols[0][0]], key=lambda s: s.astype(str).str.lower()).reset_index(drop=True)
    h = ["<div class='wrap'><table class='pv'><thead><tr>"]
    h += [f"<th>{E(c[1])}</th>" for c in gcols + dcols + ncols]
    h.append("</tr></thead><tbody>")

    def fmt(v, kind):
        if kind == "date":
            return "" if pd.isna(v) else pd.Timestamp(v).strftime("%d-%b-%y")
        if kind == "int":
            return indian_int(v)
        if kind == "2dp":
            return indian_2dp(v)
        return str(v)

    keys = [g[0] for g in gcols]
    for i, r in df.iterrows():
        h.append("<tr>")
        for lvl, (f, _) in enumerate(gcols):
            pref = tuple(r[keys[:lvl + 1]])
            if i > 0 and tuple(df.loc[i - 1, keys[:lvl + 1]]) == pref:
                continue
            span = 0
            for j in range(i, len(df)):
                if tuple(df.loc[j, keys[:lvl + 1]]) == pref:
                    span += 1
                else:
                    break
            h.append(f"<td class='g' rowspan='{span}'>{E(str(r[f]))}</td>")
        for f, _, kind in dcols:
            h.append(f"<td class='{'w' if kind == 'text' else 'leaf'}'>{E(fmt(r[f], kind))}</td>")
        title = f"{r[keys[-1]]} › {r[dcols[0][0]]}"
        for f, _, kind in ncols:
            h.append(f"<td class='n'>{_a(lm, fmt(r[f], kind), title, [r['__id']])}</td>")
        h.append("</tr>")
    h.append(f"<tr class='grand'><td colspan='{len(gcols) + len(dcols)}'>Grand Total</td>")
    for f, _, kind in ncols:
        h.append(f"<td class='n'>{_a(lm, fmt(df[f].sum(), kind), 'Grand Total', df['__id'].tolist())}</td>")
    h.append("</tr></tbody></table></div>")
    return "".join(h)


# ----------------------------------------------------------------------------- FA verification summary
def summary_html(df: pd.DataFrame, sec, lm: LinkMap, show_all: bool) -> str:
    if df.empty:
        return "<div class='wrap'><div class='empty'>NIL</div></div>"
    g = df.groupby(["subzone", "location"], sort=False).agg(total=("total", "sum"), verified=("verified", "sum"),
                                                              ids=("__id", list)).reset_index()
    g["pending"] = (g["total"] - g["verified"]).clip(lower=0)
    g["pct"] = (g["verified"] / g["total"].where(g["total"] != 0)).fillna(0)
    shown = g if show_all else g[g["pending"] > 0]
    shown = shown.sort_values(["subzone", "pct", "pending"], ascending=[True, True, False])

    def dot(p):
        c = "#16A34A" if p >= 0.95 else "#F59E0B" if p >= 0.5 else "#E4572E"
        return f"<span class='dot' style='background:{c}'></span>{p * 100:.2f}%"

    h = ["<div class='wrap'><table class='pv'><thead><tr><th>SubZone</th><th>Location Name</th><th>Total Items</th>"
         "<th>Verified item</th><th>% of Item Verification</th><th>Pending</th></tr></thead><tbody>"]
    for _, r in shown.iterrows():
        t = f"{r['subzone']} › {r['location']}"
        h.append(f"<tr><td class='g'>{E(r['subzone'])}</td><td class='leaf'>{E(r['location'])}</td>"
                 f"<td class='n'>{_a(lm, indian_int(r['total']), t, r['ids'])}</td>"
                 f"<td class='n'>{_a(lm, indian_int(r['verified']) or '0', t, r['ids'])}</td>"
                 f"<td class='n'>{dot(r['pct'])}</td>"
                 f"<td class='n'>{_a(lm, indian_int(r['pending']) or '0', t, r['ids'])}</td></tr>")
    if shown.empty:
        h.append("<tr><td colspan='6' class='leaf'>All locations fully verified.</td></tr>")
    tot, ver = g["total"].sum(), g["verified"].sum()
    allids = df["__id"].tolist()
    h.append(f"<tr class='grand'><td colspan='2'>Grand Total</td><td class='n'>{_a(lm, indian_int(tot), 'Grand Total', allids)}</td>"
             f"<td class='n'>{_a(lm, indian_int(ver), 'Grand Total', allids)}</td>"
             f"<td class='n'>{dot(ver / tot if tot else 0)}</td>"
             f"<td class='n'>{_a(lm, indian_int(max(tot - ver, 0)) or '0', 'Grand Total', allids)}</td></tr>")
    h.append("</tbody></table></div>")
    return "".join(h)
