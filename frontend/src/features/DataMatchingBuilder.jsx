import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { GitMerge, Upload, Play, CheckCircle, TrendingUp, Plus, Trash2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'import.meta.env.VITE_API_URL';

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
    const [step, setStep] = useState(1); // 1: Upload, 2: Configure, 3: Complete
    const [separators, setSeparators] = useState({ dataset1: ',', dataset2: ',' });
    const [elapsedTime, setElapsedTime] = useState(0);

    // Database connection states
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
            interval = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - start) / 1000));
            }, 1000);
        } else {
            setElapsedTime(0);
        }
        return () => clearInterval(interval);
    }, [loading]);

    useEffect(() => {
        fetchAlgorithms();
        fetchConnections();
    }, []);

    const fetchAlgorithms = async () => {
        try {
            const res = await axios.get(`${API_BASE}/features/matching/algorithms`);
            setAlgorithms(res.data.algorithms || []);
        } catch (e) {
            console.error('Error fetching algorithms:', e);
        }
    };

    const fetchConnections = async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${API_BASE}/history/connections`, { headers });
            setConnections(res.data);
            if (res.data.length > 0) {
                setDatasetConnections({ dataset1: res.data[0].id, dataset2: res.data[0].id });
            }
        } catch (err) {
            console.error("Could not load saved connections.", err);
        }
    };

    const handleDatabaseIngest = async (datasetId) => {
        const query = datasetQueries[datasetId];
        const connectionId = datasetConnections[datasetId];
        
        if (!query || !connectionId) return;

        try {
            const res = await axios.post(`${API_BASE}/features/matching/ingest-database`, {
                session_id: sessionId,
                dataset_id: datasetId,
                connection_id: connectionId,
                query: query
            }, { headers });

            setDatasets(prev => ({ ...prev, [datasetId]: true }));
            setDatasetColumns(prev => ({ ...prev, [datasetId]: res.data.columns }));
        } catch (e) {
            alert('Database import failed: ' + (e.response?.data?.detail || e.message || e));
        }
    };

    const handleFileUpload = async (datasetId, file) => {
        try {
            const formData = new FormData();
            formData.append('session_id', sessionId);
            formData.append('dataset_id', datasetId);
            formData.append('delimiter', separators[datasetId] || ',');
            formData.append('file', file);

            const res = await axios.post(`${API_BASE}/features/matching/upload-dataset`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setDatasets(prev => ({ ...prev, [datasetId]: true }));
            setDatasetColumns(prev => ({ ...prev, [datasetId]: res.data.columns }));
        } catch (e) {
            alert('Upload failed: ' + (e.response?.data?.detail || e.message || e));
        }
    };

    const addRule = () => {
        setMatchRules(prev => [...prev, { id: Date.now(), column1: '', column2: '', algorithm: algorithms[0]?.id || 'fuzzy', threshold: 0.8 }]);
    };

    const removeRule = (id) => {
        setMatchRules(prev => prev.filter(r => r.id !== id));
    };

    const updateRule = (id, field, value) => {
        setMatchRules(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handleExecute = async () => {
        setLoading(true);
        // setStep(3); // Removed: Don't change step yet, let loading screen show

        try {
            // Start background execution
            const validRules = matchRules.filter(r => r.column1 && r.column2);
            await axios.post(`${API_BASE}/features/matching/start/${sessionId}`, {
                dataset1: 'dataset1',
                dataset2: 'dataset2',
                rules: validRules,
                output_columns: outputColumns
            });

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
                            // Log history
                            const token = localStorage.getItem('token');
                            const headers = token ? { Authorization: `Bearer ${token}` } : {};

                            await axios.post(`${API_BASE}/history/jobs`, {
                                session_id: sessionId,
                                file_name: `Data Matching Job`,
                                rules: validRules,
                                total_rows: resultRes.data.total_matches || resultRes.data.results.length,
                                valid_rows: resultRes.data.total_matches || resultRes.data.results.length,
                                invalid_rows: 0,
                                module: 'matching'
                            }, { headers });
                        } catch (histErr) {
                            console.error("Failed to save history:", histErr);
                        }

                        setStep(3); // Move to completion step ONLY after success
                        if (onComplete) onComplete(resultRes.data);
                    } else if (res.data.status === 'error') {
                        clearInterval(interval);
                        setLoading(false);
                        alert('Matching error: ' + res.data.message);
                        // Stay on step 2
                    }
                } catch (e) {
                    console.error("Polling error", e);
                }
            }, 1000);

        } catch (e) {
            setLoading(false);
            alert('Matching start failed: ' + (e.response?.data?.detail || e.message));
        }
    };

    const toggleOutputColumn = (datasetId, column) => {
        setOutputColumns(prev => ({
            ...prev,
            [datasetId]: prev[datasetId].includes(column)
                ? prev[datasetId].filter(c => c !== column)
                : [...prev[datasetId], column]
        }));
    };

    if (loading) {
        return (
            <div className="bg-white p-12 rounded-[48px] shadow-2xl text-center">
                <div className="w-full bg-slate-100 rounded-full h-4 mb-4 overflow-hidden">
                    <motion.div
                        className="bg-purple-600 h-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress.percent}%` }}
                        transition={{ duration: 0.5 }}
                    />
                </div>
                <h2 className="text-3xl font-black text-slate-900 mb-2">{progress.percent}%</h2>
                <p className="text-slate-500 text-lg mb-8">{progress.message || "Initializing..."}</p>
                <div className="text-4xl font-mono font-bold text-purple-600">
                    {Math.floor(elapsedTime / 60)}:{String(elapsedTime % 60).padStart(2, '0')}
                </div>
                <p className="text-xs text-slate-400 mt-4">Time Elapsed</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-12 rounded-[48px] shadow-2xl">
            <div className="mb-10 text-center">
                <div className="inline-flex items-center gap-2 mb-4">
                    <GitMerge className="text-purple-600" size={32} />
                    <h2 className="text-4xl font-black text-slate-900">Data Matching</h2>
                </div>
                <p className="text-slate-500 font-medium">Match records across multiple datasets using advanced algorithms</p>
            </div>

            {step === 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="grid grid-cols-2 gap-8 mb-8">
                        {['dataset1', 'dataset2'].map((dsId, idx) => (
                            <div key={dsId} className="border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-white flex flex-col h-full">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-black text-lg text-slate-800">Dataset {idx + 1}</h3>
                                    <div className="flex bg-slate-100 rounded-lg p-1">
                                        <button 
                                            onClick={() => setDatasetMode(prev => ({ ...prev, [dsId]: 'file' }))}
                                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${datasetMode[dsId] === 'file' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            File
                                        </button>
                                        <button 
                                            onClick={() => setDatasetMode(prev => ({ ...prev, [dsId]: 'database' }))}
                                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${datasetMode[dsId] === 'database' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Database
                                        </button>
                                    </div>
                                </div>

                                {datasetMode[dsId] === 'file' ? (
                                    <div className="flex flex-col items-center justify-center flex-1">
                                        <Upload className="mx-auto text-slate-400 mb-4" size={48} />
                                        
                                        {/* Delimiter Selection */}
                                        <div className="flex flex-col items-center gap-2 mb-4">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Separator</span>
                                            <div className="flex gap-2">
                                                {[',', ';', '|'].map(d => (
                                                    <button
                                                        key={d}
                                                        onClick={() => setSeparators(prev => ({ ...prev, [dsId]: d }))}
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono border transition-all text-sm ${separators[dsId] === d ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-400 border-slate-200 hover:border-purple-600/30'}`}
                                                    >
                                                        {d}
                                                    </button>
                                                ))}
                                                <input
                                                    type="text"
                                                    placeholder="..."
                                                    maxLength={1}
                                                    className={`w-12 h-8 rounded-lg text-center font-mono border transition-all outline-none focus:border-purple-600 text-sm ${![',', ';', '|'].includes(separators[dsId]) ? 'border-purple-600 text-purple-600 font-bold' : 'border-slate-200 text-slate-500'}`}
                                                    value={![',', ';', '|'].includes(separators[dsId]) ? separators[dsId] : ''}
                                                    onChange={(e) => setSeparators(prev => ({ ...prev, [dsId]: e.target.value }))}
                                                />
                                            </div>
                                        </div>

                                        <input
                                            type="file"
                                            accept=".csv,.txt,.xlsx,.xls"
                                            onChange={(e) => e.target.files[0] && handleFileUpload(dsId, e.target.files[0])}
                                            className="hidden"
                                            id={`upload-${dsId}`}
                                        />
                                        <label
                                            htmlFor={`upload-${dsId}`}
                                            className="block text-center px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold cursor-pointer w-full text-sm"
                                        >
                                            {datasets[dsId] ? '✓ Uploaded Successfully' : 'Upload File'}
                                        </label>
                                        <p className="text-xs text-slate-400 mt-3 text-center">Supports: CSV, Excel (.xlsx)</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col flex-1 text-left space-y-4">
                                        {connections.length === 0 ? (
                                            <div className="text-center py-8 text-slate-500 text-sm">No databases connected. Add one from the sidebar.</div>
                                        ) : (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 mb-1">Select Connection</label>
                                                    <select 
                                                        value={datasetConnections[dsId]} 
                                                        onChange={(e) => setDatasetConnections(prev => ({ ...prev, [dsId]: e.target.value }))}
                                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-purple-500"
                                                    >
                                                        <option value="">Select a connection...</option>
                                                        {connections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.db_type})</option>)}
                                                    </select>
                                                </div>
                                                <div className="flex-1 flex flex-col">
                                                    <label className="block text-xs font-bold text-slate-500 mb-1">SQL Query</label>
                                                    <textarea 
                                                        value={datasetQueries[dsId]}
                                                        onChange={(e) => setDatasetQueries(prev => ({ ...prev, [dsId]: e.target.value }))}
                                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono flex-1 min-h-[100px] resize-none focus:outline-none focus:border-purple-500"
                                                        placeholder="SELECT * FROM table"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => handleDatabaseIngest(dsId)}
                                                    disabled={!datasetConnections[dsId] || !datasetQueries[dsId]}
                                                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-sm transition-colors"
                                                >
                                                    {datasets[dsId] ? '✓ Refresh Integration' : 'Import from Database'}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                                
                                {datasets[dsId] && (
                                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-slate-500">
                                        <span className="flex items-center gap-1 text-green-600"><CheckCircle size={14} /> Ready</span>
                                        <span>{datasetColumns[dsId].length} columns mapped</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={() => setStep(2)}
                        disabled={!datasets.dataset1 || !datasets.dataset2}
                        className="w-full py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white rounded-2xl font-black text-lg"
                    >
                        Continue to Configuration
                    </button>
                </motion.div>
            )}

            {step === 2 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {/* Match Rules */}
                    <div className="mb-8">
                        <div className="flex justify-between items-center mb-4">
                            <label className="block text-lg font-bold text-slate-700">Match Rules</label>
                            <button onClick={addRule} className="flex items-center gap-1 text-sm text-purple-600 font-bold hover:bg-purple-50 px-3 py-1 rounded-lg">
                                <Plus size={16} /> Add Rule
                            </button>
                        </div>

                        {matchRules.map((rule, idx) => (
                            <motion.div
                                key={rule.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-4 relative"
                            >
                                {matchRules.length > 1 && (
                                    <button onClick={() => removeRule(rule.id)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500">
                                        <Trash2 size={18} />
                                    </button>
                                )}
                                <h4 className="text-xs font-black text-slate-400 uppercase mb-4 tracking-wider">Rule {idx + 1}</h4>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Column (Dataset 1)</label>
                                        <select
                                            value={rule.column1}
                                            onChange={(e) => updateRule(rule.id, 'column1', e.target.value)}
                                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none"
                                        >
                                            <option value="">Select column...</option>
                                            {datasetColumns.dataset1.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Column (Dataset 2)</label>
                                        <select
                                            value={rule.column2}
                                            onChange={(e) => updateRule(rule.id, 'column2', e.target.value)}
                                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none"
                                        >
                                            <option value="">Select column...</option>
                                            {datasetColumns.dataset2.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Algorithm</label>
                                        <select
                                            value={rule.algorithm}
                                            onChange={(e) => updateRule(rule.id, 'algorithm', e.target.value)}
                                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none"
                                        >
                                            {algorithms.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Threshold ({(rule.threshold * 100).toFixed(0)}%)</label>
                                        <input
                                            type="range" min="0" max="1" step="0.05"
                                            value={rule.threshold}
                                            onChange={(e) => updateRule(rule.id, 'threshold', parseFloat(e.target.value))}
                                            className="w-full mt-2 accent-purple-600"
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Output Columns */}
                    <div className="grid grid-cols-2 gap-6 mb-8">
                        {['dataset1', 'dataset2'].map((dsId, idx) => (
                            <div key={dsId}>
                                <label className="block text-sm font-bold text-slate-700 mb-3">
                                    Output Columns (Dataset {idx + 1})
                                </label>
                                <div className="space-y-2 max-h-40 overflow-y-auto bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    {datasetColumns[dsId].map(col => (
                                        <label key={col} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={outputColumns[dsId].includes(col)}
                                                onChange={() => toggleOutputColumn(dsId, col)}
                                                className="w-4 h-4 accent-purple-600"
                                            />
                                            <span className="text-sm">{col}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-4">
                        <button onClick={() => setStep(1)} className="flex-1 py-4 bg-slate-200 hover:bg-slate-300 rounded-2xl font-black">
                            Back
                        </button>
                        <button
                            onClick={handleExecute}
                            disabled={matchRules.some(r => !r.column1 || !r.column2) || loading}
                            className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-2xl font-black flex items-center justify-center gap-2"
                        >
                            <Play size={20} /> Match All
                        </button>
                    </div>
                </motion.div>
            )}

            {step === 3 && finalResults && (
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="py-12 w-full">
                    <div className="text-center mb-8">
                        <CheckCircle className="mx-auto text-green-500 mb-4" size={64} />
                        <h3 className="text-3xl font-black mb-4">Matching Complete!</h3>
                        <p className="text-slate-600">
                            Process completed successfully. Found {totalMatches} matches.
                        </p>
                    </div>

                    {/* Matched Data Preview Table */}
                    {finalResults.length > 0 && (
                        <div className="mb-8 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                                <h4 className="font-bold text-slate-800">Sample API Output Preview (Top Matches)</h4>
                            </div>
                            <div className="overflow-x-auto max-h-[400px]">
                                <table className="w-full text-sm text-left relative">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            {Object.keys(finalResults[0])
                                                .filter(k => k !== 'match_details')
                                                .map(key => (
                                                    <th key={key} className="px-6 py-3 whitespace-nowrap bg-slate-50 border-b border-slate-200">
                                                        {key}
                                                    </th>
                                                ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {finalResults.slice(0, 10).map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                {Object.entries(row)
                                                    .filter(([k]) => k !== 'match_details')
                                                    .map(([key, value], i) => (
                                                        <td key={i} className="px-6 py-4 whitespace-nowrap text-slate-700">
                                                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                                        </td>
                                                    ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-xs text-slate-500 text-center">
                                Showing top {Math.min(finalResults.length, 10)} records
                            </div>
                        </div>
                    )}

                    <div className="flex gap-4 justify-center mt-8">
                        <button
                            onClick={async () => {
                                try {
                                    const response = await axios.get(
                                        `${API_BASE}/features/matching/download/${sessionId}`,
                                        { responseType: 'blob' }
                                    );
                                    const url = window.URL.createObjectURL(new Blob([response.data]));
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.setAttribute('download', `matching_results_${sessionId}.csv`);
                                    document.body.appendChild(link);
                                    link.click();
                                    link.parentNode.removeChild(link);
                                } catch (e) {
                                    console.error("Download failed:", e);
                                    alert("Download failed: " + (e.response?.data?.detail || e.message));
                                }
                            }}
                            className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black flex items-center gap-2"
                        >
                            <TrendingUp size={20} /> Download Results
                        </button>
                        <button
                            onClick={() => {
                                // Reset for new matching
                                setStep(1);
                                setDatasets({ dataset1: null, dataset2: null });
                                setMatchRules([{ id: 1, column1: '', column2: '', algorithm: 'fuzzy', threshold: 0.8 }]);
                                setFinalResults(null);
                                setProgress({ percent: 0, message: '', status: 'idle' });
                            }}
                            className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black"
                        >
                            Start New Matching
                        </button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
