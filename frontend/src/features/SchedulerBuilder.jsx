import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertCircle,
    Calendar,
    CheckCircle2,
    Clock3,
    GitMerge,
    Pause,
    Pencil,
    RefreshCw,
    Settings,
    Trash2,
} from 'lucide-react';
import { formatDateTimeInIST } from '../lib/utils';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';
const Motion = motion;
const DAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FREQUENCIES = [
    { label: 'Hourly', value: 'Hourly', desc: 'Runs every hour at the selected minute', color: '#4f46e5' },
    { label: 'Daily', value: 'Daily', desc: 'Runs once every day', color: '#059669' },
    { label: 'Weekly', value: 'Weekly', desc: 'Runs once every week', color: '#d97706' },
    { label: 'Monthly', value: 'Monthly', desc: 'Runs once every month', color: '#db2777' },
];

const getBrowserTimezone = () => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
};

const buildDraft = (pipelines = [], schedule = null) => ({
    id: schedule?.id || '',
    scheduleName: schedule?.schedule_name || '',
    pipelineId: schedule?.pipeline_id || pipelines[0]?.id || '',
    frequency: schedule?.frequency || 'Daily',
    runTime: schedule?.run_time || '09:00',
    dayOfWeek: schedule?.day_of_week || 'Mon',
    dayOfMonth: schedule?.day_of_month ?? 1,
    timezone: schedule?.timezone || getBrowserTimezone(),
    notes: schedule?.notes || '',
});

const buildScheduleSummary = (schedule) => {
    if (schedule.frequency === 'Hourly') {
        return `Hourly at minute ${String(schedule.run_time || '00:00').split(':')[1] || '00'}`;
    }
    if (schedule.frequency === 'Weekly') {
        return `${schedule.frequency} on ${schedule.day_of_week || 'Mon'} at ${schedule.run_time}`;
    }
    if (schedule.frequency === 'Monthly') {
        return `${schedule.frequency} on day ${schedule.day_of_month || 1} at ${schedule.run_time}`;
    }
    return `${schedule.frequency} at ${schedule.run_time}`;
};

function FrequencyBadge({ frequency }) {
    const match = FREQUENCIES.find((item) => item.value === frequency) || FREQUENCIES[1];
    return (
        <span
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold"
            style={{ color: match.color, background: `${match.color}18`, borderColor: `${match.color}33` }}
        >
            <Clock3 size={10} /> {match.label}
        </span>
    );
}

