import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
    Upload, Database, FileSpreadsheet, Loader2, AlertCircle,
    HardDrive, Server, Play, RefreshCw, Plus, X, ChevronDown,
    Check, FileText, ShieldCheck, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE } from '../lib/runtimeConfig';

const DataConnection = ({ onUploadSuccess, compact = false }) => {
    const [mode, setMode] = useState('file');
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [delimiter, setDelimiter] = useState(',');
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef(null);

    // Database state
    const [connections, setConnections] = useState([]);
    const [selectedConnection, setSelectedConnection] = useState(null);
    const [query, setQuery] = useState('SELECT * FROM your_table LIMIT 100');
    const [loadingConnections, setLoadingConnections] = useState(false);
    const [showNewConnForm, setShowNewConnForm] = useState(false);
    
    // New states for table selection
    const [tables, setTables] = useState([]);
    const [loadingTables, setLoadingTables] = useState(false);
    const [selectedTable, setSelectedTable] = useState('');

    const [newConn, setNewConn] = useState({
        name: '', db_type: 'postgresql', host: '', port: 5432, database: '', username: '', password: ''
    });

    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    useEffect(() => {
        if (mode === 'database' && token) fetchConnections();
    }, [mode, token]);

    const fetchConnections = async () => {
        setLoadingConnections(true);
        try {
            const res = await axios.get(`${API_BASE}/connections`, { headers });
            setConnections(res.data);
            if (res.data.length > 0 && !selectedConnection) setSelectedConnection(res.data[0]);
        } catch (err) {
            setError("Could not load saved connections.");
        } finally {
            setLoadingConnections(false);
        }
    };

    useEffect(() => {
        if (selectedConnection) {
            fetchTables(selectedConnection.id);
        } else {
            setTables([]);
            setSelectedTable('');
        }
    }, [selectedConnection]);

    const fetchTables = async (connId) => {
        setLoadingTables(true);
        setTables([]);
        setSelectedTable('');
        try {
            const res = await axios.get(`${API_BASE}/connections/${connId}/tables`, { headers });
            if (res.data.status === 'success') {
                setTables(res.data.tables || []);
            }
        } catch (err) {
            console.error("Could not load tables.", err);
        } finally {
            setLoadingTables(false);
        }
    };

    const handleTableChange = (e) => {
        const table = e.target.value;
        setSelectedTable(table);
        if (table) {
            setQuery(`SELECT * FROM ${table} LIMIT 1000`);
        } else {
            setQuery('');
        }
    };

    const handleFileUpload = async (file) => {
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('delimiter', delimiter);

        setIsLoading(true);
        setError(null);
        setUploadProgress(0);

        // Phase 1 interval: simulate file transfer while we wait for real browser events
        let phase1 = setInterval(() => {
            setUploadProgress(prev => (prev < 80 ? prev + 4 : prev));
        }, 80);

        let phase2 = null;

        try {
            const response = await axios.post(`${API_BASE}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data', ...headers },
                timeout: 120000,
                onUploadProgress: (e) => {
                    if (e.total) {
                        const real = Math.round((e.loaded / e.total) * 80);
                        setUploadProgress(real);
                    }
                }
            });

            // Phase 2: backend is parsing — animate slowly from 80 -> 97
            clearInterval(phase1);
            phase1 = null;
            phase2 = setInterval(() => {
                setUploadProgress(prev => (prev < 97 ? prev + 1 : prev));
            }, 120);

            setUploadProgress(100);
            clearInterval(phase2);
            phase2 = null;
            setTimeout(() => onUploadSuccess(response.data), 400);
        } catch (err) {
            if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
                setError('Upload timed out. Your file may be too large or the server is busy. Please try again.');
            } else {
                setError(err.response?.data?.detail || 'Error uploading file. Please try again.');
            }
            setUploadProgress(0);
        } finally {
            if (phase1) clearInterval(phase1);
            if (phase2) clearInterval(phase2);
            setIsLoading(false);
        }
    };

    const wrapperClass = compact
        ? 'w-full max-w-3xl mx-auto py-0 px-0'
        : 'w-full max-w-4xl mx-auto py-10 px-5';
    const headerWrapClass = compact ? 'text-left mb-6' : 'text-center mb-12';
    const badgeClass = compact
        ? 'inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-brand-blue/10 text-brand-blue text-[11px] font-bold uppercase tracking-wider mb-3'
        : 'inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-blue/10 text-brand-blue text-xs font-bold uppercase tracking-wider mb-4';
    const titleClass = compact
        ? 'text-2xl md:text-3xl font-black text-slate-900 mb-2 tracking-tight'
        : 'text-4xl md:text-[2.75rem] font-black text-slate-900 mb-4 tracking-tight';
    const bodyClass = compact
        ? 'text-slate-500 text-sm md:text-base max-w-xl'
        : 'text-slate-500 text-base max-w-2xl mx-auto';
    const modeClass = compact
        ? 'flex p-1 bg-slate-200/50 backdrop-blur-md rounded-xl mb-6 w-fit border border-white/50 shadow-inner'
        : 'flex p-1 bg-slate-200/50 backdrop-blur-md rounded-xl mb-8 w-fit mx-auto border border-white/50 shadow-inner';
    const modeButtonClass = compact
        ? 'relative flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all z-10'
        : 'relative flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all z-10';
    const delimiterWrapClass = compact
        ? 'flex items-center justify-start gap-3 bg-white/70 py-2.5 px-4 rounded-xl w-fit border border-slate-100 shadow-sm'
        : 'flex items-center justify-center gap-3 bg-white/50 py-2.5 px-5 rounded-xl w-fit mx-auto border border-slate-100 shadow-sm';
    const dropzoneClass = compact
        ? `relative group cursor-pointer border-2 border-dashed rounded-[1.75rem] p-10 md:p-12 flex flex-col items-center justify-center transition-all overflow-hidden ${isDragging ? 'border-brand-blue bg-brand-blue/5' : 'border-slate-300 bg-white hover:border-brand-blue hover:shadow-glow'}`
        : `relative group cursor-pointer border-2 border-dashed rounded-[1.75rem] p-14 md:p-16 flex flex-col items-center justify-center transition-all overflow-hidden ${isDragging ? 'border-brand-blue bg-brand-blue/5' : 'border-slate-300 bg-white hover:border-brand-blue hover:shadow-glow'}`;
    const uploadShellClass = compact ? 'w-16 h-16 bg-brand-blue/10 text-brand-blue rounded-2xl flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-300' : 'w-20 h-20 bg-brand-blue/10 text-brand-blue rounded-[1.5rem] flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-300';
    const uploadTitleClass = compact ? 'text-xl md:text-2xl font-black text-slate-800 mb-2' : 'text-2xl font-black text-slate-800 mb-2';
    const uploadTextClass = compact ? 'text-slate-400 font-medium text-sm text-center' : 'text-slate-400 font-medium';
    const dbCardClass = compact
        ? 'bg-white border border-slate-200 rounded-[1.75rem] p-6 shadow-lg shadow-slate-200/40'
        : 'bg-white border border-slate-200 rounded-[1.75rem] p-8 shadow-lg shadow-slate-200/40';

    return (
        <div className={wrapperClass}>
            {/* Header Section - only shown in non-compact (standalone) mode */}
            {!compact && (
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className={headerWrapClass}
            >
                <div className={badgeClass}>
                    <Zap size={14} /> Data Ingestion Engine
                </div>
                <h2 className={titleClass}>
                    Bring Your <span className="text-brand-blue">Data</span> to Life
                </h2>
                <p className={bodyClass}>
                    Seamlessly connect to your cloud warehouses or upload local assets to begin your cleaning workflow.
                </p>
            </motion.div>
            )}

            {/* Mode Switcher */}
            <div className={modeClass}>
                {['file', 'database'].map((m) => (
                    <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`${modeButtonClass} ${mode === m ? 'text-brand-blue' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        {mode === m && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute inset-0 bg-white rounded-xl shadow-md -z-10"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                        {m === 'file' ? <FileSpreadsheet size={18} /> : <Database size={18} />}
                        {m === 'file' ? 'Local Files' : 'Cloud Database'}
                    </button>
                ))}
            </div>

            <AnimatePresence mode="wait">
                {mode === 'file' ? (
                    <motion.div
                        key="file"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="space-y-6"
                    >
                        {/* Delimiter Selection */}
                        <div className={delimiterWrapClass}>
                            <span className="text-sm font-bold text-slate-600">Separator:</span>
                            <div className="flex gap-2">
                                {[',', ';', '|'].map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setDelimiter(d)}
                                        className={`w-10 h-10 rounded-lg flex items-center justify-center font-mono border transition-all ${delimiter === d ? 'bg-brand-blue text-white border-brand-blue shadow-glow' : 'bg-white text-slate-400 border-slate-200 hover:border-brand-blue/30'
                                            }`}
                                    >
                                        {d === ',' ? ',' : d}
                                    </button>
                                ))}
                                <input
                                    type="text"
                                    placeholder="Other"
                                    maxLength={1}
                                    className={`w-16 h-10 rounded-lg text-center font-mono border transition-all outline-none focus:border-brand-blue ${![',', ';', '|'].includes(delimiter) ? 'border-brand-blue text-brand-blue font-bold shadow-glow' : 'border-slate-200 text-slate-500'
                                        }`}
                                    value={![',', ';', '|'].includes(delimiter) ? delimiter : ''}
                                    onChange={(e) => setDelimiter(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Dropzone */}
                        <motion.div
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e.dataTransfer.files[0]); }}
                            onClick={() => !isLoading && fileInputRef.current.click()}
                            className={dropzoneClass}
                        >
                            <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e.target.files[0])} className="hidden" accept=".csv,.xlsx,.xls" />

                            <div className="absolute inset-0 bg-gradient-to-b from-brand-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                            {isLoading ? (
                                <div className="flex flex-col items-center gap-6 z-10">
                                    <div className="relative">
                                        <Loader2 className="w-16 h-16 text-brand-blue animate-spin" />
                                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black">{uploadProgress}%</div>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xl font-black text-slate-800 tracking-tight">Uploading Assets...</p>
                                        <div className="w-48 h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                                            <motion.div
                                                className="h-full bg-brand-blue"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${uploadProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center z-10">
                                    <div className={uploadShellClass}>
                                        <Upload size={compact ? 30 : 48} strokeWidth={2.5} />
                                    </div>
                                    <h3 className={uploadTitleClass}>Drop your dataset here</h3>
                                    <p className={uploadTextClass}>Supports CSV, Excel (XLSX) up to 50MB</p>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="db"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="space-y-4"
                    >
                        {/* Error Banner */}
                        {error && (
                            <div className="flex items-start gap-3 p-4 bg-red-50 text-red-700 border border-red-200 rounded-2xl">
                                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                <span className="text-sm font-medium">{error}</span>
                            </div>
                        )}

                        {loadingConnections ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                <Loader2 className="w-8 h-8 text-brand-blue animate-spin" />
                                <p className="text-sm text-slate-500 font-medium">Loading saved connections…</p>
                            </div>
                        ) : connections.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-14 px-6 border-2 border-dashed border-slate-200 bg-slate-50/60 rounded-2xl text-center">
                                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                                    <Database size={32} className="text-slate-400" />
                                </div>
                                <h4 className="text-lg font-black text-slate-700 mb-1">No Connections Yet</h4>
                                <p className="text-slate-500 text-sm max-w-xs mb-5 leading-relaxed">
                                    You haven't saved any database connections. Add one from the sidebar to get started.
                                </p>
                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                                    <ShieldCheck size={14} className="text-emerald-500" />
                                    All connections are encrypted at rest
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">

                                {/* Step 1: Select Connection */}
                                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/80">
                                        <div className="w-6 h-6 rounded-full bg-brand-blue text-white flex items-center justify-center text-xs font-black shrink-0">1</div>
                                        <span className="text-sm font-bold text-slate-700">Select Connection</span>
                                        <button onClick={fetchConnections} className="ml-auto p-1.5 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/5 rounded-lg transition-all" title="Refresh">
                                            <RefreshCw size={14} />
                                        </button>
                                    </div>
                                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {connections.map(conn => {
                                            const isSelected = selectedConnection?.id === conn.id;
                                            const dbColors = { postgresql: 'bg-blue-100 text-blue-700', mysql: 'bg-orange-100 text-orange-700', mssql: 'bg-red-100 text-red-700', sqlite: 'bg-slate-100 text-slate-600' };
                                            const colorClass = dbColors[conn.db_type] || 'bg-slate-100 text-slate-600';
                                            return (
                                                <button key={conn.id} onClick={() => setSelectedConnection(conn)}
                                                    className={`p-4 rounded-xl border-2 text-left flex items-center gap-3.5 transition-all ${
                                                        isSelected ? 'border-brand-blue bg-brand-blue/5 shadow-md shadow-brand-blue/10' : 'border-slate-200 bg-white hover:border-brand-blue/40 hover:shadow-sm'
                                                    }`}
                                                >
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                        <Server size={18} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-slate-800 text-sm truncate">{conn.name}</span>
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black uppercase shrink-0 ${colorClass}`}>{conn.db_type}</span>
                                                        </div>
                                                        <p className="text-xs text-slate-400 mt-0.5 truncate">{conn.host} &middot; {conn.database}</p>
                                                    </div>
                                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'border-brand-blue bg-brand-blue' : 'border-slate-300'}`}>
                                                        {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Step 2: Select Table */}
                                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/80">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${selectedConnection ? 'bg-brand-blue text-white' : 'bg-slate-200 text-slate-400'}`}>2</div>
                                        <span className={`text-sm font-bold ${selectedConnection ? 'text-slate-700' : 'text-slate-400'}`}>Select Table</span>
                                        {loadingTables && <Loader2 size={14} className="ml-auto text-brand-blue animate-spin" />}
                                    </div>
                                    <div className="p-4">
                                        {!selectedConnection ? (
                                            <p className="text-sm text-slate-400 text-center py-2">Select a connection first</p>
                                        ) : loadingTables ? (
                                            <div className="flex items-center gap-2 text-slate-500 text-sm py-1">
                                                <Loader2 className="w-4 h-4 animate-spin text-brand-blue" /> Fetching tables…
                                            </div>
                                        ) : tables.length === 0 ? (
                                            <p className="text-sm text-slate-400 text-center py-2">No tables found</p>
                                        ) : (
                                            <div className="relative">
                                                <select value={selectedTable} onChange={handleTableChange}
                                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 appearance-none bg-white pr-10 text-slate-700">
                                                    <option value="">— Select a table —</option>
                                                    {tables.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Step 3: SQL Query */}
                                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/80">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${query ? 'bg-brand-blue text-white' : 'bg-slate-200 text-slate-400'}`}>3</div>
                                        <span className={`text-sm font-bold ${query ? 'text-slate-700' : 'text-slate-400'}`}>SQL Query</span>
                                        <span className="ml-auto text-[11px] text-slate-400 font-semibold bg-slate-100 px-2 py-0.5 rounded-md">SELECT only</span>
                                    </div>
                                    <div className="p-4">
                                        <div className="relative bg-slate-900 rounded-xl overflow-hidden">
                                            <textarea
                                                value={query}
                                                onChange={e => setQuery(e.target.value)}
                                                rows={Math.max(4, query.split('\n').length)}
                                                className="w-full px-5 py-4 bg-transparent text-emerald-400 font-mono text-sm focus:outline-none resize-none leading-relaxed"
                                                placeholder="SELECT * FROM users LIMIT 1000"
                                                spellCheck={false}
                                            />
                                        </div>
                                        <p className="text-xs text-slate-400 mt-2.5 flex items-center gap-1.5">
                                            <ShieldCheck size={12} className="text-emerald-500" />
                                            Read-only. Data is never modified by your query.
                                        </p>
                                    </div>
                                </div>

                                {/* Run Button */}
                                <button
                                    onClick={async () => {
                                        if (!selectedConnection || !query) return;
                                        setIsLoading(true);
                                        setError(null);
                                        try {
                                            const response = await axios.post(`${API_BASE}/ingest/database`, {
                                                connection_id: selectedConnection.id,
                                                query: query
                                            }, { headers });
                                            onUploadSuccess(response.data);
                                        } catch (err) {
                                            setError(err.response?.data?.detail || 'Error connecting to database.');
                                            setIsLoading(false);
                                        }
                                    }}
                                    disabled={!selectedConnection || !query || isLoading}
                                    className="w-full py-3.5 bg-brand-dark hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-2xl font-black text-base flex items-center justify-center gap-2.5 transition-all hover:-translate-y-0.5 hover:shadow-lg shadow-slate-900/20"
                                >
                                    {isLoading
                                        ? <><Loader2 size={20} className="animate-spin" /> Importing Data…</>
                                        : <><Play size={18} fill="currentColor" /> Run Query &amp; Import</>
                                    }
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Trust Footer */}
            {!compact && (
                <div className="mt-16 flex flex-wrap justify-center gap-12 text-slate-400 grayscale opacity-70">
                    <div className="flex items-center gap-2 font-bold"><ShieldCheck size={20} /> SOC2 COMPLIANT</div>
                    <div className="flex items-center gap-2 font-bold"><HardDrive size={20} /> AES-256 ENCRYPTION</div>
                    <div className="flex items-center gap-2 font-bold"><RefreshCw size={20} /> REAL-TIME SYNC</div>
                </div>
            )}
        </div>
    );
};

export default DataConnection;
