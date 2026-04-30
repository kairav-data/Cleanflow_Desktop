import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertCircle,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Download,
    FolderClock,
    GitMerge,
    Layers,
    LoaderCircle,
    RefreshCw,
    Trash2,
} from 'lucide-react';
import { formatDateTimeInIST } from '../lib/utils';
import { API_BASE } from '../lib/runtimeConfig';
const Motion = motion;

const STATUS_CONFIG = {
    completed: {
        label: 'Completed',
        icon: CheckCircle2,
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        bar: 'bg-emerald-500',
        glow: '#10b981',
    },
    failed: {
        label: 'Failed',
        icon: AlertCircle,
        badge: 'bg-red-50 text-red-700 border-red-100',
        bar: 'bg-red-500',
        glow: '#ef4444',
    },
    running: {
        label: 'Running',
        icon: LoaderCircle,
        badge: 'bg-amber-50 text-amber-700 border-amber-100',
        bar: 'bg-amber-400',
        glow: '#f59e0b',
    },
};

const formatDuration = (run) => {
    if (typeof run.duration_seconds === 'number' && run.duration_seconds >= 0) {
        if (run.duration_seconds < 60) return `${run.duration_seconds.toFixed(1)}s`;
        return `${(run.duration_seconds / 60).toFixed(1)}m`;
    }
    if (!run.started_at) return null;
    const end = run.finished_at ? new Date(run.finished_at) : new Date();
    const started = new Date(run.started_at);
    if (Number.isNaN(end.getTime()) || Number.isNaN(started.getTime())) return null;
    const seconds = Math.max((end.getTime() - started.getTime()) / 1000, 0);
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    return `${(seconds / 60).toFixed(1)}m`;
};

const formatTimestamp = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return formatDateTimeInIST(value);
};

const toDownloadUrl = (outputFile) => {
    if (!outputFile) return null;
    const fileName = outputFile.split('/').pop().split('\\').pop();
    return fileName ? `${API_BASE}/download/${fileName}` : null;
};

