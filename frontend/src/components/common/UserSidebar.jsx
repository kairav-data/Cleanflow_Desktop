import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, User, History, Database, CreditCard, Settings,
    Clock, ChevronRight, Trash2, RefreshCw, Server, Plus, Link2, Check, Crown
} from 'lucide-react';
import axios from 'axios';
import { API_BASE } from '../../lib/runtimeConfig';

const UserSidebar = ({ isOpen, onClose, user }) => {
    const [activeTab, setActiveTab] = useState('profile');
    const [jobs, setJobs] = useState([]);
    const [connections, setConnections] = useState([]);
    const [loading, setLoading] = useState(false);
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

    const tabs = [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'history', label: 'History', icon: History },
        { id: 'connections', label: 'Connections', icon: Database },
        { id: 'subscription', label: 'Subscription', icon: CreditCard },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    useEffect(() => {
        if (isOpen && (activeTab === 'history' || activeTab === 'connections')) {
            fetchData();
        }
    }, [isOpen, activeTab]);

    const fetchData = async () => {
        if (!token) {
            setJobs([]);
            setConnections([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            if (activeTab === 'history') {
                const res = await axios.get(`${API_BASE}/history/jobs`, { headers });
                setJobs(res.data || []);
            } else if (activeTab === 'connections') {
                const res = await axios.get(`${API_BASE}/connections`, { headers });
                setConnections(res.data || []);
            }
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
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
                    />

                    {/* Sidebar */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex"
                    >
                        {/* Tab Navigation - Left Side */}
                        <div className="w-16 bg-slate-50 border-r border-slate-100 flex flex-col items-center py-6 gap-2">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${activeTab === tab.id
                                            ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/30'
                                            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                                        }`}
                                    title={tab.label}
                                >
                                    <tab.icon size={20} />
                                </button>
                            ))}
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Header */}
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-900">
                                    {tabs.find(t => t.id === activeTab)?.label}
                                </h2>
                                <button
                                    onClick={onClose}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Tab Content */}
                            <div className="flex-1 overflow-y-auto p-6">
                                {/* Profile Tab */}
                                {activeTab === 'profile' && user && (
                                    <div className="space-y-6">
                                        <div className="flex flex-col items-center">
                                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-blue to-purple-600 flex items-center justify-center text-white text-3xl font-bold mb-4">
                                                {user.full_name?.[0] || user.email[0].toUpperCase()}
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-900">{user.full_name || 'User'}</h3>
                                            <p className="text-slate-500">{user.email}</p>
                                            {user.is_premium && (
                                                <div className="mt-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold flex items-center gap-1">
                                                    <Crown size={12} /> Premium Member
                                                </div>
                                            )}
                                        </div>
                                        <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Email</span>
                                                <span className="font-medium text-slate-800">{user.email}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Plan</span>
                                                <span className="font-medium text-slate-800">{user.is_premium ? 'Premium' : 'Free'}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* History Tab */}
                                {activeTab === 'history' && (
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <p className="text-sm text-slate-500">{jobs.length} validation jobs</p>
                                            <button onClick={fetchData} className="text-slate-400 hover:text-brand-blue">
                                                <RefreshCw size={16} />
                                            </button>
                                        </div>

                                        {loading ? (
                                            <div className="text-center py-12 text-slate-400">Loading...</div>
                                        ) : jobs.length === 0 ? (
                                            <div className="text-center py-12 text-slate-400">
                                                <Clock size={40} className="mx-auto mb-3 opacity-50" />
                                                <p>No validation history yet</p>
                                                <p className="text-xs mt-1">Run a validation to see it here</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {jobs.map(job => (
                                                    <div
                                                        key={job.id}
                                                        className="p-4 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors group"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <div className="font-medium text-slate-800">{job.file_name}</div>
                                                                <div className="text-xs text-slate-400 mt-1">{formatDate(job.created_at)}</div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-sm font-bold text-green-600">{job.valid_rows} valid</div>
                                                                <div className="text-xs text-red-500">{job.invalid_rows} errors</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Connections Tab */}
                                {activeTab === 'connections' && (
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <p className="text-sm text-slate-500">{connections.length} saved connections</p>
                                            <button
                                                onClick={() => setShowConnectionForm(true)}
                                                className="text-brand-blue hover:text-brand-dark font-bold text-sm flex items-center gap-1"
                                            >
                                                <Plus size={14} /> Add New
                                            </button>
                                        </div>

                                        {/* Connection Form */}
                                        {showConnectionForm && (
                                            <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                                <div className="flex justify-between items-center mb-4">
                                                    <span className="font-bold text-slate-800">New Connection</span>
                                                    <button onClick={() => setShowConnectionForm(false)} className="text-slate-400 hover:text-red-500">
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                                <div className="space-y-3">
                                                    <input
                                                        type="text"
                                                        placeholder="Connection Name"
                                                        className="w-full p-3 border border-slate-200 rounded-xl text-sm"
                                                        value={newConn.name}
                                                        onChange={(e) => setNewConn({ ...newConn, name: e.target.value })}
                                                    />
                                                    <select
                                                        className="w-full p-3 border border-slate-200 rounded-xl text-sm"
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
                                                            className="flex-1 p-3 border border-slate-200 rounded-xl text-sm"
                                                            value={newConn.host}
                                                            onChange={(e) => setNewConn({ ...newConn, host: e.target.value })}
                                                        />
                                                        <input
                                                            type="number"
                                                            placeholder="Port"
                                                            className="w-24 p-3 border border-slate-200 rounded-xl text-sm"
                                                            value={newConn.port}
                                                            onChange={(e) => setNewConn({ ...newConn, port: parseInt(e.target.value) })}
                                                        />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder="Database Name"
                                                        className="w-full p-3 border border-slate-200 rounded-xl text-sm"
                                                        value={newConn.database}
                                                        onChange={(e) => setNewConn({ ...newConn, database: e.target.value })}
                                                    />
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            placeholder="Username"
                                                            className="flex-1 p-3 border border-slate-200 rounded-xl text-sm"
                                                            value={newConn.username}
                                                            onChange={(e) => setNewConn({ ...newConn, username: e.target.value })}
                                                        />
                                                        <input
                                                            type="password"
                                                            placeholder="Password"
                                                            className="flex-1 p-3 border border-slate-200 rounded-xl text-sm"
                                                            value={newConn.password}
                                                            onChange={(e) => setNewConn({ ...newConn, password: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="flex gap-2 pt-2">
                                                        <button
                                                            onClick={testConnection}
                                                            className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 rounded-xl font-medium text-sm transition-colors"
                                                        >
                                                            Test Connection
                                                        </button>
                                                        <button
                                                            onClick={saveConnection}
                                                            className="flex-1 py-3 bg-brand-blue hover:bg-brand-dark text-white rounded-xl font-medium text-sm transition-colors"
                                                        >
                                                            Save
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Connections List */}
                                        {connections.length === 0 && !showConnectionForm ? (
                                            <div className="text-center py-12 text-slate-400">
                                                <Server size={40} className="mx-auto mb-3 opacity-50" />
                                                <p>No saved connections</p>
                                                <p className="text-xs mt-1">Add a database connection to get started</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {connections.map(conn => (
                                                    <div
                                                        key={conn.id}
                                                        className="p-4 bg-slate-50 rounded-xl flex items-center justify-between group hover:bg-slate-100 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                                                                <Database size={18} />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-slate-800">{conn.name}</div>
                                                                <div className="text-xs text-slate-400">{conn.db_type?.toUpperCase()} • {conn.host}</div>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => deleteConnection(conn.id)}
                                                            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Subscription Tab */}
                                {activeTab === 'subscription' && (
                                    <div className="space-y-6">
                                        <div className={`p-6 rounded-2xl border-2 ${user?.is_premium ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                                            <div className="flex items-center gap-3 mb-4">
                                                {user?.is_premium ? (
                                                    <Crown className="text-amber-500" size={24} />
                                                ) : (
                                                    <CreditCard className="text-slate-400" size={24} />
                                                )}
                                                <div>
                                                    <h3 className="font-bold text-lg">{user?.is_premium ? 'Premium Plan' : 'Free Plan'}</h3>
                                                    <p className="text-sm text-slate-500">{user?.is_premium ? 'All features unlocked' : 'Basic features'}</p>
                                                </div>
                                            </div>
                                            {!user?.is_premium && (
                                                <button className="w-full py-3 bg-gradient-to-r from-brand-blue to-purple-600 text-white rounded-xl font-bold hover:shadow-lg transition-all">
                                                    Upgrade to Premium
                                                </button>
                                            )}
                                        </div>

                                        <div className="space-y-3">
                                            <h4 className="font-bold text-slate-800">Plan Features</h4>
                                            {['Unlimited Validations', 'All Rule Types', 'Database Connections', 'Job History', 'Priority Support'].map((feature, i) => (
                                                <div key={i} className="flex items-center gap-3 text-slate-600">
                                                    <Check size={16} className="text-green-500" />
                                                    <span>{feature}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Settings Tab */}
                                {activeTab === 'settings' && (
                                    <div className="space-y-4">
                                        <div className="p-4 bg-slate-50 rounded-xl">
                                            <h4 className="font-medium text-slate-800 mb-2">Notifications</h4>
                                            <label className="flex items-center justify-between">
                                                <span className="text-sm text-slate-600">Email notifications</span>
                                                <input type="checkbox" className="w-5 h-5 accent-brand-blue" defaultChecked />
                                            </label>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-xl">
                                            <h4 className="font-medium text-slate-800 mb-2">Theme</h4>
                                            <select className="w-full p-3 border border-slate-200 rounded-xl text-sm">
                                                <option>Light</option>
                                                <option>Dark</option>
                                                <option>System</option>
                                            </select>
                                        </div>
                                        <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                                            <h4 className="font-medium text-red-800 mb-2">Danger Zone</h4>
                                            <button className="text-sm text-red-600 hover:text-red-800 font-medium">
                                                Delete Account
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default UserSidebar;
