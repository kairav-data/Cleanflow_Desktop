import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, Clock, FileCheck, ChevronRight, Trash2, RefreshCw, Database, Server, Plus, X, Link2, Unplug } from 'lucide-react';
import axios from 'axios';
import { API_BASE } from '../lib/runtimeConfig';

const HistoryPanel = ({ onLoadJob }) => {
    const [jobs, setJobs] = useState([]);
    const [connections, setConnections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('history'); // 'history' | 'connections'
    const [showConnectionForm, setShowConnectionForm] = useState(false);

    const [newConn, setNewConn] = useState({
        name: '',
        db_type: 'mssql',
        host: '',
        port: 1433,
        database: '',
        username: '',
        password: ''
    });

    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        if (!token) {
            setJobs([]);
            setConnections([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const [jobsRes, connsRes] = await Promise.all([
                axios.get(`${API_BASE}/history/jobs`, { headers }),
                axios.get(`${API_BASE}/connections`, { headers })
            ]);
            setJobs(jobsRes.data || []);
            setConnections(connsRes.data || []);
        } catch (e) {
            console.error('Error fetching data:', e);
        }
        setLoading(false);
    };

    const saveConnection = async () => {
        try {
            await axios.post(`${API_BASE}/connections`, newConn, { headers });
            setShowConnectionForm(false);
            setNewConn({ name: '', db_type: 'mssql', host: '', port: 1433, database: '', username: '', password: '' });
            fetchData();
        } catch (e) {
            alert('Failed to save: ' + (e.response?.data?.detail || e.message));
        }
    };

    const testConnection = async () => {
        try {
            const res = await axios.post(`${API_BASE}/connections/test`, newConn, { headers });
            alert(res.data.status === 'success' ? 'Connection successful!' : 'Connection failed: ' + (res.data.error || 'Unknown error'));
        } catch (e) {
            alert('Test failed: ' + e.message);
        }
    };

    const deleteConnection = async (id) => {
        if (!confirm('Delete this connection?')) return;
        try {
            await axios.delete(`${API_BASE}/connections/${id}`, { headers });
            fetchData();
        } catch (e) {
            alert('Failed to delete');
        }
    };

    const formatDate = (isoString) => {
        try {
            return new Date(isoString).toLocaleString();
        } catch {
            return isoString;
        }
    };

    return (
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 w-full max-w-md">
            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 py-2 px-4 rounded-xl font-bold transition-colors ${activeTab === 'history' ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                    <History size={16} className="inline mr-2" /> History
                </button>
                <button
                    onClick={() => setActiveTab('connections')}
                    className={`flex-1 py-2 px-4 rounded-xl font-bold transition-colors ${activeTab === 'connections' ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                    <Database size={16} className="inline mr-2" /> Connections
                </button>
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
                {activeTab === 'history' && (
                    <motion.div
                        key="history"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-900">Recent Jobs</h3>
                            <button onClick={fetchData} className="text-slate-400 hover:text-brand-blue">
                                <RefreshCw size={16} />
                            </button>
                        </div>

                        {loading ? (
                            <div className="text-center py-8 text-slate-400">Loading...</div>
                        ) : jobs.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                                <Clock size={32} className="mx-auto mb-2 opacity-50" />
                                No validation history yet
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {jobs.map(job => (
                                    <div
                                        key={job.id}
                                        onClick={() => onLoadJob && onLoadJob(job)}
                                        className="p-4 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-medium text-slate-800">{job.file_name}</div>
                                                <div className="text-xs text-slate-400">{formatDate(job.created_at)}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-green-600">{job.valid_rows} valid</span>
                                                <ChevronRight size={16} className="text-slate-300 group-hover:text-brand-blue" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}

                {activeTab === 'connections' && (
                    <motion.div
                        key="connections"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-900">Saved Connections</h3>
                            <button
                                onClick={() => setShowConnectionForm(true)}
                                className="text-brand-blue hover:text-brand-dark font-bold text-sm flex items-center gap-1"
                            >
                                <Plus size={14} /> Add
                            </button>
                        </div>

                        {/* Connection Form */}
                        {showConnectionForm && (
                            <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="font-bold text-sm">New Connection</span>
                                    <button onClick={() => setShowConnectionForm(false)} className="text-slate-400 hover:text-red-500">
                                        <X size={16} />
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        placeholder="Connection Name"
                                        className="w-full p-2 border rounded-lg text-sm"
                                        value={newConn.name}
                                        onChange={(e) => setNewConn({ ...newConn, name: e.target.value })}
                                    />
                                    <select
                                        className="w-full p-2 border rounded-lg text-sm"
                                        value={newConn.db_type}
                                        onChange={(e) => setNewConn({ ...newConn, db_type: e.target.value })}
                                    >
                                        <option value="mssql">MS SQL Server</option>
                                        <option value="mysql">MySQL</option>
                                        <option value="postgresql">PostgreSQL</option>
                                        <option value="oracle">Oracle</option>
                                        <option value="sqlite">SQLite</option>
                                    </select>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Host"
                                            className="flex-1 p-2 border rounded-lg text-sm"
                                            value={newConn.host}
                                            onChange={(e) => setNewConn({ ...newConn, host: e.target.value })}
                                        />
                                        <input
                                            type="number"
                                            placeholder="Port"
                                            className="w-20 p-2 border rounded-lg text-sm"
                                            value={newConn.port}
                                            onChange={(e) => setNewConn({ ...newConn, port: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Database Name"
                                        className="w-full p-2 border rounded-lg text-sm"
                                        value={newConn.database}
                                        onChange={(e) => setNewConn({ ...newConn, database: e.target.value })}
                                    />
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Username"
                                            className="flex-1 p-2 border rounded-lg text-sm"
                                            value={newConn.username}
                                            onChange={(e) => setNewConn({ ...newConn, username: e.target.value })}
                                        />
                                        <input
                                            type="password"
                                            placeholder="Password"
                                            className="flex-1 p-2 border rounded-lg text-sm"
                                            value={newConn.password}
                                            onChange={(e) => setNewConn({ ...newConn, password: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={testConnection}
                                            className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg font-medium text-sm"
                                        >
                                            Test Connection
                                        </button>
                                        <button
                                            onClick={saveConnection}
                                            className="flex-1 py-2 bg-brand-blue hover:bg-brand-dark text-white rounded-lg font-medium text-sm"
                                        >
                                            Save
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Connections List */}
                        {connections.length === 0 && !showConnectionForm ? (
                            <div className="text-center py-8 text-slate-400">
                                <Server size={32} className="mx-auto mb-2 opacity-50" />
                                No saved connections
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {connections.map(conn => (
                                    <div
                                        key={conn.id}
                                        className="p-4 bg-slate-50 rounded-xl flex items-center justify-between group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                                                <Database size={18} />
                                            </div>
                                            <div>
                                                <div className="font-medium text-slate-800">{conn.name}</div>
                                                <div className="text-xs text-slate-400">{conn.db_type.toUpperCase()} • {conn.host}</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => deleteConnection(conn.id)}
                                            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default HistoryPanel;
