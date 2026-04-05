import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FolderClock, RefreshCw, CheckCircle2, AlertCircle,
    LoaderCircle, Download, Play, GitMerge, Clock3,
    BarChart3, Layers, ChevronDown, ChevronUp, Trash2, X
} from 'lucide-react';

const STORAGE_KEY = 'cleanflow_pipeline_runs_v1';

const STATUS_CONFIG = {
    completed: {
        label: 'Completed', icon: CheckCircle2,
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        bar: 'bg-emerald-500',
        glow: '#10b981',
    },
    failed: {
        label: 'Failed', icon: AlertCircle,
        badge: 'bg-red-50 text-red-700 border-red-100',
        bar: 'bg-red-500',
        glow: '#ef4444',
    },
    running: {
        label: 'Running', icon: LoaderCircle,
        badge: 'bg-amber-50 text-amber-700 border-amber-100',
        bar: 'bg-amber-400',
        glow: '#f59e0b',
    },
};

function duration(run) {
    if (!run.startedAt) return null;
    const end = run.finishedAt ? new Date(run.finishedAt) : new Date();
    const ms = end - new Date(run.startedAt);
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
}

function RunCard({ run, onDelete }) {
    const [expanded, setExpanded] = useState(false);
    const cfg = STATUS_CONFIG[run.status] || STATUS_CONFIG.running;
    const Icon = cfg.icon;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group"
        >
            {/* Top status bar */}
            <div className={`h-0.5 w-full ${cfg.bar}`} />

            <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                    {/* Left: icon + info */}
                    <div className="flex items-start gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center"
                             style={{ background: cfg.glow + '12' }}>
                            <GitMerge size={18} style={{ color: cfg.glow }} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-black text-slate-900 truncate">{run.name || 'Pipeline Run'}</p>
                            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                <Clock3 size={10} />
                                {run.startedAt ? new Date(run.startedAt).toLocaleString() : '—'}
                            </p>
                            <div className="flex items-center flex-wrap gap-2 mt-2">
                                <span className="text-xs text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg font-medium">
                                    <Layers size={9} className="inline mr-1" />{run.nodeCount || 0} nodes
                                </span>
                                {duration(run) && (
                                    <span className="text-xs text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg font-medium">
                                        ⏱ {duration(run)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: badge + actions */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${cfg.badge}`}>
                            <Icon size={11} className={run.status === 'running' ? 'animate-spin' : ''} />
                            {cfg.label}
                        </span>
                        {run.logs?.length > 0 && (
                            <button
                                onClick={() => setExpanded(v => !v)}
                                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                                title="Toggle logs"
                            >
                                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                        )}
                        <button
                            onClick={() => onDelete(run.id)}
                            className="p-1.5 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all"
                            title="Delete run"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                {/* Expandable logs */}
                <AnimatePresence>
                    {expanded && run.logs?.length > 0 && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="mt-4 bg-slate-900 rounded-xl p-4">
                                <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">Execution Log</p>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {run.logs.map((log, i) => (
                                        <div key={i} className="flex flex-col font-mono text-xs">
                                            <span className={log.status === 'success' ? 'text-emerald-400' : 'text-red-400'}>
                                                [{(log.type || 'pipeline').toUpperCase()}] {log.status}
                                            </span>
                                            <span className="text-slate-400">{log.message || log.error}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Download link */}
                {run.outputFile && (
                    <div className="mt-3 pt-3 border-t border-slate-50">
                        <a href={run.outputFile} target="_blank" rel="noreferrer"
                           className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors">
                            <Download size={13} /> Download output
                        </a>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

export default function PipelineRuns() {
    const [runs, setRuns] = useState([]);
    const [statusFilter, setStatusFilter] = useState('all');

    const loadRuns = () => {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            setRuns(Array.isArray(saved) ? saved : []);
        } catch { setRuns([]); }
    };

    useEffect(() => { loadRuns(); }, []);

    const stats = useMemo(() => ({
        total:     runs.length,
        completed: runs.filter(r => r.status === 'completed').length,
        running:   runs.filter(r => r.status === 'running').length,
        failed:    runs.filter(r => r.status === 'failed').length,
    }), [runs]);

    const successRate = stats.total > 0
        ? Math.round((stats.completed / stats.total) * 100)
        : 0;

    const filtered = statusFilter === 'all'
        ? runs
        : runs.filter(r => r.status === statusFilter);

    const deleteRun = (id) => {
        const next = runs.filter(r => r.id !== id);
        setRuns(next);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    };

    const STAT_CARDS = [
        { label: 'Total Runs',   value: stats.total,     color: '#6366f1', bg: '#6366f115' },
        { label: 'Completed',    value: stats.completed,  color: '#10b981', bg: '#10b98115' },
        { label: 'Running',      value: stats.running,    color: '#f59e0b', bg: '#f59e0b15' },
        { label: 'Failed',       value: stats.failed,     color: '#ef4444', bg: '#ef444415' },
    ];

    const FILTERS = [
        { label: 'All', value: 'all' },
        { label: 'Completed', value: 'completed' },
        { label: 'Running', value: 'running' },
        { label: 'Failed', value: 'failed' },
    ];

    return (
        <div className="flex flex-col h-full w-full bg-slate-50">
            {/* ── Header ── */}
            <div className="shrink-0 bg-white border-b border-slate-100 px-8 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-lg shadow-slate-300">
                        <FolderClock size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-slate-900 leading-tight">Pipeline Runs</h1>
                        <p className="text-xs text-slate-400 font-medium">Track execution history for all orchestrated flows</p>
                    </div>
                </div>
                <button
                    onClick={loadRuns}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all shadow-sm hover:shadow"
                >
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8">
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* ── Stat Cards ── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {STAT_CARDS.map((s, i) => (
                            <motion.div
                                key={s.label}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4"
                            >
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                                     style={{ background: s.bg }}>
                                    <BarChart3 size={20} style={{ color: s.color }} />
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-slate-900 leading-none">{s.value}</p>
                                    <p className="text-xs text-slate-400 font-semibold mt-1">{s.label}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* ── Success rate bar ── */}
                    {stats.total > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-black text-slate-700">Overall Success Rate</p>
                                <span className="text-sm font-black" style={{ color: successRate >= 80 ? '#10b981' : successRate >= 50 ? '#f59e0b' : '#ef4444' }}>
                                    {successRate}%
                                </span>
                            </div>
                            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${successRate}%` }}
                                    transition={{ duration: 0.8, ease: 'easeOut' }}
                                    className="h-full rounded-full"
                                    style={{ background: successRate >= 80 ? '#10b981' : successRate >= 50 ? '#f59e0b' : '#ef4444' }}
                                />
                            </div>
                        </div>
                    )}

                    {/* ── Filter tabs + Run list ── */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        {/* Filter tabs */}
                        <div className="flex items-center gap-1 p-3 border-b border-slate-100 flex-wrap">
                            {FILTERS.map(f => {
                                const count = f.value === 'all' ? runs.length : runs.filter(r => r.status === f.value).length;
                                return (
                                    <button
                                        key={f.value}
                                        onClick={() => setStatusFilter(f.value)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${statusFilter === f.value ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                                    >
                                        {f.label}
                                        <span className={`px-1.5 py-0.5 rounded-full text-xs ${statusFilter === f.value ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-400'}`}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Runs */}
                        <div className="p-4">
                            {filtered.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
                                        <FolderClock size={28} className="text-slate-300" />
                                    </div>
                                    <p className="font-bold text-slate-600">No runs found</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {statusFilter === 'all'
                                            ? 'Run a pipeline to see execution history here'
                                            : `No ${statusFilter} runs to display`}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <AnimatePresence>
                                        {filtered.map((run, i) => (
                                            <RunCard key={run.id} run={run} onDelete={deleteRun} />
                                        ))}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
