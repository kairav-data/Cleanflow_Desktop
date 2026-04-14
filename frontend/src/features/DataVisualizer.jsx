import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
    BarChart3, Upload, Sparkles, RefreshCw, Download,
    ChevronRight, FileText, X, LayoutDashboard, TableProperties,
    TrendingUp, PieChart as PieIcon, Activity, Zap, CheckCircle2,
    AlertCircle, Database, Hash, Type, Calendar, ToggleLeft,
    Bot, Wand2, RotateCcw, Send, ChevronDown, ChevronUp,
    Maximize2, FileSpreadsheet, ImageDown, ArrowUpRight,
} from 'lucide-react';
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area,
    PieChart, Pie, Cell, ScatterChart, Scatter,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import html2canvas from 'html2canvas';
import { DatasetViewer, WorkspaceTabs } from '../components';

// ── Config ───────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const HF_API_KEY = import.meta.env.VITE_HF_API_KEY || '';

const api = axios.create({ baseURL: API_BASE, timeout: 90_000 });

const SEPARATORS = [
    { label: ',', value: ',' },
    { label: ';', value: ';' },
    { label: '|', value: '|' },
    { label: 'TAB', value: '\t' },
];

// ── Icon / color maps ────────────────────────────────────────────────────────
const KPI_ICONS = {
    rows: Database, columns: TableProperties,
    check: CheckCircle2, stats: TrendingUp,
    segments: PieIcon, time: Calendar, duplicate: RotateCcw,
};
const TYPE_ICON = { numeric: Hash, categorical: Type, datetime: Calendar, boolean: ToggleLeft };
const TYPE_COLOR = {
    numeric: 'text-violet-600 bg-violet-50 border border-violet-100',
    categorical: 'text-emerald-600 bg-emerald-50 border border-emerald-100',
    datetime: 'text-amber-600 bg-amber-50 border border-amber-100',
    boolean: 'text-rose-600 bg-rose-50 border border-rose-100',
};
const CHART_BADGES = {
    bar: { icon: BarChart3, label: 'Bar', color: '#7c3aed' },
    area: { icon: Activity, label: 'Area', color: '#0ea5e9' },
    line: { icon: TrendingUp, label: 'Line', color: '#10b981' },
    pie: { icon: PieIcon, label: 'Pie', color: '#f59e0b' },
    scatter: { icon: Sparkles, label: 'Scatter', color: '#ec4899' },
};

const TONE_STYLES = {
    violet: {
        panel: 'border-violet-200 bg-violet-50/70',
        chip: 'bg-violet-100 text-violet-700',
    },
    emerald: {
        panel: 'border-emerald-200 bg-emerald-50/70',
        chip: 'bg-emerald-100 text-emerald-700',
    },
    amber: {
        panel: 'border-amber-200 bg-amber-50/70',
        chip: 'bg-amber-100 text-amber-700',
    },
    rose: {
        panel: 'border-rose-200 bg-rose-50/70',
        chip: 'bg-rose-100 text-rose-700',
    },
    sky: {
        panel: 'border-sky-200 bg-sky-50/70',
        chip: 'bg-sky-100 text-sky-700',
    },
    indigo: {
        panel: 'border-indigo-200 bg-indigo-50/70',
        chip: 'bg-indigo-100 text-indigo-700',
    },
    slate: {
        panel: 'border-slate-200 bg-slate-50/70',
        chip: 'bg-slate-100 text-slate-700',
    },
};

const buildFallbackDashboardSummary = (analysis) => {
    const columnSummary = analysis?.columnSummary || [];
    const typeCounts = columnSummary.reduce((acc, column) => {
        const key = column.type || 'categorical';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, { numeric: 0, categorical: 0, datetime: 0, boolean: 0 });

    const topNullColumns = [...columnSummary]
        .sort((left, right) => Number(right.nullPct || 0) - Number(left.nullPct || 0))
        .slice(0, 5)
        .map((column) => ({ ...column, score: column.nullPct || 0 }));

    const topUniqueColumns = [...columnSummary]
        .map((column) => ({
            ...column,
            score: analysis?.totalRows ? (((column.unique || 0) / Math.max(analysis.totalRows, 1)) * 100) : 0,
        }))
        .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))
        .slice(0, 5);

    const completenessKpi = (analysis?.kpis || []).find((kpi) => kpi.label === 'Data Completeness');
    const completenessPct = Number.parseFloat((completenessKpi?.value || '0').toString()) || 0;

    return {
        headline: 'AI dataset intelligence',
        summary: `This dataset contains ${analysis?.totalRows?.toLocaleString?.() || analysis?.totalRows || 0} rows across ${analysis?.totalColumns || 0} columns.`,
        qualityBand: completenessPct >= 85 ? 'Strong' : completenessPct >= 65 ? 'Good' : 'Needs review',
        profile: {
            qualityScore: completenessPct,
            readinessScore: Math.min(100, completenessPct + Math.min((analysis?.charts?.length || 0) * 3, 15)),
            readinessLabel: completenessPct >= 85 ? 'High' : completenessPct >= 65 ? 'Medium' : 'Low',
            completenessPct,
            missingPct: Math.max(0, 100 - completenessPct),
            nullCount: 0,
            duplicateRows: 0,
            duplicatePct: 0,
            columnsWithMissing: topNullColumns.filter((column) => Number(column.nullPct || 0) > 0).length,
            chartCount: analysis?.charts?.length || 0,
            aiUsed: Boolean(analysis?.aiUsed),
            promptUsed: Boolean((analysis?.prompt || '').trim()),
            typeCounts,
            sparseColumns: topNullColumns.filter((column) => Number(column.nullPct || 0) >= 20).map((column) => column.name),
            highCardinalityColumns: topUniqueColumns.filter((column) => Number(column.score || 0) >= 50).map((column) => column.name),
        },
        insightCards: [
            {
                title: 'Dataset Readiness',
                value: `${Math.min(100, completenessPct + Math.min((analysis?.charts?.length || 0) * 3, 15)).toFixed(1)}%`,
                description: 'Estimated dashboard readiness based on completeness and chart coverage.',
                tone: 'violet',
            },
            {
                title: 'Schema Mix',
                value: `${typeCounts.categorical || 0}D / ${typeCounts.numeric || 0}M`,
                description: 'Dimensions vs metrics available for slicing and analysis.',
                tone: 'sky',
            },
        ],
        topNullColumns,
        topUniqueColumns,
    };
};

