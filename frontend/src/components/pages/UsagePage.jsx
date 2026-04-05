import React, { useMemo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    BarChart3, Database, ShieldCheck, Sparkles, GitMerge,
    Globe, Shuffle, Clock3, FolderClock, BarChart2,
    FileCheck, TrendingUp, Layers, Zap, CheckCircle2,
    AlertCircle, Calendar, Activity, RefreshCw, Hash, Info
} from 'lucide-react';

// ─── Storage keys matching existing features ─────────────────────────────────
const RUNS_KEY      = 'cleanflow_pipeline_runs_v1';
const SCHEDULES_KEY = 'cleanflow_pipeline_schedules_v1';
const HISTORY_KEY   = 'cleanflow_job_history';          // quality validation / cleaning jobs

// ─── Plan limits (Free Tier) ─────────────────────────────────────────────────
const PLAN = {
    name: 'Free',
    color: '#6366f1',
    filesLimit:    100,
    rowsLimit:     500_000,
    pipelineRuns:  25,
    schedules:     5,
    features: [
        { label: 'Quality Validation',  included: true  },
        { label: 'Data Cleaning',        included: true  },
        { label: 'Schema Mapping',       included: true  },
        { label: 'Web Scraping',         included: true  },
        { label: 'Data Matching',        included: true  },
        { label: 'AI Visualizer',        included: true  },
        { label: 'Pipeline Builder',     included: true  },
        { label: 'Pipeline Scheduler',   included: true  },
        { label: 'API Access',           included: false },
        { label: 'SSO / Team Access',    included: false },
    ],
};

// ─── Animated progress bar ────────────────────────────────────────────────────
function UsageBar({ used, limit, color = '#10b981' }) {
    const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
    const danger = pct >= 90;
    const warn   = pct >= 70;
    const fill   = danger ? '#ef4444' : warn ? '#f59e0b' : color;

    return (
        <div className="mt-2">
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ background: fill }}
                />
            </div>
            <div className="flex justify-between mt-1">
                <span className="text-xs font-bold" style={{ color: fill }}>
                    {pct.toFixed(1)}% used
                </span>
                <span className="text-xs text-slate-400">
                    {used.toLocaleString()} / {limit.toLocaleString()}
                </span>
            </div>
        </div>
    );
}

// ─── Stat tile ────────────────────────────────────────────────────────────────
function StatTile({ label, value, icon: Icon, color, bg, sub, delay = 0 }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4"
        >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
                <Icon size={22} style={{ color }} />
            </div>
            <div className="min-w-0">
                <p className="text-2xl font-black text-slate-900 leading-none">{value}</p>
                <p className="text-xs text-slate-400 font-semibold mt-1">{label}</p>
                {sub && <p className="text-xs text-slate-300 mt-0.5">{sub}</p>}
            </div>
        </motion.div>
    );
}

