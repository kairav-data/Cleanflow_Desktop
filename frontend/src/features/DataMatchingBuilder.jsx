import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { GitMerge, Upload, Play, CheckCircle, TrendingUp, Plus, Trash2, Database, File } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'import.meta.env.VITE_API_URL';
const STEPS = ['Upload', 'Configure', 'Results'];

export default function DataMatchingBuilder({ onComplete }) {
    const [algorithms, setAlgorithms] = useState([]);
    const [matchRules, setMatchRules] = useState([{ id: 1, column1: '', column2: '', algorithm: 'fuzzy', threshold: 0.8 }]);
    const [datasets, setDatasets] = useState({ dataset1: null, dataset2: null });
    const [datasetColumns, setDatasetColumns] = useState({ dataset1: [], dataset2: [] });
    const [outputColumns, setOutputColumns] = useState({ dataset1: [], dataset2: [] });
    const [sessionId] = useState(`match_${Date.now()}`);
    const [finalResults, setFinalResults] = useState(null);
    const [totalMatches, setTotalMatches] = useState(0);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState({ percent: 0, message: '', status: 'idle' });
    const [step, setStep] = useState(1);
    const [separators, setSeparators] = useState({ dataset1: ',', dataset2: ',' });
    const [elapsedTime, setElapsedTime] = useState(0);
    const [connections, setConnections] = useState([]);
    const [datasetMode, setDatasetMode] = useState({ dataset1: 'file', dataset2: 'file' });
    const [datasetQueries, setDatasetQueries] = useState({ dataset1: 'SELECT * FROM table1 LIMIT 100', dataset2: 'SELECT * FROM table2 LIMIT 100' });
    const [datasetConnections, setDatasetConnections] = useState({ dataset1: '', dataset2: '' });

    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    useEffect(() => {
        let interval;
        if (loading) {
            const start = Date.now();
            interval = setInterval(() => setElapsedTime(Math.floor((Date.now() - start) / 1000)), 1000);
        } else { setElapsedTime(0); }
        return () => clearInterval(interval);
    }, [loading]);

    useEffect(() => { fetchAlgorithms(); fetchConnections(); }, []);

    const fetchAlgorithms = async () => {
        try { const res = await axios.get(`${API_BASE}/features/matching/algorithms`); setAlgorithms(res.data.algorithms || []); }
        catch (e) { console.error('Error fetching algorithms:', e); }
    };

    const fetchConnections = async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${API_BASE}/history/connections`, { headers });
            setConnections(res.data);
            if (res.data.length > 0) setDatasetConnections({ dataset1: res.data[0].id, dataset2: res.data[0].id });
        } catch (err) { console.error("Could not load saved connections.", err); }
    };

    const handleDatabaseIngest = async (datasetId) => {
        const query = datasetQueries[datasetId];
        const connectionId = datasetConnections[datasetId];
        if (!query || !connectionId) return;
        try {
            const res = await axios.post(`${API_BASE}/features/matching/ingest-database`, {
                session_id: sessionId, dataset_id: datasetId, connection_id: connectionId, query
            }, { headers });
            setDatasets(prev => ({ ...prev, [datasetId]: true }));
            setDatasetColumns(prev => ({ ...prev, [datasetId]: res.data.columns }));
        } catch (e) { alert('Database import failed: ' + (e.response?.data?.detail || e.message || e)); }
    };

    const handleFileUpload = async (datasetId, file) => {
        try {
            const formData = new FormData();
            formData.append('session_id', sessionId);
            formData.append('dataset_id', datasetId);
            formData.append('delimiter', separators[datasetId] || ',');
            formData.append('file', file);
            const res = await axios.post(`${API_BASE}/features/matching/upload-dataset`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setDatasets(prev => ({ ...prev, [datasetId]: true }));
            setDatasetColumns(prev => ({ ...prev, [datasetId]: res.data.columns }));
        } catch (e) { alert('Upload failed: ' + (e.response?.data?.detail || e.message || e)); }
    };

    const addRule = () => setMatchRules(prev => [...prev, { id: Date.now(), column1: '', column2: '', algorithm: algorithms[0]?.id || 'fuzzy', threshold: 0.8 }]);
    const removeRule = (id) => setMatchRules(prev => prev.filter(r => r.id !== id));
    const updateRule = (id, field, value) => setMatchRules(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    const toggleOutputColumn = (datasetId, column) => {
        setOutputColumns(prev => ({
            ...prev,
            [datasetId]: prev[datasetId].includes(column) ? prev[datasetId].filter(c => c !== column) : [...prev[datasetId], column]
        }));
    };

    const handleExecute = async () => {
        setLoading(true);
        try {
            const validRules = matchRules.filter(r => r.column1 && r.column2);
            await axios.post(`${API_BASE}/features/matching/start/${sessionId}`, { dataset1: 'dataset1', dataset2: 'dataset2', rules: validRules, output_columns: outputColumns });

            const interval = setInterval(async () => {
                try {
                    const res = await axios.get(`${API_BASE}/features/matching/status/${sessionId}`);
                    setProgress(res.data);
                    if (res.data.status === 'completed') {
                        clearInterval(interval);
                        setLoading(false);
                        const resultRes = await axios.get(`${API_BASE}/features/matching/results/${sessionId}`);
                        setFinalResults(resultRes.data.results);
                        setTotalMatches(resultRes.data.total_matches || resultRes.data.results.length);
                        try {
                            await axios.post(`${API_BASE}/history/jobs`, {
                                session_id: sessionId, file_name: `Data Matching Job`, rules: validRules,
                                total_rows: resultRes.data.total_matches || resultRes.data.results.length,
                                valid_rows: resultRes.data.total_matches || resultRes.data.results.length,
                                invalid_rows: 0, module: 'matching'
                            }, { headers });
                        } catch (histErr) { console.error("Failed to save history:", histErr); }
                        setStep(3);
                        if (onComplete) onComplete(resultRes.data);
                    } else if (res.data.status === 'error') {
                        clearInterval(interval);
                        setLoading(false);
                        alert('Matching error: ' + res.data.message);
                    }
                } catch (e) { console.error("Polling error", e); }
            }, 1000);
        } catch (e) { setLoading(false); alert('Matching start failed: ' + (e.response?.data?.detail || e.message)); }
    };

    return (
        <div className="w-full h-full flex flex-col">
            {/* ── Page Header ── */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 bg-white shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center">
                        <GitMerge size={20} className="text-violet-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Data Matching</h2>
                        <p className="text-sm text-slate-500 mt-0.5">Match records across two datasets using fuzzy or exact algorithms.</p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {STEPS.map((label, i) => {
                        const s = i + 1;
                        return (
                            <div key={s} className="flex items-center">
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                    step === s ? 'bg-violet-600 text-white' :
                                    step > s ? 'bg-violet-100 text-violet-700' :
                                    'bg-slate-100 text-slate-400'
                                }`}>
                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                                        step === s ? 'bg-white text-violet-600' :
                                        step > s ? 'bg-violet-500 text-white' :
                                        'bg-slate-300 text-slate-500'
                                    }`}>{step > s ? '✓' : s}</span>
                                    {label}
                                </div>
                                {s < STEPS.length && <div className={`w-6 h-px mx-1 ${step > s ? 'bg-violet-300' : 'bg-slate-200'}`} />}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Content ── */}
            <div className="flex-1 overflow-y-auto px-8 py-6">

                {/* ── Loading Screen ── */}
                {loading && (
                    <div className="flex flex-col items-center justify-center h-64 gap-5">
                        <div className="w-full max-w-md">
                            <div className="flex items-center justify-between text-sm font-semibold text-slate-600 mb-2">
                                <span>{progress.message || 'Initializing…'}</span>
                                <span>{progress.percent}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                <motion.div
                                    className="bg-violet-600 h-full rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress.percent}%` }}
                                    transition={{ duration: 0.5 }}
                                />
                            </div>
                        </div>
                        <p className="text-slate-400 text-sm">Elapsed: <span className="font-mono font-bold">{Math.floor(elapsedTime / 60)}:{String(elapsedTime % 60).padStart(2, '0')}</span></p>
                    </div>
                )}

                {/* ── Step 1: Upload ── */}
                {!loading && step === 1 && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="mb-5">
                            <h3 className="text-base font-bold text-slate-800">Upload Two Datasets</h3>
                            <p className="text-sm text-slate-500 mt-1">Provide both datasets you want to match records across.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                            {['dataset1', 'dataset2'].map((dsId, idx) => (
                                <div key={dsId} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                                                <span className="text-xs font-black text-violet-600">{idx + 1}</span>
                                            </div>
                                            <h3 className="font-bold text-sm text-slate-800">Dataset {idx + 1}</h3>
                                        </div>
                                        {/* File / DB Toggle */}
                                        <div className="flex bg-slate-100 rounded-lg p-0.5">
                                            {['file', 'database'].map(mode => (
                                                <button key={mode} onClick={() => setDatasetMode(prev => ({ ...prev, [dsId]: mode }))}
                                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${datasetMode[dsId] === mode ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                                    {mode === 'file' ? 'File' : 'Database'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {datasetMode[dsId] === 'file' ? (
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-semibold text-slate-500">Separator:</span>
                                                <div className="flex gap-1.5">
                                                    {[',', ';', '|'].map(d => (
                                                        <button key={d} onClick={() => setSeparators(prev => ({ ...prev, [dsId]: d }))}
                                                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono border text-xs transition-all ${separators[dsId] === d ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-400 border-slate-200 hover:border-violet-400'}`}>
                                                            {d}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <input type="file" accept=".csv,.txt,.xlsx,.xls" onChange={e => e.target.files[0] && handleFileUpload(dsId, e.target.files[0])}
                                                className="hidden" id={`upload-${dsId}`} />
                                            <label htmlFor={`upload-${dsId}`}
                                                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm cursor-pointer transition-all ${
                                                    datasets[dsId]
                                                        ? 'bg-emerald-50 border-2 border-emerald-200 text-emerald-700'
                                                        : 'bg-violet-600 hover:bg-violet-700 text-white shadow-sm shadow-violet-600/20'
                                                }`}>
                                                {datasets[dsId] ? <><CheckCircle size={15} /> Uploaded — Click to Replace</> : <><Upload size={15} /> Upload File</>}
                                            </label>
                                            <p className="text-xs text-slate-400">Supports CSV, Excel (.xlsx)</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {connections.length === 0 ? (
                                                <div className="text-center py-6 text-slate-500 text-sm">
                                                    <Database size={28} className="mx-auto text-slate-300 mb-2" />
                                                    No connections. Add one from the sidebar.
                                                </div>
                                            ) : (
                                                <>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 mb-1">Connection</label>
                                                        <select value={datasetConnections[dsId]}
                                                            onChange={e => setDatasetConnections(prev => ({ ...prev, [dsId]: e.target.value }))}
                                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:border-violet-400 outline-none">
                                                            <option value="">Select…</option>
                                                            {connections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.db_type})</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 mb-1">SQL Query</label>
                                                        <textarea value={datasetQueries[dsId]}
                                                            onChange={e => setDatasetQueries(prev => ({ ...prev, [dsId]: e.target.value }))}
                                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono min-h-[80px] resize-none focus:border-violet-400 outline-none"
                                                            placeholder="SELECT * FROM table" />
                                                    </div>
                                                    <button onClick={() => handleDatabaseIngest(dsId)} disabled={!datasetConnections[dsId] || !datasetQueries[dsId]}
                                                        className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold text-sm transition-colors">
                                                        {datasets[dsId] ? '✓ Re-import Database' : 'Import from Database'}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {datasets[dsId] && (
                                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-medium">
                                            <span className="flex items-center gap-1.5 text-emerald-600"><CheckCircle size={13} /> Ready</span>
                                            <span className="text-slate-500">{datasetColumns[dsId].length} columns</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end pt-4 border-t border-slate-100">
                            <button onClick={() => setStep(2)} disabled={!datasets.dataset1 || !datasets.dataset2}
                                className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-violet-600/20 hover:-translate-y-0.5">
                                Configure Matching Rules →
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* ── Step 2: Configure ── */}
                {!loading && step === 2 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className="text-base font-bold text-slate-800">Matching Rules</h3>
                                <p className="text-sm text-slate-500 mt-1">Define which columns to compare and how to compare them.</p>
                            </div>
                            <button onClick={addRule} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm shadow-violet-600/20">
                                <Plus size={15} /> Add Rule
                            </button>
                        </div>

                        <div className="space-y-3 mb-6">
                            <AnimatePresence>
                                {matchRules.map((rule, idx) => (
                                    <motion.div key={rule.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative">
                                        <div className="absolute top-4 left-4 text-xs font-black text-slate-400 uppercase tracking-wider">Rule {idx + 1}</div>
                                        {matchRules.length > 1 && (
                                            <button onClick={() => removeRule(rule.id)} className="absolute top-3.5 right-4 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                                                <Trash2 size={15} />
                                            </button>
                                        )}

                                        <div className="grid grid-cols-2 gap-4 mt-6 mb-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1.5">Column (Dataset 1)</label>
                                                <select value={rule.column1} onChange={e => updateRule(rule.id, 'column1', e.target.value)}
                                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-violet-400 focus:ring-2 focus:ring-violet-400/10 outline-none">
                                                    <option value="">Select column…</option>
                                                    {datasetColumns.dataset1.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1.5">Column (Dataset 2)</label>
                                                <select value={rule.column2} onChange={e => updateRule(rule.id, 'column2', e.target.value)}
                                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-violet-400 focus:ring-2 focus:ring-violet-400/10 outline-none">
                                                    <option value="">Select column…</option>
                                                    {datasetColumns.dataset2.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1.5">Algorithm</label>
                                                <select value={rule.algorithm} onChange={e => updateRule(rule.id, 'algorithm', e.target.value)}
                                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-violet-400 outline-none">
                                                    {algorithms.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1.5">
                                                    Threshold — <span className="font-black text-slate-700">{(rule.threshold * 100).toFixed(0)}%</span>
                                                </label>
                                                <input type="range" min="0" max="1" step="0.05"
                                                    value={rule.threshold} onChange={e => updateRule(rule.id, 'threshold', parseFloat(e.target.value))}
                                                    className="w-full mt-2.5 accent-violet-600" />
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {/* Output column selectors */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mb-5">
                            <h4 className="text-sm font-bold text-slate-800 mb-4">Output Columns to Include</h4>
                            <div className="grid grid-cols-2 gap-6">
                                {['dataset1', 'dataset2'].map((dsId, idx) => (
                                    <div key={dsId}>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Dataset {idx + 1}</p>
                                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                            {datasetColumns[dsId].map(col => (
                                                <label key={col} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded-lg">
                                                    <input type="checkbox" checked={outputColumns[dsId].includes(col)} onChange={() => toggleOutputColumn(dsId, col)}
                                                        className="w-3.5 h-3.5 accent-violet-600 rounded" />
                                                    <span className="text-sm text-slate-700">{col}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                            <button onClick={() => setStep(1)} className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                                ← Back
                            </button>
                            <button onClick={handleExecute} disabled={matchRules.some(r => !r.column1 || !r.column2) || loading}
                                className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-violet-600/20 hover:-translate-y-0.5">
                                <Play size={16} fill="currentColor" /> Run Matching Algorithms
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* ── Step 3: Results ── */}
                {!loading && step === 3 && finalResults && (
                    <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">Matching Complete</h3>
                                <p className="text-sm text-slate-500 mt-1">Found <span className="font-bold text-violet-600">{totalMatches}</span> matching records across both datasets.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={async () => {
                                    try {
                                        const response = await axios.get(`${API_BASE}/features/matching/download/${sessionId}`, { responseType: 'blob' });
                                        const url = window.URL.createObjectURL(new Blob([response.data]));
                                        const link = document.createElement('a');
                                        link.href = url;
                                        link.setAttribute('download', `matching_results_${sessionId}.csv`);
                                        document.body.appendChild(link);
                                        link.click();
                                        link.parentNode.removeChild(link);
                                    } catch (e) { alert("Download failed: " + (e.response?.data?.detail || e.message)); }
                                }} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-emerald-600/20">
                                    <TrendingUp size={16} /> Download Results
                                </button>
                                <button onClick={() => { setStep(1); setDatasets({ dataset1: null, dataset2: null }); setMatchRules([{ id: 1, column1: '', column2: '', algorithm: 'fuzzy', threshold: 0.8 }]); setFinalResults(null); setProgress({ percent: 0, message: '', status: 'idle' }); }}
                                    className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm transition-all">
                                    New Matching Job
                                </button>
                            </div>
                        </div>

                        {finalResults.length > 0 && (
                            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                                    <span className="text-sm font-bold text-slate-700">Sample Results</span>
                                    <span className="text-xs text-slate-500">Showing top {Math.min(finalResults.length, 10)} of {totalMatches}</span>
                                </div>
                                <div className="overflow-x-auto max-h-[420px]">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-xs text-slate-500 uppercase sticky top-0 border-b border-slate-200">
                                            <tr>
                                                {Object.keys(finalResults[0]).filter(k => k !== 'match_details').map(key => (
                                                    <th key={key} className="px-5 py-3 whitespace-nowrap font-bold tracking-wider">{key}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {finalResults.slice(0, 10).map((row, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                                    {Object.entries(row).filter(([k]) => k !== 'match_details').map(([key, value], i) => (
                                                        <td key={i} className="px-5 py-3 text-slate-700 font-medium whitespace-nowrap">
                                                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </div>
        </div>
    );
}
