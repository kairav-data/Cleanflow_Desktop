import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { GitMerge, ArrowRight, CheckCircle, Wand2, ArrowLeft, Play, Eye } from 'lucide-react';
import DataConnection from '../components/DataConnection';
import DatasetViewer from '../components/DatasetViewer';
import WorkspaceTabs from '../components/WorkspaceTabs';
import FeatureLayout from './FeatureLayout';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';
const STEPS = ['Upload', 'Configure', 'Results'];

export default function SchemaMapper({
    sessionId: initialSessionId = null,
    columns: initialColumns = [],
    initialSourceConfig = null,
    initialTargetSchema = '',
    initialMappings = {},
    initialTransformations = {},
    embedded = false,
    onSaveConfig,
    onComplete,
}) {
    const [transformations, setTransformations] = useState([]);
    const [targetColumns, setTargetColumns] = useState(initialTargetSchema);
    const [mappings, setMappings] = useState(initialMappings);
    const [columnTransforms, setColumnTransforms] = useState(initialTransformations);
    const [previewData, setPreviewData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(initialSessionId ? 1 : 0);
    const [sessionId, setSessionId] = useState(initialSessionId);
    const [columns, setColumns] = useState(initialColumns);
    const [sourceConfig, setSourceConfig] = useState(initialSourceConfig || null);
    const [workspaceTab, setWorkspaceTab] = useState('dataset');

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
                    session_id: sessionId, file_name: 'Schema Mapping Job',
                    rules: [{ mappings, transformations: columnTransforms }],
                    total_rows: 0, valid_rows: 0, invalid_rows: 0, module: 'mapper'
                }, { headers });
            } catch (histErr) { console.error('Failed to save history:', histErr); }
            setStep(3);
            if (onComplete) onComplete(res.data);
        } catch (e) { alert('Mapping failed: ' + (e.response?.data?.detail || e.message)); }
        setLoading(false);
    };

    const addTransformation = (targetCol, transformId) => {
        setColumnTransforms(prev => ({ ...prev, [targetCol]: [...(prev[targetCol] || []), transformId] }));
    };

    const handleSaveConfig = () => {
        if (!onSaveConfig) return;
        onSaveConfig({ sessionId, columns, sourceConfig, targetSchema: targetColumns, mappings, columnTransforms });
    };

    const mappedCount = Object.values(mappings).filter(Boolean).length;
    const effectiveStep = step === 0 ? 1 : step >= 3 ? 3 : step + 1;

    return (
        <FeatureLayout
            icon={<GitMerge className="h-5 w-5" />}
            accentColor="#6366f1"
            accentBg="rgba(99,102,241,0.1)"
            title="Schema Mapper"
            subtitle="Map source columns to a target schema with optional transforms."
            steps={STEPS}
            currentStep={effectiveStep}
        >
            <div className="px-6 py-5 md:px-8">

                {/* Step 0: Upload */}
                {step === 0 && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="mb-5">
                            <h3 className="text-base font-semibold text-[var(--text-primary)]">Import Dataset</h3>
                            <p className="text-sm text-[var(--text-secondary)] mt-1">Upload a file or connect a database to begin building your schema mapping pipeline.</p>
                        </div>
                        <DataConnection
                            compact={true}
                            onUploadSuccess={(data) => {
                                setSessionId(data.session_id);
                                setColumns(data.columns || []);
                                setSourceConfig(data.source_config || data.sourceConfig || null);
                                setWorkspaceTab('dataset');
                                setStep(1);
                            }}
                        />
                    </motion.div>
                )}

                {/* Step 1: Configure */}
                {step === 1 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <h3 className="text-base font-semibold text-[var(--text-primary)]">Mapping Workspace</h3>
                                <p className="text-sm text-[var(--text-secondary)] mt-1">Switch between the dataset and the mapping canvas while you shape the target schema.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-[var(--border-soft)] bg-[var(--panel)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-soft)]">
                                    {columns.length} columns
                                </span>
                                <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.25)' }}>
                                    {mappedCount} mapped
                                </span>
                            </div>
                        </div>

                        <WorkspaceTabs
                            tone="indigo"
                            activeTab={workspaceTab}
                            onChange={setWorkspaceTab}
                            tabs={[
                                { id: 'dataset', label: 'Dataset' },
                                { id: 'mapping', label: 'Mapping', icon: Wand2 },
                            ]}
                        />

                        {workspaceTab === 'dataset' ? (
                            <DatasetViewer
                                sessionId={sessionId}
                                tone="indigo"
                                title="Source Dataset"
                                subtitle="Inspect the loaded data here, then return to the mapping tab to assign target fields."
                            />
                        ) : (
                            <div className="space-y-5">
                                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                                    {/* Target schema */}
                                    <div className="lg:col-span-2">
                                        <div className="bg-[var(--panel)] border border-[var(--border-soft)] rounded-[24px] p-5 shadow-[var(--shadow-soft)]">
                                            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Target Schema</h3>
                                            <p className="text-xs text-[var(--text-secondary)] mb-3">Enter one target column name per line.</p>
                                            <textarea
                                                value={targetColumns}
                                                onChange={e => setTargetColumns(e.target.value)}
                                                placeholder={"customer_first_name\ncustomer_last_name\ncontact_email"}
                                                rows={8}
                                                className="w-full px-4 py-3 border border-[var(--border-soft)] rounded-xl text-sm font-mono bg-[var(--panel-muted)] focus:outline-none resize-none placeholder:text-[var(--text-muted)]"
                                                style={{ color: 'var(--text-primary)' }}
                                            />
                                            <button onClick={handleAutoMap}
                                                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
                                                style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }}>
                                                <Wand2 className="h-4 w-4" /> Auto-Map Columns
                                            </button>
                                        </div>
                                    </div>

                                    {/* Column mappings */}
                                    <div className="lg:col-span-3">
                                        <div className="bg-[var(--panel)] border border-[var(--border-soft)] rounded-[24px] p-5 shadow-[var(--shadow-soft)]">
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">Column Mappings</h3>
                                                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{mappedCount} of {columns.length} columns mapped</p>
                                                </div>
                                                {mappedCount > 0 && (
                                                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>{mappedCount} mapped</span>
                                                )}
                                            </div>
                                            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1 glass-scrollbar">
                                                {columns.map(sourceCol => (
                                                    <div key={sourceCol} className="flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--panel-muted)] p-2">
                                                        <div className="flex-1 px-3 py-2 bg-[var(--panel)] rounded-lg text-xs font-semibold text-[var(--text-primary)] truncate">{sourceCol}</div>
                                                        <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                                                        <select
                                                            value={mappings[sourceCol] || ''}
                                                            onChange={e => setMappings(prev => ({ ...prev, [sourceCol]: e.target.value }))}
                                                            className="flex-1 px-3 py-2 border rounded-lg text-xs font-medium outline-none transition-all bg-[var(--panel)] text-[var(--text-primary)]"
                                                            style={{ borderColor: mappings[sourceCol] ? '#6366f155' : 'var(--border-soft)' }}
                                                        >
                                                            <option value="">Unmapped</option>
                                                            {targetColumns.split('\n').filter(c => c.trim()).map(tc => (
                                                                <option key={tc} value={tc}>{tc}</option>
                                                            ))}
                                                        </select>
                                                        {mappings[sourceCol] && (
                                                            <select onChange={e => e.target.value && addTransformation(mappings[sourceCol], e.target.value)}
                                                                className="px-2 py-2 border border-[var(--border-soft)] bg-[var(--panel)] rounded-lg text-xs outline-none shrink-0 max-w-[110px] text-[var(--text-primary)]">
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

                                <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-[var(--border-soft)]">
                                    {embedded && (
                                        <button onClick={handleSaveConfig} disabled={!sessionId}
                                            className="flex items-center gap-2 px-4 py-2.5 border border-[var(--border-soft)] hover:bg-[var(--panel-muted)] text-[var(--text-primary)] rounded-xl font-semibold text-sm transition-all disabled:opacity-50">
                                            Save to Pipeline
                                        </button>
                                    )}
                                    <button onClick={handlePreview} disabled={mappedCount === 0 || loading}
                                        className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-semibold text-sm transition-all shadow-md hover:-translate-y-0.5 disabled:opacity-50"
                                        style={{ background: '#6366f1' }}>
                                        <Eye className="h-4 w-4" /> Preview Mapped Data
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Step 2: Preview */}
                {step === 2 && previewData && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className="text-base font-semibold text-[var(--text-primary)]">Mapped Preview</h3>
                                <p className="text-sm text-[var(--text-secondary)] mt-1">Top 5 rows after schema mapping is applied.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => { setWorkspaceTab('mapping'); setStep(1); }} className="flex items-center gap-2 px-4 py-2 border border-[var(--border-soft)] rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--panel-muted)] transition-colors">
                                    <ArrowLeft className="h-4 w-4" /> Edit Mapping
                                </button>
                                <button onClick={handleExecute} disabled={loading}
                                    className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-semibold text-sm transition-all shadow-md hover:-translate-y-0.5 disabled:opacity-50"
                                    style={{ background: '#6366f1' }}>
                                    <Play className="h-4 w-4" fill="currentColor" /> Apply to All Data
                                </button>
                            </div>
                        </div>

                        <div className="bg-[var(--panel)] border border-[var(--border-soft)] rounded-[24px] overflow-hidden shadow-[var(--shadow-soft)]">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-[var(--panel-muted)] border-b border-[var(--border-soft)]">
                                            {Object.keys(previewData[0] || {}).map(key => (
                                                <th key={key} className="px-5 py-3 text-left text-[11px] uppercase tracking-widest font-semibold text-[var(--text-secondary)] whitespace-nowrap">{key}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border-soft)]">
                                        {previewData.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-[var(--panel-muted)] transition-colors">
                                                {Object.values(row).map((val, i) => (
                                                    <td key={i} className="px-5 py-3 text-sm text-[var(--text-primary)]">{String(val)}</td>
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
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'rgba(99,102,241,0.12)' }}>
                            <CheckCircle className="h-8 w-8" style={{ color: '#6366f1' }} />
                        </div>
                        <h3 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight mb-2">Mapping Complete!</h3>
                        <p className="text-[var(--text-secondary)] text-sm mb-8">Your data has been successfully mapped to the target schema.</p>
                        <button onClick={() => onComplete && onComplete()}
                            className="px-6 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:-translate-y-0.5"
                            style={{ background: '#6366f1' }}>
                            Continue
                        </button>
                    </motion.div>
                )}
            </div>
        </FeatureLayout>
    );
}
