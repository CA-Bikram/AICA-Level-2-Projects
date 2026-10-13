"""
BCM Open Items Dashboard - Sub Zone review (Streamlit)

Shows every open-item category the way it is presented in the BCM PowerPoint, one "slide" per category,
filtered to a Sub Zone. Every figure in every pivot is a link: click it to list the underlying items.

Run:   streamlit run app.py            (or double-click run_dashboard.bat)
       streamlit run app.py -- data.xlsx     to pre-load a workbook
"""
from __future__ import annotations

import io
import os
import sys
from datetime import date

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

import bcm_engine as eng
import bcm_render as rnd
from bcm_config import SECTIONS, SECTION_BY_KEY
from bcm_core import indian_int, normalize_header

st.set_page_config(page_title="BCM Open Items Dashboard", page_icon="📊", layout="wide")

CSS = """
<style>
.stApp { background: linear-gradient(135deg,#eef7ff 0%,#fff8ef 55%,#f4f0ff 100%); }
.block-container { padding-top: 2.6rem; max-width: 100%; }
[data-testid="stSidebar"] { background: linear-gradient(180deg,#f2f8ff,#fbf7ff); }
.slide-banner { color:#fff; border-radius:16px; padding:16px 26px; display:flex; align-items:center;
  justify-content:space-between; gap:20px; box-shadow:0 12px 30px rgba(30,58,138,.20); margin-bottom:14px; min-height:96px; }
.slide-banner h1 { color:#fff; font-size:27px; font-weight:900; margin:0; padding:0; line-height:1.2; }
.slide-banner .kicker { font-size:11.5px; letter-spacing:.12em; text-transform:uppercase; opacity:.8; font-weight:800; }
.slide-banner .sub { font-size:13px; opacity:.92; margin-top:4px; }
.slide-banner .art { flex:0 0 auto; margin:-8px 0; }
.slide-note { background:#ffffffcc; border-left:5px solid #0EA5E9; border-radius:10px; padding:10px 16px;
  font-size:15px; color:#102033; margin:4px 0 12px; }
.slide-head { font-weight:900; color:#0b3d91; font-size:18px; text-align:center; margin:2px 0 10px; }
ul.slide-bullets { margin:0 0 12px; padding-left:22px; }
ul.slide-bullets li { list-style:none; position:relative; margin:5px 0; font-size:15px; color:#102033; }
ul.slide-bullets li::before { content:"➤"; position:absolute; left:-22px; color:#0072bc; }
.slide-cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; margin:4px 0 14px; }
.scard { background:#fff; border:1px solid #dbe6f5; border-left:6px solid; border-radius:14px; padding:10px 14px;
  box-shadow:0 4px 14px rgba(15,40,90,.06); }
.scard b { display:block; font-size:15px; } .scard span { font-size:13.5px; color:#334155; }
table.act { border-collapse:collapse; width:100%; font-size:13px; background:#fff; border-radius:10px; overflow:hidden; }
table.act th { background:#38B6E8; color:#08223f; padding:6px 10px; text-align:left; }
table.act td { border:1px solid #cfe0f2; padding:7px 10px; vertical-align:middle; }
table.act td.st { font-weight:800; text-align:center; width:110px; }
.prev-head { font-weight:900; color:#0b3d91; font-size:17px; text-align:right; margin:22px 0 6px; }
.ag { position:relative; padding:2px 0 4px; min-height:92px; }
.ag .num { display:inline-block; color:#fff; font-weight:900; border-radius:8px; padding:2px 10px; margin-right:8px; }
.ag b { font-size:16.5px; }
.ag .stat { margin-top:8px; font-size:14px; color:#334155; }
.ag .stat .big { font-size:22px; font-weight:900; }
.ag .ic { position:absolute; right:4px; top:0; }
.drill-title { font-weight:900; color:#0b3d91; font-size:18px; }
.pill { display:inline-block; background:#e0f2fe; color:#075985; border-radius:999px; padding:3px 12px; font-weight:800; font-size:13px; margin-right:6px; }
</style>
"""
st.markdown(CSS, unsafe_allow_html=True)


@st.cache_resource
def pivot_component():
    return st.components.v2.component("bcm_pivot_table", css=rnd.PIVOT_CSS, js=rnd.PIVOT_JS)


PIVOT = pivot_component()


