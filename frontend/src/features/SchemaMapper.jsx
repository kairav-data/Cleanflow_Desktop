import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Shuffle, ArrowRight, CheckCircle, Wand2, Upload, ArrowLeft, Play, Eye } from 'lucide-react';
import DataConnection from '../components/DataConnection';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'import.meta.env.VITE_API_URL';
const STEPS = ['Upload', 'Configure', 'Results'];

export default function SchemaMapper({ onComplete }) {
    const [transformations, setTransformations] = useState([]);
    const [targetColumns, setTargetColumns] = useState('');
    const [mappings, setMappings] = useState({});
    const [columnTransforms, setColumnTransforms] = useState({});
    const [previewData, setPreviewData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(0); // 0: Upload, 1: Configure, 2: Preview, 3: Complete
    const [sessionId, setSessionId] = useState(null);
    const [columns, setColumns] = useState([]);

    useEffect(() => { fetchTransformations(); }, []);

    const fetchTransformations = async () => {
        try {
            const res = await axios.get(`${API_BASE}/features/mapper/transformations`);
            setTransformations(res.data.transformations || []);
        } catch (e) { console.error('Error fetching transformations:', e); }
    };

    const handleAutoMap = () => {
        const targetCols = targetColumns.split('\n').filter(c => c.trim());
        const autoMappings = {};
        columns.forEach(sourceCol => {
            const match = targetCols.find(t =>
                sourceCol.toLowerCase().includes(t.toLowerCase()) ||
                t.toLowerCase().includes(sourceCol.toLowerCase())
            );
            if (match) autoMappings[sourceCol] = match;
        });
        setMappings(autoMappings);
    };

    const handlePreview = async () => {
        if (Object.keys(mappings).length === 0) return;
        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/features/mapper/preview/${sessionId}`, { mappings, transformations: columnTransforms });
            setPreviewData(res.data.data);
            setStep(2);
        } catch (e) { alert('Preview failed: ' + (e.response?.data?.detail || e.message)); }
        setLoading(false);
    };

    const handleExecute = async () => {
        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/features/mapper/execute/${sessionId}`, { mappings, transformations: columnTransforms });
            try {
                const token = localStorage.getItem('token');
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                await axios.post(`${API_BASE}/history/jobs`, {
                    session_id: sessionId, file_name: `Schema Mapping Job`,
                    rules: [{ mappings, transformations: columnTransforms }],
                    total_rows: 0, valid_rows: 0, invalid_rows: 0, module: 'mapper'
                }, { headers });
            } catch (histErr) { console.error("Failed to save history:", histErr); }
            setStep(3);
            if (onComplete) onComplete(res.data);
        } catch (e) { alert('Mapping failed: ' + (e.response?.data?.detail || e.message)); }
        setLoading(false);
    };

    const addTransformation = (targetCol, transformId) => {
        setColumnTransforms(prev => ({ ...prev, [targetCol]: [...(prev[targetCol] || []), transformId] }));
    };

    const mappedCount = Object.values(mappings).filter(Boolean).length;

    return (
        <div className="w-full h-full flex flex-col">
            {/* ── Page Header ── */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 bg-white shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                        <Shuffle size={20} className="text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Schema Mapping</h2>
                        <p className="text-sm text-slate-500 mt-0.5">Map source columns to a target schema with optional transforms.</p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {STEPS.map((label, i) => {
                        const s = i;
                        const effectiveStep = step === 0 ? 0 : step === 3 ? 2 : 1;
                        return (
                            <div key={s} className="flex items-center">
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                    effectiveStep === s ? 'bg-indigo-600 text-white' :
                                    effectiveStep > s ? 'bg-indigo-100 text-indigo-700' :
                                    'bg-slate-100 text-slate-400'
                                }`}>
                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                                        effectiveStep === s ? 'bg-white text-indigo-600' :
                                        effectiveStep > s ? 'bg-indigo-500 text-white' :
                                        'bg-slate-300 text-slate-500'
                                    }`}>{effectiveStep > s ? '✓' : s + 1}</span>
                                    {label}
                                </div>
                                {s < STEPS.length - 1 && <div className={`w-6 h-px mx-1 ${effectiveStep > s ? 'bg-indigo-300' : 'bg-slate-200'}`} />}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Content ── */}
            <div className="flex-1 overflow-y-auto px-8 py-6">

                {/* Step 0: Upload */}
                {step === 0 && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="mb-5">
                            <h3 className="text-lg font-bold text-slate-800">Import Dataset</h3>
                            <p className="text-sm text-slate-500 mt-1">Upload a file or connect a database to begin building your schema mapping pipeline.</p>
                        </div>
                        <DataConnection 
                            compact={true} 
                            onUploadSuccess={(data) => {
                                setSessionId(data.session_id);
                                setColumns(data.columns || []);
                                setStep(1);
                            }} 
                        />
                    </motion.div>
                )}

                {/* Step 1: Configure */}
                {step === 1 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                            {/* Target schema input */}
                            <div className="lg:col-span-2">
                                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                    <h3 className="text-sm font-bold text-slate-800 mb-1">Target Schema</h3>
                                    <p className="text-xs text-slate-500 mb-3">Enter one target column name per line.</p>
                                    <textarea
                                        value={targetColumns}
                                        onChange={e => setTargetColumns(e.target.value)}
                                        placeholder={"customer_first_name\ncustomer_last_name\ncontact_email"}
                                        rows={8}
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none resize-none placeholder:text-slate-400"
                                    />
                                    <button onClick={handleAutoMap}
                                        className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl font-semibold text-sm transition-colors">
                                        <Wand2 size={15} /> Auto-Map Columns
                                    </button>
                                </div>
                            </div>

                            {/* Column mappings */}
                            <div className="lg:col-span-3">
                                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-800">Column Mappings</h3>
                                            <p className="text-xs text-slate-500 mt-0.5">{mappedCount} of {columns.length} columns mapped</p>
                                        </div>
                                        {mappedCount > 0 && (
                                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">{mappedCount} mapped</span>
                                        )}
                                    </div>
                                    <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                                        {columns.map(sourceCol => (
                                            <div key={sourceCol} className="flex items-center gap-3">
                                                <div className="flex-1 px-3 py-2 bg-slate-100 rounded-lg text-sm font-semibold text-slate-700 truncate">{sourceCol}</div>
                                                <ArrowRight size={16} className="text-slate-400 shrink-0" />
                                                <select
                                                    value={mappings[sourceCol] || ''}
                                                    onChange={e => setMappings(prev => ({ ...prev, [sourceCol]: e.target.value }))}
                                                    className={`flex-1 px-3 py-2 border rounded-lg text-sm font-medium outline-none transition-all ${
                                                        mappings[sourceCol] ? 'border-indigo-300 bg-indigo-50 text-indigo-800 focus:ring-2 focus:ring-indigo-500/10' : 'border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10'
                                                    }`}
                                                >
                                                    <option value="">Unmapped</option>
                                                    {targetColumns.split('\n').filter(c => c.trim()).map(tc => (
                                                        <option key={tc} value={tc}>{tc}</option>
                                                    ))}
                                                </select>
                                                {mappings[sourceCol] && (
                                                    <select onChange={e => e.target.value && addTransformation(mappings[sourceCol], e.target.value)}
                                                        className="px-2 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 shrink-0 max-w-[110px]">
                                                        <option value="">+ Transform</option>
                                                        {transformations.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                    </select>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end mt-5 pt-4 border-t border-slate-100">
                            <button onClick={handlePreview} disabled={mappedCount === 0 || loading}
                                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-600/20 hover:-translate-y-0.5">
                                <Eye size={16} /> Preview Mapped Data
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Step 2: Preview */}
                {step === 2 && previewData && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Mapped Preview</h3>
                                <p className="text-sm text-slate-500 mt-1">Top 5 rows after schema mapping is applied.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setStep(1)} className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                                    <ArrowLeft size={15} /> Edit Mapping
                                </button>
                                <button onClick={handleExecute} disabled={loading}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-600/20 hover:-translate-y-0.5">
                                    <Play size={16} fill="currentColor" /> Apply to All Data
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

                {/* Step 3: Complete */}
                {step === 3 && (
                    <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-16">
                        <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="text-indigo-600" size={44} />
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-3">Mapping Complete!</h3>
                        <p className="text-slate-500 text-base mb-8">Your data has been successfully mapped to the target schema.</p>
                        <button onClick={() => onComplete && onComplete()}
                            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-600/20">
                            Continue
                        </button>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