// ── FIXED Custom Tooltip ─────────────────────────────────────────────────────
// resolveColor skips gradient refs (url(#...)) — the root cause of invisible text
const resolveColor = (p) => {
    const candidates = [p.stroke, p.color];
    for (const c of candidates) {
        if (c && typeof c === 'string' && !c.startsWith('url(')) return c;
    }
    // Scatter / area pass fill directly on payload shape; avoid gradient refs
    const shapeFill = p.payload?.fill;
    if (shapeFill && typeof shapeFill === 'string' && !shapeFill.startsWith('url(')) return shapeFill;
    return '#a78bfa'; // safe violet fallback
};

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;

    const formatValue = (val) => {
        if (typeof val === 'number') return val.toLocaleString();
        if (Array.isArray(val)) return `[${val.map(v => typeof v === 'number' ? v.toLocaleString() : v).join(', ')}]`;
        if (typeof val === 'string' && !isNaN(parseFloat(val))) return parseFloat(val).toLocaleString();
        return String(val ?? '—');
    };

    return (
        <div style={{
            background: 'rgba(15,23,42,0.97)',
            border: '1px solid rgba(148,163,184,0.15)',
            borderRadius: 12,
            padding: '10px 14px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
            minWidth: 140,
            pointerEvents: 'none',
            zIndex: 9999,
        }}>
            {label !== undefined && label !== '' && (
                <p style={{
                    color: '#94a3b8',
                    fontSize: 11,
                    fontWeight: 600,
                    marginBottom: 8,
                    paddingBottom: 8,
                    borderBottom: '1px solid rgba(148,163,184,0.12)',
                    letterSpacing: '0.02em',
                }}>
                    {label}
                </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {payload.map((p, i) => {
                    const color = resolveColor(p);
                    return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                <span style={{ color: 'rgba(248,250,252,0.65)', fontSize: 12, fontWeight: 500 }}>
                                    {p.name || p.dataKey || 'Value'}
                                </span>
                            </span>
                            <span style={{ color: '#f8fafc', fontSize: 13, fontWeight: 700 }}>
                                {formatValue(p.value)}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ── Shared chart renderer ─────────────────────────────────────────────────────
function renderChartJSX(chart, index, height = 220, idSuffix = '') {
    const id = `${index}${idSuffix}`;
    const common = { data: chart.data, margin: { top: 8, right: 16, left: 0, bottom: 8 } };

    switch (chart.type) {
        case 'bar':
            return (
                <ResponsiveContainer width="100%" height={height}>
                    <BarChart {...common}>
                        <defs>
                            <linearGradient id={`barG-${id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={chart.gradient[0]} stopOpacity={0.92} />
                                <stop offset="100%" stopColor={chart.gradient[1]} stopOpacity={0.65} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey={chart.xKey} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={52} />
                        {/* stroke={chart.color} ensures resolveColor gets a valid non-gradient color */}
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)', radius: 4 }} />
                        <Bar
                            dataKey={chart.dataKey}
                            fill={`url(#barG-${id})`}
                            stroke={chart.color}
                            strokeWidth={0}
                            radius={[6, 6, 0, 0]}
                            maxBarSize={52}
                        />
                    </BarChart>
                </ResponsiveContainer>
            );

        case 'area':
            return (
                <ResponsiveContainer width="100%" height={height}>
                    <AreaChart {...common}>
                        <defs>
                            <linearGradient id={`areaG-${id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={chart.color} stopOpacity={0.28} />
                                <stop offset="95%" stopColor={chart.color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey={chart.xKey} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={52} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey={chart.dataKey} stroke={chart.color} strokeWidth={2.5} fill={`url(#areaG-${id})`} dot={false} />
                    </AreaChart>
                </ResponsiveContainer>
            );

        case 'line':
            return (
                <ResponsiveContainer width="100%" height={height}>
                    <LineChart {...common}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey={chart.xKey} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={52} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey={chart.dataKey} stroke={chart.color} strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: chart.color, strokeWidth: 0 }} />
                    </LineChart>
                </ResponsiveContainer>
            );

        case 'pie':
            return (
                <ResponsiveContainer width="100%" height={height}>
                    <PieChart>
                        <Pie data={chart.data} cx="50%" cy="45%" innerRadius={height * 0.18} outerRadius={height * 0.34} paddingAngle={3} dataKey="value" strokeWidth={0}>
                            {chart.data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend formatter={(v) => <span style={{ color: '#64748b', fontSize: 12 }}>{v}</span>} wrapperStyle={{ paddingTop: 8 }} />
                    </PieChart>
                </ResponsiveContainer>
            );

        case 'scatter':
            return (
                <ResponsiveContainer width="100%" height={height}>
                    <ScatterChart {...common}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="x" name={chart.xAxisLabel} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                            label={{ value: chart.xAxisLabel, position: 'insideBottom', offset: -4, fontSize: 11, fill: '#94a3b8' }} />
                        <YAxis dataKey="y" name={chart.yAxisLabel} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={52} />
                        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                        <Scatter data={chart.data} fill={chart.color} fillOpacity={0.72} />
                    </ScatterChart>
                </ResponsiveContainer>
            );

        default: return null;
    }
}

// ── Excel download helper ─────────────────────────────────────────────────────
function downloadChartExcel(chart) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(chart.data);
    const safeName = chart.title.replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 31) || 'Chart Data';
    XLSX.utils.book_append_sheet(wb, ws, safeName);
    XLSX.writeFile(wb, `${safeName.replace(/ /g, '_')}.xlsx`);
}

// ── Chart Expand Modal ────────────────────────────────────────────────────────
function ChartModal({ chart, index, onClose }) {
    const chartRef = useRef(null);
    const badge = CHART_BADGES[chart.type] || { icon: BarChart3, label: 'Chart', color: '#7c3aed' };
    const BadgeIcon = badge.icon;

    const handleDownloadPNG = async () => {
        if (!chartRef.current) return;
        const canvas = await html2canvas(chartRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const link = document.createElement('a');
        link.download = `${chart.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    const handleBackdropClick = (e) => { if (e.target === e.currentTarget) onClose(); };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
            style={{ backgroundColor: 'rgba(2,6,23,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={handleBackdropClick}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Top accent */}
                <div className="h-1 w-full shrink-0 rounded-t-3xl" style={{ background: `linear-gradient(90deg, ${chart.gradient[0]}, ${chart.gradient[1]})` }} />

                {/* Header */}
                <div className="flex items-start justify-between gap-4 px-7 py-5 shrink-0 border-b border-slate-100">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                                style={{ color: badge.color, background: badge.color + '14', border: `1px solid ${badge.color}28` }}>
                                <BadgeIcon size={11} /> {badge.label}
                            </span>
                        </div>
                        <h2 className="text-xl font-black text-slate-900 leading-tight">{chart.title}</h2>
                        <p className="text-sm text-slate-400 mt-0.5 font-medium">{chart.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => downloadChartExcel(chart)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-sm font-semibold hover:bg-emerald-100 transition-all">
                            <FileSpreadsheet size={14} /> Excel
                        </button>
                        <button onClick={handleDownloadPNG}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 text-slate-600 border border-slate-200/70 text-sm font-semibold hover:bg-slate-100 transition-all">
                            <ImageDown size={14} /> PNG
                        </button>
                        <button onClick={onClose}
                            className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all border border-slate-200/50">
                            <X size={15} />
                        </button>
                    </div>
                </div>

                {/* Chart */}
                <div ref={chartRef} className="flex-1 min-h-0 overflow-auto px-6 py-6 bg-slate-50/30">
                    {renderChartJSX(chart, index, 400, '-modal')}
                </div>

                {/* Data table */}
                <div className="shrink-0 border-t border-slate-100 max-h-48 overflow-auto">
                    <div className="px-7 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between sticky top-0">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Data · {chart.data.length} rows</p>
                        <button onClick={() => downloadChartExcel(chart)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
                            <FileSpreadsheet size={12} /> Export Excel
                        </button>
                    </div>
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-white border-b border-slate-100">
                            <tr>
                                {Object.keys(chart.data[0] || {}).map(k => (
                                    <th key={k} className="px-5 py-2.5 text-left font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{k}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {chart.data.map((row, i) => (
                                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                    {Object.values(row).map((val, j) => (
                                        <td key={j} className="px-5 py-2 text-slate-600 font-medium whitespace-nowrap">
                                            {typeof val === 'number' ? val.toLocaleString() : val ?? '—'}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ── Chart Card ────────────────────────────────────────────────────────────────
function ChartCard({ chart, index, onExpand }) {
    const badge = CHART_BADGES[chart.type] || { icon: BarChart3, label: 'Chart', color: '#7c3aed' };
    const BadgeIcon = badge.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, type: 'spring', stiffness: 300, damping: 24 }}
            onClick={onExpand}
            className="bg-white rounded-2xl border border-slate-100 hover:border-slate-200 shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col overflow-hidden group cursor-pointer"
        >
            <div className="h-0.5 w-full shrink-0" style={{ background: `linear-gradient(90deg, ${chart.gradient[0]}, ${chart.gradient[1]})` }} />

            <div className="p-5 pb-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ color: badge.color, background: badge.color + '12', border: `1px solid ${badge.color}28` }}>
                            <BadgeIcon size={10} /> {badge.label}
                        </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 truncate leading-snug">{chart.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5 truncate font-medium">{chart.description}</p>
                </div>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-150 bg-slate-50 border border-slate-200">
                    <Maximize2 size={13} className="text-slate-500" />
                </div>
            </div>

            <div className="px-3 pb-4 flex-1 pointer-events-none">
                {renderChartJSX(chart, index, 170, '')}
            </div>

            <div className="px-5 pb-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <Maximize2 size={10} className="text-slate-400" />
                <p className="text-xs text-slate-400 font-medium">Click to expand</p>
            </div>
        </motion.div>
    );
}

// ── Prompt Bar ────────────────────────────────────────────────────────────────
function PromptBar({ currentPrompt, onRegenerate, aiUsed, loading }) {
    const [open, setOpen] = useState(false);
    const [newPrompt, setNewPrompt] = useState(currentPrompt || '');

    const suggestions = [
        'Show top categories by revenue',
        'Correlation between numeric columns',
        'Distribution of all categorical columns',
        'Time series trends',
        'KPI overview with bar and pie charts',
    ];

    return (
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden mb-5 shadow-sm">
            <button onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 transition-colors">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-violet-200">
                        <Bot size={15} className="text-white" />
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-bold text-slate-800">
                            {aiUsed ? '✦ AI-Generated Dashboard' : '⚡ Auto-Generated Dashboard'}
                        </p>
                        {currentPrompt
                            ? <p className="text-xs text-slate-400 truncate max-w-sm mt-0.5">"{currentPrompt}"</p>
                            : <p className="text-xs text-slate-400 mt-0.5">Click to refine with a new prompt</p>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {aiUsed && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-600 border border-violet-200/60">
                            AI
                        </span>
                    )}
                    {open ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
                </div>
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="border-t border-slate-100 overflow-hidden">
                        <div className="p-4 flex gap-3">
                            <textarea
                                value={newPrompt}
                                onChange={e => setNewPrompt(e.target.value)}
                                placeholder='e.g. "Show revenue trends over time and compare sales across regions"'
                                rows={2}
                                className="flex-1 text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent placeholder-slate-300 bg-slate-50/50"
                            />
                            <button
                                onClick={() => { onRegenerate(newPrompt); setOpen(false); }}
                                disabled={loading}
                                className="self-end flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold shadow-md shadow-violet-200 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 transition-all whitespace-nowrap"
                            >
                                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                                {loading ? 'Thinking…' : 'Regenerate'}
                            </button>
                        </div>
                        <div className="px-4 pb-4 flex flex-wrap gap-2">
                            {suggestions.map(s => (
                                <button key={s} onClick={() => setNewPrompt(s)}
                                    className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 hover:bg-violet-100 hover:text-violet-700 transition-colors border border-slate-200/60">
                                    {s}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function InsightCard({ card, index }) {
    const tone = TONE_STYLES[card.tone] || TONE_STYLES.slate;

    return (
        <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, type: 'spring', stiffness: 280, damping: 24 }}
            className={`rounded-2xl border p-5 shadow-sm ${tone.panel}`}
        >
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-slate-800">{card.title}</p>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${tone.chip}`}>{card.value}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{card.description}</p>
        </motion.div>
    );
}

function ProgressMeter({ label, value, tone = 'violet', helper }) {
    const normalized = Math.max(0, Math.min(Number(value || 0), 100));
    const toneMap = {
        violet: 'from-violet-500 to-indigo-500',
        emerald: 'from-emerald-500 to-teal-500',
        amber: 'from-amber-500 to-orange-500',
        rose: 'from-rose-500 to-pink-500',
        sky: 'from-sky-500 to-cyan-500',
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-700">{label}</p>
                <p className="text-sm font-black text-slate-900">{normalized.toFixed(1)}%</p>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full rounded-full bg-gradient-to-r ${toneMap[tone] || toneMap.violet}`} style={{ width: `${normalized}%` }} />
            </div>
            {helper ? <p className="text-xs text-slate-500">{helper}</p> : null}
        </div>
    );
}

function ProfileMiniStat({ label, value, helper, accent = 'slate' }) {
    const tone = TONE_STYLES[accent] || TONE_STYLES.slate;

    return (
        <div className={`rounded-2xl border px-4 py-3 ${tone.panel}`}>
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-2 text-xl font-black text-slate-900">{value}</p>
            {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
        </div>
    );
}

function SchemaMixPanel({ profile }) {
    const typeCounts = profile?.typeCounts || {};
    const rows = [
        { label: 'Metrics', value: typeCounts.numeric || 0, tone: 'violet' },
        { label: 'Dimensions', value: typeCounts.categorical || 0, tone: 'emerald' },
        { label: 'Time', value: typeCounts.datetime || 0, tone: 'amber' },
        { label: 'Flags', value: typeCounts.boolean || 0, tone: 'rose' },
    ];

    return (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Schema Mix</p>
                    <h3 className="mt-1 text-base font-black text-slate-900">Dataset structure at a glance</h3>
                </div>
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {Object.values(typeCounts).reduce((sum, count) => sum + Number(count || 0), 0)} total columns
                </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
                {rows.map((row) => (
                    <ProfileMiniStat key={row.label} label={row.label} value={row.value} accent={row.tone} />
                ))}
            </div>
        </div>
    );
}

function ColumnRiskPanel({ title, rows, accent = 'amber', emptyText, valueLabel, formatter }) {
    const tone = TONE_STYLES[accent] || TONE_STYLES.slate;

    return (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{title}</p>
                    <h3 className="mt-1 text-base font-black text-slate-900">Column watchlist</h3>
                </div>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${tone.chip}`}>{rows?.length || 0} columns</span>
            </div>
            <div className="mt-4 space-y-3">
                {(rows || []).length ? rows.map((row, index) => (
                    <div key={`${row.name}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-800 truncate">{row.name}</p>
                                <p className="mt-1 text-xs text-slate-500">{row.type} column · {row.unique?.toLocaleString?.() ?? row.unique} unique values</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-black text-slate-900">{formatter ? formatter(row.score) : row.score}</p>
                                <p className="text-[11px] text-slate-400">{valueLabel}</p>
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                        {emptyText}
                    </div>
                )}
            </div>
        </div>
    );
}

function ColumnTablePanel({ columns }) {
    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Column Intelligence</p>
                    <h3 className="mt-1 font-black text-slate-800 text-base">Column analysis</h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">{columns?.length} columns detected</p>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50/80 text-xs font-bold uppercase text-slate-400 tracking-widest border-b border-slate-100">
                            <th className="px-6 py-3 text-left">Column</th>
                            <th className="px-4 py-3 text-left">Type</th>
                            <th className="px-4 py-3 text-right">Unique</th>
                            <th className="px-4 py-3 text-right">Nulls %</th>
                            <th className="px-4 py-3 text-right">Min</th>
                            <th className="px-4 py-3 text-right">Max</th>
                            <th className="px-6 py-3 text-right">Mean</th>
                        </tr>
                    </thead>
                    <tbody>
                        {columns?.map((col, i) => {
                            const TypeIcon = TYPE_ICON[col.type] || Hash;
                            const typeStyle = TYPE_COLOR[col.type] || 'text-slate-500 bg-slate-100';
                            return (
                                <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/60 transition-colors">
                                    <td className="px-6 py-3.5 font-bold text-slate-800 text-sm">{col.name}</td>
                                    <td className="px-4 py-3.5">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${typeStyle}`}>
                                            <TypeIcon size={9} /> {col.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-right text-slate-500 font-medium text-sm">{col.unique?.toLocaleString()}</td>
                                    <td className="px-4 py-3.5 text-right">
                                        <span className={`font-bold text-sm ${col.nullPct > 20 ? 'text-red-500' : col.nullPct > 5 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                            {col.nullPct}%
                                        </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-right text-slate-400 font-mono text-xs">{col.min ?? '—'}</td>
                                    <td className="px-4 py-3.5 text-right text-slate-400 font-mono text-xs">{col.max ?? '—'}</td>
                                    <td className="px-6 py-3.5 text-right text-slate-400 font-mono text-xs">{col.mean ?? '—'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function DashboardWorkspace({ analysis, dashboardSummary, filename, activeView, regenerating, onExpandChart, smartKpis, sessionId }) {
    return (
        <div className="space-y-6">
            <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 md:p-7 shadow-xl shadow-slate-900/10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(129,140,248,0.28),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.2),transparent_28%)]" />
                <div className="relative flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-indigo-100">
                            <Sparkles size={12} className="text-indigo-200" /> {dashboardSummary?.headline || 'Dataset intelligence'}
                        </div>
                        <h2 className="mt-4 text-2xl md:text-3xl font-black tracking-tight text-white">
                            {filename.replace(/\.[^.]+$/, '') || 'AI Visualizer dashboard'}
                        </h2>
                        <p className="mt-3 max-w-2xl text-sm md:text-[15px] leading-7 text-slate-300">
                            {dashboardSummary?.summary || 'Dynamic dashboard generated from your uploaded dataset.'}
                        </p>
                        <div className="mt-5 flex flex-wrap gap-2.5">
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white">
                                <LayoutDashboard size={12} className="text-indigo-200" /> {analysis.charts?.length || 0} charts
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white">
                                <Database size={12} className="text-emerald-200" /> {analysis.totalRows?.toLocaleString()} rows
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white">
                                <TableProperties size={12} className="text-sky-200" /> {analysis.totalColumns} columns
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white">
                                <Bot size={12} className="text-violet-200" /> {analysis.aiUsed ? 'AI-guided layout' : 'Automatic layout'}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 min-w-full sm:min-w-[360px] xl:max-w-[420px]">
                        <ProfileMiniStat label="Readiness" value={`${dashboardSummary?.profile?.readinessScore ?? 0}%`} helper={`${dashboardSummary?.profile?.readinessLabel || 'Low'} dashboard readiness`} accent="violet" />
                        <ProfileMiniStat label="Quality Band" value={dashboardSummary?.qualityBand || 'Good'} helper={`${dashboardSummary?.profile?.completenessPct ?? 0}% complete`} accent="emerald" />
                        <ProfileMiniStat label="Sparse Columns" value={dashboardSummary?.profile?.sparseColumns?.length || 0} helper="Columns with meaningful missing-value pressure" accent="amber" />
                        <ProfileMiniStat label="High Cardinality" value={dashboardSummary?.profile?.highCardinalityColumns?.length || 0} helper="Columns with very high uniqueness" accent="sky" />
                    </div>
                </div>
            </div>

            {smartKpis.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4">
                    {smartKpis.map((kpi, i) => {
                        const Icon = KPI_ICONS[kpi.icon] || BarChart3;
                        return (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0.96 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.05, type: 'spring', stiffness: 300 }}
                                className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{kpi.label}</p>
                                        <p className="mt-3 text-2xl font-black tracking-tight text-slate-900 truncate">{kpi.value}</p>
                                    </div>
                                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${kpi.color}15` }}>
                                        <Icon size={18} style={{ color: kpi.color }} />
                                    </div>
                                </div>
                                {kpi.hint ? <p className="mt-3 text-xs leading-5 text-slate-500">{kpi.hint}</p> : null}
                            </motion.div>
                        );
                    })}
                </div>
            )}

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm mt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Executive Insights</p>
                        <h3 className="mt-1 text-base font-black text-slate-900">AI-generated dashboard briefing</h3>
                    </div>
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        {dashboardSummary?.insightCards?.length || 0} live insights
                    </span>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {(dashboardSummary?.insightCards || []).map((card, index) => (
                        <InsightCard key={`${card.title}-${index}`} card={card} index={index} />
                    ))}
                </div>
            </div>

            {activeView === 'charts' ? (
                regenerating ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-5 shadow-xl shadow-violet-200">
                            <Sparkles size={26} className="text-white animate-pulse" />
                        </div>
                        <p className="text-slate-700 font-black text-lg mb-1.5">Rethinking your dashboard...</p>
                        <p className="text-sm text-slate-400 font-medium max-w-xs">
                            AI is selecting the most useful chart layout from your dataset.
                        </p>
                    </div>
                ) : analysis.charts?.length > 0 ? (
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Live Dashboard</p>
                                <h3 className="mt-1 text-base font-black text-slate-900">Interactive chart board</h3>
                            </div>
                            <div className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 font-medium">
                                <Maximize2 size={11} className="text-violet-500" />
                                Click any chart to enlarge, download Excel, or export PNG
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {analysis.charts.map((chart, i) => (
                                <ChartCard key={i} chart={chart} index={i} onExpand={() => onExpandChart(chart, i)} />
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center rounded-3xl border border-slate-200 bg-white shadow-sm">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                            <BarChart3 size={26} className="text-slate-300" />
                        </div>
                        <p className="text-slate-600 font-bold mb-1.5">No charts generated</p>
                        <p className="text-sm text-slate-400 max-w-sm font-medium">
                            Try a different prompt, or use a dataset with numeric and categorical columns.
                        </p>
                    </div>
                )
            ) : activeView === 'dataset' ? (
                <DatasetViewer
                    sessionId={sessionId}
                    tone="violet"
                    title="Visualization Dataset"
                    subtitle="Inspect the uploaded rows alongside the AI dashboard so you can move between charts, column analysis, and raw records."
                />
            ) : (
                <div className="space-y-6">
                    <SchemaMixPanel profile={dashboardSummary?.profile} />
                    <ColumnTablePanel columns={analysis.columnSummary} />
                </div>
            )}
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DataVisualizer({
    initialSessionId = null,
    initialFilename = '',
    initialRowCount = 0,
    initialPrompt = '',
    onClose = null,
}) {
    const [step, setStep] = useState(initialSessionId ? 2 : 1);
    const [delimiter, setDelimiter] = useState(',');
    const [customDelim, setCustomDelim] = useState('');
    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [sessionId, setSessionId] = useState(initialSessionId || null);
    const [filename, setFilename] = useState(initialFilename || '');
    const [rowCount, setRowCount] = useState(initialRowCount || 0);
    const [analysis, setAnalysis] = useState(null);
    const [error, setError] = useState('');
    const [activeView, setActiveView] = useState('charts');
    const [prompt, setPrompt] = useState(initialPrompt || '');
    const [regenerating, setRegenerating] = useState(false);
    const [expandedChart, setExpandedChart] = useState(null);

    const dashRef = useRef(null);
    const fileInputRef = useRef(null);
    const effectiveDelim = customDelim || delimiter;

    // ── Drag & drop ──────────────────────────────────────────────────────────
    const handleDrop = useCallback((e) => {
        e.preventDefault(); setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) setFile(f);
    }, []);
    const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
    const handleDragLeave = () => setDragging(false);

    // ── AI analyze ───────────────────────────────────────────────────────────
    const runAnalyzeAI = async (sid, userPrompt) => {
        try {
            const res = await api.post(`/features/visualizer/analyze-ai/${sid}`, {
                prompt: userPrompt, hf_api_key: HF_API_KEY,
            });
            return res.data;
        } catch (err) {
            if (err.code === 'ECONNABORTED' || err.message?.includes('timeout'))
                throw new Error('Analysis timed out — try a smaller file (< 10 MB) or a simpler prompt.');
            if (!err.response)
                throw new Error('Lost connection to server during analysis. Please try again.');
            throw err;
        }
    };

    // ── Upload + Generate ────────────────────────────────────────────────────
    const analyzeExistingSession = useCallback(async (sid, options = {}) => {
        if (!sid) return;

        const {
            prompt: nextPrompt = '',
            filename: nextFilename = '',
            rowCount: nextRowCount = 0,
        } = options;

        setError('');
        setAnalysis(null);
        setExpandedChart(null);
        setActiveView('charts');
        setStep(2);
        setSessionId(sid);
        setFilename(nextFilename || 'Pipeline Output');
        setRowCount(nextRowCount || 0);
        setPrompt(nextPrompt);
        setAnalyzing(true);

        try {
            const data = await runAnalyzeAI(sid, nextPrompt);
            setAnalysis(data);
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Unable to analyze this dataset.');
        } finally {
            setAnalyzing(false);
        }
    }, []);

    useEffect(() => {
        if (!initialSessionId) return;

        analyzeExistingSession(initialSessionId, {
            prompt: initialPrompt,
            filename: initialFilename,
            rowCount: initialRowCount,
        });
    }, [analyzeExistingSession, initialFilename, initialPrompt, initialRowCount, initialSessionId]);

    const handleUploadAndAnalyze = async () => {
        if (!file) return;
        setError(''); setUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('delimiter', effectiveDelim);

            let uploadRes;
            try {
                uploadRes = await api.post('/features/visualizer/upload', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            } catch (uploadErr) {
                if (uploadErr.code === 'ECONNABORTED' || uploadErr.message?.includes('timeout'))
                    throw new Error('Upload timed out — the server may be starting up. Please wait 30 s and try again.');
                if (!uploadErr.response)
                    throw new Error(`Cannot reach the server at ${API_BASE}. Check VITE_API_BASE_URL.`);
                throw uploadErr;
            }

            const { session_id, filename: fn, rows } = uploadRes.data;
            setSessionId(session_id); setFilename(fn); setRowCount(rows);
            setUploading(false); setAnalyzing(true);

            const data = await runAnalyzeAI(session_id, prompt);
            setAnalysis(data);
            setStep(2);
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Processing failed. Please try again.');
        } finally {
            setUploading(false); setAnalyzing(false);
        }
    };

    // ── Regenerate ───────────────────────────────────────────────────────────
    const handleRegenerate = async (newPrompt) => {
        if (!sessionId) return;
        setError(''); setRegenerating(true); setPrompt(newPrompt);
        try {
            const data = await runAnalyzeAI(sessionId, newPrompt);
            setAnalysis(data);
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Regeneration failed.');
        } finally {
            setRegenerating(false);
        }
    };

    // ── Download dashboard ────────────────────────────────────────────────────
    const handleDownloadDashboard = async () => {
        if (!dashRef.current) return;
        const canvas = await html2canvas(dashRef.current, { scale: 1.5, useCORS: true, backgroundColor: '#f8fafc' });
        const link = document.createElement('a');
        link.download = `${filename.replace(/\.[^.]+$/, '')}_dashboard.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    // ── Reset ─────────────────────────────────────────────────────────────────
    const handleReset = () => {
        setStep(1); setFile(null); setSessionId(null); setFilename('');
        setRowCount(0); setAnalysis(null); setError(''); setActiveView('charts');
        setPrompt(''); setExpandedChart(null);
    };

    const steps = [{ n: 1, label: 'Upload' }, { n: 2, label: 'Visualize' }];
    const isLoading = uploading || analyzing || regenerating;
    const dashboardSummary = useMemo(() => {
        if (!analysis) return null;
        return analysis.dashboardSummary || buildFallbackDashboardSummary(analysis);
    }, [analysis]);

    const smartKpis = useMemo(() => {
        if (!analysis || !analysis.columnSummary) return [];
        const numerics = analysis.columnSummary.filter(c => c.type === 'numeric');
        const keywords = ['sale', 'rev', 'price', 'amount', 'total', 'profit', 'cost', 'qty', 'quantity', 'order', 'margin', 'val'];
        
        const scored = numerics.map(c => {
            let score = 0;
            const name = c.name.toLowerCase();
            if (keywords.some(k => name.includes(k))) score += 50;
            if (name.includes('id')) score -= 100;
            if (name.includes('year') || name.includes('date')) score -= 50;
            return { ...c, score };
        }).sort((a, b) => b.score - a.score);

        const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#0ea5e9'];
        let colorIdx = 0;
        
        const generated = [];
        scored.slice(0, 3).forEach(c => {
            const meanVal = c.mean ?? 0;
            const maxVal = c.max ?? 0;
            generated.push({
                label: `Avg ${c.name}`,
                value: meanVal.toLocaleString(undefined, { maximumFractionDigits: 2 }),
                icon: 'stats',
                color: colors[colorIdx++ % colors.length],
            });
            if (maxVal > 0) {
                generated.push({
                    label: `Max ${c.name}`,
                    value: maxVal.toLocaleString(undefined, { maximumFractionDigits: 2 }),
                    icon: 'stats',
                    color: colors[colorIdx++ % colors.length],
                });
            }
        });
        
        if (generated.length === 0 && analysis.kpis) {
            return analysis.kpis.filter(k => !['Total Rows', 'Columns', 'Data Completeness', 'Duplicate Rows'].includes(k.label)).slice(0, 6);
        }
        
        return generated.slice(0, 6);
    }, [analysis]);

    const showLegacyVisualizer = false;

    return (
        <div className="flex flex-col h-full w-full bg-slate-50/80">

            {/* ── Modal ── */}
            <AnimatePresence>
                {expandedChart && (
                    <ChartModal
                        chart={expandedChart.chart}
                        index={expandedChart.index}
                        onClose={() => setExpandedChart(null)}
                    />
                )}
            </AnimatePresence>

            {/* ── Header ── */}
            <div className="shrink-0 bg-white border-b border-slate-100 px-6 md:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md shadow-violet-200/60">
                        <BarChart3 size={19} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-base font-black text-slate-900 flex items-center gap-2">
                            AI Visualizer
                            {HF_API_KEY && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200/60">
                                    Qwen
                                </span>
                            )}
                        </h1>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                            {HF_API_KEY
                                ? 'Upload a dataset + describe what you want → AI builds your dashboard'
                                : 'Upload a dataset → instant AI-powered dashboard'}
                        </p>
                    </div>
                </div>

                {/* Steps */}
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {steps.map((s, i) => (
                        <div key={s.n} className="flex items-center gap-2">
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${step === s.n ? 'bg-violet-600 text-white shadow-sm shadow-violet-300'
                                    : step > s.n ? 'bg-emerald-100 text-emerald-700 border border-emerald-200/60'
                                        : 'bg-slate-100 text-slate-400'}`}>
                                {step > s.n ? <CheckCircle2 size={11} /> : <span className="w-4 text-center">{s.n}</span>}
                                {s.label}
                            </div>
                            {i < steps.length - 1 && <ChevronRight size={13} className="text-slate-300" />}
                        </div>
                    ))}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="ml-1 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                            title="Close visualizer"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Content ── */}
            <div className="flex-1 overflow-y-auto">
                <AnimatePresence mode="wait">

                    {/* ── STEP 1: UPLOAD ── */}
                    {step === 1 && (
                        <motion.div key="upload" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                            className="max-w-5xl mx-auto px-6 py-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">

                                {/* Left */}
                                <div className="space-y-4">
                                    {/* Drop zone */}
                                    <div
                                        onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`relative rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200
                                            ${dragging ? 'border-violet-400 bg-violet-50/60 scale-[1.01]'
                                                : file ? 'border-emerald-400 bg-emerald-50/30'
                                                    : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/20 bg-white'}`}
                                    >
                                        <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" className="hidden"
                                            onChange={(e) => setFile(e.target.files?.[0] || null)} />
                                        <div className="py-14 px-8 flex flex-col items-center text-center">
                                            {file ? (
                                                <>
                                                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
                                                        <FileText size={26} className="text-emerald-600" />
                                                    </div>
                                                    <p className="text-base font-black text-slate-800 mb-1">{file.name}</p>
                                                    <p className="text-sm text-slate-400 font-medium">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="w-16 h-16 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center mb-5">
                                                        <Upload size={28} className="text-violet-400" />
                                                    </div>
                                                    <p className="text-lg font-black text-slate-800 mb-1.5">Drop your dataset here</p>
                                                    <p className="text-sm text-slate-400 font-medium">CSV, Excel, TSV, TXT supported</p>
                                                </>
                                            )}
                                        </div>
                                        {file && (
                                            <button className="absolute top-3 right-3 p-1.5 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 shadow-sm transition-all"
                                                onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                                                <X size={13} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Separator */}
                                    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                                        <p className="text-xs font-bold uppercase text-slate-400 tracking-widest mb-3">Column Separator</p>
                                        <div className="flex items-center flex-wrap gap-2">
                                            {SEPARATORS.map(s => (
                                                <button key={s.value}
                                                    onClick={() => { setDelimiter(s.value); setCustomDelim(''); }}
                                                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${delimiter === s.value && !customDelim
                                                        ? 'bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-200'
                                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-violet-300 hover:text-violet-600'}`}>
                                                    {s.label}
                                                </button>
                                            ))}
                                            <input type="text" placeholder="Custom…" value={customDelim}
                                                onChange={(e) => setCustomDelim(e.target.value)}
                                                className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono w-24 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent bg-slate-50" />
                                        </div>
                                    </div>
                                </div>

                                {/* Right */}
                                <div className="flex flex-col h-full">
                                    {HF_API_KEY ? (
                                        <div className="bg-gradient-to-br from-violet-50/80 to-indigo-50/60 rounded-2xl border border-violet-100 p-5 shadow-sm flex-grow mb-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
                                                    <Wand2 size={13} className="text-white" />
                                                </div>
                                                <p className="text-sm font-bold text-slate-800">
                                                    Describe your dashboard
                                                    <span className="text-violet-500 font-medium ml-1">(optional)</span>
                                                </p>
                                            </div>
                                            <textarea
                                                value={prompt} onChange={e => setPrompt(e.target.value)}
                                                placeholder='e.g. "Show me revenue by region as a bar chart, top 5 products as pie, and sales trends over time"'
                                                rows={3}
                                                className="w-full text-sm border border-violet-200/70 bg-white rounded-xl px-3.5 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent placeholder-slate-300 shadow-sm"
                                            />
                                            <div className="mt-2.5 flex flex-wrap gap-2">
                                                {['Top categories by count', 'Numeric correlations', 'Revenue over time', 'Category distributions'].map(s => (
                                                    <button key={s} onClick={() => setPrompt(s)}
                                                        className="px-3 py-1 rounded-full text-xs font-medium bg-white text-violet-600 border border-violet-200/70 hover:bg-violet-100 transition-colors shadow-sm">
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                            <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-violet-200/40 font-medium">
                                                Powered by <span className="text-slate-500 font-semibold">Qwen2.5-72B</span> · Leave blank for auto-detect
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 flex-grow mb-4 flex flex-col items-center justify-center text-center">
                                            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                                                <BarChart3 size={22} className="text-slate-400" />
                                            </div>
                                            <h3 className="text-slate-700 font-bold mb-1.5">Standard Dashboard</h3>
                                            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
                                                Automatic dashboard built from statistical heuristics on your data.
                                            </p>
                                        </div>
                                    )}

                                    <div>
                                        {error && (
                                            <div className="mb-4 flex items-start gap-2.5 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 font-medium">
                                                <AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}
                                            </div>
                                        )}
                                        <button
                                            onClick={handleUploadAndAnalyze} disabled={!file || isLoading}
                                            className="w-full py-4 rounded-2xl font-bold text-base bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 transition-all hover:scale-[1.01] active:scale-[0.99]"
                                        >
                                            {uploading ? <><RefreshCw size={17} className="animate-spin" /> Uploading…</> :
                                                analyzing ? <><Sparkles size={17} className="animate-pulse" /> Building dashboard…</> :
                                                    HF_API_KEY ? <><Wand2 size={17} /> {prompt ? 'Generate AI Dashboard' : 'Auto-Generate Dashboard'}</> :
                                                        <><Zap size={17} /> Generate Dashboard</>}
                                        </button>

                                        {analyzing && (
                                            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                                className="mt-3 flex items-center gap-3 p-4 bg-violet-50 border border-violet-100 rounded-xl">
                                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
                                                    <Sparkles size={15} className="text-white animate-pulse" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-violet-800">AI is reading your data…</p>
                                                    <p className="text-xs text-violet-500 font-medium">Understanding columns, types, and the best charts</p>
                                                </div>
                                            </motion.div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ── STEP 2: DASHBOARD ── */}
                    {step === 2 && !analysis && (
                        <motion.div
                            key="viz-loading"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            className="w-full p-6 md:p-8"
                        >
                            <div className="mx-auto max-w-3xl rounded-[28px] border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/60">
                                <div className="flex flex-col items-center text-center">
                                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-200">
                                        {analyzing
                                            ? <RefreshCw size={26} className="animate-spin text-white" />
                                            : <AlertCircle size={26} className="text-white" />}
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-900">
                                        {analyzing ? 'Opening pipeline output' : 'Visualizer could not load'}
                                    </h2>
                                    <p className="mt-2 max-w-xl text-sm font-medium text-slate-400">
                                        {analyzing
                                            ? `Preparing the full AI visualizer for ${filename || 'your pipeline dataset'} so you can explore charts, columns, prompts, and raw rows in one place.`
                                            : (error || 'Try reloading the pipeline output visualization.')}
                                    </p>
                                </div>

                                {!analyzing && (
                                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                                        <button
                                            onClick={() => analyzeExistingSession(sessionId, {
                                                prompt,
                                                filename,
                                                rowCount,
                                            })}
                                            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200 transition-all hover:from-violet-500 hover:to-indigo-500"
                                        >
                                            <RefreshCw size={15} /> Retry Analysis
                                        </button>
                                        <button
                                            onClick={handleReset}
                                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-500 transition-all hover:bg-slate-50"
                                        >
                                            <RotateCcw size={15} /> New Dataset
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && analysis && (
                        <motion.div key="viz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="w-full p-6 md:p-8">

                            {/* Toolbar */}
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <div className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200/80 rounded-xl text-sm shadow-sm">
                                        <FileText size={13} className="text-slate-400" />
                                        <span className="font-semibold text-slate-700">{filename}</span>
                                        <span className="text-slate-300">·</span>
                                        <span className="text-slate-500 font-medium">{analysis.totalRows?.toLocaleString()} rows</span>
                                        <span className="text-slate-300">·</span>
                                        <span className="text-slate-500 font-medium">{analysis.totalColumns} cols</span>
                                    </div>
                                    <WorkspaceTabs
                                        tone="violet"
                                        activeTab={activeView}
                                        onChange={setActiveView}
                                        tabs={[
                                            { id: 'charts', label: 'Charts', icon: LayoutDashboard },
                                            { id: 'columns', label: 'Columns', icon: TableProperties },
                                            { id: 'dataset', label: 'Dataset', icon: Database },
                                        ]}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={handleDownloadDashboard}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200/80 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm">
                                        <Download size={13} /> Export PNG
                                    </button>
                                    <button onClick={handleReset}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200/80 text-slate-500 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm">
                                        <RotateCcw size={13} /> New Dataset
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="mb-4 flex items-start gap-2.5 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 font-medium">
                                    <AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}
                                </div>
                            )}

                            {HF_API_KEY && (
                                <PromptBar
                                    currentPrompt={analysis.prompt || prompt}
                                    onRegenerate={handleRegenerate}
                                    aiUsed={analysis.aiUsed}
                                    loading={regenerating}
                                />
                            )}

                            <div ref={dashRef}>
                                <DashboardWorkspace
                                    analysis={analysis}
                                    dashboardSummary={dashboardSummary}
                                    filename={filename}
                                    activeView={activeView}
                                    regenerating={regenerating}
                                    onExpandChart={(chart, index) => setExpandedChart({ chart, index })}
                                    smartKpis={smartKpis}
                                    sessionId={sessionId}
                                />
                                {showLegacyVisualizer && (<div>
                                {/* KPI tiles */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    {analysis.kpis?.map((kpi, i) => {
                                        const Icon = KPI_ICONS[kpi.icon] || BarChart3;
                                        return (
                                            <motion.div key={i}
                                                initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: i * 0.06, type: 'spring', stiffness: 300 }}
                                                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
                                                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: kpi.color + '15' }}>
                                                    <Icon size={19} style={{ color: kpi.color }} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-2xl font-black text-slate-900 leading-none truncate">{kpi.value}</p>
                                                    <p className="text-xs text-slate-400 font-semibold mt-1 uppercase tracking-wide">{kpi.label}</p>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>

                                {activeView === 'charts' ? (
                                    regenerating ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-center">
                                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-5 shadow-xl shadow-violet-200">
                                                <Sparkles size={26} className="text-white animate-pulse" />
                                            </div>
                                            <p className="text-slate-700 font-black text-lg mb-1.5">Rethinking your dashboard…</p>
                                            <p className="text-sm text-slate-400 font-medium max-w-xs">
                                                AI is selecting the best charts from your dataset
                                            </p>
                                        </div>
                                    ) : analysis.charts?.length > 0 ? (
                                        <>
                                            <div className="mb-4 inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200/70 rounded-xl text-xs text-slate-500 font-medium shadow-sm">
                                                <Maximize2 size={11} className="text-violet-500" />
                                                Click any chart to enlarge · download Excel or PNG
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                                {analysis.charts.map((chart, i) => (
                                                    <ChartCard key={i} chart={chart} index={i}
                                                        onExpand={() => setExpandedChart({ chart, index: i })} />
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20 text-center">
                                            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                                                <BarChart3 size={26} className="text-slate-300" />
                                            </div>
                                            <p className="text-slate-600 font-bold mb-1.5">No charts generated</p>
                                            <p className="text-sm text-slate-400 max-w-sm font-medium">
                                                Try a different prompt, or use a dataset with numeric + categorical columns.
                                            </p>
                                        </div>
                                    )
                                ) : (
                                    /* Column Table */
                                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                            <div>
                                                <h3 className="font-black text-slate-800 text-sm">Column Analysis</h3>
                                                <p className="text-xs text-slate-400 font-medium mt-0.5">{analysis.columnSummary?.length} columns detected</p>
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-slate-50/80 text-xs font-bold uppercase text-slate-400 tracking-widest border-b border-slate-100">
                                                        <th className="px-6 py-3 text-left">Column</th>
                                                        <th className="px-4 py-3 text-left">Type</th>
                                                        <th className="px-4 py-3 text-right">Unique</th>
                                                        <th className="px-4 py-3 text-right">Nulls %</th>
                                                        <th className="px-4 py-3 text-right">Min</th>
                                                        <th className="px-4 py-3 text-right">Max</th>
                                                        <th className="px-6 py-3 text-right">Mean</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {analysis.columnSummary?.map((col, i) => {
                                                        const TypeIcon = TYPE_ICON[col.type] || Hash;
                                                        const typeStyle = TYPE_COLOR[col.type] || 'text-slate-500 bg-slate-100';
                                                        return (
                                                            <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/60 transition-colors">
                                                                <td className="px-6 py-3.5 font-bold text-slate-800 text-sm">{col.name}</td>
                                                                <td className="px-4 py-3.5">
                                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${typeStyle}`}>
                                                                        <TypeIcon size={9} /> {col.type}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3.5 text-right text-slate-500 font-medium text-sm">{col.unique?.toLocaleString()}</td>
                                                                <td className="px-4 py-3.5 text-right">
                                                                    <span className={`font-bold text-sm ${col.nullPct > 20 ? 'text-red-500' : col.nullPct > 5 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                                        {col.nullPct}%
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3.5 text-right text-slate-400 font-mono text-xs">{col.min ?? '—'}</td>
                                                                <td className="px-4 py-3.5 text-right text-slate-400 font-mono text-xs">{col.max ?? '—'}</td>
                                                                <td className="px-6 py-3.5 text-right text-slate-400 font-mono text-xs">{col.mean ?? '—'}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                                </div>)}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
