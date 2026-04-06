import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
    BarChart3, Upload, Sparkles, RefreshCw, Download,
    ChevronRight, FileText, X, LayoutDashboard, TableProperties,
    TrendingUp, PieChart as PieIcon, Activity, Zap, CheckCircle2,
    AlertCircle, Database, Hash, Type, Calendar, ToggleLeft,
    Bot, Wand2, RotateCcw, Send, ChevronDown, ChevronUp,
    Maximize2, FileSpreadsheet, ImageDown,
} from 'lucide-react';
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area,
    PieChart, Pie, Cell, ScatterChart, Scatter,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import html2canvas from 'html2canvas';

// ── Config ───────────────────────────────────────────────────────────────────
const API_BASE   = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const HF_API_KEY = import.meta.env.VITE_HF_API_KEY  || '';

const api = axios.create({ baseURL: API_BASE, timeout: 90_000 });

const SEPARATORS = [
    { label: ',',   value: ',' },
    { label: ';',   value: ';' },
    { label: '|',   value: '|' },
    { label: 'TAB', value: '\t' },
];

// ── Palette ──────────────────────────────────────────────────────────────────
const KPI_ICONS = {
    rows: Database, columns: TableProperties,
    check: CheckCircle2, stats: TrendingUp,
};
const TYPE_ICON = { numeric: Hash, categorical: Type, datetime: Calendar, boolean: ToggleLeft };
const TYPE_COLOR = {
    numeric:     'text-indigo-600 bg-indigo-50',
    categorical: 'text-emerald-600 bg-emerald-50',
    datetime:    'text-amber-600 bg-amber-50',
    boolean:     'text-purple-600 bg-purple-50',
};
const CHART_BADGES = {
    bar:     { icon: BarChart3,  label: 'Bar Chart'     },
    area:    { icon: Activity,   label: 'Area Chart'    },
    line:    { icon: TrendingUp, label: 'Line Chart'    },
    pie:     { icon: PieIcon,    label: 'Pie Chart'     },
    scatter: { icon: Sparkles,   label: 'Scatter Chart' },
};

// ── Custom Tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 shadow-2xl">
            {label !== undefined && <p className="text-slate-400 text-xs mb-1 font-medium">{label}</p>}
            {payload.map((p, i) => (
                <p key={i} className="text-sm font-bold" style={{ color: p.color || p.fill || '#fff' }}>
                    {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
                </p>
            ))}
        </div>
    );
};

