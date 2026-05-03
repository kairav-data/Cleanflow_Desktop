import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
    Activity, BarChart3, ShieldCheck, Sparkles, GitMerge,
    Globe, Shuffle, TrendingUp, Clock3, FolderClock,
    Layers, Zap, CheckCircle2, AlertCircle, Calendar,
    RefreshCw, Hash, ArrowUpRight, Award, Target,
    Database, FileText, Users, Cpu
} from 'lucide-react';
import { API_BASE } from '../../lib/runtimeConfig';

// ── Feature config ───────────────────────────────────────────────────────────
const FEATURES = [
    { key: 'validation',  label: 'Quality Validation',      icon: ShieldCheck,  color: '#3b82f6', bg: '#eff6ff' },
    { key: 'enrichment',  label: 'Data Cleaning',           icon: Sparkles,     color: '#10b981', bg: '#ecfdf5' },
    { key: 'mapper',      label: 'Schema Mapping',          icon: GitMerge,     color: '#6366f1', bg: '#eef2ff' },
    { key: 'scraper',     label: 'Web Scraping',            icon: Globe,        color: '#f97316', bg: '#fff7ed' },
    { key: 'matching',    label: 'Data Matching',           icon: Shuffle,      color: '#8b5cf6', bg: '#f5f3ff' },
    { key: 'pricing',     label: 'Pricing Intelligence',    icon: TrendingUp,   color: '#d97706', bg: '#fffbeb' },
    { key: 'pipeline',    label: 'Pipeline Builder',        icon: FolderClock,  color: '#0ea5e9', bg: '#f0f9ff' },
];

const PLAN = {
    name: 'Free',
    filesLimit: 100,
    rowsLimit: 500_000,
    pipelineRuns: 25,
    schedules: 5,
};

// ── Sub-components ────────────────────────────────────────────────────────────
function AnimatedNumber({ value }) {
    return <span>{typeof value === 'number' ? value.toLocaleString() : value}</span>;
}

