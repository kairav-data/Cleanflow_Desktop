import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Play, Eye, Download, CheckCircle, FileJson, FileSpreadsheet, FileText, Plus, Trash2, AlertCircle, ArrowLeft } from 'lucide-react';
import { DataConnection } from '../components';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'import.meta.env.VITE_API_URL';

const STEPS = ['Upload', 'Configure', 'Results'];

export default function EnrichmentBuilder({ sessionId: initialSessionId, columns: initialColumns, onComplete }) {
    const [sessionId, setSessionId] = useState(initialSessionId);
    const [columns, setColumns] = useState(initialColumns || []);
    const [operations, setOperations] = useState([]);
    const [rules, setRules] = useState([]);
    const [previewData, setPreviewData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);

    useEffect(() => { fetchOperations(); }, []);

    const fetchOperations = async () => {
        try {
            const cleanerRes = await axios.get(`${API_BASE}/features/cleaner/operations`);
            setOperations(cleanerRes.data.operations || []);
        } catch (e) { console.error('Error fetching cleaning operations:', e); }
    };

    const addRule = () => {
        setRules([...rules, { id: Date.now(), column: columns[0] || '', operation: operations[0]?.id || '', params: {} }]);
    };
    const removeRule = (id) => setRules(rules.filter(r => r.id !== id));
    const updateRule = (id, field, value) => {
        if (field === 'operation') {
            setRules(rules.map(r => r.id === id ? { ...r, [field]: value, params: {} } : r));
        } else {
            setRules(rules.map(r => r.id === id ? { ...r, [field]: value } : r));
        }
    };
    const updateParams = (id, paramKey, paramValue) => {
        setRules(rules.map(r => r.id === id ? { ...r, params: { ...r.params, [paramKey]: paramValue } } : r));
    };
    const buildPayload = () => ({ rules: rules.map(r => ({ column: r.column, operation: r.operation, params: r.params })) });
    const getOperationMeta = (opId) => operations.find(o => o.id === opId) || null;

    const handlePreview = async () => {
        if (rules.length === 0) return;
        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/features/cleaner/preview/${sessionId}`, buildPayload());
            setPreviewData(res.data.data);
            setStep(3);
        } catch (e) { alert('Preview failed: ' + (e.response?.data?.detail || e.message)); }
        setLoading(false);
    };

    const handleExecute = async () => {
        setLoading(true);
        try {
            await axios.post(`${API_BASE}/features/cleaner/execute/${sessionId}`, buildPayload());
            try {
                const token = localStorage.getItem('token');
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                await axios.post(`${API_BASE}/history/jobs`, {
                    session_id: sessionId, file_name: `Data Cleaning Pipeline`,
                    rules: rules.map(r => ({ column: r.column, operation: r.operation })),
                    total_rows: 0, valid_rows: 0, invalid_rows: 0, module: 'enrichment'
                }, { headers });
            } catch (histErr) { console.error("Failed to save history:", histErr); }
            setStep(4);
        } catch (e) { alert('Processing failed: ' + (e.response?.data?.detail || e.message)); }
        setLoading(false);
    };

    const handleDownload = async (format) => {
        try {
            const response = await axios.get(`${API_BASE}/features/export/${sessionId}?format=${format}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `dataset_cleaned.${format}`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (e) { alert('Download failed: ' + e.message); }
    };

    return (
        <div className="w-full h-full flex flex-col">
            {/* ── Page Header ── */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 bg-white shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                        <Sparkles size={20} className="text-emerald-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Data Cleaning</h2>
                        <p className="text-sm text-slate-500 mt-0.5">Build an automated sequence of cleaning operations on your dataset.</p>
                    </div>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center gap-1">
                    {STEPS.map((label, i) => {
                        const s = i + 1;
                        const effectiveStep = !sessionId ? 1 : step >= 4 ? 3 : 2;
                        return (
                            <div key={s} className="flex items-center">
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                    effectiveStep === s ? 'bg-emerald-600 text-white' :
                                    effectiveStep > s ? 'bg-emerald-100 text-emerald-700' :
                                    'bg-slate-100 text-slate-400'
                                }`}>
                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                                        effectiveStep === s ? 'bg-white text-emerald-600' :
                                        effectiveStep > s ? 'bg-emerald-500 text-white' :
                                        'bg-slate-300 text-slate-500'
                                    }`}>{effectiveStep > s ? '✓' : s}</span>
                                    {label}
                                </div>
                                {s < STEPS.length && <div className={`w-6 h-px mx-1 ${effectiveStep > s ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Content Area ── */}
            <div className="flex-1 overflow-y-auto px-8 py-6">

                {/* Loading overlay */}
                {loading && (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <Sparkles className="animate-pulse text-emerald-500" size={40} />
                        <p className="text-lg font-bold text-slate-700">Processing pipeline…</p>
                        <p className="text-sm text-slate-400">This may take a moment for large datasets.</p>
                    </div>
                )}

                {/* Step 1: Upload */}
                {!loading && !sessionId && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="mb-5">
                            <h3 className="text-lg font-bold text-slate-800">Import Dataset</h3>
                            <p className="text-sm text-slate-500 mt-1">Upload a file or connect a database to begin building your cleaning pipeline.</p>
                        </div>
                        <DataConnection compact={true} onUploadSuccess={(data) => {
                            setSessionId(data.session_id);
                            setColumns(data.columns || []);
                        }} />
                    </motion.div>
                )}

                {/* Step 2: Configure Operations */}
                {!loading && sessionId && step <= 2 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Cleaning Operations</h3>
                                <p className="text-sm text-slate-500 mt-1">{rules.length} operation{rules.length !== 1 ? 's' : ''} in pipeline</p>
                            </div>
                            <button
                                onClick={addRule}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm shadow-emerald-600/20"
                            >
                                <Plus size={16} /> Add Operation
                            </button>
                        </div>

                        <div className="space-y-3 mb-6">
                            <AnimatePresence>
                                {rules.map((rule, idx) => {
                                    const opMeta = getOperationMeta(rule.operation);
                                    return (
                                        <motion.div
                                            key={rule.id}
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="bg-white border border-slate-200 border-l-4 border-l-emerald-400 rounded-2xl p-5 relative shadow-sm hover:shadow-md transition-shadow"
                                        >
                                            <div>
                                                {/* Card header: number + delete */}
                                                <div className="flex items-center justify-between mb-4">
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                                                        Operation {idx + 1}
                                                    </span>
                                                    <button onClick={() => removeRule(rule.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                        title="Remove">
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">Target Column</label>
                                                    <select
                                                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 outline-none transition-all"
                                                        value={rule.column}
                                                        onChange={(e) => updateRule(rule.id, 'column', e.target.value)}
                                                    >
                                                        <option value="" disabled>Select column…</option>
                                                        {(columns || []).map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">Cleaning Action</label>
                                                    <select
                                                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 outline-none transition-all"
                                                        value={rule.operation}
                                                        onChange={(e) => updateRule(rule.id, 'operation', e.target.value)}
                                                    >
                                                        <option value="" disabled>Select action…</option>
                                                        {operations.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
                                                    </select>
                                                </div>
                                                </div>

                                                {opMeta?.requires_input && (
                                                    <div className="md:col-span-2">
                                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">Parameters</label>
                                                        <div className="flex flex-col gap-3">
                                                            {rule.operation === 'fill_nulls' && (
                                                                <>
                                                                    <select className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-emerald-500 outline-none"
                                                                        onChange={e => updateParams(rule.id, 'method', e.target.value)} value={rule.params.method || 'mean'}>
                                                                        <option value="mean">Average (Mean)</option>
                                                                        <option value="median">Median</option>
                                                                        <option value="min">Minimum Value</option>
                                                                        <option value="max">Maximum Value</option>
                                                                        <option value="custom">Custom Value…</option>
                                                                    </select>
                                                                    {rule.params.method === 'custom' && (
                                                                        <input type="text" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-emerald-500 outline-none"
                                                                            placeholder="e.g. 'Unknown', '0', 'Pending'"
                                                                            value={rule.params.custom_value || ''}
                                                                            onChange={e => updateParams(rule.id, 'custom_value', e.target.value)} />
                                                                    )}
                                                                </>
                                                            )}
                                                            {rule.operation === 'replace_value' && (
                                                                <div className="flex flex-col gap-2">
                                                                    <select className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-emerald-500 outline-none"
                                                                        onChange={e => updateParams(rule.id, 'match_type', e.target.value)} value={rule.params.match_type || 'whole'}>
                                                                        <option value="whole">Replace Whole Cell (Exact Match)</option>
                                                                        <option value="partial">Replace Partial Text (Substring)</option>
                                                                    </select>
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <input type="text" className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-emerald-500 outline-none" placeholder="Find text…"
                                                                            value={rule.params.target_value || ''} onChange={e => updateParams(rule.id, 'target_value', e.target.value)} />
                                                                        <input type="text" className="px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-medium focus:border-emerald-500 outline-none" placeholder="Replace with…"
                                                                            value={rule.params.replacement_value || ''} onChange={e => updateParams(rule.id, 'replacement_value', e.target.value)} />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {!opMeta?.requires_input && (
                                                    <div className="md:col-span-2 flex items-center">
                                                        <span className="text-xs font-semibold text-slate-400 bg-slate-100 py-1 px-3 rounded-full">No additional parameters required</span>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>

                            {rules.length === 0 && (
                                <div className="text-center py-14 bg-white border-2 border-dashed border-slate-200 rounded-2xl">
                                    <AlertCircle className="mx-auto text-slate-300 mb-3" size={36} />
                                    <h3 className="text-base font-bold text-slate-700 mb-1">Pipeline is empty</h3>
                                    <p className="text-slate-500 text-sm mb-5">Add cleaning operations to get started.</p>
                                    <button onClick={addRule} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors">
                                        + Add First Operation
                                    </button>
                                </div>
                            )}
                        </div>

                        {rules.length > 0 && (
                            <div className="flex justify-end pt-4 border-t border-slate-100">
                                <button onClick={handlePreview} disabled={rules.length === 0 || loading}
                                    className="flex items-center gap-2.5 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-emerald-600/20 hover:-translate-y-0.5">
                                    <Eye size={16} /> Preview Cleaned Data
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Step 3: Preview */}
                {!loading && step === 3 && previewData && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Data Preview</h3>
                                <p className="text-sm text-slate-500 mt-1">Top 5 sample rows after applying your pipeline.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setStep(2)} className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                                    <ArrowLeft size={15} /> Edit Pipeline
                                </button>
                                <button onClick={handleExecute} disabled={loading}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-emerald-600/20 hover:-translate-y-0.5">
                                    <Play size={16} fill="currentColor" /> Run on Full Dataset
                                </button>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            {Object.keys(previewData[0] || {}).map(key => (
                                                <th key={key} className="px-5 py-3 text-left text-[11px] uppercase tracking-widest font-bold text-slate-500 whitespace-nowrap">{key}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {previewData.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                                {Object.values(row).map((val, i) => (
                                                    <td key={i} className="px-5 py-3 text-sm text-slate-700 font-medium">{String(val)}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Step 4: Complete / Export */}
                {!loading && step === 4 && (
                    <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-12">
                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="text-emerald-600" size={44} />
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-3">Data Cleaned Successfully</h3>
                        <p className="text-slate-500 text-base mb-10 max-w-md mx-auto">Your pipeline ran on the full dataset. Download your result in any format below.</p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto mb-10">
                            {[
                                { fmt: 'csv',  label: 'CSV Format',   Icon: FileText },
                                { fmt: 'xlsx', label: 'Excel Workbook', Icon: FileSpreadsheet },
                                { fmt: 'json', label: 'JSON Array',   Icon: FileJson },
                            ].map(({ fmt, label, Icon }) => (
                                <button key={fmt} onClick={() => handleDownload(fmt)}
                                    className="flex flex-col items-center gap-3 py-7 border-2 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 rounded-2xl transition-all group hover:-translate-y-1 hover:shadow-lg">
                                    <div className="w-12 h-12 bg-slate-100 group-hover:bg-white rounded-xl flex items-center justify-center transition-colors shadow-sm">
                                        <Icon className="text-slate-500 group-hover:text-emerald-600 transition-colors" size={26} />
                                    </div>
                                    <span className="text-sm font-bold text-slate-700 group-hover:text-emerald-700">{label}</span>
                                </button>
                            ))}
                        </div>

                        <button onClick={() => { setStep(1); setRules([]); if (onComplete) onComplete(); }}
                            className="px-8 py-3 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm transition-all">
                            Start New Cleaning Job
                        </button>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