function RunCard({ run, deleting, onDelete }) {
    const [expanded, setExpanded] = useState(false);
    const config = STATUS_CONFIG[run.status] || STATUS_CONFIG.running;
    const StatusIcon = config.icon;
    const downloadUrl = toDownloadUrl(run.output_file);

    return (
        <Motion.div
            layout
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
        >
            <div className={`h-0.5 w-full ${config.bar}`} />

            <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${config.glow}12` }}>
                            <GitMerge size={18} style={{ color: config.glow }} />
                        </div>
                        <div className="min-w-0">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-black text-slate-900">{run.pipeline_name || 'Pipeline Run'}</p>
                                <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                    {run.trigger || 'manual'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">Started: {formatTimestamp(run.started_at)}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
                                    <Layers size={9} className="mr-1 inline" /> {run.node_count || 0} nodes
                                </span>
                                {formatDuration(run) ? (
                                    <span className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
                                        {formatDuration(run)}
                                    </span>
                                ) : null}
                            </div>
                            {run.error_message ? (
                                <p className="mt-2 line-clamp-2 text-xs text-red-500">{run.error_message}</p>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-bold ${config.badge}`}>
                            <StatusIcon size={11} className={run.status === 'running' ? 'animate-spin' : ''} />
                            {config.label}
                        </span>
                        {run.logs?.length > 0 ? (
                            <button
                                onClick={() => setExpanded((current) => !current)}
                                className="rounded-xl p-1.5 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700"
                                title="Toggle logs"
                            >
                                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                        ) : null}
                        <button
                            onClick={() => onDelete(run.id)}
                            disabled={deleting}
                            className="rounded-xl border border-transparent p-1.5 text-slate-300 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Delete run"
                        >
                            {deleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                    </div>
                </div>

                <AnimatePresence>
                    {expanded && run.logs?.length > 0 ? (
                        <Motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="mt-4 rounded-xl bg-slate-900 p-4">
                                <p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">Execution Log</p>
                                <div className="max-h-40 space-y-2 overflow-y-auto">
                                    {run.logs.map((log, index) => (
                                        <div key={`${run.id}-log-${index}`} className="flex flex-col font-mono text-xs">
                                            <span className={log.status === 'success' ? 'text-emerald-400' : log.status === 'skipped' ? 'text-amber-300' : 'text-red-400'}>
                                                [{(log.type || 'pipeline').toUpperCase()}] {log.status}
                                            </span>
                                            <span className="text-slate-400">{log.message || log.error}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Motion.div>
                    ) : null}
                </AnimatePresence>

                {downloadUrl ? (
                    <div className="mt-3 border-t border-slate-50 pt-3">
                        <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 transition-colors hover:text-emerald-700"
                        >
                            <Download size={13} /> Download output
                        </a>
                    </div>
                ) : null}
            </div>
        </Motion.div>
    );
}

export default function PipelineRuns() {
    const [runs, setRuns] = useState([]);
    const [statusFilter, setStatusFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [deletingRunId, setDeletingRunId] = useState('');

    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const loadRuns = async ({ silent = false } = {}) => {
        if (!token) {
            setErrorMessage('Sign in to review pipeline runs.');
            setLoading(false);
            return;
        }

        if (silent) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setErrorMessage('');

        try {
            const response = await axios.get(`${API_BASE}/pipeline/runs`, { headers });
            setRuns(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            setErrorMessage(error.response?.data?.detail || 'Failed to load pipeline runs.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadRuns();
    }, []);

    const stats = useMemo(() => ({
        total: runs.length,
        completed: runs.filter((run) => run.status === 'completed').length,
        running: runs.filter((run) => run.status === 'running').length,
        failed: runs.filter((run) => run.status === 'failed').length,
    }), [runs]);

    const successRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

    const filteredRuns = statusFilter === 'all'
        ? runs
        : runs.filter((run) => run.status === statusFilter);

    const deleteRun = async (runId) => {
        setDeletingRunId(runId);
        setErrorMessage('');
        try {
            await axios.delete(`${API_BASE}/pipeline/runs/${runId}`, { headers });
            setRuns((current) => current.filter((run) => run.id !== runId));
        } catch (error) {
            setErrorMessage(error.response?.data?.detail || 'Failed to delete pipeline run.');
        } finally {
            setDeletingRunId('');
        }
    };

    const statCards = [
        { label: 'Total Runs', value: stats.total, color: '#6366f1', bg: '#6366f115' },
        { label: 'Completed', value: stats.completed, color: '#10b981', bg: '#10b98115' },
        { label: 'Running', value: stats.running, color: '#f59e0b', bg: '#f59e0b15' },
        { label: 'Failed', value: stats.failed, color: '#ef4444', bg: '#ef444415' },
    ];

    const filters = [
        { label: 'All', value: 'all' },
        { label: 'Completed', value: 'completed' },
        { label: 'Running', value: 'running' },
        { label: 'Failed', value: 'failed' },
    ];

    return (
        <div className="flex h-full w-full flex-col bg-slate-50">
            <div className="shrink-0 border-b border-slate-100 bg-white px-8 py-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 shadow-lg shadow-slate-300">
                            <FolderClock size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black leading-tight text-slate-900">Pipeline Runs</h1>
                            <p className="text-xs font-medium text-slate-400">Track backend execution history for manual and scheduled pipelines</p>
                        </div>
                    </div>

                    <button
                        onClick={() => loadRuns({ silent: true })}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
                    >
                        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8">
                <div className="mx-auto max-w-7xl space-y-6">
                    {errorMessage ? (
                        <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">
                            {errorMessage}
                        </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        {statCards.map((card) => (
                            <Motion.div
                                key={card.label}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                            >
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: card.bg }}>
                                    <FolderClock size={20} style={{ color: card.color }} />
                                </div>
                                <div>
                                    <p className="text-2xl font-black leading-none text-slate-900">{card.value}</p>
                                    <p className="mt-1 text-xs font-semibold text-slate-400">{card.label}</p>
                                </div>
                            </Motion.div>
                        ))}
                    </div>

                    {stats.total > 0 ? (
                        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                            <div className="mb-3 flex items-center justify-between">
                                <p className="text-sm font-black text-slate-700">Overall Success Rate</p>
                                <span
                                    className="text-sm font-black"
                                    style={{ color: successRate >= 80 ? '#10b981' : successRate >= 50 ? '#f59e0b' : '#ef4444' }}
                                >
                                    {successRate}%
                                </span>
                            </div>
                            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                                <Motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${successRate}%` }}
                                    transition={{ duration: 0.8, ease: 'easeOut' }}
                                    className="h-full rounded-full"
                                    style={{ background: successRate >= 80 ? '#10b981' : successRate >= 50 ? '#f59e0b' : '#ef4444' }}
                                />
                            </div>
                        </div>
                    ) : null}

                    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                        <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 p-3">
                            {filters.map((filter) => {
                                const count = filter.value === 'all' ? runs.length : runs.filter((run) => run.status === filter.value).length;
                                return (
                                    <button
                                        key={filter.value}
                                        onClick={() => setStatusFilter(filter.value)}
                                        className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                                            statusFilter === filter.value ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                        }`}
                                    >
                                        {filter.label}
                                        <span className={`rounded-full px-1.5 py-0.5 text-xs ${statusFilter === filter.value ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-400'}`}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="p-4">
                            {loading ? (
                                <div className="py-20 text-center">
                                    <RefreshCw size={18} className="mx-auto animate-spin text-slate-400" />
                                    <p className="mt-3 text-sm font-medium text-slate-500">Loading run history...</p>
                                </div>
                            ) : filteredRuns.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50">
                                        <FolderClock size={28} className="text-slate-300" />
                                    </div>
                                    <p className="font-bold text-slate-600">No runs found</p>
                                    <p className="mt-1 text-xs text-slate-400">
                                        {statusFilter === 'all'
                                            ? 'Run a pipeline or wait for a schedule to fire to see history here.'
                                            : `No ${statusFilter} runs to display.`}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <AnimatePresence>
                                        {filteredRuns.map((run) => (
                                            <RunCard
                                                key={run.id}
                                                run={run}
                                                deleting={deletingRunId === run.id}
                                                onDelete={deleteRun}
                                            />
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
