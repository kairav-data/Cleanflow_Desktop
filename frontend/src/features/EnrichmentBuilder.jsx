import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Sparkles, Play, Eye, Download, CheckCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function EnrichmentBuilder({ sessionId, columns, onComplete }) {
    const [providers, setProviders] = useState([]);
    const [selectedColumn, setSelectedColumn] = useState('');
    const [selectedProvider, setSelectedProvider] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Select, 2: Preview, 3: Complete

    useEffect(() => {
        fetchProviders();
    }, []);

    const fetchProviders = async () => {
        try {
            const res = await axios.get(`${API_BASE}/features/enrichment/providers`);
            setProviders(res.data.providers || []);
        } catch (e) {
            console.error('Error fetching providers:', e);
        }
    };

    const handlePreview = async () => {
        if (!selectedColumn || !selectedProvider) return;

        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/features/enrichment/preview/${sessionId}`, {
                column: selectedColumn,
                provider: selectedProvider.id
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
            const res = await axios.post(`${API_BASE}/features/enrichment/execute/${sessionId}`, {
                column: selectedColumn,
                provider: selectedProvider.id,
                output_prefix: `${selectedColumn}_enriched`
            });

            try {
                // Log history
                const token = localStorage.getItem('token');
                const headers = token ? { Authorization: `Bearer ${token}` } : {};

                await axios.post(`${API_BASE}/history/jobs`, {
                    session_id: sessionId,
                    file_name: `Enrichment Job (${selectedColumn})`,
                    rules: [{ column: selectedColumn, provider: selectedProvider.name }],
                    total_rows: 0,
                    valid_rows: 0,
                    invalid_rows: 0,
                    module: 'enrichment'
                }, { headers });
            } catch (histErr) {
                console.error("Failed to save history:", histErr);
            }

            setStep(3);
            if (onComplete) onComplete(res.data);
        } catch (e) {
            alert('Enrichment failed: ' + (e.response?.data?.detail || e.message));
        }
        setLoading(false);
    };

    return (
        <div className="bg-white p-12 rounded-[48px] shadow-2xl">
            <div className="mb-10 text-center">
                <div className="inline-flex items-center gap-2 mb-4">
                    <Sparkles className="text-emerald-600" size={32} />
                    <h2 className="text-4xl font-black text-slate-900">Data Enrichment</h2>
                </div>
                <p className="text-slate-500 font-medium">Enhance your data with additional information</p>
            </div>

            {step === 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {/* Column Selection */}
                    <div className="mb-8">
                        <label className="block text-sm font-bold text-slate-700 mb-3">Select Column to Enrich</label>
                        <select
                            value={selectedColumn}
                            onChange={(e) => setSelectedColumn(e.target.value)}
                            className="w-full p-4 border-2 border-slate-200 rounded-2xl text-lg font-medium focus:border-emerald-500 focus:outline-none"
                        >
                            <option value="">Choose a column...</option>
                            {columns.map(col => (
                                <option key={col} value={col}>{col}</option>
                            ))}
                        </select>
                    </div>

                    {/* Provider Selection */}
                    <div className="mb-8">
                        <label className="block text-sm font-bold text-slate-700 mb-3">Choose Enrichment Type</label>
                        <div className="grid grid-cols-2 gap-4">
                            {providers.map(provider => (
                                <motion.div
                                    key={provider.id}
                                    whileHover={{ scale: 1.02 }}
                                    onClick={() => setSelectedProvider(provider)}
                                    className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${selectedProvider?.id === provider.id
                                        ? 'border-emerald-500 bg-emerald-50'
                                        : 'border-slate-200 hover:border-emerald-300'
                                        }`}
                                >
                                    <h3 className="font-black text-lg mb-2">{provider.name}</h3>
                                    <p className="text-sm text-slate-600 mb-3">{provider.description}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {provider.outputs.map(output => (
                                            <span key={output} className="text-xs px-2 py-1 bg-slate-100 rounded-lg">
                                                {output}
                                            </span>
                                        ))}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handlePreview}
                        disabled={!selectedColumn || !selectedProvider || loading}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all"
                    >
                        <Eye size={20} /> {loading ? 'Loading...' : 'Preview Enrichment'}
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
                        <button
                            onClick={() => setStep(1)}
                            className="flex-1 py-4 bg-slate-200 hover:bg-slate-300 rounded-2xl font-black"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleExecute}
                            disabled={loading}
                            className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black flex items-center justify-center gap-2"
                        >
                            <Play size={20} /> {loading ? 'Processing...' : 'Enrich All Data'}
                        </button>
                    </div>
                </motion.div>
            )}

            {step === 3 && (
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center py-12">
                    <CheckCircle className="mx-auto text-emerald-600 mb-4" size={64} />
                    <h3 className="text-3xl font-black mb-4">Enrichment Complete!</h3>
                    <p className="text-slate-600 mb-8">Your data has been enriched with {selectedProvider?.name}</p>
                    <button
                        onClick={() => onComplete && onComplete()}
                        className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black"
                    >
                        Continue
                    </button>
                </motion.div>
            )}
        </div>
    );
}
