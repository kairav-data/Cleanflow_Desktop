import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { GitMerge, Upload, Play, CheckCircle, TrendingUp } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function DataMatchingBuilder({ onComplete }) {
    const [algorithms, setAlgorithms] = useState([]);
    const [selectedAlgorithm, setSelectedAlgorithm] = useState(null);
    const [datasets, setDatasets] = useState({ dataset1: null, dataset2: null });
    const [datasetColumns, setDatasetColumns] = useState({ dataset1: [], dataset2: [] });
    const [matchColumns, setMatchColumns] = useState({ dataset1: '', dataset2: '' });
    const [outputColumns, setOutputColumns] = useState({ dataset1: [], dataset2: [] });
    const [threshold, setThreshold] = useState(0.8);
    const [sessionId] = useState(`match_${Date.now()}`);
    const [previewData, setPreviewData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Upload, 2: Configure, 3: Preview, 4: Complete
    const [separators, setSeparators] = useState({ dataset1: ',', dataset2: ',' });
    const [showSeparatorInput, setShowSeparatorInput] = useState({ dataset1: false, dataset2: false });

    useEffect(() => {
        fetchAlgorithms();
    }, []);

    const fetchAlgorithms = async () => {
        try {
            const res = await axios.get(`${API_BASE}/features/matching/algorithms`);
            setAlgorithms(res.data.algorithms || []);
            if (res.data.algorithms?.length > 0) {
                setSelectedAlgorithm(res.data.algorithms[0]);
            }
        } catch (e) {
            console.error('Error fetching algorithms:', e);
        }
    };

    const parseFile = async (file, separator) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            const fileExtension = file.name.split('.').pop().toLowerCase();

            reader.onload = async (e) => {
                try {
                    let data = [];
                    const content = e.target.result;

                    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
                        // For Excel files, we'd need a library like xlsx
                        // For now, show error message
                        alert('Excel support requires additional setup. Please use CSV or TXT for now.');
                        reject('Excel not supported yet');
                        return;
                    } else {
                        // Parse CSV/TXT
                        const rows = content.split('\n').filter(r => r.trim());
                        const headers = rows[0].split(separator).map(h => h.trim());
                        data = rows.slice(1).map(row => {
                            const values = row.split(separator);
                            const obj = {};
                            headers.forEach((h, i) => obj[h] = values[i]?.trim());
                            return obj;
                        });
                    }

                    resolve({ data, headers: Object.keys(data[0] || {}) });
                } catch (err) {
                    reject(err);
                }
            };

            reader.onerror = reject;
            reader.readAsText(file);
        });
    };

    const handleFileUpload = async (datasetId, file) => {
        try {
            const separator = separators[datasetId];
            const { data, headers } = await parseFile(file, separator);

            // Load dataset to backend
            await axios.post(`${API_BASE}/features/matching/load-dataset`, {
                session_id: sessionId,
                dataset_id: datasetId,
                data
            });

            setDatasets(prev => ({ ...prev, [datasetId]: data }));
            setDatasetColumns(prev => ({ ...prev, [datasetId]: headers }));
        } catch (e) {
            alert('Upload failed: ' + (e.response?.data?.detail || e.message || e));
        }
    };

    const handlePreview = async () => {
        if (!matchColumns.dataset1 || !matchColumns.dataset2) return;

        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/features/matching/preview/${sessionId}`, {
                dataset1: 'dataset1',
                dataset2: 'dataset2',
                match_column1: matchColumns.dataset1,
                match_column2: matchColumns.dataset2,
                algorithm: selectedAlgorithm.id,
                threshold,
                output_columns: outputColumns
            });
            setPreviewData(res.data.data);
            setStep(3);
        } catch (e) {
            alert('Preview failed: ' + (e.response?.data?.detail || e.message));
        }
        setLoading(false);
    };

    const handleExecute = async () => {
        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/features/matching/execute/${sessionId}`, {
                dataset1: 'dataset1',
                dataset2: 'dataset2',
                match_column1: matchColumns.dataset1,
                match_column2: matchColumns.dataset2,
                algorithm: selectedAlgorithm.id,
                threshold,
                output_columns: outputColumns
            });
            setStep(4);
            if (onComplete) onComplete(res.data);
        } catch (e) {
            alert('Matching failed: ' + (e.response?.data?.detail || e.message));
        }
        setLoading(false);
    };

    const toggleOutputColumn = (datasetId, column) => {
        setOutputColumns(prev => ({
            ...prev,
            [datasetId]: prev[datasetId].includes(column)
                ? prev[datasetId].filter(c => c !== column)
                : [...prev[datasetId], column]
        }));
    };

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
                            <div key={dsId} className="border-2 border-dashed border-slate-200 rounded-2xl p-8">
                                <Upload className="mx-auto text-slate-400 mb-4" size={48} />
                                <h3 className="font-black text-lg mb-2 text-center">Dataset {idx + 1}</h3>

                                {/* Separator Input */}
                                <div className="mb-4">
                                    <label className="block text-xs font-bold text-slate-600 mb-2">
                                        Separator Character
                                    </label>
                                    <div className="flex gap-2">
                                        <select
                                            value={separators[dsId]}
                                            onChange={(e) => {
                                                if (e.target.value === 'custom') {
                                                    setShowSeparatorInput(prev => ({ ...prev, [dsId]: true }));
                                                } else {
                                                    setSeparators(prev => ({ ...prev, [dsId]: e.target.value }));
                                                    setShowSeparatorInput(prev => ({ ...prev, [dsId]: false }));
                                                }
                                            }}
                                            className="flex-1 p-2 border-2 border-slate-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none"
                                        >
                                            <option value=",">Comma (,)</option>
                                            <option value=";">Semicolon (;)</option>
                                            <option value="\t">Tab (\t)</option>
                                            <option value="|">Pipe (|)</option>
                                            <option value=" ">Space</option>
                                            <option value="custom">Custom...</option>
                                        </select>
                                    </div>
                                    {showSeparatorInput[dsId] && (
                                        <input
                                            type="text"
                                            maxLength="3"
                                            placeholder="Enter separator"
                                            onChange={(e) => setSeparators(prev => ({ ...prev, [dsId]: e.target.value }))}
                                            className="w-full mt-2 p-2 border-2 border-slate-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none"
                                        />
                                    )}
                                </div>

                                {/* File Upload */}
                                <input
                                    type="file"
                                    accept=".csv,.txt,.xlsx,.xls"
                                    onChange={(e) => e.target.files[0] && handleFileUpload(dsId, e.target.files[0])}
                                    className="hidden"
                                    id={`upload-${dsId}`}
                                />
                                <label
                                    htmlFor={`upload-${dsId}`}
                                    className="block text-center px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold cursor-pointer"
                                >
                                    {datasets[dsId] ? '✓ Uploaded' : 'Upload File'}
                                </label>
                                {datasets[dsId] && (
                                    <div className="mt-3 text-center">
                                        <p className="text-sm text-slate-600">{datasets[dsId].length} rows</p>
                                        <p className="text-xs text-slate-500">{datasetColumns[dsId].length} columns</p>
                                    </div>
                                )}
                                <p className="text-xs text-slate-400 mt-2 text-center">
                                    Supports: CSV, TXT, Excel
                                </p>
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
                    {/* Algorithm Selection */}
                    <div className="mb-8">
                        <label className="block text-sm font-bold text-slate-700 mb-3">Choose Matching Algorithm</label>
                        <div className="grid grid-cols-2 gap-4">
                            {algorithms.map(algo => (
                                <motion.div
                                    key={algo.id}
                                    whileHover={{ scale: 1.02 }}
                                    onClick={() => setSelectedAlgorithm(algo)}
                                    className={`p-6 rounded-2xl border-2 cursor-pointer ${selectedAlgorithm?.id === algo.id
                                        ? 'border-purple-500 bg-purple-50'
                                        : 'border-slate-200 hover:border-purple-300'
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <h3 className="font-black text-lg">{algo.name}</h3>
                                        <span className="text-xs px-2 py-1 bg-slate-100 rounded-lg">{algo.speed}</span>
                                    </div>
                                    <p className="text-sm text-slate-600 mb-2">{algo.description}</p>
                                    <p className="text-xs text-slate-500 italic">{algo.use_case}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Match Columns */}
                    <div className="grid grid-cols-2 gap-6 mb-8">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-3">Match Column (Dataset 1)</label>
                            <select
                                value={matchColumns.dataset1}
                                onChange={(e) => setMatchColumns(prev => ({ ...prev, dataset1: e.target.value }))}
                                className="w-full p-4 border-2 border-slate-200 rounded-2xl focus:border-purple-500 focus:outline-none"
                            >
                                <option value="">Select column...</option>
                                {datasetColumns.dataset1.map(col => (
                                    <option key={col} value={col}>{col}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-3">Match Column (Dataset 2)</label>
                            <select
                                value={matchColumns.dataset2}
                                onChange={(e) => setMatchColumns(prev => ({ ...prev, dataset2: e.target.value }))}
                                className="w-full p-4 border-2 border-slate-200 rounded-2xl focus:border-purple-500 focus:outline-none"
                            >
                                <option value="">Select column...</option>
                                {datasetColumns.dataset2.map(col => (
                                    <option key={col} value={col}>{col}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Threshold */}
                    <div className="mb-8">
                        <label className="block text-sm font-bold text-slate-700 mb-3">
                            Similarity Threshold: {(threshold * 100).toFixed(0)}%
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={threshold}
                            onChange={(e) => setThreshold(parseFloat(e.target.value))}
                            className="w-full"
                        />
                        <p className="text-xs text-slate-500 mt-2">Only matches above this threshold will be included</p>
                    </div>

                    {/* Output Columns */}
                    <div className="grid grid-cols-2 gap-6 mb-8">
                        {['dataset1', 'dataset2'].map((dsId, idx) => (
                            <div key={dsId}>
                                <label className="block text-sm font-bold text-slate-700 mb-3">
                                    Output Columns (Dataset {idx + 1})
                                </label>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {datasetColumns[dsId].map(col => (
                                        <label key={col} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={outputColumns[dsId].includes(col)}
                                                onChange={() => toggleOutputColumn(dsId, col)}
                                                className="w-4 h-4"
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
                            onClick={handlePreview}
                            disabled={!matchColumns.dataset1 || !matchColumns.dataset2 || loading}
                            className="flex-1 py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white rounded-2xl font-black flex items-center justify-center gap-2"
                        >
                            <TrendingUp size={20} /> {loading ? 'Loading...' : 'Preview Matches'}
                        </button>
                    </div>
                </motion.div>
            )}

            {step === 3 && previewData && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="mb-6">
                        <h3 className="text-xl font-black mb-4">Preview Results (Top 10 Matches)</h3>
                        <div className="overflow-x-auto max-h-96 overflow-y-auto">
                            <table className="w-full border-collapse">
                                <thead className="sticky top-0 bg-slate-100">
                                    <tr>
                                        {previewData[0] && Object.keys(previewData[0]).map(key => (
                                            <th key={key} className="p-3 text-left text-sm font-black">{key}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.map((row, idx) => (
                                        <tr key={idx} className="border-b border-slate-100">
                                            {Object.values(row).map((val, i) => (
                                                <td key={i} className="p-3 text-sm">{String(val)}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-sm text-slate-600 mt-4">
                            Found {previewData.length} matches in preview. Click "Match All Data" to process full datasets.
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={() => setStep(2)} className="flex-1 py-4 bg-slate-200 hover:bg-slate-300 rounded-2xl font-black">
                            Back
                        </button>
                        <button
                            onClick={handleExecute}
                            disabled={loading}
                            className="flex-1 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black flex items-center justify-center gap-2"
                        >
                            <Play size={20} /> {loading ? 'Processing...' : 'Match All Data'}
                        </button>
                    </div>
                </motion.div>
            )}

            {step === 4 && (
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center py-12">
                    <CheckCircle className="mx-auto text-purple-600 mb-4" size={64} />
                    <h3 className="text-3xl font-black mb-4">Matching Complete!</h3>
                    <p className="text-slate-600 mb-8">
                        Successfully matched records using {selectedAlgorithm?.name}
                    </p>
                    <button
                        onClick={() => onComplete && onComplete()}
                        className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black"
                    >
                        Continue
                    </button>
                </motion.div>
            )}
        </div>
    );
}
