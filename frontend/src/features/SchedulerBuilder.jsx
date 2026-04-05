import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Trash2, Settings, Clock3, Calendar, Play, Pause,
    Zap, ChevronRight, AlertCircle, CheckCircle2, ToggleLeft,
    ToggleRight, GitMerge, BarChart3, RefreshCw
} from 'lucide-react';

const STORAGE_KEY = 'cleanflow_pipeline_schedules_v1';

const FREQUENCIES = [
    { label: 'Hourly', value: 'Hourly', desc: 'Every 60 min', color: '#6366f1' },
    { label: 'Daily',  value: 'Daily',  desc: 'Once a day',   color: '#10b981' },
    { label: 'Weekly', value: 'Weekly', desc: 'Once a week',  color: '#f59e0b' },
    { label: 'Monthly',value: 'Monthly',desc: 'Once a month', color: '#8b5cf6' },
];

const DEFAULT_SCHEDULE = {
    id: '', name: '', pipelineName: '',
    frequency: 'Daily', runTime: '09:00',
    status: 'Active', notes: '',
};

function FreqBadge({ freq }) {
    const f = FREQUENCIES.find(x => x.value === freq) || FREQUENCIES[1];
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ color: f.color, background: f.color + '18', border: `1px solid ${f.color}30` }}>
            <Clock3 size={9} /> {f.label}
        </span>
    );
}

