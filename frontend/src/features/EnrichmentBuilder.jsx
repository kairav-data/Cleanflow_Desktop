import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import {
    AlertCircle,
    ArrowLeft,
    BookOpen,
    CheckCircle,
    Eye,
    FileJson,
    FileSpreadsheet,
    FileText,
    Play,
    Plus,
    Sparkles,
    Trash2,
    History,
    Save,
    FolderOpen,
    X,
} from 'lucide-react';
import { DataConnection, DatasetViewer, WorkspaceTabs } from '../components';
import RepoSidebar from '../components/RepoSidebar';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';
const STEPS = ['Upload', 'Configure', 'Results'];
const SAVED_CLEANING_KEY = 'cleanflow_saved_cleaning_ops_v1';

const createOperationDraft = (columns = [], operations = []) => ({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    column: columns[0] || '',
    operation: operations[0]?.id || '',
    params: {},
});

const mapImportedOperations = (items = [], columns = [], operations = []) =>
    items.map((item, index) => ({
        id: `${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
        column: item.column || columns[0] || '',
        operation: item.operation || operations[0]?.id || '',
        params: item.params || {},
    }));

const DownloadCard = ({ fmt, label, Icon, onClick }) => (
    <button
        type="button"
        onClick={() => onClick(fmt)}
        className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-slate-200 py-7 transition-all hover:-translate-y-1 hover:border-emerald-400 hover:bg-emerald-50 hover:shadow-lg"
    >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 shadow-sm transition-colors group-hover:bg-white">
            <Icon className="text-slate-500 transition-colors group-hover:text-emerald-600" size={26} />
        </div>
        <span className="text-sm font-bold text-slate-700 transition-colors group-hover:text-emerald-700">{label}</span>
    </button>
);

export default function EnrichmentBuilder({
    sessionId: initialSessionId,
    columns: initialColumns,
    initialSourceConfig = null,
    initialRules = [],
    embedded = false,
    onSaveConfig,
    onComplete,
    user = null,
}) {
    const [sessionId, setSessionId] = useState(initialSessionId || null);
    const [columns, setColumns] = useState(initialColumns || []);
    const [sourceConfig, setSourceConfig] = useState(initialSourceConfig || null);
    const [operations, setOperations] = useState([]);
    const [rules, setRules] = useState(() => mapImportedOperations(initialRules, initialColumns || [], []));
    const [previewData, setPreviewData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(initialSessionId ? 2 : 1);
    const [workspaceTab, setWorkspaceTab] = useState('dataset');
    const [showRepoSidebar, setShowRepoSidebar] = useState(false);
    
    // Config persistence state
    const [pastJobs, setPastJobs] = useState([]);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [savedRuleSets, setSavedRuleSets] = useState([]);
    const [showSavedRulesModal, setShowSavedRulesModal] = useState(false);

    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(SAVED_CLEANING_KEY) || '[]');
            setSavedRuleSets(Array.isArray(saved) ? saved : []);
        } catch {
            setSavedRuleSets([]);
        }
    }, []);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const res = await axios.get(`${API_BASE}/history/jobs`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const withRules = (res.data || []).filter(j => j.module === 'enrichment' && j.rules && j.rules.length > 0);
                setPastJobs(withRules);
            } catch (err) {
                console.error("Failed to fetch history:", err);
            }
        };
        fetchHistory();
    }, []);

    useEffect(() => {
        const fetchOperations = async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/features/cleaner/operations`);
                setOperations(data.operations || []);
            } catch (error) {
                console.error('Error fetching cleaning operations:', error);
            }
        };
        fetchOperations();
    }, []);

    const getOperationMeta = (id) => operations.find((operation) => operation.id === id) || null;

    const addRule = () => setRules((current) => [...current, createOperationDraft(columns, operations)]);
    const removeRule = (id) => setRules((current) => current.filter((rule) => rule.id !== id));

    const updateRule = (id, field, value) => {
        setRules((current) =>
            current.map((rule) =>
                rule.id === id
                    ? { ...rule, [field]: value, params: field === 'operation' ? {} : rule.params }
                    : rule
            )
        );
    };

    const updateParams = (id, key, value) => {
        setRules((current) =>
            current.map((rule) => (rule.id === id ? { ...rule, params: { ...rule.params, [key]: value } } : rule))
        );
    };

    const buildPayload = () => ({
        rules: rules.map(({ column, operation, params }) => ({ column, operation, params })),
    });

    const handleSaveConfig = () => {
        if (!onSaveConfig) return;
        onSaveConfig({
            sessionId,
            columns,
            sourceConfig,
            rules: buildPayload().rules,
        });
    };

    const applyRepoOperations = (repoOperations, mode = 'replace') => {
        const mapped = mapImportedOperations(repoOperations || [], columns, operations);
        if (mapped.length === 0) return;
        setRules((current) => (mode === 'append' ? [...current, ...mapped] : mapped));
        setWorkspaceTab('rules');
        setStep(2);
    };

    const saveCurrentRules = () => {
        if (rules.length === 0) {
            alert('Add at least one operation before saving.');
            return;
        }

        const name = window.prompt('Enter a name for this cleaning template:');
        if (!name || !name.trim()) return;

        const payloadRules = rules.map(({ column, operation, params }) => ({ column, operation, params }));
        const next = [
            {
                id: `cleaningset_${Date.now()}`,
                name: name.trim(),
                rules: payloadRules,
                created_at: new Date().toISOString()
            },
            ...savedRuleSets
        ];

        setSavedRuleSets(next);
        localStorage.setItem(SAVED_CLEANING_KEY, JSON.stringify(next));
    };

    const applySavedRuleSet = (ruleSet) => {
        const mappedRules = mapImportedOperations(ruleSet.rules || [], columns, operations);
        if (mappedRules.length === 0) return;

        const shouldReplace = window.confirm('Replace current pipeline with this saved template?');
        const next = shouldReplace ? mappedRules : [...rules, ...mappedRules];
        setRules(next);
        setShowSavedRulesModal(false);
    };

    const deleteSavedRuleSet = (ruleSetId) => {
        const next = savedRuleSets.filter(s => s.id !== ruleSetId);
        setSavedRuleSets(next);
        localStorage.setItem(SAVED_CLEANING_KEY, JSON.stringify(next));
    };

    const loadRulesFromJob = (job) => {
        if (!job.rules) return;
        const mappedRules = mapImportedOperations(job.rules, columns, operations);
        const next = [...rules, ...mappedRules];
        setRules(next);
        setShowHistoryModal(false);
    };

    const handlePreview = async () => {
        if (!sessionId || rules.length === 0) return;
        setLoading(true);
        try {
            const { data } = await axios.post(`${API_BASE}/features/cleaner/preview/${sessionId}`, buildPayload());
            setPreviewData(data.data || []);
            setStep(3);
        } catch (error) {
            alert(`Preview failed: ${error.response?.data?.detail || error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleExecute = async () => {
        if (!sessionId) return;
        setLoading(true);
        try {
            await axios.post(`${API_BASE}/features/cleaner/execute/${sessionId}`, buildPayload());
            try {
                const token = localStorage.getItem('token');
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                await axios.post(
                    `${API_BASE}/history/jobs`,
                    {
                        session_id: sessionId,
                        file_name: 'Data Cleaning Pipeline',
                        rules: rules.map(({ column, operation, params }) => ({ column, operation, params })),
                        total_rows: 0,
                        valid_rows: 0,
                        invalid_rows: 0,
                        module: 'enrichment',
                    },
                    { headers }
                );
            } catch (historyError) {
                console.error('Failed to save history:', historyError);
            }
            setStep(4);
        } catch (error) {
            alert(`Processing failed: ${error.response?.data?.detail || error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (format) => {
        if (!sessionId) return;
        try {
            const response = await axios.get(`${API_BASE}/features/export/${sessionId}?format=${format}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `dataset_cleaned.${format}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            alert(`Download failed: ${error.message}`);
        }
    };

    const resetWorkspace = () => {
        setStep(1);
        setRules([]);
        setSessionId(null);
        setColumns([]);
        setPreviewData([]);
        setWorkspaceTab('dataset');
        if (onComplete) onComplete();
    };

    const renderParams = (rule) => {
        const meta = getOperationMeta(rule.operation);
        if (!meta?.requires_input) {
            return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-400">No additional parameters required</span>;
        }

        if (rule.operation === 'fill_nulls') {
            return (
                <div className="flex flex-col gap-3">
                    <select
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition-all focus:border-emerald-500"
                        value={rule.params.method || 'mean'}
                        onChange={(event) => updateParams(rule.id, 'method', event.target.value)}
                    >
                        <option value="mean">Average (Mean)</option>
                        <option value="median">Median</option>
                        <option value="min">Minimum Value</option>
                        <option value="max">Maximum Value</option>
                        <option value="custom">Custom Value...</option>
                    </select>
                    {rule.params.method === 'custom' && (
                        <input
                            type="text"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition-all focus:border-emerald-500"
                            placeholder="e.g. Unknown, 0, Pending"
                            value={rule.params.custom_value || ''}
                            onChange={(event) => updateParams(rule.id, 'custom_value', event.target.value)}
                        />
                    )}
                </div>
            );
        }

        if (rule.operation === 'replace_value') {
            return (
                <div className="flex flex-col gap-2">
                    <select
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition-all focus:border-emerald-500"
                        value={rule.params.match_type || 'whole'}
                        onChange={(event) => updateParams(rule.id, 'match_type', event.target.value)}
                    >
                        <option value="whole">Replace Whole Cell (Exact Match)</option>
                        <option value="partial">Replace Partial Text (Substring)</option>
                    </select>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <input
                            type="text"
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition-all focus:border-emerald-500"
                            placeholder="Find text..."
                            value={rule.params.target_value || ''}
                            onChange={(event) => updateParams(rule.id, 'target_value', event.target.value)}
                        />
                        <input
                            type="text"
                            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition-all focus:border-emerald-500"
                            placeholder="Replace with..."
                            value={rule.params.replacement_value || ''}
                            onChange={(event) => updateParams(rule.id, 'replacement_value', event.target.value)}
                        />
                    </div>
                </div>
            );
        }

        if (rule.operation === 'deduplicate') {
            return (
                <div className="flex flex-col gap-3">
                    <div>
                        <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-slate-400">Subset Columns <span className="text-slate-300 font-normal normal-case">(leave empty to check all columns)</span></label>
                        <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 max-h-36 overflow-y-auto">
                            {columns.map((col) => (
                                <label key={col} className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-700">
                                    <input
                                        type="checkbox"
                                        className="accent-emerald-600 w-3.5 h-3.5"
                                        checked={(rule.params.subset_columns || []).includes(col)}
                                        onChange={(e) => {
                                            const prev = rule.params.subset_columns || [];
                                            const next = e.target.checked ? [...prev, col] : prev.filter(c => c !== col);
                                            updateParams(rule.id, 'subset_columns', next);
                                        }}
                                    />
                                    {col}
                                </label>
                            ))}
                            {columns.length === 0 && <span className="text-xs text-slate-400 italic">Upload a dataset first to see columns.</span>}
                        </div>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-slate-400">Keep Strategy</label>
                        <select
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition-all focus:border-emerald-500"
                            value={rule.params.keep || 'first'}
                            onChange={(e) => updateParams(rule.id, 'keep', e.target.value)}
                        >
                            <option value="first">Keep First Occurrence</option>
                            <option value="last">Keep Last Occurrence</option>
                            <option value="none">Remove ALL Duplicated Rows</option>
                        </select>
                    </div>
                </div>
            );
        }

        return null;
    };

    const effectiveStep = !sessionId ? 1 : step >= 4 ? 3 : step;

    return (
        <div className="flex h-full w-full flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
                <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50">
                        <Sparkles size={20} className="text-emerald-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-slate-900">Data Cleaning</h2>
                        <p className="mt-0.5 text-sm text-slate-500">Build an automated sequence of cleaning operations on your dataset.</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {STEPS.map((label, index) => {
                        const currentStep = index + 1;
                        return (
                            <div key={label} className="flex items-center">
                                <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${effectiveStep === currentStep ? 'bg-emerald-600 text-white' : effectiveStep > currentStep ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                    <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black ${effectiveStep === currentStep ? 'bg-white text-emerald-600' : effectiveStep > currentStep ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-500'}`}>{effectiveStep > currentStep ? '✓' : currentStep}</span>
                                    {label}
                                </div>
                                {currentStep < STEPS.length && <div className={`mx-1 h-px w-6 ${effectiveStep > currentStep ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6">
                {loading && (
                    <div className="flex h-64 flex-col items-center justify-center gap-4">
                        <Sparkles className="animate-pulse text-emerald-500" size={40} />
                        <p className="text-lg font-bold text-slate-700">Processing pipeline...</p>
                        <p className="text-sm text-slate-400">This may take a moment for large datasets.</p>
                    </div>
                )}

                {!loading && !sessionId && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="mb-5">
                            <h3 className="text-lg font-bold text-slate-800">Import Dataset</h3>
                            <p className="mt-1 text-sm text-slate-500">Upload a file or connect a database to begin building your cleaning pipeline.</p>
                        </div>
                        <DataConnection
                            compact={true}
                            onUploadSuccess={(data) => {
                                setSessionId(data.session_id);
                                setColumns(data.columns || []);
                                setSourceConfig(data.source_config || data.sourceConfig || null);
                                setRules([]);
                                setPreviewData([]);
                                setWorkspaceTab('dataset');
                                setStep(2);
                            }}
                        />
                    </motion.div>
                )}

                {!loading && sessionId && step <= 2 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Cleaning Workspace</h3>
                                <p className="mt-1 text-sm text-slate-500">Review source rows, import shared operation packs, and assemble reusable cleaning flows.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">{columns.length} columns</span>
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm">{rules.length} operation{rules.length !== 1 ? 's' : ''}</span>
                            </div>
                        </div>

                        <WorkspaceTabs tone="emerald" activeTab={workspaceTab} onChange={setWorkspaceTab} tabs={[{ id: 'dataset', label: 'Dataset' }, { id: 'rules', label: 'Pipeline' }]} />

                        {workspaceTab === 'dataset' ? (
                            <DatasetViewer sessionId={sessionId} tone="emerald" title="Cleaning Dataset" subtitle="Inspect source rows here, then jump back to the pipeline tab to configure transformations." />
                        ) : (
                            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">Cleaning Operations</h3>
                                        <p className="mt-1 text-sm text-slate-500">{rules.length} operation{rules.length !== 1 ? 's' : ''} in the current pipeline</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {embedded && (
                                            <button type="button" onClick={handleSaveConfig} disabled={!sessionId} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
                                                Apply to Pipeline
                                            </button>
                                        )}
                                        <button type="button" onClick={() => setShowRepoSidebar(true)} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100">
                                            <BookOpen size={16} /> Global Repo
                                        </button>
                                        <button type="button" onClick={saveCurrentRules} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100">
                                            <Save size={16} /> Save Config
                                        </button>
                                        {savedRuleSets.length > 0 && (
                                            <button type="button" onClick={() => setShowSavedRulesModal(true)} className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100">
                                                <FolderOpen size={16} /> Use Template
                                            </button>
                                        )}
                                        {pastJobs.length > 0 && (
                                            <button type="button" onClick={() => setShowHistoryModal(true)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100">
                                                <History size={16} /> Load Previous
                                            </button>
                                        )}
                                        <button type="button" onClick={addRule} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition-colors hover:bg-emerald-700">
                                            <Plus size={16} /> Add Operation
                                        </button>
                                    </div>
                                </div>

                                <div className="mb-6 space-y-3">
                                    <AnimatePresence>
                                        {rules.map((rule, index) => (
                                            <motion.div
                                                key={rule.id}
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="rounded-2xl border border-slate-200 border-l-4 border-l-emerald-400 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                                            >
                                                <div className="mb-4 flex items-center justify-between">
                                                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500">Operation {index + 1}</span>
                                                    <button type="button" onClick={() => removeRule(rule.id)} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600">
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                    <div>
                                                        <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-slate-400">Target Column</label>
                                                        <select className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10" value={rule.column} onChange={(event) => updateRule(rule.id, 'column', event.target.value)}>
                                                            <option value="" disabled>Select column...</option>
                                                            {columns.map((column) => <option key={column} value={column}>{column}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-slate-400">Cleaning Action</label>
                                                        <select className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10" value={rule.operation} onChange={(event) => updateRule(rule.id, 'operation', event.target.value)}>
                                                            <option value="" disabled>Select action...</option>
                                                            {operations.map((operation) => <option key={operation.id} value={operation.id}>{operation.name}</option>)}
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="mt-4">
                                                    <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-slate-400">Parameters</label>
                                                    {renderParams(rule)}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>

                                    {rules.length === 0 && (
                                        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-14 text-center">
                                            <AlertCircle className="mx-auto mb-3 text-slate-300" size={36} />
                                            <h3 className="mb-1 text-base font-bold text-slate-700">Pipeline is empty</h3>
                                            <p className="mb-5 text-sm text-slate-500">Add cleaning operations or import a shared template to get started.</p>
                                            <div className="flex flex-wrap items-center justify-center gap-3">
                                                <button type="button" onClick={() => setShowRepoSidebar(true)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100">Open Global Repo</button>
                                                <button type="button" onClick={addRule} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700">Add First Operation</button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {rules.length > 0 && !embedded && (
                                    <div className="flex justify-end border-t border-slate-100 pt-4">
                                        <button type="button" onClick={handlePreview} disabled={loading} className="flex items-center gap-2.5 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition-all hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
                                            <Eye size={16} /> Preview Cleaned Data
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}

                {!loading && !embedded && step === 3 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className="mb-5 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Data Preview</h3>
                                <p className="mt-1 text-sm text-slate-500">Top sample rows after applying your cleaning pipeline.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button type="button" onClick={() => { setWorkspaceTab('rules'); setStep(2); }} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50">
                                    <ArrowLeft size={15} /> Edit Pipeline
                                </button>
                                <button type="button" onClick={handleExecute} disabled={loading} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition-all hover:-translate-y-0.5 hover:bg-emerald-700">
                                    <Play size={16} fill="currentColor" /> Run on Full Dataset
                                </button>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            {previewData.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50">
                                                {Object.keys(previewData[0]).map((key) => <th key={key} className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-500">{key}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {previewData.map((row, index) => (
                                                <tr key={index} className="transition-colors hover:bg-slate-50/80">
                                                    {Object.values(row).map((value, valueIndex) => <td key={valueIndex} className="px-5 py-3 text-sm font-medium text-slate-700">{String(value)}</td>)}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="px-6 py-12 text-center">
                                    <AlertCircle className="mx-auto mb-3 text-slate-300" size={32} />
                                    <h4 className="text-base font-bold text-slate-700">No preview rows returned</h4>
                                    <p className="mt-2 text-sm text-slate-500">The pipeline ran, but there were no rows available in the sample output.</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {!loading && !embedded && step === 4 && (
                    <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-12 text-center">
                        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                            <CheckCircle className="text-emerald-600" size={44} />
                        </div>
                        <h3 className="mb-3 text-3xl font-black tracking-tight text-slate-900">Data Cleaned Successfully</h3>
                        <p className="mx-auto mb-10 max-w-md text-base text-slate-500">Your pipeline ran on the full dataset. Download the cleaned result in any format below.</p>
                        <div className="mx-auto mb-10 grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-3">
                            <DownloadCard fmt="csv" label="CSV Format" Icon={FileText} onClick={handleDownload} />
                            <DownloadCard fmt="xlsx" label="Excel Workbook" Icon={FileSpreadsheet} onClick={handleDownload} />
                            <DownloadCard fmt="json" label="JSON Array" Icon={FileJson} onClick={handleDownload} />
                        </div>
                        <button type="button" onClick={resetWorkspace} className="rounded-xl border-2 border-slate-200 px-8 py-3 text-sm font-bold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50">
                            Start New Cleaning Job
                        </button>
                    </motion.div>
                )}
            </div>

            <RepoSidebar
                isOpen={showRepoSidebar}
                onClose={() => setShowRepoSidebar(false)}
                context="cleaning"
                onApplyRules={applyRepoOperations}
                user={user}
                availableColumns={columns}
            />

            {/* History and Templates Modals */}
            <AnimatePresence>
                {showSavedRulesModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                            onClick={() => setShowSavedRulesModal(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-slate-900">Saved Operations</h3>
                                <button onClick={() => setShowSavedRulesModal(false)} className="text-slate-400 hover:text-slate-600">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-3">
                                {savedRuleSets.map((set) => (
                                    <div key={set.id} className="p-4 border border-slate-200 rounded-xl">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h4 className="font-bold text-slate-800">{set.name}</h4>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    {new Date(set.created_at).toLocaleString()} • {set.rules?.length || 0} operations
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => deleteSavedRuleSet(set.id)}
                                                className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => applySavedRuleSet(set)}
                                            className="w-full mt-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-colors"
                                        >
                                            Use This Template
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
                {showHistoryModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                            onClick={() => setShowHistoryModal(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-slate-900">Past Cleaning Pipelines</h3>
                                <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-3">
                                {pastJobs.map((job) => (
                                    <div key={job.id} className="p-4 border border-slate-200 rounded-xl hover:border-emerald-500/50 transition-colors group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-bold text-slate-800">{job.file_name || job.filename}</h4>
                                                <p className="text-xs text-slate-500">{new Date(job.created_at).toLocaleString()}</p>
                                            </div>
                                            <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded-lg">
                                                {job.rules.length} operations
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => loadRulesFromJob(job)}
                                            className="w-full mt-3 py-2 bg-slate-50 group-hover:bg-emerald-600 group-hover:text-white text-slate-600 rounded-lg font-medium text-sm transition-colors"
                                        >
                                            Apply Operations
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
