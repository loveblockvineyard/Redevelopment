import React, { useState, useMemo } from "react";
import {
  ComposedChart, Area, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea, Cell,
} from "recharts";

/* ----------------------------------------------------------------------------
   MARLBOROUGH ESTATE — REPLANTING PLANNER (free-form parcels + economics)
   Data from Vineyard_performance_2.xlsx. "base" = avg last-4-yr yield (t/ha).
   Sheet "Planted year" reads 2002 for TG 15/16 & TG2017 (contradicts names);
   treated as 2015 / 2017 — replant them by hand if 2002 is correct.
---------------------------------------------------------------------------- */
const CURRENT_YEAR = 2026;
const HORIZON = 15;

const BLOCKS = [
  { name: "TG 15/16",           variety: "SB",  year: 2015, ha: 11.22, base: 8.8 },
  { name: "TG2017",             variety: "SB",  year: 2017, ha: 9.25,  base: 9.8 },
  { name: "Back SB",            variety: "SB",  year: 2002, ha: 9.13,  base: 8.3 },
  { name: "Front SB",           variety: "SB",  year: 2002, ha: 4.01,  base: 8.3 },
  { name: "SB03",               variety: "SB",  year: 2001, ha: 1.68,  base: 14.5 },
  { name: "SB04",               variety: "SB",  year: 1990, ha: 5.33,  base: 9.7 },
  { name: "WS Sauvignon Blanc", variety: "SB",  year: 2004, ha: 10.99, base: 11.0 },
  { name: "A SB",               variety: "SB",  year: 2008, ha: 0.64,  base: 7.9 },
  { name: "F RSL",              variety: "RSL", year: 2008, ha: 2.98,  base: 4.12 },
  { name: "WB-Riesling",        variety: "RSL", year: 1997, ha: 1.10,  base: 10.3 },
  { name: "WS Pinot Gris",      variety: "PG",  year: 2004, ha: 1.83,  base: 10.4 },
  { name: "F PG",               variety: "PG",  year: 2008, ha: 8.42,  base: 4.9 },
  { name: "C18 - SB",           variety: "SB",  year: 2018, ha: 1.00,  base: 8.9 },
  { name: "E PG",               variety: "PG",  year: 2008, ha: 1.55,  base: 4.9 },
  { name: "SB2020",             variety: "SB",  year: 2020, ha: 2.51,  base: 2.0 },
  { name: "E GEW",              variety: "GEW", year: 2008, ha: 2.96,  base: 3.89 },
  { name: "WB-CHA",             variety: "CH",  year: 1997, ha: 0.83,  base: 5.0 },
  { name: "C18 - CH",           variety: "CH",  year: 2018, ha: 1.08,  base: 5.0 },
  { name: "E SB",               variety: "SB",  year: 2008, ha: 0.28,  base: 7.9 },
  { name: "F SB",               variety: "SB",  year: 2008, ha: 1.69,  base: 7.9 },
  { name: "SB 01",              variety: "SB",  year: 2005, ha: 3.56,  base: 12.0 },
  { name: "Front PG",           variety: "PG",  year: 2002, ha: 3.34,  base: 9.0 },
  { name: "WB-Pinot Gris",      variety: "PG",  year: 2016, ha: 1.00,  base: 11.0 },
  { name: "SB02",               variety: "SB",  year: 2005, ha: 3.14,  base: 12.0 },
  { name: "SB05",               variety: "SB",  year: 2005, ha: 3.90,  base: 10.3 },
  { name: "WB-Syrah",           variety: "SY",  year: 2020, ha: 0.10,  base: 1.0 },
  { name: "Someone's Darling",  variety: "PN",  year: 2005, ha: 8.80,  base: 7.7 },
  { name: "A 23",               variety: "SB",  year: 2023, ha: 7.90,  base: null, young: true, seed: [3, 6, 10, 10] },
];
const BMAP = Object.fromEntries(BLOCKS.map((b) => [b.name, b]));
export const APP_VERSION = "1.6.0";
const DEV_DEFAULTS = { ha: 4, rowSpace: 2.5, vineSpace: 1.8, vinesPerBay: 4, rowLen: 200, wires: 9, damM3: 3000, frostQty: 0 };
const cleanDev = (d) => { const out = { ...DEV_DEFAULTS }; if (d) Object.entries(d).forEach(([k, v]) => { if (typeof v === "number" && !isNaN(v)) out[k] = v; }); return out; };
const ORGANIC_BLOCKS = { "TG 15/16": 2026, "TG2017": 2026, "Back SB": 2026, "Front SB": 2026, "WS Sauvignon Blanc": 2026, "WS Pinot Gris": 2026, "SB2020": 2026, "Front PG": 2026, "Someone's Darling": 2025 }; // BioGro certified, name -> cert year
const VINTAGES = [CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2, CURRENT_YEAR + 3];

const VARIETIES = [
  { key: "SB",  label: "Sauvignon Blanc", short: "Sauv. Blanc", color: "#C8A12E" },
  { key: "PG",  label: "Pinot Gris",      short: "Pinot Gris",  color: "#B97B54" },
  { key: "RSL", label: "Riesling",        short: "Riesling",    color: "#7E9A3C" },
  { key: "GEW", label: "Gewürztraminer",  short: "Gewürz.",     color: "#C9869C" },
  { key: "CH",  label: "Chardonnay",      short: "Chardonnay",  color: "#A9772B" },
  { key: "SY",  label: "Syrah",           short: "Syrah",       color: "#5B2C4C" },
  { key: "PN",  label: "Pinot Noir",      short: "Pinot Noir",  color: "#8A322C" },
];
const VMETA = Object.fromEntries(VARIETIES.map((v) => [v.key, v]));

const C = {
  paper: "#E8EAE3", ink: "#16241D", panel: "#FCFCFA", tint: "#F1F3EC",
  line: "#D6DACE", green: "#1E4B3A", greenDeep: "#102C22",
  gold: "#B8901F", garnet: "#8A322C", muted: "#5C685F",
};