function GlowBar({ pct, color }) {
    const danger = pct >= 90, warn = pct >= 70;
    const fill = danger ? '#ef4444' : warn ? '#f59e0b' : color;
    return (
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(pct, 100)}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${fill}cc, ${fill})`, boxShadow: `0 0 8px ${fill}55` }}
            />
        </div>
    );
}

function KpiCard({ icon: Icon, label, value, sub, color, bg, delay = 0 }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
            className="relative overflow-hidden bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4 group hover:shadow-md transition-shadow"
        >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `radial-gradient(circle at top left, ${bg}, transparent 70%)` }} />
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 relative" style={{ background: bg }}>
                <Icon size={22} style={{ color }} />
            </div>
            <div className="min-w-0 relative">
                <p className="text-2xl font-black text-slate-900 leading-none"><AnimatedNumber value={value} /></p>
                <p className="text-xs text-slate-500 font-semibold mt-1">{label}</p>
                {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
            </div>
        </motion.div>
    );
}

function FeatureCard({ feat, runs, lastUsed, totalRuns, delay }) {
    const pct = totalRuns > 0 ? Math.round((runs / totalRuns) * 100) : 0;
    const used = runs > 0;
    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay }}
            className="group flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm transition-all"
        >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                style={{ background: feat.bg }}>
                <feat.icon size={18} style={{ color: feat.color }} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold text-slate-800">{feat.label}</span>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-black" style={{ color: feat.color }}>{runs}</span>
                        <span className="text-xs text-slate-400">sessions</span>
                    </div>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: delay + 0.2 }}
                        className="h-full rounded-full"
                        style={{ background: feat.color }}
                    />
                </div>
                <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-slate-400">{pct}% of total usage</span>
                    <span className="text-[10px] font-semibold" style={{ color: used ? feat.color : '#94a3b8' }}>
                        {used ? (lastUsed ? new Date(lastUsed).toLocaleDateString() : 'Used') : 'Not used'}
                    </span>
                </div>
            </div>
            {used && (
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: feat.color, boxShadow: `0 0 6px ${feat.color}` }} />
            )}
        </motion.div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function UsagePage({ user }) {
    const [loading, setLoading] = useState(true);
    const [jobs, setJobs] = useState([]);
    const [pipelineRuns, setPipelineRuns] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { setLoading(false); return; }
        const h = { Authorization: `Bearer ${token}` };
        setLoading(true);
        Promise.all([
            axios.get(`${API_BASE}/history/jobs`, { headers: h }).then(r => r.data).catch(() => []),
            axios.get(`${API_BASE}/pipeline/runs`, { headers: h }).then(r => r.data).catch(() => []),
            axios.get(`${API_BASE}/pipeline/schedules`, { headers: h }).then(r => r.data).catch(() => []),
        ]).then(([j, pr, sc]) => {
            setJobs(j || []);
            setPipelineRuns(pr || []);
            setSchedules(sc || []);
        }).finally(() => setLoading(false));
    }, [refreshKey]);

    const stats = useMemo(() => {
        // Feature breakdown from history jobs
        const featureMap = {};
        FEATURES.forEach(f => { featureMap[f.key] = { runs: 0, lastUsed: null, totalRows: 0 }; });

        jobs.forEach(job => {
            const key = job.module || 'validation';
            if (!featureMap[key]) featureMap[key] = { runs: 0, lastUsed: null, totalRows: 0 };
            featureMap[key].runs++;
            featureMap[key].totalRows += (job.total_rows || 0);
            const d = job.created_at;
            if (d && (!featureMap[key].lastUsed || d > featureMap[key].lastUsed)) featureMap[key].lastUsed = d;
        });

        // Pipeline runs contribute to pipeline feature
        if (pipelineRuns.length > 0) {
            featureMap['pipeline'] = featureMap['pipeline'] || { runs: 0, lastUsed: null, totalRows: 0 };
            featureMap['pipeline'].runs += pipelineRuns.length;
            const latest = pipelineRuns.reduce((a, b) => (a.started_at > b.started_at ? a : b), pipelineRuns[0]);
            if (latest?.started_at) featureMap['pipeline'].lastUsed = latest.started_at;
        }

        const totalSessions = Object.values(featureMap).reduce((s, f) => s + f.runs, 0);
        const totalRows = jobs.reduce((s, j) => s + (j.total_rows || 0), 0);
        const totalFiles = jobs.length;
        const completedRuns = pipelineRuns.filter(r => r.status === 'completed').length;
        const failedRuns = pipelineRuns.filter(r => r.status === 'failed').length;
        const successRate = pipelineRuns.length > 0 ? Math.round((completedRuns / pipelineRuns.length) * 100) : 100;
        const activeSchedules = schedules.filter(s => s.is_active).length;

        // Recent activity
        const activity = [
            ...pipelineRuns.slice(0, 5).map(r => ({
                label: r.pipeline_name || 'Pipeline Run', type: 'pipeline',
                status: r.status || 'completed', date: r.started_at,
            })),
            ...jobs.slice(0, 8).map(j => ({
                label: j.file_name || j.filename || 'Job', type: j.module || 'validation',
                status: 'completed', date: j.created_at,
            })),
        ].filter(a => a.date).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

        return { featureMap, totalSessions, totalRows, totalFiles, completedRuns, failedRuns, successRate, activeSchedules, activity };
    }, [jobs, pipelineRuns, schedules]);

    const memberSince = user?.created_at
        ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : 'This session';

    const STATUS_CFG = {
        completed: { color: '#10b981', bg: '#d1fae5', label: 'Completed' },
        failed:    { color: '#ef4444', bg: '#fee2e2', label: 'Failed' },
        running:   { color: '#f59e0b', bg: '#fef3c7', label: 'Running' },
    };

    const featuresUsed = FEATURES.filter(f => (stats.featureMap[f.key]?.runs || 0) > 0).length;

    return (
        <div className="flex flex-col h-full w-full bg-gradient-to-br from-slate-50 to-slate-100/50">
            {/* ── Header ── */}
            <div className="shrink-0 bg-white/80 backdrop-blur-sm border-b border-slate-100 px-8 py-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-200">
                        <Activity size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-slate-900 leading-tight">Usage & Resources</h1>
                        <p className="text-xs text-slate-500 font-medium">Real-time activity, data stats, and plan limits</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100 text-xs font-bold text-violet-600">
                        <Zap size={11} />{PLAN.name} Plan · {featuresUsed}/{FEATURES.length} features active
                    </div>
                    <button
                        onClick={() => setRefreshKey(k => k + 1)}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:border-violet-300 hover:text-violet-600 text-xs font-bold transition-all"
                    >
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* ── Content ── */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* KPI Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <KpiCard label="Total Sessions"     value={stats.totalSessions}    icon={Activity}    color="#6366f1" bg="#eef2ff" delay={0}    />
                        <KpiCard label="Rows Processed"     value={stats.totalRows >= 1000 ? `${(stats.totalRows/1000).toFixed(1)}K` : stats.totalRows || 0} icon={Layers} color="#10b981" bg="#ecfdf5" delay={0.05} />
                        <KpiCard label="Pipeline Runs"      value={pipelineRuns.length}    icon={FolderClock} color="#f59e0b" bg="#fffbeb" delay={0.1}  />
                        <KpiCard label="Success Rate"       value={`${stats.successRate}%`} icon={Target}     color="#8b5cf6" bg="#f5f3ff" delay={0.15} sub={`${stats.completedRuns} completed`} />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">

                        {/* LEFT */}
                        <div className="space-y-6">

                            {/* Plan Usage */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="h-0.5 bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500" />
                                <div className="p-6">
                                    <div className="flex items-center justify-between mb-5">
                                        <h2 className="text-base font-black text-slate-900">Plan Limits</h2>
                                        <span className="text-xs text-slate-400 flex items-center gap-1"><Clock3 size={11} />Resets monthly</span>
                                    </div>
                                    <div className="space-y-5">
                                        {[
                                            { label: 'Files Processed',  used: stats.totalFiles,       limit: PLAN.filesLimit,    color: '#6366f1', icon: FileText    },
                                            { label: 'Rows Analyzed',    used: stats.totalRows,        limit: PLAN.rowsLimit,     color: '#10b981', icon: Hash        },
                                            { label: 'Pipeline Runs',    used: pipelineRuns.length,    limit: PLAN.pipelineRuns,  color: '#f59e0b', icon: FolderClock },
                                            { label: 'Active Schedules', used: stats.activeSchedules,  limit: PLAN.schedules,     color: '#8b5cf6', icon: Clock3      },
                                        ].map((item, i) => {
                                            const pct = item.limit > 0 ? Math.min((item.used / item.limit) * 100, 100) : 0;
                                            return (
                                                <motion.div key={item.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <item.icon size={13} style={{ color: item.color }} />
                                                            <span className="text-sm font-bold text-slate-700">{item.label}</span>
                                                        </div>
                                                        <span className="text-xs font-black" style={{ color: item.color }}>
                                                            {item.used.toLocaleString()} <span className="text-slate-400 font-medium">/ {item.limit.toLocaleString()}</span>
                                                        </span>
                                                    </div>
                                                    <GlowBar pct={pct} color={item.color} />
                                                    <p className="text-right text-[10px] text-slate-400 mt-1">{pct.toFixed(1)}% used</p>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Feature Usage */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                                <div className="flex items-center justify-between mb-5">
                                    <h2 className="text-base font-black text-slate-900">Feature Usage</h2>
                                    <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                                        {featuresUsed} / {FEATURES.length} active
                                    </span>
                                </div>
                                {loading ? (
                                    <div className="flex items-center justify-center py-12 text-slate-400">
                                        <RefreshCw size={24} className="animate-spin mr-3" />Loading real data…
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {FEATURES.map((feat, i) => {
                                            const data = stats.featureMap[feat.key] || { runs: 0, lastUsed: null };
                                            return (
                                                <FeatureCard
                                                    key={feat.key}
                                                    feat={feat}
                                                    runs={data.runs}
                                                    lastUsed={data.lastUsed}
                                                    totalRuns={stats.totalSessions}
                                                    delay={i * 0.05}
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT */}
                        <div className="space-y-6">

                            {/* Plan Card */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500" />
                                <div className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-base font-black text-slate-900">Your Plan</h2>
                                        <span className="text-xs font-black px-2.5 py-1 rounded-full bg-violet-50 text-violet-600 border border-violet-100">{PLAN.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl mb-4 border border-slate-100">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-sm font-black flex items-center justify-center shrink-0 shadow-lg shadow-violet-200">
                                            {user?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900 truncate">{user?.full_name || 'My Account'}</p>
                                            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mb-5">
                                        <Calendar size={11} className="text-violet-400" /> Member since {memberSince}
                                    </p>
                                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Included Features</h3>
                                    <div className="space-y-2">
                                        {[
                                            { label: 'Quality Validation',   ok: true },
                                            { label: 'Data Cleaning',        ok: true },
                                            { label: 'Schema Mapping',       ok: true },
                                            { label: 'Web Scraping',         ok: true },
                                            { label: 'Data Matching',        ok: true },
                                            { label: 'AI Visualizer',        ok: true },
                                            { label: 'Pipeline Builder',     ok: true },
                                            { label: 'API Access',           ok: false },
                                            { label: 'SSO / Team Access',    ok: false },
                                        ].map(f => (
                                            <div key={f.label} className="flex items-center gap-2">
                                                {f.ok
                                                    ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                                                    : <AlertCircle  size={13} className="text-slate-300 shrink-0" />}
                                                <span className={`text-xs font-semibold ${f.ok ? 'text-slate-700' : 'text-slate-300'}`}>{f.label}</span>
                                                {!f.ok && <span className="ml-auto text-[10px] font-bold text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded-full border border-violet-100">Pro</span>}
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => window.open('https://cleanflow.one', '_blank')}
                                        className="w-full mt-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-black flex items-center justify-center gap-2 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-200 transition-all"
                                    >
                                        <Zap size={13} /> Upgrade to Pro <ArrowUpRight size={13} />
                                    </button>
                                </div>
                            </div>

                            {/* Recent Activity */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                                <h2 className="text-base font-black text-slate-900 mb-4">Recent Activity</h2>
                                {loading ? (
                                    <div className="flex items-center justify-center py-8 text-slate-400 text-sm">
                                        <RefreshCw size={18} className="animate-spin mr-2" />Loading…
                                    </div>
                                ) : stats.activity.length === 0 ? (
                                    <div className="text-center py-10">
                                        <Activity size={28} className="text-slate-200 mx-auto mb-3" />
                                        <p className="text-sm font-bold text-slate-500">No activity yet</p>
                                        <p className="text-xs text-slate-400 mt-1">Start using a feature to see history here</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {stats.activity.map((a, i) => {
                                            const feat = FEATURES.find(f => f.key === a.type);
                                            const cfg = STATUS_CFG[a.status] || STATUS_CFG.completed;
                                            return (
                                                <motion.div
                                                    key={i}
                                                    initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                                                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                                                >
                                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: feat?.bg || '#f1f5f9' }}>
                                                        {feat ? <feat.icon size={13} style={{ color: feat.color }} /> : <Activity size={13} className="text-slate-400" />}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-bold text-slate-800 truncate">{a.label}</p>
                                                        <p className="text-[10px] text-slate-400">{a.date ? new Date(a.date).toLocaleString() : '—'}</p>
                                                    </div>
                                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full shrink-0" style={{ color: cfg.color, background: cfg.bg }}>
                                                        {cfg.label}
                                                    </span>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Summary insight bar */}
                    {!loading && stats.totalSessions > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-[#0a1220] to-slate-900 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border border-slate-800"
                        >
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute -top-10 left-1/4 w-64 h-64 bg-violet-600/20 rounded-full blur-[80px]" />
                                <div className="absolute -bottom-10 right-1/4 w-64 h-64 bg-indigo-600/20 rounded-full blur-[80px]" />
                            </div>
                            <div className="relative">
                                <p className="font-black text-white text-lg">You've processed <span className="text-violet-400">{stats.totalRows.toLocaleString()}</span> rows across <span className="text-emerald-400">{featuresUsed}</span> features</p>
                                <p className="text-slate-400 text-sm mt-1">Upgrade to Pro for unlimited runs, API access, and team collaboration.</p>
                            </div>
                            <button
                                onClick={() => window.open('https://cleanflow.one', '_blank')}
                                className="relative shrink-0 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black text-sm hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-500/30 transition-all flex items-center gap-2"
                            >
                                <Zap size={14} /> Upgrade to Pro
                            </button>
                        </motion.div>
                    )}

                </div>
            </div>
        </div>
    );
}