@st.cache_data(show_spinner="Reading Excel...")
def load(files: tuple, asof: date):
    return eng.load_files(list(files), asof)


def _files_from(widget_key):
    ups = st.session_state.get(widget_key) or []
    return tuple((u.getvalue(), u.name) for u in ups)


# ------------------------------------------------------------------------------------------- sidebar
with st.sidebar:
    st.markdown("## 📊 BCM Open Items")
    st.file_uploader("Current status Excel file(s)", type=["xlsx", "xlsm", "xls", "csv"], accept_multiple_files=True,
                     key="files_cur", help="One workbook with a sheet per open-item type (see the Data mapping page), "
                                           "or several files.")
    asof = st.date_input("Status as on", value=date.today(), format="DD-MM-YYYY", key="asof")
    with st.expander("Previous status (optional)"):
        st.file_uploader("Previous status Excel file(s)", type=["xlsx", "xlsm", "xls", "csv"],
                         accept_multiple_files=True, key="files_prev")
        prev_label = st.text_input("Previous status as on", value="15-June-26", key="prev_label")

files = _files_from("files_cur")
if not files:
    path = os.environ.get("BCM_FILE") or next((a for a in sys.argv[1:] if a.lower().endswith((".xlsx", ".xlsm", ".xls", ".csv"))), None)
    if st.session_state.get("demo"):
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample_BCM_data.xlsx")
    if path and os.path.exists(path):
        files = ((open(path, "rb").read(), os.path.basename(path)),)
CUR = load(files, asof) if files else {}
pfiles = _files_from("files_prev")
if not pfiles and st.session_state.get("demo"):
    pp = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample_BCM_previous.xlsx")
    if os.path.exists(pp):
        pfiles = ((open(pp, "rb").read(), os.path.basename(pp)),)
PREV = load(pfiles, asof) if pfiles else {}

if not CUR:
    st.markdown(rnd.banner("BCM Open Items Dashboard", "Upload the Excel file with the open-item sheets in the sidebar "
                           "to begin.", "overview", "#0072bc"), unsafe_allow_html=True)
    c = st.columns([1, 1, 2])
    if c[0].button("▶ Load demo data", type="primary", width="stretch"):
        st.session_state["demo"] = True
        st.rerun()
    st.info("Expected sheet names: " + "; ".join(f"**{s['title']}** → `{s['sheets'][0]}`" for s in SECTIONS))
    st.stop()


# ------------------------------------------------------------------------------------------- filters
def _uniq(vals):
    return sorted({v for v in vals if v and v != "Unclassified"}, key=str.lower)


all_sz = _uniq(v for d in CUR.values() if d["mapping"].get("subzone") for v in d["df"]["subzone"].unique())
all_sbu = _uniq(v for d in CUR.values() if d["mapping"].get("sbu") for v in d["df"]["sbu"].unique())
avail = [s for s in SECTIONS if s["key"] in CUR]
pages = ["overview"] + [s["key"] for s in SECTIONS] + ["mapping"]
page_label = {"overview": "🏠  Overview / Agenda", "mapping": "🧩  Data mapping & template"}
for i, s in enumerate(SECTIONS, 1):
    page_label[s["key"]] = f"{i:02d}  {s['agenda']}" + ("" if s["key"] in CUR else "  (no data)")

with st.sidebar:
    st.divider()
    subzone = st.selectbox("Sub Zone", ["All Sub Zones"] + all_sz, key="subzone")
    sbus = st.multiselect("SBU", all_sbu, key="sbus", placeholder="All SBUs")
    st.radio("Slide", pages, format_func=lambda k: page_label[k], key="page")

sig = (subzone, tuple(sbus), files and len(files), asof)
if st.session_state.get("_sig") != sig:
    st.session_state["_sig"] = sig
    st.session_state["drill"] = None


def apply_filters(d: dict | None) -> pd.DataFrame:
    if not d:
        return pd.DataFrame()
    df = d["df"]
    if subzone != "All Sub Zones" and d["mapping"].get("subzone"):
        df = df[df["subzone"] == subzone]
    if sbus and d["mapping"].get("sbu"):
        df = df[df["sbu"].isin(sbus)]
    return df


def go_page(k):
    def _cb():
        st.session_state["page"] = k
    return _cb