// ── Shared chart renderer (card height=220, modal height=420) ────────────────
function renderChartJSX(chart, index, height = 220, idSuffix = '') {
    const id     = `${index}${idSuffix}`;
    const common = { data: chart.data, margin: { top: 8, right: 16, left: 0, bottom: 8 } };

    switch (chart.type) {
        case 'bar':
            return (
                <ResponsiveContainer width="100%" height={height}>
                    <BarChart {...common}>
                        <defs>
                            <linearGradient id={`barG-${id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%"   stopColor={chart.gradient[0]} stopOpacity={0.95} />
                                <stop offset="100%" stopColor={chart.gradient[1]} stopOpacity={0.7}  />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey={chart.xKey} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={52} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                        <Bar dataKey={chart.dataKey} fill={`url(#barG-${id})`} radius={[6, 6, 0, 0]} maxBarSize={56} />
                    </BarChart>
                </ResponsiveContainer>
            );

        case 'area':
            return (
                <ResponsiveContainer width="100%" height={height}>
                    <AreaChart {...common}>
                        <defs>
                            <linearGradient id={`areaG-${id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor={chart.color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={chart.color} stopOpacity={0}   />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
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
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey={chart.xKey} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={52} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey={chart.dataKey} stroke={chart.color} strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: chart.color }} />
                    </LineChart>
                </ResponsiveContainer>
            );

        case 'pie':
            return (
                <ResponsiveContainer width="100%" height={height}>
                    <PieChart>
                        <Pie data={chart.data} cx="50%" cy="45%" innerRadius={height * 0.18} outerRadius={height * 0.34} paddingAngle={3} dataKey="value">
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
                        <Scatter data={chart.data} fill={chart.color} fillOpacity={0.7} />
                    </ScatterChart>
                </ResponsiveContainer>
            );

        default: return null;
    }
}

// ── Excel download helper ─────────────────────────────────────────────────────
function downloadChartExcel(chart) {
    const wb  = XLSX.utils.book_new();
    const ws  = XLSX.utils.json_to_sheet(chart.data);
    const safeName = chart.title.replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 31) || 'Chart Data';
    XLSX.utils.book_append_sheet(wb, ws, safeName);
    XLSX.writeFile(wb, `${safeName.replace(/ /g, '_')}.xlsx`);
}

// ── Chart Expand Modal ────────────────────────────────────────────────────────
function ChartModal({ chart, index, onClose }) {
    const chartRef = useRef(null);
    const badge    = CHART_BADGES[chart.type] || { icon: BarChart3, label: 'Chart' };
    const BadgeIcon = badge.icon;

    const handleDownloadPNG = async () => {
        if (!chartRef.current) return;
        const canvas = await html2canvas(chartRef.current, {
            scale: 2, useCORS: true, backgroundColor: '#ffffff',
        });
        const link = document.createElement('a');
        link.download = `${chart.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    // Close on backdrop click
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    // Close on Escape key
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') onClose();
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
            style={{ backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)' }}
            onClick={handleBackdropClick}
            onKeyDown={handleKeyDown}
            tabIndex={-1}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.93, y: 20 }}
                animate={{ opacity: 1, scale: 1,    y: 0  }}
                exit={{ opacity: 0, scale: 0.93, y: 20 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Gradient accent bar */}
                <div className="h-1 w-full shrink-0" style={{ background: `linear-gradient(90deg,${chart.gradient[0]},${chart.gradient[1]})` }} />

                {/* Header */}
                <div className="flex items-start justify-between gap-4 px-7 py-5 shrink-0 border-b border-slate-100">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
                                style={{ color: chart.color, borderColor: chart.color + '40', background: chart.color + '14' }}
                            >
                                <BadgeIcon size={11} /> {badge.label}
                            </span>
                        </div>
                        <h2 className="text-xl font-black text-slate-900 leading-tight">{chart.title}</h2>
                        <p className="text-sm text-slate-400 mt-0.5">{chart.description}</p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => downloadChartExcel(chart)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-bold hover:bg-emerald-100 transition-all shadow-sm"
                        >
                            <FileSpreadsheet size={15} />
                            Download Excel
                        </button>
                        <button
                            onClick={handleDownloadPNG}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 text-slate-700 border border-slate-200 text-sm font-bold hover:bg-slate-100 transition-all shadow-sm"
                        >
                            <ImageDown size={15} />
                            Save PNG
                        </button>
                        <button
                            onClick={onClose}
                            className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Chart area */}
                <div ref={chartRef} className="flex-1 min-h-0 overflow-auto px-6 py-6 bg-slate-50/40">
                    {renderChartJSX(chart, index, 420, '-modal')}
                </div>

                {/* Data preview table */}
                <div className="shrink-0 border-t border-slate-100 max-h-48 overflow-auto">
                    <div className="px-7 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-wider">
                            Data Preview — {chart.data.length} rows
                        </p>
                        <button
                            onClick={() => downloadChartExcel(chart)}
                            className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                        >
                            <FileSpreadsheet size={12} /> Export all as Excel
                        </button>
                    </div>
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-white border-b border-slate-100">
                            <tr>
                                {Object.keys(chart.data[0] || {}).map(k => (
                                    <th key={k} className="px-5 py-2.5 text-left font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        {k}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {chart.data.map((row, i) => (
                                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                    {Object.values(row).map((val, j) => (
                                        <td key={j} className="px-5 py-2 text-slate-700 font-medium whitespace-nowrap">
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

// ── Chart Card (clickable → expands to modal) ─────────────────────────────────
function ChartCard({ chart, index, onExpand }) {
    const badge     = CHART_BADGES[chart.type] || { icon: BarChart3, label: 'Chart' };
    const BadgeIcon = badge.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.07 }}
            onClick={onExpand}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden group cursor-pointer"
        >
            {/* Accent bar */}
            <div className="h-0.5 w-full shrink-0" style={{ background: `linear-gradient(90deg,${chart.gradient[0]},${chart.gradient[1]})` }} />

            {/* Card header */}
            <div className="p-5 pb-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border"
                            style={{ color: chart.color, borderColor: chart.color + '40', background: chart.color + '12' }}
                        >
                            <BadgeIcon size={10} /> {badge.label}
                        </span>
                    </div>
                    <h3 className="text-sm font-black text-slate-800 truncate">{chart.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{chart.description}</p>
                </div>

                {/* Expand icon — visible on hover */}
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-violet-50 border border-violet-100">
                    <Maximize2 size={13} className="text-violet-600" />
                </div>
            </div>

            {/* Chart */}
            <div className="px-2 pb-4 flex-1 pointer-events-none">
                {renderChartJSX(chart, index, 220, '')}
            </div>

            {/* Click-to-expand hint */}
            <div className="px-5 pb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <p className="text-xs text-slate-400 font-medium flex items-center gap-1">
                    <Maximize2 size={10} /> Click to expand · download Excel & PNG
                </p>
            </div>
        </motion.div>
    );
}

// ── Prompt Bar ────────────────────────────────────────────────────────────────
function PromptBar({ currentPrompt, onRegenerate, aiUsed, loading }) {
    const [open,      setOpen]      = useState(false);
    const [newPrompt, setNewPrompt] = useState(currentPrompt || '');

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-5">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                        <Bot size={14} className="text-white" />
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-black text-slate-800">
                            {aiUsed ? '✨ AI-Generated Dashboard' : '⚡ Auto-Generated Dashboard'}
                        </p>
                        {currentPrompt ? (
                            <p className="text-xs text-slate-500 truncate max-w-sm">"{currentPrompt}"</p>
                        ) : (
                            <p className="text-xs text-slate-400">Click to refine with a new prompt</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {aiUsed && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-violet-100 text-violet-700 border border-violet-200">
                            Qwen AI
                        </span>
                    )}
                    {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-slate-100 overflow-hidden"
                    >
                        <div className="p-4 flex gap-3">
                            <textarea
                                value={newPrompt}
                                onChange={e => setNewPrompt(e.target.value)}
                                placeholder='e.g. "Show revenue trends over time and compare sales across regions"'
                                rows={2}
                                className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent placeholder-slate-300"
                            />
                            <button
                                onClick={() => { onRegenerate(newPrompt); setOpen(false); }}
                                disabled={loading}
                                className="self-end flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold shadow-md hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 transition-all whitespace-nowrap"
                            >
                                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                                {loading ? 'Thinking…' : 'Regenerate'}
                            </button>
                        </div>
                        <div className="px-4 pb-3 flex flex-wrap gap-2">
                            {['Show top categories by revenue', 'Correlation between numeric columns', 'Distribution of all categorical columns', 'Time series trends', 'KPI overview with bar and pie charts'].map(s => (
                                <button key={s} onClick={() => setNewPrompt(s)}
                                    className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-violet-100 hover:text-violet-700 transition-colors">
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

// ── Main Component ────────────────────────────────────────────────────────────
export default function DataVisualizer() {
    const [step,         setStep]         = useState(1);
    const [delimiter,    setDelimiter]    = useState(',');
    const [customDelim,  setCustomDelim]  = useState('');
    const [file,         setFile]         = useState(null);
    const [dragging,     setDragging]     = useState(false);
    const [uploading,    setUploading]    = useState(false);
    const [analyzing,    setAnalyzing]    = useState(false);
    const [sessionId,    setSessionId]    = useState(null);
    const [filename,     setFilename]     = useState('');
    const [rowCount,     setRowCount]     = useState(0);
    const [analysis,     setAnalysis]     = useState(null);
    const [error,        setError]        = useState('');
    const [activeView,   setActiveView]   = useState('charts');
    const [prompt,       setPrompt]       = useState('');
    const [regenerating, setRegenerating] = useState(false);
    const [expandedChart, setExpandedChart] = useState(null);   // { chart, index }

    const dashRef     = useRef(null);
    const fileInputRef = useRef(null);
    const effectiveDelim = customDelim || delimiter;

    // ── Drop / file select ───────────────────────────────────────────────────
    const handleDrop = useCallback((e) => {
        e.preventDefault(); setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) setFile(f);
    }, []);
    const handleDragOver  = (e) => { e.preventDefault(); setDragging(true); };
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
                    throw new Error(`Cannot reach the server at ${API_BASE}. Check VITE_API_BASE_URL on Vercel.`);
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

    // ── Download dashboard PNG ────────────────────────────────────────────────
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
        setAnalysis(null); setError(''); setActiveView('charts');
        setPrompt(''); setExpandedChart(null);
    };

    const steps    = [{ n: 1, label: 'Upload' }, { n: 2, label: 'Visualize' }];
    const isLoading = uploading || analyzing || regenerating;

    return (
        <div className="flex flex-col h-full w-full bg-slate-50">

            {/* ── Fullscreen Chart Modal (portal-style at root) ── */}
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
            <div className="shrink-0 bg-white border-b border-slate-100 px-8 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-200">
                        <BarChart3 size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-slate-900 leading-tight flex items-center gap-2">
                            AI Visualizer
                            {HF_API_KEY && (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-100 to-indigo-100 text-violet-700 border border-violet-200">
                                    Powered by Qwen
                                </span>
                            )}
                        </h1>
                        <p className="text-xs text-slate-400 font-medium">
                            {HF_API_KEY
                                ? 'Upload a dataset + describe what you want → Qwen builds your dashboard'
                                : 'Upload a dataset → get an instant AI-powered dashboard'}
                        </p>
                    </div>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-2">
                    {steps.map((s, i) => (
                        <div key={s.n} className="flex items-center gap-2">
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${step === s.n ? 'bg-violet-600 text-white shadow-md' : step > s.n ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                {step > s.n ? <CheckCircle2 size={12} /> : <span>{s.n}</span>}
                                {s.label}
                            </div>
                            {i < steps.length - 1 && <ChevronRight size={14} className="text-slate-300" />}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Content ── */}
            <div className="flex-1 overflow-y-auto">
                <AnimatePresence mode="wait">

                    {/* ── STEP 1: UPLOAD ── */}
                    {step === 1 && (
                        <motion.div key="upload" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="max-w-2xl mx-auto px-6 py-12">

                            {/* Drop zone */}
                            <div
                                onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                                onClick={() => fileInputRef.current?.click()}
                                className={`relative rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200
                                    ${dragging ? 'border-violet-400 bg-violet-50 scale-[1.01]' : file ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/30 bg-white'}`}
                            >
                                <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" className="hidden"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)} />
                                <div className="py-16 px-8 flex flex-col items-center text-center">
                                    {file ? (
                                        <>
                                            <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
                                                <FileText size={28} className="text-emerald-600" />
                                            </div>
                                            <p className="text-base font-black text-slate-800 mb-1">{file.name}</p>
                                            <p className="text-sm text-slate-400">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mb-5">
                                                <Upload size={32} className="text-violet-500" />
                                            </div>
                                            <p className="text-lg font-black text-slate-800 mb-1">Drop your dataset here</p>
                                            <p className="text-sm text-slate-400">Supports CSV, TSV, TXT — or click to browse</p>
                                        </>
                                    )}
                                </div>
                                {file && (
                                    <button className="absolute top-3 right-3 p-1.5 rounded-lg bg-white text-slate-400 hover:text-red-500 shadow"
                                        onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Separator */}
                            <div className="mt-5 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                                <p className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">Separator</p>
                                <div className="flex items-center flex-wrap gap-2">
                                    {SEPARATORS.map(s => (
                                        <button key={s.value}
                                            onClick={() => { setDelimiter(s.value); setCustomDelim(''); }}
                                            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${delimiter === s.value && !customDelim ? 'bg-violet-600 text-white border-violet-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-violet-300'}`}>
                                            {s.label}
                                        </button>
                                    ))}
                                    <input type="text" placeholder="Custom…" value={customDelim}
                                        onChange={(e) => setCustomDelim(e.target.value)}
                                        className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono w-24 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent" />
                                </div>
                            </div>

                            {/* AI Prompt */}
                            {HF_API_KEY && (
                                <div className="mt-5 bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl border border-violet-100 p-5 shadow-sm">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                                            <Wand2 size={13} className="text-white" />
                                        </div>
                                        <p className="text-sm font-black text-slate-800">Describe your dashboard <span className="text-violet-600">(optional)</span></p>
                                    </div>
                                    <textarea
                                        value={prompt} onChange={e => setPrompt(e.target.value)}
                                        placeholder='e.g. "Show me revenue by region as a bar chart, top 5 product categories as pie, and sales trends over time"'
                                        rows={3}
                                        className="w-full text-sm border border-violet-200 bg-white rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent placeholder-slate-300"
                                    />
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {['Show top categories by count', 'Correlation between numeric columns', 'Revenue trends over time', 'Distribution breakdown as pies'].map(s => (
                                            <button key={s} onClick={() => setPrompt(s)}
                                                className="px-3 py-1 rounded-full text-xs font-semibold bg-white text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors">
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2">
                                        Powered by <span className="font-bold text-slate-500">Qwen/Qwen2.5-72B-Instruct</span> · Leave blank for auto-detect
                                    </p>
                                </div>
                            )}

                            {error && (
                                <div className="mt-4 flex items-start gap-2 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                                    <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
                                </div>
                            )}

                            <button
                                onClick={handleUploadAndAnalyze} disabled={!file || isLoading}
                                className="mt-6 w-full py-4 rounded-2xl font-black text-base bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 shadow-xl shadow-violet-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all hover:scale-[1.01]"
                            >
                                {uploading  ? <><RefreshCw size={18} className="animate-spin" /> Uploading…</> :
                                 analyzing  ? <><Sparkles  size={18} className="animate-pulse" /> Qwen is building your dashboard…</> :
                                 HF_API_KEY ? <><Wand2     size={18} /> {prompt ? 'Generate AI Dashboard' : 'Auto-Generate Dashboard'}</> :
                                              <><Zap       size={18} /> Generate Dashboard</>}
                            </button>

                            {analyzing && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex items-center gap-3 p-4 bg-violet-50 border border-violet-100 rounded-xl">
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
                                        <Sparkles size={16} className="text-white animate-pulse" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-violet-800">Qwen is reading your data…</p>
                                        <p className="text-xs text-violet-500">Understanding column types, statistics, and generating the perfect chart layout</p>
                                    </div>
                                </motion.div>
                            )}
                        </motion.div>
                    )}

                    {/* ── STEP 2: DASHBOARD ── */}
                    {step === 2 && analysis && (
                        <motion.div key="viz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full p-6 md:p-8">

                            {/* Toolbar */}
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm">
                                        <FileText size={14} className="text-slate-400" />
                                        <span className="font-bold text-slate-700">{filename}</span>
                                        <span className="text-slate-400">·</span>
                                        <span className="text-slate-500">{analysis.totalRows?.toLocaleString()} rows</span>
                                        <span className="text-slate-400">·</span>
                                        <span className="text-slate-500">{analysis.totalColumns} cols</span>
                                    </div>
                                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
                                        <button onClick={() => setActiveView('charts')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeView === 'charts' ? 'bg-violet-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}>
                                            <span className="flex items-center gap-1"><LayoutDashboard size={12} /> Charts</span>
                                        </button>
                                        <button onClick={() => setActiveView('columns')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeView === 'columns' ? 'bg-violet-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}>
                                            <span className="flex items-center gap-1"><TableProperties size={12} /> Columns</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={handleDownloadDashboard}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm">
                                        <Download size={14} /> Export PNG
                                    </button>
                                    <button onClick={handleReset}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-500 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm">
                                        <RotateCcw size={14} /> New Dataset
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="mb-4 flex items-start gap-2 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                                    <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
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
                                {/* KPI Tiles */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    {analysis.kpis?.map((kpi, i) => {
                                        const Icon = KPI_ICONS[kpi.icon] || BarChart3;
                                        return (
                                            <motion.div key={i}
                                                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: i * 0.05 }}
                                                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
                                                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: kpi.color + '18' }}>
                                                    <Icon size={20} style={{ color: kpi.color }} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-2xl font-black text-slate-900 leading-none truncate">{kpi.value}</p>
                                                    <p className="text-xs text-slate-400 font-semibold mt-1">{kpi.label}</p>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>

                                {activeView === 'charts' ? (
                                    regenerating ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-center">
                                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-4 shadow-xl shadow-violet-200">
                                                <Sparkles size={28} className="text-white animate-pulse" />
                                            </div>
                                            <p className="text-slate-700 font-black text-lg mb-1">Qwen is rethinking your dashboard…</p>
                                            <p className="text-sm text-slate-400 max-w-sm">Reading your prompt and selecting the best charts from your dataset</p>
                                        </div>
                                    ) : analysis.charts?.length > 0 ? (
                                        <>
                                            {/* Hint banner */}
                                            <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-violet-50 border border-violet-100 rounded-xl text-xs text-violet-600 font-semibold w-fit">
                                                <Maximize2 size={12} />
                                                Click any chart to enlarge it and download Excel or PNG
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                                {analysis.charts.map((chart, i) => (
                                                    <ChartCard
                                                        key={i}
                                                        chart={chart}
                                                        index={i}
                                                        onExpand={() => setExpandedChart({ chart, index: i })}
                                                    />
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20 text-center">
                                            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                                                <BarChart3 size={28} className="text-slate-300" />
                                            </div>
                                            <p className="text-slate-600 font-bold mb-1">No charts could be generated</p>
                                            <p className="text-sm text-slate-400 max-w-sm">Try a different prompt, or use a dataset with numeric + categorical columns.</p>
                                        </div>
                                    )
                                ) : (
                                    /* Column Summary Table */
                                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                        <div className="px-6 py-4 border-b border-slate-100">
                                            <h3 className="font-black text-slate-800">Column Analysis</h3>
                                            <p className="text-xs text-slate-400 mt-0.5">{analysis.columnSummary?.length} columns detected</p>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-slate-50 text-xs font-black uppercase text-slate-400 tracking-wider">
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
                                                        const TypeIcon  = TYPE_ICON[col.type]  || Hash;
                                                        const typeStyle = TYPE_COLOR[col.type] || 'text-slate-500 bg-slate-100';
                                                        return (
                                                            <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/60">
                                                                <td className="px-6 py-3.5 font-bold text-slate-800">{col.name}</td>
                                                                <td className="px-4 py-3.5">
                                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${typeStyle}`}>
                                                                        <TypeIcon size={10} /> {col.type}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3.5 text-right text-slate-600 font-medium">{col.unique?.toLocaleString()}</td>
                                                                <td className="px-4 py-3.5 text-right">
                                                                    <span className={`font-bold ${col.nullPct > 20 ? 'text-red-500' : col.nullPct > 5 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                                        {col.nullPct}%
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3.5 text-right text-slate-500 font-mono text-xs">{col.min ?? '—'}</td>
                                                                <td className="px-4 py-3.5 text-right text-slate-500 font-mono text-xs">{col.max ?? '—'}</td>
                                                                <td className="px-6 py-3.5 text-right text-slate-500 font-mono text-xs">{col.mean ?? '—'}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
