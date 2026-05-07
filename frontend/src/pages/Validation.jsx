import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Database, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import DataConnection from '../components/DataConnection';
import RuleBuilder from '../components/RuleBuilder';
import ResultsDashboard from '../components/ResultsDashboard';
import DatasetViewer from '../components/DatasetViewer';
import { API_BASE } from '../lib/runtimeConfig';

export default function Validation() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [sessionId, setSessionId] = useState(null);
    const [columns, setColumns] = useState([]);
    const [validationResults, setValidationResults] = useState(null);

    // Rules state lifted here so it survives tab switches
    const [rules, setRules] = useState([]);

    // Tab within step 2: 'rules' | 'dataset'
    const [activeTab, setActiveTab] = useState('rules');

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            className="w-full max-w-5xl mx-auto"
        >
            {/* ── Top nav ── */}
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
                            <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all ${
                                    step === s
                                        ? 'bg-gray-900 text-white shadow-lg scale-110'
                                        : step > s
                                        ? 'bg-sky-500 text-white'
                                        : 'bg-gray-200 text-gray-500'
                                }`}
                            >
                                {step > s ? '✓' : s}
                            </div>
                            {s < 3 && (
                                <div
                                    className={`w-8 h-1 rounded-full ${
                                        step > s ? 'bg-sky-500' : 'bg-gray-200'
                                    }`}
                                />
                            )}
                        </div>
                    ))}
                </div>
                <div className="w-20" />
            </div>

            {/* ── Step 1: Data connection ── */}
            {step === 1 && (
                <div className="bg-white p-12 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="mb-10 text-center">
                        <h2 className="text-4xl font-bold text-gray-900 mb-4">Connect your data</h2>
                        <p className="text-gray-500 font-medium">Upload a CSV or connect to your database.</p>
                    </div>
                    <DataConnection
                        onUploadSuccess={(data) => {
                            setSessionId(data.session_id);
                            setColumns(data.columns);
                            setRules([]); // reset rules only on new dataset upload
                            setActiveTab('rules');
                            setStep(2);
                        }}
                    />
                </div>
            )}

            {/* ── Step 2: Rules + Dataset tab panel ── */}
            {step === 2 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    {/* Tab bar */}
                    <div className="flex items-center gap-1 mb-6 bg-slate-100 rounded-2xl p-1.5 w-fit">
                        <button
                            onClick={() => setActiveTab('rules')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                activeTab === 'rules'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-800 hover:text-slate-900'
                            }`}
                        >
                            <ShieldCheck size={16} />
                            Rules
                            {rules.length > 0 && (
                                <span className="ml-1 bg-blue-600 text-white text-[10px] font-black rounded-full px-1.5 py-0.5 leading-none">
                                    {rules.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('dataset')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                activeTab === 'dataset'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-800 hover:text-slate-900'
                            }`}
                        >
                            <Database size={16} />
                            Dataset
                        </button>
                    </div>

                    {/* Rules panel – always mounted, hidden via CSS when not active */}
                    <div style={{ display: activeTab === 'rules' ? 'block' : 'none' }}>
                        <RuleBuilder
                            columns={columns}
                            initialRules={rules}
                            onRulesChange={setRules}
                            onRunValidation={async (payload) => {
                                try {
                                    const token = localStorage.getItem('token');
                                    const headers = token ? { Authorization: `Bearer ${token}` } : {};
                                    const res = await axios.post(
                                        `${API_BASE}/validate/${sessionId}`,
                                        { rules: payload },
                                        { headers }
                                    );
                                    setValidationResults(res.data);
                                    setStep(3);
                                } catch (e) {
                                    alert('Validation Failed: ' + (e.response?.data?.detail || e.message));
                                }
                            }}
                            showRepoLibrary={true}
                        />
                    </div>

                    {/* Dataset panel */}
                    <AnimatePresence>
                        {activeTab === 'dataset' && (
                            <motion.div
                                key="dataset-tab"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 6 }}
                                transition={{ duration: 0.18 }}
                            >
                                <DatasetViewer
                                    sessionId={sessionId}
                                    title="Dataset Preview"
                                    subtitle="Inspect the data you uploaded before running validation rules."
                                    tone="indigo"
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}

            {/* ── Step 3: Results ── */}
            {step === 3 && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                    <ResultsDashboard results={validationResults} onReset={() => setStep(1)} />
                </motion.div>
            )}
        </motion.div>
    );
}