def nav_bar():
    page = st.session_state["page"]
    i = pages.index(page)
    c = st.columns([6, 1, 1])
    c[1].button("◀ Prev", on_click=go_page(pages[max(i - 1, 0)]), disabled=i == 0, width="stretch", key="prevbtn")
    c[2].button("Next ▶", on_click=go_page(pages[min(i + 1, len(pages) - 1)]), disabled=i == len(pages) - 1,
                width="stretch", key="nextbtn")


SZ_TXT = subzone if subzone != "All Sub Zones" else "All Sub Zones"


# ------------------------------------------------------------------------------------------- drill-down
def open_drill(sec_key, which, title, ids):
    st.session_state["drill"] = {"sec": sec_key, "which": which, "title": title, "ids": list(ids)}


def _display_frame(raw: pd.DataFrame) -> pd.DataFrame:
    out = pd.DataFrame(index=raw.index)
    for c in raw.columns:
        s = raw[c]
        if s.map(lambda v: hasattr(v, "strftime")).any():
            out[c] = s.map(lambda v: v.strftime("%d-%b-%Y") if hasattr(v, "strftime") else str(v))
            continue
        num = pd.to_numeric(s.replace("", None), errors="coerce")
        if num.notna().sum() == (s.astype(str).str.strip() != "").sum() and num.notna().any():
            out[c] = num
        else:
            out[c] = s.astype(str)
    return out.reset_index(drop=True)


def drill_panel(sec):
    d = st.session_state.get("drill")
    if not d or d["sec"] != sec["key"]:
        return
    src = (PREV if d["which"] == "prev" else CUR).get(sec["key"])
    if not src:
        return
    raw = src["raw"].iloc[d["ids"]]
    canon = src["df"].iloc[d["ids"]]
    st.markdown("<div style='height:6px'></div>", unsafe_allow_html=True)
    with st.container(border=True):
        h = st.columns([5, 3, 1.3])
        tag = "Previous status – " if d["which"] == "prev" else ""
        h[0].markdown(f"<div class='drill-title'>🔎 Drill-down: {tag}{d['title']}</div>", unsafe_allow_html=True)
        q = h[1].text_input("Search", key=f"dsearch_{sec['key']}", placeholder="Search these items…", label_visibility="collapsed")
        h[2].button("✕ Close", on_click=lambda: st.session_state.update(drill=None), width="stretch",
                    key=f"dclose_{sec['key']}")
        view = _display_frame(raw)
        if q.strip():
            mask = view.astype(str).apply(lambda s: s.str.contains(q.strip(), case=False, regex=False)).any(axis=1)
            view = view[mask]
        pills = f"<span class='pill'>Items: {len(view):,}</span>"
        if src["mapping"].get("amount") and "amount" in canon:
            amt = canon["amount"].sum() * eng.UNIT[sec.get("amount_source", "rupees")]
            pills += f"<span class='pill'>Value: ₹ {indian_int(amt)}</span>"
        st.markdown(pills, unsafe_allow_html=True)
        st.dataframe(view, hide_index=True, width="stretch", height=min(520, 40 + 35 * max(len(view), 1)))
        b = st.columns([1, 1, 5])
        b[0].download_button("⬇ CSV", view.to_csv(index=False).encode("utf-8-sig"), file_name=f"{sec['key']}_drilldown.csv",
                             mime="text/csv", width="stretch", key=f"dcsv_{sec['key']}")
        xb = io.BytesIO()
        view.to_excel(xb, index=False)
        b[1].download_button("⬇ Excel", xb.getvalue(), file_name=f"{sec['key']}_drilldown.xlsx",
                             width="stretch", key=f"dxl_{sec['key']}")


# ------------------------------------------------------------------------------------------- section page
def table_html(sec, df, lm, show_all=False):
    t = sec.get("type", "pivot")
    if t == "listing":
        return rnd.listing_html(df, sec, lm)
    if t == "summary":
        return rnd.summary_html(df, sec, lm, show_all)
    return rnd.pivot_html(eng.build_pivot(df, sec), sec, lm)


def mount(sec, html, lm, which):
    res = PIVOT(data={"html": html}, key=f"pv_{sec['key']}_{which}", on_cell_change=lambda: None)
    k = getattr(res, "cell", None) if res is not None else None
    if k and k in lm:
        title, ids = lm[k]
        open_drill(sec["key"], which, title, ids)


