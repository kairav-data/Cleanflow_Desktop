import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
    BarChart3, Upload, Sparkles, RefreshCw, Download,
    ChevronRight, FileText, X, LayoutDashboard, TableProperties,
    TrendingUp, PieChart as PieIcon, Activity, Zap, CheckCircle2,
    AlertCircle, Database, Hash, Type, Calendar, ToggleLeft,
    Bot, Wand2, RotateCcw, Send, ChevronDown, ChevronUp,
    Maximize2, FileSpreadsheet, ImageDown, ArrowUpRight,
    Globe, Shuffle,
} from 'lucide-react';
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area,
    PieChart, Pie, Cell, ScatterChart, Scatter,
    FunnelChart, Funnel,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList,
} from 'recharts';
import html2canvas from 'html2canvas';
import { DatabaseConnectionManager, DatasetViewer, WorkspaceTabs } from '../components';
import { API_BASE } from '../lib/runtimeConfig';
import { buildSampleQuery } from '../lib/databaseConnections';

const CHART_COLORS = [
    "#005999", "#0072C6", "#4DA1FF", "#99C9FF", // Deep Tableau Blues
    "#00A3AD", "#00BFB3", "#707070", "#9E9E9E", // Teal/Greys
    "#4E79A7", "#A0CBE8", // Classic Tableau
];

// ── Config ───────────────────────────────────────────────────────────────────
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
    numeric: 'text-blue-600 bg-blue-50 border border-blue-100',
    categorical: 'text-sky-600 bg-sky-50 border border-sky-100',
    datetime: 'text-blue-600 bg-blue-50 border border-blue-100',
    boolean: 'text-rose-600 bg-rose-50 border border-rose-100',
};
const CHART_BADGES = {
    bar: { icon: BarChart3, label: 'Bar', color: '#005999' },
    area: { icon: Activity, label: 'Area', color: '#0072C6' },
    line: { icon: TrendingUp, label: 'Line', color: '#4DA1FF' },
    pie: { icon: PieIcon, label: 'Pie', color: '#00A3AD' },
    scatter: { icon: Sparkles, label: 'Scatter', color: '#8b5cf6' },
    funnel: { icon: Shuffle, label: 'Funnel', color: '#f59e0b' },
    map: { icon: Globe, label: 'Geographic', color: '#00BFB3' },
};

