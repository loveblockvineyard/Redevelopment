import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Droplets, Clock, AlertTriangle, Settings, LogOut, Plus, Trash2,
  Download, Upload, X, Check, RefreshCw, Users, Layers, Pencil,
  ChevronRight, MapPin, WifiOff, Beaker, ChevronLeft, Cloud, LayoutDashboard, Wind, Droplet, Thermometer
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { loadJSON, saveJSON } from './db';
import { ensureReady, isConfigured } from './firebase';

/* ============================================================
   Vineyard Ops — installable PWA, Firestore-backed (offline-first).
   Operator app + manager console. Data is cached on the device and
   syncs automatically when a connection returns.
   ============================================================ */

// Fire-and-forget POST to the manager's notification webhook (Apps Script / Zapier / Make).
// Uses no-cors + text/plain so it works cross-origin without the endpoint needing CORS headers.
async function postWebhook(url, payload) {
  if (!url) return false;
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    return true;
  } catch { return false; }
}

const K = {
  config: 'vineyard:config',
  spraysLegacy: 'vineyard:sprays',
  sprays: type => `vineyard:sprays:${type}`,
  ts: code => `vineyard:ts:${code}`,
  hz: code => `vineyard:hz:${code}`,
};

/* ---------- defaults / seed ---------- */
const DEFAULT_CONFIG = {
  siteName: 'Vineyard Ops',
  managerCode: '0000',
  operators: [{ code: '1234', name: 'Sample Operator' }],
  blocks: [
    { name: 'Hill A 23', ha: 7.9, rows: '42 - 180', km: 26.69 },
    { name: 'Hill A SB', ha: 0.64, rows: '267-274', km: 2.13 },
    { name: 'Hill E SB', ha: 0.28, rows: '1-17', km: 0.93 },
    { name: 'Hill F SB', ha: 1.69, rows: '1-18', km: 5.63 },
    { name: 'Hill E GEW', ha: 2.96, rows: '58-98', km: 9.87 },
    { name: 'Hill E PG', ha: 1.55, rows: '18-57', km: 5.17 },
    { name: 'Hill F PG', ha: 8.424, rows: '19-113', km: 28.08 },
    { name: 'Hill F RSL', ha: 2.98, rows: '114-146', km: 9.93 },
    { name: 'Hill C18 - SB', ha: 1, rows: '38-60', km: 3.33 },
    { name: 'Hill C18 - CH', ha: 1.08, rows: '61-79', km: 3.6 },
    { name: 'Hill C - CBl', ha: 1.29, rows: '1-37', km: 4.3 },
    { name: 'Hill B - Muscat', ha: 0.73, rows: '1-16', km: 2.43 },
    { name: 'Eros Front PG', ha: 5.86, rows: '201-139', km: 19.53 },
    { name: 'Eros Front SB', ha: 4.01, rows: '202-242', km: 13.37 },
    { name: 'Eros Back SB', ha: 9.13, rows: '129-244', km: 30.43 },
    { name: 'Eros SB2020', ha: 2.514, rows: '105-128', km: 8.38 },
    { name: 'Eros TG2017', ha: 9.246, rows: '1-104', km: 30.82 },
    { name: 'Eros TG2015', ha: 2.91, rows: '65-101', km: 9.7 },
    { name: 'Eros TG2016', ha: 8.31, rows: '1-64 102-138', km: 27.7 },
    { name: 'Woolshed Sauvignon Blanc', ha: 10.99, rows: '1 - 108', km: 36.63 },
    { name: 'Woolshed Pinot Gris', ha: 1.83, rows: '1 to 37', km: 6.1 },
    { name: 'Winery SB 01', ha: 3.56, rows: '1 to 43', km: 0 },
    { name: 'Winery SB02', ha: 3.14, rows: '1 to 43', km: 0 },
    { name: 'Winery SB03', ha: 1.68, rows: '92 to 138', km: 0 },
    { name: 'Winery SB04', ha: 5.328, rows: '43 to 115', km: 0 },
    { name: 'Winery SB05', ha: 3.9, rows: '1 to 50', km: 0 },
    { name: 'Winery Riesling', ha: 1.1, rows: '1 to 50', km: 0 },
    { name: 'Winery Pinot Gris', ha: 1, rows: '51 to 91', km: 0 },
    { name: 'Winery Syrah', ha: 0.1, rows: '1 to 3', km: 0 },
    { name: 'Winery CHA', ha: 0.83, rows: '29 to 91', km: 0 },
    { name: 'N/A', ha: 0, rows: '', km: 0 },
  ],
  jobs: [
    { name: 'Canopy Control', code: '21301' },
    { name: 'Bud Rubbing', code: '21302' },
    { name: 'Frost Protection', code: '21303' },
    { name: 'Fruit Thinning & Dropping', code: '21304' },
    { name: 'Leaf Plucking', code: '21305' },
    { name: 'Replacement Plants - Training', code: '21307' },
    { name: 'Shoot Thinning', code: '21308' },
    { name: 'Skirting', code: '21309' },
    { name: 'Spraying Canopy', code: '21310' },
    { name: 'Vine Trimming & Mowing', code: '21311' },
    { name: 'Wire Lifting & Dropping', code: '21312' },
    { name: 'Ground Control', code: '21313' },
    { name: 'Applying Fertilzer', code: '21314' },
    { name: 'Mowing', code: '21315' },
    { name: 'Composting / Mulching', code: '21316' },
    { name: 'Soil Work', code: '21317' },
    { name: 'Undervine Control', code: '21317/01' },
    { name: 'Weed Spraying', code: '21318' },
    { name: 'Harvesting', code: '21319' },
    { name: 'Irrigation - R&M', code: '21322' },
    { name: 'Bird Control - Bird nets', code: '21327' },
    { name: 'Net Removal & Clipping', code: '21328' },
    { name: 'Weta Guards', code: '21330' },
    { name: 'Pruning', code: '21331' },
    { name: 'R&M Posts & Wires - Clipping Fixing', code: '21339' },
    { name: 'Staff training', code: '24804' },
    { name: 'Farm supervisor', code: '24808' },
    { name: 'Track maintenance', code: '21343' },
    { name: 'Young vines', code: '21307' },
    { name: 'Canopy Control:Retrunking', code: '21346' },
    { name: 'Washdown tractor/sprayer, farm vehicle R&M, attach sprayer etc.', code: '24605' },
    { name: 'Other - Specify on notes', code: '372' },
  ],
  statuses: ['To Spray', 'Jason', 'Simon'],
  laneTanks: { Jason: 3000, Simon: 2000 },   // legacy single-board fields (kept for safety)
  waterRate: 400,
  sprayTypes: [
    { key: 'canopy', label: 'Canopy Spray', statuses: ['To Spray', 'Jason', 'Simon'], laneTanks: { Jason: 3000, Simon: 2000 }, waterRate: 300, roundMix: [{ product: 'Microthiol Disperss', per100: 1.333 }, { product: 'NZBioActive', per100: 0.73 }, { product: 'Artemis Opti', per100: 0.05 }], roundDeducted: false },
    { key: 'ground', label: 'Ground Spray', statuses: ['To Spray', 'Jason', 'Simon'], laneTanks: { Jason: 3000, Simon: 2000 }, waterRate: 400, roundMix: [], roundDeducted: false },
    { key: 'weed', label: 'Weed Spray', statuses: ['To Spray', 'Weed sprayer'], laneTanks: { 'Weed sprayer': 1000 }, waterRate: 200, roundMix: [{ product: 'Roundup UltraMAX', per100: 1.25 }, { product: 'LI 700', per100: 0.2 }, { product: 'Shark', per100: 0.1 }], roundDeducted: false },
  ],
  weather: { lat: -41.62, lon: 174.08, label: 'Awatere Valley', stationUrl: '' },
  dataVersion: 4,
  products: [
    { name: 'Microthiol Disperss', unit: 'Kg', concentration: 'sulphur - elemental', rate: 1.333, stock: '', minStock: '' },
    { name: 'NZBioActive', unit: 'L', concentration: 'fertiliser', rate: 0.73, stock: '', minStock: '' },
    { name: 'Artemis Opti', unit: 'L', concentration: 'polyether modified polysiloxane', rate: 0.05, stock: '', minStock: '' },
    { name: 'Roundup UltraMAX', unit: 'L', concentration: '570 g/L glyphosate', rate: 1.25, stock: 200, minStock: 50 },
    { name: 'LI 700', unit: 'L', concentration: 'penetrant/acidifier', rate: 0.2, stock: 40, minStock: 10 },
    { name: 'Shark', unit: 'L', concentration: '240 g/L carfentrazone', rate: 0.1, stock: 20, minStock: 5 },
  ],
  roundMix: [
    { product: 'Roundup UltraMAX', per100: 1.25 },
    { product: 'LI 700', per100: 0.2 },
    { product: 'Shark', per100: 0.1 },
  ],
  roundDeducted: false,
  webhookUrl: '',
  notifyEmail: '',
};
const OLD_DEFAULT_STATUSES = ['To Spray', 'In Progress', 'Completed'];
const HAZARD_TYPES = ['Slip / Trip / Fall', 'Machinery', 'Vehicle', 'Chemical / Spray',
  'Electrical', 'Manual Handling', 'Environmental', 'Other'];
const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
// Seeded from GrapeLink Operator Job Sheet #766447 (Foliar/Full Canopy, 300 L/ha)
const SHEET_CANOPY_CARDS = [
  { id: 'js766447a', status: 'To Spray', done: false, fields: { Block: 'SB 01 - Home Block North', 'Total area': '3.15 ha', 'Water rate': '300 L/ha', Rows: '1 to 43', 'Vine row m': '11667', Vineyard: 'Loveblock Winery', Method: 'Foliar/Full Canopy', 'Job #': '766447' } },
  { id: 'js766447b', status: 'To Spray', done: false, fields: { Block: 'SB 02 - Home Block South', 'Total area': '3.30 ha', 'Water rate': '300 L/ha', Rows: '1 to 43', 'Vine row m': '12222', Vineyard: 'Loveblock Winery', Method: 'Foliar/Full Canopy', 'Job #': '766447' } },
  { id: 'js766447c', status: 'To Spray', done: false, fields: { Block: 'SYRAH - Home Block', 'Total area': '0.10 ha', 'Water rate': '300 L/ha', Rows: '1 to 3', 'Vine row m': '370', Vineyard: 'Loveblock Winery', Method: 'Foliar/Full Canopy', 'Job #': '766447' } },
];

/* ---------- helpers ---------- */
const todayStr = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);
const todayNZ = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
// times every 15 minutes, "HH:MM"
const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function calcHours(start, finish) {
  if (!start || !finish) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [fh, fm] = finish.split(':').map(Number);
  let mins = (fh * 60 + fm) - (sh * 60 + sm);
  if (mins < 0) mins += 1440;
  return Math.round((mins / 60) * 100) / 100;
}
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' });
}
function mondayOf(date) {
  const d = new Date(date); const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day); return d.toISOString().slice(0, 10);
}