const f0 = (x) => Math.round(x).toLocaleString();
const f1 = (x) => (Math.round(x * 10) / 10).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const f2 = (x) => (Math.round(x * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (x) => { const s = x < 0 ? "-" : ""; const a = Math.abs(x); if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`; if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}k`; return `${s}$${Math.round(a)}`; };
const targetFor = (v, t) => (v === "SB" ? t.SB : v === "PG" ? t.PG : t.OTHER);
const priceFor = (v, p) => (v === "SB" ? p.SB : v === "PG" ? p.PG : p.OTHER);
function rampFactor(d, ramp) { if (d <= 1) return 0; if (d === 2) return ramp.y3; if (d === 3) return ramp.y4; return 1; }

/* ---------- Development budget engine (from 619 Brookby Rd template) ---------- */
function devQty(d) {
  const rs = Math.max(0.1, d.rowSpace), vs = Math.max(0.1, d.vineSpace), vpb = Math.max(1, d.vinesPerBay), rl = Math.max(10, d.rowLen), H = Math.max(0, d.ha);
  const postSpace = vs * vpb;
  const plantsHa = 10000 / (rs * vs), postsHa = 10000 / (rs * postSpace);
  const rowsHa = 10000 / (rs * rl), rowsTot = rowsHa * H;
  const kmRows = (H * 10000) / rs / 1000;
  return { postSpace, plantsHa, postsHa, rowsHa, rowsTot, kmRows, plants: plantsHa * H, posts: postsHa * H, strainers: 2 * rowsTot, coils: kmRows * d.wires, wireStrainers: d.wires * rowsTot, H };
}
const DEV_CATS = [
  { key: "prep", label: "Land preparation" }, { key: "tmat", label: "Trellis materials" }, { key: "tins", label: "Trellis install" },
  { key: "wire", label: "Wire work" }, { key: "plant", label: "Planting" }, { key: "irrig", label: "Irrigation (excl. water supply)" }, { key: "vines", label: "Vines" },
];
const DEV_INFRA_CATS = [{ key: "water", label: "Water storage" }, { key: "frost", label: "Frost protection" }];
const DEV_ITEMS = [
  { id: "soil",     cat: "prep",  label: "Soil testing & recommendation",            basis: "per test",        unit: 100,   qty: (q) => 2 },
  { id: "gps",      cat: "prep",  label: "GPS mapping / surveying for layout",       basis: "per mapping",     unit: 2000,  qty: (q) => 1 },
  { id: "glyph",    cat: "prep",  label: "Spraying off — glyphosate (6 L/ha)",       basis: "L",               unit: 18.5,  qty: (q) => 6 * q.H },
  { id: "sprayc",   cat: "prep",  label: "Spraying off — contractor (0.8 hr/ha)",    basis: "hours",           unit: 130,   qty: (q) => 0.8 * q.H },
  { id: "rip",      cat: "prep",  label: "Ripping (3 hr/ha)",                        basis: "hours",           unit: 200,   qty: (q) => 3 * q.H },
  { id: "disc",     cat: "prep",  label: "Cultivation — discs/plough (2 hr/ha)",     basis: "hours",           unit: 200,   qty: (q) => 2 * q.H },
  { id: "rota",     cat: "prep",  label: "Cultivation — rotatiller (2 hr/ha)",       basis: "hours",           unit: 200,   qty: (q) => 2 * q.H },
  { id: "roll",     cat: "prep",  label: "Rolling pre-planting (1.5 hr/ha)",         basis: "hours",           unit: 180,   qty: (q) => 1.5 * q.H },
  { id: "lime",     cat: "prep",  label: "Pre-plant fert & lime (2 t/ha)",           basis: "t",               unit: 70,    qty: (q) => 2 * q.H },
  { id: "fertapp",  cat: "prep",  label: "Fert application",                         basis: "per ha",          unit: 100,   qty: (q) => q.H },
  { id: "strain",   cat: "tmat",  label: "Strainers 2.4 m × 150 mm",                 basis: "per strainer",    unit: 48.35, qty: (q) => q.strainers },
  { id: "posts",    cat: "tmat",  label: "Metal posts — EcoTrellis",                 basis: "per post",        unit: 19,    qty: (q) => q.posts },
  { id: "stays",    cat: "tmat",  label: "Stays 2.4 m pencil-pointed",               basis: "per stay",        unit: 15,    qty: (q) => q.strainers },
  { id: "stayblk",  cat: "tmat",  label: "Stay blocks 450 mm",                       basis: "per block",       unit: 3.2,   qty: (q) => q.strainers },
  { id: "coil",     cat: "tmat",  label: "Wire 2.5 HT (1,000 m coils)",              basis: "per coil",        unit: 130,   qty: (q) => q.coils },
  { id: "wstrain",  cat: "tmat",  label: "Wire strainers",                           basis: "each",            unit: 3.58,  qty: (q) => q.wireStrainers },
  { id: "klimaB",   cat: "tmat",  label: "KLIMA clips black (8/post + irrig)",       basis: "per clip",        unit: 0.27,  qty: (q) => q.posts * 9 },
  { id: "klimaR",   cat: "tmat",  label: "KLIMA clips red (2/post)",                 basis: "per clip",        unit: 0.29,  qty: (q) => q.posts * 4 },
  { id: "strin",    cat: "tins",  label: "Strainer install",                         basis: "per strainer",    unit: 23,    qty: (q) => q.strainers },
  { id: "stayin",   cat: "tins",  label: "Stay install",                             basis: "per assembly",    unit: 7.5,   qty: (q) => q.strainers },
  { id: "postin",   cat: "tins",  label: "Post install incl. laying out",            basis: "per post",        unit: 1.7,   qty: (q) => q.posts },
  { id: "runwire",  cat: "wire",  label: "Run and strain wires",                     basis: "per coil",        unit: 28,    qty: (q) => q.coils },
  { id: "clips",    cat: "wire",  label: "Install trellis clips (15 hr/ha)",         basis: "hours",           unit: 40,    qty: (q) => 15 * q.H },
  { id: "lift",     cat: "wire",  label: "Lift wires, jiffy-clip irrigation",        basis: "hours",           unit: 40,    qty: (q) => 25 },
  { id: "cross",    cat: "plant", label: "Crossmark (1.2 hr/ha)",                    basis: "hours",           unit: 200,   qty: (q) => 1.2 * q.H },
  { id: "plvine",   cat: "plant", label: "Planting vines (machine)",                 basis: "per vine",        unit: 0.6,   qty: (q) => q.plants },
  { id: "guard",    cat: "plant", label: "Spray guards",                             basis: "per guard",       unit: 0.38,  qty: (q) => q.plants },
  { id: "stake",    cat: "plant", label: "Bamboo stakes 1.2 m",                      basis: "per stake",       unit: 0.2,   qty: (q) => q.plants },
  { id: "stakein",  cat: "plant", label: "Install stakes & guards (3 hr/ha)",        basis: "hours",           unit: 40,    qty: (q) => 3 * q.H },
  { id: "irrdes",   cat: "irrig", label: "Irrigation design & install (headworks, mains)", basis: "PC sum / ha", unit: 8000, qty: (q) => q.H },
  { id: "drip",     cat: "irrig", label: "Install dripline (10 coils/ha)",           basis: "per coil",        unit: 16,    qty: (q) => 10 * q.H },
  { id: "taps",     cat: "irrig", label: "End taps & bungees (2 hr/ha)",             basis: "hours",           unit: 40,    qty: (q) => 2 * q.H },
  { id: "ctrl",     cat: "irrig", label: "Controller and electrical",                basis: "PC sum",          unit: 3000,  qty: (q) => 1 },
  { id: "power",    cat: "irrig", label: "Power supply / irrigation contingency",    basis: "PC sum",          unit: 5000,  qty: (q) => 1 },
  { id: "vine",     cat: "vines", label: "Vines (standard, no royalties)",           basis: "per vine",        unit: 8.5,   qty: (q) => q.plants },
  { id: "dam",      cat: "water", label: "Dam construction (design, consent, build)", basis: "per m³",         unit: 25,    qty: (q, d) => d.damM3 },
  { id: "fans",     cat: "frost", label: "Frost protection (fans)",                  basis: "PC sum",          unit: 55000, qty: (q, d) => d.frostQty },
];

const RAMP_STOPS = [[0, [42, 38, 34]], [0.22, [126, 52, 42]], [0.46, [176, 108, 46]], [0.72, [150, 138, 62]], [1, [46, 107, 78]]];
function ratioColor(r) {
  const t = Math.max(0, Math.min(1, r));
  for (let i = 1; i < RAMP_STOPS.length; i++) {
    if (t <= RAMP_STOPS[i][0]) { const [t0, c0] = RAMP_STOPS[i - 1], [t1, c1] = RAMP_STOPS[i]; const k = (t - t0) / (t1 - t0 || 1); const mix = c0.map((v, j) => Math.round(v + (c1[j] - v) * k)); return `rgb(${mix[0]},${mix[1]},${mix[2]})`; }
  }
  return "rgb(46,107,78)";
}

let _id = 0; const nid = () => ++_id;

/* ---- auto-fill: priority order, splits blocks to hit haTarget/yr exactly ---- */
function autoFill(haTarget, strategy, minAge, startYear, targets, active) {
  const maxAge = CURRENT_YEAR - 1990;
  const score = (b) => { const tg = targetFor(b.variety, targets), yl = b.base == null ? tg : b.base; return (CURRENT_YEAR - b.year) / maxAge + Math.max(0, (tg - yl) / tg); };
  let q = BLOCKS.filter((b) => CURRENT_YEAR - b.year >= minAge && !(active && active[b.name] === false)).slice();
  if (strategy === "age") q.sort((a, b) => a.year - b.year || (a.base ?? 99) - (b.base ?? 99));
  else if (strategy === "yield") q.sort((a, b) => (a.base ?? 99) - (b.base ?? 99) || a.year - b.year);
  else q.sort((a, b) => score(b) - score(a));
  const entries = []; let year = startYear, budget = haTarget; const last = startYear + HORIZON - 1;
  if (haTarget <= 0) return entries;
  for (const b of q) {
    let rem = b.ha;
    while (rem > 1e-9 && year <= last) {
      const take = Math.min(rem, budget);
      entries.push({ id: nid(), block: b.name, ha: +take.toFixed(2), year, variety: b.variety, costOverride: null, yieldOverride: null });
      rem -= take; budget -= take;
      if (budget < 1e-9) { year++; budget = haTarget; }
    }
    if (year > last) break;
  }
  return entries;
}

/* ----------------------------------------------------------------------------
   MODEL (entry-driven, variety-aware, partial blocks)
---------------------------------------------------------------------------- */
function runModel(p, entries, blockYields, active, blockDecline, blockPrice, blockOrg, purchased) {
  const { targets, ramp, price } = p;
  const r = p.discount / 100, spread = [0.6, 0.25, 0.15];
  const isOff = (n) => active && active[n] === false;
  const declineOf = (b) => ((blockDecline && blockDecline[b.name] != null) ? blockDecline[b.name] : p.decline) / 100;
  const plantYearOf = (e) => (e.variety === "RETIRE" ? Infinity : e.year + (e.fallow || 0));
  const regimePriceAt = (b, variety, y) => { const cy = blockOrg && blockOrg[b.name]; const org = cy != null && y >= cy; return priceFor(variety, org ? p.priceOrg : price); };
  const priceOfBlockAt = (b, y) => ((blockPrice && blockPrice[b.name] != null) ? blockPrice[b.name] : regimePriceAt(b, b.variety, y));
  const A0 = CURRENT_YEAR; // first assumption year
  const baseYield = (b, y) => {
    const ay = blockYields && blockYields[b.name];
    const cell = (i) => { const v = ay && ay[i]; return (typeof v === "number" && !isNaN(v) && v > 0) ? v : null; };
    if (y <= A0 + 3) {
      const c = cell(Math.max(0, y - A0));
      if (c != null) return c;
      if (b.base == null) return b.young ? targetFor("SB", targets) * rampFactor(y - b.year, ramp) : 0;
      return b.base; // assumption years default to the file average (flat)
    }
    const anchor = cell(3) ?? cell(2) ?? cell(1) ?? cell(0) ?? b.base;
    if (anchor == null) return b.young ? targetFor("SB", targets) * rampFactor(y - b.year, ramp) : 0;
    return anchor * Math.pow(1 - declineOf(b), y - (A0 + 3)); // taper beyond 2029 at the block's own rate
  };

  const byBlock = {}; entries.forEach((e) => (byBlock[e.block] ||= []).push(e));

  const prod = (y, useEntries) => {
    const v = { SB: 0, PG: 0, RSL: 0, GEW: 0, CH: 0, SY: 0, PN: 0 };
    const rv = { SB: 0, PG: 0, RSL: 0, GEW: 0, CH: 0, SY: 0, PN: 0 }; let estHa = 0; let orgT = 0;
    const ov = { SB: 0, PG: 0, RSL: 0, GEW: 0, CH: 0, SY: 0, PN: 0 }; let unpl = 0; let purchT = 0;
    const isOrg = (b) => { const cy = blockOrg && blockOrg[b.name]; return cy != null && y >= cy; };
    for (const b of BLOCKS) {
      if (isOff(b.name)) continue;
      const bPrice = priceOfBlockAt(b, y); const bOrg = isOrg(b);
      const es = useEntries ? byBlock[b.name] || [] : [];
      const alloc = es.reduce((s, e) => s + e.ha, 0);
      const remT = Math.max(0, b.ha - alloc) * baseYield(b, y);
      v[b.variety] += remT; rv[b.variety] += remT * bPrice; if (bOrg) { orgT += remT; ov[b.variety] += remT; }
      for (const e of es) {
        if (y < e.year) { const t = e.ha * baseYield(b, y); v[b.variety] += t; rv[b.variety] += t * bPrice; if (bOrg) { orgT += t; ov[b.variety] += t; } }
        else { const pY = plantYearOf(e); if (y < pY) { unpl += e.ha; } else { const eY = e.yieldOverride ?? targetFor(e.variety, targets); const fac = rampFactor(y - pY, ramp); const t = e.ha * eY * fac; v[e.variety] += t; rv[e.variety] += t * regimePriceAt(b, e.variety, y); if (bOrg) { orgT += t; ov[e.variety] += t; } if (fac < 1) estHa += e.ha; } }
      }
    }
    if (purchased && purchased.rates) {
      const idx = Math.max(0, y - p.startYear); const pOrg = purchased.org != null && y >= purchased.org;
      for (const k of ["SB", "PG", "PN"]) { const a = purchased.rates[k] || []; const t = a.length ? (a[Math.min(idx, a.length - 1)] || 0) : 0; if (!t) continue; v[k] += t; purchT += t; if (pOrg) { orgT += t; ov[k] += t; } }
    }
    v.total = VARIETIES.reduce((s, x) => s + v[x.key], 0);
    v.purchT = purchT;
    v.revByVar = rv;
    v.rev = VARIETIES.reduce((s, x) => s + rv[x.key], 0);
    v.orgT = orgT; v.swnzT = v.total - orgT; v.orgV = ov; v.unplHa = unpl;
    v.estHa = estHa; return v;
  };

  const full = [];
  for (let i = 0; i < p.econYears; i++) { const y = p.startYear + i; full.push({ year: y, prog: prod(y, true), base: prod(y, false) }); }
  const series = full.slice(0, HORIZON).map((f) => ({ year: f.year, ...f.prog, baseTotal: f.base.total }));
  const current = full[0].base.total - (full[0].base.purchT || 0);
  const matIdx = Math.min(p.econYears - 1, HORIZON + 6);
  const matP = full[matIdx].prog, matB = full[matIdx].base;

  const capex = Array(p.econYears).fill(0);
  for (const e of entries) { if (isOff(e.block) || e.variety === "RETIRE") continue; const eCost = e.costOverride ?? p.costHa; const b0 = (e.year + (e.fallow || 0)) - p.startYear; spread.forEach((w, k) => { if (b0 + k >= 0 && b0 + k < p.econYears) capex[b0 + k] += e.ha * eCost * w; }); }
  const cash = []; let cum = 0, cumD = 0, peak = 0, spay = null, dpay = null;
  for (let i = 0; i < p.econYears; i++) {
    const incRev = full[i].prog.rev - full[i].base.rev, save = (p.opexHa || 0) * (full[i].prog.unplHa || 0), cap = capex[i], net = incRev + save - cap, d = net / Math.pow(1 + r, i);
    cum += net; cumD += d; peak = Math.min(peak, cum);
    if (spay === null && i > 0 && cum >= 0) spay = full[i].year;
    if (dpay === null && i > 0 && cumD >= 0) dpay = full[i].year;
    cash.push({ year: full[i].year, incRev, save, capex: -cap, net, cum, cumD });
  }
  const npv = cumD;
  const netArr = cash.map((c) => c.net);
  const npvAt = (rr) => netArr.reduce((s, n, i) => s + n / Math.pow(1 + rr, i), 0);
  let irr = null, lo = -0.4, hi = 1.0, flo = npvAt(lo);
  if (flo * npvAt(hi) < 0) { for (let k = 0; k < 80; k++) { const mid = (lo + hi) / 2, fm = npvAt(mid); if (flo * fm <= 0) hi = mid; else { lo = mid; flo = fm; } } irr = (lo + hi) / 2; }

  const totalReplantedHa = entries.reduce((s, e) => s + (e.variety === "RETIRE" ? 0 : e.ha), 0);
  const matMargin = matP.rev - matB.rev;

  const entryRows = entries.filter((e) => !isOff(e.block)).map((e) => {
    const b = BMAP[e.block]; const oldY = baseYield(b, p.startYear); const retire = e.variety === "RETIRE";
    const newTgt = retire ? 0 : (e.yieldOverride ?? targetFor(e.variety, targets));
    const pY = e.year + (e.fallow || 0);
    const oldInc = e.ha * oldY * priceOfBlockAt(b, p.startYear), newInc = retire ? 0 : e.ha * newTgt * regimePriceAt(b, e.variety, pY + 4);
    const margin = (retire ? (p.opexHa || 0) * e.ha : newInc) - oldInc, capexB = retire ? 0 : e.ha * (e.costOverride ?? p.costHa);
    const partial = e.ha < b.ha - 0.01;
    return { id: e.id, name: e.block, oldVariety: b.variety, variety: e.variety, changed: !retire && b.variety !== e.variety, retire, fallow: e.fallow || 0, partial, ha: e.ha, oldY, newTgt, margin, capexB, pay: retire ? null : (margin > 0 ? capexB / margin : null), year: e.year };
  }).sort((x, y) => (x.pay ?? 1e9) - (y.pay ?? 1e9));

  const gridRows = entries.filter((e) => !isOff(e.block)).map((e) => {
    const b = BMAP[e.block]; const partial = e.ha < b.ha - 0.01;
    const pY = plantYearOf(e);
    const ratios = []; for (let i = 0; i < HORIZON; i++) { const y = p.startYear + i; ratios.push(y < e.year ? -1 : y < pY ? -2 : rampFactor(y - pY, ramp)); }
    return { id: e.id, name: e.block, ha: e.ha, partial, variety: e.variety, changed: b.variety !== e.variety, year: e.year, planted: b.year, ratios };
  }).sort((x, y) => x.year - y.year || y.ha - x.ha);

  const scheduleByYear = [];
  for (let i = 0; i < HORIZON; i++) { const y = p.startYear + i; const row = { year: y, total: 0 }; VARIETIES.forEach((vv) => (row[vv.key] = 0)); entries.filter((e) => e.variety !== "RETIRE" && (e.year + (e.fallow || 0)) === y && !isOff(e.block)).forEach((e) => { row[e.variety] += e.ha; row.total += e.ha; }); scheduleByYear.push(row); }

  const scatter = BLOCKS.filter((b) => !isOff(b.name)).map((b) => ({ name: b.name, variety: b.variety, ha: b.ha, year: b.year, age: CURRENT_YEAR - b.year, yield: baseYield(b, p.startYear) }));

  const AB = BLOCKS.filter((b) => !isOff(b.name));
  const totalHa = AB.reduce((s, b) => s + b.ha, 0);
  const avgAge = totalHa ? AB.reduce((s, b) => s + (CURRENT_YEAR - b.year) * b.ha, 0) / totalHa : 0;
  const ha20 = AB.filter((b) => CURRENT_YEAR - b.year >= 20).reduce((s, b) => s + b.ha, 0);
  const trough = series.reduce((mn, s) => (s.total < mn.total ? s : mn), series[0]);
  let recoveryYear = null; for (const f of full) if (f.year > trough.year && f.prog.total >= current) { recoveryYear = f.year; break; }

  return {
    series, scatter, gridRows, scheduleByYear, entryRows, cash, matP, matB,
    kpis: { totalHa, nBlocks: AB.length, avgAge, ha20, ha20pct: totalHa ? (ha20 / totalHa) * 100 : 0, current, currentYield: totalHa ? current / totalHa : 0 },
    plan: { totalReplantedHa, nEntries: entries.length, nChanged: entries.filter((e) => BMAP[e.block].variety !== e.variety).length, trough, recoveryYear, maturedTotal: matP.total - (matP.purchT || 0), maturedYield: totalHa ? (matP.total - (matP.purchT || 0)) / totalHa : 0, maturedVsToday: (matP.total - (matP.purchT || 0)) - current, maturedVsBase: matP.total - matB.total },
    econ: { npv, irr, spay, dpay, peak, totalCapex: totalReplantedHa * p.costHa, matMargin },
    varSummary: VARIETIES.map((v) => ({ key: v.key, current: series[0][v.key], matured: matP[v.key], delta: matP[v.key] - series[0][v.key] })),
  };
}

/* ---------- small parts ---------- */
function Swatch({ c, size = 11 }) { return <span style={{ display: "inline-block", width: size, height: size, borderRadius: 2, background: c, flex: "0 0 auto" }} />; }
function Kpi({ v, u, l, accent }) { return <div className="vd-kpi"><div className="vd-kpi-v"><span className={accent === "garnet" ? "garnet" : ""}>{v}</span> <i>{u}</i></div><div className="vd-kpi-l">{l}</div></div>; }
function SectionHead({ n, title, sub }) { return <div className="vd-sh"><span className="vd-sh-n">{n}</span><div><div className="vd-sh-t">{title}</div><div className="vd-sh-s">{sub}</div></div></div>; }
function Stat({ big, unit, caption, note, tone }) { return <div className={`vd-stat ${tone || ""}`}><div className="vd-stat-v">{big}<i>{unit}</i></div><div className="vd-stat-c">{caption}</div><div className="vd-stat-n">{note}</div></div>; }
function Num({ label, value, set, step, suffix, prefix, hint, min = 0 }) {
  return <label className="vd-num"><span className="vd-num-l">{label}{hint && <em>{hint}</em>}</span>
    <span className="vd-num-in"><button onClick={() => set((v) => Math.max(min, +(v - step).toFixed(2)))}>–</button><span>{prefix || ""}{(typeof value === "number" && !isNaN(value) ? value : 0).toLocaleString()}{suffix || ""}</span><button onClick={() => set((v) => +(v + step).toFixed(2))}>+</button></span></label>;
}
function VarPair({ oldV, newV }) {
  const retired = newV === "RETIRE";
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Swatch c={VMETA[oldV].color} size={9} />{VMETA[oldV].short}
    {retired ? <><span style={{ color: C.garnet, fontFamily: "IBM Plex Mono", fontSize: 11 }}>→</span><b style={{ color: C.garnet }}>Pulled out</b></> :
    oldV !== newV && <><span style={{ color: C.garnet, fontFamily: "IBM Plex Mono", fontSize: 11 }}>→</span><Swatch c={VMETA[newV].color} size={9} /><b style={{ color: C.ink }}>{VMETA[newV].short}</b></>}</span>;
}
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null; const row = payload[0]?.payload || {};
  return <div className="vd-tt"><div className="vd-tt-h">{label}</div>{VARIETIES.filter((v) => row[v.key] > 0.05).map((v) => <div className="vd-tt-r" key={v.key}><span style={{ display: "flex", alignItems: "center", gap: 6 }}><Swatch c={v.color} />{v.short}</span><b>{f1(row[v.key])}</b></div>)}
    <div className="vd-tt-r vd-tt-tot"><span>Total supply</span><b>{f1(row.total)} t</b></div><div className="vd-tt-r vd-tt-sub"><span>Without replanting</span><b>{f1(row.baseTotal)} t</b></div></div>;
}
function ScatterTip({ active, payload }) {
  if (!active || !payload?.length) return null; const d = payload[0].payload;
  return <div className="vd-tt"><div className="vd-tt-h" style={{ display: "flex", alignItems: "center", gap: 6 }}><Swatch c={VMETA[d.variety].color} />{d.name}</div>
    <div className="vd-tt-r"><span>{VMETA[d.variety].label}</span><b>{d.ha} ha</b></div><div className="vd-tt-r"><span>Planted</span><b>{d.year} · {d.age} yr</b></div><div className="vd-tt-r"><span>Current yield</span><b>{f1(d.yield)} t/ha</b></div></div>;
}
function ScheduleTip({ active, payload, label }) {
  if (!active || !payload?.length) return null; const row = payload[0].payload;
  return <div className="vd-tt"><div className="vd-tt-h">{label}</div>{VARIETIES.filter((v) => row[v.key] > 0.001).map((v) => <div className="vd-tt-r" key={v.key}><span style={{ display: "flex", alignItems: "center", gap: 6 }}><Swatch c={v.color} />{v.short}</span><b>{f1(row[v.key])} ha</b></div>)}<div className="vd-tt-r vd-tt-tot"><span>Replanted</span><b>{f1(row.total)} ha</b></div></div>;
}
function CashTip({ active, payload, label }) {
  if (!active || !payload?.length) return null; const d = payload[0].payload;
  return <div className="vd-tt"><div className="vd-tt-h">{label}</div><div className="vd-tt-r"><span>Extra fruit income</span><b>{money(d.incRev)}</b></div>{d.save > 0 && <div className="vd-tt-r"><span>Opex saved (unplanted)</span><b>{money(d.save)}</b></div>}<div className="vd-tt-r"><span>Replant spend</span><b>{money(d.capex)}</b></div><div className="vd-tt-r vd-tt-tot"><span>Net cash</span><b>{money(d.net)}</b></div><div className="vd-tt-r vd-tt-sub"><span>Cumulative</span><b>{money(d.cum)}</b></div><div className="vd-tt-r vd-tt-sub"><span>Cumulative (PV)</span><b>{money(d.cumD)}</b></div></div>;
}
function SensBlock({ title, items }) {
  const maxAbs = Math.max(...items.map((i) => Math.abs(i.npv)), 1);
  return <div className="vd-sens"><div className="vd-sens-h">{title}</div>{items.map((it, i) => { const pct = (Math.abs(it.npv) / maxAbs) * 50, pos = it.npv >= 0; return <div className={`vd-sens-row ${it.base ? "base" : ""}`} key={i}><span className="vd-sens-lab">{it.label}</span><span className="vd-sens-track"><span className="vd-sens-mid" /><span className="vd-sens-bar" style={{ left: pos ? "50%" : `${50 - pct}%`, width: `${pct}%`, background: pos ? C.green : C.garnet }} /></span><span className={`vd-sens-val ${pos ? "pos" : "neg"}`}>{money(it.npv)}</span></div>; })}</div>;
}

/* ----------------------------------------------------------------------------
   MAIN
---------------------------------------------------------------------------- */
export default function VineyardPlanner({ supa = null, user = null, onSignOut = null } = {}) {
  const [startYear, setStartYear] = useState(2026);
  const [refPace, setRefPace] = useState(5);
  const [strategy, setStrategy] = useState("priority");
  const [minAge, setMinAge] = useState(15);
  const [decline, setDecline] = useState(1.5);
  const [tSB, setTSB] = useState(12);
  const [tPG, setTPG] = useState(8.5);
  const [tOther, setTOther] = useState(6.75);
  const [rY3, setRY3] = useState(40);
  const [rY4, setRY4] = useState(70);
  const [discount, setDiscount] = useState(7);
  const [econYears, setEconYears] = useState(25);
  const [costHa, setCostHa] = useState(59345); // standard = development budget build-up at template design
  const [opexHa, setOpexHa] = useState(25000); // vineyard running cost saved on unplanted land
  const [pSB, setPSB] = useState(1800);
  const [pPG, setPPG] = useState(1600);
  const [pOther, setPOther] = useState(1500);
  const [oSB, setOSB] = useState(2400); const [oPG, setOPG] = useState(2100); const [oOther, setOOther] = useState(1900);
  const [blockOrg, setBlockOrg] = useState(() => { const o = {}; Object.entries(ORGANIC_BLOCKS).forEach(([n, y]) => { if (BMAP[n]) o[n] = y; }); return o; }); // name -> certification year (absent = SWNZ)
  const setBOrgOn = (name, on) => setBlockOrg((p) => { const n = { ...p }; if (on) n[name] = n[name] ?? CURRENT_YEAR; else delete n[name]; return n; });
  const setBOrgYear = (name, value) => setBlockOrg((p) => { const v = parseInt(value, 10); return { ...p, [name]: isNaN(v) ? CURRENT_YEAR : Math.max(1990, Math.min(CURRENT_YEAR + HORIZON, v)) }; });

  const [entries, setEntries] = useState(() => autoFill(5, "priority", 15, 2026, { SB: 12, PG: 8.5, OTHER: 6.75 }));
  const [blockYields, setBlockYields] = useState(() => { const o = {}; BLOCKS.forEach((b) => { o[b.name] = b.seed ? b.seed.slice() : (b.base == null ? [null, null, null, null] : [b.base, b.base, b.base, b.base]); }); return o; });
  const [active, setActive] = useState(() => { const o = {}; BLOCKS.forEach((b) => (o[b.name] = true)); return o; });
  const toggleBlock = (name) => setActive((p) => ({ ...p, [name]: !p[name] }));
  const [blockDecline, setBlockDecline] = useState(() => { const o = {}; BLOCKS.forEach((b) => (o[b.name] = null)); return o; });
  const setBDecline = (name, value) => setBlockDecline((p) => { const v = parseFloat(value); const nv = (value === "" || isNaN(v) || v === decline) ? null : Math.max(0, v); return { ...p, [name]: nv }; });
  const [blockPrice, setBlockPrice] = useState(() => { const o = {}; BLOCKS.forEach((b) => (o[b.name] = null)); return o; });
  const setBPrice = (b, value) => setBlockPrice((p) => { const v = parseFloat(value); const cy = blockOrg[b.name]; const def = priceFor(b.variety, cy != null && CURRENT_YEAR >= cy ? params.priceOrg : params.price); const nv = (value === "" || isNaN(v) || v === def) ? null : Math.max(0, Math.round(v)); return { ...p, [b.name]: nv }; });
  const [dev, setDev] = useState({ ha: 4, rowSpace: 2.5, vineSpace: 1.8, vinesPerBay: 4, rowLen: 200, wires: 9, damM3: 3000, frostQty: 0 });
  const setDevP = (k, v) => setDev((p) => ({ ...p, [k]: typeof v === "function" ? v(p[k]) : v }));
  const [devCost, setDevCost] = useState({});
  const [devOff, setDevOff] = useState({});
  const toggleDevItem = (id) => setDevOff((p) => ({ ...p, [id]: !p[id] }));
  const setDevUnit = (id, value, def) => setDevCost((p) => { const v = parseFloat(value); const nv = (value === "" || isNaN(v) || v === def) ? null : Math.max(0, v); const n = { ...p }; if (nv == null) delete n[id]; else n[id] = nv; return n; });
  /* ---------- Shared plan: auto-load + autosave + live sync ---------- */
  const getSnapshot = () => ({ v: APP_VERSION, startYear, refPace, strategy, minAge, decline, tSB, tPG, tOther, rY3, rY4, discount, econYears, costHa, opexHa, pSB, pPG, pOther, oSB, oPG, oOther, entries, blockYields, active, blockDecline, blockPrice, blockOrg, dev, devCost, devOff, extract, purch, purchOrg });
  const applySnapshot = (s) => { if (!s) return; const S = (fn, v) => v !== undefined && fn(v);
    S(setStartYear, s.startYear); S(setRefPace, s.refPace); S(setStrategy, s.strategy); S(setMinAge, s.minAge); S(setDecline, s.decline);
    S(setTSB, s.tSB); S(setTPG, s.tPG); S(setTOther, s.tOther); S(setRY3, s.rY3); S(setRY4, s.rY4); S(setDiscount, s.discount);
    S(setEconYears, s.econYears); S(setCostHa, s.costHa); S(setOpexHa, s.opexHa); S(setPSB, s.pSB); S(setPPG, s.pPG); S(setPOther, s.pOther);
    S(setOSB, s.oSB); S(setOPG, s.oPG); S(setOOther, s.oOther); S(setEntries, s.entries); S(setBlockYields, s.blockYields);
    S(setActive, s.active); S(setBlockDecline, s.blockDecline); S(setBlockPrice, s.blockPrice); S(setBlockOrg, s.blockOrg);
    setDev(cleanDev(s.dev)); S(setDevCost, s.devCost); S(setDevOff, s.devOff); S(setExtract, s.extract); S(setPurch, s.purch); if (s.purchOrg !== undefined) setPurchOrg(s.purchOrg); };
  const [scnMsg, setScnMsg] = useState(supa ? "Loading shared plan\u2026" : "");
  const saveTimer = React.useRef(null); const lastSynced = React.useRef(""); const skipNext = React.useRef(false); const lastAudit = React.useRef(0); const booted = React.useRef(false);
  React.useEffect(() => { if (!supa) return; let ch = null; (async () => {
      try { const { data } = await supa.from("scenarios").select("state, updated_by, updated_at").eq("name", "shared").maybeSingle();
        if (data && data.state) { skipNext.current = true; applySnapshot(data.state); setScnMsg(`Up to date \u2014 last change by ${data.updated_by || "team"}`); }
        else { lastSynced.current = JSON.stringify(getSnapshot()); setScnMsg("New shared plan"); }
      } catch (e) { setScnMsg("Could not load shared plan"); }
      booted.current = true;
      try { ch = supa.channel("shared-plan")
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "scenarios", filter: "name=eq.shared" }, (payload) => {
          const row = payload.new || {}; if (!row.state) return; if (row.updated_by === (user && user.email)) return;
          skipNext.current = true; applySnapshot(row.state); setScnMsg(`Updated live by ${row.updated_by || "team"} \u00b7 ${new Date().toLocaleTimeString()}`);
        }).subscribe(); } catch (e) {}
    })(); return () => { if (ch) try { supa.removeChannel(ch); } catch (e) {} };
  }, []); // eslint-disable-line
  React.useEffect(() => { if (!supa || !booted.current) return; const j = JSON.stringify(getSnapshot());
    if (skipNext.current) { skipNext.current = false; lastSynced.current = j; return; }
    if (j === lastSynced.current) return;
    setScnMsg("Saving\u2026"); if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { const { error } = await supa.from("scenarios").upsert({ name: "shared", state: JSON.parse(j), updated_by: user && user.email, updated_at: new Date().toISOString() }, { onConflict: "name" });
        if (error) { setScnMsg(`Save failed: ${error.message}`); return; }
        lastSynced.current = j; setScnMsg(`Saved ${new Date().toLocaleTimeString()}`);
        const now = Date.now(); if (now - lastAudit.current > 5 * 60 * 1000) { lastAudit.current = now; try { await supa.from("audit_log").insert({ email: user && user.email, action: "autosave", scenario: "shared", app_version: APP_VERSION }); } catch (e) {} }
      } catch (e) { setScnMsg("Save failed \u2014 check connection"); }
    }, 1500);
  });

  const devSyncPlan = () => setDevP("ha", +(entries.reduce((s, e) => s + (active[e.block] === false ? 0 : e.ha), 0)).toFixed(2));
  const setYield = (name, i, value) => setBlockYields((prev) => { const arr = (prev[name] || [null, null, null, null]).slice(); const n = parseFloat(value); arr[i] = value === "" || isNaN(n) ? null : Math.max(0, n); return { ...prev, [name]: arr }; });
  const [selVar, setSelVar] = useState("ALL");
  const [certVar, setCertVar] = useState("ALL");
  const [extract, setExtract] = useState({ SB: 750, PG: 750, RSL: 680, GEW: 650, CH: 650, SY: 650, PN: 650 }); // litres of wine per tonne
  const [purch, setPurch] = useState({ SB: Array(HORIZON).fill(0), PG: Array(HORIZON).fill(0), PN: Array(HORIZON).fill(0) }); // Comely Bank t/yr
  const [purchOrg, setPurchOrg] = useState(null); // null = SWNZ, else certification year
  const setPurchT = (k, i, value) => setPurch((pr) => { const a = (pr[k] || Array(HORIZON).fill(0)).slice(); const n = parseFloat(value); a[i] = value === "" || isNaN(n) ? 0 : Math.max(0, n); return { ...pr, [k]: a }; });
  const purchFill = (k) => setPurch((pr) => { const a = (pr[k] || []).slice(); const first = a[0] || 0; return { ...pr, [k]: a.map(() => first) }; });
  const setExtRate = (k, value) => setExtract((p) => { const v = parseFloat(value); return { ...p, [k]: value === "" || isNaN(v) ? 0 : Math.max(0, v) }; });
  const [revMode, setRevMode] = useState(false);
  const [showAgro, setShowAgro] = useState(false);
  const [showFin, setShowFin] = useState(false);

  const params = { startYear, decline, targets: { SB: tSB, PG: tPG, OTHER: tOther }, ramp: { y3: rY3 / 100, y4: rY4 / 100 }, discount, econYears, costHa, opexHa, price: { SB: pSB, PG: pPG, OTHER: pOther }, priceOrg: { SB: oSB, PG: oPG, OTHER: oOther } };
  const depKey = [startYear, decline, tSB, tPG, tOther, rY3, rY4, discount, econYears, costHa, opexHa, pSB, pPG, pOther, oSB, oPG, oOther, entries, blockYields, active, blockDecline, blockPrice, blockOrg, purch, purchOrg];
  const m = useMemo(() => runModel(params, entries, blockYields, active, blockDecline, blockPrice, blockOrg, { rates: purch, org: purchOrg }), depKey); // eslint-disable-line
  const devB = useMemo(() => {
    const q = devQty(dev);
    const rows = DEV_ITEMS.map((it) => { const unit = devCost[it.id] ?? it.unit; const qty = it.qty(q, dev); const off = !!devOff[it.id]; return { ...it, qty, unit, def: it.unit, off, budget: off ? 0 : qty * unit, ov: devCost[it.id] != null }; });
    const catTotal = (k) => rows.filter((r) => r.cat === k).reduce((s, r) => s + r.budget, 0);
    const core = DEV_CATS.reduce((s, c) => s + catTotal(c.key), 0);
    const infra = DEV_INFRA_CATS.reduce((s, c) => s + catTotal(c.key), 0);
    const perHa = dev.ha > 0 ? core / dev.ha : 0;
    return { q, rows, catTotal, core, infra, perHa, all: core + infra, allPerHa: dev.ha > 0 ? (core + infra) / dev.ha : 0 };
  }, [dev, devCost, devOff]);
  const sens = useMemo(() => ({
    decline: [0, 1, 2, 3].map((d) => ({ label: `${d}%/yr`, npv: runModel({ ...params, decline: d }, entries, blockYields, active, null, blockPrice, blockOrg, { rates: purch, org: purchOrg }).econ.npv, base: d === decline })),
    discount: [5, 6, 7, 8, 10].map((d) => ({ label: `${d}%`, npv: runModel({ ...params, discount: d }, entries, blockYields, active, blockDecline, blockPrice, blockOrg, { rates: purch, org: purchOrg }).econ.npv, base: d === discount })),
    price: [pSB - 300, pSB, pSB + 300, pSB + 600].map((pr) => ({ label: `$${pr.toLocaleString()}`, npv: runModel({ ...params, price: { SB: pr, PG: pPG, OTHER: pOther } }, entries, blockYields, active, blockDecline, blockPrice, blockOrg, { rates: purch, org: purchOrg }).econ.npv, base: pr === pSB })),
  }), depKey); // eslint-disable-line

  const { kpis, plan: pl, econ, series, varSummary, gridRows, scheduleByYear, scatter, entryRows, cash } = m;
  const shownVars = selVar === "ALL" ? VARIETIES : VARIETIES.filter((v) => v.key === selVar);
  const firstIdxOf = (yr) => series.findIndex((s) => s.year === yr);
  const cell = (v, key) => (revMode ? (v.revByVar ? v.revByVar[key] : v[key] * priceFor(key, params.price)) : v[key]);
  const years = Array.from({ length: HORIZON }, (_, i) => startYear + i);

  // per-block allocation + per-year hectares
  const alloc = {}; entries.forEach((e) => (alloc[e.block] = (alloc[e.block] || 0) + e.ha));
  const overBlocks = Object.entries(alloc).filter(([n, a]) => a > BMAP[n].ha + 0.01).map(([n]) => n);
  const haByYear = {}; entries.forEach((e) => (haByYear[e.year] = (haByYear[e.year] || 0) + e.ha));
  const yAvg = (name) => { const a = blockYields[name] || []; const v = a.filter((x) => typeof x === "number" && !isNaN(x) && x > 0); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  let _eN = 0, _eD = 0; BLOCKS.forEach((b) => { if (active[b.name] === false) return; const av = yAvg(b.name); if (av != null) { _eN += av * b.ha; _eD += b.ha; } });
  const estYieldAvg = _eD ? _eN / _eD : 0;

  const updateEntry = (id, field, value) => setEntries((es) => es.map((x) => {
    if (x.id !== id) return x;
    if (field === "block") { const b = BMAP[value]; const used = es.filter((e) => e.id !== id && e.block === value).reduce((s, e) => s + e.ha, 0); const free = Math.max(0.25, +(b.ha - used).toFixed(2)); return { ...x, block: value, ha: Math.min(x.ha || free, b.ha), variety: b.variety, costOverride: null, yieldOverride: null }; }
    if (field === "ha") { let n = parseFloat(value); if (isNaN(n)) n = 0; n = Math.max(0, Math.min(BMAP[x.block].ha, n)); return { ...x, ha: n }; }
    if (field === "year") return { ...x, year: +value };
    if (field === "variety") return { ...x, variety: value, yieldOverride: null, ...(value === "RETIRE" ? { costOverride: null, fallow: 0 } : {}) };
    if (field === "fallow") { let n = parseInt(value, 10); if (isNaN(n)) n = 0; return { ...x, fallow: Math.max(0, Math.min(HORIZON - 1, n)) }; }
    if (field === "cost") { let n = parseFloat(value); if (isNaN(n)) n = 0; n = Math.max(0, n); return { ...x, costOverride: Math.abs(n - costHa) < 1 ? null : n }; }
    if (field === "yield") { let n = parseFloat(value); if (isNaN(n)) n = 0; n = Math.max(0, n); const def = targetFor(x.variety, { SB: tSB, PG: tPG, OTHER: tOther }); return { ...x, yieldOverride: Math.abs(n - def) < 0.01 ? null : n }; }
    return x;
  }));
  const removeEntry = (id) => setEntries((es) => es.filter((e) => e.id !== id));
  const addEntry = () => setEntries((es) => {
    const a = {}; es.forEach((e) => (a[e.block] = (a[e.block] || 0) + e.ha));
    const b = BLOCKS.find((bl) => bl.ha - (a[bl.name] || 0) > 0.24 && active[bl.name] !== false) || BLOCKS.find((bl) => active[bl.name] !== false) || BLOCKS[0];
    const free = Math.max(0.25, +(b.ha - (a[b.name] || 0)).toFixed(2));
    return [...es, { id: nid(), block: b.name, ha: free, year: startYear, variety: b.variety, costOverride: null, yieldOverride: null }];
  });
  const doAuto = () => setEntries(autoFill(refPace, strategy, minAge, startYear, params.targets, active));
  const doClear = () => setEntries([]);

  return (
    <div className="vd-root">
      <style>{CSS}</style>
      {supa && (
        <div className="vd-persist">
          <span className="vd-persist-brand">Shared plan</span>
          <span className="vd-persist-note">One plan for the whole team \u2014 every change saves automatically</span>
          {scnMsg && <span className="vd-persist-msg">{scnMsg}</span>}
          <span className="vd-persist-right">v{APP_VERSION} \u00b7 {user?.email}{onSignOut && <button className="vd-btn ghost" style={{ marginLeft: 10 }} onClick={onSignOut}>Sign out</button>}</span>
        </div>
      )}

      {/* HERO */}
      <header className="vd-hero">
        <div className="vd-wrap">
          <div className="vd-eyebrow">Marlborough Estate · {f1(kpis.totalHa)} ha · {kpis.nBlocks} blocks · replanting planner</div>
          <h1 className="vd-h1">Build the rebuild, parcel by parcel.<span>Any block, any area, any year, any variety.</span></h1>
          <p className="vd-lede">Add a line for each parcel you’ll replant — pick the block, the hectares (a slice of a block is fine), the year, and the variety going back in. Set whatever pace you like, year by year, and watch the future grape supply, capital and return respond.</p>
          <div className="vd-kpis">
            <Kpi v={f1(kpis.totalHa)} u="ha" l="Producing area" />
            <Kpi v={f1(kpis.avgAge)} u="yrs" l="Avg vine age" />
            <Kpi v={f1(kpis.ha20)} u={`ha · ${Math.round(kpis.ha20pct)}%`} l="Aged 20 years+" accent="garnet" />
            <Kpi v={f1(kpis.currentYield)} u="t/ha" l="Current estate yield" />
          </div>
        </div>
      </header>

      <main className="vd-wrap vd-main">
        {/* PLAN EDITOR */}
        <section className="vd-card vd-controls">
          <div className="vd-plan-head">
            <div>
              <div className="vd-rate-label">Your replanting plan</div>
              <div className="vd-plan-sum"><b>{f1(pl.totalReplantedHa)} ha</b> in <b>{pl.nEntries}</b> parcel{pl.nEntries !== 1 ? "s" : ""}{pl.nChanged > 0 && <> · <b>{pl.nChanged}</b> switching variety</>} · <b>{money(econ.totalCapex)}</b> capital</div>
            </div>
            <div className="vd-plan-actions">
              <button className="vd-btn" onClick={addEntry}>+ Add parcel</button>
              <div className="vd-autofill"><span>Auto-fill</span><span className="vd-mini-step"><button onClick={() => setRefPace((v) => Math.max(0.5, +(v - 0.5).toFixed(1)))}>–</button><b>{f1(refPace)}</b><button onClick={() => setRefPace((v) => +(v + 0.5).toFixed(1))}>+</button></span><span>ha/yr</span><button className="vd-btn ghost sm" onClick={doAuto}>Go</button></div>
              <button className="vd-btn ghost sm" onClick={doClear}>Clear</button>
            </div>
          </div>

          {/* per-year hectares strip */}
          <div className="vd-yearstrip">
            {years.map((y) => { const ha = haByYear[y] || 0; const heavy = ha > refPace + 0.01;
              return <div key={y} className={`vd-yr ${ha > 0 ? "has" : ""} ${heavy ? "over" : ""}`} title={`${y}: ${f1(ha)} ha`}><span className="vd-yr-y">{`'${String(y).slice(2)}`}</span><span className="vd-yr-h">{ha > 0 ? f1(ha) : "·"}</span></div>; })}
            <div className="vd-yr-key">ha replanted / year · <i style={{ color: C.garnet }}>amber &gt; {f1(refPace)}</i></div>
          </div>

          {/* entries table */}
          <div className="vd-grid-scroll">
            <table className="vd-table vd-entries">
              <thead><tr><th className="del"></th><th className="l">Block</th><th>Area (ha)</th><th className="l">Pull year</th><th className="l">Plant variety</th><th>Fallow yrs</th><th>Cost/ha</th><th>Yield t/ha</th></tr></thead>
              <tbody>
                {entries.length === 0 && <tr><td colSpan={5} className="l" style={{ color: C.muted, padding: "18px 12px" }}>No parcels yet — “+ Add parcel” or auto-fill to start.</td></tr>}
                {entries.map((e) => {
                  const b = BMAP[e.block]; const over = overBlocks.includes(e.block); const changed = e.variety !== b.variety;
                  const eCost = e.costOverride ?? costHa; const eYield = e.yieldOverride ?? targetFor(e.variety, params.targets);
                  return (
                    <tr key={e.id} className={`${changed ? "switched" : ""}${active[e.block] === false ? " offblock" : ""}`}>
                      <td className="del"><button className="vd-x" title="Remove parcel" onClick={() => removeEntry(e.id)}>×</button></td>
                      <td className="l">
                        <select className="vd-select wide" value={e.block} onChange={(ev) => updateEntry(e.id, "block", ev.target.value)}>
                          {BLOCKS.map((bl) => <option key={bl.name} value={bl.name}>{bl.name} · {VMETA[bl.variety].short} · {f2(bl.ha)}ha{active[bl.name] === false ? " · OFF" : ""}</option>)}
                        </select>
                      </td>
                      <td>
                        <span className={`vd-ha ${over ? "over" : ""}`}>
                          <input type="number" min="0" max={b.ha} step="0.01" value={e.ha} onChange={(ev) => updateEntry(e.id, "ha", ev.target.value)} />
                          <i>/ {f2(b.ha)}</i>
                        </span>
                      </td>
                      <td className="l"><select className="vd-select" value={e.year} onChange={(ev) => updateEntry(e.id, "year", ev.target.value)}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select></td>
                      <td className="l"><select className="vd-select" value={e.variety} onChange={(ev) => updateEntry(e.id, "variety", ev.target.value)}>{VARIETIES.map((v) => <option key={v.key} value={v.key}>{v.label}{v.key === b.variety ? " (same)" : ""}</option>)}<option value="RETIRE">Pull out — no replant</option></select></td>
                      <td>{e.variety === "RETIRE" ? <span className="vd-fallow-inf" title="Not replanted within the horizon">∞</span> : <span className="vd-ha bare yfield"><input type="number" min="0" step="1" value={e.fallow || 0} onChange={(ev) => updateEntry(e.id, "fallow", ev.target.value)} title="Years the land sits unplanted between pull-out and replanting" /></span>}</td>
                      <td><span className={`vd-ha bare cost${e.costOverride != null ? " ov" : ""}`} title={e.costOverride != null ? "Custom — clear by typing the default" : "Default"}><input type="number" min="0" step="2500" value={e.variety === "RETIRE" ? 0 : eCost} disabled={e.variety === "RETIRE"} onChange={(ev) => updateEntry(e.id, "cost", ev.target.value)} /></span></td>
                      <td><span className={`vd-ha bare yield${e.yieldOverride != null ? " ov" : ""}`} title={e.yieldOverride != null ? "Custom — clear by typing the default" : "Default"}><input type="number" min="0" step="0.5" value={e.variety === "RETIRE" ? 0 : eYield} disabled={e.variety === "RETIRE"} onChange={(ev) => updateEntry(e.id, "yield", ev.target.value)} /></span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="vd-editor-note">Cost/ha and yield/ha pre-fill from your defaults — type a new figure on any row to override it for that parcel (<b>gold = custom</b>; type the default back to clear).</div>

          {/* block allocation feedback */}
          {Object.keys(alloc).length > 0 && (
            <div className="vd-alloc">
              <span className="vd-mini-label">Block use</span>
              {BLOCKS.filter((b) => alloc[b.name]).map((b) => { const a = alloc[b.name]; const pct = Math.min(100, (a / b.ha) * 100); const over = a > b.ha + 0.01;
                return <span key={b.name} className={`vd-alloc-chip ${over ? "over" : ""}`} title={`${b.name}: ${f2(a)} of ${f2(b.ha)} ha`}><span className="vd-alloc-bar"><span style={{ width: `${pct}%`, background: over ? C.garnet : VMETA[b.variety].color }} /></span>{b.name} {f2(a)}/{f2(b.ha)}</span>; })}
              {overBlocks.length > 0 && <span className="vd-alloc-warn">⚠ {overBlocks.length} block{overBlocks.length > 1 ? "s" : ""} over-allocated</span>}
            </div>
          )}

          <div className="vd-toggles">
            <button className="vd-adv-toggle" onClick={() => setShowAgro((s) => !s)}>{showAgro ? "▾" : "▸"} Vineyard assumptions</button>
            <button className="vd-adv-toggle" onClick={() => setShowFin((s) => !s)}>{showFin ? "▾" : "▸"} Economic assumptions</button>
            <div className="vd-startyr"><span>Start</span><span className="vd-mini-step"><button onClick={() => setStartYear((y) => Math.max(2026, y - 1))}>–</button><b>{startYear}</b><button onClick={() => setStartYear((y) => Math.min(2035, y + 1))}>+</button></span></div>
          </div>
          {showAgro && (
            <div className="vd-adv">
              <div className="vd-adv-col"><div className="vd-adv-h">Default full-yield targets (t/ha)</div><Num label="Sauvignon Blanc" value={tSB} set={setTSB} step={0.5} /><Num label="Pinot Gris" value={tPG} set={setTPG} step={0.5} /><Num label="Other varieties" value={tOther} set={setTOther} step={0.25} hint="Per-parcel override in the plan table" /></div>
              <div className="vd-adv-col"><div className="vd-adv-h">Establishment ramp (% of full)</div><Num label="Year 3" value={rY3} set={setRY3} step={5} suffix="%" /><Num label="Year 4" value={rY4} set={setRY4} step={5} suffix="%" /><div className="vd-adv-note">Years 1–2 no crop · Year 5+ full</div></div>
              <div className="vd-adv-col"><div className="vd-adv-h">Ageing & auto-fill</div><Num label="Decline of un-replanted blocks" value={decline} set={setDecline} step={0.5} suffix="%/yr" hint={`Estate default beyond ${VINTAGES[3]} · tweak any block below`} /><Num label="Auto-fill min. vine age" value={minAge} set={setMinAge} step={1} suffix=" yr" hint="Manual parcels can use any block" /><Num label="Opex saved on unplanted land" value={opexHa} set={setOpexHa} step={1000} prefix="$" suffix="/ha/yr" hint="Credited to pulled-out / fallow area" /></div>
            </div>
          )}
          {showAgro && (
            <div className="vd-yields">
              <div className="vd-adv-h">Block yields — your assumptions for {VINTAGES[0]}–{VINTAGES[3]} (t/ha) · averages update live</div>
              <div className="vd-yields-note">Every block is seeded with its average yield from your file. Edit any year to set what you expect that block to deliver — these become the baseline (un-replanted) yields the model uses for {VINTAGES[0]}–{VINTAGES[3]}, then taper beyond {VINTAGES[3]} at each block's own <strong>Decline %/yr</strong>. <strong>Certification</strong> sets the growing regime: SWNZ fruit earns the SWNZ variety prices; switch a block to BioGro and enter its certification year — it earns SWNZ prices before that vintage and BioGro organic prices from it (replanted area included, at the new variety's organic price). <strong>Price $/t</strong> overrides the regime price for that block's existing fruit (gold = custom; type the regime price to reset). Untick <strong>On</strong> to drop a block from the estate entirely; its data is kept so you can switch it back on anytime.</div>
              <div className="vd-grid-scroll vd-yields-scroll">
                <table className="vd-table vd-ytable">
                  <thead><tr><th>On</th><th className="l">Block</th><th className="l">Variety</th><th>Area</th>{VINTAGES.map((y) => <th key={y}>{y}</th>)}<th>Average</th><th>Decline %/yr</th><th className="l">Certification</th><th>Price $/t</th></tr></thead>
                  <tbody>
                    {BLOCKS.map((b) => { const arr = blockYields[b.name] || []; const vals = arr.filter((x) => typeof x === "number" && !isNaN(x) && x > 0); const avg = vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : null;
                      return (
                        <tr key={b.name} className={active[b.name] === false ? "off" : ""}>
                          <td className="oncell"><input type="checkbox" className="vd-chk" checked={active[b.name] !== false} onChange={() => toggleBlock(b.name)} title="Toggle block on/off" /></td>
                          <td className="l name">{b.name}</td>
                          <td className="l"><Swatch c={VMETA[b.variety].color} size={9} /> {VMETA[b.variety].short}</td>
                          <td>{f2(b.ha)}</td>
                          {VINTAGES.map((y, i) => <td key={y}><span className="vd-ha bare yfield"><input type="number" min="0" step="0.5" value={arr[i] ?? ""} disabled={active[b.name] === false} placeholder={b.young ? "—" : ""} onChange={(ev) => setYield(b.name, i, ev.target.value)} /></span></td>)}
                          <td className="avgcell">{active[b.name] === false ? "—" : (avg != null ? f1(avg) : (b.young ? "young" : "—"))}</td>
                          <td><span className={`vd-ha bare yfield${blockDecline[b.name] != null ? " ov" : ""}`} title={blockDecline[b.name] != null ? "Custom rate — type the estate default to reset" : "Estate default"}><input type="number" min="0" step="0.5" value={blockDecline[b.name] != null ? blockDecline[b.name] : decline} disabled={active[b.name] === false} onChange={(ev) => setBDecline(b.name, ev.target.value)} /></span></td>
                          <td className="l certcell">
                            <select className="vd-cert" value={blockOrg[b.name] != null ? "org" : "swnz"} disabled={active[b.name] === false} onChange={(ev) => setBOrgOn(b.name, ev.target.value === "org")}>
                              <option value="swnz">SWNZ</option><option value="org">BioGro</option>
                            </select>
                            {blockOrg[b.name] != null && <span className="vd-ha bare certyr" title="Certification year — organic prices apply from this vintage"><input type="number" min="1990" step="1" value={blockOrg[b.name]} disabled={active[b.name] === false} onChange={(ev) => setBOrgYear(b.name, ev.target.value)} /></span>}
                          </td>
                          <td><span className={`vd-ha bare price${blockPrice[b.name] != null ? " ov" : ""}`} title={blockPrice[b.name] != null ? "Custom price — type the regime price to reset" : (blockOrg[b.name] != null ? (CURRENT_YEAR >= blockOrg[b.name] ? `BioGro ${VMETA[b.variety].short} price` : `SWNZ now · BioGro from ${blockOrg[b.name]}`) : `SWNZ ${VMETA[b.variety].short} price`)}><input type="number" min="0" step="50" value={blockPrice[b.name] != null ? blockPrice[b.name] : priceFor(b.variety, blockOrg[b.name] != null && CURRENT_YEAR >= blockOrg[b.name] ? params.priceOrg : params.price)} disabled={active[b.name] === false} onChange={(ev) => setBPrice(b, ev.target.value)} /></span></td>
                        </tr>
                      ); })}
                  </tbody>
                  <tfoot><tr><td></td><td className="l">Estate (area-weighted)</td><td></td><td>{f2(kpis.totalHa)}</td><td colSpan={VINTAGES.length}></td><td className="avgcell">{f1(estYieldAvg)}</td><td>{f1(decline)}</td><td className="l">{(() => { const oh = BLOCKS.reduce((s, b) => s + (active[b.name] !== false && blockOrg[b.name] != null ? b.ha : 0), 0); return oh > 0 ? `${f2(oh)} ha BioGro` : "all SWNZ"; })()}</td><td>{series[0] && series[0].total ? money(series[0].rev / series[0].total) : "—"}</td></tr></tfoot>
                </table>
              </div>
            </div>
          )}
          {showFin && (
            <div className="vd-adv">
              <div className="vd-adv-col"><div className="vd-adv-h">SWNZ price ($/tonne)</div><Num label="Sauvignon Blanc" value={pSB} set={setPSB} step={50} prefix="$" /><Num label="Pinot Gris" value={pPG} set={setPPG} step={50} prefix="$" /><Num label="Other varieties" value={pOther} set={setPOther} step={50} prefix="$" /></div>
              <div className="vd-adv-col"><div className="vd-adv-h">BioGro organic ($/tonne)</div><Num label="Sauvignon Blanc" value={oSB} set={setOSB} step={50} prefix="$" /><Num label="Pinot Gris" value={oPG} set={setOPG} step={50} prefix="$" /><Num label="Other varieties" value={oOther} set={setOOther} step={50} prefix="$" hint="Paid from each block's certification year" /></div>
              <div className="vd-adv-col"><div className="vd-adv-h">Capital</div><Num label="Default redevelopment cost" value={costHa} set={setCostHa} step={2500} prefix="$" suffix="/ha" hint="Per-parcel override in the plan table" /><div className="vd-adv-note">Spent 60 / 25 / 15% over three years.</div></div>
              <div className="vd-adv-col"><div className="vd-adv-h">Discounting</div><Num label="Discount rate" value={discount} set={setDiscount} step={0.5} suffix="%" /><Num label="Analysis horizon" value={econYears} set={setEconYears} step={1} suffix=" yr" min={15} /></div>
            </div>
          )}
        </section>

        {/* 01 SUPPLY */}
        <section className="vd-section">
          <SectionHead n="01" title="Future grape supply" sub={`${startYear}–${startYear + HORIZON - 1} · tonnes by variety, from your plan`} />
          <div className="vd-card">
            <div className="vd-legend-row"><button className={`vd-vchip ${selVar === "ALL" ? "on" : ""}`} onClick={() => setSelVar("ALL")}>All varieties</button>{VARIETIES.map((v) => <button key={v.key} className={`vd-vchip ${selVar === v.key ? "on" : ""}`} onClick={() => setSelVar(v.key)}><Swatch c={v.color} /> {v.short}</button>)}</div>
            <div style={{ width: "100%", height: 380 }}>
              <ResponsiveContainer>
                <ComposedChart data={series} margin={{ top: 12, right: 14, left: 2, bottom: 4 }}>
                  <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: C.muted, fontSize: 12, fontFamily: "IBM Plex Mono" }} axisLine={{ stroke: C.line }} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
                  <YAxis tick={{ fill: C.muted, fontSize: 12, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} width={48} label={{ value: "tonnes", angle: -90, position: "insideLeft", fill: C.muted, fontSize: 11, dy: 20 }} />
                  <Tooltip content={<ChartTooltip />} />
                  {shownVars.map((v) => <Area key={v.key} type="monotone" dataKey={v.key} stackId="v" stroke={v.color} fill={v.color} fillOpacity={0.82} strokeWidth={0.5} />)}
                  <Line type="monotone" dataKey="baseTotal" stroke={C.ink} strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
                  <ReferenceLine y={kpis.current} stroke={C.muted} strokeDasharray="1 3" strokeWidth={1} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="vd-chart-key"><span><i className="vd-dash" /> Without replanting (vines aging at {decline}%/yr)</span><span><i className="vd-dot-line" /> Today · {f0(kpis.current)} t</span></div>
          </div>
        </section>

        {pl.nEntries > 0 && (
          <section className="vd-insight">
            <div className="vd-insight-grid">
              <Stat big={f1(pl.trough.total)} unit="t" caption={`Supply low in ${pl.trough.year}`} note={`${f0(kpis.current - pl.trough.total)} t under today while vines establish`} tone="garnet" />
              <Stat big={pl.recoveryYear ? `${pl.recoveryYear}` : "—"} unit="" caption={pl.recoveryYear ? "Back to today’s supply" : "Recovers beyond horizon"} note={pl.recoveryYear ? `${pl.recoveryYear - startYear} years from start` : "Adjust the plan"} />
              <Stat big={f0(pl.maturedTotal)} unit="t" caption="Matured estate" note={`${f1(pl.maturedYield)} t/ha once parcels reach full yield`} tone="green" />
              <Stat big={`+${f0(pl.maturedVsBase)}`} unit="t/yr" caption="Matured gain vs not replanting" note={`+${f0(pl.maturedVsToday)} t on today`} tone="green" />
            </div>
            <p className="vd-insight-text">Your plan dips supply to about <b>{f0(pl.trough.total)} t</b> in {pl.trough.year}, then recovers to roughly <b>{f0(pl.maturedTotal)} t</b> ({f1(pl.maturedYield)} t/ha){pl.nChanged > 0 ? <>, with {pl.nChanged} parcel{pl.nChanged > 1 ? "s" : ""} shifted to a new variety — watch the bands move above.</> : "."}</p>
          </section>
        )}

        {/* 02 SCHEDULE */}
        <section className="vd-section">
          <SectionHead n="02" title="Schedule & establishment" sub="Hectares lifted each year, and how each parcel recovers" />
          <div className="vd-two">
            <div className="vd-card"><div className="vd-card-h">Hectares replanted per year</div>
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer><BarChart data={scheduleByYear} margin={{ top: 8, right: 8, left: 2, bottom: 4 }}>
                  <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: C.muted, fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={{ stroke: C.line }} tickLine={false} interval="preserveStartEnd" minTickGap={14} />
                  <YAxis tick={{ fill: C.muted, fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip cursor={{ fill: "rgba(30,75,58,0.06)" }} content={<ScheduleTip />} />
                  <ReferenceLine y={refPace} stroke={C.garnet} strokeDasharray="4 3" strokeWidth={1} />
                  {VARIETIES.map((v, i) => <Bar key={v.key} dataKey={v.key} stackId="s" fill={v.color} radius={i === VARIETIES.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} maxBarSize={34} />)}
                </BarChart></ResponsiveContainer>
              </div>
              <div className="vd-chart-key"><span><i className="vd-dash-garnet" /> Reference pace {f1(refPace)} ha/yr</span></div>
            </div>
            <div className="vd-card"><div className="vd-card-h">Establishment wave — parcel status by year</div>
              {gridRows.length === 0 ? <div className="vd-empty">Add parcels above to see this.</div> : (
                <div className="vd-grid-scroll"><div className="vd-grid" style={{ gridTemplateColumns: `136px repeat(${HORIZON}, 1fr)` }}>
                  <div />{series.map((s) => <div key={s.year} className="vd-grid-yr">{`'${String(s.year).slice(2)}`}</div>)}
                  {gridRows.map((b) => (
                    <React.Fragment key={b.id}>
                      <div className="vd-grid-name" title={`${b.name}${b.partial ? ` · ${f2(b.ha)}ha` : ""}${b.variety === "RETIRE" ? " · pulled out" : b.changed ? ` → ${VMETA[b.variety].label}` : ""}`}><Swatch c={b.variety === "RETIRE" ? "#9AA294" : VMETA[b.variety].color} size={9} /><span>{b.name}{b.partial ? <i className="pa"> {f2(b.ha)}</i> : ""}{b.variety === "RETIRE" ? <em> pulled</em> : b.changed ? <em> →{b.variety}</em> : ""}</span></div>
                      {b.ratios.map((rr, i) => <div key={i} className={`vd-grid-cell${rr === -2 ? " fallow" : ""}`} style={{ background: rr === -2 ? "repeating-linear-gradient(45deg,#E3E6DE,#E3E6DE 3px,#F1F3EC 3px,#F1F3EC 6px)" : rr < 0 ? "rgba(30,75,58,0.12)" : ratioColor(rr) }} title={`${series[i].year}: ${rr === -2 ? (b.variety === "RETIRE" ? "pulled out" : "fallow") : rr < 0 ? "not yet" : Math.round(rr * 100) + "% of full"}`} />)}
                    </React.Fragment>
                  ))}
                </div></div>
              )}
              <div className="vd-grid-legend"><span><i style={{ background: ratioColor(0) }} /> No crop</span><span><i style={{ background: ratioColor(0.5) }} /> Establishing</span><span><i style={{ background: ratioColor(1) }} /> Full</span><span><i style={{ background: "rgba(30,75,58,0.12)" }} /> Not yet / old</span></div>
            </div>
          </div>
        </section>

        {/* 03 VARIETY TABLE */}
        <section className="vd-section">
          <SectionHead n="03" title="Supply by variety" sub="Today versus the matured estate, then year by year" />
          <div className="vd-varcards">{varSummary.map((v) => <div className="vd-varcard" key={v.key}><div className="vd-varcard-h"><Swatch c={VMETA[v.key].color} />{VMETA[v.key].short}</div><div className="vd-varcard-row"><span>Today</span><b>{f0(v.current)} t</b></div><div className="vd-varcard-row"><span>Matured</span><b>{f0(v.matured)} t</b></div><div className={`vd-varcard-delta ${v.delta >= 0 ? "pos" : "neg"}`}>{v.delta >= 0 ? "▲" : "▼"} {f0(Math.abs(v.delta))} t</div></div>)}</div>
          <div className="vd-card vd-tablecard">
            <div className="vd-table-top"><div className="vd-card-h" style={{ margin: 0 }}>{revMode ? "Fruit revenue by variety" : "Supply by variety"}</div><div className="vd-switch"><button className={!revMode ? "on" : ""} onClick={() => setRevMode(false)}>Tonnes</button><button className={revMode ? "on" : ""} onClick={() => setRevMode(true)}>NZ$</button></div></div>
            <div className="vd-grid-scroll"><table className="vd-table"><thead><tr><th className="l">Year</th>{VARIETIES.map((v) => <th key={v.key}><Swatch c={v.color} /> {v.short}</th>)}<th>Total</th><th>vs no replant</th></tr></thead>
              <tbody>
                {series.map((s) => { const tot = VARIETIES.reduce((a, v) => a + cell(s, v.key), 0); const delta = revMode ? (cash.find((c) => c.year === s.year)?.incRev ?? 0) : s.total - s.baseTotal; const isT = s.year === pl.trough.year;
                  return <tr key={s.year} className={isT ? "trough" : ""}><td className="l">{s.year}{isT && <em>low</em>}</td>{VARIETIES.map((v) => <td key={v.key}>{revMode ? money(cell(s, v.key)) : f1(s[v.key])}</td>)}<td className="tot">{revMode ? money(tot) : f1(tot)}</td><td className={delta >= 0 ? "pos" : "neg"}>{delta >= 0 ? "+" : ""}{revMode ? money(delta) : f1(delta)}</td></tr>; })}
                <tr className="matured"><td className="l">Matured</td>{VARIETIES.map((v) => <td key={v.key}>{revMode ? money(cell(m.matP, v.key)) : f1(m.matP[v.key])}</td>)}<td className="tot">{revMode ? money(m.matP.rev) : f1(m.matP.total)}</td><td className="pos">{revMode ? "+" + money(econ.matMargin) : "+" + f1(pl.maturedVsBase)}</td></tr>
              </tbody></table></div>
          </div>

          {/* Certification mix */}
          <div className="vd-card" style={{ marginTop: 14 }}>
            <div className="vd-card-h">Certification mix <span className="vd-h-hint">— tonnes under each regime as blocks certify · pick a variety to isolate it</span></div>
            <div className="vd-legend-row" style={{ marginBottom: 10 }}>
              <button className={`vd-vchip ${certVar === "ALL" ? "on" : ""}`} onClick={() => setCertVar("ALL")}>All varieties</button>
              {VARIETIES.map((v) => <button key={v.key} className={`vd-vchip ${certVar === v.key ? "on" : ""}`} onClick={() => setCertVar(v.key)}><Swatch c={v.color} /> {v.short}</button>)}
            </div>
            {(() => {
              const pick = (s) => { const tot = certVar === "ALL" ? s.total : s[certVar]; const org = certVar === "ALL" ? s.orgT : (s.orgV ? s.orgV[certVar] : 0); return { year: s.year, orgT: org, swnzT: Math.max(0, tot - org), total: tot }; };
              const certData = series.map(pick);
              const label = certVar === "ALL" ? "" : ` ${VMETA[certVar].short}`;
              const s0 = certData[0]; const s5 = certData[Math.min(5, certData.length - 1)]; const mat = pick({ ...m.matP, year: 0 });
              const pm = (s) => (s.total > 0 ? (s.orgT / s.total) * 100 : 0);
              return (
                <>
                  <div className="vd-dev-derived" style={{ marginTop: 0, paddingTop: 0, borderTop: "none", marginBottom: 10 }}>
                    <span><b>{f0(s0.orgT)} t</b> BioGro{label} today ({f1(pm(s0))}%)</span>
                    <span><b>{f0(s5.orgT)} t</b> in {s5.year} ({f1(pm(s5))}%)</span>
                    <span><b>{f0(mat.orgT)} t</b> matured ({f1(pm(mat))}%)</span>
                    <span><b>{f0(s0.swnzT)} t</b> SWNZ{label} today</span>
                  </div>
                  <ResponsiveContainer width="100%" height={230}>
                    <ComposedChart data={certData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#DDE1D8" strokeDasharray="2 4" vertical={false} />
                      <XAxis dataKey="year" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono", fill: C.muted }} axisLine={{ stroke: C.line }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fontFamily: "IBM Plex Mono", fill: C.muted }} axisLine={false} tickLine={false} width={44} />
                      <Tooltip formatter={(val, name) => [`${f0(val)} t`, name]} labelStyle={{ fontFamily: "IBM Plex Mono", fontSize: 12 }} contentStyle={{ fontFamily: "IBM Plex Sans", fontSize: 12.5, border: `1px solid ${C.line}`, borderRadius: 8 }} />
                      <Area type="monotone" dataKey="swnzT" stackId="cert" name={`SWNZ${label}`} fill="#C9CFC2" stroke="#9AA294" strokeWidth={1.2} fillOpacity={0.85} />
                      <Area type="monotone" dataKey="orgT" stackId="cert" name={`BioGro${label}`} fill={C.green} stroke={C.deep} strokeWidth={1.2} fillOpacity={0.75} />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="vd-grid-scroll vd-cert-scroll">
                    <table className="vd-table vd-certtable">
                      <thead><tr><th className="l">Year</th><th>SWNZ{label} (t)</th><th>BioGro{label} (t)</th><th>Total{label} (t)</th><th>% BioGro</th></tr></thead>
                      <tbody>{certData.map((s) => <tr key={s.year}><td className="l">{s.year}</td><td>{f0(s.swnzT)}</td><td className="orgcell">{f0(s.orgT)}</td><td className="tot">{f0(s.total)}</td><td>{s.total > 0 ? f1(pm(s)) : "—"}%</td></tr>)}</tbody>
                    </table>
                  </div>
                </>
              ); })()}
          </div>

          {/* Purchased fruit — Comely Bank */}
          <div className="vd-card" style={{ marginTop: 14 }}>
            <div className="vd-card-h">Purchased fruit — Comely Bank <span className="vd-h-hint">— tonnes bought per variety per year · flows into supply, certification mix and wine cases</span></div>
            <div className="vd-ext-row" style={{ alignItems: "center" }}>
              <label className="vd-ext"><span>Certification</span>
                <select className="vd-cert" value={purchOrg != null ? "org" : "swnz"} onChange={(ev) => setPurchOrg(ev.target.value === "org" ? (purchOrg ?? CURRENT_YEAR) : null)}>
                  <option value="swnz">SWNZ</option><option value="org">BioGro</option>
                </select>
              </label>
              {purchOrg != null && <label className="vd-ext"><span>from</span><span className="vd-ha bare certyr"><input type="number" min="1990" step="1" value={purchOrg} onChange={(ev) => { const v = parseInt(ev.target.value, 10); setPurchOrg(isNaN(v) ? CURRENT_YEAR : v); }} /></span></label>}
              <span className="vd-h-hint">Purchases don't change the replanting investment case — they arrive either way.</span>
            </div>
            <div className="vd-grid-scroll vd-cert-scroll">
              <table className="vd-table vd-certtable vd-purchtable">
                <thead><tr><th className="l">Year</th>{["SB", "PG", "PN"].map((k) => <th key={k}><Swatch c={VMETA[k].color} size={8} /> {VMETA[k].short} <button className="vd-fill" title="Copy the first year's tonnes down every year" onClick={() => purchFill(k)}>fill ↓</button></th>)}<th>Total (t)</th></tr></thead>
                <tbody>
                  {series.map((srow, i) => { const tot = ["SB", "PG", "PN"].reduce((a, k) => a + (purch[k][i] || 0), 0);
                    return <tr key={srow.year}><td className="l">{srow.year}</td>{["SB", "PG", "PN"].map((k) => <td key={k}><span className="vd-ha bare yfield"><input type="number" min="0" step="5" value={purch[k][i] || 0} onChange={(ev) => setPurchT(k, i, ev.target.value)} /></span></td>)}<td className="tot">{f0(tot)}</td></tr>; })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Wine cases */}
          <div className="vd-card" style={{ marginTop: 14 }}>
            <div className="vd-card-h">Wine production — cases by variety <span className="vd-h-hint">— 1 case = 12 × 750 ml = 9 L · extraction rates editable per variety</span></div>
            <div className="vd-ext-row">
              {VARIETIES.map((v) => (
                <label key={v.key} className="vd-ext"><span><Swatch c={v.color} size={9} /> {v.short}</span>
                  <span className="vd-ha bare yfield"><input type="number" min="0" step="10" value={extract[v.key] ?? 0} onChange={(ev) => setExtRate(v.key, ev.target.value)} title={`Litres of wine per tonne of ${v.label}`} /></span>
                  <em>L/t</em>
                </label>
              ))}
            </div>
            {(() => {
              const CASE_L = 9;
              const cases = (t, k) => (t * (extract[k] || 0)) / CASE_L;
              const rowTotal = (srow) => VARIETIES.reduce((sum, v) => sum + cases(srow[v.key], v.key), 0);
              const s0 = series[0]; const mat = m.matP;
              return (
                <>
                  <div className="vd-dev-derived" style={{ marginTop: 0, paddingTop: 0, borderTop: "none", marginBottom: 10 }}>
                    <span><b>{f0(rowTotal(s0))}</b> cases today</span>
                    <span><b>{f0(rowTotal(mat))}</b> cases matured</span>
                    <span><b>{f0(rowTotal(mat) - rowTotal(s0))}</b> case uplift</span>
                    <span><b>{f0(rowTotal(s0) * CASE_L)}</b> L today</span>
                  </div>
                  <div className="vd-grid-scroll vd-cert-scroll">
                    <table className="vd-table vd-certtable vd-casetable">
                      <thead><tr><th className="l">Year</th>{VARIETIES.map((v) => <th key={v.key}>{v.short}</th>)}<th>Total cases</th></tr></thead>
                      <tbody>
                        {series.map((srow) => <tr key={srow.year}><td className="l">{srow.year}</td>{VARIETIES.map((v) => <td key={v.key}>{f0(cases(srow[v.key], v.key))}</td>)}<td className="tot">{f0(rowTotal(srow))}</td></tr>)}
                        <tr className="matured"><td className="l">Matured</td>{VARIETIES.map((v) => <td key={v.key}>{f0(cases(mat[v.key], v.key))}</td>)}<td className="tot">{f0(rowTotal(mat))}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </>
              ); })()}
          </div>
        </section>

        {/* 04 SCATTER */}
        <section className="vd-section">
          <SectionHead n="04" title="Which blocks, and why" sub="Vine age against current yield — bubble size is area" />
          <div className="vd-card">
            <div style={{ width: "100%", height: 360 }}>
              <ResponsiveContainer><ScatterChart margin={{ top: 16, right: 20, left: 6, bottom: 18 }}>
                <CartesianGrid stroke={C.line} strokeDasharray="2 4" />
                <ReferenceArea x1={minAge} x2={40} y1={0} y2={7} fill={C.garnet} fillOpacity={0.05} />
                <ReferenceLine x={minAge} stroke={C.garnet} strokeDasharray="4 4" label={{ value: `age ${minAge}yr`, position: "top", fill: C.garnet, fontSize: 10, fontFamily: "IBM Plex Mono" }} />
                <XAxis type="number" dataKey="age" domain={[0, 40]} tick={{ fill: C.muted, fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={{ stroke: C.line }} tickLine={false} label={{ value: "vine age (years)", position: "insideBottom", offset: -8, fill: C.muted, fontSize: 11 }} />
                <YAxis type="number" dataKey="yield" domain={[0, 16]} tick={{ fill: C.muted, fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} width={36} label={{ value: "yield t/ha", angle: -90, position: "insideLeft", fill: C.muted, fontSize: 11, dy: 24 }} />
                <ZAxis type="number" dataKey="ha" range={[50, 560]} />
                <Tooltip content={<ScatterTip />} cursor={{ strokeDasharray: "3 3" }} />
                {VARIETIES.map((v) => <Scatter key={v.key} data={scatter.filter((d) => d.variety === v.key)} fill={v.color} fillOpacity={0.72} stroke={v.color} strokeWidth={1} />)}
              </ScatterChart></ResponsiveContainer>
            </div>
            <p className="vd-case-note">Old, low-yielding blocks sit bottom-right (shaded) — the easy calls (<b>F&nbsp;PG</b>/<b>E&nbsp;PG</b> at 4.9, the 2008 SB blocks). Top-right blocks like <b>SB03</b> and <b>WB-Riesling</b> are old but high-yielding, so replanting them costs fruit unless you switch them to something more valuable.</p>
          </div>
        </section>

        {/* 05 INVESTMENT CASE */}
        <section className="vd-section">
          <SectionHead n="05" title="The investment case" sub={`Your plan vs doing nothing · ${money(costHa)}/ha · ${discount}% · ${econYears}-yr view`} />
          <div className="vd-econ-kpis">
            <Stat big={money(econ.totalCapex)} unit="" caption="Total capital" note={`${f1(pl.totalReplantedHa)} ha at ${money(costHa)}/ha`} />
            <Stat big={money(Math.abs(econ.peak))} unit="" caption="Peak funding need" note="Deepest cash position" tone="garnet" />
            <Stat big={money(econ.npv)} unit="" caption={`NPV @ ${discount}%`} note={econ.npv >= 0 ? "Value created" : "Below hurdle at these inputs"} tone={econ.npv >= 0 ? "green" : "garnet"} />
            <Stat big={econ.irr == null ? "—" : `${(econ.irr * 100).toFixed(1)}%`} unit="IRR" caption="Rate of return" note={econ.irr != null && econ.irr * 100 >= discount ? "Above hurdle" : "Below hurdle"} />
            <Stat big={econ.spay ? `${econ.spay}` : "—"} unit="" caption="Payback (cash)" note={econ.spay ? `${econ.spay - startYear} yrs · PV ${econ.dpay || "beyond"}` : "Beyond horizon"} />
            <Stat big={`+${money(econ.matMargin)}`} unit="/yr" caption="Matured margin" note="Extra income vs nothing" tone="green" />
          </div>
          <div className="vd-card" style={{ marginTop: 18 }}><div className="vd-card-h">Cash flow — annual net and cumulative</div>
            <div style={{ width: "100%", height: 360 }}>
              <ResponsiveContainer><ComposedChart data={cash} margin={{ top: 12, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: C.muted, fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={{ stroke: C.line }} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
                <YAxis yAxisId="cum" tick={{ fill: C.muted, fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} width={52} tickFormatter={money} />
                <YAxis yAxisId="net" orientation="right" tick={{ fill: C.muted, fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} width={50} tickFormatter={money} />
                <Tooltip content={<CashTip />} cursor={{ fill: "rgba(30,75,58,0.05)" }} />
                <ReferenceLine yAxisId="cum" y={0} stroke={C.ink} strokeWidth={1} />
                <Bar yAxisId="net" dataKey="net" maxBarSize={26} radius={[2, 2, 0, 0]}>{cash.map((c, i) => <Cell key={i} fill={c.net >= 0 ? "#3E7C5B" : "#C08A86"} />)}</Bar>
                <Line yAxisId="cum" type="monotone" dataKey="cum" stroke={C.ink} strokeWidth={2} dot={false} />
                <Line yAxisId="cum" type="monotone" dataKey="cumD" stroke={C.green} strokeWidth={1.6} strokeDasharray="5 4" dot={false} />
              </ComposedChart></ResponsiveContainer>
            </div>
            <div className="vd-chart-key"><span><i className="vd-bar-pos" /> / <i className="vd-bar-neg" /> Annual net (right)</span><span><i className="vd-line-ink" /> Cumulative cash (left)</span><span><i className="vd-dash-green" /> Cumulative PV → NPV</span></div>
          </div>
        </section>

        {/* 06 RETURNS */}
        <section className="vd-section">
          <SectionHead n="06" title="Returns by parcel" sub="Capital, uplift and simple payback — fastest first" />
          <div className="vd-card vd-tablecard">
            {entryRows.length === 0 ? <div className="vd-empty">No parcels scheduled yet.</div> : (
              <div className="vd-grid-scroll"><table className="vd-table vd-table-ret"><thead><tr><th className="l">Parcel</th><th className="l">Variety</th><th>Yr</th><th>Area</th><th>Capital</th><th>Yield → target</th><th>Income/yr</th><th>Payback</th><th className="l">Driver</th></tr></thead>
                <tbody>{entryRows.map((b) => (
                  <tr key={b.id} className={b.margin <= 0 ? "dilutive" : ""}>
                    <td className="l">{b.name}{b.partial ? <em> {f2(b.ha)}ha</em> : ""}</td>
                    <td className="l"><VarPair oldV={b.oldVariety} newV={b.variety} /></td>
                    <td>{b.year}{!b.retire && b.fallow > 0 ? <em> +{b.fallow}f</em> : ""}</td><td>{f2(b.ha)}</td><td>{b.retire ? "—" : money(b.capexB)}</td><td>{b.retire ? `${f1(b.oldY)} → 0` : `${f1(b.oldY)} → ${f1(b.newTgt)}`}</td>
                    <td className={b.margin >= 0 ? "pos" : "neg"}>{b.margin >= 0 ? "+" : ""}{money(b.margin)}</td>
                    <td>{b.pay ? `${b.pay.toFixed(1)} yr` : "—"}</td>
                    <td className="l"><span className={`vd-tag ${b.retire ? "exit" : b.changed ? "switch" : b.margin > 0 ? "yield" : "risk"}`}>{b.retire ? "Exit" : b.changed ? "Switch" : b.margin > 0 ? "Yield" : "Risk / age"}</span></td>
                  </tr>))}
                </tbody></table></div>
            )}
            <p className="vd-case-note" style={{ marginTop: 14 }}>Payback is capital ÷ extra fruit income per year at full yield. Underperformers and value-adding <b>switches</b> pay back fastest; parcels already at target are <b>risk/age</b> calls; dimmed rows shed income at maturity.</p>
          </div>
        </section>

        {/* 07 SENSITIVITY */}
        <section className="vd-section">
          <SectionHead n="07" title="What moves the answer" sub="NPV under different assumptions · base case highlighted" />
          <div className="vd-sens-grid"><SensBlock title="Decline of un-replanted vines" items={sens.decline} /><SensBlock title="Discount rate" items={sens.discount} /><SensBlock title="Sauvignon Blanc price /t" items={sens.price} /></div>
          <p className="vd-case-note" style={{ marginTop: 6 }}>Decline is the swing factor — if tired vines hold yield, replanting is hard to justify on fruit alone; if they fade or fail, the case turns positive.</p>
        </section>

        {/* 08 DEVELOPMENT BUDGET */}
        <section className="vd-section">
          <SectionHead n="08" title="Development budget" sub="Design-driven redevelopment costing · quantities and totals update as you change the design" />
          <div className="vd-card">
            <div className="vd-card-h">Vineyard design</div>
            <div className="vd-dev-inputs">
              <Num label="Area developed" value={dev.ha} set={(v) => setDevP("ha", v)} step={0.5} suffix=" ha" />
              <Num label="Row spacing" value={dev.rowSpace} set={(v) => setDevP("rowSpace", v)} step={0.1} suffix=" m" />
              <Num label="Vine spacing" value={dev.vineSpace} set={(v) => setDevP("vineSpace", v)} step={0.1} suffix=" m" />
              <Num label="Vines per bay" value={dev.vinesPerBay} set={(v) => setDevP("vinesPerBay", v)} step={1} suffix="" hint="Sets post spacing" />
              <Num label="Row length" value={dev.rowLen} set={(v) => setDevP("rowLen", v)} step={10} suffix=" m" hint="Estimate — drives strainers" />
              <Num label="Wires per row" value={dev.wires} set={(v) => setDevP("wires", v)} step={1} suffix="" hint="Lifting + fruiting + irrigation" />
              <button className="vd-btn ghost" onClick={devSyncPlan} title="Copy the replant plan's active area into 'Area developed'">Use plan area ({f2(entries.reduce((s, e) => s + (active[e.block] === false ? 0 : e.ha), 0))} ha)</button>
            </div>
            <div className="vd-dev-derived">
              <span><b>{f1(devB.q.postSpace)} m</b> post spacing</span><span><b>{f0(devB.q.plantsHa)}</b> plants/ha</span><span><b>{f0(devB.q.postsHa)}</b> posts/ha</span>
              <span><b>{f0(devB.q.plants)}</b> vines</span><span><b>{f0(devB.q.posts)}</b> posts</span><span><b>{f0(devB.q.strainers)}</b> strainers</span>
              <span><b>{f0(devB.q.coils)}</b> wire coils</span><span><b>{f1(devB.q.kmRows)} km</b> of rows</span>
            </div>
          </div>

          <div className="vd-card vd-tablecard" style={{ marginTop: 14 }}>
            <div className="vd-card-h">Cost build-up <span className="vd-h-hint">— unit rates editable (gold = updated); untick items you don't need — they cost zero</span></div>
            <div className="vd-grid-scroll vd-dev-scroll">
              <table className="vd-table vd-devtable">
                <thead><tr><th>On</th><th className="l">Item</th><th className="l">Basis</th><th>Qty</th><th>Unit $</th><th>Budget</th></tr></thead>
                <tbody>
                  {[...DEV_CATS, ...DEV_INFRA_CATS].map((c) => (
                    <React.Fragment key={c.key}>
                      <tr className="devcat"><td className="l" colSpan={5}>{c.label}{DEV_INFRA_CATS.some((x) => x.key === c.key) ? " · major infrastructure" : ""}</td><td className="devcat-t">{money(devB.catTotal(c.key))}</td></tr>
                      {devB.rows.filter((r) => r.cat === c.key).map((r) => (
                        <tr key={r.id} className={r.off ? "off" : ""}>
                          <td className="oncell"><input type="checkbox" className="vd-chk" checked={!r.off} onChange={() => toggleDevItem(r.id)} title="Untick if this item isn't needed — its cost becomes zero" /></td>
                          <td className="l name">{r.label}</td>
                          <td className="l basis">{r.basis}</td>
                          <td>{r.id === "dam" ? <span className="vd-ha bare yfield"><input type="number" min="0" step="250" value={dev.damM3} disabled={r.off} onChange={(ev) => setDevP("damM3", Math.max(0, parseFloat(ev.target.value) || 0))} title="Dam volume m³" /></span> : r.id === "fans" ? <span className="vd-ha bare yfield"><input type="number" min="0" step="1" value={dev.frostQty} disabled={r.off} onChange={(ev) => setDevP("frostQty", Math.max(0, parseFloat(ev.target.value) || 0))} title="Number of fans" /></span> : f0(r.qty)}</td>
                          <td><span className={`vd-ha bare cost${r.ov ? " ov" : ""}`} title={r.ov ? "Updated rate — type the default to reset" : "Template rate"}><input type="number" min="0" step={r.def < 1 ? 0.01 : r.def < 50 ? 0.5 : 50} value={r.unit} disabled={r.off} onChange={(ev) => setDevUnit(r.id, ev.target.value, r.def)} /></span></td>
                          <td className="mono">{r.off ? "—" : money(r.budget)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td className="l" colSpan={5}>Development cost (excl. major infrastructure)</td><td>{money(devB.core)}</td></tr>
                  <tr><td className="l" colSpan={5}>Per hectare</td><td>{money(devB.perHa)}</td></tr>
                  <tr className="dim"><td className="l" colSpan={5}>Incl. water storage & frost protection</td><td>{money(devB.all)} · {money(devB.allPerHa)}/ha</td></tr>
                </tfoot>
              </table>
            </div>
            <div className="vd-dev-apply">
              <button className="vd-btn" onClick={() => setCostHa(Math.round(devB.perHa))}>Apply {money(devB.perHa)}/ha as the replant cost</button>
              <span>Currently the investment case uses {money(costHa)}/ha. Applying updates NPV, IRR, payback and the funding curve instantly. Major infrastructure is excluded — it's usually a one-off, not per-replant.</span>
            </div>
          </div>
        </section>

        <footer className="vd-foot">
          <div><strong>Method.</strong> Each block holds its current yield (un-replanted area fading {decline}%/yr) until a parcel’s replant year; that parcel then carries no crop for two years, returns at {rY3}% / {rY4}% in years three and four, and reaches its yield target by year five — the per-parcel figure you set, or the variety default ({f1(tSB)} SB · {f1(tPG)} PG · {f1(tOther)} other) — counting toward the new variety. NPV is discounted incremental cash flow vs doing nothing: extra fruit revenue ({`$${pSB.toLocaleString()}/$${pPG.toLocaleString()}/$${pOther.toLocaleString()}`} per tonne) less redevelopment capital (per parcel, default {money(costHa)}/ha, spread 60/25/15). Operating costs are excluded as they fall on the land either way.</div>
          <div className="vd-foot-src">Source: Vineyard_performance_2.xlsx · {kpis.nBlocks} blocks · {f1(kpis.totalHa)} ha. Sheet "Planted year" reads 2002 for TG 15/16 & TG2017; treated as 2015 / 2017 per names. Prices/costs are editable estimates.</div>
        </footer>
      </main>
    </div>
  );
}

/* ---------------------------------- STYLES ---------------------------------- */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
.vd-root{--paper:#E8EAE3;--ink:#16241D;--panel:#FCFCFA;--tint:#F1F3EC;--line:#D6DACE;--green:#1E4B3A;--greenDeep:#102C22;--gold:#B8901F;--garnet:#8A322C;--muted:#5C685F;
  background:var(--paper);color:var(--ink);font-family:'IBM Plex Sans',system-ui,sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased;}
.vd-root *{box-sizing:border-box;}
.vd-wrap{max-width:1180px;margin:0 auto;padding:0 28px;}
.vd-main{padding-bottom:64px;}
.vd-hero{background:var(--greenDeep);color:#EDF1EA;padding:54px 0 46px;position:relative;overflow:hidden;}
.vd-hero:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.028) 0 1px,transparent 1px 46px);pointer-events:none;}
.vd-eyebrow{font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#9FC2AE;margin-bottom:20px;}
.vd-h1{font-family:'Archivo',sans-serif;font-weight:800;font-size:clamp(28px,4.6vw,50px);line-height:1.04;letter-spacing:-.02em;margin:0 0 18px;max-width:20ch;}
.vd-h1 span{display:block;color:var(--gold);font-weight:700;}
.vd-lede{max-width:66ch;color:#C9D6CD;font-size:16px;margin:0 0 30px;}
.vd-kpis{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid rgba(255,255,255,.16);}
.vd-kpi{padding:18px 22px 4px 0;border-right:1px solid rgba(255,255,255,.1);}
.vd-kpi:last-child{border-right:none;}
.vd-kpi-v{font-family:'IBM Plex Mono',monospace;font-size:30px;font-weight:600;line-height:1;}
.vd-kpi-v i{font-size:14px;font-style:normal;color:#9FC2AE;font-weight:500;}
.vd-kpi-v .garnet{color:#E2A09A;}
.vd-kpi-l{font-size:12.5px;color:#A9BBB0;margin-top:8px;}
.vd-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:22px;box-shadow:0 1px 0 rgba(16,44,34,.03);}
.vd-controls{margin-top:-30px;position:relative;z-index:3;box-shadow:0 18px 40px -28px rgba(16,44,34,.5);}
.vd-plan-head{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;flex-wrap:wrap;padding-bottom:14px;border-bottom:1px solid var(--line);}
.vd-rate-label{font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);}
.vd-plan-sum{font-size:18px;margin-top:6px;color:var(--ink);}
.vd-plan-sum b{font-family:'IBM Plex Mono',monospace;color:var(--green);}
.vd-plan-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.vd-autofill{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--muted);}
.vd-mini-step{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:7px;background:var(--tint);overflow:hidden;}
.vd-mini-step b{font-family:'IBM Plex Mono',monospace;font-size:13px;padding:3px 8px;min-width:34px;text-align:center;}
.vd-mini-step button{border:none;background:transparent;width:24px;height:28px;cursor:pointer;color:var(--green);font-size:14px;font-weight:600;}
.vd-mini-step button:hover{background:rgba(30,75,58,.08);}
.vd-btn{border:1px solid var(--green);background:var(--green);color:#fff;border-radius:8px;padding:8px 15px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;}
.vd-btn:hover{background:#163d2f;}
.vd-btn.sm{padding:6px 11px;}
.vd-btn.ghost{background:transparent;color:var(--green);}
.vd-btn.ghost:hover{background:rgba(30,75,58,.08);}
.vd-yearstrip{display:flex;gap:4px;flex-wrap:wrap;align-items:center;padding:14px 0;border-bottom:1px dashed var(--line);}
.vd-yr{width:44px;border:1px solid var(--line);border-radius:6px;padding:4px 0;text-align:center;background:var(--tint);}
.vd-yr.has{background:#fff;border-color:#BFD0C5;}
.vd-yr.over{border-color:var(--garnet);background:rgba(138,50,44,.07);}
.vd-yr-y{display:block;font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--muted);}
.vd-yr-h{display:block;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;color:var(--ink);}
.vd-yr.over .vd-yr-h{color:var(--garnet);}
.vd-yr-key{font-size:11px;color:var(--muted);margin-left:8px;}
.vd-yr-key i{font-style:normal;}
.vd-entries{min-width:640px;}
.vd-entries tr.switched{background:rgba(184,144,31,.06);}
.vd-select{font-family:'IBM Plex Mono',monospace;font-size:12.5px;border:1px solid var(--line);border-radius:7px;padding:5px 8px;background:#fff;color:var(--ink);cursor:pointer;}
.vd-select.wide{min-width:180px;}
.vd-select:focus{outline:2px solid rgba(30,75,58,.25);border-color:var(--green);}
.vd-ha{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:7px;background:#fff;padding:2px 8px 2px 4px;}
.vd-ha.over{border-color:var(--garnet);background:rgba(138,50,44,.06);}
.vd-ha input{width:56px;border:none;background:transparent;font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;text-align:right;color:var(--ink);padding:4px 2px;}
.vd-ha input:focus{outline:none;}
.vd-ha i{font-style:normal;font-size:11px;color:var(--muted);font-family:'IBM Plex Mono';}
.vd-ha.bare{padding:2px 6px;justify-content:center;}
.vd-ha.bare.cost input{width:60px;text-align:right;}
.vd-ha.bare.yield input{width:46px;text-align:right;}
.vd-ha.ov{border-color:var(--gold);background:rgba(184,144,31,.10);}
.vd-ha.ov input{color:#7d630f;}
.vd-editor-note{font-size:12px;color:var(--muted);margin-top:12px;line-height:1.5;}
.vd-editor-note b{color:#7d630f;}
.vd-x{border:none;background:transparent;color:var(--muted);font-size:18px;cursor:pointer;line-height:1;padding:0 4px;border-radius:5px;}
.vd-x:hover{color:#fff;background:var(--garnet);}
.vd-chk{width:15px;height:15px;accent-color:var(--green);cursor:pointer;}
.vd-ytable th:first-child{text-align:center;}
.vd-ytable td.oncell{text-align:center;width:34px;}
.vd-ytable tr.off td,.vd-ytable tr.off td.name{color:#AEB4AC;}
.vd-ytable input:disabled{color:#B8BEB6;background:var(--tint);cursor:not-allowed;}
.vd-entries tr.offblock{opacity:.45;}
.vd-persist{display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:#102C22;color:#E8EAE3;padding:10px 22px;font-size:12.5px;}
.vd-persist-brand{font-family:'Archivo';font-weight:800;letter-spacing:.06em;text-transform:uppercase;font-size:11px;color:#B8901F;}
.vd-persist-note{color:rgba(232,234,227,.65);}
.vd-persist-msg{color:#B8901F;}
.vd-persist-right{margin-left:auto;display:flex;align-items:center;color:rgba(232,234,227,.75);}
.vd-tag.exit{background:rgba(138,50,44,.12);color:var(--garnet);}
.vd-fallow-inf{font-family:'IBM Plex Mono',monospace;color:var(--muted);font-size:14px;display:inline-block;padding:0 8px;}
.vd-fill{border:1px solid var(--line);background:#fff;color:var(--muted);font-size:10px;border-radius:6px;padding:1px 6px;cursor:pointer;margin-left:4px;}
.vd-fill:hover{color:var(--green);border-color:var(--green);}
.vd-ytable td.certcell{white-space:nowrap;}
.vd-cert{font-family:'IBM Plex Sans',sans-serif;font-size:11.5px;font-weight:600;color:var(--ink);border:1px solid var(--line);border-radius:7px;background:#fff;padding:3px 4px;cursor:pointer;}
.vd-cert:disabled{color:#B8BEB6;background:var(--tint);cursor:not-allowed;}
.vd-ha.bare.certyr{margin-left:6px;padding:1px 4px;}
.vd-ha.bare.certyr input{width:44px;text-align:right;}
.vd-ext-row{display:flex;flex-wrap:wrap;gap:8px 18px;margin-bottom:12px;}
.vd-ext{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);}
.vd-ext em{font-style:normal;font-size:11px;}
.vd-casetable tr.matured td{background:#EFF3ED;font-weight:700;border-top:2px solid var(--green);}
.vd-cert-scroll{max-height:240px;overflow:auto;border:1px solid var(--line);border-radius:10px;margin-top:12px;}
.vd-certtable{min-width:420px;font-size:12.5px;}
.vd-certtable th{position:sticky;top:0;background:var(--panel);z-index:1;}
.vd-certtable td{padding:5px 10px;border-bottom:1px solid #EEF0EA;}
.vd-certtable td.orgcell{color:var(--green);font-weight:700;}
.vd-certtable td.tot{font-weight:700;}
.vd-dev-inputs{display:flex;flex-wrap:wrap;gap:10px 22px;align-items:flex-end;}
.vd-dev-derived{display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:16px;padding-top:14px;border-top:1px dashed var(--line);font-size:12.5px;color:var(--muted);}
.vd-dev-derived b{font-family:'IBM Plex Mono',monospace;color:var(--green);font-weight:700;}
.vd-dev-scroll{max-height:520px;overflow:auto;border:1px solid var(--line);border-radius:10px;}
.vd-devtable{min-width:640px;font-size:12.5px;}
.vd-devtable th{position:sticky;top:0;background:var(--panel);z-index:1;}
.vd-devtable td{padding:5px 10px;border-bottom:1px solid #EEF0EA;}
.vd-devtable td.name{color:var(--ink);}
.vd-devtable td.basis{color:var(--muted);font-size:11.5px;}
.vd-devtable td.mono{font-family:'IBM Plex Mono',monospace;font-weight:600;}
.vd-devtable td.oncell{text-align:center;width:34px;}
.vd-devtable th:first-child{text-align:center;}
.vd-devtable tr.off td,.vd-devtable tr.off td.name{color:#AEB4AC;}
.vd-devtable input:disabled{color:#B8BEB6;background:var(--tint);cursor:not-allowed;}
.vd-devtable tr.devcat td{background:#EFF3ED;color:var(--green);font-weight:700;font-family:'Archivo';letter-spacing:.02em;border-top:2px solid var(--line);}
.vd-devtable tr.devcat td.devcat-t{font-family:'IBM Plex Mono',monospace;text-align:right;}
.vd-devtable td:last-child,.vd-devtable th:last-child{text-align:right;}
.vd-devtable tfoot td{position:sticky;bottom:0;background:#EFF3ED;border-top:2px solid var(--green);font-weight:700;color:var(--ink);font-family:'IBM Plex Mono',monospace;}
.vd-devtable tfoot td.l{font-family:'IBM Plex Sans';}
.vd-devtable tfoot tr.dim td{background:var(--panel);color:var(--muted);font-weight:600;border-top:1px dashed var(--line);}
.vd-dev-apply{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:14px;font-size:12.5px;color:var(--muted);line-height:1.5;}
.vd-dev-apply span{max-width:60ch;}
.vd-h-hint{font-size:12px;font-weight:400;color:var(--muted);letter-spacing:0;text-transform:none;}
.vd-entries th.del,.vd-entries td.del{width:30px;padding:4px 2px 4px 6px;text-align:center;}
.vd-yields{margin-top:18px;padding-top:18px;border-top:1px dashed var(--line);}
.vd-yields-note{font-size:12px;color:var(--muted);margin:6px 0 14px;line-height:1.5;max-width:92ch;}
.vd-yields-scroll{max-height:360px;overflow:auto;border:1px solid var(--line);border-radius:10px;}
.vd-ytable{min-width:560px;font-size:12.5px;}
.vd-ytable th{position:sticky;top:0;background:var(--panel);z-index:1;}
.vd-ytable td{padding:5px 10px;border-bottom:1px solid #EEF0EA;}
.vd-ytable td.name{font-weight:600;color:var(--ink);font-family:'IBM Plex Sans';}
.vd-ytable td.avgcell,.vd-ytable th:last-child{font-weight:700;color:var(--green);}
.vd-ytable tfoot td{position:sticky;bottom:0;border-top:2px solid var(--green);border-bottom:none;font-weight:700;color:var(--ink);background:#EFF3ED;}
.vd-ha.bare.yfield{padding:1px 4px;}
.vd-ha.bare.yfield input{width:46px;text-align:right;}
.vd-alloc{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding-top:14px;}
.vd-mini-label{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-right:2px;}
.vd-alloc-chip{display:inline-flex;align-items:center;gap:7px;font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--ink);border:1px solid var(--line);border-radius:14px;padding:3px 9px 3px 5px;background:#fff;}
.vd-alloc-chip.over{border-color:var(--garnet);color:var(--garnet);}
.vd-alloc-bar{display:inline-block;width:26px;height:5px;border-radius:3px;background:var(--tint);overflow:hidden;}
.vd-alloc-bar span{display:block;height:100%;}
.vd-alloc-warn{font-size:12px;color:var(--garnet);font-weight:600;}
.vd-toggles{display:flex;gap:22px;margin-top:18px;flex-wrap:wrap;align-items:center;}
.vd-adv-toggle{background:none;border:none;color:var(--green);font-size:13px;font-weight:600;cursor:pointer;padding:0;font-family:'IBM Plex Mono',monospace;}
.vd-startyr{margin-left:auto;display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--muted);}
.vd-adv{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;margin-top:16px;padding-top:18px;border-top:1px dashed var(--line);}
.vd-adv-h{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--green);margin-bottom:12px;}
.vd-adv-note,.vd-num-l em{display:block;font-size:11px;color:var(--muted);font-style:normal;margin-top:5px;}
.vd-num{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:11px;}
.vd-num-l{font-size:13px;}
.vd-num-in{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:7px;background:var(--tint);flex:0 0 auto;}
.vd-num-in span{font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;padding:0 9px;min-width:62px;text-align:center;}
.vd-num-in button{border:none;background:transparent;width:26px;height:30px;cursor:pointer;color:var(--green);font-size:15px;font-weight:600;}
.vd-num-in button:hover{background:rgba(30,75,58,.08);}
.vd-section{margin-top:46px;}
.vd-sh{display:flex;align-items:center;gap:14px;margin-bottom:16px;}
.vd-sh-n{font-family:'IBM Plex Mono',monospace;font-size:12px;color:#fff;background:var(--green);padding:3px 8px;border-radius:5px;font-weight:600;}
.vd-sh-t{font-family:'Archivo',sans-serif;font-weight:700;font-size:21px;letter-spacing:-.01em;}
.vd-sh-s{font-size:13px;color:var(--muted);}
.vd-card-h{font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:14px;}
.vd-legend-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;}
.vd-vchip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--panel);border-radius:18px;padding:5px 11px;font-size:12px;cursor:pointer;color:var(--ink);font-family:inherit;}
.vd-vchip.on{border-color:var(--green);background:var(--tint);font-weight:600;}
.vd-vchip:hover{border-color:var(--green);}
.vd-chart-key{display:flex;flex-wrap:wrap;gap:22px;margin-top:12px;font-size:12px;color:var(--muted);}
.vd-chart-key i{display:inline-block;vertical-align:middle;margin-right:7px;}
.vd-dash{width:22px;height:0;border-top:2px dashed var(--ink);}
.vd-dash-garnet{width:20px;height:0;border-top:2px dashed var(--garnet);}
.vd-dot-line{width:22px;height:0;border-top:1px dotted var(--muted);}
.vd-line-ink{width:18px;height:0;border-top:2px solid var(--ink);}
.vd-dash-green{width:18px;height:0;border-top:2px dashed var(--green);}
.vd-bar-pos{width:11px;height:11px;border-radius:2px;background:#3E7C5B;}
.vd-bar-neg{width:11px;height:11px;border-radius:2px;background:#C08A86;}
.vd-tt{background:#fff;border:1px solid var(--line);border-radius:9px;padding:11px 13px;box-shadow:0 8px 24px -12px rgba(16,44,34,.4);font-size:13px;min-width:184px;}
.vd-tt-h{font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:13px;margin-bottom:8px;}
.vd-tt-r{display:flex;justify-content:space-between;gap:18px;padding:2px 0;color:var(--muted);}
.vd-tt-r b{color:var(--ink);font-family:'IBM Plex Mono',monospace;}
.vd-tt-tot{border-top:1px solid var(--line);margin-top:6px;padding-top:6px;color:var(--ink);font-weight:600;}
.vd-tt-sub{font-size:12px;}
.vd-insight{margin-top:26px;background:var(--green);color:#EAF0EB;border-radius:14px;padding:26px 28px;}
.vd-insight-grid{display:grid;grid-template-columns:repeat(4,1fr);}
.vd-stat{padding:0 22px;border-left:1px solid rgba(255,255,255,.14);}
.vd-stat:first-child{padding-left:0;border-left:none;}
.vd-stat-v{font-family:'IBM Plex Mono',monospace;font-size:28px;font-weight:600;line-height:1;}
.vd-stat-v i{font-style:normal;font-size:13px;color:#A9C4B5;font-weight:500;margin-left:3px;}
.vd-stat.garnet .vd-stat-v{color:#F0B4AD;}
.vd-stat.green .vd-stat-v{color:#9BE0BE;}
.vd-stat-c{font-size:13px;margin-top:9px;font-weight:600;color:#DCE6DE;}
.vd-stat-n{font-size:12px;color:#A9C4B5;margin-top:3px;line-height:1.4;}
.vd-insight-text{margin:22px 0 0;padding-top:18px;border-top:1px solid rgba(255,255,255,.14);font-size:15px;color:#DCE6DE;max-width:98ch;}
.vd-insight-text b{color:#fff;}
.vd-two{display:grid;grid-template-columns:1fr 1.25fr;gap:18px;align-items:start;}
.vd-grid-scroll{overflow-x:auto;}
.vd-grid{display:grid;gap:3px;min-width:540px;}
.vd-grid-yr{font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--muted);text-align:center;padding-bottom:4px;}
.vd-grid-name{display:flex;align-items:center;gap:6px;font-size:11.5px;padding-right:8px;white-space:nowrap;overflow:hidden;}
.vd-grid-name span{overflow:hidden;text-overflow:ellipsis;}
.vd-grid-name em{font-style:normal;color:var(--garnet);font-family:'IBM Plex Mono';font-size:10px;}
.vd-grid-name .pa{font-style:normal;color:var(--muted);font-family:'IBM Plex Mono';font-size:10px;}
.vd-grid-cell{height:19px;border-radius:3px;}
.vd-grid-legend{display:flex;flex-wrap:wrap;gap:16px;margin-top:14px;font-size:11.5px;color:var(--muted);}
.vd-grid-legend i{display:inline-block;width:13px;height:13px;border-radius:3px;vertical-align:-2px;margin-right:6px;}
.vd-empty{color:var(--muted);font-size:13px;padding:30px 0;text-align:center;}
.vd-varcards{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:18px;}
.vd-varcard{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:13px 14px;}
.vd-varcard-h{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;margin-bottom:9px;}
.vd-varcard-row{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);padding:1px 0;}
.vd-varcard-row b{color:var(--ink);font-family:'IBM Plex Mono',monospace;}
.vd-varcard-delta{margin-top:7px;font-family:'IBM Plex Mono',monospace;font-size:12.5px;font-weight:600;}
.vd-varcard-delta.pos{color:var(--green);}
.vd-varcard-delta.neg{color:var(--garnet);}
.vd-tablecard{padding:6px;}
.vd-table-top{display:flex;justify-content:space-between;align-items:center;padding:10px 12px 4px;}
.vd-switch{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;}
.vd-switch button{border:none;background:var(--panel);padding:5px 13px;font-size:12px;cursor:pointer;color:var(--muted);font-family:'IBM Plex Mono',monospace;}
.vd-switch button.on{background:var(--green);color:#fff;}
.vd-table{width:100%;border-collapse:collapse;font-size:13px;min-width:640px;}
.vd-table th{font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);font-weight:500;text-align:right;padding:11px 12px;border-bottom:1px solid var(--line);white-space:nowrap;}
.vd-table th.l{text-align:left;}
.vd-table td{font-family:'IBM Plex Mono',monospace;text-align:right;padding:8px 12px;border-bottom:1px solid #EEF0EA;color:var(--ink);white-space:nowrap;}
.vd-table td.l{text-align:left;color:var(--muted);font-family:'IBM Plex Sans';}
.vd-table td.l em{font-style:normal;color:var(--garnet);font-size:11px;margin-left:5px;font-family:'IBM Plex Mono';}
.vd-table td.tot{font-weight:600;}
.vd-table td.pos{color:var(--green);}
.vd-table td.neg{color:var(--garnet);}
.vd-table tr.trough{background:rgba(138,50,44,.05);}
.vd-table tr.matured{background:rgba(30,75,58,.07);}
.vd-table tr.matured td{font-weight:600;border-top:2px solid var(--green);border-bottom:none;}
.vd-table-ret tr.dilutive td{color:#9AA39B;}
.vd-table-ret tr.dilutive td.neg{color:var(--garnet);}
.vd-tag{font-family:'IBM Plex Mono',monospace;font-size:10px;padding:2px 7px;border-radius:10px;letter-spacing:.04em;}
.vd-tag.yield{background:rgba(30,75,58,.12);color:var(--green);}
.vd-tag.risk{background:rgba(138,50,44,.1);color:var(--garnet);}
.vd-tag.switch{background:rgba(184,144,31,.15);color:#8a6a14;}
.vd-econ-kpis{display:grid;grid-template-columns:repeat(6,1fr);background:var(--green);color:#EAF0EB;border-radius:14px;padding:24px 26px;}
.vd-econ-kpis .vd-stat{padding:0 18px;}
.vd-sens-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;}
.vd-sens{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px;}
.vd-sens-h{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--green);margin-bottom:14px;}
.vd-sens-row{display:grid;grid-template-columns:58px 1fr 60px;align-items:center;gap:10px;margin-bottom:9px;}
.vd-sens-row.base .vd-sens-lab{color:var(--ink);font-weight:700;}
.vd-sens-row.base .vd-sens-track{outline:2px solid rgba(30,75,58,.25);outline-offset:2px;border-radius:3px;}
.vd-sens-lab{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--muted);text-align:right;}
.vd-sens-track{position:relative;height:16px;background:var(--tint);border-radius:3px;}
.vd-sens-mid{position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:var(--line);}
.vd-sens-bar{position:absolute;top:2px;bottom:2px;border-radius:2px;}
.vd-sens-val{font-family:'IBM Plex Mono',monospace;font-size:11.5px;text-align:right;}
.vd-sens-val.pos{color:var(--green);}
.vd-sens-val.neg{color:var(--garnet);}
.vd-case-note,.vd-foot div{font-size:13.5px;color:var(--muted);line-height:1.6;}
.vd-case-note{margin:14px 2px 0;max-width:98ch;}
.vd-case-note b{color:var(--ink);}
.vd-foot{margin-top:46px;padding-top:24px;border-top:1px solid var(--line);display:grid;gap:12px;}
.vd-foot strong{color:var(--ink);}
.vd-foot-src{font-family:'IBM Plex Mono',monospace;font-size:11.5px;color:var(--muted);}
@media(max-width:980px){.vd-econ-kpis{grid-template-columns:repeat(3,1fr);gap:18px 0;}.vd-sens-grid{grid-template-columns:1fr;}}
@media(max-width:900px){
  .vd-kpis,.vd-insight-grid{grid-template-columns:repeat(2,1fr);}
  .vd-kpi{border-right:none;}.vd-kpi:nth-child(odd){border-right:1px solid rgba(255,255,255,.1);}
  .vd-stat{border-left:none;padding:14px 0;border-top:1px solid rgba(255,255,255,.12);}.vd-stat:first-child{border-top:none;}
  .vd-two{grid-template-columns:1fr;}.vd-adv{grid-template-columns:1fr;gap:18px;}.vd-varcards{grid-template-columns:repeat(3,1fr);}
  .vd-econ-kpis{grid-template-columns:repeat(2,1fr);}.vd-econ-kpis .vd-stat{border-left:none;border-top:1px solid rgba(255,255,255,.12);padding:14px 0;}.vd-econ-kpis .vd-stat:first-child,.vd-econ-kpis .vd-stat:nth-child(2){border-top:none;}
}
@media(max-width:560px){.vd-wrap{padding:0 16px;}.vd-varcards{grid-template-columns:repeat(2,1fr);}.vd-econ-kpis{grid-template-columns:1fr;}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;}}
`;
