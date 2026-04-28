import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Loader2, Database, AlertCircle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';

const TONE_STYLES = {
    blue: {
        icon: 'bg-blue-50 text-blue-600 border-blue-100',
        badge: 'bg-blue-50 text-blue-700 border-blue-100',
        hover: 'hover:bg-blue-50/55',
        refresh: 'hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700',
    },
    emerald: {
        icon: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        hover: 'hover:bg-emerald-50/55',
        refresh: 'hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700',
    },
    violet: {
        icon: 'bg-violet-50 text-violet-600 border-violet-100',
        badge: 'bg-violet-50 text-violet-700 border-violet-100',
        hover: 'hover:bg-violet-50/55',
        refresh: 'hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700',
    },
    indigo: {
        icon: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        badge: 'bg-indigo-50 text-indigo-700 border-indigo-100',
        hover: 'hover:bg-indigo-50/55',
        refresh: 'hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700',
    },
};

const formatDatasetLabel = (value) => {
    if (!value) return null;
    return value
        .replace(/_/g, ' ')
        .replace(/dataset\s*(\d+)/i, 'Dataset $1')
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatCellValue = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};

export default function DatasetViewer({
    sessionId,
    datasetId = null,
    title = 'Dataset Preview',
    subtitle = null,
    tone = 'indigo',
    limit = 25,
    className = '',
    emptyTitle = 'No data available to preview.',
    emptyHint = 'The dataset may be empty, still loading, or the session may have expired.',
}) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const styles = TONE_STYLES[tone] || TONE_STYLES.indigo;

    const fetchData = useCallback(async () => {
        if (!sessionId) return;

        setLoading(true);
        setError(null);

        try {
            const url = new URL(`${API_BASE}/dataset/${sessionId}/preview`);
            url.searchParams.append('limit', String(limit));
            if (datasetId) {
                url.searchParams.append('dataset_id', datasetId);
            }

            const res = await axios.get(url.toString());
            setData(res.data.data || []);
        } catch (e) {
            setError(e.response?.data?.detail || 'Failed to load dataset preview.');
        } finally {
            setLoading(false);
        }
    }, [datasetId, limit, sessionId]);

    useEffect(() => {
        if (!sessionId) {
            setData([]);
            setError(null);
            return;
        }
        fetchData();
    }, [fetchData, sessionId]);

    const columns = Object.keys(data[0] || {});
    const resolvedSubtitle = subtitle || `Previewing the first ${data.length} rows loaded into this workspace.`;
    const datasetBadge = formatDatasetLabel(datasetId);

    if (loading) {
        return (
            <div className={`flex min-h-[380px] flex-col items-center justify-center gap-4 rounded-3xl border border-[var(--border-soft)] bg-[var(--panel)] p-12 shadow-sm ${className}`}>
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${styles.icon}`}>
                    <Loader2 className="h-5 w-5 animate-spin" />
                </div>
                <div className="text-center">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Loading dataset preview</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">Fetching rows from your current session.</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`flex min-h-[380px] flex-col items-center justify-center gap-4 rounded-3xl border border-red-200 bg-[var(--panel)] p-12 shadow-sm ${className}`}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-red-500">
                    <AlertCircle className="h-5 w-5" />
                </div>
                <div className="max-w-md text-center">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Dataset preview unavailable</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{error}</p>
                </div>
                <button
                    onClick={fetchData}
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--panel)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--panel-muted)]"
                >
                    <RefreshCw size={14} /> Retry
                </button>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className={`flex min-h-[380px] flex-col items-center justify-center gap-4 rounded-3xl border border-[var(--border-soft)] bg-[var(--panel)] p-12 shadow-sm ${className}`}>
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${styles.icon}`}>
                    <Database className="h-5 w-5" />
                </div>
                <div className="max-w-md text-center">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{emptyTitle}</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{emptyHint}</p>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex max-h-[620px] flex-col overflow-hidden rounded-3xl border border-[var(--border-soft)] bg-[var(--panel)] shadow-sm ${className}`}
        >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-soft)] px-5 py-4">
                <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${styles.icon}`}>
                        <Database size={18} />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
                            {datasetBadge && (
                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${styles.badge}`}>
                                    {datasetBadge}
                                </span>
                            )}
                        </div>
                        <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">{resolvedSubtitle}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[var(--border-soft)] bg-[var(--panel-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                        {data.length} rows
                    </span>
                    <span className="rounded-full border border-[var(--border-soft)] bg-[var(--panel-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                        {columns.length} columns
                    </span>
                    <button
                        onClick={fetchData}
                        className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--border-soft)] bg-[var(--panel)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] transition-colors ${styles.refresh}`}
                    >
                        <RefreshCw size={12} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="min-w-max w-full border-collapse text-left">
                    <thead className="sticky top-0 z-10 bg-[var(--panel-muted)]/95 backdrop-blur-sm">
                        <tr>
                            <th className="w-12 border-b border-[var(--border-soft)] bg-[var(--panel-muted)]/70 px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                                #
                            </th>
                            {columns.map((column) => (
                                <th
                                    key={column}
                                    className="border-b border-[var(--border-soft)] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]"
                                >
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-soft)]">
                        {data.map((row, index) => (
                            <tr key={index} className={`group transition-colors ${styles.hover}`}>
                                <td className="border-r border-[var(--border-soft)] bg-[var(--panel-muted)]/70 px-4 py-3 text-center text-xs font-semibold text-[var(--text-muted)] transition-colors group-hover:bg-transparent">
                                    {index + 1}
                                </td>
                                {columns.map((column) => {
                                    const value = formatCellValue(row[column]);
                                    return (
                                        <td
                                            key={column}
                                            title={value}
                                            className="px-4 py-3 text-[13px] font-medium text-[var(--text-primary)]"
                                        >
                                            <div className="max-w-[320px] truncate">{value}</div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
}