export default function SchedulerBuilder() {
    const [pipelines, setPipelines] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [draft, setDraft] = useState(buildDraft());
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [busyScheduleId, setBusyScheduleId] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const selectedPipeline = useMemo(
        () => pipelines.find((pipeline) => pipeline.id === draft.pipelineId) || null,
        [draft.pipelineId, pipelines]
    );
    const isEditing = Boolean(draft.id);

    const stats = useMemo(() => ({
        total: schedules.length,
        active: schedules.filter((schedule) => schedule.is_active).length,
        paused: schedules.filter((schedule) => !schedule.is_active).length,
    }), [schedules]);

    const loadData = async ({ silent = false } = {}) => {
        if (!token) {
            setErrorMessage('Sign in to manage pipeline schedules.');
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
            const [pipelinesRes, schedulesRes] = await Promise.all([
                axios.get(`${API_BASE}/pipeline/saved`, { headers }),
                axios.get(`${API_BASE}/pipeline/schedules`, { headers }),
            ]);

            const nextPipelines = Array.isArray(pipelinesRes.data) ? pipelinesRes.data : [];
            const nextSchedules = Array.isArray(schedulesRes.data) ? schedulesRes.data : [];
            setPipelines(nextPipelines);
            setSchedules(nextSchedules);
            setDraft((current) => ({
                ...buildDraft(nextPipelines),
                ...current,
                pipelineId: nextPipelines.some((pipeline) => pipeline.id === current.pipelineId)
                    ? current.pipelineId
                    : nextPipelines[0]?.id || '',
            }));
        } catch (error) {
            setErrorMessage(error.response?.data?.detail || 'Failed to load pipeline schedules.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const validate = () => {
        const nextErrors = {};
        if (!draft.pipelineId) nextErrors.pipelineId = 'Select a saved pipeline first.';
        if (!draft.runTime) nextErrors.runTime = 'Run time is required.';
        if (draft.frequency === 'Weekly' && !draft.dayOfWeek) nextErrors.dayOfWeek = 'Choose a weekday.';
        if (draft.frequency === 'Monthly') {
            const day = Number(draft.dayOfMonth);
            if (!Number.isInteger(day) || day < 1 || day > 31) {
                nextErrors.dayOfMonth = 'Choose a day between 1 and 31.';
            }
        }
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const resetDraft = (nextPipelines = pipelines) => {
        setDraft(buildDraft(nextPipelines));
        setErrors({});
    };

    const startEditing = (schedule) => {
        setDraft(buildDraft(pipelines, schedule));
        setErrors({});
        setErrorMessage('');
    };

    const handleSave = async () => {
        if (!validate()) return;
        setSaving(true);
        setErrorMessage('');

        try {
            await axios.post(
                `${API_BASE}/pipeline/saved/${draft.pipelineId}/schedules`,
                {
                    id: draft.id || undefined,
                    schedule_name: draft.scheduleName.trim() || `${selectedPipeline?.name || 'Pipeline'} Schedule`,
                    frequency: draft.frequency,
                    run_time: draft.runTime,
                    day_of_week: draft.frequency === 'Weekly' ? draft.dayOfWeek : null,
                    day_of_month: draft.frequency === 'Monthly' ? Number(draft.dayOfMonth) : null,
                    timezone: draft.timezone || 'UTC',
                    notes: draft.notes.trim(),
                },
                { headers }
            );

            resetDraft(pipelines);
            await loadData({ silent: true });
        } catch (error) {
            setErrorMessage(error.response?.data?.detail || `Failed to ${isEditing ? 'update' : 'save'} schedule.`);
        } finally {
            setSaving(false);
        }
    };

    const toggleSchedule = async (scheduleId) => {
        setBusyScheduleId(scheduleId);
        setErrorMessage('');
        try {
            await axios.patch(`${API_BASE}/pipeline/schedules/${scheduleId}/toggle`, {}, { headers });
            await loadData({ silent: true });
        } catch (error) {
            setErrorMessage(error.response?.data?.detail || 'Failed to update schedule.');
        } finally {
            setBusyScheduleId('');
        }
    };

    const deleteSchedule = async (scheduleId) => {
        setBusyScheduleId(scheduleId);
        setErrorMessage('');
        try {
            await axios.delete(`${API_BASE}/pipeline/schedules/${scheduleId}`, { headers });
            if (draft.id === scheduleId) {
                resetDraft(pipelines);
            }
            await loadData({ silent: true });
        } catch (error) {
            setErrorMessage(error.response?.data?.detail || 'Failed to delete schedule.');
        } finally {
            setBusyScheduleId('');
        }
    };

    const field = (label, content, error) => (
        <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</label>
            <div className="mt-2">{content}</div>
            {error ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                    <AlertCircle size={11} /> {error}
                </p>
            ) : null}
        </div>
    );

    const inputClass = (hasError) =>
        `w-full rounded-xl border px-3 py-3 text-sm outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 ${
            hasError ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300'
        }`;

    return (
        <div className="flex h-full w-full flex-col bg-slate-50">
            <div className="shrink-0 border-b border-slate-100 bg-white px-8 py-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-200">
                            <Clock3 size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black leading-tight text-slate-900">Pipeline Scheduler</h1>
                            <p className="text-xs font-medium text-slate-400">Run saved pipelines automatically on a real backend schedule</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {stats.active} Active
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                            {stats.paused} Paused
                        </span>
                        <button
                            onClick={() => loadData({ silent: true })}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
                        >
                            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8">
                <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
                    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                        <div className="h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
                        <div className="p-6">
                            <div className="mb-6 flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50">
                                    <Settings size={18} className="text-indigo-600" />
                                </div>
                                <div>
                                    <h2 className="text-base font-black text-slate-900">{isEditing ? 'Edit Schedule' : 'New Schedule'}</h2>
                                    <p className="text-xs text-slate-400">
                                        {isEditing
                                            ? 'Update the selected scheduled pipeline and save your changes'
                                            : 'Choose a saved pipeline and define when it should run'}
                                    </p>
                                </div>
                            </div>

                            {errorMessage ? (
                                <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                                    {errorMessage}
                                </div>
                            ) : null}

                            {!loading && pipelines.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                                    <p className="font-bold text-slate-700">No saved pipelines yet</p>
                                    <p className="mt-1 text-sm text-slate-500">Save a pipeline from the pipeline builder first, then schedule it here.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {field(
                                        'Saved Pipeline',
                                        <select
                                            className={inputClass(errors.pipelineId)}
                                            value={draft.pipelineId}
                                            onChange={(event) => {
                                                const pipelineId = event.target.value;
                                                setDraft((current) => ({ ...current, pipelineId }));
                                                setErrors((current) => ({ ...current, pipelineId: '' }));
                                            }}
                                        >
                                            <option value="">Select a saved pipeline...</option>
                                            {pipelines.map((pipeline) => (
                                                <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>
                                            ))}
                                        </select>,
                                        errors.pipelineId
                                    )}

                                    {field(
                                        'Schedule Name',
                                        <input
                                            className={inputClass(false)}
                                            placeholder={selectedPipeline ? `${selectedPipeline.name} Schedule` : 'Morning customer sync'}
                                            value={draft.scheduleName}
                                            onChange={(event) => setDraft((current) => ({ ...current, scheduleName: event.target.value }))}
                                        />
                                    )}

                                    <div>
                                        <label className="text-xs font-black uppercase tracking-wider text-slate-500">Frequency</label>
                                        <div className="mt-2 grid grid-cols-2 gap-2">
                                            {FREQUENCIES.map((frequency) => (
                                                <button
                                                    key={frequency.value}
                                                    type="button"
                                                    onClick={() => setDraft((current) => ({ ...current, frequency: frequency.value }))}
                                                    className={`rounded-xl border p-3 text-left transition-all ${
                                                        draft.frequency === frequency.value
                                                            ? 'shadow-sm'
                                                            : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                                                    }`}
                                                    style={draft.frequency === frequency.value ? { borderColor: frequency.color, background: `${frequency.color}10`, color: frequency.color } : undefined}
                                                >
                                                    <span className="block text-xs font-black">{frequency.label}</span>
                                                    <span className="mt-0.5 block text-xs opacity-70">{frequency.desc}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {field(
                                        'Run Time',
                                        <input
                                            type="time"
                                            className={inputClass(errors.runTime)}
                                            value={draft.runTime}
                                            onChange={(event) => {
                                                setDraft((current) => ({ ...current, runTime: event.target.value }));
                                                setErrors((current) => ({ ...current, runTime: '' }));
                                            }}
                                        />,
                                        errors.runTime
                                    )}

                                    {draft.frequency === 'Weekly' ? field(
                                        'Day Of Week',
                                        <select
                                            className={inputClass(errors.dayOfWeek)}
                                            value={draft.dayOfWeek}
                                            onChange={(event) => {
                                                setDraft((current) => ({ ...current, dayOfWeek: event.target.value }));
                                                setErrors((current) => ({ ...current, dayOfWeek: '' }));
                                            }}
                                        >
                                            {DAY_OPTIONS.map((day) => (
                                                <option key={day} value={day}>{day}</option>
                                            ))}
                                        </select>,
                                        errors.dayOfWeek
                                    ) : null}

                                    {draft.frequency === 'Monthly' ? field(
                                        'Day Of Month',
                                        <input
                                            type="number"
                                            min={1}
                                            max={31}
                                            className={inputClass(errors.dayOfMonth)}
                                            value={draft.dayOfMonth}
                                            onChange={(event) => {
                                                setDraft((current) => ({ ...current, dayOfMonth: event.target.value }));
                                                setErrors((current) => ({ ...current, dayOfMonth: '' }));
                                            }}
                                        />,
                                        errors.dayOfMonth
                                    ) : null}

                                    {field(
                                        'Timezone',
                                        <input
                                            className={inputClass(false)}
                                            value={draft.timezone}
                                            onChange={(event) => setDraft((current) => ({ ...current, timezone: event.target.value }))}
                                            placeholder="Asia/Kolkata"
                                        />
                                    )}

                                    {field(
                                        'Notes',
                                        <textarea
                                            rows={3}
                                            className={inputClass(false)}
                                            placeholder="Optional notes for why this schedule exists"
                                            value={draft.notes}
                                            onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                                        />
                                    )}

                                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                        <button
                                            type="button"
                                            onClick={handleSave}
                                            disabled={saving || !pipelines.length}
                                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-black text-white shadow-lg shadow-indigo-200 transition-all hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Clock3 size={16} />}
                                            {saving ? 'Saving...' : isEditing ? 'Update Schedule' : 'Save Schedule'}
                                        </button>
                                        {isEditing ? (
                                            <button
                                                type="button"
                                                onClick={() => resetDraft(pipelines)}
                                                disabled={saving}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                Cancel Edit
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-base font-black text-slate-800">
                                Scheduled Pipelines <span className="ml-2 text-sm font-semibold text-slate-400">({stats.total})</span>
                            </h2>
                        </div>

                        {loading ? (
                            <div className="rounded-2xl border border-slate-100 bg-white px-6 py-12 text-center shadow-sm">
                                <RefreshCw size={18} className="mx-auto animate-spin text-slate-400" />
                                <p className="mt-3 text-sm font-medium text-slate-500">Loading schedules...</p>
                            </div>
                        ) : schedules.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-24">
                                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50">
                                    <Calendar size={28} className="text-slate-300" />
                                </div>
                                <p className="font-bold text-slate-600">No schedules yet</p>
                                <p className="mt-1 text-xs text-slate-400">Create your first recurring pipeline run from the panel on the left.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <AnimatePresence>
                                    {schedules.map((schedule, index) => (
                                        <Motion.div
                                            key={schedule.id}
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ delay: index * 0.03 }}
                                            className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
                                        >
                                            <div className={`h-0.5 w-full ${schedule.is_active ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                                            <div className="p-5">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex min-w-0 items-start gap-4">
                                                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${schedule.is_active ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                                                            <GitMerge size={18} className={schedule.is_active ? 'text-emerald-600' : 'text-slate-400'} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="mb-1 flex flex-wrap items-center gap-2">
                                                                <p className="truncate text-sm font-black text-slate-900">{schedule.schedule_name}</p>
                                                                <FrequencyBadge frequency={schedule.frequency} />
                                                            </div>
                                                            <p className="truncate text-xs text-slate-500">{schedule.pipeline_name || 'Saved pipeline'}</p>
                                                            <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
                                                                <Clock3 size={10} /> {buildScheduleSummary(schedule)}
                                                            </p>
                                                            <p className="mt-2 text-xs text-slate-500">Next run: {formatDateTimeInIST(schedule.next_run_at, 'Not scheduled yet')}</p>
                                                            <p className="mt-1 text-xs text-slate-400">Last run: {formatDateTimeInIST(schedule.last_run_at, 'Not scheduled yet')}</p>
                                                            {schedule.notes ? (
                                                                <p className="mt-2 truncate text-xs italic text-slate-400">"{schedule.notes}"</p>
                                                            ) : null}
                                                        </div>
                                                    </div>

                                                    <div className="flex shrink-0 items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => startEditing(schedule)}
                                                            disabled={busyScheduleId === schedule.id}
                                                            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 transition-all hover:border-indigo-100 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                                                            title="Edit schedule"
                                                        >
                                                            <Pencil size={15} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleSchedule(schedule.id)}
                                                            disabled={busyScheduleId === schedule.id}
                                                            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                                                                schedule.is_active
                                                                    ? 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:border-amber-100 hover:bg-amber-50 hover:text-amber-700'
                                                                    : 'border-slate-200 bg-slate-100 text-slate-600 hover:border-emerald-100 hover:bg-emerald-50 hover:text-emerald-700'
                                                            }`}
                                                        >
                                                            {busyScheduleId === schedule.id ? (
                                                                <RefreshCw size={11} className="animate-spin" />
                                                            ) : schedule.is_active ? (
                                                                <CheckCircle2 size={11} />
                                                            ) : (
                                                                <Pause size={11} />
                                                            )}
                                                            {schedule.is_active ? 'Active' : 'Paused'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => deleteSchedule(schedule.id)}
                                                            disabled={busyScheduleId === schedule.id}
                                                            className="rounded-xl border border-transparent p-2 text-slate-300 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                                                            title="Delete schedule"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </Motion.div>
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
