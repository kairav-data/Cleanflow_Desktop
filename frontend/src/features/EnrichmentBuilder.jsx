import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Play, Eye, Download, CheckCircle, FileJson, FileSpreadsheet, FileText, Plus, Trash2, AlertCircle } from 'lucide-react';
import { DataConnection } from '../components';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'import.meta.env.VITE_API_URL';

export default function EnrichmentBuilder({ sessionId: initialSessionId, columns: initialColumns, onComplete }) {
    const [sessionId, setSessionId] = useState(initialSessionId);
    const [columns, setColumns] = useState(initialColumns || []);
    
    const [operations, setOperations] = useState([]);
    const [rules, setRules] = useState([]);
    
    const [previewData, setPreviewData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Builder, 2: Preview, 3: Complete

    useEffect(() => {
        fetchOperations();
    }, []);

    const fetchOperations = async () => {
        try {
            // Fetch ONLY Cleaner options (User explicitly requested strict cleaning feature, excluding external enrichment hooks)
            const cleanerRes = await axios.get(`${API_BASE}/features/cleaner/operations`);
            setOperations(cleanerRes.data.operations || []);
        } catch (e) {
            console.error('Error fetching cleaning operations:', e);
        }
    };

    const addRule = () => {
        setRules([...rules, {
            id: Date.now(),
            column: columns[0] || '',
            operation: operations[0]?.id || '',
            params: {}
        }]);
    };

    const removeRule = (id) => {
        setRules(rules.filter(r => r.id !== id));
    };

    const updateRule = (id, field, value) => {
        if (field === 'operation') {
            setRules(rules.map(r => r.id === id ? { ...r, [field]: value, params: {} } : r));
        } else {
            setRules(rules.map(r => r.id === id ? { ...r, [field]: value } : r));
        }
    };

    const updateParams = (id, paramKey, paramValue) => {
        setRules(rules.map(r => {
            if (r.id === id) {
                return { ...r, params: { ...r.params, [paramKey]: paramValue } };
            }
            return r;
        }));
    };

    const buildPayload = () => {
        return {
            rules: rules.map(r => ({
                column: r.column,
                operation: r.operation,
                params: r.params
            }))
        };
    };

    const handlePreview = async () => {
        if (rules.length === 0) return;

        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/features/cleaner/preview/${sessionId}`, buildPayload());
            setPreviewData(res.data.data);
            setStep(2);
        } catch (e) {
            alert('Preview failed: ' + (e.response?.data?.detail || e.message));
        }
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
                    session_id: sessionId,
                    file_name: `Data Cleaning Pipeline`,
                    rules: rules.map(r => ({ column: r.column, operation: r.operation })),
                    total_rows: 0, valid_rows: 0, invalid_rows: 0,
                    module: 'enrichment'
                }, { headers });
            } catch (histErr) {
                console.error("Failed to save history:", histErr);
            }

            setStep(3);
        } catch (e) {
            alert('Processing failed: ' + (e.response?.data?.detail || e.message));
        }
        setLoading(false);
    };
    
    const handleDownload = async (format) => {
        try {
            const response = await axios.get(`${API_BASE}/features/export/${sessionId}?format=${format}`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `dataset_cleaned.${format}`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (e) {
            alert('Download failed: ' + e.message);
        }
    };

    const getOperationMeta = (opId) => {
        return operations.find(o => o.id === opId) || null;
    };

    return (
        <div className="bg-white p-6 md:p-10 rounded-[32px] shadow-2xl border border-slate-200/60 max-w-5xl mx-auto">
            <div className="mb-8 p-8 bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row items-center gap-6">
                <div className="bg-white/10 w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-md border border-white/20">
                    <Sparkles size={32} className="text-emerald-400" />
                </div>
                <div className="text-center md:text-left relative z-10">
                    <h2 className="text-3xl font-black mb-2 tracking-tight">Data Cleaner Pipeline</h2>
                    <p className="text-slate-300 font-medium max-w-xl text-sm md:text-base">Construct an automated sequence of cleaning steps to fix nulls, standardize formatting, and replace anomalies.</p>
                </div>
                <Sparkles size={120} className="absolute -right-6 -bottom-8 text-white/5 rotate-12" />
            </div>

            {/* Visual Stepper */}
            <div className="flex items-center justify-center mb-10 px-4">
                {[
                    { id: 1, label: 'Upload Data' },
                    { id: 2, label: 'Review Sample' },
                    { id: 3, label: 'Export' }
                ].map((s, i) => (
                    <React.Fragment key={s.id}>
                        <div className="flex flex-col items-center gap-2">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-500
                                ${step === s.id ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30' 
                                : step > s.id ? 'bg-slate-900 border-slate-900 text-white' 
                                : 'bg-white border-slate-200 text-slate-400'}
                            `}>
                                {step > s.id ? <CheckCircle size={18} /> : s.id}
                            </div>
                            <span className={`text-xs font-bold uppercase tracking-wider ${step >= s.id ? 'text-slate-700' : 'text-slate-400'}`}>{s.label}</span>
                        </div>
                        {i < 2 && (
                            <div className={`flex-1 h-1 mx-4 rounded-full transition-colors duration-500 max-w-[100px] ${step > s.id ? 'bg-slate-900' : 'bg-slate-100'}`} />
                        )}
                    </React.Fragment>
                ))}
            </div>

            {!sessionId && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-50 p-5 md:p-6 rounded-[24px] border border-slate-200">
                    <h2 className="text-xl font-bold text-slate-900 mb-2">1. Upload Dataset</h2>
                    <p className="text-slate-600 mb-5 font-medium text-sm md:text-base">Provide a dataset to start building cleaning operations.</p>
                    <DataConnection 
                        compact={true}
                        onUploadSuccess={(data) => {
                            setSessionId(data.session_id);
                            setColumns(data.columns || []);
                        }}
                    />
                </motion.div>
            )}

            {sessionId && step === 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg md:text-xl font-bold text-slate-900">Cleaning Operations Flow</h3>
                        <button
                            onClick={addRule}
                            className="flex items-center gap-2 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg font-semibold text-sm transition-colors"
                        >
                            <Plus size={16} /> Add Operation
                        </button>
                    </div>

                    <div className="space-y-4 mb-8">
                        <AnimatePresence>
                            {rules.map((rule, idx) => {
                                const opMeta = getOperationMeta(rule.operation);
                                return (
                                <motion.div
                                    key={rule.id}
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="p-5 md:p-6 rounded-2xl bg-white border border-slate-200 flex flex-col gap-4 relative shadow-sm hover:shadow-lg transition-all group group/node"
                                >
                                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 bg-slate-900 text-white w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border-4 border-white shadow-md z-10 transition-transform group-hover/node:scale-110">
                                        {idx + 1}
                                    </div>
                                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-l-2xl opacity-0 group-hover/node:opacity-100 transition-opacity" />
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full pt-2">
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Target Column</label>
                                            <select
                                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium focus:border-emerald-500 outline-none text-sm"
                                                value={rule.column}
                                                onChange={(e) => updateRule(rule.id, 'column', e.target.value)}
                                            >
                                                <option value="" disabled>Select column...</option>
                                                {(columns || []).map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Action</label>
                                            <select
                                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium focus:border-emerald-500 outline-none text-sm"
                                                value={rule.operation}
                                                onChange={(e) => updateRule(rule.id, 'operation', e.target.value)}
                                            >
                                                <option value="" disabled>Select action...</option>
                                                {operations.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
                                            </select>
                                        </div>

                                        <div className="md:col-span-2">
                                            {opMeta?.requires_input ? (
                                                <>
                                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Parameters</label>
                                                    <div className="flex flex-col gap-3">
                                                        {rule.operation === 'fill_nulls' && (
                                                            <>
                                                                <select 
                                                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg font-medium focus:border-emerald-500 outline-none text-sm"
                                                                    onChange={(e) => updateParams(rule.id, 'method', e.target.value)}
                                                                    value={rule.params.method || 'mean'}
                                                                >
                                                                    <option value="mean">Average (Mean)</option>
                                                                    <option value="median">Median</option>
                                                                    <option value="min">Minimum Value</option>
                                                                    <option value="max">Maximum Value</option>
                                                                    <option value="custom">Specific Custom Value...</option>
                                                                </select>
                                                                {rule.params.method === 'custom' && (
                                                                    <input 
                                                                        type="text" 
                                                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium focus:border-emerald-500 outline-none text-sm"
                                                                        placeholder="e.g. 'Unknown', '0', 'Pending'"
                                                                        value={rule.params.custom_value || ''}
                                                                        onChange={(e) => updateParams(rule.id, 'custom_value', e.target.value)}
                                                                    />
                                                                )}
                                                            </>
                                                        )}

                                                        {rule.operation === 'replace_value' && (
                                                            <div className="flex flex-col gap-2">
                                                                <select 
                                                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg font-medium focus:border-emerald-500 outline-none text-sm"
                                                                    onChange={(e) => updateParams(rule.id, 'match_type', e.target.value)}
                                                                    value={rule.params.match_type || 'whole'}
                                                                >
                                                                    <option value="whole">Replace Whole Cell (Exact Match)</option>
                                                                    <option value="partial">Replace Partial Text (Substring Match)</option>
                                                                </select>
                                                                <div className="flex gap-2">
                                                                    <input 
                                                                        type="text" 
                                                                        className="w-1/2 p-2.5 bg-white border border-slate-200 rounded-lg font-medium focus:border-emerald-500 outline-none text-sm placeholder:italic"
                                                                        placeholder="Find text..."
                                                                        value={rule.params.target_value || ''}
                                                                        onChange={(e) => updateParams(rule.id, 'target_value', e.target.value)}
                                                                    />
                                                                    <input 
                                                                        type="text" 
                                                                        className="w-1/2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg font-medium focus:border-emerald-500 outline-none text-sm placeholder:italic"
                                                                        placeholder="Replace with..."
                                                                        value={rule.params.replacement_value || ''}
                                                                        onChange={(e) => updateParams(rule.id, 'replacement_value', e.target.value)}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="h-full pt-2 px-1 flex items-start">
                                                    <span className="text-xs font-bold text-slate-400 bg-slate-100 py-1 px-3 rounded-full uppercase tracking-wider">No parameters mapping needed</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => removeRule(rule.id)}
                                        className="text-slate-400 hover:text-white hover:bg-red-500 p-2.5 rounded-xl transition-all self-end border border-slate-200 hover:border-red-500 hover:shadow-md"
                                        title="Remove Node"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </motion.div>
                            )})}
                        </AnimatePresence>

                        {rules.length === 0 && (
                            <div className="text-center py-10 bg-slate-50 rounded-[24px] border border-dashed border-slate-200">
                                <AlertCircle className="mx-auto text-slate-300 mb-3" size={32} />
                                <h3 className="text-lg font-bold text-slate-700 mb-1">Your pipeline is empty</h3>
                                <p className="text-slate-500 mb-5 text-sm">Build a sequence of cleaning tasks to repair issues instantly.</p>
                                <button onClick={addRule} className="text-emerald-600 font-bold hover:bg-emerald-50 px-5 py-2 rounded-lg transition-colors border border-transparent hover:border-emerald-100">
                                    + Add your first step
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handlePreview}
                        disabled={rules.length === 0 || loading}
                        className="w-full mt-6 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:border disabled:border-slate-200 text-white rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-600/30 disabled:shadow-none pointer-events-auto hover:-translate-y-0.5"
                    >
                        {loading ? <Sparkles className="animate-pulse" size={20} /> : <Eye size={20} />} 
                        {loading ? 'Compiling Pipeline...' : 'Generate Target Preview'}
                    </button>
                </motion.div>
            )}

            {step === 2 && previewData && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Data Preview</h3>
                                <p className="text-sm font-medium text-slate-500 mt-1">Verify that your pipeline performs perfectly before full execution.</p>
                            </div>
                            <span className="text-xs font-black uppercase tracking-wider bg-slate-900 text-white px-4 py-2 rounded-xl shadow-md flex items-center gap-2">
                                <FileJson size={14} /> Top 5 Records
                            </span>
                        </div>
                        <div className="overflow-x-auto rounded-2xl border-2 border-slate-200 shadow-sm">
                            <table className="w-full border-collapse bg-white">
                                <thead>
                                    <tr className="bg-slate-50 border-b-2 border-slate-200">
                                        {Object.keys(previewData[0] || {}).map(key => (
                                            <th key={key} className="p-4 text-left text-xs uppercase tracking-widest font-bold text-slate-500 whitespace-nowrap">{key}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.map((row, idx) => (
                                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                            {Object.values(row).map((val, i) => (
                                                <td key={i} className="p-4 text-sm font-medium text-slate-700">{String(val)}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 mt-8 pt-6 border-t border-slate-100">
                        <button
                            onClick={() => setStep(1)}
                            className="flex-1 py-4 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-2xl font-black text-slate-700 transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                            <Trash2 size={18} /> Modify Pipeline
                        </button>
                        <button
                            onClick={handleExecute}
                            disabled={loading}
                            className={`flex-[2] py-4 rounded-2xl font-black flex items-center justify-center gap-3 transition-all shadow-xl text-white ${loading ? 'bg-slate-800 shadow-slate-900/30' : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-600/30 hover:-translate-y-0.5'}`}
                        >
                            {loading ? <Sparkles className="animate-spin" size={20} /> : <Play size={20} fill="currentColor"/>}
                            {loading ? 'Executing on Full Dataset...' : 'Execute Entire Dataset'}
                        </button>
                    </div>
                </motion.div>
            )}

            {step === 3 && (
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-16 px-4">
                    <CheckCircle className="mx-auto text-emerald-600 mb-6" size={80} />
                    <h3 className="text-4xl font-black mb-4 text-slate-900 tracking-tight">Data Ready & Cleaned!</h3>
                    <p className="text-slate-500 font-medium text-lg mb-12 max-w-md mx-auto">Your pipeline successfully ran across the dataset. Select your desired export format below.</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12 max-w-2xl mx-auto">
                        <button onClick={() => handleDownload('csv')} className="flex flex-col items-center justify-center p-8 bg-white border-2 border-slate-100 hover:border-emerald-500 rounded-[28px] hover:bg-emerald-50 transition-all group hover:-translate-y-2 hover:shadow-xl shadow-sm">
                            <div className="w-16 h-16 bg-slate-50 group-hover:bg-white rounded-2xl flex items-center justify-center mb-4 transition-colors shadow-sm">
                                <FileText className="text-slate-400 group-hover:text-emerald-600" size={32}/>
                            </div>
                            <span className="font-bold text-slate-700 group-hover:text-emerald-700">CSV Formatted</span>
                        </button>
                        <button onClick={() => handleDownload('xlsx')} className="flex flex-col items-center justify-center p-8 bg-white border-2 border-slate-100 hover:border-emerald-500 rounded-[28px] hover:bg-emerald-50 transition-all group hover:-translate-y-2 hover:shadow-xl shadow-sm">
                            <div className="w-16 h-16 bg-slate-50 group-hover:bg-white rounded-2xl flex items-center justify-center mb-4 transition-colors shadow-sm">
                                <FileSpreadsheet className="text-slate-400 group-hover:text-emerald-600" size={32}/>
                            </div>
                            <span className="font-bold text-slate-700 group-hover:text-emerald-700">Excel Book</span>
                        </button>
                        <button onClick={() => handleDownload('json')} className="flex flex-col items-center justify-center p-8 bg-white border-2 border-slate-100 hover:border-emerald-500 rounded-[28px] hover:bg-emerald-50 transition-all group hover:-translate-y-2 hover:shadow-xl shadow-sm">
                            <div className="w-16 h-16 bg-slate-50 group-hover:bg-white rounded-2xl flex items-center justify-center mb-4 transition-colors shadow-sm">
                                <FileJson className="text-slate-400 group-hover:text-emerald-600" size={32}/>
                            </div>
                            <span className="font-bold text-slate-700 group-hover:text-emerald-700">JSON Array</span>
                        </button>
                    </div>

                    <button
                        onClick={() => {
                            setStep(1); 
                            setRules([]);
                            if(onComplete) onComplete();
                        }}
                        className="px-10 py-4 bg-slate-900 border-2 border-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-lg transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
                    >
                        Back to Dashboard Overview
                    </button>
                </motion.div>
            )}
        </div>
    );
}