// ─── Feature usage row ────────────────────────────────────────────────────────
function FeatureRow({ icon: Icon, color, label, runs, lastUsed, delay }) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay }}
            className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0"
        >
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + '15' }}>
                    <Icon size={15} style={{ color }} />
                </div>
                <span className="text-sm font-bold text-slate-700">{label}</span>
            </div>
            <div className="flex items-center gap-4 text-right">
                <div>
                    <p className="text-sm font-black text-slate-900">{runs}</p>
                    <p className="text-xs text-slate-400">sessions</p>
                </div>
                <div className="text-xs text-slate-400 w-28 text-right hidden sm:block">
                    {lastUsed ? new Date(lastUsed).toLocaleDateString() : 'Not used'}
                </div>
            </div>
        </motion.div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function UsagePage({ user }) {
    const [refreshKey, setRefreshKey] = useState(0);

    const stats = useMemo(() => {
        // Pipeline runs
        let pipelineRuns = [];
        try { pipelineRuns = JSON.parse(localStorage.getItem(RUNS_KEY) || '[]'); } catch {}

        // Schedules
        let schedules = [];
        try { schedules = JSON.parse(localStorage.getItem(SCHEDULES_KEY) || '[]'); } catch {}

        // Job history (validation / cleaning)
        let jobHistory = [];
        try { jobHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch {}

        // Derive metrics
        const totalPipelineRuns   = pipelineRuns.length;
        const completedRuns       = pipelineRuns.filter(r => r.status === 'completed').length;
        const failedRuns          = pipelineRuns.filter(r => r.status === 'failed').length;
        const totalSchedules      = schedules.length;
        const activeSchedules     = schedules.filter(s => s.status === 'Active').length;

        const totalJobRows        = jobHistory.reduce((acc, j) => acc + (j.rowCount || j.rows || 0), 0);
        const totalFiles          = jobHistory.length + totalPipelineRuns;
        const successRate         = totalPipelineRuns > 0
            ? Math.round((completedRuns / totalPipelineRuns) * 100) : 0;

        // Feature usage from job history types
        const featureBreakdown = {
            validate:   { label: 'Quality Validation',  icon: ShieldCheck, color: '#3b82f6', runs: 0, lastUsed: null },
            clean:      { label: 'Data Cleaning',        icon: Sparkles,    color: '#10b981', runs: 0, lastUsed: null },
            mapper:     { label: 'Schema Mapping',       icon: GitMerge,    color: '#6366f1', runs: 0, lastUsed: null },
            scraper:    { label: 'Web Scraping',         icon: Globe,       color: '#f97316', runs: 0, lastUsed: null },
            matching:   { label: 'Data Matching',        icon: Shuffle,     color: '#8b5cf6', runs: 0, lastUsed: null },
            visualizer: { label: 'AI Visualizer',        icon: BarChart3,   color: '#ec4899', runs: 0, lastUsed: null },
            pipeline:   { label: 'Pipeline Builder',     icon: GitMerge,    color: '#0ea5e9', runs: totalPipelineRuns, lastUsed: pipelineRuns[0]?.startedAt || null },
        };

        jobHistory.forEach(job => {
            const type = job.feature || job.type || 'validate';
            if (featureBreakdown[type]) {
                featureBreakdown[type].runs++;
                const d = job.completedAt || job.createdAt || job.timestamp;
                if (d && (!featureBreakdown[type].lastUsed || d > featureBreakdown[type].lastUsed)) {
                    featureBreakdown[type].lastUsed = d;
                }
            }
        });

        // Recent activity (last 8 items merged)
        const activity = [
            ...pipelineRuns.slice(0, 5).map(r => ({
                label: r.name || 'Pipeline Run',
                type: 'pipeline',
                status: r.status,
                date: r.startedAt,
            })),
            ...jobHistory.slice(0, 5).map(j => ({
                label: j.filename || j.name || 'Job',
                type: j.feature || 'validate',
                status: j.status || 'completed',
                date: j.completedAt || j.createdAt,
            })),
        ]
        .filter(a => a.date)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 8);

        return {
            totalFiles, totalJobRows, totalPipelineRuns, completedRuns, failedRuns,
            totalSchedules, activeSchedules, successRate, featureBreakdown, activity,
        };
    }, [refreshKey]);

    const memberSince = user?.created_at
        ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : 'This session';

    const STATUS_CFG = {
        completed: { color: '#10b981', label: 'Done' },
        failed:    { color: '#ef4444', label: 'Failed' },
        running:   { color: '#f59e0b', label: 'Running' },
    };

    return (
        <div className="flex flex-col h-full w-full bg-slate-50">
            {/* ── Header ── */}
            <div className="shrink-0 bg-white border-b border-slate-100 px-8 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                        <Activity size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-slate-900 leading-tight">Usage & Resources</h1>
                        <p className="text-xs text-slate-400 font-medium">Your activity, data stats, and plan limits</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-xs font-bold text-indigo-600">
                        <Zap size={11} /> {PLAN.name} Plan
                    </div>
                    <button
                        onClick={() => setRefreshKey(k => k + 1)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-800 text-xs font-bold transition-all"
                    >
                        <RefreshCw size={12} /> Refresh
                    </button>
                </div>
            </div>

            {/* ── Scrollable content ── */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* ── Overview Stat Tiles ── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatTile label="Files Processed"   value={stats.totalFiles.toLocaleString()}     icon={Database}   color="#6366f1" bg="#6366f115" delay={0}    />
                        <StatTile label="Rows Processed"    value={stats.totalJobRows > 0 ? (stats.totalJobRows >= 1000 ? `${(stats.totalJobRows/1000).toFixed(1)}K` : stats.totalJobRows) : '—'} icon={Layers} color="#10b981" bg="#10b98115" delay={0.05} />
                        <StatTile label="Pipeline Runs"     value={stats.totalPipelineRuns}               icon={FolderClock} color="#f59e0b" bg="#f59e0b15" delay={0.1}  />
                        <StatTile label="Success Rate"      value={`${stats.successRate}%`}               icon={TrendingUp} color="#8b5cf6" bg="#8b5cf615" delay={0.15} sub={`${stats.completedRuns} completed`} />
                    </div>

                    {/* ── Main content grid ── */}
                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">

                        {/* Left column */}
                        <div className="space-y-6">

                            {/* ── Usage Limits ── */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="h-0.5 bg-gradient-to-r from-indigo-500 to-violet-500" />
                                <div className="p-6">
                                    <div className="flex items-center justify-between mb-5">
                                        <h2 className="text-base font-black text-slate-800">Plan Usage</h2>
                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                            <Info size={11} /> Resets monthly
                                        </span>
                                    </div>
                                    <div className="space-y-5">
                                        {[
                                            { label: 'Files Processed',  used: stats.totalFiles,          limit: PLAN.filesLimit,    color: '#6366f1', icon: Database    },
                                            { label: 'Rows Analyzed',    used: stats.totalJobRows,        limit: PLAN.rowsLimit,     color: '#10b981', icon: Hash        },
                                            { label: 'Pipeline Runs',    used: stats.totalPipelineRuns,   limit: PLAN.pipelineRuns,  color: '#f59e0b', icon: FolderClock },
                                            { label: 'Active Schedules', used: stats.activeSchedules,     limit: PLAN.schedules,     color: '#8b5cf6', icon: Clock3      },
                                        ].map((item, i) => (
                                            <motion.div key={item.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}>
                                                <div className="flex items-center gap-2">
                                                    <item.icon size={13} style={{ color: item.color }} />
                                                    <span className="text-sm font-bold text-slate-700">{item.label}</span>
                                                </div>
                                                <UsageBar used={item.used} limit={item.limit} color={item.color} />
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* ── Feature Breakdown ── */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                                <h2 className="text-base font-black text-slate-800 mb-4">Feature Usage</h2>
                                <div className="divide-y divide-slate-50">
                                    {Object.values(stats.featureBreakdown).map((feat, i) => (
                                        <FeatureRow
                                            key={feat.label}
                                            icon={feat.icon}
                                            color={feat.color}
                                            label={feat.label}
                                            runs={feat.runs}
                                            lastUsed={feat.lastUsed}
                                            delay={i * 0.04}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right column */}
                        <div className="space-y-6">

                            {/* ── Plan Card ── */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />
                                <div className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-base font-black text-slate-800">Your Plan</h2>
                                        <span className="text-xs font-black px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                                            {PLAN.name}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl mb-4">
                                        <div className="w-9 h-9 rounded-full bg-emerald-600 text-white text-sm font-black flex items-center justify-center shrink-0">
                                            {user?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900 truncate">{user?.full_name || 'My Account'}</p>
                                            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400 flex items-center gap-1 mb-5">
                                        <Calendar size={11} /> Member since {memberSince}
                                    </p>

                                    {/* Included features */}
                                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Features</h3>
                                    <div className="space-y-2">
                                        {PLAN.features.map(f => (
                                            <div key={f.label} className="flex items-center gap-2">
                                                {f.included
                                                    ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                                                    : <AlertCircle  size={13} className="text-slate-300 shrink-0" />}
                                                <span className={`text-xs font-semibold ${f.included ? 'text-slate-700' : 'text-slate-300'}`}>
                                                    {f.label}
                                                </span>
                                                {!f.included && (
                                                    <span className="ml-auto text-xs font-bold text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded-full">Pro</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* ── Recent Activity ── */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                                <h2 className="text-base font-black text-slate-800 mb-4">Recent Activity</h2>
                                {stats.activity.length === 0 ? (
                                    <div className="text-center py-10">
                                        <Activity size={24} className="text-slate-200 mx-auto mb-2" />
                                        <p className="text-sm text-slate-400">No activity yet</p>
                                        <p className="text-xs text-slate-300 mt-1">Start using a feature to see history</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {stats.activity.map((a, i) => {
                                            const cfg = STATUS_CFG[a.status] || STATUS_CFG.completed;
                                            return (
                                                <motion.div
                                                    key={i}
                                                    initial={{ opacity: 0, x: 8 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: i * 0.04 }}
                                                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
                                                >
                                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.color }} />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-bold text-slate-700 truncate">{a.label}</p>
                                                        <p className="text-xs text-slate-400">{a.date ? new Date(a.date).toLocaleString() : '—'}</p>
                                                    </div>
                                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0" style={{ color: cfg.color, background: cfg.color + '18' }}>
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

                    {/* ── Upgrade CTA (if approaching limits) ── */}
                    {(stats.totalPipelineRuns >= PLAN.pipelineRuns * 0.7 || stats.activeSchedules >= PLAN.schedules * 0.7) && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xl shadow-indigo-200"
                        >
                            <div>
                                <p className="font-black text-lg">Approaching your plan limits</p>
                                <p className="text-indigo-200 text-sm mt-1">Upgrade to Pro for unlimited runs, API access, and team collaboration.</p>
                            </div>
                            <button className="shrink-0 px-6 py-3 rounded-xl bg-white text-indigo-700 font-black text-sm hover:bg-indigo-50 transition-all shadow-lg">
                                Upgrade to Pro →
                            </button>
                        </motion.div>
                    )}

                </div>
            </div>
        </div>
    );
}
