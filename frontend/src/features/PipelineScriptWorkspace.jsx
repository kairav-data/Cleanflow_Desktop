import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  AlertCircle,
  CheckCircle,
  Code2,
  Database,
  Loader2,
  Play,
  Save,
  ShieldCheck,
  TableProperties,
  TerminalSquare,
} from 'lucide-react';

import { DatasetViewer, WorkspaceTabs } from '../components';
import {
  SCRIPT_LANGUAGE_META,
  buildScriptNodeData,
  getScriptDrafts,
  resolveScriptLanguage,
} from './scriptTaskConfig';
import { API_BASE } from '../lib/runtimeConfig';

const FEEDBACK_STYLES = {
  idle: {
    card: 'border-slate-200 bg-white text-slate-700',
    icon: 'border-slate-200 bg-slate-50 text-slate-500',
  },
  pending: {
    card: 'border-slate-200 bg-white text-slate-700',
    icon: 'border-slate-200 bg-slate-50 text-slate-500',
  },
  success: {
    card: 'border-emerald-200 bg-emerald-50/60 text-emerald-900',
    icon: 'border-emerald-200 bg-white text-emerald-600',
  },
  error: {
    card: 'border-red-200 bg-red-50/70 text-red-900',
    icon: 'border-red-200 bg-white text-red-600',
  },
};

const createIdleFeedback = (title, message) => ({
  status: 'idle',
  title,
  message,
  notes: [],
});