export default function SchedulerBuilder() {
    const [schedules, setSchedules] = useState([]);
    const [draft, setDraft] = useState(DEFAULT_SCHEDULE);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            setSchedules(Array.isArray(saved) ? saved : []);
        } catch { setSchedules([]); }
    }, []);

    const persist = (next) => {
        setSchedules(next);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    };

    const validate = () => {
        const e = {};
        if (!draft.name.trim())         e.name = 'Schedule name is required';
        if (!draft.pipelineName.trim()) e.pipelineName = 'Pipeline name is required';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleCreate = () => {
        if (!validate()) return;
        setSaving(true);
        setTimeout(() => {
            persist([
                { ...draft, id: `sched_${Date.now()}`, createdAt: new Date().toISOString(), lastRun: null },
                ...schedules,
            ]);
            setDraft(DEFAULT_SCHEDULE);
            setErrors({});
            setSaving(false);
        }, 400);
    };

    const toggleStatus = (id) =>
        persist(schedules.map(s => s.id === id ? { ...s, status: s.status === 'Active' ? 'Paused' : 'Active' } : s));

    const removeSchedule = (id) => persist(schedules.filter(s => s.id !== id));

    const active  = schedules.filter(s => s.status === 'Active').length;
    const paused  = schedules.filter(s => s.status === 'Paused').length;

    const field = (label, key, element, err) => (
        <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</label>
            <div className="mt-2">{element}</div>
            {err && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} />{err}</p>}
        </div>
    );

    const inputCls = (err) =>
        `w-full p-3 border rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 ${err ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300'}`;

    return (
        <div className="flex flex-col h-full w-full bg-slate-50">
            {/* ── Header ── */}
            <div className="shrink-0 bg-white border-b border-slate-100 px-8 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                        <Clock3 size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-slate-900 leading-tight">Pipeline Scheduler</h1>
                        <p className="text-xs text-slate-400 font-medium">Plan recurring runs for your orchestrated workflows</p>
                    </div>
                </div>
                {/* Summary pills */}
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> {active} Active
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        {paused} Paused
                    </span>
                </div>
            </div>

            {/* ── Content ── */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
                <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-6 max-w-7xl mx-auto">

                    {/* ── Create Panel ── */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        {/* Accent bar */}
                        <div className="h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                                    <Settings size={18} className="text-indigo-600" />
                                </div>
                                <div>
                                    <h2 className="text-base font-black text-slate-900">New Schedule</h2>
                                    <p className="text-xs text-slate-400">Configure a recurring pipeline trigger</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {field('Schedule Name',
                                    'name',
                                    <input className={inputCls(errors.name)} placeholder="e.g. Morning Data Sync"
                                        value={draft.name} onChange={e => { setDraft(p => ({...p, name: e.target.value})); setErrors(p => ({...p, name:''})); }} />,
                                    errors.name
                                )}
                                {field('Pipeline Name',
                                    'pipeline',
                                    <input className={inputCls(errors.pipelineName)} placeholder="e.g. Customer Quality Pipeline"
                                        value={draft.pipelineName} onChange={e => { setDraft(p => ({...p, pipelineName: e.target.value})); setErrors(p => ({...p, pipelineName:''})); }} />,
                                    errors.pipelineName
                                )}

                                {/* Frequency selector */}
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-500">Frequency</label>
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        {FREQUENCIES.map(f => (
                                            <button
                                                key={f.value}
                                                onClick={() => setDraft(p => ({...p, frequency: f.value}))}
                                                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${draft.frequency === f.value ? 'border-current shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-slate-50'}`}
                                                style={draft.frequency === f.value ? { borderColor: f.color, background: f.color + '10', color: f.color } : {}}
                                            >
                                                <span className="text-xs font-black">{f.label}</span>
                                                <span className="text-xs opacity-70 mt-0.5" style={draft.frequency === f.value ? {} : {color:'#94a3b8'}}>{f.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {field('Run Time',
                                    'time',
                                    <input type="time" className={inputCls(false)}
                                        value={draft.runTime} onChange={e => setDraft(p => ({...p, runTime: e.target.value}))} />
                                )}

                                {field('Notes (optional)',
                                    'notes',
                                    <textarea rows={3} className={inputCls(false)} placeholder="Optional run context or handoff notes"
                                        value={draft.notes} onChange={e => setDraft(p => ({...p, notes: e.target.value}))} />
                                )}
                            </div>

                            <button
                                onClick={handleCreate}
                                disabled={saving}
                                className="w-full mt-6 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-black text-sm hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-200 disabled:opacity-60 transition-all hover:scale-[1.01]"
                            >
                                {saving ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                                {saving ? 'Saving…' : 'Save Schedule'}
                            </button>
                        </div>
                    </div>

                    {/* ── Schedule List ── */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-black text-slate-800">
                                Scheduled Pipelines <span className="ml-2 text-slate-400 font-semibold text-sm">({schedules.length})</span>
                            </h2>
                        </div>

                        {schedules.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-dashed border-slate-200">
                                <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
                                    <Calendar size={28} className="text-slate-300" />
                                </div>
                                <p className="font-bold text-slate-600">No schedules yet</p>
                                <p className="text-xs text-slate-400 mt-1">Create your first recurring pipeline trigger</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <AnimatePresence>
                                    {schedules.map((s, i) => (
                                        <motion.div
                                            key={s.id}
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ delay: i * 0.04 }}
                                            className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group"
                                        >
                                            {/* Active indicator line */}
                                            <div className={`h-0.5 w-full transition-all ${s.status === 'Active' ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                                            <div className="p-5">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex items-start gap-4 min-w-0">
                                                        {/* Icon */}
                                                        <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center transition-all ${s.status === 'Active' ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                                                            <GitMerge size={18} className={s.status === 'Active' ? 'text-emerald-600' : 'text-slate-400'} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <p className="text-sm font-black text-slate-900 truncate">{s.name}</p>
                                                                <FreqBadge freq={s.frequency} />
                                                            </div>
                                                            <p className="text-xs text-slate-500 truncate">{s.pipelineName}</p>
                                                            <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                                                                <Clock3 size={10} /> {s.frequency} at {s.runTime}
                                                            </p>
                                                            {s.notes && (
                                                                <p className="text-xs text-slate-400 mt-1.5 truncate italic">"{s.notes}"</p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {/* Toggle */}
                                                        <button
                                                            onClick={() => toggleStatus(s.id)}
                                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${s.status === 'Active'
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-100'
                                                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-100'}`}
                                                        >
                                                            {s.status === 'Active'
                                                                ? <><CheckCircle2 size={11} /> Active</>
                                                                : <><Pause size={11} /> Paused</>}
                                                        </button>
                                                        {/* Delete */}
                                                        <button
                                                            onClick={() => removeSchedule(s.id)}
                                                            className="p-2 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all"
                                                            title="Delete schedule"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
