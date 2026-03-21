import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
    Upload, Database, FileSpreadsheet, Loader2, AlertCircle,
    HardDrive, Server, Play, RefreshCw, Plus, X, ChevronDown,
    Check, FileText, ShieldCheck, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Pulling the URL from the .env file
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'import.meta.env.VITE_API_URL';

const DataConnection = ({ onUploadSuccess }) => {
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

        // Dynamic progress simulation for UI feel
        const interval = setInterval(() => {
            setUploadProgress(prev => (prev < 90 ? prev + 10 : prev));
        }, 100);

        try {
            const response = await axios.post(`${API_BASE}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data', ...headers }
            });
            setUploadProgress(100);
            setTimeout(() => onUploadSuccess(response.data), 500);
        } catch (err) {
            setError(err.response?.data?.detail || "Error uploading file.");
            setUploadProgress(0);
        } finally {
            clearInterval(interval);
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto py-12 px-6">
            {/* Header Section */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-12"
            >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-blue/10 text-brand-blue text-xs font-bold uppercase tracking-wider mb-4">
                    <Zap size={14} /> Data Ingestion Engine
                </div>
                <h2 className="text-5xl font-black text-slate-900 mb-4 tracking-tight">
                    Bring Your <span className="text-brand-blue">Data</span> to Life
                </h2>
                <p className="text-slate-500 text-lg max-w-2xl mx-auto">
                    Seamlessly connect to your cloud warehouses or upload local assets to begin your cleaning workflow.
                </p>
            </motion.div>

            {/* Mode Switcher */}
            <div className="flex p-1.5 bg-slate-200/50 backdrop-blur-md rounded-2xl mb-10 w-fit mx-auto border border-white/50 shadow-inner">
                {['file', 'database'].map((m) => (
                    <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`relative flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold transition-all z-10 ${mode === m ? 'text-brand-blue' : 'text-slate-500 hover:text-slate-700'
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
                        <div className="flex items-center justify-center gap-4 bg-white/50 py-3 px-6 rounded-2xl w-fit mx-auto border border-slate-100 shadow-sm">
                            <span className="text-sm font-bold text-slate-600">CSV Settings:</span>
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
                            className={`relative group cursor-pointer border-2 border-dashed rounded-[2.5rem] p-20 flex flex-col items-center justify-center transition-all overflow-hidden ${isDragging ? 'border-brand-blue bg-brand-blue/5' : 'border-slate-300 bg-white hover:border-brand-blue hover:shadow-glow'
                                }`}
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
                                    <div className="w-24 h-24 bg-brand-blue/10 text-brand-blue rounded-[2rem] flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                                        <Upload size={48} strokeWidth={2.5} />
                                    </div>
                                    <h3 className="text-3xl font-black text-slate-800 mb-2">Drop your dataset here</h3>
                                    <p className="text-slate-400 font-medium">Supports CSV, Excel (XLSX) up to 50MB</p>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                ) : (
                    <motion.div key="db" className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-4 bg-brand-dark/5 text-brand-dark rounded-2xl"><Server size={32} /></div>
                            <div>
                                <h3 className="text-2xl font-bold text-slate-800">Direct Ingestion</h3>
                                <p className="text-slate-500">Select a secure connection to your warehouse</p>
                            </div>
                        </div>
                        
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl flex items-center gap-3">
                                <AlertCircle size={20} className="shrink-0" />
                                <span className="text-sm font-medium">{error}</span>
                            </div>
                        )}

                        {loadingConnections ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-8 h-8 text-brand-blue animate-spin" />
                            </div>
                        ) : connections.length === 0 ? (
                            <div className="text-center py-12 px-6 bg-slate-50 border border-slate-200 border-dashed rounded-3xl">
                                <Database size={48} className="mx-auto text-slate-300 mb-4" />
                                <h4 className="text-lg font-bold text-slate-700 mb-2">No Connections Found</h4>
                                <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">You haven't added any database connections yet. Please add one from the sidebar.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">1. Select Connection</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {connections.map(conn => (
                                            <button
                                                key={conn.id}
                                                onClick={() => setSelectedConnection(conn)}
                                                className={`p-4 rounded-2xl border text-left flex items-start gap-4 transition-all ${
                                                    selectedConnection?.id === conn.id
                                                        ? 'border-brand-blue bg-brand-blue/5 shadow-md shadow-brand-blue/10'
                                                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                            >
                                                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                                    selectedConnection?.id === conn.id ? 'border-brand-blue' : 'border-slate-300'
                                                }`}>
                                                    {selectedConnection?.id === conn.id && <div className="w-2 h-2 bg-brand-blue rounded-full" />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800">{conn.name}</div>
                                                    <div className="text-xs text-slate-500 mt-1">{conn.db_type.toUpperCase()} • {conn.host}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">2. Select Table</label>
                                    {loadingTables ? (
                                        <div className="flex items-center gap-2 text-slate-500 text-sm py-3 px-4 border border-slate-200 rounded-xl">
                                            <Loader2 className="w-4 h-4 animate-spin" /> Loading tables...
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <select 
                                                value={selectedTable}
                                                onChange={handleTableChange}
                                                className="w-full p-4 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 appearance-none bg-white pr-10"
                                            >
                                                <option value="">-- Select a table --</option>
                                                {tables.map(t => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                        </div>
                                    )}
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">3. SQL Query</label>
                                    <textarea
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        className="w-full p-4 border border-slate-200 rounded-2xl font-mono text-sm min-h-[120px] focus:outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
                                        placeholder="SELECT * FROM users LIMIT 1000"
                                    />
                                    <p className="text-xs text-slate-500 mt-2">Write a SELECT query to pull the exact dataset you want to clean.</p>
                                </div>
                                
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
                                            setError(err.response?.data?.detail || "Error connecting to database.");
                                            setIsLoading(false);
                                        }
                                    }}
                                    disabled={!selectedConnection || !query || isLoading}
                                    className="w-full py-4 bg-brand-dark hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-2xl font-black text-lg flex items-center justify-center gap-2"
                                >
                                    {isLoading ? <Loader2 size={24} className="animate-spin" /> : <Play size={20} />}
                                    {isLoading ? 'Ingesting Data...' : 'Run Query & Import'}
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Trust Footer */}
            <div className="mt-16 flex flex-wrap justify-center gap-12 text-slate-400 grayscale opacity-70">
                <div className="flex items-center gap-2 font-bold"><ShieldCheck size={20} /> SOC2 COMPLIANT</div>
                <div className="flex items-center gap-2 font-bold"><HardDrive size={20} /> AES-256 ENCRYPTION</div>
                <div className="flex items-center gap-2 font-bold"><RefreshCw size={20} /> REAL-TIME SYNC</div>
            </div>
        </div>
    );
};

export default DataConnection;
