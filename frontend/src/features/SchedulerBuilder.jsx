import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Settings, Clock3 } from 'lucide-react';

const STORAGE_KEY = 'cleanflow_pipeline_schedules_v1';

const DEFAULT_SCHEDULE = {
  id: '',
  name: '',
  pipelineName: '',
  frequency: 'Daily',
  runTime: '09:00',
  status: 'Active',
  notes: '',
};

export default function SchedulerBuilder() {
  const [schedules, setSchedules] = useState([]);
  const [draft, setDraft] = useState(DEFAULT_SCHEDULE);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      setSchedules(Array.isArray(saved) ? saved : []);
    } catch {
      setSchedules([]);
    }
  }, []);

  const persistSchedules = (next) => {
    setSchedules(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const handleCreate = () => {
    if (!draft.name.trim() || !draft.pipelineName.trim()) {
      alert('Please add a schedule name and pipeline name.');
      return;
    }

    const next = [
      {
        ...draft,
        id: `sched_${Date.now()}`,
        createdAt: new Date().toISOString(),
        lastRun: null,
      },
      ...schedules,
    ];

    persistSchedules(next);
    setDraft(DEFAULT_SCHEDULE);
  };

  const toggleStatus = (id) => {
    const next = schedules.map((schedule) => (
      schedule.id === id
        ? { ...schedule, status: schedule.status === 'Active' ? 'Paused' : 'Active' }
        : schedule
    ));
    persistSchedules(next);
  };

  const removeSchedule = (id) => {
    const next = schedules.filter((schedule) => schedule.id !== id);
    persistSchedules(next);
  };

  return (
    <div className="w-full max-w-6xl mx-auto pb-20 pt-4">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900">Pipeline Scheduler</h1>
        <p className="text-slate-500 mt-2">Plan recurring runs for your orchestrated workflows.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-slate-100 text-slate-700">
              <Settings size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Create Schedule</h2>
              <p className="text-sm text-slate-500">Use this as a planning layer for upcoming automation.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase text-slate-500">Schedule Name</label>
              <input
                className="w-full mt-2 p-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400"
                placeholder="Morning data sync"
                value={draft.name}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-slate-500">Pipeline Name</label>
              <input
                className="w-full mt-2 p-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400"
                placeholder="Customer quality pipeline"
                value={draft.pipelineName}
                onChange={(e) => setDraft((prev) => ({ ...prev, pipelineName: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase text-slate-500">Frequency</label>
                <select
                  className="w-full mt-2 p-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400"
                  value={draft.frequency}
                  onChange={(e) => setDraft((prev) => ({ ...prev, frequency: e.target.value }))}
                >
                  <option>Hourly</option>
                  <option>Daily</option>
                  <option>Weekly</option>
                  <option>Monthly</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-slate-500">Run Time</label>
                <input
                  type="time"
                  className="w-full mt-2 p-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400"
                  value={draft.runTime}
                  onChange={(e) => setDraft((prev) => ({ ...prev, runTime: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-slate-500">Notes</label>
              <textarea
                rows={4}
                className="w-full mt-2 p-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400"
                placeholder="Optional run context or handoff notes"
                value={draft.notes}
                onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>

          <button
            onClick={handleCreate}
            className="w-full mt-6 flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors"
          >
            <Plus size={18} /> Save Schedule
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Scheduled Pipelines</h2>
              <p className="text-sm text-slate-500">{schedules.length} saved schedules</p>
            </div>
          </div>

          {schedules.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <Clock3 className="mx-auto text-slate-300 mb-3" size={32} />
              <p className="text-sm font-medium text-slate-500">No schedules yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {schedules.map((schedule) => (
                <div key={schedule.id} className="border border-slate-200 rounded-2xl p-5 bg-slate-50">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-bold text-slate-900">{schedule.name}</p>
                      <p className="text-sm text-slate-600 mt-1">{schedule.pipelineName}</p>
                      <p className="text-xs text-slate-500 mt-2">
                        {schedule.frequency} at {schedule.runTime}
                      </p>
                      {schedule.notes && <p className="text-sm text-slate-500 mt-3">{schedule.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleStatus(schedule.id)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold ${schedule.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}
                      >
                        {schedule.status}
                      </button>
                      <button
                        onClick={() => removeSchedule(schedule.id)}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50"
                        title="Delete schedule"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