// ---- spray mix + chemical usage helpers ----
const numOf = v => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
const fmtNum = n => { const r = Math.round(n * 100) / 100; return Number.isInteger(r) ? String(r) : String(r); };
function cardBlockName(card) {
  const f = card.fields || {}; const keys = Object.keys(f);
  if ('Block' in f) return f.Block;
  const k = keys.find(k => k.toLowerCase().includes('block') || k.toLowerCase().includes('task'));
  return k ? f[k] : (keys.length ? f[keys[0]] : '');
}
function cardArea(card, config) {
  const f = card.fields || {};
  const k = Object.keys(f).find(k => /area|\bha\b|hectare/i.test(k));
  let a = k ? numOf(f[k]) : 0;
  if (!a) { const b = (config.blocks || []).find(b => b.name === cardBlockName(card)); if (b) a = numOf(b.ha); }
  return a;
}
function cardWater(card, config) {
  const f = card.fields || {};
  const k = Object.keys(f).find(k => /water/i.test(k));
  const w = k ? numOf(f[k]) : 0;
  return w || numOf(config.waterRate) || 0;
}
function cardRows(card, config) {
  const f = card.fields || {};
  const k = Object.keys(f).find(k => /^rows?$/i.test(k) || /row range/i.test(k));
  if (k && f[k]) return String(f[k]);
  const b = (config.blocks || []).find(b => b.name === cardBlockName(card));
  return b && b.rows ? String(b.rows) : '';
}
const tankFor = (config, lane) => numOf((config.laneTanks || {})[lane]);
const productUnit = (config, name) => { const p = (config.products || []).find(p => p.name === name); return p ? (p.unit || '') : ''; };
// total of each product used across the given (done) cards, by label rate × volume
function roundUsage(cards, config) {
  const mix = config.roundMix || [];
  const used = {}; mix.forEach(m => { used[m.product] = 0; });
  cards.forEach(c => {
    const vol = cardArea(c, config) * cardWater(c, config); // litres of spray
    mix.forEach(m => { used[m.product] += numOf(m.per100) * vol / 100; });
  });
  return used;
}
function areaProgress(cards, config) {
  let done = 0, total = 0;
  cards.forEach(c => { const a = cardArea(c, config); total += a; if (c.done) done += a; });
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

// ---- spreadsheet import helpers ----
const NOISE_COLS = ['grapelink', 'modified by', 'modified', 'duration calc', 'predecessors',
  'sprint', 'variance', 'clone', 'rootstock', 'id', 'row id', 'rowid', 'sheet', 'created by', 'created'];
const isTruthy = v => ['true', 'yes', 'y', '1', 'x', 'done', '✓', 'complete', 'completed', 'sprayed'].includes(String(v).trim().toLowerCase());
function cellToStr(v) {
  if (v == null) return '';
  if (v instanceof Date) {
    const dd = String(v.getDate()).padStart(2, '0'), mm = String(v.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${v.getFullYear()}`;
  }
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  return String(v).replace(/\s+/g, ' ').trim();
}
// Excel stores dates as a serial number of days since 1899-12-30.
function serialToDate(n) {
  const d = new Date(Math.round((n - 25569) * 86400 * 1000));
  const dd = String(d.getUTCDate()).padStart(2, '0'), mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}
// Turn an array-of-arrays (any leading title rows tolerated) into row objects keyed by header.
function aoaToRows(aoa) {
  if (!aoa || !aoa.length) return [];
  let headerIdx = 0, best = -1;
  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    const count = (aoa[i] || []).filter(c => c != null && String(c).trim() !== '').length;
    if (count > best && count >= 2) { best = count; headerIdx = i; }
  }
  const seen = {};
  const headers = (aoa[headerIdx] || []).map((c, i) => {
    let h = (c != null && String(c).trim() !== '') ? String(c).trim() : `Column ${i + 1}`;
    if (seen[h]) { seen[h]++; h = `${h} (${seen[h]})`; } else seen[h] = 1; // keep duplicate columns distinct
    return h;
  });
  const rows = [];
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const arr = aoa[i]; if (!arr) continue;
    if (!arr.some(c => c != null && String(c).trim() !== '')) continue;
    const o = {}; headers.forEach((h, j) => { o[h] = arr[j] != null ? arr[j] : ''; });
    rows.push(o);
  }
  return rows;
}

/* ---------- shared style tokens ---------- */
const CREAM = '#F4F1EA';
const cls = {
  input: 'w-full px-3.5 py-3 rounded-lg border border-stone-300 bg-white text-stone-900 text-[15px] focus:outline-none focus:ring-2 focus:ring-stone-500/40 focus:border-stone-500',
  label: 'block text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500 mb-1.5',
  primary: 'inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-stone-900 text-stone-50 text-[15px] font-medium hover:bg-stone-800 active:bg-stone-700 transition-colors disabled:opacity-40',
  ghost: 'inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white border border-stone-300 text-stone-800 text-[15px] font-medium hover:bg-stone-50 transition-colors',
  card: 'bg-white border border-stone-200 rounded-xl',
};
const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

/* ============================================================
   Combobox (type to filter)
   ============================================================ */
function Combobox({ label, options, value, onChange, placeholder, icon: Icon }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const filtered = options.filter(o => o.toLowerCase().includes(q.toLowerCase()));
  return (
    <div ref={ref} className="relative">
      {label && <label className={cls.label}>{label}</label>}
      <div className="relative">
        {Icon && <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />}
        <input
          className={cls.input + (Icon ? ' pl-9' : '')}
          value={open ? q : value}
          placeholder={value || placeholder || 'Type to search…'}
          onFocus={() => { setOpen(true); setQ(''); }}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
        />
      </div>
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-56 overflow-auto bg-white border border-stone-300 rounded-lg shadow-lg">
          {filtered.length ? filtered.map(o => (
            <button key={o}
              onMouseDown={e => { e.preventDefault(); onChange(o); setOpen(false); setQ(''); }}
              className={'w-full text-left px-3.5 py-2.5 text-[15px] hover:bg-stone-100 ' + (o === value ? 'bg-stone-50 font-medium' : '')}>
              {o}
            </button>
          )) : <div className="px-3.5 py-3 text-stone-400 text-sm">No matches</div>}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Auth — numeric keypad
   ============================================================ */
function AuthScreen({ config, onSubmit }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const press = d => { setErr(''); setCode(c => (c.length < 8 ? c + d : c)); };
  const submit = () => {
    const ok = onSubmit(code);
    if (!ok) { setErr('Code not recognised'); setCode(''); }
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: CREAM }}>
      <div className="border-2 border-stone-800 px-4 py-1.5 mb-8">
        <span style={serif} className="text-2xl font-bold tracking-[0.18em] uppercase text-stone-900">{config.siteName}</span>
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500 mb-2">Enter your code</p>
      <div className="h-12 flex items-center justify-center mb-5">
        <span style={serif} className="text-3xl tracking-[0.3em] text-stone-900">{code ? code.replace(/./g, '•') : '—'}</span>
      </div>
      {err && <p className="text-red-700 text-sm mb-3">{err}</p>}
      <div className="grid grid-cols-3 gap-2.5 w-full max-w-[280px]">
        {keys.map(k => (
          <button key={k}
            onClick={() => k === 'C' ? (setCode(''), setErr('')) : k === '⌫' ? setCode(c => c.slice(0, -1)) : press(k)}
            className="h-16 rounded-xl bg-white border border-stone-300 text-stone-900 text-2xl font-light hover:bg-stone-100 active:bg-stone-200 transition-colors">
            {k}
          </button>
        ))}
      </div>
      <button onClick={submit} disabled={!code}
        className={cls.primary + ' w-full max-w-[280px] mt-4 py-4 text-base'}>
        Continue <ChevronRight size={18} />
      </button>
      <p className="mt-6 text-xs text-stone-400">Ask your manager for your code.</p>
    </div>
  );
}

/* ============================================================
   Top bar
   ============================================================ */
function TopBar({ siteName, subtitle, onBack, onLogout }) {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-300" style={{ backgroundColor: CREAM }}>
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-stone-200/60 text-stone-700">
              <ChevronRight size={20} className="rotate-180" />
            </button>
          )}
          <div className="border border-stone-800 px-2.5 py-1 shrink-0">
            <span style={serif} className="text-sm font-bold tracking-[0.14em] uppercase text-stone-900">{siteName}</span>
          </div>
          {subtitle && <span className="text-sm text-stone-500 truncate hidden sm:block">{subtitle}</span>}
        </div>
        <button onClick={onLogout} className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900 px-2 py-1">
          <LogOut size={16} /> <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}

function Banner({ msg }) {
  if (!msg) return null;
  return (
    <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm mb-4">
      <Check size={16} /> {msg}
    </div>
  );
}

/* ============================================================
   Spray board (kanban) — shared by operator & manager
   ============================================================ */
function RoundPanel({ tc, sprays, patchType }) {
  const [open, setOpen] = useState(false);
  const prog = areaProgress(sprays || [], tc);
  const products = tc.products || [];
  const mix = tc.roundMix || [];
  const laneTanks = tc.laneTanks || {};
  const setMix = next => patchType({ roundMix: next });

  const exportRound = () => {
    const m = tc.roundMix || [];
    const rows = (sprays || []).map(c => {
      const lane = c.status, area = cardArea(c, tc), water = cardWater(c, tc), vol = area * water;
      const row = {
        Block: cardBlockName(c), Operator: lane, 'Tank (L)': tankFor(tc, lane) || '',
        'Area (ha)': area, 'Water (L/ha)': water, 'Volume (L)': Math.round(vol),
        Done: c.done ? 'Yes' : 'No', 'Actual date': (c.fields && c.fields['Actual date']) || '',
      };
      m.forEach(x => { row[`${x.product} (${productUnit(tc, x.product)})`] = Math.round(numOf(x.per100) * vol / 100 * 100) / 100; });
      return row;
    });
    const used = roundUsage((sprays || []).filter(c => c.done), tc);
    const usage = products.filter(p => used[p.name] != null).map(p => ({
      Product: p.name, Unit: p.unit || '', 'Used this round': Math.round((used[p.name] || 0) * 100) / 100,
      'Opening stock': numOf(p.stock), Remaining: Math.round((numOf(p.stock) - (used[p.name] || 0)) * 100) / 100,
    }));
    const lanes = Object.keys(laneTanks);
    const mixSheet = m.map(x => {
      const row = { Product: x.product, 'Per 100 L': numOf(x.per100), Unit: productUnit(tc, x.product) };
      lanes.forEach(l => { row[`${l} · ${numOf(laneTanks[l])} L`] = Math.round(numOf(x.per100) * numOf(laneTanks[l]) / 100 * 100) / 100; });
      return row;
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), 'Spray round');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(usage.length ? usage : [{}]), 'Product usage');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mixSheet.length ? mixSheet : [{}]), 'Mix');
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `${tc.label || 'spray'}-round_${todayStr()}.xlsx`.replace(/\s+/g, '-').toLowerCase(); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className={cls.card + ' p-4 mb-5'}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Round progress · by area</span>
        <span className="text-sm text-stone-600">{fmtNum(prog.done)} / {fmtNum(prog.total)} ha</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-3 rounded-full bg-stone-100 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: prog.pct + '%', backgroundColor: prog.pct === 100 ? '#059669' : '#57534e' }} />
        </div>
        <span style={serif} className="text-xl font-bold text-stone-900 tabular-nums w-12 text-right">{prog.pct}%</span>
      </div>
      {prog.pct === 100 && prog.total > 0 && (
        <div className="mt-2 text-sm text-emerald-700 flex items-center gap-1.5"><Check size={15} /> Round complete — export below, then deduct stock in the Shed tab.</div>
      )}

      <div className="flex gap-2 mt-3 flex-wrap">
        <button onClick={() => setOpen(v => !v)} className={cls.ghost + ' !py-2 !px-3'}><Layers size={15} /> Round mix ({mix.length})</button>
        <button onClick={exportRound} className={cls.primary + ' !py-2 !px-3'}><Download size={15} /> Export round</button>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-stone-200">
          <p className="text-sm text-stone-500 mb-2">This mix applies to every block in the <b>{tc.label}</b> round. Full-tank amounts scale to each sprayer automatically.</p>
          {products.length === 0 && <p className="text-sm text-amber-700 mb-2">Add products in the Shed tab first.</p>}
          <div className="space-y-2">
            {mix.map((x, i) => (
              <div key={i} className="flex items-center gap-2">
                <select value={x.product} onChange={e => setMix(mix.map((y, j) => j === i ? { ...y, product: e.target.value } : y))} className={cls.input}>
                  {!products.some(p => p.name === x.product) && <option value={x.product}>{x.product}</option>}
                  {products.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
                <input value={x.per100} onChange={e => setMix(mix.map((y, j) => j === i ? { ...y, per100: e.target.value } : y))}
                  inputMode="decimal" className={cls.input + ' !w-24 text-right'} />
                <span className="text-sm text-stone-500 w-16">{productUnit(tc, x.product)}/100L</span>
                <button onClick={() => setMix(mix.filter((_, j) => j !== i))} className="p-2 rounded-lg hover:bg-red-50 text-red-500 shrink-0"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
          <button onClick={() => setMix([...mix, { product: products[0]?.name || '', per100: '' }])} className={cls.ghost + ' !py-2 !px-3 mt-2'}><Plus size={15} /> Add product to mix</button>
        </div>
      )}
    </div>
  );
}

function SprayHub({ config, setConfig, manager }) {
  const [active, setActive] = useState(null);
  const types = config.sprayTypes || [];
  const type = types.find(t => t.key === active);
  if (active && type) return <SprayBoard config={config} setConfig={setConfig} manager={manager} type={type} typeKey={active} onBack={() => setActive(null)} />;
  return (
    <div>
      <div className="flex items-center gap-2 text-stone-700 mb-4"><Droplets size={18} /><h2 className="text-lg font-semibold text-stone-900">Spray</h2></div>
      <div className="grid gap-3 sm:grid-cols-3">
        {types.map(t => {
          const lanes = Object.entries(t.laneTanks || {}).map(([l, v]) => `${l} · ${numOf(v)} L`);
          return (
            <button key={t.key} onClick={() => setActive(t.key)}
              className="text-left rounded-2xl border border-stone-200 bg-white p-5 hover:border-stone-400 hover:shadow-md transition-all active:scale-[0.99]">
              <div className="w-11 h-11 rounded-xl bg-stone-900 text-stone-50 flex items-center justify-center mb-3"><Droplets size={20} /></div>
              <div className="font-semibold text-stone-900 text-[15px]">{t.label}</div>
              <div className="text-[13px] text-stone-500 mt-1.5 space-y-0.5">
                {lanes.length ? lanes.map(l => <div key={l}>{l}</div>) : <div>No sprayers set</div>}
              </div>
              <div className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-stone-700">Open board <ChevronRight size={15} /></div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SprayBoard({ config, manager, setConfig, type, typeKey, onBack }) {
  const tc = useMemo(() => ({
    ...config,
    statuses: type.statuses, laneTanks: type.laneTanks,
    roundMix: type.roundMix, waterRate: type.waterRate, roundDeducted: type.roundDeducted,
  }), [config, type]);
  const SK = K.sprays(typeKey);
  const patchType = patch => {
    const next = (config.sprayTypes || []).map(t => (t.key === typeKey ? { ...t, ...patch } : t));
    setConfig({ ...config, sprayTypes: next });
  };
  const [sprays, setSprays] = useState(null);
  const [showLoader, setShowLoader] = useState(false);
  const [editing, setEditing] = useState(null);
  const [drag, setDrag] = useState(null);      // {card, x, y} while dragging — drives the ghost
  const [overCol, setOverCol] = useState(null); // status currently hovered
  const [overIndex, setOverIndex] = useState(null); // insertion position within the hovered lane
  const [view, setView] = useState('kanban');    // manager can switch to 'grid'

  const boardRef = useRef(null);
  const colRefs = useRef({});
  const listRefs = useRef({});      // inner card-list container per lane
  const dragRef = useRef(null);     // {card, fromStatus} once a drag is active
  const overColRef = useRef(null);
  const overIndexRef = useRef(null);
  const moveRef = useRef(null);
  const pendingRef = useRef(null);  // {card, startX, startY, type, active} from pointer-down until threshold
  const spraysRef = useRef([]);
  const dragActiveRef = useRef(false);
  const tmGuardRef = useRef(null);  // non-passive touchmove guard to stop scrolling mid-drag
  const lpTimerRef = useRef(null);  // long-press timer (touch)

  const load = async () => { const data = await loadJSON(SK, []); spraysRef.current = data; setSprays(data); };
  useEffect(() => { load(); }, []);
  useEffect(() => { spraysRef.current = sprays || []; }, [sprays]);

  const persist = async next => { setSprays(next); await saveJSON(SK, next); };
  const move = async (id, status) => {
    const fresh = await loadJSON(SK, sprays || []);
    await persist(fresh.map(c => (c.id === id ? { ...c, status } : c)));
  };
  const remove = async id => { await persist((sprays || []).filter(c => c.id !== id)); };

  const statuses = type.statuses;
  const grouped = useMemo(() => {
    const g = {}; statuses.forEach(s => (g[s] = []));
    (sprays || []).forEach(c => { (g[c.status] = g[c.status] || []).push(c); });
    Object.keys(g).forEach(s => {
      if (!statuses.includes(s) && g[s].length === 0) delete g[s];
      else g[s].sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0)); // done cards sink to the bottom
    });
    return g;
  }, [sprays, statuses]);

  const toggleDone = async card => {
    const fresh = await loadJSON(SK, sprays || []);
    await persist(fresh.map(c => {
      if (c.id !== card.id) return c;
      const done = !c.done;
      const fields = { ...c.fields };
      if (done) fields['Actual date'] = todayNZ(); else delete fields['Actual date'];
      return { ...c, done, fields };
    }));
  };

  // grid editing
  const columns = useMemo(() => {
    const set = [];
    (sprays || []).forEach(c => Object.keys(c.fields || {}).forEach(k => { if (!set.includes(k)) set.push(k); }));
    return set;
  }, [sprays]);

  // ----- drag handling: grab anywhere on a card; move between lanes AND reorder up/down -----
  // Mouse: drag starts immediately on movement. Touch: press-and-hold (~180ms) starts the drag,
  // so a quick swipe still scrolls the list. A non-passive touchmove guard blocks scroll mid-drag.
  const cleanupDrag = () => {
    if (moveRef.current) window.removeEventListener('pointermove', moveRef.current);
    if (tmGuardRef.current) window.removeEventListener('touchmove', tmGuardRef.current);
    if (lpTimerRef.current) clearTimeout(lpTimerRef.current);
    moveRef.current = null; tmGuardRef.current = null; lpTimerRef.current = null;
    pendingRef.current = null; dragRef.current = null;
    overColRef.current = null; overIndexRef.current = null;
    dragActiveRef.current = false;
    document.body.style.userSelect = '';
    setDrag(null); setOverCol(null); setOverIndex(null);
  };

  // Work out which lane the pointer is over and where in it the card would drop.
  const updateTarget = (x, y) => {
    let lane = null;
    for (const s of Object.keys(colRefs.current)) {
      const el = colRefs.current[s]; if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right) { lane = s; if (y >= r.top && y <= r.bottom) break; }
    }
    let index = 0;
    if (lane && listRefs.current[lane]) {
      const cards = Array.from(listRefs.current[lane].querySelectorAll('[data-card-id]'));
      index = cards.length;
      for (let i = 0; i < cards.length; i++) {
        const r = cards[i].getBoundingClientRect();
        if (y < r.top + r.height / 2) { index = i; break; }
      }
    }
    overColRef.current = lane; overIndexRef.current = index;
    setOverCol(lane); setOverIndex(index);
  };

  const drop = () => {
    const lane = overColRef.current; const d = dragRef.current;
    if (!lane || !d) return;
    const id = d.card.id;
    const arr = spraysRef.current.slice();
    const moving = arr.find(c => c.id === id); if (!moving) return;
    // current visual order of the target lane (done last), excluding the card being moved
    const laneCards = arr.filter(c => c.status === lane && c.id !== id)
      .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
    const idx = Math.min(Math.max(overIndexRef.current ?? laneCards.length, 0), laneCards.length);
    laneCards.splice(idx, 0, { ...moving, status: lane });
    // rebuild the whole array, canonicalised by lane order (only within-lane order is visible)
    const byLane = {}; statuses.forEach(s => (byLane[s] = []));
    arr.filter(c => c.status !== lane && c.id !== id).forEach(c => { (byLane[c.status] = byLane[c.status] || []).push(c); });
    byLane[lane] = laneCards;
    const order = [...statuses, ...Object.keys(byLane).filter(s => !statuses.includes(s))];
    const next = []; order.forEach(s => (byLane[s] || []).forEach(c => next.push(c)));
    spraysRef.current = next; persist(next);
  };

  const autoScroll = (x, y) => {
    const board = boardRef.current;
    if (board) {
      const br = board.getBoundingClientRect();
      if (x > br.right - 48) board.scrollLeft += 16;
      else if (x < br.left + 48) board.scrollLeft -= 16;
    }
    if (y < 72) window.scrollBy(0, -12);
    else if (y > window.innerHeight - 72) window.scrollBy(0, 12);
  };

  const startPointer = (e, card) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const isTouch = e.pointerType !== 'mouse';
    pendingRef.current = { card, startX: e.clientX, startY: e.clientY, type: e.pointerType, active: false };

    const activate = (x, y) => {
      const p = pendingRef.current; if (!p || p.active) return;
      p.active = true;
      dragRef.current = { card, fromStatus: card.status };
      dragActiveRef.current = true;
      document.body.style.userSelect = 'none';
      setDrag({ card, x, y });
      updateTarget(x, y);
    };

    const onMove = ev => {
      const p = pendingRef.current; if (!p) return;
      const x = ev.clientX, y = ev.clientY;
      if (!p.active) {
        const dx = x - p.startX, dy = y - p.startY;
        if (isTouch) {
          if (Math.abs(dx) > 9 || Math.abs(dy) > 9) cleanupDrag(); // moved before hold completed → let it scroll
          return;
        }
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        activate(x, y);
      }
      setDrag(d => (d ? { ...d, x, y } : { card, x, y }));
      updateTarget(x, y);
      autoScroll(x, y);
    };
    const onUp = () => {
      const p = pendingRef.current;
      if (p && p.active) drop();
      cleanupDrag();
    };

    moveRef.current = onMove;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    window.addEventListener('pointercancel', onUp, { once: true });

    if (isTouch) {
      tmGuardRef.current = ev => { if (dragActiveRef.current && ev.cancelable) ev.preventDefault(); };
      window.addEventListener('touchmove', tmGuardRef.current, { passive: false });
      lpTimerRef.current = setTimeout(() => {
        if (pendingRef.current && !pendingRef.current.active) activate(pendingRef.current.startX, pendingRef.current.startY);
      }, 180);
    }
  };

  if (sprays === null) return <div className="p-8 text-center text-stone-400">Loading spray plan…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-stone-700 min-w-0">
          {onBack && <button onClick={onBack} className="p-1.5 -ml-1.5 rounded-lg hover:bg-stone-100 text-stone-500 shrink-0"><ChevronLeft size={20} /></button>}
          <Droplets size={18} /><h2 className="text-lg font-semibold text-stone-900 truncate">{type.label}</h2>
          <span className="text-sm text-stone-400 shrink-0">· {sprays.length} cards</span>
        </div>
        <div className="flex items-center gap-2">
          {manager && (
            <div className="inline-flex rounded-lg border border-stone-300 overflow-hidden">
              <button onClick={() => setView('kanban')} className={'px-3 py-2 text-sm font-medium ' + (view === 'kanban' ? 'bg-stone-900 text-stone-50' : 'bg-white text-stone-600 hover:bg-stone-50')}>Kanban</button>
              <button onClick={() => setView('grid')} className={'px-3 py-2 text-sm font-medium border-l border-stone-300 ' + (view === 'grid' ? 'bg-stone-900 text-stone-50' : 'bg-white text-stone-600 hover:bg-stone-50')}>Grid</button>
            </div>
          )}
          <button onClick={load} className={cls.ghost + ' !py-2 !px-3'}><RefreshCw size={15} /> Refresh</button>
          {manager && <button onClick={() => setShowLoader(v => !v)} className={cls.primary + ' !py-2 !px-3'}><Upload size={15} /> Load data</button>}
        </div>
      </div>

      {manager && <RoundPanel tc={tc} sprays={sprays} patchType={patchType} />}

      {(!manager || view === 'kanban') && (
        <p className="text-xs text-stone-400 mb-3">Drag a card to reorder it up/down or move it between lanes. On a phone, press and hold a card first, then drag. Tick <span className="text-emerald-600 font-medium">Done</span> when sprayed — it sinks to the bottom and turns green.</p>
      )}

      {manager && showLoader && (
        <SprayLoader config={tc} setConfig={cfg => patchType({ statuses: cfg.statuses })}
          onLoaded={async (cards, replace, meta) => {
            const base = replace ? [] : await loadJSON(SK, sprays);
            const patch = {};
            if (replace && type.roundDeducted) patch.roundDeducted = false;
            if (meta && meta.mix && meta.mix.length) patch.roundMix = meta.mix;
            if (meta && meta.waterRate) patch.waterRate = meta.waterRate;
            if (Object.keys(patch).length || (meta && meta.products && meta.products.length)) {
              const next = { ...config };
              if (meta && meta.products && meta.products.length) {
                const have = new Set((config.products || []).map(p => p.name));
                next.products = [...(config.products || []), ...meta.products.filter(p => !have.has(p.name))];
              }
              next.sprayTypes = (config.sprayTypes || []).map(t => (t.key === typeKey ? { ...t, ...patch } : t));
              setConfig(next);
            }
            await persist([...base, ...cards]);
            setShowLoader(false);
          }} />
      )}

      {manager && view === 'grid' ? (
        <SprayGrid sprays={sprays} statuses={statuses} columns={columns} onPersist={persist} onToggleDone={toggleDone} config={tc} />
      ) : (
        <div ref={boardRef} className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4">
          {Object.keys(grouped).map(status => (
            <div key={status}
              ref={el => { colRefs.current[status] = el; }}
              className={'shrink-0 w-[280px] rounded-xl transition-colors ' + (overCol === status ? 'bg-stone-200/60 ring-2 ring-stone-400' : '')}>
              <div className="flex items-center justify-between mb-2.5 px-2 pt-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-600">{status}</span>
                <span className="text-xs text-stone-400 bg-stone-200/70 rounded-full px-2 py-0.5">{grouped[status].length}</span>
              </div>
              <div ref={el => { listRefs.current[status] = el; }} className="space-y-3 px-2 pb-2 min-h-[80px]">
                {(() => {
                  const visible = grouped[status].filter(c => !(drag && drag.card.id === c.id));
                  const showInd = !!drag && overCol === status;
                  const line = <div className="h-1.5 rounded-full bg-emerald-500/80 mx-1" />;
                  if (visible.length === 0 && !showInd) {
                    return <div className="text-sm text-stone-400 italic py-6 text-center border border-dashed border-stone-300 rounded-xl">Drop here</div>;
                  }
                  const items = [];
                  visible.forEach((card, i) => {
                    if (showInd && overIndex === i) items.push(<div key={'ind-' + i}>{line}</div>);
                    items.push(
                      <div key={card.id} data-card-id={card.id}>
                        <SprayCard card={card} manager={manager}
                          tank={tankFor(tc, status)} roundMix={tc.roundMix || []} config={tc}
                          onStartDrag={e => startPointer(e, card)}
                          onToggleDone={() => toggleDone(card)}
                          onEdit={() => setEditing(card)} onDelete={() => remove(card.id)} />
                      </div>
                    );
                  });
                  if (showInd && (overIndex == null || overIndex >= visible.length)) items.push(<div key="ind-end">{line}</div>);
                  return items;
                })()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* drag ghost */}
      {drag && (
        <div className="fixed z-[60] pointer-events-none w-[256px] opacity-90"
          style={{ left: drag.x, top: drag.y, transform: 'translate(-30px, -20px) rotate(2deg)' }}>
          <SprayCard card={drag.card} manager={false} ghost tank={tankFor(tc, drag.card.status)} roundMix={tc.roundMix || []} config={tc} />
        </div>
      )}

      {editing && (
        <SprayEditor card={editing} statuses={statuses}
          onClose={() => setEditing(null)}
          onSave={async updated => {
            await persist((sprays || []).map(c => (c.id === updated.id ? updated : c)));
            setEditing(null);
          }} />
      )}
    </div>
  );
}

function SprayCard({ card, manager, onStartDrag, onEdit, onDelete, onToggleDone, dragging, ghost, tank = 0, roundMix = [], config = {} }) {
  const [showPart, setShowPart] = useState(false);
  const f = card.fields || {};
  const keys = Object.keys(f);
  const findKey = names => keys.find(k => names.some(n => k.toLowerCase().includes(n)));
  const titleKey = ('Block' in f) ? 'Block' : (findKey(['block', 'task']) || keys[0]);
  const productKey = ('Product' in f) ? 'Product' : (findKey(['product', 'mix', 'chemical', 'spray']) || null);
  const block = (titleKey && f[titleKey]) || 'Card';
  const showMix = (roundMix || []).length > 0;
  const product = showMix ? '' : (productKey ? f[productKey] : '');

  // structured figures
  const area = cardArea(card, config);
  const wr = cardWater(card, config);
  const rows = cardRows(card, config);
  const totalWater = area * wr;
  const fullTanks = tank > 0 ? Math.floor((totalWater + 1e-6) / tank) : 0;
  const remainder = tank > 0 ? Math.max(0, totalWater - fullTanks * tank) : totalWater;
  const hasPart = tank > 0 && remainder > 0.5;
  const PART_EXTRA = 40;            // always mix 40 L more than the part tank needs
  const partVol = remainder + PART_EXTRA;

  // hide fields we now render structurally
  const shownKeys = new Set([titleKey, productKey]);
  const isStructural = k => /total area|^area$|hectare|^ha$|water|^rows?$/i.test(k);
  const rest = keys.filter(k => !shownKeys.has(k) && f[k] !== '' && f[k] != null && !(showMix && /mix|product/i.test(k)) && !isStructural(k));
  const done = !!card.done;
  const stop = e => e.stopPropagation();
  const MixLine = ({ name, amt }) => (
    <div className="flex justify-between gap-2 text-[13.5px] leading-snug">
      <span className="text-stone-700 truncate">{name}</span>
      <span className="text-stone-900 font-medium shrink-0 tabular-nums">{fmtNum(amt)} {productUnit(config, name)}</span>
    </div>
  );
  const Fact = ({ label, value }) => (
    <div className="min-w-0">
      <div className="text-[10.5px] uppercase tracking-wide text-stone-400 leading-tight">{label}</div>
      <div className={'text-[14px] font-medium leading-tight truncate ' + (done ? 'text-stone-500' : 'text-stone-900')}>{value}</div>
    </div>
  );
  const tanksLabel = tank <= 0 ? 'Assign a sprayer'
    : remainder <= 0.5 ? `${fullTanks} full tank${fullTanks === 1 ? '' : 's'}`
      : fullTanks === 0 ? `Part tank · ${fmtNum(remainder)} L`
        : `${fullTanks} full + part ${fmtNum(remainder)} L`;

  return (
    <div
      onPointerDown={ghost ? undefined : onStartDrag}
      style={ghost ? undefined : { touchAction: 'pan-y' }}
      className={
        'border rounded-xl shadow-sm select-none ' +
        (ghost ? 'bg-white shadow-xl ' : 'cursor-grab active:cursor-grabbing ') +
        (dragging ? 'opacity-30 ' : '') +
        (done ? 'bg-stone-50 border-stone-200 opacity-60 ' : 'bg-white border-stone-200 ')
      }>
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className={'font-semibold leading-tight text-[15.5px] ' + (done ? 'text-stone-500 line-through' : 'text-stone-900')}>{block}</div>
            {product && <div className={'text-[15px] mt-0.5 break-words ' + (done ? 'text-stone-400' : 'text-stone-700')}>{product}</div>}
          </div>
          {manager && !ghost && (
            <div className="flex gap-1 shrink-0">
              <button onPointerDown={stop} onClick={onEdit} className="p-1.5 rounded-md hover:bg-stone-100 text-stone-500"><Pencil size={15} /></button>
              <button onPointerDown={stop} onClick={onDelete} className="p-1.5 rounded-md hover:bg-red-50 text-red-500"><Trash2 size={15} /></button>
            </div>
          )}
        </div>

        {/* key figures */}
        {(area > 0 || rows || wr > 0) && (
          <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2">
            {area > 0 && <Fact label="Total area" value={`${fmtNum(area)} ha`} />}
            {rows && <Fact label="Rows" value={rows} />}
            {wr > 0 && <Fact label="Water rate" value={`${fmtNum(wr)} L/ha`} />}
            {totalWater > 0 && <Fact label="Total water" value={`${fmtNum(totalWater)} L`} />}
            {totalWater > 0 && <div className="col-span-2"><Fact label="Tanks" value={tanksLabel} /></div>}
          </div>
        )}

        {rest.length > 0 && (
          <dl className="mt-2.5 space-y-1">
            {rest.map(k => (
              <div key={k} className="flex gap-2 text-[14px] leading-snug">
                <dt className="text-stone-400 shrink-0 min-w-[84px]">{k}</dt>
                <dd className={done ? 'text-stone-500 break-words' : 'text-stone-800 break-words'}>{String(f[k])}</dd>
              </div>
            ))}
          </dl>
        )}

        {showMix && (
          <div className="mt-3 rounded-lg bg-stone-50 border border-stone-200 p-2.5 space-y-0.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500 mb-1">100 L mix</div>
            {roundMix.map(m => <MixLine key={'p' + m.product} name={m.product} amt={numOf(m.per100)} />)}
            {tank > 0 ? (
              <>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700 mt-2 mb-1">Full tank mix · {tank} L</div>
                {roundMix.map(m => <MixLine key={'t' + m.product} name={m.product} amt={numOf(m.per100) * tank / 100} />)}
                {hasPart && !ghost && (
                  <div className="mt-2">
                    <button onPointerDown={stop} onClick={() => setShowPart(v => !v)}
                      className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-stone-700 bg-white border border-stone-300 rounded-full px-2.5 py-1 hover:bg-stone-50">
                      <Beaker size={13} /> {showPart ? 'Hide' : 'Part tank mix'} · {fmtNum(remainder)} L
                    </button>
                    {showPart && (
                      <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5 space-y-0.5">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700 mb-1">Part tank · mix for {fmtNum(partVol)} L <span className="normal-case font-normal text-amber-600">({fmtNum(remainder)} L + 40 L)</span></div>
                        {roundMix.map(m => <MixLine key={'pt' + m.product} name={m.product} amt={numOf(m.per100) * partVol / 100} />)}
                        <div className="text-[11.5px] text-amber-700/80 pt-1">Water to {fmtNum(partVol)} L.</div>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-[12px] text-stone-400 mt-1.5">Drop into an operator's lane for the full-tank mix.</div>
            )}
          </div>
        )}
        {!ghost && (
          <button onPointerDown={stop} onClick={onToggleDone}
            className={'mt-3 inline-flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full text-sm font-medium border transition-colors ' +
              (done ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-white border-stone-300 text-stone-600 hover:bg-stone-50')}>
            <span className={'w-5 h-5 rounded-md flex items-center justify-center border ' + (done ? 'border-white/70 bg-white/20' : 'border-stone-400')}>
              {done && <Check size={13} />}
            </span>
            {done ? 'Done' : 'Mark done'}
          </button>
        )}
      </div>
    </div>
  );
}

function SprayGrid({ sprays, statuses, columns, onPersist, config = {} }) {
  const [rows, setRows] = useState(sprays || []);
  const editing = useRef(false);
  const [newCol, setNewCol] = useState('');
  useEffect(() => { if (!editing.current) setRows(sprays || []); }, [sprays]);

  const commit = next => { setRows(next); onPersist(next); };
  const setCell = (id, key, value) => setRows(rs => rs.map(c => (c.id === id ? { ...c, fields: { ...c.fields, [key]: value } } : c)));
  const persistNow = () => { editing.current = false; setRows(rs => { onPersist(rs); return rs; }); };
  const setLane = (id, status) => commit(rows.map(c => (c.id === id ? { ...c, status } : c)));
  const toggleDone = id => commit(rows.map(c => {
    if (c.id !== id) return c;
    const done = !c.done; const fields = { ...c.fields };
    if (done) fields['Actual date'] = todayNZ(); else delete fields['Actual date'];
    return { ...c, done, fields };
  }));
  const del = id => commit(rows.filter(c => c.id !== id));
  const add = () => { const fields = {}; columns.forEach(k => (fields[k] = '')); commit([...rows, { id: uid(), status: statuses[0], done: false, fields }]); };
  const addColumn = () => {
    const k = newCol.trim(); if (!k || columns.includes(k)) { setNewCol(''); return; }
    commit(rows.map(c => ({ ...c, fields: { ...c.fields, [k]: c.fields[k] ?? '' } }))); setNewCol('');
  };

  return (
    <div>
      <div className="overflow-x-auto border border-stone-200 rounded-xl bg-white">
        <table className="text-sm whitespace-nowrap">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-stone-500 border-b border-stone-200 bg-stone-50">
              <th className="px-3 py-2.5 font-semibold">Done</th>
              <th className="px-3 py-2.5 font-semibold">Lane</th>
              <th className="px-3 py-2.5 font-semibold">Mix</th>
              {columns.map(k => <th key={k} className="px-3 py-2.5 font-semibold">{k}</th>)}
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length + 4} className="px-3 py-6 text-center text-stone-400">No cards. Add one below or load your diary.</td></tr>
            ) : rows.map(c => (
              <tr key={c.id} className={'border-b border-stone-100 last:border-0 ' + (c.done ? 'bg-emerald-50/40' : '')}>
                <td className="px-3 py-2 text-center">
                  <input type="checkbox" checked={!!c.done} onChange={() => toggleDone(c.id)} className="w-4 h-4 accent-emerald-600" />
                </td>
                <td className="px-2 py-2">
                  <select value={c.status} onChange={e => setLane(c.id, e.target.value)}
                    className="px-2 py-1.5 rounded-md border border-stone-200 bg-white text-stone-800 text-[13px] focus:outline-none focus:ring-2 focus:ring-stone-400/40">
                    {statuses.map(s => <option key={s}>{s}</option>)}
                    {!statuses.includes(c.status) && <option>{c.status}</option>}
                  </select>
                </td>
                <td className="px-3 py-2 align-top">
                  {(config.roundMix || []).length === 0 ? <span className="text-stone-300">—</span> : (() => {
                    const tank = tankFor(config, c.status);
                    return (
                      <div className="space-y-0.5">
                        {(config.roundMix || []).map(m => {
                          const amt = tank > 0 ? numOf(m.per100) * tank / 100 : numOf(m.per100);
                          return (
                            <div key={m.product} className="text-[13px] leading-tight text-stone-800">
                              {m.product} - <span className="font-medium tabular-nums">{fmtNum(amt)} {productUnit(config, m.product)}{tank > 0 ? '' : '/100L'}</span>
                            </div>
                          );
                        })}
                        <div className="text-[10px] uppercase tracking-wide text-stone-400 pt-0.5">{tank > 0 ? `full tank · ${tank} L` : 'per 100 L'}</div>
                      </div>
                    );
                  })()}
                </td>
                {columns.map(k => (
                  <td key={k} className="px-2 py-2">
                    <input value={c.fields[k] ?? ''} onFocus={() => (editing.current = true)}
                      onChange={e => setCell(c.id, k, e.target.value)} onBlur={persistNow}
                      className="w-full min-w-[130px] px-2 py-1.5 rounded-md border border-stone-200 bg-white text-stone-800 text-[13px] focus:outline-none focus:ring-2 focus:ring-stone-400/40" />
                  </td>
                ))}
                <td className="px-2 py-2 text-right">
                  <button onClick={() => del(c.id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button onClick={add} className={cls.primary + ' !py-2 !px-3'}><Plus size={15} /> Add card</button>
        <div className="flex items-center gap-2 ml-auto">
          <input value={newCol} onChange={e => setNewCol(e.target.value)} onKeyDown={e => e.key === 'Enter' && addColumn()} placeholder="New column name" className={cls.input + ' !w-44 !py-2'} />
          <button onClick={addColumn} className={cls.ghost + ' !py-2 !px-3'}><Plus size={15} /> Column</button>
        </div>
      </div>
      <p className="text-xs text-stone-400 mt-2">Edits save when you click out of a cell. Ticking Done stamps today as the Actual date and sinks the card in Kanban view.</p>
    </div>
  );
}

/* ---------- GrapeLink Operator Job Sheet (PDF) import ---------- */
// Extract a PDF into rows; each row is an array of cell strings, left→right.
async function extractPdfRows(arrayBuffer) {
  const pdfjs = await import('pdfjs-dist');
  try {
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch {
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs';
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const map = new Map();
    for (const it of tc.items) {
      const s = (it.str || '').trim(); if (!s) continue;
      const x = it.transform[4], y = Math.round(it.transform[5]);
      let key = [...map.keys()].find(k => Math.abs(k - y) <= 3);
      if (key == null) { key = y; map.set(key, []); }
      map.get(key).push({ x, s });
    }
    [...map.entries()].sort((a, b) => b[0] - a[0]).forEach(([, items]) => out.push(items.sort((a, b) => a.x - b.x).map(i => i.s)));
  }
  return out;
}

const isNumStr = v => /^-?\d+(\.\d+)?$/.test(String(v).trim());
// normalise a rate+unit to L / Kg (mL→L, g→Kg)
function normRate(per100, unit) {
  const u = (unit || '').toLowerCase();
  if (u === 'ml') return { per100: per100 / 1000, unit: 'L' };
  if (u === 'g') return { per100: per100 / 1000, unit: 'Kg' };
  return { per100, unit: unit || '' };
}

// Parse extracted rows from a GrapeLink Operator Job Sheet.
function parseGrapeLink(rows) {
  const findAfter = label => {
    for (const cells of rows) {
      const i = cells.findIndex(c => c.toLowerCase().replace(/\s+/g, ' ').includes(label));
      if (i >= 0) for (let j = i + 1; j < cells.length; j++) if (isNumStr(cells[j])) return numOf(cells[j]);
    }
    return null;
  };
  const waterRate = findAfter('spray vol/ha');
  const tank = findAfter('tank');
  let method = '';
  for (const cells of rows) { const i = cells.findIndex(c => /application method/i.test(c)); if (i >= 0 && cells[i + 1]) { method = cells[i + 1]; break; } }

  const startM = rows.findIndex(c => c.join(' ').toLowerCase().includes('materials to apply'));
  const endM = rows.findIndex(c => c.join(' ').toLowerCase().includes('blocks included'));
  const mix = [], products = [];
  for (let r = startM; r < endM && r >= 0; r++) {
    const cells = rows[r]; if (!cells) continue;
    const name0 = cells[0] || '';
    if (/^(water|hasprayed|materials|cf|rate|dilute|mix)/i.test(name0) || !/[A-Za-z]/.test(name0)) continue;
    const nums = [], unitsAfter = [];
    for (let k = 1; k < cells.length; k++) if (isNumStr(cells[k])) { nums.push(numOf(cells[k])); unitsAfter.push(cells[k + 1] && !isNumStr(cells[k + 1]) ? cells[k + 1] : ''); }
    if (nums.length < 3) continue;                       // dilute, CF, mix-rate at least
    const { per100, unit } = normRate(nums[2], unitsAfter[2] || unitsAfter[0]);   // Mix Rate/100L
    const name = name0.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
    mix.push({ product: name, per100: Math.round(per100 * 1000) / 1000 });
    products.push({ name, unit, concentration: '', rate: Math.round(per100 * 1000) / 1000, stock: '', minStock: '' });
  }

  const endB = rows.findIndex((c, i) => i > endM && /^totals/i.test(c[0] || ''));
  const cards = [];
  for (let r = endM + 1; r < (endB < 0 ? rows.length : endB); r++) {
    const cells = rows[r]; if (!cells || cells.length < 8) continue;
    const len = cells.length;
    if (!cells.slice(len - 7).every(isNumStr)) continue;  // 7 trailing numeric columns
    const ha = numOf(cells[len - 6]);
    const haVol = numOf(cells[len - 3]);
    const block = cells.slice(1, len - 7).join(' ').trim();
    if (!block || !ha) continue;
    cards.push({ block, vineyard: cells[0], ha, waterRate: haVol || waterRate });
  }
  return { waterRate, tank, method, mix, products, cards };
}

function SprayLoader({ config, setConfig, onLoaded }) {
  const [text, setText] = useState('');
  const [replace, setReplace] = useState(true);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  const rowsToCards = rows => {
    if (!rows.length) return [];
    const headers = Object.keys(rows[0] || {});
    const hasData = {}; headers.forEach(h => { hasData[h] = rows.some(r => cellToStr(r[h]) !== ''); });
    const lc = h => h.toLowerCase();
    const assignedKey = headers.find(h => lc(h).includes('assigned'));
    const doneKey = headers.find(h => ['sprayed', 'done', 'complete', 'completed'].includes(lc(h)) || lc(h).includes('sprayed'));
    const statusKey = headers.find(h => lc(h) === 'status');

    const cards = []; const newStatuses = new Set();
    rows.forEach(r => {
      if (!headers.some(h => cellToStr(r[h]) !== '')) return;
      const sVal = statusKey ? cellToStr(r[statusKey]) : '';
      const aVal = assignedKey ? cellToStr(r[assignedKey]) : '';
      let status = sVal || aVal || config.statuses[0];
      if (status && !config.statuses.includes(status) && !newStatuses.has(status)) newStatuses.add(status);
      const done = doneKey ? isTruthy(r[doneKey]) : false;
      const fields = {};
      headers.forEach(h => {
        if (!hasData[h] || NOISE_COLS.includes(lc(h))) return;
        if (h === statusKey || h === assignedKey || h === doneKey) return;
        const raw = r[h];
        const val = (/date/i.test(h) && typeof raw === 'number' && raw > 20000 && raw < 80000)
          ? serialToDate(raw) : cellToStr(raw);
        if (val !== '') fields[h] = val;
      });
      cards.push({ id: uid(), status: status || config.statuses[0], done, fields });
    });
    if (newStatuses.size) setConfig({ ...config, statuses: [...config.statuses, ...newStatuses] });
    return cards;
  };

  const parseText = () => {
    setErr('');
    if (!text.trim()) { setErr('Paste some rows first.'); return; }
    const aoa = Papa.parse(text.replace(/\r/g, ''), { skipEmptyLines: true }).data;
    const cards = rowsToCards(aoaToRows(aoa));
    if (!cards.length) { setErr('No data rows found. Make sure one row holds your column headers.'); return; }
    onLoaded(cards, replace);
  };

  const parseFile = file => {
    setErr('');
    const name = file.name.toLowerCase();
    const reader = new FileReader();
    if (name.endsWith('.pdf')) {
      reader.onload = async e => {
        try {
          const rows = await extractPdfRows(e.target.result);
          const g = parseGrapeLink(rows);
          if (!g.cards.length) { setErr('Couldn’t read any blocks from that PDF. Is it a GrapeLink Operator Job Sheet?'); return; }
          const cards = g.cards.map(c => ({
            id: uid(), status: (config.statuses || [])[0] || 'To Spray', done: false,
            fields: {
              Block: c.block, 'Total area': `${fmtNum(c.ha)} ha`,
              'Water rate': `${fmtNum(c.waterRate || g.waterRate || 0)} L/ha`,
              Vineyard: c.vineyard || '', Method: g.method || '',
            },
          }));
          onLoaded(cards, replace, { mix: g.mix, waterRate: g.waterRate, products: g.products });
        } catch (err) {
          setErr('Couldn’t read that PDF in this view. PDF import runs in the installed app — or paste the rows instead.');
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }
    reader.onload = e => {
      try {
        let aoa;
        if (name.endsWith('.csv') || name.endsWith('.tsv')) {
          aoa = Papa.parse(String(e.target.result).replace(/\r/g, ''), { skipEmptyLines: true }).data;
        } else {
          const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
          aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
        }
        const cards = rowsToCards(aoaToRows(aoa));
        if (!cards.length) { setErr('No data rows found in that file.'); return; }
        onLoaded(cards, replace);
      } catch { setErr('Could not read that file.'); }
    };
    if (name.endsWith('.csv') || name.endsWith('.tsv')) reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  };

  return (
    <div className={cls.card + ' p-4 mb-5'}>
      <p className="text-sm text-stone-600 mb-3">
        Upload a <b>GrapeLink Operator Job Sheet</b> (.pdf) to load a round — blocks, areas, water rate and the product mix are read in automatically. You can also upload your <b>Spray Diary</b> (.xlsx/.csv) or paste rows.
      </p>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={5}
        placeholder={'Block\tProduct\tRate\tTarget\tWater Rate\tDate\tWHP\tStatus\nBlock 1\tSulphur 80WG\t3 kg/ha\tPowdery Mildew\t300 L/ha\t2026-11-15\t0 days\tTo Spray'}
        className={cls.input + ' font-mono text-[12px] resize-y'} />
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        <label className="inline-flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} className="w-4 h-4 accent-stone-800" />
          Replace existing cards
        </label>
        <div className="flex gap-2 ml-auto">
          <input ref={fileRef} type="file" accept=".pdf,.csv,.tsv,.xlsx,.xls" className="hidden"
            onChange={e => e.target.files[0] && parseFile(e.target.files[0])} />
          <button onClick={() => fileRef.current?.click()} className={cls.ghost + ' !py-2 !px-3'}><Upload size={15} /> Upload PDF / file</button>
          <button onClick={parseText} className={cls.primary + ' !py-2 !px-3'}><Check size={15} /> Load pasted rows</button>
        </div>
      </div>
      {err && <p className="text-red-700 text-sm mt-2">{err}</p>}
    </div>
  );
}

function SprayEditor({ card, statuses, onClose, onSave }) {
  const [fields, setFields] = useState({ ...card.fields });
  const [status, setStatus] = useState(card.status);
  const [newKey, setNewKey] = useState('');
  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-stone-200 sticky top-0 bg-white">
          <h3 className="font-semibold text-stone-900">Edit card</h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-stone-100 text-stone-500"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className={cls.label}>Status (lane)</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className={cls.input}>
              {statuses.map(s => <option key={s}>{s}</option>)}
              {!statuses.includes(status) && <option>{status}</option>}
            </select>
          </div>
          {Object.keys(fields).map(k => (
            <div key={k}>
              <label className={cls.label + ' flex items-center justify-between'}>
                <span>{k}</span>
                <button onClick={() => setFields(f => { const n = { ...f }; delete n[k]; return n; })} className="text-red-500 normal-case tracking-normal text-xs">remove</button>
              </label>
              <input value={fields[k]} onChange={e => setFields(f => ({ ...f, [k]: e.target.value }))} className={cls.input} />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="Add a field (e.g. Operator)" className={cls.input} />
            <button onClick={() => { if (newKey.trim()) { setFields(f => ({ ...f, [newKey.trim()]: '' })); setNewKey(''); } }} className={cls.ghost + ' shrink-0'}><Plus size={16} /></button>
          </div>
        </div>
        <div className="p-4 border-t border-stone-200 flex gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className={cls.ghost + ' flex-1'}>Cancel</button>
          <button onClick={() => onSave({ ...card, status, fields })} className={cls.primary + ' flex-1'}>Save card</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Timesheet — operator entry + own hours
   ============================================================ */
function TimesheetOperator({ config, session }) {
  const [date, setDate] = useState(todayStr());
  const [start, setStart] = useState('');
  const [finish, setFinish] = useState('');
  const [block, setBlock] = useState('');
  const [job, setJob] = useState('');
  const [note, setNote] = useState('');
  const [entries, setEntries] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => setEntries(await loadJSON(K.ts(session.code), []));
  useEffect(() => { load(); }, []);

  const hours = calcHours(start, finish);
  const valid = date && start && finish && block && job;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    const jobObj = config.jobs.find(j => j.name === job);
    const entry = { id: uid(), operatorCode: session.code, operatorName: session.name, date, start, finish, hours, block, job, jobCode: jobObj ? jobObj.code : '', note: note.trim(), createdAt: Date.now() };
    const fresh = await loadJSON(K.ts(session.code), entries);
    const next = [entry, ...fresh];
    await saveJSON(K.ts(session.code), next);
    setEntries(next);
    setStart(''); setFinish(''); setBlock(''); setJob(''); setNote('');
    setMsg(`Saved ${hours} h on ${block}.`); setBusy(false);
    setTimeout(() => setMsg(''), 4000);
  };

  const removeEntry = async id => {
    const next = entries.filter(e => e.id !== id);
    await saveJSON(K.ts(session.code), next); setEntries(next);
  };

  const weekStart = mondayOf(new Date());
  const weekTotal = entries.filter(e => e.date >= weekStart).reduce((s, e) => s + (e.hours || 0), 0);
  const grandTotal = entries.reduce((s, e) => s + (e.hours || 0), 0);

  return (
    <div className="space-y-6">
      <Banner msg={msg} />
      <div className={cls.card + ' p-4'}>
        <div className="flex items-center gap-2 mb-4 text-stone-700"><Clock size={18} /><h2 className="text-lg font-semibold text-stone-900">Log time</h2></div>
        <div className="space-y-3.5">
          <div><label className={cls.label}>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className={cls.input} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={cls.label}>Start</label>
              <select value={start} onChange={e => setStart(e.target.value)} className={cls.input}>
                <option value="">--:--</option>
                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className={cls.label}>Finish</label>
              <select value={finish} onChange={e => setFinish(e.target.value)} className={cls.input}>
                <option value="">--:--</option>
                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <Combobox label="Block" options={(config.blocks || []).map(b => b.name)} value={block} onChange={setBlock} icon={MapPin} placeholder="Search blocks…" />
          <Combobox label="Job" options={config.jobs.map(j => j.name)} value={job} onChange={setJob} icon={Layers} placeholder="Search jobs…" />
          <div><label className={cls.label}>Note (optional)</label><input value={note} onChange={e => setNote(e.target.value)} className={cls.input} placeholder="Anything worth recording" /></div>
          <div className="flex items-center justify-between pt-1">
            <div className="text-sm text-stone-500">Total: <span className="font-semibold text-stone-900 text-base">{hours} h</span></div>
            <button onClick={submit} disabled={!valid || busy} className={cls.primary}>{busy ? 'Saving…' : 'Save entry'} <Check size={16} /></button>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-stone-900">Your hours</h3>
          <div className="flex gap-4 text-sm">
            <span className="text-stone-500">This week <b className="text-stone-900">{Math.round(weekTotal * 100) / 100} h</b></span>
            <span className="text-stone-500">All time <b className="text-stone-900">{Math.round(grandTotal * 100) / 100} h</b></span>
          </div>
        </div>
        {entries.length === 0 ? (
          <p className="text-stone-400 text-sm py-6 text-center border border-dashed border-stone-300 rounded-xl">No entries yet. Log your first above.</p>
        ) : (
          <div className="space-y-2">
            {entries.map(e => (
              <div key={e.id} className="flex items-center gap-3 bg-white border border-stone-200 rounded-lg px-3.5 py-3">
                <div className="text-center shrink-0 w-14">
                  <div className="text-lg font-semibold text-stone-900 leading-none">{e.hours}</div>
                  <div className="text-[10px] uppercase tracking-wide text-stone-400">hours</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] text-stone-900 truncate">{e.block} · {e.job}</div>
                  <div className="text-xs text-stone-500">{fmtDate(e.date)} · {e.start}–{e.finish}{e.note ? ` · ${e.note}` : ''}</div>
                </div>
                <button onClick={() => removeEntry(e.id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-400 shrink-0"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Hazard — operator form + own reports
   ============================================================ */
const sevStyle = {
  Low: 'bg-stone-100 text-stone-700 border-stone-300',
  Medium: 'bg-amber-100 text-amber-800 border-amber-300',
  High: 'bg-orange-100 text-orange-800 border-orange-300',
  Critical: 'bg-red-100 text-red-800 border-red-300',
};

function HazardForm({ config, session }) {
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState(nowTime());
  const [block, setBlock] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState(HAZARD_TYPES[0]);
  const [severity, setSeverity] = useState('Medium');
  const [desc, setDesc] = useState('');
  const [reports, setReports] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => setReports(await loadJSON(K.hz(session.code), []));
  useEffect(() => { load(); }, []);

  const valid = desc.trim() && (block || location.trim());
  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    const r = { id: uid(), reportedByCode: session.code, reportedByName: session.name, date, time, block, location: location.trim(), type, severity, description: desc.trim(), status: 'Open', createdAt: Date.now() };
    const fresh = await loadJSON(K.hz(session.code), reports);
    const next = [r, ...fresh];
    await saveJSON(K.hz(session.code), next);
    setReports(next);
    // notify the manager by email (best effort — never blocks the report being saved)
    const sent = config.webhookUrl ? await postWebhook(config.webhookUrl, {
      type: 'hazard',
      siteName: config.siteName,
      notifyEmail: config.notifyEmail || '',
      severity, hazardType: type,
      block: block || '', location: location.trim(),
      description: desc.trim(),
      reportedBy: session.name, operatorCode: session.code,
      date, time, submittedAt: new Date().toISOString(),
    }) : false;
    setBlock(''); setLocation(''); setDesc(''); setSeverity('Medium'); setType(HAZARD_TYPES[0]); setTime(nowTime());
    setMsg(config.webhookUrl
      ? (sent ? 'Hazard reported — your manager has been emailed.' : 'Hazard saved. Email alert could not be sent — your manager can still see it in the console.')
      : 'Hazard reported. Your manager can see it in the console.');
    setBusy(false);
    setTimeout(() => setMsg(''), 6000);
  };

  return (
    <div className="space-y-6">
      <Banner msg={msg} />
      <div className={cls.card + ' p-4'}>
        <div className="flex items-center gap-2 mb-1 text-stone-700"><AlertTriangle size={18} /><h2 className="text-lg font-semibold text-stone-900">Report a hazard</h2></div>
        <p className="text-sm text-stone-500 mb-4">If it’s an emergency or someone is hurt, deal with that first and call for help.</p>
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={cls.label}>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className={cls.input} /></div>
            <div><label className={cls.label}>Time</label><input type="time" value={time} onChange={e => setTime(e.target.value)} className={cls.input} /></div>
          </div>
          <Combobox label="Block" options={(config.blocks || []).map(b => b.name)} value={block} onChange={setBlock} icon={MapPin} placeholder="Search blocks…" />
          <div><label className={cls.label}>Location detail (optional)</label><input value={location} onChange={e => setLocation(e.target.value)} className={cls.input} placeholder="e.g. row 14, near the headland" /></div>
          <div><label className={cls.label}>Hazard type</label><select value={type} onChange={e => setType(e.target.value)} className={cls.input}>{HAZARD_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
          <div>
            <label className={cls.label}>Severity</label>
            <div className="grid grid-cols-4 gap-2">
              {SEVERITIES.map(s => (
                <button key={s} onClick={() => setSeverity(s)}
                  className={'py-2.5 rounded-lg border text-sm font-medium transition-all ' + (severity === s ? sevStyle[s] + ' ring-2 ring-offset-1 ring-stone-400' : 'bg-white border-stone-300 text-stone-500 hover:bg-stone-50')}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div><label className={cls.label}>What did you see?</label><textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} className={cls.input + ' resize-y'} placeholder="Describe the hazard and any action you’ve taken." /></div>
          <button onClick={submit} disabled={!valid || busy} className={cls.primary + ' w-full py-3.5'}>{busy ? 'Sending…' : 'Submit hazard report'}</button>
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold text-stone-900 mb-3">Your reports</h3>
        {reports.length === 0 ? (
          <p className="text-stone-400 text-sm py-6 text-center border border-dashed border-stone-300 rounded-xl">Nothing reported yet.</p>
        ) : (
          <div className="space-y-2">{reports.map(r => <HazardRow key={r.id} r={r} />)}</div>
        )}
      </div>
    </div>
  );
}

function HazardRow({ r, onResolve }) {
  return (
    <div className="bg-white border border-stone-200 rounded-lg px-3.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={'text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ' + sevStyle[r.severity]}>{r.severity}</span>
            <span className="text-[15px] font-medium text-stone-900">{r.type}</span>
            {r.status === 'Resolved' && <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">Resolved</span>}
          </div>
          <div className="text-sm text-stone-700 mt-1">{r.description}</div>
          <div className="text-xs text-stone-500 mt-1">
            {[r.block, r.location].filter(Boolean).join(' · ')} · {fmtDate(r.date)} {r.time}
            {r.reportedByName ? ` · ${r.reportedByName}` : ''}
          </div>
        </div>
        {onResolve && (
          <button onClick={() => onResolve(r.status === 'Resolved' ? 'Open' : 'Resolved')}
            className={'shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-md border ' + (r.status === 'Resolved' ? 'border-stone-300 text-stone-500 hover:bg-stone-50' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50')}>
            {r.status === 'Resolved' ? 'Reopen' : 'Mark resolved'}
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Manager — timesheet dashboard
   ============================================================ */
function TimesheetDashboard({ config }) {
  const [all, setAll] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = async () => {
    const rows = [];
    for (const op of config.operators) {
      const arr = await loadJSON(K.ts(op.code), []);
      arr.forEach(t => rows.push({ ...t, operatorName: t.operatorName || op.name, operatorCode: t.operatorCode || op.code }));
    }
    rows.sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
    setAll(rows);
  };
  useEffect(() => { load(); }, []);

  const setRange = which => {
    const now = new Date();
    if (which === 'all') { setFrom(''); setTo(''); }
    else if (which === 'week') { setFrom(mondayOf(now)); setTo(todayStr()); }
    else if (which === 'month') { setFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)); setTo(todayStr()); }
  };

  const filtered = useMemo(() => (all || []).filter(t => (!from || t.date >= from) && (!to || t.date <= to)), [all, from, to]);
  const byOp = useMemo(() => {
    const m = {};
    filtered.forEach(t => { const k = t.operatorName; if (!m[k]) m[k] = { hours: 0, count: 0 }; m[k].hours += t.hours || 0; m[k].count += 1; });
    return Object.entries(m).map(([name, v]) => ({ name, hours: Math.round(v.hours * 100) / 100, count: v.count })).sort((a, b) => b.hours - a.hours);
  }, [filtered]);
  const maxH = Math.max(1, ...byOp.map(o => o.hours));

  const exportXlsx = () => {
    const rows = filtered.map(t => ({ Operator: t.operatorName, 'Operator Code': t.operatorCode, Date: t.date, Start: t.start, Finish: t.finish, Hours: t.hours, Block: t.block, Job: t.job, 'Job Code': t.jobCode || '', Note: t.note || '' }));
    const summary = byOp.map(o => ({ Operator: o.name, 'Total Hours': o.hours, Entries: o.count }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Timesheets');
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `timesheets_${todayStr()}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (all === null) return <div className="p-8 text-center text-stone-400">Loading timesheets…</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-stone-700"><Clock size={18} /><h2 className="text-lg font-semibold text-stone-900">Hours dashboard</h2></div>
        <div className="flex gap-2">
          <button onClick={load} className={cls.ghost + ' !py-2 !px-3'}><RefreshCw size={15} /> Refresh</button>
          <button onClick={exportXlsx} disabled={!filtered.length} className={cls.primary + ' !py-2 !px-3'}><Download size={15} /> Export Excel</button>
        </div>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div><label className={cls.label}>From</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} className={cls.input + ' !w-auto'} /></div>
        <div><label className={cls.label}>To</label><input type="date" value={to} onChange={e => setTo(e.target.value)} className={cls.input + ' !w-auto'} /></div>
        <div className="flex gap-1.5 pb-0.5">
          {[['week', 'This week'], ['month', 'This month'], ['all', 'All time']].map(([k, l]) => (
            <button key={k} onClick={() => setRange(k)} className="text-sm px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50">{l}</button>
          ))}
        </div>
      </div>

      <div className={cls.card + ' p-4'}>
        <div className="mb-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Total hours by operator</span>
        </div>
        {byOp.length === 0 ? <p className="text-stone-400 text-sm text-center py-4">No hours in this range.</p> : (
          <div className="space-y-3">
            {byOp.map(o => (
              <div key={o.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-stone-800 font-medium">{o.name}</span>
                  <span className="text-stone-700"><b className="text-stone-900">{o.hours} h</b> <span className="text-stone-400">· {o.count} {o.count === 1 ? 'entry' : 'entries'}</span></span>
                </div>
                <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: (o.hours / maxH * 100) + '%', backgroundColor: '#57534e' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-base font-semibold text-stone-900 mb-2">All entries <span className="text-stone-400 font-normal">· {filtered.length}</span></h3>
        <div className="overflow-x-auto border border-stone-200 rounded-xl bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-stone-500 border-b border-stone-200">
                <th className="px-3 py-2.5 font-semibold">Operator</th>
                <th className="px-3 py-2.5 font-semibold">Date</th>
                <th className="px-3 py-2.5 font-semibold">Time</th>
                <th className="px-3 py-2.5 font-semibold text-right">Hrs</th>
                <th className="px-3 py-2.5 font-semibold">Block</th>
                <th className="px-3 py-2.5 font-semibold">Job</th>
                <th className="px-3 py-2.5 font-semibold">Code</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-stone-400">No entries.</td></tr>
              ) : filtered.map(t => (
                <tr key={t.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-3 py-2.5 text-stone-900 whitespace-nowrap">{t.operatorName}</td>
                  <td className="px-3 py-2.5 text-stone-600 whitespace-nowrap">{fmtDate(t.date)}</td>
                  <td className="px-3 py-2.5 text-stone-600 whitespace-nowrap">{t.start}–{t.finish}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-stone-900">{t.hours}</td>
                  <td className="px-3 py-2.5 text-stone-700 whitespace-nowrap">{t.block}</td>
                  <td className="px-3 py-2.5 text-stone-700 whitespace-nowrap">{t.job}</td>
                  <td className="px-3 py-2.5 text-stone-500 whitespace-nowrap font-mono text-xs">{t.jobCode || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Manager — hazard log
   ============================================================ */
function HazardLog({ config }) {
  const [all, setAll] = useState(null);
  const [showResolved, setShowResolved] = useState(false);

  const load = async () => {
    const rows = [];
    for (const op of config.operators) {
      const arr = await loadJSON(K.hz(op.code), []);
      arr.forEach(h => rows.push({ ...h, reportedByName: h.reportedByName || op.name, reportedByCode: h.reportedByCode || op.code }));
    }
    rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setAll(rows);
  };
  useEffect(() => { load(); }, []);

  const resolve = async (r, status) => {
    const arr = await loadJSON(K.hz(r.reportedByCode), []);
    const idx = arr.findIndex(h => h.id === r.id);
    if (idx >= 0) { arr[idx] = { ...arr[idx], status }; await saveJSON(K.hz(r.reportedByCode), arr); }
    setAll(rows => rows.map(h => (h.id === r.id ? { ...h, status } : h)));
  };

  if (all === null) return <div className="p-8 text-center text-stone-400">Loading hazards…</div>;
  const list = showResolved ? all : all.filter(r => r.status !== 'Resolved');
  const openCount = all.filter(r => r.status !== 'Resolved').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-stone-700">
          <AlertTriangle size={18} /><h2 className="text-lg font-semibold text-stone-900">Hazards</h2>
          <span className="text-sm text-stone-400">· {openCount} open</span>
        </div>
        <div className="flex gap-2 items-center">
          <label className="inline-flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} className="w-4 h-4 accent-stone-800" /> Show resolved
          </label>
          <button onClick={load} className={cls.ghost + ' !py-2 !px-3'}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>
      {list.length === 0 ? (
        <p className="text-stone-400 text-sm py-8 text-center border border-dashed border-stone-300 rounded-xl">No hazards to show.</p>
      ) : (
        <div className="space-y-2">{list.map(r => <HazardRow key={r.id} r={r} onResolve={s => resolve(r, s)} />)}</div>
      )}
    </div>
  );
}

/* ============================================================
   Manager — setup / configuration
   ============================================================ */
function TagEditor({ label, items, onChange }) {
  const [val, setVal] = useState('');
  return (
    <div>
      <label className={cls.label}>{label}</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {items.map((it, i) => (
          <span key={it + i} className="inline-flex items-center gap-1.5 bg-stone-100 border border-stone-300 rounded-full pl-3 pr-1.5 py-1 text-sm text-stone-800">
            {it}
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="rounded-full hover:bg-stone-300/60 p-0.5"><X size={13} /></button>
          </span>
        ))}
        {items.length === 0 && <span className="text-sm text-stone-400">None yet.</span>}
      </div>
      <div className="flex gap-2">
        <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && val.trim()) { onChange([...items, val.trim()]); setVal(''); } }}
          placeholder={`Add ${label.toLowerCase()}…`} className={cls.input} />
        <button onClick={() => { if (val.trim()) { onChange([...items, val.trim()]); setVal(''); } }} className={cls.ghost + ' shrink-0'}><Plus size={16} /></button>
      </div>
    </div>
  );
}

function BlocksEditor({ blocks, onChange }) {
  const [showPaste, setShowPaste] = useState(false);
  const [paste, setPaste] = useState('');
  const setRow = (i, patch) => onChange(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const totalHa = blocks.reduce((s, b) => s + numOf(b.ha), 0);
  const load = replace => {
    const aoa = Papa.parse(paste.replace(/\r/g, ''), { skipEmptyLines: true }).data;
    const parsed = [];
    aoa.forEach((row, idx) => {
      const cells = (row || []).map(c => String(c == null ? '' : c).trim());
      if (!cells.length || !cells[0]) return;
      const joined = cells.join(' ').toLowerCase();
      if (idx === 0 && (joined.includes('block') || joined.includes('name')) && /ha|hectare|area/.test(joined)) return;
      parsed.push({ name: cells[0], ha: numOf(cells[1]) });
    });
    if (!parsed.length) return;
    onChange(replace ? parsed : [...blocks, ...parsed]);
    setPaste(''); setShowPaste(false);
  };
  return (
    <div>
      <label className={cls.label + ' flex items-center justify-between'}><span>Blocks</span><span className="normal-case tracking-normal text-stone-400">{fmtNum(totalHa)} ha total</span></label>
      <p className="text-xs text-stone-400 -mt-1 mb-2">Hectares drive the “percentage done” on the spray page. Block names should match what's on the spray cards.</p>
      <div className="space-y-2 mb-2">
        {blocks.map((b, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={b.name} onChange={e => setRow(i, { name: e.target.value })} placeholder="Block name" className={cls.input} />
            <input value={b.ha} onChange={e => setRow(i, { ha: e.target.value })} inputMode="decimal" placeholder="ha" className={cls.input + ' !w-24 text-right'} />
            <button onClick={() => onChange(blocks.filter((_, j) => j !== i))} className="p-2.5 rounded-lg hover:bg-red-50 text-red-500 shrink-0"><Trash2 size={16} /></button>
          </div>
        ))}
        {blocks.length === 0 && <p className="text-sm text-stone-400">No blocks yet.</p>}
      </div>
      <div className="flex gap-2">
        <button onClick={() => onChange([...blocks, { name: '', ha: '' }])} className={cls.ghost + ' !py-2 !px-3'}><Plus size={16} /> Add block</button>
        <button onClick={() => setShowPaste(v => !v)} className={cls.ghost + ' !py-2 !px-3'}><Upload size={15} /> Load list</button>
      </div>
      {showPaste && (
        <div className="mt-3 p-3 rounded-lg border border-stone-200 bg-stone-50">
          <p className="text-sm text-stone-600 mb-2">Paste two columns: <b>Block name, Hectares</b>.</p>
          <textarea value={paste} onChange={e => setPaste(e.target.value)} rows={4} placeholder={'Hill - A 23\t8.06\nHill - E PG\t5.17'} className={cls.input + ' font-mono text-[12px] resize-y'} />
          <div className="flex gap-2 mt-2 justify-end">
            <button onClick={() => load(false)} className={cls.ghost + ' !py-2 !px-3'}>Add to list</button>
            <button onClick={() => load(true)} className={cls.primary + ' !py-2 !px-3'}>Replace list</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SprayTypesEditor({ types, onChange }) {
  const setType = (i, patch) => onChange(types.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const addLane = i => {
    const t = types[i]; const name = (window.prompt('Sprayer / lane name (e.g. Jason, Weed sprayer)') || '').trim();
    if (!name || t.statuses.includes(name)) return;
    setType(i, { statuses: [...t.statuses, name], laneTanks: { ...t.laneTanks, [name]: '' } });
  };
  const removeLane = (i, lane) => {
    const t = types[i]; const lt = { ...t.laneTanks }; delete lt[lane];
    setType(i, { statuses: t.statuses.filter(s => s !== lane), laneTanks: lt });
  };
  return (
    <div>
      <label className={cls.label}>Spray boards & sprayers</label>
      <p className="text-xs text-stone-400 -mt-1 mb-2">Each board has its own lanes, tank sizes and water rate. Full-tank mixes scale to each tank.</p>
      <div className="space-y-4">
        {types.map((t, i) => {
          const lanes = (t.statuses || []).filter(s => s.toLowerCase() !== 'to spray');
          return (
            <div key={t.key} className="rounded-xl border border-stone-200 p-3">
              <input value={t.label} onChange={e => setType(i, { label: e.target.value })} className={cls.input + ' font-medium mb-3'} />
              <div className="space-y-2">
                {lanes.map(lane => (
                  <div key={lane} className="flex items-center gap-2">
                    <span className="text-sm text-stone-700 flex-1 min-w-0 truncate">{lane}</span>
                    <input value={t.laneTanks[lane] ?? ''} onChange={e => setType(i, { laneTanks: { ...t.laneTanks, [lane]: e.target.value === '' ? '' : numOf(e.target.value) } })}
                      inputMode="numeric" placeholder="litres" className={cls.input + ' !w-28'} />
                    <span className="text-sm text-stone-400">L</span>
                    <button onClick={() => removeLane(i, lane)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 shrink-0"><Trash2 size={15} /></button>
                  </div>
                ))}
                {lanes.length === 0 && <p className="text-sm text-stone-400">No sprayers yet.</p>}
              </div>
              <button onClick={() => addLane(i)} className={cls.ghost + ' !py-2 !px-3 mt-2'}><Plus size={15} /> Add sprayer</button>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-stone-100">
                <span className="text-sm text-stone-700 flex-1">Water rate</span>
                <input value={t.waterRate ?? ''} onChange={e => setType(i, { waterRate: e.target.value === '' ? '' : numOf(e.target.value) })} inputMode="numeric" className={cls.input + ' !w-28'} />
                <span className="text-sm text-stone-400">L/ha</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TasksEditor({ tasks, onChange }) {
  const [showPaste, setShowPaste] = useState(false);
  const [paste, setPaste] = useState('');
  const [order, setOrder] = useState('code'); // 'code' = Code,Task ; 'task' = Task,Code
  const setRow = (i, patch) => onChange(tasks.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const load = replace => {
    const aoa = Papa.parse(paste.replace(/\r/g, ''), { skipEmptyLines: true }).data;
    const parsed = [];
    aoa.forEach((row, idx) => {
      if (!row || !row.length) return;
      const cells = row.map(c => String(c == null ? '' : c).trim());
      const joined = cells.join(' ').toLowerCase();
      if (idx === 0 && joined.includes('code') && /task|job|name/.test(joined)) return; // skip header row
      let code = '', name = '';
      if (cells.length >= 2) {
        if (order === 'code') { code = cells[0]; name = cells.slice(1).join(' '); }
        else { name = cells.slice(0, -1).join(' '); code = cells[cells.length - 1]; }
      } else { name = cells[0]; }
      if (name) parsed.push({ code, name });
    });
    if (!parsed.length) return;
    onChange(replace ? parsed : [...tasks, ...parsed]);
    setPaste(''); setShowPaste(false);
  };
  return (
    <div>
      <label className={cls.label}>Tasks</label>
      <p className="text-xs text-stone-400 -mt-1 mb-2">Operators see the task name only. The code is exported in its own column on the timesheet.</p>
      <div className="space-y-2 mb-2">
        {tasks.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={t.code} onChange={e => setRow(i, { code: e.target.value })} placeholder="Code" className={cls.input + ' !w-24 font-mono uppercase text-center'} />
            <input value={t.name} onChange={e => setRow(i, { name: e.target.value })} placeholder="Task name" className={cls.input} />
            <button onClick={() => onChange(tasks.filter((_, j) => j !== i))} className="p-2.5 rounded-lg hover:bg-red-50 text-red-500 shrink-0"><Trash2 size={16} /></button>
          </div>
        ))}
        {tasks.length === 0 && <p className="text-sm text-stone-400">No tasks yet.</p>}
      </div>
      <div className="flex gap-2">
        <button onClick={() => onChange([...tasks, { code: '', name: '' }])} className={cls.ghost + ' !py-2 !px-3'}><Plus size={16} /> Add task</button>
        <button onClick={() => setShowPaste(v => !v)} className={cls.ghost + ' !py-2 !px-3'}><Upload size={15} /> Load list</button>
      </div>
      {showPaste && (
        <div className="mt-3 p-3 rounded-lg border border-stone-200 bg-stone-50">
          <div className="flex items-center gap-2 mb-2 text-sm text-stone-600">
            Paste two columns:
            <select value={order} onChange={e => setOrder(e.target.value)} className="px-2 py-1 rounded border border-stone-300 bg-white text-sm">
              <option value="code">Code, Task</option>
              <option value="task">Task, Code</option>
            </select>
          </div>
          <textarea value={paste} onChange={e => setPaste(e.target.value)} rows={4}
            placeholder={'PRU\tPruning\nWRP\tWrapping\nSPR\tSpraying'}
            className={cls.input + ' font-mono text-[12px] resize-y'} />
          <div className="flex gap-2 mt-2 justify-end">
            <button onClick={() => load(false)} className={cls.ghost + ' !py-2 !px-3'}>Add to list</button>
            <button onClick={() => load(true)} className={cls.primary + ' !py-2 !px-3'}>Replace list</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Setup({ config, onSave }) {
  const [draft, setDraft] = useState(JSON.parse(JSON.stringify(config)));
  const [msg, setMsg] = useState('');
  const [nc, setNc] = useState(''); const [nn, setNn] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(config);

  const save = async () => { await onSave(draft); setMsg('Settings saved.'); setTimeout(() => setMsg(''), 3000); };
  const addOp = () => {
    if (!nc.trim() || !nn.trim()) return;
    if (draft.operators.some(o => o.code === nc.trim()) || nc.trim() === draft.managerCode) { setMsg('That code is already in use.'); return; }
    setDraft({ ...draft, operators: [...draft.operators, { code: nc.trim(), name: nn.trim() }] }); setNc(''); setNn('');
  };

  return (
    <div className="space-y-6 pb-24">
      <Banner msg={msg} />
      <div className="flex items-center gap-2 text-stone-700"><Settings size={18} /><h2 className="text-lg font-semibold text-stone-900">Setup</h2></div>

      <div className={cls.card + ' p-4 space-y-3.5'}>
        <h3 className="font-semibold text-stone-900">General</h3>
        <div className="grid sm:grid-cols-2 gap-3.5">
          <div><label className={cls.label}>App name</label><input value={draft.siteName} onChange={e => setDraft({ ...draft, siteName: e.target.value })} className={cls.input} /></div>
          <div><label className={cls.label}>Manager code</label><input value={draft.managerCode} onChange={e => setDraft({ ...draft, managerCode: e.target.value.replace(/\D/g, '') })} inputMode="numeric" className={cls.input} /></div>
        </div>
      </div>

      <div className={cls.card + ' p-4'}>
        <div className="flex items-center gap-2 mb-3"><Users size={16} className="text-stone-500" /><h3 className="font-semibold text-stone-900">Operators</h3></div>
        <div className="space-y-2 mb-4">
          {draft.operators.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={o.code} onChange={e => { const ops = [...draft.operators]; ops[i] = { ...o, code: e.target.value.replace(/\D/g, '') }; setDraft({ ...draft, operators: ops }); }}
                inputMode="numeric" className={cls.input + ' !w-24 font-mono text-center'} />
              <input value={o.name} onChange={e => { const ops = [...draft.operators]; ops[i] = { ...o, name: e.target.value }; setDraft({ ...draft, operators: ops }); }} className={cls.input} />
              <button onClick={() => setDraft({ ...draft, operators: draft.operators.filter((_, j) => j !== i) })} className="p-2.5 rounded-lg hover:bg-red-50 text-red-500 shrink-0"><Trash2 size={16} /></button>
            </div>
          ))}
          {draft.operators.length === 0 && <p className="text-sm text-stone-400">No operators yet.</p>}
        </div>
        <div className="flex items-center gap-2 pt-3 border-t border-stone-100">
          <input value={nc} onChange={e => setNc(e.target.value.replace(/\D/g, ''))} placeholder="Code" inputMode="numeric" className={cls.input + ' !w-24 font-mono text-center'} />
          <input value={nn} onChange={e => setNn(e.target.value)} placeholder="Operator name" className={cls.input} onKeyDown={e => e.key === 'Enter' && addOp()} />
          <button onClick={addOp} className={cls.primary + ' shrink-0'}><Plus size={16} /></button>
        </div>
        <p className="text-xs text-stone-400 mt-2">Each operator signs in with their code. Codes must be unique.</p>
      </div>

      <div className={cls.card + ' p-4 space-y-3.5'}>
        <div className="flex items-center gap-2"><AlertTriangle size={16} className="text-stone-500" /><h3 className="font-semibold text-stone-900">Hazard email alerts</h3></div>
        <p className="text-sm text-stone-500 -mt-1">Paste the Web app URL from your Apps Script (or a Zapier/Make webhook). Leave blank to turn email alerts off — hazards still appear in the console either way.</p>
        <div><label className={cls.label}>Webhook URL</label><input value={draft.webhookUrl} onChange={e => setDraft({ ...draft, webhookUrl: e.target.value.trim() })} className={cls.input + ' font-mono text-[13px]'} placeholder="https://script.google.com/macros/s/…/exec" /></div>
        <div><label className={cls.label}>Notify email(s)</label><input value={draft.notifyEmail} onChange={e => setDraft({ ...draft, notifyEmail: e.target.value })} className={cls.input} inputMode="email" placeholder="you@winery.co.nz, hs@winery.co.nz" /></div>
      </div>

      <div className={cls.card + ' p-4 space-y-5'}>
        <BlocksEditor blocks={draft.blocks} onChange={v => setDraft({ ...draft, blocks: v })} />
        <TasksEditor tasks={draft.jobs} onChange={v => setDraft({ ...draft, jobs: v })} />
        <SprayTypesEditor types={draft.sprayTypes || []} onChange={v => setDraft({ ...draft, sprayTypes: v })} />
      </div>

      <div className="fixed bottom-0 inset-x-0 border-t border-stone-300 px-4 py-3" style={{ backgroundColor: CREAM }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <span className="text-sm text-stone-500">{dirty ? 'You have unsaved changes.' : 'All changes saved.'}</span>
          <div className="flex gap-2">
            <button onClick={() => setDraft(JSON.parse(JSON.stringify(config)))} disabled={!dirty} className={cls.ghost + ' disabled:opacity-40'}>Discard</button>
            <button onClick={save} disabled={!dirty} className={cls.primary}>Save changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Operator shell
   ============================================================ */
function OperatorApp({ config, session, onLogout }) {
  const [view, setView] = useState('home');
  const tiles = [
    { id: 'spray', label: 'Spray', sub: 'Today’s spray plan', icon: Droplets },
    { id: 'timesheet', label: 'Timesheet', sub: 'Log & check your hours', icon: Clock },
    { id: 'hazard', label: 'Hazard', sub: 'Report something unsafe', icon: AlertTriangle },
  ];
  const titles = { spray: 'Spray plan', timesheet: 'Timesheet', hazard: 'Hazard report' };

  return (
    <div className="min-h-screen" style={{ backgroundColor: CREAM }}>
      <TopBar siteName={config.siteName} subtitle={view === 'home' ? `Kia ora, ${session.name}` : titles[view]}
        onBack={view === 'home' ? null : () => setView('home')} onLogout={onLogout} />
      <main className="max-w-md mx-auto px-4 py-6">
        {view === 'home' && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500 mb-1">Signed in</p>
            <h1 style={serif} className="text-2xl text-stone-900 mb-6">Kia ora, {session.name}</h1>
            <div className="space-y-3">
              {tiles.map(t => (
                <button key={t.id} onClick={() => setView(t.id)}
                  className="w-full flex items-center gap-4 bg-white border border-stone-200 rounded-xl px-5 py-5 text-left hover:border-stone-400 hover:shadow-sm transition-all">
                  <span className="w-12 h-12 rounded-xl bg-stone-900 text-stone-50 flex items-center justify-center shrink-0"><t.icon size={22} /></span>
                  <span className="min-w-0">
                    <span className="block text-lg font-semibold text-stone-900">{t.label}</span>
                    <span className="block text-sm text-stone-500">{t.sub}</span>
                  </span>
                  <ChevronRight size={20} className="ml-auto text-stone-300 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
        {view === 'spray' && <SprayHub config={config} setConfig={() => {}} manager={false} />}
        {view === 'timesheet' && <TimesheetOperator config={config} session={session} />}
        {view === 'hazard' && <HazardForm config={config} session={session} />}
      </main>
    </div>
  );
}

/* ============================================================
   Manager shell
   ============================================================ */
/* ============================================================
   Chemical shed — product master, stock, usage, low-stock alerts
   ============================================================ */
function ChemicalShed({ config, setConfig }) {
  const products = config.products || [];
  const setProducts = next => setConfig({ ...config, products: next });
  const setRow = (i, patch) => setProducts(products.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const [msg, setMsg] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [paste, setPaste] = useState('');

  const [byType, setByType] = useState(null);
  const types = config.sprayTypes || [];

  const loadSprays = async () => {
    const out = {};
    for (const t of types) out[t.key] = await loadJSON(K.sprays(t.key), []);
    setByType(out);
  };
  useEffect(() => { loadSprays(); }, []);

  const lowNow = products.filter(p => p.minStock !== '' && p.minStock != null && numOf(p.stock) < numOf(p.minStock));

  const loadProducts = replace => {
    const aoa = Papa.parse(paste.replace(/\r/g, ''), { skipEmptyLines: true }).data;
    const parsed = [];
    aoa.forEach((row, idx) => {
      const c = (row || []).map(x => String(x == null ? '' : x).trim());
      if (!c.length || !c[0]) return;
      const joined = c.join(' ').toLowerCase();
      if (idx === 0 && (joined.includes('name') || joined.includes('product')) && /stock|rate|min|unit/.test(joined)) return;
      parsed.push({ name: c[0], unit: c[1] || 'L', concentration: c[2] || '', rate: c[3] || '', stock: c[4] || '', minStock: c[5] || '' });
    });
    if (!parsed.length) return;
    setProducts(replace ? parsed : [...products, ...parsed]);
    setPaste(''); setShowPaste(false);
  };

  const deduct = type => {
    if (type.roundDeducted) { setMsg(`The ${type.label} round was already deducted. Load a new plan (Replace) on that board to start the next round.`); return; }
    const cards = ((byType && byType[type.key]) || []).filter(c => c.done);
    if (!cards.length) { setMsg(`No ${type.label} blocks are marked done yet — nothing to deduct.`); return; }
    if (!window.confirm(`Subtract the ${type.label} round usage from shed stock? Do this once, when that round is finished.`)) return;
    const tcfg = { ...config, roundMix: type.roundMix, waterRate: type.waterRate };
    const usage = roundUsage(cards, tcfg);
    const next = products.map(p => ({ ...p, stock: fmtNum(Math.max(0, numOf(p.stock) - (usage[p.name] || 0))) }));
    const low = next.filter(p => p.minStock !== '' && p.minStock != null && numOf(p.stock) < numOf(p.minStock));
    const nextTypes = types.map(t => (t.key === type.key ? { ...t, roundDeducted: true } : t));
    setConfig({ ...config, products: next, sprayTypes: nextTypes });
    if (low.length && config.webhookUrl) {
      postWebhook(config.webhookUrl, {
        type: 'low_stock',
        notifyEmail: config.notifyEmail || '',
        siteName: config.siteName,
        subject: `[${config.siteName}] Low chemical stock — ${low.length} product${low.length > 1 ? 's' : ''}`,
        body: 'These products are at or below their minimum and need reordering:\n\n' +
          low.map(p => `• ${p.name}: ${fmtNum(numOf(p.stock))} ${p.unit || ''} left (min ${fmtNum(numOf(p.minStock))})`).join('\n'),
        products: low.map(p => ({ name: p.name, stock: numOf(p.stock), min: numOf(p.minStock), unit: p.unit || '' })),
      });
    }
    setMsg(low.length
      ? `${type.label} stock updated. ${low.length} product${low.length > 1 ? 's are' : ' is'} below minimum${config.webhookUrl ? ' — a reorder alert was emailed.' : '.'}`
      : `${type.label} stock updated.`);
  };

  return (
    <div className="space-y-5 pb-6">
      <Banner msg={msg} />
      <div className="flex items-center gap-2 text-stone-700"><Beaker size={18} /><h2 className="text-lg font-semibold text-stone-900">Chemical shed</h2></div>

      {lowNow.length > 0 && (
        <div className="flex items-start gap-2 px-3.5 py-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span><b>{lowNow.length} product{lowNow.length > 1 ? 's' : ''} below minimum:</b> {lowNow.map(p => p.name).join(', ')}. Time to reorder.</span>
        </div>
      )}

      {/* Product master */}
      <div className={cls.card + ' p-4'}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-stone-900">Products & stock</h3>
          <button onClick={() => setShowPaste(v => !v)} className={cls.ghost + ' !py-2 !px-3'}><Upload size={15} /> Load list</button>
        </div>
        {showPaste && (
          <div className="mb-3 p-3 rounded-lg border border-stone-200 bg-stone-50">
            <p className="text-sm text-stone-600 mb-2">Paste columns: <b>Name, Unit, Concentration, Rate/100L, Stock, Min</b>.</p>
            <textarea value={paste} onChange={e => setPaste(e.target.value)} rows={4}
              placeholder={'Roundup UltraMAX\tL\t570 g/L\t1.25\t200\t50\nLI 700\tL\tpenetrant\t0.2\t40\t10'}
              className={cls.input + ' font-mono text-[12px] resize-y'} />
            <div className="flex gap-2 mt-2 justify-end">
              <button onClick={() => loadProducts(false)} className={cls.ghost + ' !py-2 !px-3'}>Add</button>
              <button onClick={() => loadProducts(true)} className={cls.primary + ' !py-2 !px-3'}>Replace</button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto border border-stone-200 rounded-xl">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-stone-500 border-b border-stone-200 bg-stone-50">
                <th className="px-3 py-2.5 font-semibold">Product</th>
                <th className="px-3 py-2.5 font-semibold">Unit</th>
                <th className="px-3 py-2.5 font-semibold">Rate /100L</th>
                <th className="px-3 py-2.5 font-semibold">In stock</th>
                <th className="px-3 py-2.5 font-semibold">Min</th>
                <th className="px-3 py-2.5 font-semibold">Concentration / notes</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-stone-400">No products yet — add a row or paste your list.</td></tr>
              ) : products.map((p, i) => {
                const low = p.minStock !== '' && p.minStock != null && numOf(p.stock) < numOf(p.minStock);
                const gi = 'px-2 py-1.5 rounded-md border border-stone-200 bg-white text-stone-800 text-[13px] focus:outline-none focus:ring-2 focus:ring-stone-400/40';
                return (
                  <tr key={i} className={'border-b border-stone-100 last:border-0 ' + (low ? 'bg-red-50/50' : '')}>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <input value={p.name} onChange={e => setRow(i, { name: e.target.value })} placeholder="Product name" className={gi + ' w-full min-w-[150px] font-medium'} />
                        {low && <span className="text-[10px] font-semibold uppercase tracking-wide text-red-700 bg-red-100 border border-red-200 rounded-full px-1.5 py-0.5 shrink-0">Low</span>}
                      </div>
                    </td>
                    <td className="px-2 py-1.5"><input value={p.unit} onChange={e => setRow(i, { unit: e.target.value })} placeholder="L" className={gi + ' w-16'} /></td>
                    <td className="px-2 py-1.5"><input value={p.rate} onChange={e => setRow(i, { rate: e.target.value })} inputMode="decimal" className={gi + ' w-20 text-right'} /></td>
                    <td className="px-2 py-1.5"><input value={p.stock} onChange={e => setRow(i, { stock: e.target.value })} inputMode="decimal" className={gi + ' w-20 text-right'} /></td>
                    <td className="px-2 py-1.5"><input value={p.minStock} onChange={e => setRow(i, { minStock: e.target.value })} inputMode="decimal" className={gi + ' w-20 text-right'} /></td>
                    <td className="px-2 py-1.5"><input value={p.concentration} onChange={e => setRow(i, { concentration: e.target.value })} placeholder="—" className={gi + ' w-full min-w-[160px]'} /></td>
                    <td className="px-2 py-1.5 text-right"><button onClick={() => setProducts(products.filter((_, j) => j !== i))} className="p-1.5 rounded-md hover:bg-red-50 text-red-500"><Trash2 size={15} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button onClick={() => setProducts([...products, { name: '', unit: 'L', concentration: '', rate: '', stock: '', minStock: '' }])} className={cls.ghost + ' !py-2 !px-3 mt-3'}><Plus size={16} /> Add product</button>
      </div>

      {/* Usage per spray round */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold text-stone-900">Usage by round</h3>
        <button onClick={loadSprays} className={cls.ghost + ' !py-2 !px-3'}><RefreshCw size={15} /> Refresh</button>
      </div>
      {byType === null ? <p className="text-stone-400 text-sm">Loading…</p> : types.map(type => {
        const cards = (byType[type.key] || []).filter(c => c.done);
        const usedNames = (type.roundMix || []).map(m => m.product);
        const tcfg = { ...config, roundMix: type.roundMix, waterRate: type.waterRate };
        const usage = roundUsage(cards, tcfg);
        return (
          <div key={type.key} className={cls.card + ' p-4'}>
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h4 className="font-semibold text-stone-900">{type.label} <span className="text-stone-400 font-normal">· {cards.length} block{cards.length === 1 ? '' : 's'} done</span></h4>
              <button onClick={() => deduct(type)} disabled={type.roundDeducted || cards.length === 0} className={cls.primary + ' !py-2 !px-3'}>
                {type.roundDeducted ? 'Already deducted' : 'Deduct from stock'}
              </button>
            </div>
            {usedNames.length === 0 ? (
              <p className="text-sm text-amber-700">No mix set for this round yet — open the {type.label} board → Round mix.</p>
            ) : (
              <div className="overflow-x-auto border border-stone-200 rounded-xl">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[11px] uppercase tracking-wide text-stone-500 border-b border-stone-200">
                    <th className="px-3 py-2.5 font-semibold">Product</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Used</th>
                    <th className="px-3 py-2.5 font-semibold text-right">In stock</th>
                    <th className="px-3 py-2.5 font-semibold text-right">After round</th>
                  </tr></thead>
                  <tbody>
                    {usedNames.map(name => {
                      const p = products.find(p => p.name === name);
                      const u = usage[name] || 0;
                      const stock = p ? numOf(p.stock) : 0;
                      const after = stock - u;
                      const min = p ? numOf(p.minStock) : 0;
                      const unit = p ? (p.unit || '') : '';
                      return (
                        <tr key={name} className="border-b border-stone-100 last:border-0">
                          <td className="px-3 py-2.5 text-stone-900">{name}{!p && <span className="text-red-600 text-xs"> · not in shed</span>}</td>
                          <td className="px-3 py-2.5 text-right font-medium text-stone-900 tabular-nums">{fmtNum(u)} {unit}</td>
                          <td className="px-3 py-2.5 text-right text-stone-600 tabular-nums">{p ? `${fmtNum(stock)} ${unit}` : '—'}</td>
                          <td className={'px-3 py-2.5 text-right tabular-nums font-medium ' + (p && after < min ? 'text-red-700' : 'text-stone-700')}>{p ? `${fmtNum(after)} ${unit}` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
      <p className="text-xs text-stone-400">Usage = label rate × area × water rate. Deduct each round once it's finished; loading a new plan (Replace) on a board starts its next round.</p>
    </div>
  );
}

/* ============================================================
   Manager dashboard — weather, low stock, hours, round progress
   ============================================================ */
const WMO = code => {
  const c = Number(code);
  if (c === 0) return 'Clear';
  if (c <= 3) return 'Partly cloudy';
  if (c <= 48) return 'Fog';
  if (c <= 57) return 'Drizzle';
  if (c <= 67) return 'Rain';
  if (c <= 77) return 'Snow';
  if (c <= 82) return 'Showers';
  if (c <= 86) return 'Snow showers';
  if (c <= 99) return 'Thunderstorm';
  return '—';
};
function pickNum(obj, re) {
  let found = null;
  const walk = o => {
    if (found != null || o == null || typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (found != null) return;
      if (re.test(k) && (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(numOf(v))))) { found = numOf(v); return; }
      if (v && typeof v === 'object') walk(v);
    }
  };
  walk(obj); return found;
}

function Dashboard({ config, setConfig }) {
  const weather = config.weather || {};
  const [wx, setWx] = useState(null);
  const [hours, setHours] = useState(null);
  const [rounds, setRounds] = useState(null);
  const [editWx, setEditWx] = useState(false);
  const products = config.products || [];
  const low = products.filter(p => p.minStock !== '' && p.minStock != null && numOf(p.stock) < numOf(p.minStock));

  useEffect(() => {
    (async () => {
      const monday = mondayOf(new Date());
      const rh = [];
      for (const op of (config.operators || [])) {
        const ts = await loadJSON(K.ts(op.code), []);
        rh.push({ name: op.name, code: op.code, week: ts.filter(t => t.date >= monday).reduce((s, t) => s + numOf(t.hours), 0) });
      }
      setHours(rh);
      const rd = [];
      for (const t of (config.sprayTypes || [])) {
        const cards = await loadJSON(K.sprays(t.key), []);
        rd.push({ key: t.key, label: t.label, ...areaProgress(cards, config) });
      }
      setRounds(rd);
    })();
  }, [config]);

  const loadWx = async () => {
    setWx(null);
    try {
      if ((weather.stationUrl || '').trim()) {
        const r = await fetch(weather.stationUrl.trim()); const j = await r.json();
        setWx({ ok: true, source: 'Your station', temp: pickNum(j, /temp/i), humidity: pickNum(j, /humid/i), wind: pickNum(j, /wind.?speed|windspeed|wind/i), rain: pickNum(j, /rain|precip/i), desc: '' });
      } else {
        const u = `https://api.open-meteo.com/v1/forecast?latitude=${weather.lat}&longitude=${weather.lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&timezone=auto`;
        const r = await fetch(u); const j = await r.json(); const c = j.current || {};
        setWx({ ok: true, source: 'Open‑Meteo', temp: c.temperature_2m, humidity: c.relative_humidity_2m, wind: c.wind_speed_10m, rain: c.precipitation, desc: WMO(c.weather_code) });
      }
    } catch { setWx({ ok: false }); }
  };
  useEffect(() => { loadWx(); }, [weather.lat, weather.lon, weather.stationUrl]);

  const Metric = ({ icon: Ic, label, value }) => (
    <div className="flex items-center gap-2">
      <Ic size={16} className="text-stone-400 shrink-0" />
      <div><div className="text-stone-900 font-medium leading-none">{value}</div><div className="text-[11px] text-stone-400 mt-0.5">{label}</div></div>
    </div>
  );

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-center gap-2 text-stone-700"><LayoutDashboard size={18} /><h2 className="text-lg font-semibold text-stone-900">Dashboard</h2></div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Weather */}
        <div className={cls.card + ' p-4'}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-stone-700"><Cloud size={17} /><h3 className="font-semibold text-stone-900">Weather</h3>
              <span className="text-[12px] text-stone-400">· {weather.label || 'Vineyard'}</span></div>
            <div className="flex gap-1">
              <button onClick={loadWx} className="p-2 rounded-lg hover:bg-stone-100 text-stone-500"><RefreshCw size={15} /></button>
              <button onClick={() => setEditWx(v => !v)} className="p-2 rounded-lg hover:bg-stone-100 text-stone-500"><Settings size={15} /></button>
            </div>
          </div>
          {wx === null ? <p className="text-sm text-stone-400">Loading conditions…</p>
            : !wx.ok ? <p className="text-sm text-amber-700">Couldn't reach the weather feed right now. It works on the deployed app; if you've set a station URL, check it returns JSON.</p>
              : (
                <div>
                  <div className="flex items-end gap-3 mb-3">
                    <span style={serif} className="text-4xl font-bold text-stone-900 leading-none">{wx.temp != null ? `${fmtNum(wx.temp)}°` : '—'}</span>
                    <span className="text-stone-500 mb-1">{wx.desc || ''}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Metric icon={Droplet} label="Humidity" value={wx.humidity != null ? `${fmtNum(wx.humidity)}%` : '—'} />
                    <Metric icon={Wind} label="Wind" value={wx.wind != null ? `${fmtNum(wx.wind)} km/h` : '—'} />
                    <Metric icon={Droplets} label="Rain" value={wx.rain != null ? `${fmtNum(wx.rain)} mm` : '—'} />
                  </div>
                  <div className="text-[11px] text-stone-400 mt-3">Source: {wx.source}</div>
                </div>
              )}
          {editWx && (
            <div className="mt-3 pt-3 border-t border-stone-200 space-y-2">
              <p className="text-xs text-stone-500">Default uses the vineyard's coordinates. To use your own weather station, paste a URL that returns its JSON readings.</p>
              <div className="flex gap-2">
                <div className="flex-1"><label className="text-[10px] uppercase tracking-wide text-stone-400">Latitude</label><input value={weather.lat ?? ''} onChange={e => setConfig({ ...config, weather: { ...weather, lat: e.target.value } })} className={cls.input + ' !py-2'} /></div>
                <div className="flex-1"><label className="text-[10px] uppercase tracking-wide text-stone-400">Longitude</label><input value={weather.lon ?? ''} onChange={e => setConfig({ ...config, weather: { ...weather, lon: e.target.value } })} className={cls.input + ' !py-2'} /></div>
              </div>
              <div><label className="text-[10px] uppercase tracking-wide text-stone-400">Weather station JSON URL (optional)</label><input value={weather.stationUrl ?? ''} onChange={e => setConfig({ ...config, weather: { ...weather, stationUrl: e.target.value } })} placeholder="https://…" className={cls.input + ' !py-2'} /></div>
            </div>
          )}
        </div>

        {/* Low stock */}
        <div className={cls.card + ' p-4'}>
          <div className="flex items-center gap-2 text-stone-700 mb-3"><Beaker size={17} /><h3 className="font-semibold text-stone-900">Chemical shed</h3></div>
          {low.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700"><Check size={16} /> All products above their minimum.</div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-red-700 font-medium"><AlertTriangle size={16} /> {low.length} product{low.length > 1 ? 's' : ''} to reorder</div>
              {low.map(p => (
                <div key={p.name} className="flex justify-between items-center text-sm px-3 py-2 rounded-lg bg-red-50 border border-red-200">
                  <span className="text-stone-800">{p.name}</span>
                  <span className="text-red-700 tabular-nums">{fmtNum(numOf(p.stock))} {p.unit} <span className="text-stone-400">/ min {fmtNum(numOf(p.minStock))}</span></span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Operator hours */}
        <div className={cls.card + ' p-4'}>
          <div className="flex items-center gap-2 text-stone-700 mb-3"><Clock size={17} /><h3 className="font-semibold text-stone-900">Operator hours <span className="text-stone-400 font-normal text-sm">· this week</span></h3></div>
          {hours === null ? <p className="text-sm text-stone-400">Loading…</p> : hours.length === 0 ? <p className="text-sm text-stone-400">No operators yet.</p> : (() => {
            const max = Math.max(1, ...hours.map(h => h.week));
            return (
              <div className="space-y-2.5">
                {hours.map(h => (
                  <div key={h.code}>
                    <div className="flex justify-between text-sm mb-1"><span className="text-stone-700">{h.name}</span><span className="text-stone-900 font-medium tabular-nums">{fmtNum(h.week)} h</span></div>
                    <div className="h-2 rounded-full bg-stone-100 overflow-hidden"><div className="h-full rounded-full bg-stone-700" style={{ width: (h.week / max * 100) + '%' }} /></div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Spray rounds */}
        <div className={cls.card + ' p-4'}>
          <div className="flex items-center gap-2 text-stone-700 mb-3"><Droplets size={17} /><h3 className="font-semibold text-stone-900">Spray rounds <span className="text-stone-400 font-normal text-sm">· by area</span></h3></div>
          {rounds === null ? <p className="text-sm text-stone-400">Loading…</p> : (
            <div className="space-y-3">
              {rounds.map(r => (
                <div key={r.key}>
                  <div className="flex justify-between text-sm mb-1"><span className="text-stone-700">{r.label}</span><span className="text-stone-500 tabular-nums">{fmtNum(r.done)} / {fmtNum(r.total)} ha · <span className="text-stone-900 font-medium">{r.pct}%</span></span></div>
                  <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: r.pct + '%', backgroundColor: r.pct === 100 ? '#059669' : '#57534e' }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ManagerApp({ config, setConfig, onLogout }) {
  const [tab, setTab] = useState('dashboard');
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'spray', label: 'Spray', icon: Droplets },
    { id: 'timesheets', label: 'Timesheets', icon: Clock },
    { id: 'hazards', label: 'Hazards', icon: AlertTriangle },
    { id: 'shed', label: 'Shed', icon: Beaker },
    { id: 'setup', label: 'Setup', icon: Settings },
  ];
  const saveConfig = async c => { setConfig(c); await saveJSON(K.config, c); };

  return (
    <div className="min-h-screen" style={{ backgroundColor: CREAM }}>
      <TopBar siteName={config.siteName} subtitle="Manager console" onLogout={onLogout} />
      <nav className="sticky top-16 z-10 border-b border-stone-300" style={{ backgroundColor: CREAM }}>
        <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={'inline-flex items-center gap-2 px-3.5 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ' +
                (tab === t.id ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800')}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-6">
        {tab === 'dashboard' && <Dashboard config={config} setConfig={saveConfig} />}
        {tab === 'spray' && <SprayHub config={config} setConfig={saveConfig} manager={true} />}
        {tab === 'timesheets' && <TimesheetDashboard config={config} />}
        {tab === 'hazards' && <HazardLog config={config} />}
        {tab === 'shed' && <ChemicalShed config={config} setConfig={saveConfig} />}
        {tab === 'setup' && <Setup config={config} onSave={saveConfig} />}
      </main>
    </div>
  );
}

/* ============================================================
   Root
   ============================================================ */
function OfflineBanner() {
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (!offline) return null;
  return (
    <div className="fixed bottom-0 inset-x-0 z-[70] bg-stone-900 text-stone-100 text-sm py-2 px-4 flex items-center justify-center gap-2">
      <WifiOff size={15} /> Offline — your changes are saved and will sync when you're back online.
    </div>
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [config, setConfig] = useState(null);
  const [session, setSession] = useState(null);

  useEffect(() => {
    (async () => {
      if (!isConfigured) { setBooting(false); return; }
      await ensureReady();
      let cfg = await loadJSON(K.config, null);
      if (!cfg) { cfg = DEFAULT_CONFIG; await saveJSON(K.config, cfg); }
      cfg = { ...DEFAULT_CONFIG, ...cfg };
      // migrate jobs from plain strings to { name, code } objects
      cfg.jobs = (cfg.jobs || []).map(j => (typeof j === 'string' ? { name: j, code: '' } : { name: j.name || '', code: j.code || '' }));
      // migrate blocks from plain strings to { name, ha } objects
      cfg.blocks = (cfg.blocks || []).map(b => (typeof b === 'string' ? { name: b, ha: 0 } : { ...b, name: b.name || '', ha: Number(b.ha) || 0 }));
      // ensure newer fields exist
      if (!cfg.laneTanks) cfg.laneTanks = { ...DEFAULT_CONFIG.laneTanks };
      if (!Array.isArray(cfg.products)) cfg.products = [];
      if (!Array.isArray(cfg.roundMix)) cfg.roundMix = [];
      if (cfg.waterRate == null) cfg.waterRate = DEFAULT_CONFIG.waterRate;
      if (!Array.isArray(cfg.sprayTypes) || !cfg.sprayTypes.length) cfg.sprayTypes = JSON.parse(JSON.stringify(DEFAULT_CONFIG.sprayTypes));
      if (!cfg.weather) cfg.weather = { ...DEFAULT_CONFIG.weather };
      // version bump: pull the official block + task lists from the file into any older install
      if ((cfg.dataVersion || 0) < DEFAULT_CONFIG.dataVersion) {
        cfg.blocks = JSON.parse(JSON.stringify(DEFAULT_CONFIG.blocks));
        cfg.jobs = JSON.parse(JSON.stringify(DEFAULT_CONFIG.jobs));
        const dcan = DEFAULT_CONFIG.sprayTypes.find(t => t.key === 'canopy');
        cfg.sprayTypes = (cfg.sprayTypes || []).map(t => (t.key === 'canopy' ? { ...t, roundMix: JSON.parse(JSON.stringify(dcan.roundMix)), waterRate: dcan.waterRate, roundDeducted: false } : t));
        const have = new Set((cfg.products || []).map(p => p.name));
        DEFAULT_CONFIG.products.forEach(p => { if (!have.has(p.name)) cfg.products.push({ ...p }); });
        cfg.dataVersion = DEFAULT_CONFIG.dataVersion;
        await saveJSON(K.config, cfg);
        // delete existing spray sheets and load the uploaded job sheet onto the canopy board
        await saveJSON(K.sprays('canopy'), SHEET_CANOPY_CARDS);
        await saveJSON(K.sprays('ground'), []);
        await saveJSON(K.sprays('weed'), []);
      }
      // fresh install: seed the canopy board from the job sheet
      if (await loadJSON(K.sprays('canopy'), null) === null) await saveJSON(K.sprays('canopy'), SHEET_CANOPY_CARDS);
      setConfig(cfg); setBooting(false);
    })();
  }, []);

  const handleCode = code => {
    if (!code) return false;
    if (code === config.managerCode) { setSession({ role: 'manager' }); return true; }
    const op = config.operators.find(o => o.code === code);
    if (op) { setSession({ role: 'operator', code: op.code, name: op.name }); return true; }
    return false;
  };

  if (!isConfigured) return (
    <div className="min-h-screen flex items-center justify-center px-6 text-center" style={{ backgroundColor: CREAM }}>
      <div className="max-w-sm">
        <div className="border-2 border-stone-800 px-4 py-1.5 inline-block mb-5">
          <span style={serif} className="text-xl font-bold tracking-[0.18em] uppercase text-stone-900">Vineyard Ops</span>
        </div>
        <p className="text-stone-700 text-sm">Almost there — paste your Firebase project config into <code className="bg-stone-200 px-1 rounded">src/firebase.js</code>, then rebuild and deploy. See the README for the 5-minute setup.</p>
      </div>
    </div>
  );

  if (booting) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: CREAM }}>
      <RefreshCw className="animate-spin text-stone-400" size={28} />
    </div>
  );

  let screen;
  if (!session) screen = <AuthScreen config={config} onSubmit={handleCode} />;
  else if (session.role === 'manager') screen = <ManagerApp config={config} setConfig={setConfig} onLogout={() => setSession(null)} />;
  else screen = <OperatorApp config={config} session={session} onLogout={() => setSession(null)} />;
  return (<>{screen}<OfflineBanner /></>);
}