const FeedbackCard = ({ icon, feedback }) => {
  const styles = FEEDBACK_STYLES[feedback.status] || FEEDBACK_STYLES.idle;
  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${styles.card}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${styles.icon}`}>
          {React.createElement(icon, { size: 18 })}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black">{feedback.title}</p>
            <span className="rounded-full border border-current/15 bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]">
              {feedback.status}
            </span>
          </div>
          <p className="mt-1 text-sm leading-6 text-current/80">{feedback.message}</p>
          {feedback.notes?.length > 0 && (
            <div className="mt-3 space-y-2">
              {feedback.notes.map((note, index) => (
                <div
                  key={`${note}-${index}`}
                  className="rounded-2xl border border-current/10 bg-white/80 px-3 py-2 text-xs font-medium leading-5 text-current/80"
                >
                  {note}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function PipelineScriptWorkspace({
  node,
  executionSessionId,
  buildPreviewPayload,
  onSave,
}) {
  const [language, setLanguage] = useState(resolveScriptLanguage(node?.data));
  const [drafts, setDrafts] = useState(getScriptDrafts(node?.data));
  const [workspaceTab, setWorkspaceTab] = useState('editor');
  const [isCheckingSyntax, setIsCheckingSyntax] = useState(false);
  const [isRunningPreview, setIsRunningPreview] = useState(false);
  const [previewSessions, setPreviewSessions] = useState({
    inputSessionId: null,
    inputColumns: [],
    inputRowCount: 0,
    outputSessionId: null,
    outputColumns: [],
    outputRowCount: 0,
  });
  const [syntaxFeedback, setSyntaxFeedback] = useState(
    createIdleFeedback(
      'Syntax Check',
      'Use the syntax check before saving so the pipeline stores a working SQL or Python script.',
    ),
  );
  const [previewFeedback, setPreviewFeedback] = useState(
    createIdleFeedback(
      'Preview Run',
      'Run a preview to inspect the dataset arriving at this task and the transformed output that will continue downstream.',
    ),
  );

  useEffect(() => {
    setLanguage(resolveScriptLanguage(node?.data));
    setDrafts(getScriptDrafts(node?.data));
    setWorkspaceTab('editor');
    setPreviewSessions({
      inputSessionId: null,
      inputColumns: [],
      inputRowCount: 0,
      outputSessionId: null,
      outputColumns: [],
      outputRowCount: 0,
    });
    setSyntaxFeedback(
      createIdleFeedback(
        'Syntax Check',
        'Use the syntax check before saving so the pipeline stores a working SQL or Python script.',
      ),
    );
    setPreviewFeedback(
      createIdleFeedback(
        'Preview Run',
        'Run a preview to inspect the dataset arriving at this task and the transformed output that will continue downstream.',
      ),
    );
  }, [node]);

  const languageMeta = SCRIPT_LANGUAGE_META[language] || SCRIPT_LANGUAGE_META.sql;
  const currentCode = drafts[language];
  const draftNodeData = buildScriptNodeData(node?.data || {}, language, drafts);

  const executePreviewRequest = async (validateOnly) => {
    if (!executionSessionId) {
      const message = 'Attach a dataset source to the pipeline before previewing this script task.';
      const nextFeedback = {
        status: 'error',
        title: validateOnly ? 'Syntax Check Failed' : 'Preview Run Failed',
        message,
        notes: [],
      };
      if (validateOnly) {
        setSyntaxFeedback(nextFeedback);
      } else {
        setPreviewFeedback(nextFeedback);
      }
      return;
    }

    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    if (validateOnly) {
      setIsCheckingSyntax(true);
      setSyntaxFeedback({
        status: 'pending',
        title: 'Checking Syntax',
        message: `Validating the ${languageMeta.label} script against the incoming pipeline dataset.`,
        notes: [],
      });
    } else {
      setIsRunningPreview(true);
      setPreviewFeedback({
        status: 'pending',
        title: 'Running Preview',
        message: `Executing the ${languageMeta.label} script on the current incoming dataset.`,
        notes: [],
      });
    }

    try {
      const payload = buildPreviewPayload(node.id, draftNodeData, { validateOnly });
      const response = await axios.post(
        `${API_BASE}/features/pipeline/script-preview/${executionSessionId}`,
        payload,
        { headers },
      );
      const nextSessions = {
        inputSessionId: response.data?.input_session_id || null,
        inputColumns: response.data?.input_columns || [],
        inputRowCount: response.data?.input_row_count || 0,
        outputSessionId: response.data?.output_session_id || null,
        outputColumns: response.data?.output_columns || [],
        outputRowCount: response.data?.output_row_count || 0,
      };
      setPreviewSessions((current) => ({
        ...current,
        ...nextSessions,
      }));

      const notes = Array.isArray(response.data?.notes) ? response.data.notes : [];
      const normalizedScript = String(response.data?.normalized_script || '').trim();
      const normalizedNote =
        normalizedScript && normalizedScript !== currentCode.trim()
          ? [`Preview is using a compatibility-adjusted version of your script.`, ...notes]
          : notes;

      setSyntaxFeedback({
        status: 'success',
        title: 'Syntax Check Passed',
        message: response.data?.message || `${languageMeta.label} syntax looks valid.`,
        notes: normalizedNote,
      });

      if (!validateOnly) {
        setPreviewFeedback({
          status: 'success',
          title: 'Preview Ready',
          message:
            response.data?.message ||
            `${languageMeta.label} preview completed successfully on ${response.data?.input_row_count || 0} incoming row(s).`,
          notes: normalizedNote,
        });
        setWorkspaceTab(response.data?.output_session_id ? 'output' : 'incoming');
      } else if (response.data?.input_session_id) {
        setWorkspaceTab('incoming');
      }
    } catch (error) {
      const message = error.response?.data?.detail || error.message || 'The script preview could not be completed.';
      const nextFeedback = {
        status: 'error',
        title: validateOnly ? 'Syntax Check Failed' : 'Preview Run Failed',
        message,
        notes: [],
      };
      if (validateOnly) {
        setSyntaxFeedback(nextFeedback);
      } else {
        setPreviewFeedback(nextFeedback);
      }
    } finally {
      if (validateOnly) {
        setIsCheckingSyntax(false);
      } else {
        setIsRunningPreview(false);
      }
    }
  };

  const handleSave = () => {
    onSave(draftNodeData);
  };

  const renderEditorWorkspace = () => (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_380px]">
      <div className="space-y-5">
        <div className={`overflow-hidden rounded-[30px] border shadow-sm ${languageMeta.editorWrapClass}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-white/60">Script Editor</p>
              <p className={`mt-1 text-sm font-medium ${languageMeta.editorHintClass}`}>
                {languageMeta.helperText}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/75">
                Incoming data aware
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/75">
                {currentCode.split('\n').length} lines
              </span>
            </div>
          </div>
          <div className="px-5 py-5">
            <textarea
              value={currentCode}
              spellCheck={false}
              onChange={(event) => {
                const nextValue = event.target.value;
                setDrafts((current) => ({
                  ...current,
                  [language]: nextValue,
                }));
              }}
              placeholder={drafts[language]}
              className={`min-h-[520px] w-full resize-none rounded-[24px] border border-white/10 bg-transparent px-5 py-4 font-mono text-[14px] leading-7 outline-none transition-all ${languageMeta.editorTextClass}`}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Language</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {Object.values(SCRIPT_LANGUAGE_META).map((option) => {
              const isActive = option.id === language;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setLanguage(option.id)}
                  className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                    isActive
                      ? `${option.pillClass} shadow-sm`
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {option.id === 'sql' ? <TableProperties size={16} /> : <Code2 size={16} />}
                    <span className="text-sm font-black">{option.label}</span>
                  </div>
                  <p className="mt-2 text-xs font-medium leading-5 opacity-80">
                    {option.id === 'sql'
                      ? 'Great for fast tabular transformations.'
                      : 'Best for custom row and column logic.'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <FeedbackCard icon={ShieldCheck} feedback={syntaxFeedback} />
        <FeedbackCard icon={Database} feedback={previewFeedback} />

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Preview Snapshot</p>
          <div className="mt-4 grid gap-3">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Incoming rows</p>
                <p className="mt-1 text-lg font-black text-slate-900">{previewSessions.inputRowCount || 0}</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${languageMeta.mutedPillClass}`}>
                {previewSessions.inputColumns.length} columns
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Output rows</p>
                <p className="mt-1 text-lg font-black text-slate-900">{previewSessions.outputRowCount || 0}</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${languageMeta.mutedPillClass}`}>
                {previewSessions.outputColumns.length} columns
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-8 py-5">
        <div className="flex items-center gap-4">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl border bg-white shadow-sm"
            style={{ borderColor: `${languageMeta.accent}33`, color: languageMeta.accent }}
          >
            <TerminalSquare size={20} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black tracking-tight text-slate-900">Execute Script</h2>
              <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${languageMeta.pillClass}`}>
                {languageMeta.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Choose SQL or Python, validate syntax, inspect the incoming dataset, run a preview, and then save the task into the pipeline.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => executePreviewRequest(true)}
            disabled={isCheckingSyntax || isRunningPreview || !currentCode.trim()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            {isCheckingSyntax ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            {languageMeta.syntaxButtonLabel}
          </button>
          <button
            type="button"
            onClick={() => executePreviewRequest(false)}
            disabled={isCheckingSyntax || isRunningPreview || !currentCode.trim()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
          >
            {isRunningPreview ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {languageMeta.previewButtonLabel}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!currentCode.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Save size={16} />
            {languageMeta.saveButtonLabel}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Script Workspace</h3>
            <p className="mt-1 text-sm text-slate-500">
              Keep editing, dataset inspection, and preview execution in one place so you can save with confidence.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
              {currentCode.trim() ? 'Script ready' : 'Script required'}
            </span>
            <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm ${languageMeta.pillClass}`}>
              {languageMeta.label} mode
            </span>
          </div>
        </div>

        <WorkspaceTabs
          tone={languageMeta.tone}
          activeTab={workspaceTab}
          onChange={setWorkspaceTab}
          tabs={[
            { id: 'editor', label: 'Editor', icon: TerminalSquare },
            { id: 'incoming', label: 'Incoming Data', icon: Database, disabled: !previewSessions.inputSessionId },
            { id: 'output', label: 'Output Preview', icon: CheckCircle, disabled: !previewSessions.outputSessionId },
          ]}
        />

        <div className="mt-5">
          {workspaceTab === 'editor' && renderEditorWorkspace()}

          {workspaceTab === 'incoming' && previewSessions.inputSessionId && (
            <DatasetViewer
              sessionId={previewSessions.inputSessionId}
              tone={languageMeta.tone}
              title="Incoming Dataset"
              subtitle="This is the dataset arriving at the Execute Script task right before your selected language runs."
            />
          )}

          {workspaceTab === 'output' && previewSessions.outputSessionId && (
            <DatasetViewer
              sessionId={previewSessions.outputSessionId}
              tone={languageMeta.tone}
              title="Script Output Preview"
              subtitle="This preview shows the dataset that will continue to the next pipeline step after this script runs."
            />
          )}

          {workspaceTab !== 'editor' && !previewSessions.inputSessionId && !previewSessions.outputSessionId && (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white px-8 py-12 text-center shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
                <AlertCircle size={22} />
              </div>
              <p className="mt-4 text-base font-black text-slate-900">Preview data is not ready yet</p>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                Run a syntax check or preview after connecting an incoming dataset so CleanFlow can show the exact data entering and leaving this task.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