const TONE_STYLES = {
    violet: {
        panel: 'border-blue-200 bg-blue-50/70',
        chip: 'bg-blue-100 text-blue-700',
    },
    emerald: {
        panel: 'border-sky-200 bg-sky-50/70',
        chip: 'bg-sky-100 text-sky-700',
    },
    amber: {
        panel: 'border-blue-200 bg-blue-50/70',
        chip: 'bg-blue-100 text-blue-700',
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
        panel: 'border-blue-200 bg-blue-50/70',
        chip: 'bg-blue-100 text-blue-700',
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
const resolveColor = (p) => {
    const candidates = [p.stroke, p.color];
    for (const c of candidates) {
        if (c && typeof c === 'string' && !c.startsWith('url(')) return c;
    }
    const shapeFill = p.payload?.fill;
    if (shapeFill && typeof shapeFill === 'string' && !shapeFill.startsWith('url(')) return shapeFill;
    return '#a78bfa';
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
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)', radius: 4 }} />
                        <Bar dataKey={chart.dataKey} fill={`url(#barG-${id})`} stroke={chart.color} strokeWidth={0} radius={[6, 6, 0, 0]} maxBarSize={52} />
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
        case 'funnel':
            return (
                <ResponsiveContainer width="100%" height={height}>
                    <FunnelChart {...common}>
                        <Tooltip content={<CustomTooltip />} />
                        <Funnel
                            dataKey="value"
                            data={chart.data}
                            isAnimationActive
                        >
                            <LabelList position="right" fill="#64748b" stroke="none" dataKey="name" fontSize={11} />
                            {chart.data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} fillOpacity={0.85} />
                            ))}
                        </Funnel>
                    </FunnelChart>
                </ResponsiveContainer>
            );
        case 'map': {
            // Interactive heatmap grid — color intensity = value magnitude
            const hmMax = Math.max(...chart.data.map(d => d.value || 0));
            const hmMin = Math.min(...chart.data.map(d => d.value || 0));
            const hmRange = hmMax - hmMin || 1;
            // Blue-teal heatmap palette (Tableau-style)
            const getHeatColor = (val) => {
                const t = (val - hmMin) / hmRange; // 0 = cool, 1 = hot
                // Interpolate from light-blue (#c9e8ff) → deep-blue (#005999)
                const r = Math.round(201 - t * 201);
                const g = Math.round(232 - t * 165);
                const b = Math.round(255 - t * 102);
                return `rgb(${r},${g},${b})`;
            };
            const getTextColor = (val) => {
                const t = (val - hmMin) / hmRange;
                return t > 0.55 ? '#ffffff' : '#1e3a5f';
            };
            return (
                <HeatmapGrid data={chart.data} hmMax={hmMax} getHeatColor={getHeatColor} getTextColor={getTextColor} height={height} />
            );
        }
        default: return null;
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function downloadChartExcel(chart) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(chart.data);
    const safeName = chart.title.replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 31) || 'Chart Data';
    XLSX.utils.book_append_sheet(wb, ws, safeName);
    XLSX.writeFile(wb, `${safeName.replace(/ /g, '_')}.xlsx`);
}

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

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
            style={{ backgroundColor: 'rgba(2,6,23,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            >
                <div className="h-1 w-full shrink-0" style={{ background: `linear-gradient(90deg, ${chart.gradient[0]}, ${chart.gradient[1]})` }} />
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
                        <button onClick={() => downloadChartExcel(chart)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-50 text-sky-700 border border-sky-200/70 text-sm font-semibold hover:bg-sky-100 transition-all"><FileSpreadsheet size={14} /> Excel</button>
                        <button onClick={handleDownloadPNG} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 text-slate-600 border border-slate-200/70 text-sm font-semibold hover:bg-slate-100 transition-all"><ImageDown size={14} /> PNG</button>
                        <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all border border-slate-200/50"><X size={15} /></button>
                    </div>
                </div>
                <div ref={chartRef} className="flex-1 min-h-0 overflow-auto px-6 py-6 bg-slate-50/30">
                    {renderChartJSX(chart, index, 400, '-modal')}
                </div>
                <div className="shrink-0 border-t border-slate-100 max-h-48 overflow-auto">
                    <div className="px-7 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between sticky top-0">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Data · {chart.data.length} rows</p>
                    </div>
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-white border-b border-slate-100">
                            <tr>
                                {Object.keys(chart.data[0] || {}).map(k => <th key={k} className="px-5 py-2.5 text-left font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{k}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {chart.data.map((row, i) => (
                                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                    {Object.values(row).map((val, j) => <td key={j} className="px-5 py-2 text-slate-600 font-medium whitespace-nowrap">{typeof val === 'number' ? val.toLocaleString() : val ?? '—'}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ── Geo row sub-component (interactive hover) ─────────────────────────────
function GeoRow({ item, pct, barColor, rank }) {
    const [hovered, setHovered] = React.useState(false);
    return (
        <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: rank * 0.04, duration: 0.35 }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="group flex items-center gap-3 px-2 py-1.5 rounded-xl transition-all duration-150 cursor-default"
            style={{ background: hovered ? `${barColor}0d` : 'transparent' }}
        >
            <span className="w-5 text-[10px] font-black text-slate-300 shrink-0 text-right">{rank}</span>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 truncate">
                        <Globe size={9} style={{ color: barColor }} /> {item.location}
                    </span>
                    <span className="text-[11px] font-black ml-2 shrink-0" style={{ color: hovered ? barColor : '#334155' }}>
                        {(item.value || 0).toLocaleString()}
                    </span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: rank * 0.04 + 0.15, duration: 0.55, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{
                            background: hovered
                                ? `linear-gradient(90deg, ${barColor}cc, ${barColor})`
                                : `linear-gradient(90deg, ${barColor}88, ${barColor}bb)`,
                            boxShadow: hovered ? `0 0 8px ${barColor}55` : 'none',
                        }}
                    />
                </div>
            </div>
        </motion.div>
    );
}

// ── Heatmap grid component ─────────────────────────────────────────────────
function HeatmapGrid({ data, hmMax, getHeatColor, getTextColor, height }) {
    const [hovered, setHovered] = React.useState(null);
    const items = data.slice(0, 20);
    // Decide columns: <=6 items → 2 cols, <=12 → 3 cols, else 4 cols
    const cols = items.length <= 6 ? 2 : items.length <= 12 ? 3 : 4;

    return (
        <div style={{ height, display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* Hovered tooltip */}
            {hovered !== null && (
                <div style={{
                    position: 'absolute', top: 4, right: 4, zIndex: 10,
                    background: 'rgba(15,23,42,0.92)', color: '#f8fafc',
                    borderRadius: 10, padding: '6px 11px', fontSize: 11, fontWeight: 700,
                    pointerEvents: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                    border: '1px solid rgba(148,163,184,0.15)',
                }}>
                    <span style={{ color: '#94a3b8', fontSize: 10, fontWeight: 600 }}>{items[hovered]?.location}</span>
                    <br />
                    <span style={{ fontSize: 13 }}>{(items[hovered]?.value || 0).toLocaleString()}</span>
                    {hmMax > 0 && <span style={{ color: '#64748b', fontSize: 10, marginLeft: 6 }}>
                        ({Math.round((items[hovered]?.value / hmMax) * 100)}% of max)
                    </span>}
                </div>
            )}
            <div style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: 4,
                padding: '2px 0',
            }}>
                {items.map((item, i) => {
                    const bg = getHeatColor(item.value);
                    const fg = getTextColor(item.value);
                    const isHov = hovered === i;
                    return (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: isHov ? 1.04 : 1 }}
                            transition={{ delay: i * 0.03, duration: 0.25 }}
                            onMouseEnter={() => setHovered(i)}
                            onMouseLeave={() => setHovered(null)}
                            style={{
                                background: bg,
                                borderRadius: 8,
                                padding: '6px 8px',
                                cursor: 'default',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                minHeight: 48,
                                boxShadow: isHov ? '0 4px 16px rgba(0,89,153,0.35)' : '0 1px 3px rgba(0,0,0,0.08)',
                                border: isHov ? '1.5px solid rgba(0,114,198,0.55)' : '1px solid rgba(255,255,255,0.25)',
                                transition: 'box-shadow 0.15s, border 0.15s',
                                overflow: 'hidden',
                            }}
                        >
                            <span style={{ fontSize: 9, fontWeight: 800, color: fg, opacity: 0.75, lineHeight: 1.2, wordBreak: 'break-word' }}>
                                {item.location}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 900, color: fg, marginTop: 4 }}>
                                {(item.value || 0).toLocaleString()}
                            </span>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}


function ChartCard({ chart, index, onExpand }) {
    const badge = CHART_BADGES[chart.type] || { icon: BarChart3, label: 'Chart', color: '#7c3aed' };
    const BadgeIcon = badge.icon;
    const CARD_CHART_HEIGHT = 200; // uniform height for all cards
    const [isHovered, setIsHovered] = React.useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}
            onClick={onExpand}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="bg-white rounded-2xl border shadow-sm transition-all duration-200 flex flex-col overflow-hidden group cursor-pointer"
            style={{
                borderColor: isHovered ? chart.gradient[0] + '55' : '#f1f5f9',
                boxShadow: isHovered ? `0 8px 32px ${chart.gradient[0]}22, 0 2px 8px rgba(0,0,0,0.06)` : '0 1px 3px rgba(0,0,0,0.06)',
            }}
        >
            <div className="h-0.5 w-full shrink-0 transition-all duration-300"
                style={{ background: isHovered ? `linear-gradient(90deg, ${chart.gradient[0]}, ${chart.gradient[1]})` : `linear-gradient(90deg, ${chart.gradient[0]}66, ${chart.gradient[1]}66)` }} />
            <div className="p-4 pb-2 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ color: badge.color, background: badge.color + '12', border: `1px solid ${badge.color}28` }}>
                            <BadgeIcon size={10} /> {badge.label}
                        </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 truncate leading-snug">{chart.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5 truncate font-medium">{chart.description}</p>
                </div>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-150 border"
                    style={{
                        opacity: isHovered ? 1 : 0,
                        background: isHovered ? chart.gradient[0] + '12' : '#f8fafc',
                        borderColor: isHovered ? chart.gradient[0] + '33' : '#e2e8f0',
                    }}>
                    <Maximize2 size={13} style={{ color: isHovered ? chart.gradient[0] : '#94a3b8' }} />
                </div>
            </div>
            <div className="px-3 pb-3 flex-1" style={{ pointerEvents: 'none' }}>
                {renderChartJSX(chart, index, CARD_CHART_HEIGHT, '')}
            </div>
            <div className="px-4 pb-3 flex items-center justify-between" style={{ opacity: isHovered ? 1 : 0, transition: 'opacity 0.15s' }}>
                <div className="flex items-center gap-1">
                    <ArrowUpRight size={10} style={{ color: chart.gradient[0] }} />
                    <p className="text-xs font-semibold" style={{ color: chart.gradient[0] }}>Click to expand</p>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">{chart.data?.length} data points</span>
            </div>
        </motion.div>
    );
}

function PromptBar({ currentPrompt, onRegenerate, aiUsed, loading }) {
    const [open, setOpen] = useState(false);
    const [newPrompt, setNewPrompt] = useState(currentPrompt || '');
    const suggestions = ['Show top categories by revenue', 'Correlation between numeric columns', 'Distribution of all categorical columns', 'Time series trends', 'KPI overview with bar and pie charts'];

    return (
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden mb-5 shadow-sm">
            <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 transition-colors">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm shadow-blue-200"><Bot size={15} className="text-white" /></div>
                    <div className="text-left">
                        <p className="text-sm font-bold text-slate-800">{aiUsed ? '✦ AI-Generated Dashboard' : '⚡ Auto-Generated Dashboard'}</p>
                        {currentPrompt ? <p className="text-xs text-slate-400 truncate max-w-sm mt-0.5">"{currentPrompt}"</p> : <p className="text-xs text-slate-400 mt-0.5">Click to refine with a new prompt</p>}
                    </div>
                </div>
                <div className="flex items-center gap-2">{aiUsed && <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200/60">AI</span>}{open ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}</div>
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-slate-100 overflow-hidden">
                        <div className="p-4 flex gap-3">
                            <textarea value={newPrompt} onChange={e => setNewPrompt(e.target.value)} placeholder='e.g. "Show revenue trends over time..."' rows={2} className="flex-1 text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-slate-300 bg-slate-50/50" />
                            <button onClick={() => { onRegenerate(newPrompt); setOpen(false); }} disabled={loading} className="self-end flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-600 text-white text-sm font-semibold shadow-md hover:from-blue-500 disabled:opacity-50 transition-all whitespace-nowrap">{loading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}{loading ? 'Thinking…' : 'Regenerate'}</button>
                        </div>
                        <div className="px-4 pb-4 flex flex-wrap gap-2">{suggestions.map(s => <button key={s} onClick={() => setNewPrompt(s)} className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 transition-colors border border-slate-200/60">{s}</button>)}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function InsightCard({ card, index }) {
    const tone = TONE_STYLES[card.tone] || TONE_STYLES.slate;
    return (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className={`rounded-2xl border p-5 shadow-sm ${tone.panel}`}>
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-slate-800">{card.title}</p><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${tone.chip}`}>{card.value}</span></div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{card.description}</p>
        </motion.div>
    );
}

function ProfileMiniStat({ label, value, helper, accent = 'slate' }) {
    const tone = TONE_STYLES[accent] || TONE_STYLES.slate;
    return (
        <div className={`rounded-2xl border px-4 py-3 ${tone.panel}`}><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-xl font-black text-slate-900">{value}</p>{helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}</div>
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
            <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Schema Mix</p><h3 className="mt-1 text-base font-black text-slate-900">Dataset structure at a glance</h3></div><span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{Object.values(typeCounts).reduce((sum, count) => sum + Number(count || 0), 0)} total columns</span></div>
            <div className="mt-4 grid grid-cols-2 gap-3">{rows.map((row) => <ProfileMiniStat key={row.label} label={row.label} value={row.value} accent={row.tone} />)}</div>
        </div>
    );
}

function ColumnTablePanel({ columns }) {
    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between"><div><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Column Intelligence</p><h3 className="mt-1 font-black text-slate-800 text-base">Column analysis</h3><p className="text-xs text-slate-600 font-medium mt-0.5">{columns?.length} columns detected</p></div></div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead><tr className="bg-slate-50 text-xs font-bold uppercase text-slate-400 tracking-widest border-b">
                        <th className="px-6 py-3 text-left">Column</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-right">Unique</th><th className="px-4 py-3 text-right">Nulls %</th><th className="px-4 py-3 text-right">Min</th><th className="px-4 py-3 text-right">Max</th><th className="px-6 py-3 text-right">Mean</th>
                    </tr></thead>
                    <tbody>
                        {columns?.map((col, i) => {
                            const TypeIcon = TYPE_ICON[col.type] || Hash;
                            const typeStyle = TYPE_COLOR[col.type] || 'text-slate-500 bg-slate-100';
                            return (
                                <tr key={i} className="border-t hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-3.5 font-bold text-slate-800">{col.name}</td>
                                    <td className="px-4 py-3.5"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${typeStyle}`}><TypeIcon size={9} /> {col.type}</span></td>
                                    <td className="px-4 py-3.5 text-right text-slate-500">{col.unique?.toLocaleString()}</td>
                                    <td className="px-4 py-3.5 text-right"><span className={`font-bold ${col.nullPct > 20 ? 'text-red-500' : col.nullPct > 5 ? 'text-blue-500' : 'text-sky-500'}`}>{col.nullPct}%</span></td>
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

// ── Interactive Chart Board (Tableau bento grid) ──────────────────────────────
const CHART_TYPE_FILTERS = [
    { id: 'all', label: 'All Charts', icon: LayoutDashboard },
    { id: 'bar', label: 'Bar', icon: BarChart3 },
    { id: 'line', label: 'Line', icon: TrendingUp },
    { id: 'area', label: 'Area', icon: Activity },
    { id: 'pie', label: 'Pie', icon: PieIcon },
    { id: 'map', label: 'Geographic', icon: Globe },
    { id: 'funnel', label: 'Funnel', icon: Shuffle },
    { id: 'scatter', label: 'Scatter', icon: Sparkles },
];

function InteractiveChartBoard({ charts, totalRows, totalColumns, onExpandChart }) {
    const [activeFilter, setActiveFilter] = React.useState('all');
    const [highlightType, setHighlightType] = React.useState(null);

    const availableTypes = ['all', ...new Set(charts.map(c => c.type))];
    const filters = CHART_TYPE_FILTERS.filter(f => availableTypes.includes(f.id));
    const filteredCharts = activeFilter === 'all' ? charts : charts.filter(c => c.type === activeFilter);

    return (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-slate-50">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                        <LayoutDashboard size={14} className="text-blue-600" />
                    </div>
                    <span className="text-sm font-black text-slate-800">Chart Dashboard</span>
                    <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 font-semibold">
                        {filteredCharts.length} of {charts.length} charts
                    </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Database size={11} />
                    <span className="font-medium">{totalRows?.toLocaleString()} rows · {totalColumns} cols</span>
                </div>
            </div>

            {/* Interactive filter bar */}
            <div className="px-5 pt-3.5 pb-2 flex items-center gap-2 flex-wrap border-b border-slate-50/80">
                {filters.map(f => {
                    const Icon = f.icon;
                    const isActive = activeFilter === f.id;
                    const count = f.id === 'all' ? charts.length : charts.filter(c => c.type === f.id).length;
                    return (
                        <motion.button
                            key={f.id}
                            onClick={() => setActiveFilter(f.id)}
                            onMouseEnter={() => setHighlightType(f.id === 'all' ? null : f.id)}
                            onMouseLeave={() => setHighlightType(null)}
                            whileTap={{ scale: 0.95 }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150"
                            style={{
                                background: isActive ? '#7c3aed' : 'transparent',
                                color: isActive ? '#fff' : '#64748b',
                                border: isActive ? '1px solid #7c3aed' : '1px solid #e2e8f0',
                                boxShadow: isActive ? '0 2px 8px rgba(124,58,237,0.25)' : 'none',
                            }}
                        >
                            <Icon size={11} />
                            {f.label}
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                {count}
                            </span>
                        </motion.button>
                    );
                })}
            </div>

            {/* Uniform grid — same size for all cards */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeFilter}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
                >
                    {filteredCharts.map((chart, i) => {
                        const originalIndex = charts.indexOf(chart);
                        const dimmed = highlightType && chart.type !== highlightType;
                        return (
                            <motion.div
                                key={originalIndex}
                                animate={{ opacity: dimmed ? 0.4 : 1, scale: dimmed ? 0.98 : 1 }}
                                transition={{ duration: 0.15 }}
                            >
                                <ChartCard chart={chart} index={i} onExpand={() => onExpandChart(chart, originalIndex)} />
                            </motion.div>
                        );
                    })}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

function DashboardWorkspace({ analysis, dashboardSummary, filename, activeView, regenerating, onExpandChart, smartKpis, sessionId }) {
    return (
        <div className="space-y-5">

            {/* ── KPI Strip ── */}
            {smartKpis.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    {smartKpis.map((kpi, i) => {
                        const Icon = KPI_ICONS[kpi.icon] || BarChart3;
                        return (
                            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="relative overflow-hidden bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-4 group hover:shadow-md transition-shadow"
                            >
                                <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: `linear-gradient(90deg,${kpi.color}88,${kpi.color})` }} />
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">{kpi.label}</p>
                                        <p className="mt-2 text-xl font-black tracking-tight text-slate-900 truncate">{kpi.value}</p>
                                    </div>
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${kpi.color}15` }}>
                                        <Icon size={16} style={{ color: kpi.color }} />
                                    </div>
                                </div>
                                {kpi.hint && <p className="mt-2 text-[11px] leading-4 text-slate-500 truncate">{kpi.hint}</p>}
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* ── Chart Board ── */}
            {activeView === 'charts' ? (
                regenerating ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-5 shadow-xl shadow-blue-200">
                            <Sparkles size={26} className="text-white animate-pulse" />
                        </div>
                        <p className="text-slate-800 font-black text-lg mb-1.5">Rethinking your dashboard…</p>
                        <p className="text-sm text-slate-400">AI is selecting the best chart layout for your data.</p>
                    </div>
                ) : analysis.charts?.length > 0 ? (
                    <InteractiveChartBoard charts={analysis.charts} totalRows={analysis.totalRows} totalColumns={analysis.totalColumns} onExpandChart={onExpandChart} />
                ) : null
            ) : activeView === 'dataset' ? (
                <DatasetViewer sessionId={sessionId} tone="violet" title="Visualization Dataset" subtitle="Inspect the uploaded rows alongside the AI dashboard." />
            ) : (
                <div className="space-y-5"><SchemaMixPanel profile={dashboardSummary?.profile} /><ColumnTablePanel columns={analysis.columnSummary} /></div>
            )}

            {/* ── Executive Insights (moved below charts) ── */}
            {(dashboardSummary?.insightCards?.length > 0) && activeView === 'charts' && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                                <Sparkles size={13} className="text-blue-500" />
                            </div>
                            <span className="text-sm font-black text-slate-800">AI Insights</span>
                            <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 font-semibold">{dashboardSummary.insightCards.length} insights</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                        {dashboardSummary.insightCards.map((card, idx) => <InsightCard key={idx} card={card} index={idx} />)}
                    </div>
                </motion.div>
            )}

            {/* ── AI Dataset Intelligence (moved to bottom) ── */}
            {activeView === 'charts' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(0,114,198,0.05),transparent_50%)] pointer-events-none" />
                    <div className="relative flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
                        <div className="flex-1 min-w-0">
                            <div className="inline-flex items-center gap-2 rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500 mb-4">
                                <Sparkles size={11} className="text-blue-500" /> AI Dataset Intelligence
                            </div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">{filename.replace(/\.[^.]+$/, '') || 'Dataset'}</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-600 max-w-2xl">{dashboardSummary?.summary || 'Dynamic dashboard generated from your uploaded dataset.'}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                                    <LayoutDashboard size={11} /> {analysis.charts?.length || 0} charts
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                                    <Database size={11} /> {analysis.totalRows?.toLocaleString()} rows
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                                    <TableProperties size={11} /> {analysis.totalColumns} columns
                                </span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 xl:w-[320px] shrink-0">
                            <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Readiness</p>
                                <p className="mt-2 text-2xl font-black text-slate-900">{dashboardSummary?.profile?.readinessScore ?? 0}%</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">{dashboardSummary?.profile?.readinessLabel || 'Low'}</p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Quality</p>
                                <p className="mt-2 text-2xl font-black text-blue-600">{dashboardSummary?.qualityBand || 'Good'}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">{dashboardSummary?.profile?.completenessPct ?? 0}% complete</p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DataVisualizer({
    initialSessionId = null, initialFilename = '', initialRowCount = 0, initialPrompt = '', initialFile = null, onClose = null,
}) {
    const [step, setStep] = useState(initialSessionId ? 2 : 1);
    const [mode, setMode] = useState('file');
    const [connections, setConnections] = useState([]);
    const [connectionId, setConnectionId] = useState('');
    const [query, setQuery] = useState(buildSampleQuery('postgresql', 'my_table', 1000));
    const [delimiter, setDelimiter] = useState(',');
    const [customDelim, setCustomDelim] = useState('');
    const [file, setFile] = useState(initialFile);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [sessionId, setSessionId] = useState(initialSessionId || null);
    const [filename, setFilename] = useState(initialFilename || '');
    const [_rowCount, setRowCount] = useState(initialRowCount || 0);
    const [analysis, setAnalysis] = useState(null);
    const [error, setError] = useState('');
    const [activeView, setActiveView] = useState('charts');
    const [prompt, setPrompt] = useState(initialPrompt || '');
    const [regenerating, setRegenerating] = useState(false);
    const [expandedChart, setExpandedChart] = useState(null);

    const dashRef = useRef(null);
    const fileInputRef = useRef(null);
    const effectiveDelim = customDelim || delimiter;

    const handleDrop = useCallback((e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }, []);
    const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
    const handleDragLeave = () => setDragging(false);

    const runAnalyzeAI = async (sid, userPrompt) => {
        const res = await api.post(`/features/visualizer/analyze-ai/${sid}`, { prompt: userPrompt, hf_api_key: HF_API_KEY });
        return res.data;
    };

    const analyzeExistingSession = useCallback(async (sid, options = {}) => {
        if (!sid) return;
        const { prompt: nextPrompt = '', filename: nextFilename = '' } = options;
        setError(''); setAnalysis(null); setExpandedChart(null); setActiveView('charts'); setStep(2);
        setSessionId(sid); setFilename(nextFilename || 'Pipeline Output');
        setPrompt(nextPrompt); setAnalyzing(true);
        try { const data = await runAnalyzeAI(sid, nextPrompt); setAnalysis(data); }
        catch (err) { setError(err.response?.data?.detail || err.message || 'Unable to analyze.'); }
        finally { setAnalyzing(false); }
    }, []);

    useEffect(() => {
        if (initialSessionId) analyzeExistingSession(initialSessionId, { prompt: initialPrompt, filename: initialFilename, rowCount: initialRowCount });
    }, [analyzeExistingSession, initialFilename, initialPrompt, initialRowCount, initialSessionId]);

    useEffect(() => {
        const fetchConnections = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const res = await api.get('/connections', { headers: { Authorization: `Bearer ${token}` } });
                const available = res.data || [];
                setConnections(available);
                if (available.length > 0) {
                    setConnectionId(available[0].id);
                    setQuery(buildSampleQuery(available[0].db_type, 'my_table', 1000));
                }
            } catch (err) { console.error('Failed to load connections:', err); }
        };
        fetchConnections();
    }, []);

    const handleDatabaseIngest = async () => {
        if (!connectionId || !query) return;
        setError(''); setUploading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await api.post('/ingest/database', { connection_id: connectionId, query }, { headers });
            const { session_id, filename: fn, rows } = res.data;
            setSessionId(session_id); setFilename(fn || 'Database Export'); setRowCount(rows || 0);
            setUploading(false); setAnalyzing(true);
            const data = await runAnalyzeAI(session_id, prompt);
            setAnalysis(data); setStep(2);
        } catch (err) { setError(err.response?.data?.detail || err.message || 'Database ingestion failed.'); }
        finally { setUploading(false); setAnalyzing(false); }
    };

    const handleUploadAndAnalyze = async () => {
        if (!file) return;
        setError(''); setUploading(true);
        try {
            const fd = new FormData(); fd.append('file', file); fd.append('delimiter', effectiveDelim);
            const uploadRes = await api.post('/features/visualizer/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            const { session_id, filename: fn, rows } = uploadRes.data;
            setSessionId(session_id); setFilename(fn); setRowCount(rows);
            setUploading(false); setAnalyzing(true);
            const data = await runAnalyzeAI(session_id, prompt);
            setAnalysis(data); setStep(2);
        } catch (err) { setError(err.response?.data?.detail || err.message || 'Processing failed.'); }
        finally { setUploading(false); setAnalyzing(false); }
    };

    // handleRegenerate is wired to DashboardWorkspace via prop
    const handleRegenerate = async (newPrompt) => {
        if (!sessionId) return;
        setError(''); setRegenerating(true); setPrompt(newPrompt);
        try { const data = await runAnalyzeAI(sessionId, newPrompt); setAnalysis(data); }
        catch (err) { setError(err.response?.data?.detail || err.message || 'Regeneration failed.'); }
        finally { setRegenerating(false); }
    };

    const handleDownloadDashboard = async () => {
        if (!dashRef.current) return;
        const canvas = await html2canvas(dashRef.current, { scale: 1.5, useCORS: true, backgroundColor: '#f8fafc' });
        const link = document.createElement('a'); link.download = `${filename.replace(/\.[^.]+$/, '')}_dashboard.png`; link.href = canvas.toDataURL('image/png'); link.click();
    };

    const handleReset = () => {
        setStep(1); setFile(null); setSessionId(null); setFilename(''); setRowCount(0); setAnalysis(null); setError(''); setActiveView('charts'); setPrompt(''); setExpandedChart(null);
    };

    const isLoading = uploading || analyzing || regenerating;
    const dashboardSummary = useMemo(() => { if (!analysis) return null; return analysis.dashboardSummary || buildFallbackDashboardSummary(analysis); }, [analysis]);
    const smartKpis = useMemo(() => {
        if (!analysis || !analysis.columnSummary) return [];
        const numerics = analysis.columnSummary.filter(c => c.type === 'numeric');
        const keywords = ['sale', 'rev', 'price', 'amount', 'total', 'profit', 'cost', 'qty', 'quantity', 'order', 'margin', 'val'];
        const scored = numerics.map(c => {
            let score = 0; const name = c.name.toLowerCase();
            if (keywords.some(k => name.includes(k))) score += 50;
            if (name.includes('id')) score -= 100;
            return { ...c, score };
        }).sort((a, b) => b.score - a.score);
        const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899']; let colorIdx = 0;
        const generated = []; scored.slice(0, 3).forEach(c => {
            generated.push({ label: `Avg ${c.name}`, value: (c.mean ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 }), icon: 'stats', color: colors[colorIdx++ % colors.length] });
        });
        return generated.slice(0, 6);
    }, [analysis]);

    return (
        <div className="flex flex-col h-full w-full bg-slate-50/80">
            <AnimatePresence>{expandedChart && <ChartModal chart={expandedChart.chart} index={expandedChart.index} onClose={() => setExpandedChart(null)} />}</AnimatePresence>
            <div className="shrink-0 bg-white border-b border-slate-100 px-6 md:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md"><BarChart3 size={19} className="text-white" /></div>
                    <div><h1 className="text-base font-black text-slate-900 flex items-center gap-2">AI Visualizer{HF_API_KEY && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200/60">Qwen</span>}</h1><p className="text-xs text-slate-600 font-medium mt-0.5">Connect data → instant AI dashboard</p></div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {[{ n: 1, label: 'Upload' }, { n: 2, label: 'Visualize' }].map((s, i) => (
                        <div key={s.n} className="flex items-center gap-2">
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${step === s.n ? 'bg-blue-600 text-white shadow-sm shadow-blue-300' : step > s.n ? 'bg-sky-100 text-sky-700 border border-sky-200/60' : 'bg-slate-100 text-slate-400'}`}>
                                {step > s.n ? <CheckCircle2 size={11} /> : <span className="w-4 text-center">{s.n}</span>}{s.label}
                            </div>
                            {i < 1 && <ChevronRight size={13} className="text-slate-300" />}
                        </div>
                    ))}
                    {onClose && <button onClick={onClose} className="ml-1 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"><X size={16} /></button>}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div key="upload" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="max-w-5xl mx-auto px-6 py-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                <div className="space-y-4">
                                    <div className="flex bg-slate-100 rounded-xl p-1 mb-2 w-fit">
                                        {['file', 'database'].map((m) => (
                                            <button key={m} onClick={() => setMode(m)} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${mode === m ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-800 hover:text-slate-900'}`}>{m === 'file' ? 'File Upload' : 'Local Database'}</button>
                                        ))}
                                    </div>
                                    {mode === 'file' ? (
                                        <><div onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onClick={() => fileInputRef.current?.click()} className={`relative rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 ${dragging ? 'border-blue-400 bg-blue-50/60 scale-[1.01]' : file ? 'border-sky-400 bg-sky-50/30' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 bg-white'}`}>
                                            <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                                            <div className="py-14 px-8 flex flex-col items-center text-center">{file ? (<><div className="w-14 h-14 rounded-2xl bg-sky-100 flex items-center justify-center mb-4"><FileText size={26} className="text-sky-600" /></div><p className="text-base font-black text-slate-800 mb-1">{file.name}</p><p className="text-sm text-slate-600 font-medium">{(file.size / 1024).toFixed(1)} KB · Click to change</p></>) : (<><div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-5"><Upload size={28} className="text-blue-400" /></div><p className="text-lg font-black text-slate-800 mb-1.5">Drop your dataset here</p><p className="text-sm text-slate-600 font-medium">CSV, Excel, TSV, TXT supported</p></>)}</div>
                                            {file && <button className="absolute top-3 right-3 p-1.5 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-red-500 transition-all" onClick={(e) => { e.stopPropagation(); setFile(null); }}><X size={13} /></button>}
                                        </div><div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm"><p className="text-xs font-bold uppercase text-slate-400 tracking-widest mb-3">Column Separator</p><div className="flex items-center flex-wrap gap-2">{SEPARATORS.map(s => <button key={s.value} onClick={() => { setDelimiter(s.value); setCustomDelim(''); }} className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${delimiter === s.value && !customDelim ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'}`}>{s.label}</button>)}<input type="text" placeholder="Custom…" value={customDelim} onChange={(e) => setCustomDelim(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono w-24 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50" /></div></div></>
                                    ) : (
                                        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-5">
                                            {connections.length === 0 ? (
                                                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                                                    <div>
                                                        <Database size={24} className="mx-auto mb-2 text-slate-300" />
                                                        Create a local SQLite or server connection here to visualize database data directly.
                                                    </div>
                                                    <DatabaseConnectionManager
                                                        title="Add Connection"
                                                        compact
                                                        initialOpen
                                                        showInlineButton={false}
                                                        onConnectionSaved={async (nextConnectionId) => {
                                                            const token = localStorage.getItem('token');
                                                            if (!token) return;
                                                            const res = await api.get('/connections', { headers: { Authorization: `Bearer ${token}` } });
                                                            const available = res.data || [];
                                                            setConnections(available);
                                                            if (nextConnectionId) setConnectionId(nextConnectionId);
                                                        }}
                                                    />
                                                </div>
                                            ) : (
                                                <>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 mb-1.5">Connection</label>
                                                        <select value={connectionId} onChange={(e) => setConnectionId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium focus:ring-2 focus:ring-blue-400 outline-none">
                                                            {connections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                        </select>
                                                    </div>
                                                    <DatabaseConnectionManager
                                                        title="New Connection"
                                                        compact
                                                        onConnectionSaved={async (nextConnectionId) => {
                                                            const token = localStorage.getItem('token');
                                                            if (!token) return;
                                                            const res = await api.get('/connections', { headers: { Authorization: `Bearer ${token}` } });
                                                            const available = res.data || [];
                                                            setConnections(available);
                                                            if (nextConnectionId) setConnectionId(nextConnectionId);
                                                        }}
                                                    />
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 mb-1.5">SQL Query</label>
                                                        <textarea rows={6} value={query} onChange={(e) => setQuery(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-400 outline-none resize-none" />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col h-full">
                                    {HF_API_KEY ? (<div className="bg-gradient-to-br from-blue-50/80 to-blue-50/60 rounded-2xl border border-blue-100 p-5 shadow-sm flex-grow mb-4"><div className="flex items-center gap-2 mb-3"><div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm"><Wand2 size={13} className="text-white" /></div><p className="text-sm font-bold text-slate-800">Describe your dashboard <span className="text-blue-500 font-medium ml-1">(optional)</span></p></div><textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder='e.g. "Show me revenue by region..."' rows={3} className="w-full text-sm border border-blue-200/70 bg-white rounded-xl px-3.5 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-slate-300 shadow-sm" /><div className="mt-2.5 flex flex-wrap gap-2">{['Top categories by count', 'Numeric correlations', 'Revenue over time'].map(s => <button key={s} onClick={() => setPrompt(s)} className="px-3 py-1 rounded-full text-xs font-medium bg-white text-blue-600 border border-blue-200/70 hover:bg-blue-100 transition-colors shadow-sm">{s}</button>)}</div></div>) : (<div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 flex-grow mb-4 flex flex-col items-center justify-center text-center"><div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3"><BarChart3 size={22} className="text-slate-400" /></div><h3 className="text-slate-700 font-bold mb-1.5">Standard Dashboard</h3><p className="text-sm text-slate-400 max-w-sm">Automatic dashboard built from your data heuristics.</p></div>)}
                                    <div>{error && <div className="mb-4 flex items-start gap-2.5 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 font-medium"><AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}</div>}
                                        <button onClick={mode === 'file' ? handleUploadAndAnalyze : handleDatabaseIngest} disabled={(mode === 'file' ? !file : !connectionId) || isLoading} className="w-full py-4 rounded-2xl font-bold text-base bg-gradient-to-r from-blue-600 to-blue-600 text-white hover:from-blue-500 shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2.5">{uploading ? <><RefreshCw size={17} className="animate-spin" /> Ingesting...</> : analyzing ? <><Sparkles size={17} className="animate-pulse" /> Building...</> : <><Zap size={17} /> Generate Dashboard</>}</button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                    {step === 2 && !analysis && (<motion.div key="viz-loading" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="w-full p-6 md:p-8"><div className="mx-auto max-w-3xl rounded-[28px] border border-slate-100 bg-white p-8 shadow-xl text-center"><div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 mx-auto shadow-lg"><RefreshCw size={26} className="animate-spin text-white" /></div><h2 className="text-2xl font-black text-slate-900">Preparing dashboard...</h2><p className="mt-2 text-sm font-medium text-slate-400">AI is selecting the best layout for your dataset.</p></div></motion.div>)}
                    {step === 2 && analysis && (<motion.div key="viz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full p-6 md:p-8"><div className="flex flex-wrap items-center justify-between gap-3 mb-5"><div className="flex items-center gap-3 flex-wrap"><div className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200/80 rounded-xl text-sm shadow-sm"><FileText size={13} className="text-slate-400" /><span className="font-semibold text-slate-700">{filename}</span><span className="text-slate-300">·</span><span className="text-slate-500 font-medium">{analysis.totalRows?.toLocaleString()} rows</span></div><WorkspaceTabs tone="violet" activeTab={activeView} onChange={setActiveView} tabs={[{ id: 'charts', label: 'Charts', icon: LayoutDashboard }, { id: 'columns', label: 'Columns', icon: TableProperties }, { id: 'dataset', label: 'Dataset', icon: Database }]} /></div><div className="flex items-center gap-2"><button onClick={handleDownloadDashboard} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200/80 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 shadow-sm"><Download size={13} /> PNG</button><button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200/80 text-slate-500 rounded-xl text-sm font-semibold hover:bg-slate-50 shadow-sm"><RotateCcw size={13} /> Reset</button></div></div><DashboardWorkspace analysis={analysis} dashboardSummary={dashboardSummary} filename={filename} activeView={activeView} regenerating={regenerating} onExpandChart={(chart, index) => setExpandedChart({ chart, index })} smartKpis={smartKpis} sessionId={sessionId} onRegenerate={handleRegenerate} /></motion.div>)}
                </AnimatePresence>
            </div>
        </div>
    );
}
