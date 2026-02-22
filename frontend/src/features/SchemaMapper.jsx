import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Shuffle, ArrowRight, CheckCircle, Wand2, Upload } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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

    useEffect(() => {
        fetchTransformations();
    }, []);

    const fetchTransformations = async () => {
        try {
            const res = await axios.get(`${API_BASE}/features/mapper/transformations`);
            setTransformations(res.data.transformations || []);
        } catch (e) {
            console.error('Error fetching transformations:', e);
        }
    };

    const handleFileUpload = async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/upload`, formData);
            setSessionId(res.data.session_id);
            setColumns(res.data.columns);
            setStep(1);
        } catch (e) {
            alert('Upload failed: ' + (e.response?.data?.detail || e.message));
        }
        setLoading(false);
    };

    const handleAutoMap = () => {
        const targetCols = targetColumns.split('\n').filter(c => c.trim());
        const autoMappings = {};

        columns.forEach(sourceCol => {
            const match = targetCols.find(targetCol =>
                sourceCol.toLowerCase().includes(targetCol.toLowerCase()) ||
                targetCol.toLowerCase().includes(sourceCol.toLowerCase())
            );
            if (match) {
                autoMappings[sourceCol] = match;
            }
        });

        setMappings(autoMappings);
    };

    const handlePreview = async () => {
        if (Object.keys(mappings).length === 0) return;

        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/features/mapper/preview/${sessionId}`, {
                mappings,
                transformations: columnTransforms
            });
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
            const res = await axios.post(`${API_BASE}/features/mapper/execute/${sessionId}`, {
                mappings,
                transformations: columnTransforms
            });

            try {
                // Log history
                const token = localStorage.getItem('token');
                const headers = token ? { Authorization: `Bearer ${token}` } : {};

                await axios.post(`${API_BASE}/history/jobs`, {
                    session_id: sessionId,
                    file_name: `Schema Mapping Job`,
                    rules: [{ mappings, transformations: columnTransforms }],
                    total_rows: 0,
                    valid_rows: 0,
                    invalid_rows: 0,
                    module: 'mapper'
                }, { headers });
            } catch (histErr) {
                console.error("Failed to save history:", histErr);
            }

            setStep(3);
            if (onComplete) onComplete(res.data);
        } catch (e) {
            alert('Mapping failed: ' + (e.response?.data?.detail || e.message));
        }
        setLoading(false);
    };

    const addTransformation = (targetCol, transformId) => {
        setColumnTransforms(prev => ({
            ...prev,
            [targetCol]: [...(prev[targetCol] || []), transformId]
        }));
    };

    return (
        <div className="bg-white p-12 rounded-[48px] shadow-2xl">
            <div className="mb-10 text-center">
                <div className="inline-flex items-center gap-2 mb-4">
                    <Shuffle className="text-indigo-600" size={32} />
                    <h2 className="text-4xl font-black text-slate-900">Schema Mapping</h2>
                </div>
                <p className="text-slate-500 font-medium">Map source columns to target schema</p>
            </div>

            {step === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-16 text-center">
                        <Upload className="mx-auto text-slate-400 mb-4" size={64} />
                        <h3 className="text-2xl font-black mb-2">Upload Your Dataset</h3>
                        <p className="text-slate-600 mb-6">Upload a CSV file to start mapping</p>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0])}
                            className="hidden"
                            id="mapper-upload"
                        />
                        <label
                            htmlFor="mapper-upload"
                            className="inline-block px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black cursor-pointer"
                        >
                            {loading ? 'Uploading...' : 'Choose File'}
                        </label>
                    </div>
                </motion.div>
            )}

            {step === 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="mb-8">
                        <label className="block text-sm font-bold text-slate-700 mb-3">Target Schema (one column per line)</label>
                        <textarea
                            value={targetColumns}
                            onChange={(e) => setTargetColumns(e.target.value)}
                            placeholder="customer_first_name&#10;customer_last_name&#10;contact_email"
                            rows={5}
                            className="w-full p-4 border-2 border-slate-200 rounded-2xl focus:border-indigo-500 focus:outline-none"
                        />
                        <button
                            onClick={handleAutoMap}
                            className="mt-2 px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-xl font-bold flex items-center gap-2"
                        >
                            <Wand2 size={16} /> Auto-Map Columns
                        </button>
                    </div>

                    <div className="mb-8">
                        <h3 className="text-lg font-black mb-4">Column Mappings</h3>
                        <div className="space-y-3">
                            {columns.map(sourceCol => (
                                <div key={sourceCol} className="flex items-center gap-4">
                                    <div className="flex-1 p-3 bg-slate-100 rounded-xl font-medium">{sourceCol}</div>
                                    <ArrowRight className="text-slate-400" size={20} />
                                    <select
                                        value={mappings[sourceCol] || ''}
                                        onChange={(e) => setMappings(prev => ({ ...prev, [sourceCol]: e.target.value }))}
                                        className="flex-1 p-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none"
                                    >
                                        <option value="">Select target...</option>
                                        {targetColumns.split('\n').filter(c => c.trim()).map(targetCol => (
                                            <option key={targetCol} value={targetCol}>{targetCol}</option>
                                        ))}
                                    </select>
                                    {mappings[sourceCol] && (
                                        <select
                                            onChange={(e) => e.target.value && addTransformation(mappings[sourceCol], e.target.value)}
                                            className="p-3 border-2 border-slate-200 rounded-xl text-sm"
                                        >
                                            <option value="">+ Transform</option>
                                            {transformations.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handlePreview}
                        disabled={Object.keys(mappings).length === 0 || loading}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-2xl font-black text-lg"
                    >
                        {loading ? 'Loading...' : 'Preview Mapping'}
                    </button>
                </motion.div>
            )}

            {step === 2 && previewData && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="mb-6">
                        <h3 className="text-xl font-black mb-4">Preview Results (5 rows)</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-slate-100">
                                        {Object.keys(previewData[0] || {}).map(key => (
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
                    </div>

                    <div className="flex gap-4">
                        <button onClick={() => setStep(1)} className="flex-1 py-4 bg-slate-200 hover:bg-slate-300 rounded-2xl font-black">
                            Back
                        </button>
                        <button
                            onClick={handleExecute}
                            disabled={loading}
                            className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black"
                        >
                            {loading ? 'Processing...' : 'Map All Data'}
                        </button>
                    </div>
                </motion.div>
            )}

            {step === 3 && (
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center py-12">
                    <CheckCircle className="mx-auto text-indigo-600 mb-4" size={64} />
                    <h3 className="text-3xl font-black mb-4">Mapping Complete!</h3>
                    <p className="text-slate-600 mb-8">Your data has been mapped to the target schema</p>
                    <button
                        onClick={() => onComplete && onComplete()}
                        className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black"
                    >
                        Continue
                    </button>
                </motion.div>
            )}
        </div>
    );
}
