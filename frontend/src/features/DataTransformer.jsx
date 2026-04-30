import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Upload, Plus, Trash2, ChevronDown, ChevronUp, Play, CheckCircle2,
  XCircle, AlertCircle, Download, Eye, RefreshCw, Database, Link,
  ArrowLeftRight, Columns, Edit3, Rows, Type, AlignLeft, Calculator,
  GripVertical, X, Loader2, FileText, Table, BarChart2, Zap, Settings2,
  Search, ChevronRight, Info, FolderPlus, Check, ArrowDown,
} from 'lucide-react';
import { API_BASE } from '../lib/runtimeConfig';

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_META = {
  structural: { label: 'Structural',     color: '#6366f1', bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-700',  dot: 'bg-indigo-500',  Icon: Columns },
  values:     { label: 'Value Updates',  color: '#059669', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500', Icon: Edit3 },
  rows:       { label: 'Row Operations', color: '#dc2626', bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     dot: 'bg-red-500',     Icon: Rows },
  types:      { label: 'Type & Format',  color: '#d97706', bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-500',   Icon: Type },
  lookup:     { label: 'Lookup / Join',  color: '#7c3aed', bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-700',  dot: 'bg-violet-500',  Icon: Link },
  string:     { label: 'String',         color: '#0891b2', bg: 'bg-cyan-50',    border: 'border-cyan-200',    text: 'text-cyan-700',    dot: 'bg-cyan-500',    Icon: AlignLeft },
  math:       { label: 'Math & Formula', color: '#db2777', bg: 'bg-pink-50',    border: 'border-pink-200',    text: 'text-pink-700',    dot: 'bg-pink-500',    Icon: Calculator },
};

const JOIN_TYPE_DESC = {
  left:  'Keep all main rows, fill nulls for non-matching lookup rows',
  inner: 'Keep only rows that match in both datasets',
  right: 'Keep all lookup rows, fill nulls for non-matching main rows',
  full:  'Keep all rows from both datasets',
  semi:  'Keep main rows that have a match in lookup (no new columns)',
  anti:  'Keep main rows that have NO match in lookup',
};

// ─── Utilities ───────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);

const formatNumber = (n) => (n ?? 0).toLocaleString();

// ─── Sub-components ──────────────────────────────────────────────────────────

function CategoryBadge({ category, small }) {
  const m = CATEGORY_META[category] || {};
  const Icon = m.Icon || Settings2;
  if (small) {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${m.bg} ${m.text} ${m.border} border`}>
        <Icon size={9} /> {m.label}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold ${m.bg} ${m.text} ${m.border} border`}>
      <Icon size={11} /> {m.label}
    </span>
  );
}

function StatusBadge({ status, error }) {
  if (status === 'ok') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <CheckCircle2 size={10} /> Applied
    </span>
  );
  if (status === 'error') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200" title={error}>
      <XCircle size={10} /> Error
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
      <AlertCircle size={10} /> Pending
    </span>
  );
}

// ─── Data Preview Table ───────────────────────────────────────────────────────

function DataPreviewTable({ data, columns, loading, label = 'Dataset Preview', rowCount }) {
  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <Loader2 size={28} className="animate-spin mb-3 text-violet-500" />
      <p className="text-sm font-medium">Running transformations…</p>
    </div>
  );
  if (!data || data.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <Table size={32} className="mb-3 opacity-30" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );

  const cols = columns || (data.length > 0 ? Object.keys(data[0]) : []);

  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{data.length} rows shown</span>
          {rowCount !== undefined && <span className="font-bold text-slate-700">{formatNumber(rowCount)} total</span>}
          <span>{cols.length} cols</span>
        </div>
      </div>
      <div className="overflow-auto max-h-[420px]">
        <table className="w-full text-xs border-collapse min-w-max">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-800">
              {cols.map(c => (
                <th key={c} className="px-3 py-2 text-left font-bold text-slate-200 whitespace-nowrap border-r border-slate-700 last:border-0 max-w-[160px]">
                  <span className="block truncate">{c}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, ri) => (
              <tr key={ri} className={`border-b border-slate-100 ${ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-violet-50/40 transition-colors`}>
                {cols.map(c => (
                  <td key={c} className="px-3 py-1.5 text-slate-700 border-r border-slate-100/80 last:border-0 max-w-[160px] whitespace-nowrap">
                    <span className="block truncate" title={String(row[c] ?? '')}>
                      {row[c] === null || row[c] === undefined
                        ? <span className="text-slate-300 italic">null</span>
                        : String(row[c])}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Step Config Form ─────────────────────────────────────────────────────────

function StepConfigForm({ step, operations, onParamChange, columns, lookupDatasets }) {
  const opMeta = operations.find(o => o.id === step.operation);
  if (!opMeta) return null;

  const renderField = (param) => {
    const val = step.params?.[param.key] ?? '';
    const onChange = (v) => onParamChange(step.id, param.key, v);

    if (param.type === 'column_select') {
      return (
        <select value={val} onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 focus:outline-none">
          <option value="">— select column —</option>
          {columns.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      );
    }

    if (param.type === 'multi_column_select') {
      const selected = Array.isArray(val) ? val : [];
      const toggle = (col) => {
        const next = selected.includes(col) ? selected.filter(x => x !== col) : [...selected, col];
        onChange(next);
      };
      return (
        <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-slate-200 bg-slate-50 min-h-[38px]">
          {columns.map(c => (
            <button key={c} type="button" onClick={() => toggle(c)}
              className={`px-2 py-0.5 rounded-md text-xs font-semibold border transition-all ${selected.includes(c)
                ? 'bg-violet-600 text-white border-violet-700 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:text-violet-700'}`}>
              {c}
            </button>
          ))}
        </div>
      );
    }

    if (param.type === 'column_order') {
      const order = Array.isArray(val) && val.length > 0 ? val : columns;
      const move = (from, to) => {
        const next = [...order];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        onChange(next);
      };
      return (
        <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
          {order.filter(c => columns.includes(c)).concat(columns.filter(c => !order.includes(c))).map((col, i, arr) => (
            <div key={col} className="flex items-center gap-2 bg-white rounded-md border border-slate-100 px-2 py-1.5 shadow-sm">
              <GripVertical size={14} className="text-slate-300 flex-shrink-0" />
              <span className="flex-1 text-xs font-medium text-slate-700 truncate">{col}</span>
              <div className="flex gap-1">
                <button type="button" disabled={i === 0} onClick={() => move(i, i - 1)}
                  className="p-0.5 rounded text-slate-400 hover:text-violet-600 disabled:opacity-30">
                  <ChevronDown size={12} className="rotate-180" />
                </button>
                <button type="button" disabled={i === arr.length - 1} onClick={() => move(i, i + 1)}
                  className="p-0.5 rounded text-slate-400 hover:text-violet-600 disabled:opacity-30">
                  <ChevronDown size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (param.type === 'lookup_select') {
      return (
        <select value={val} onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 focus:outline-none">
          <option value="">— select lookup dataset —</option>
          {lookupDatasets.map(d => (
            <option key={d.lookup_id} value={d.lookup_id}>{d.name} ({formatNumber(d.rows)} rows)</option>
          ))}
        </select>
      );
    }

    if (param.type === 'lookup_column_select') {
      const lookupId = step.params?.lookup_id;
      const lkpCols = lookupDatasets.find(d => d.lookup_id === lookupId)?.columns || [];
      return (
        <select value={val} onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 focus:outline-none">
          <option value="">— select lookup column —</option>
          {lkpCols.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      );
    }

    if (param.type === 'lookup_multi_column_select') {
      const lookupId = step.params?.lookup_id;
      const lkpCols = lookupDatasets.find(d => d.lookup_id === lookupId)?.columns || [];
      const selected = Array.isArray(val) ? val : [];
      const toggle = (col) => {
        const next = selected.includes(col) ? selected.filter(x => x !== col) : [...selected, col];
        onChange(next);
      };
      return (
        <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-slate-200 bg-slate-50 min-h-[38px]">
          {lkpCols.length === 0
            ? <p className="text-xs text-slate-400 italic">Select a lookup dataset first</p>
            : lkpCols.map(c => (
              <button key={c} type="button" onClick={() => toggle(c)}
                className={`px-2 py-0.5 rounded-md text-xs font-semibold border transition-all ${selected.includes(c)
                  ? 'bg-violet-600 text-white border-violet-700'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'}`}>
                {c}
              </button>
            ))}
        </div>
      );
    }

    if (param.type === 'dropdown') {
      return (
        <select value={val} onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 focus:outline-none">
          {(param.options || []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    if (param.type === 'number') {
      return (
        <input type="number" value={val} placeholder={param.placeholder || ''}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 focus:outline-none" />
      );
    }

    if (param.type === 'expression') {
      return (
        <div>
          <input type="text" value={val} placeholder={param.placeholder || 'e.g. col_a * 1.18 - col_b'}
            onChange={e => onChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-800 shadow-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 focus:outline-none" />
          <p className="mt-1.5 text-[11px] text-slate-400 flex items-center gap-1">
            <Info size={10} /> Use column names directly: <code className="text-[10px] bg-slate-100 px-1 rounded">price * qty</code>. Supports +, −, ×, ÷ and parentheses.
          </p>
        </div>
      );
    }

    // default: text
    return (
      <input type="text" value={val} placeholder={param.placeholder || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 focus:outline-none" />
    );
  };

  // Special: join type description row
  const joinType = step.params?.join_type;

  return (
    <div className="space-y-3 pt-1">
      {opMeta.params.map(param => (
        <div key={param.key}>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
            {param.label}
            {param.optional && <span className="ml-1 text-[10px] font-normal text-slate-400 normal-case">(optional)</span>}
          </label>
          {renderField(param)}
          {param.key === 'join_type' && joinType && (
            <p className="mt-1 text-[11px] text-slate-500 flex items-start gap-1">
              <Info size={10} className="mt-0.5 flex-shrink-0" />
              {JOIN_TYPE_DESC[joinType]}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step Card ────────────────────────────────────────────────────────────────

function StepCard({ step, index, operations, columns, lookupDatasets, expanded, onToggle, onDelete, onParamChange, stepLog, onConfirm, isConfirmed, confirming }) {
  const opMeta = operations.find(o => o.id === step.operation);
  const catMeta = CATEGORY_META[opMeta?.category] || {};
  const Icon = catMeta.Icon || Settings2;

  const getSummary = () => {
    const p = step.params || {};
    switch (step.operation) {
      case 'rename_column':      return `${p.column} → ${p.new_name}`;
      case 'drop_column':        return Array.isArray(p.columns) ? p.columns.join(', ') : (p.columns || '');
      case 'add_computed_column':return `${p.new_name} = ${p.expression}`;
      case 'set_value':          return `${p.column} = "${p.value}"`;
      case 'update_conditional': return `IF ${p.condition_column} ${p.condition_op} "${p.condition_value}" THEN "${p.then_value}"`;
      case 'replace_value':      return `"${p.target}" → "${p.replacement}" (${p.match_type})`;
      case 'fill_nulls':         return `${p.column} — ${p.method}`;
      case 'filter_rows':        return `DELETE WHERE ${p.column} ${p.op} "${p.value}"`;
      case 'deduplicate':        return p.keep ? `keep=${p.keep}` : 'all columns';
      case 'sort_rows':          return `${Array.isArray(p.columns) ? p.columns.join(',') : p.columns} ${p.descending === 'descending' ? '↓' : '↑'}`;
      case 'limit_rows':         return `${p.mode} ${p.n} rows`;
      case 'cast_type':          return `${p.column} → ${p.target_type}`;
      case 'change_date_format': return `${p.column}: ${p.input_format} → ${p.output_format}`;
      case 'extract_date_part':  return `${p.part} of ${p.column} → ${p.new_column}`;
      case 'lookup_join':        return `${p.join_type} join on ${p.left_key}`;
      case 'string_trim':        return `${p.column} trim ${p.side}`;
      case 'string_case':        return `${p.column} → ${p.case}`;
      case 'string_substring':   return `${p.column}[${p.offset}:${p.length || 'end'}]`;
      case 'concat_columns':     return `${Array.isArray(p.columns) ? p.columns.join(` "${p.separator}" `) : ''} → ${p.new_column}`;
      case 'split_column':       return `${p.column}.split("${p.delimiter}")[${p.index}] → ${p.new_column}`;
      case 'string_pad':         return `${p.column} pad ${p.side} to width ${p.width}`;
      case 'math_round':         return `round(${p.column}, ${p.decimals})`;
      case 'math_abs':           return `abs(${p.column})`;
      case 'math_expression':    return `${p.new_column} = ${p.expression}`;
      default:                   return '';
    }
  };

  return (
    <div className={`rounded-xl border-2 transition-all ${expanded ? 'border-violet-300 shadow-lg shadow-violet-100' : 'border-slate-200 hover:border-slate-300'} bg-white overflow-hidden`}>
      {/* Card Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${catMeta.bg || 'bg-slate-50'} border ${catMeta.border || 'border-slate-200'}`}>
          <Icon size={14} className={catMeta.text || 'text-slate-500'} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-black text-slate-400 tabular-nums">#{index + 1}</span>
            <span className="text-sm font-bold text-slate-800">{opMeta?.name || step.operation}</span>
            <CategoryBadge category={opMeta?.category} small />
          </div>
          {getSummary() && !expanded && (
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">{getSummary()}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {stepLog && <StatusBadge status={stepLog.status} error={stepLog.error} />}
          {stepLog?.status === 'ok' && stepLog.rows_before !== stepLog.rows_after && (
            <span className="text-[10px] font-bold text-slate-500">
              {formatNumber(stepLog.rows_before)} → {formatNumber(stepLog.rows_after)}
            </span>
          )}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
          >
            <Trash2 size={14} />
          </button>
          {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </div>

      {/* Expanded Config */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 bg-slate-50/50">
          {opMeta?.description && (
            <p className="text-[11px] text-slate-500 mb-3 flex items-start gap-1.5">
              <Info size={11} className="mt-0.5 flex-shrink-0 text-violet-400" />
              {opMeta.description}
            </p>
          )}
          {stepLog?.status === 'error' && (
            <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex items-start gap-2">
              <XCircle size={13} className="flex-shrink-0 mt-0.5" />
              <span><b>Error:</b> {stepLog.error}</span>
            </div>
          )}
          <StepConfigForm
            step={step}
            operations={operations}
            onParamChange={onParamChange}
            columns={columns}
            lookupDatasets={lookupDatasets}
          />

          {/* ── Confirm button ── */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirming}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black transition-all shadow-md
                ${confirming
                  ? 'bg-violet-400 text-white cursor-wait'
                  : isConfirmed
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white hover:shadow-lg'}`}
            >
              {confirming ? (
                <><Loader2 size={15} className="animate-spin" /> Running step…</>
              ) : isConfirmed ? (
                <><CheckCircle2 size={15} /> Step Confirmed — click to re-run</>
              ) : (
                <><Play size={15} /> Confirm &amp; Preview Live</>
              )}
            </button>
            {isConfirmed && stepLog?.status === 'ok' && (
              <p className="mt-2 text-[11px] text-center text-emerald-600 font-semibold flex items-center justify-center gap-1">
                <CheckCircle2 size={11} />
                {stepLog.rows_before !== stepLog.rows_after
                  ? `${formatNumber(stepLog.rows_before)} → ${formatNumber(stepLog.rows_after)} rows · ${stepLog.cols_before !== stepLog.cols_after ? `${stepLog.cols_before} → ${stepLog.cols_after} cols` : ''}`
                  : `${formatNumber(stepLog.rows_after)} rows · no row change`}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Operation Picker Modal ───────────────────────────────────────────────────

function OperationPickerModal({ operations, categories, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const filtered = operations.filter(op => {
    const matchCat = activeCategory === 'all' || op.category === activeCategory;
    const matchSearch = !search || op.name.toLowerCase().includes(search.toLowerCase()) || op.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const grouped = {};
  filtered.forEach(op => {
    if (!grouped[op.category]) grouped[op.category] = [];
    grouped[op.category].push(op);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-600 to-indigo-600">
          <div>
            <h3 className="text-base font-black text-white">Add Transformation Step</h3>
            <p className="text-xs text-violet-200 mt-0.5">Choose an operation to apply to your dataset</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Search + Category tabs */}
        <div className="px-4 py-3 border-b border-slate-100 space-y-2 bg-slate-50">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              type="text"
              placeholder="Search operations…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[{ id: 'all', label: 'All' }, ...categories].map(cat => {
              const m = cat.id !== 'all' ? CATEGORY_META[cat.id] : null;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all border ${activeCategory === cat.id
                    ? 'bg-violet-600 text-white border-violet-700 shadow-sm'
                    : `bg-white text-slate-600 border-slate-200 hover:border-violet-300 ${m ? m.text : ''}`}`}
                >
                  {cat.label || cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Operation List */}
        <div className="overflow-y-auto flex-1 p-3 space-y-3">
          {Object.keys(grouped).length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">No operations match your search.</div>
          )}
          {Object.entries(grouped).map(([catId, ops]) => {
            const catMeta = CATEGORY_META[catId] || {};
            const CatIcon = catMeta.Icon || Settings2;
            return (
              <div key={catId}>
                <div className={`flex items-center gap-2 mb-2 px-2 py-1 rounded-lg ${catMeta.bg || 'bg-slate-50'}`}>
                  <CatIcon size={13} className={catMeta.text || 'text-slate-500'} />
                  <span className={`text-[11px] font-black uppercase tracking-wider ${catMeta.text || 'text-slate-500'}`}>{catMeta.label}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {ops.map(op => (
                    <button
                      key={op.id}
                      onClick={() => onSelect(op)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border-2 border-transparent hover:border-violet-300 bg-white shadow-sm hover:shadow-md transition-all group flex items-start gap-2.5`}
                    >
                      <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${catMeta.bg || 'bg-slate-50'} border ${catMeta.border || 'border-slate-200'}`}>
                        <CatIcon size={13} className={catMeta.text || 'text-slate-500'} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 group-hover:text-violet-700 transition-colors">{op.name}</p>
                        <p className="text-[11px] text-slate-400 leading-relaxed truncate">{op.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Lookup Manager Panel ─────────────────────────────────────────────────────

function LookupManager({ sessionId, lookupDatasets, onLookupAdded, onLookupDeleted, disabled, readOnly = false }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef();
  const [lookupName, setLookupName] = useState('');
  const [delimiter, setDelimiter] = useState(',');

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('lookup_name', lookupName || file.name.replace(/\.[^.]+$/, ''));
      fd.append('delimiter', delimiter);
      const res = await axios.post(`${API_BASE}/features/transformer/lookup/upload/${sessionId}`, fd);
      onLookupAdded(res.data);
      setLookupName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (lookupId) => {
    try {
      await axios.delete(`${API_BASE}/features/transformer/lookup/${sessionId}/${lookupId}`);
      onLookupDeleted(lookupId);
    } catch (e) {
      alert(e.response?.data?.detail || e.message);
    }
  };

  return (
    <div className="rounded-xl border-2 border-violet-200 bg-violet-50/30 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-violet-600">
        <Link size={15} className="text-white" />
        <span className="text-sm font-black text-white">Lookup Datasets</span>
        <span className="ml-auto text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
          {lookupDatasets.length} available
        </span>
      </div>

      {/* Upload form */}
      {!readOnly ? (
        <div className="p-4 border-b border-violet-100 bg-white">
        <p className="text-xs text-slate-500 mb-3 flex items-start gap-1.5">
          <Info size={11} className="mt-0.5 flex-shrink-0 text-violet-400" />
          Upload reference datasets to use in <strong>Lookup Join</strong> steps. You can upload <strong>any number</strong> of them.
        </p>
        <div className="flex gap-2 mb-2">
          <input type="text" value={lookupName} onChange={e => setLookupName(e.target.value)}
            placeholder="Dataset label (optional)"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none" />
          <select value={delimiter} onChange={e => setDelimiter(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-2 text-sm focus:border-violet-400 outline-none bg-white">
            <option value=",">, CSV</option>
            <option value="&#9;">↹ TSV</option>
            <option value="|">| Pipe</option>
          </select>
        </div>
        <label className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-all text-sm font-semibold
          ${disabled ? 'opacity-40 cursor-not-allowed border-slate-200 text-slate-400' : 'border-violet-300 text-violet-700 bg-violet-50 hover:bg-violet-100 hover:border-violet-400'}`}>
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <FolderPlus size={16} />}
          {uploading ? 'Uploading…' : 'Upload CSV / Excel'}
          <input ref={fileInputRef} type="file" accept=".csv,.tsv,.xlsx,.xls" className="hidden"
            disabled={disabled || uploading}
            onChange={e => handleUpload(e.target.files?.[0])} />
        </label>
        {error && <p className="mt-2 text-xs text-red-600 flex items-center gap-1"><XCircle size={11} />{error}</p>}
        </div>
      ) : (
        <div className="border-b border-violet-100 bg-white px-4 py-3">
          <p className="text-xs text-slate-500 flex items-start gap-1.5">
            <Info size={11} className="mt-0.5 flex-shrink-0 text-violet-400" />
            Additional Data Flow inputs become lookup datasets here. Connect one main dataset plus any lookup sources in the pipeline builder.
          </p>
        </div>
      )}

      {/* Registered lookups */}
      {lookupDatasets.length > 0 && (
        <div className="p-3 space-y-2">
          {lookupDatasets.map(d => (
            <div key={d.lookup_id} className="flex items-center gap-2 bg-white rounded-lg border border-violet-100 px-3 py-2 shadow-sm">
              <Database size={13} className="text-violet-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{d.name}</p>
                <p className="text-[10px] text-slate-400">{formatNumber(d.rows)} rows · {d.columns?.length} cols</p>
              </div>
              {!readOnly && !d.locked && (
                <button onClick={() => handleDelete(d.lookup_id)}
                  className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DataTransformer({
  embedded = false,
  embeddedSessionId = null,
  embeddedColumns = [],
  initialSteps = [],
  onSaveConfig = null,
  pipelineContext = null,
}) {
  // Session / data
  const [sessionId, setSessionId] = useState(null);
  const [columns, setColumns] = useState([]);
  const [filename, setFilename] = useState('');
  const [originalData, setOriginalData] = useState([]);
  const [previewData, setPreviewData]   = useState([]);
  const [previewCols, setPreviewCols]   = useState([]);
  const [rowCount, setRowCount]         = useState(0);
  const [previewRowCount, setPreviewRowCount] = useState(0);

  // Operations catalog (from backend)
  const [operations, setOperations]   = useState([]);
  const [categories, setCategories]   = useState([]);

  // Steps
  const [steps, setSteps]             = useState([]);
  const [expandedStep, setExpandedStep] = useState(null);
  const [stepLogs, setStepLogs]       = useState({});
  const [confirmedSteps, setConfirmedSteps] = useState(new Set()); // step IDs confirmed
  const [confirmingStep, setConfirmingStep] = useState(null);      // step ID being confirmed right now

  // Lookup datasets
  const [lookupDatasets, setLookupDatasets] = useState([]);

  // UI state
  const [showOpPicker, setShowOpPicker] = useState(false);
  const [activeView, setActiveView]   = useState('original'); // 'original' | 'preview'
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applyLoading, setApplyLoading]   = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [successMsg, setSuccessMsg]   = useState('');
  const [isDragging, setIsDragging]   = useState(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  const fileInputRef = useRef();
  const isPipelineEmbedded = embedded && Boolean(pipelineContext?.targetNodeId);

  // Load operations catalog on mount
  useEffect(() => {
    axios.get(`${API_BASE}/features/transformer/operations`)
      .then(res => {
        setOperations(res.data.operations || []);
        setCategories(res.data.categories || []);
      })
      .catch(() => {});
  }, []);

  // When embedded into PipelineBuilder — seed from the pipeline node's existing session/steps
  useEffect(() => {
    if (embedded && !isPipelineEmbedded && embeddedSessionId) {
      setSessionId(embeddedSessionId);
      setColumns(embeddedColumns || []);
      if (initialSteps.length > 0 && steps.length === 0) {
        setSteps(initialSteps);
      }
      // Try to load original preview
      axios.get(`${API_BASE}/dataset/${embeddedSessionId}/preview?limit=200`)
        .then(res => {
          const data = res.data?.data || [];
          setOriginalData(data);
          setPreviewCols(embeddedColumns || []);
          setRowCount(data.length);
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, embeddedSessionId, isPipelineEmbedded]);

  useEffect(() => {
    if (!isPipelineEmbedded) return undefined;

    let cancelled = false;
    setWorkspaceLoading(true);
    setGlobalError('');
    setSuccessMsg('');
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    axios.post(`${API_BASE}/features/pipeline/transformer-workspace/${pipelineContext.sessionId}`, {
      pipelineId: pipelineContext.pipelineId,
      pipelineName: pipelineContext.pipelineName,
      targetNodeId: pipelineContext.targetNodeId,
      nodes: pipelineContext.nodes || [],
      edges: pipelineContext.edges || [],
    }, { headers })
      .then((res) => {
        if (cancelled) return;
        const data = res.data || {};
        setSessionId(data.session_id || null);
        setColumns(data.columns || []);
        setFilename(data.primary_input_label || 'Pipeline Input');
        setOriginalData(data.preview_data || []);
        setPreviewData([]);
        setPreviewCols(data.columns || []);
        setRowCount(data.row_count || 0);
        setPreviewRowCount(0);
        setLookupDatasets(data.lookup_datasets || []);
        setStepLogs({});
        setConfirmedSteps(new Set());
        setActiveView('original');
        if (initialSteps.length > 0 && steps.length === 0) {
          setSteps(initialSteps);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setSessionId(null);
        setOriginalData([]);
        setPreviewData([]);
        setLookupDatasets([]);
        setGlobalError(e.response?.data?.detail || e.message);
      })
      .finally(() => {
        if (!cancelled) {
          setWorkspaceLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPipelineEmbedded, pipelineContext?.targetNodeId]);

  // File upload handler
  const handleFileUpload = async (file) => {
    if (!file) return;
    setGlobalError(''); setSuccessMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('delimiter', ',');
      const res = await axios.post(`${API_BASE}/upload`, fd);
      const { session_id, columns: cols, filename: fname } = res.data;
      setSessionId(session_id);
      setColumns(cols || []);
      setFilename(fname || file.name);
      // Load preview of original data
      const prev = await axios.get(`${API_BASE}/dataset/${session_id}/preview?limit=200`);
      const data = prev.data?.data || [];
      setOriginalData(data);
      setPreviewData([]);
      setPreviewCols(cols || []);
      setRowCount(data.length);
      setPreviewRowCount(0);
      setSteps([]);
      setStepLogs({});
      setLookupDatasets([]);
      setActiveView('original');
    } catch (e) {
      setGlobalError(e.response?.data?.detail || e.message);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  // Add step
  const handleAddStep = (opMeta) => {
    const defaultParams = {};
    opMeta.params.forEach(p => {
      if (p.type === 'dropdown' && p.options?.length) defaultParams[p.key] = p.options[0];
      else if (p.type === 'multi_column_select') defaultParams[p.key] = [];
      else if (p.type === 'number') defaultParams[p.key] = p.placeholder || '0';
      else defaultParams[p.key] = '';
    });
    const newStep = { id: uid(), operation: opMeta.id, params: defaultParams };
    setSteps(prev => [...prev, newStep]);
    setExpandedStep(newStep.id);
    setShowOpPicker(false);
  };

  // Param change — also un-confirm the step so user must re-confirm after editing
  const handleParamChange = (stepId, key, value) => {
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, params: { ...s.params, [key]: value } } : s));
    setConfirmedSteps(prev => { const n = new Set(prev); n.delete(stepId); return n; });
  };

  // Delete step
  const handleDeleteStep = (stepId) => {
    setSteps(prev => prev.filter(s => s.id !== stepId));
    if (expandedStep === stepId) setExpandedStep(null);
    setStepLogs(prev => { const n = { ...prev }; delete n[stepId]; return n; });
    setConfirmedSteps(prev => { const n = new Set(prev); n.delete(stepId); return n; });
  };

  // Confirm a single step — run preview up to that step index and show result live
  const handleConfirmStep = async (step, stepIndex) => {
    if (!sessionId || confirmingStep) return;
    setConfirmingStep(step.id);
    setGlobalError('');
    try {
      const payload = {
        steps: steps.slice(0, stepIndex + 1).map(s => ({ operation: s.operation, params: s.params || {} })),
        preview_limit: 200,
      };
      const res = await axios.post(`${API_BASE}/features/transformer/preview/${sessionId}`, payload);
      const { data, metadata } = res.data;
      setPreviewData(data || []);
      setPreviewCols(metadata?.columns || columns);
      setPreviewRowCount(metadata?.total_rows || 0);
      setActiveView('preview');
      // Map logs — only this step's log is at the last position of metadata.steps
      const logs = { ...stepLogs };
      (metadata?.steps || []).forEach((log, i) => {
        if (steps[i]) logs[steps[i].id] = log;
      });
      setStepLogs(logs);
      setConfirmedSteps(prev => new Set([...prev, step.id]));
      setExpandedStep(null); // collapse the step after confirming
    } catch (e) {
      setGlobalError(e.response?.data?.detail || e.message);
    } finally {
      setConfirmingStep(null);
    }
  };

  // Build steps payload
  const buildPayload = () => ({
    steps: steps.map(s => ({ operation: s.operation, params: s.params || {} })),
  });

  // Preview
  const handlePreview = async () => {
    if (!sessionId || steps.length === 0) return;
    setPreviewLoading(true); setGlobalError(''); setSuccessMsg('');
    try {
      const res = await axios.post(`${API_BASE}/features/transformer/preview/${sessionId}`, buildPayload());
      const { data, metadata } = res.data;
      setPreviewData(data || []);
      setPreviewCols(metadata?.columns || columns);
      setPreviewRowCount(metadata?.total_rows || 0);
      setActiveView('preview');
      // Map step logs
      const logs = {};
      (metadata?.steps || []).forEach((log, i) => {
        if (steps[i]) logs[steps[i].id] = log;
      });
      setStepLogs(logs);
      setSuccessMsg(`Preview ready — ${formatNumber(data?.length)} rows displayed.`);
    } catch (e) {
      setGlobalError(e.response?.data?.detail || e.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Apply (execute full dataset)
  const handleApply = async () => {
    if (!sessionId || steps.length === 0) return;
    setApplyLoading(true); setGlobalError(''); setSuccessMsg('');
    try {
      const res = await axios.post(`${API_BASE}/features/transformer/execute/${sessionId}`, buildPayload());
      const { data, metadata } = res.data;
      setPreviewData(data || []);
      setPreviewCols(metadata?.columns || columns);
      setRowCount(metadata?.total_rows || 0);
      setPreviewRowCount(metadata?.total_rows || 0);
      setActiveView('preview');
      setColumns(metadata?.columns || columns);
      const logs = {};
      (metadata?.steps || []).forEach((log, i) => {
        if (steps[i]) logs[steps[i].id] = log;
      });
      setStepLogs(logs);
      setSuccessMsg(`✅ ${steps.length} transformation${steps.length !== 1 ? 's' : ''} applied to ${formatNumber(metadata?.total_rows)} rows.`);
    } catch (e) {
      setGlobalError(e.response?.data?.detail || e.message);
    } finally {
      setApplyLoading(false);
    }
  };

  // Export
  const handleExport = async (format) => {
    if (!sessionId) return;
    const safeName = filename.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]/g, '_') || 'transformed';
    window.open(`${API_BASE}/features/transformer/export/${sessionId}?format=${format}&filename=${safeName}_transformed`, '_blank');
  };

  const hasSteps = steps.length > 0;
  const canRun = sessionId && hasSteps;

  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* ── Header Bar ── */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-white border-b border-slate-200 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-md">
            <ArrowLeftRight size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight">Data Transformation</h1>
            <p className="text-xs text-slate-500">Low-code pipeline: build steps, preview changes, apply to full dataset</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {sessionId && (
            <>
              <span className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-3 py-1.5">
                <FileText size={12} className="text-violet-500" />
                {filename}
                <span className="text-slate-400">·</span>
                <span className="text-violet-600 font-bold">{formatNumber(rowCount)} rows</span>
                <span className="text-slate-400">·</span>
                {columns.length} cols
              </span>

              <button onClick={handlePreview} disabled={!canRun || previewLoading}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold bg-slate-100 text-slate-700 hover:bg-violet-50 hover:text-violet-700 border border-slate-200 hover:border-violet-300 transition-all disabled:opacity-40">
                {previewLoading ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
                Preview
              </button>

              <button onClick={handleApply} disabled={!canRun || applyLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md hover:shadow-lg hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-40">
                {applyLoading ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                Apply All
              </button>

              {embedded && onSaveConfig && (
                <button
                  onClick={() => onSaveConfig({ columns: previewCols.length > 0 ? previewCols : columns, steps })}
                  disabled={steps.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white shadow-md hover:bg-emerald-700 transition-all disabled:opacity-40"
                >
                  <Check size={15} /> Save to Pipeline
                </button>
              )}

              {!embedded && (
              <div className="relative group">
                <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all">
                  <Download size={15} /> Export
                  <ChevronDown size={13} />
                </button>
                <div className="absolute right-0 top-full mt-1 rounded-xl border border-slate-200 bg-white shadow-xl p-1 z-20 hidden group-hover:block min-w-[130px]">
                  {[['csv', 'CSV'], ['xlsx', 'Excel'], ['json', 'JSON']].map(([fmt, label]) => (
                    <button key={fmt} onClick={() => handleExport(fmt)}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-700 rounded-lg transition-all font-medium">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Global messages ── */}
      {(globalError || successMsg) && (
        <div className={`flex-shrink-0 mx-5 mt-3 rounded-xl px-4 py-2.5 text-sm font-medium flex items-center gap-2 border ${globalError ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
          {globalError ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
          {globalError || successMsg}
          <button onClick={() => { setGlobalError(''); setSuccessMsg(''); }} className="ml-auto opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Main Layout ── */}
      <div className="flex flex-1 overflow-hidden gap-0">

        {/* ── Left Panel: Steps Builder ── */}
        <div className="flex flex-col w-[420px] flex-shrink-0 border-r border-slate-200 bg-white overflow-hidden">

          {/* Upload area (if no session) */}
          {workspaceLoading && (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-slate-400">
              <Loader2 size={32} className="mb-4 animate-spin text-violet-500" />
              <p className="text-sm font-bold text-slate-800 mb-1">Preparing pipeline inputs</p>
              <p className="text-xs text-center max-w-[260px]">Loading the main dataset and any connected lookup datasets from the current pipeline graph.</p>
            </div>
          )}

          {!sessionId && !workspaceLoading && !isPipelineEmbedded && (
            <div
              className={`flex flex-col items-center justify-center flex-1 p-8 transition-all cursor-pointer ${isDragging ? 'bg-violet-50 border-violet-400' : 'bg-white'}`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 border-2 border-dashed border-violet-300">
                <Upload size={32} className="text-violet-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Import Your Dataset</h3>
              <p className="text-sm text-slate-500 text-center max-w-[260px] mb-4">
                Drop a CSV or Excel file here, or click to browse. Then build transformation steps.
              </p>
              <div className="flex flex-wrap gap-2 justify-center text-xs text-slate-400">
                {['.csv', '.tsv', '.xlsx', '.xls'].map(ext => (
                  <span key={ext} className="px-2.5 py-1 bg-slate-100 rounded-full font-mono font-bold">{ext}</span>
                ))}
              </div>
              <input ref={fileInputRef} type="file" accept=".csv,.tsv,.xlsx,.xls" className="hidden"
                onChange={e => handleFileUpload(e.target.files?.[0])} />
            </div>
          )}

          {!sessionId && !workspaceLoading && isPipelineEmbedded && (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-slate-400">
              <Database size={32} className="mb-4 opacity-30" />
              <p className="text-sm font-bold text-slate-800 mb-1">Connect a main dataset first</p>
              <p className="text-xs text-center max-w-[260px]">This transformation task opens from the pipeline graph, so it needs a Data Flow input before the workspace can load.</p>
            </div>
          )}

          {/* Steps list (if session) */}
          {sessionId && (
            <>
              {/* Steps header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50 flex-shrink-0">
                <div>
                  <h2 className="text-sm font-black text-slate-800">Transformation Steps</h2>
                  <p className="text-[11px] text-slate-400">{steps.length} step{steps.length !== 1 ? 's' : ''} — executed top to bottom</p>
                </div>
                <button onClick={() => setShowOpPicker(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 shadow-sm transition-all">
                  <Plus size={13} /> Add Step
                </button>
              </div>

              {/* Steps scroll area */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {steps.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <ArrowLeftRight size={36} className="mb-4 opacity-20" />
                    <p className="text-sm font-bold text-slate-800 mb-1">No steps yet</p>
                    <p className="text-xs text-slate-400 text-center mx-4">Click <strong>+ Add Step</strong> to choose a transformation operation.</p>
                  </div>
                )}
                {steps.map((step, i) => (
                  <StepCard
                    key={step.id}
                    step={step}
                    index={i}
                    operations={operations}
                    columns={columns}
                    lookupDatasets={lookupDatasets}
                    expanded={expandedStep === step.id}
                    onToggle={() => setExpandedStep(prev => prev === step.id ? null : step.id)}
                    onDelete={() => handleDeleteStep(step.id)}
                    onParamChange={handleParamChange}
                    stepLog={stepLogs[step.id]}
                    onConfirm={() => handleConfirmStep(step, i)}
                    isConfirmed={confirmedSteps.has(step.id)}
                    confirming={confirmingStep === step.id}
                  />
                ))}
              </div>

              {/* Lookup Manager */}
              <div className="border-t border-slate-100 p-3 flex-shrink-0">
                <LookupManager
                  sessionId={sessionId}
                  lookupDatasets={lookupDatasets}
                  onLookupAdded={d => setLookupDatasets(prev => [...prev, d])}
                  onLookupDeleted={id => setLookupDatasets(prev => prev.filter(d => d.lookup_id !== id))}
                  disabled={!sessionId}
                  readOnly={isPipelineEmbedded}
                />
              </div>
            </>
          )}
        </div>

        {/* ── Right Panel: Data Preview ── */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* View toggle */}
          <div className="flex items-center gap-3 px-5 py-2.5 bg-white border-b border-slate-200 flex-shrink-0">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {[
                { id: 'original', label: 'Original', icon: Table },
                { id: 'preview',  label: 'Transformed',  icon: CheckCircle2 },
              ].map(v => {
                const Icon = v.icon;
                const active = activeView === v.id;
                return (
                  <button key={v.id} onClick={() => setActiveView(v.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${active
                      ? 'bg-white text-violet-700 shadow-sm border border-slate-200'
                      : 'text-slate-500 hover:text-slate-800'}`}>
                    <Icon size={12} /> {v.label}
                    {v.id === 'preview' && previewData.length > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded-full text-[9px] font-black">
                        {formatNumber(previewRowCount)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Step execution summary */}
            {Object.keys(stepLogs).length > 0 && (
              <div className="flex items-center gap-2 ml-2">
                <span className="text-xs text-slate-500">Steps:</span>
                {steps.map((s, i) => {
                  const log = stepLogs[s.id];
                  return log ? (
                    <span key={s.id}
                      title={log.status === 'error' ? log.error : `${formatNumber(log.rows_before)} → ${formatNumber(log.rows_after)} rows`}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black cursor-default
                        ${log.status === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {log.status === 'ok' ? '✓' : '!'}
                    </span>
                  ) : null;
                })}
              </div>
            )}

            {sessionId && !isPipelineEmbedded && (
              <button
                onClick={() => handleFileUpload(null) || fileInputRef.current?.click()}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all border border-slate-200"
              >
                <RefreshCw size={12} /> Change Dataset
              </button>
            )}
          </div>

          {/* Data Table */}
          <div className="flex-1 overflow-auto p-5">
            {activeView === 'original' ? (
              <DataPreviewTable
                data={originalData}
                columns={columns}
                loading={false}
                label={filename || 'Original Dataset'}
                rowCount={rowCount}
              />
            ) : (
              <DataPreviewTable
                data={previewData}
                columns={previewCols}
                loading={previewLoading}
                label="Transformed Dataset"
                rowCount={previewRowCount}
              />
            )}

            {/* Empty state if no data and has session */}
            {sessionId && activeView === 'preview' && !previewLoading && previewData.length === 0 && (
              <div className="mt-5 rounded-xl border-2 border-dashed border-slate-200 bg-white p-10 flex flex-col items-center justify-center text-slate-400">
                <Eye size={32} className="mb-3 opacity-20" />
                <p className="text-sm font-bold text-slate-800 mb-1">No preview yet</p>
                <p className="text-xs text-center">Add at least one transformation step, then click <strong>Preview</strong> to see results here.</p>
                <button onClick={() => setShowOpPicker(true)} disabled={!sessionId}
                  className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-violet-600 text-white hover:bg-violet-700 shadow-sm transition-all disabled:opacity-40">
                  <Plus size={15} /> Add First Step
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Operation Picker Modal */}
      {showOpPicker && (
        <OperationPickerModal
          operations={operations}
          categories={categories}
          onSelect={handleAddStep}
          onClose={() => setShowOpPicker(false)}
        />
      )}
    </div>
  );
}
