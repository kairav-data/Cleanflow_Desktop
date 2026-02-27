import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import DataConnection from '../components/DataConnection';
import RuleBuilder from '../components/RuleBuilder';
import ResultsDashboard from '../components/ResultsDashboard';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'import.meta.env.VITE_API_URL';

export default function Validation() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [sessionId, setSessionId] = useState(null);
    const [columns, setColumns] = useState([]);
    const [validationResults, setValidationResults] = useState(null);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            className="w-full max-w-5xl mx-auto"
        >
            <div className="flex items-center justify-between mb-12">
                <button
                    onClick={() => navigate('/')}
                    className="p-2 -ml-2 text-gray-400 hover:text-gray-900 transition-colors flex items-center gap-2 font-bold"
                >
                    <ArrowRight className="rotate-180" size={20} /> Back to Home
                </button>

                <div className="flex items-center gap-3">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all ${step === s ? 'bg-gray-900 text-white shadow-lg scale-110' : step > s ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                {step > s ? '✓' : s}
                            </div>
                            {s < 3 && <div className={`w-8 h-1 rounded-full ${step > s ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
                        </div>
                    ))}
                </div>
                <div className="w-20" />
            </div>

            {step === 1 && (
                <div className="bg-white p-12 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="mb-10 text-center">
                        <h2 className="text-4xl font-bold text-gray-900 mb-4">Connect your data</h2>
                        <p className="text-gray-500 font-medium">Upload a CSV or connect to your database.</p>
                    </div>
                    <DataConnection onUploadSuccess={(data) => {
                        setSessionId(data.session_id);
                        setColumns(data.columns);
                        setStep(2);
                    }} />
                </div>
            )}

            {step === 2 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <RuleBuilder
                        columns={columns}
                        onRunValidation={async (rules) => {
                            try {
                                const token = localStorage.getItem('token');
                                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                                const res = await axios.post(`${API_BASE}/validate/${sessionId}`, { rules }, { headers });
                                setValidationResults(res.data);
                                setStep(3);
                            } catch (e) {
                                alert("Validation Failed: " + (e.response?.data?.detail || e.message));
                            }
                        }}
                    />
                </motion.div>
            )}

            {step === 3 && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                    <ResultsDashboard results={validationResults} onReset={() => setStep(1)} />
                </motion.div>
            )}
        </motion.div>
    );
}
