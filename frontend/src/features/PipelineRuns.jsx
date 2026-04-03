import React, { useEffect, useMemo, useState } from 'react';
import { FolderClock, RefreshCw, CheckCircle2, AlertCircle, LoaderCircle, Download } from 'lucide-react';

const STORAGE_KEY = 'cleanflow_pipeline_runs_v1';

export default function PipelineRuns() {
  const [runs, setRuns] = useState([]);

  const loadRuns = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      setRuns(Array.isArray(saved) ? saved : []);
    } catch {
      setRuns([]);
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

  const statusBadge = (status) => {
    if (status === 'completed') {
      return { label: 'Completed', className: 'bg-emerald-50 text-emerald-700', icon: <CheckCircle2 size={14} /> };
    }
    if (status === 'failed') {
      return { label: 'Failed', className: 'bg-red-50 text-red-700', icon: <AlertCircle size={14} /> };
    }
    return { label: 'Running', className: 'bg-amber-50 text-amber-700', icon: <LoaderCircle size={14} className="animate-spin" /> };
  };

  return (
    <div className="w-full max-w-6xl mx-auto pb-20 pt-4">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Pipeline Runs</h1>
          <p className="text-slate-500 mt-2">Track recent execution status for orchestrated data flows.</p>
        </div>
        <button
          onClick={loadRuns}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Runs', value: stats.total },
          { label: 'Completed', value: stats.completed },
          { label: 'Running', value: stats.running },
          { label: 'Failed', value: stats.failed },
        ].map((card) => (
          <div key={card.label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="text-3xl font-black text-slate-900 mt-2">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        {runs.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
            <FolderClock className="mx-auto text-slate-300 mb-3" size={32} />
            <p className="text-sm font-medium text-slate-500">No pipeline runs recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {runs.map((run) => {
              const badge = statusBadge(run.status);
              return (
                <div key={run.id} className="border border-slate-200 rounded-2xl p-5 bg-slate-50">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-bold text-slate-900">{run.name || 'Pipeline Run'}</p>
                      <p className="text-sm text-slate-500 mt-1">
                        Started {new Date(run.startedAt).toLocaleString()}
                      </p>
                      <p className="text-sm text-slate-600 mt-3">
                        Nodes: {run.nodeCount || 0}
                      </p>
                    </div>
                    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${badge.className}`}>
                      {badge.icon}
                      {badge.label}
                    </div>
                  </div>

                  {run.logs?.length > 0 && (
                    <div className="mt-4 p-4 rounded-xl bg-slate-900 text-slate-100">
                      <p className="text-xs uppercase tracking-wider text-slate-400 mb-3">Latest Log</p>
                      <p className="text-sm">
                        {run.logs[run.logs.length - 1]?.message || run.logs[run.logs.length - 1]?.error || 'No details'}
                      </p>
                    </div>
                  )}

                  {run.outputFile && (
                    <div className="mt-4">
                      <a
                        href={run.outputFile}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-800"
                      >
                        <Download size={16} /> Download latest output
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