def section_page(sec):
    idx = [s["key"] for s in SECTIONS].index(sec["key"]) + 1
    accent = rnd.ACCENTS[(idx - 1) % len(rnd.ACCENTS)]
    data = CUR.get(sec["key"])
    df = apply_filters(data)

    # section-specific filters (e.g. Financial Year for PRF / VIT)
    extra_txt = ""
    for f in sec.get("filters", []):
        if data is not None and f in df and len(df):
            opts = sorted(df[f].unique(), key=eng.order_key)
            chosen = st.session_state.get(f"flt_{sec['key']}_{f}", [])
            if chosen:
                df = df[df[f].isin(chosen)]
                extra_txt = " · FY " + ", ".join(chosen)
    subtitle = f"Status as on {asof:%d-%b-%Y}{extra_txt}"
    st.markdown(rnd.banner(f"{sec['title']}: {SZ_TXT}", subtitle, sec["icon"], accent, f"BCM · {idx:02d}"),
                unsafe_allow_html=True)
    if data is None:
        st.warning(f"No sheet found for **{sec['title']}**. Add a sheet named `{sec['sheets'][0]}` "
                   f"(or one of: {', '.join(sec['sheets'][1:])}). See the *Data mapping & template* page.")
        return

    fcols = [f for f in sec.get("filters", []) if f in data["df"]]
    show_all = False
    if fcols or sec.get("type") == "summary":
        cc = st.columns([2, 2, 4])
        for i, f in enumerate(fcols):
            base = apply_filters(data)
            cc[i].multiselect("Financial Year" if f == "fy" else f, sorted(base[f].unique(), key=eng.order_key),
                              key=f"flt_{sec['key']}_{f}", placeholder="All")
        if sec.get("type") == "summary":
            show_all = cc[len(fcols)].toggle("Show fully verified locations", key=f"all_{sec['key']}")

    if sec.get("headline") == "cash" and len(df):
        crores = df["amount"].sum() / 1e7
        st.markdown(f"<div class='slide-head'>Rs {crores:,.2f} Crores receipts remain unaccounted in books due to "
                    f"non-preparation of CRs on time.</div>", unsafe_allow_html=True)
    if sec.get("bullets"):
        st.markdown(rnd.bullets(sec["bullets"]), unsafe_allow_html=True)
    if sec.get("cards"):
        st.markdown(rnd.cards(sec["cards"]), unsafe_allow_html=True)
    if sec.get("note"):
        st.markdown(f"<div class='slide-note'>{sec['note']}</div>", unsafe_allow_html=True)

    lm = rnd.LinkMap()
    html = table_html(sec, df, lm, show_all)
    if sec.get("actions"):
        c1, c2 = st.columns([3, 2])
        with c1:
            mount(sec, html, lm, "cur")
        with c2:
            st.markdown(rnd.actions_table(sec["actions"]), unsafe_allow_html=True)
    else:
        mount(sec, html, lm, "cur")
    st.caption("Click any figure to list the items behind it.")

    pdata = PREV.get(sec["key"])
    if pdata is not None:
        pdf = apply_filters(pdata)
        st.markdown(f"<div class='prev-head'>Previous Status as on {prev_label}</div>", unsafe_allow_html=True)
        plm = rnd.LinkMap()
        mount(sec, table_html(sec, pdf, plm, show_all), plm, "prev")

    drill_panel(sec)

    if sec.get("type", "pivot") == "pivot" and len(df):
        with st.expander("📈 Visual summary"):
            visual_summary(sec, df)


def visual_summary(sec, df):
    has_sum = any(m[0] == "sum" for m in sec["metrics"])
    val = (lambda g: g["amount"].sum() * eng.UNIT[sec.get("amount_source", "rupees")]) if has_sum else len
    leaf = sec["rows"][-1][0]
    by_leaf = df.groupby(leaf).apply(val, include_groups=False).sort_values(key=abs, ascending=False).head(15)
    pal = ["#0EA5E9", "#14B8A6", "#22C55E", "#F59E0B", "#F97316", "#EC4899", "#8B5CF6", "#6366F1"]
    c = st.columns(2)
    f1 = go.Figure(go.Bar(x=by_leaf.values, y=by_leaf.index, orientation="h",
                          marker=dict(color=[pal[i % 8] for i in range(len(by_leaf))], cornerradius=8)))
    f1.update_layout(title=f"By {sec['rows'][-1][1]}", height=max(300, 30 * len(by_leaf) + 80),
                     margin=dict(l=10, r=10, t=40, b=10), yaxis=dict(autorange="reversed"), plot_bgcolor="white")
    c[0].plotly_chart(f1, width="stretch", config={"displayModeBar": False})
    if sec.get("column"):
        col = sec["column"][0]
        order = eng.order_buckets(df[col].unique(), sec["column"][1], sec["column"][2])
        by_b = df.groupby(col).apply(val, include_groups=False).reindex(order)
        f2 = go.Figure(go.Bar(x=by_b.index, y=by_b.values, marker=dict(color=[pal[(i + 3) % 8] for i in range(len(by_b))],
                                                                         cornerradius=8)))
        f2.update_layout(title="By bucket", height=320, margin=dict(l=10, r=10, t=40, b=10), plot_bgcolor="white")
        c[1].plotly_chart(f2, width="stretch", config={"displayModeBar": False})


# ------------------------------------------------------------------------------------------- overview
def overview_page():
    st.markdown(rnd.banner(f"Discussion on Business Issues for {SZ_TXT}",
                           f"BCM – Agenda · a focused review of open financial, operational and control items · "
                           f"status as on {asof:%d-%b-%Y}", "overview", "#0072bc"), unsafe_allow_html=True)
    cols = st.columns(2)
    for i, sec in enumerate(SECTIONS):
        accent = rnd.ACCENTS[i % len(rnd.ACCENTS)]
        data = CUR.get(sec["key"])
        with cols[i % 2].container(border=True):
            if data is None:
                stat = "<span style='color:#94a3b8'>No data uploaded</span>"
            else:
                n, v = eng.section_stats(apply_filters(data), sec)
                lbl = "pending items" if sec.get("type") == "summary" else "open items"
                stat = f"<span class='big' style='color:{accent}'>{indian_int(n) or 0}</span> {lbl}"
                if v is not None:
                    stat += f" &nbsp;·&nbsp; <span class='big' style='color:{accent}'>{eng.smart_rupees(v)}</span>"
            st.markdown(f"<div class='ag'><div class='ic'>{rnd.icon_svg(sec['icon'], 54, accent, .35, 2.2)}</div>"
                        f"<span class='num' style='background:{accent}'>{i + 1:02d}</span>"
                        f"<b style='color:{accent}'>{sec['agenda']}</b><div class='stat'>{stat}</div></div>",
                        unsafe_allow_html=True)
            st.button("Open slide ›", key=f"open_{sec['key']}", on_click=go_page(sec["key"]))


# ------------------------------------------------------------------------------------------- mapping page
def template_bytes() -> bytes:
    bio = io.BytesIO()
    with pd.ExcelWriter(bio, engine="openpyxl") as w:
        for s in SECTIONS:
            pd.DataFrame(columns=[a[0] for a in s["fields"].values()]).to_excel(w, sheet_name=s["sheets"][0][:31], index=False)
    return bio.getvalue()


def mapping_page():
    st.markdown(rnd.banner("Data mapping & template", "Which sheet and which columns were used for every slide",
                           "clipboard", "#6366F1"), unsafe_allow_html=True)
    st.download_button("⬇ Download blank Excel template (all sheets)", template_bytes(), file_name="BCM_Open_Items_Template.xlsx")
    for s in SECTIONS:
        d = CUR.get(s["key"])
        with st.expander(f"{'✅' if d else '⚠️'}  {s['title']}" + (f" — {d['sheet']} ({len(d['df']):,} rows)" if d else " — sheet not found")):
            st.write("Accepted sheet names: " + ", ".join(f"`{x}`" for x in s["sheets"]))
            rows = []
            for f, aliases in s["fields"].items():
                rows.append({"Field": f, "Column used": (d["mapping"].get(f) if d else None) or "— not found —",
                             "Accepted headings": ", ".join(aliases[:8]) + (" …" if len(aliases) > 8 else "")})
            st.dataframe(pd.DataFrame(rows), hide_index=True, width="stretch")
            if s.get("derive"):
                st.caption("If a column is not found, these are derived automatically: " +
                           ", ".join(f"{k} ← {v[0].replace('_', ' ')}" for k, v in s["derive"].items()))


# ------------------------------------------------------------------------------------------- router
page = st.session_state["page"]
nav_bar()
if page == "overview":
    overview_page()
elif page == "mapping":
    mapping_page()
else:
    section_page(SECTION_BY_KEY[page])
