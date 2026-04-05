import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LogOut, Search, Sparkles, Database,
    FileCheck, ArrowRight, Zap, Check,
    Globe, ChevronRight, Shuffle, GitMerge, RefreshCw, Trash2, ShieldCheck, AlertTriangle, BarChart3,
    Menu, X, Home, LayoutDashboard, Settings, CreditCard, User, FolderClock, Clock3
} from 'lucide-react';

// Components
import { DataConnection, RuleBuilder, ResultsDashboard } from './components';
import { AuthModal, PaymentModal } from './components/modals';
import { Footer, PlatformDropdown } from './components/common';
import { HomePage, PricingPage, UserProfilePage } from './components/pages';
import ChatBot from './components/ChatBot';

// Feature Builders
import { EnrichmentBuilder, ScraperBuilder, SchemaMapper, DataMatchingBuilder, PipelineBuilder, SchedulerBuilder, PipelineRuns } from './features';

// Assets
import Logo from './assets/logo.png';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'import.meta.env.VITE_API_URL';
const Motion = motion;

function App() {
    const [activeTab, setActiveTab] = useState('home');
    const [step, setStep] = useState(1);
    const [sessionId, setSessionId] = useState(null);
    const [columns, setColumns] = useState([]);
    const [filename, setFilename] = useState('');
    const [validationResults, setValidationResults] = useState(null);

    const [user, setUser] = useState(null);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [intendedTab, setIntendedTab] = useState(null);
    const [authDefaultMode, setAuthDefaultMode] = useState('login');
    const [recentJobs, setRecentJobs] = useState([]);
    const [jobsLoading, setJobsLoading] = useState(false);
    const [historyModuleTab, setHistoryModuleTab] = useState('validation');

    // Mobile Sidebar Toggle
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            axios.get(`${API_BASE}/users/me`, {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(res => {
                    setUser(res.data);
                    setActiveTab((prev) => (prev === 'home' ? 'dashboard' : prev));
                })
                .catch(() => {
                    localStorage.removeItem('token');
                    setUser(null);
                });
        }
    }, []);

    const fetchRecentJobs = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        setJobsLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/history/jobs`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const sorted = (res.data || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            setRecentJobs(sorted);
        } catch (e) {
            console.error("Failed to fetch user history:", e);
        } finally {
            setJobsLoading(false);
        }
    };

    useEffect(() => {
        if (!user) {
            setRecentJobs([]);
            return;
        }
        fetchRecentJobs();
    }, [user, activeTab]);



    const handleLogout = () => {
        const shouldLogout = window.confirm("Are you sure you want to log out?");
        if (!shouldLogout) return;

        localStorage.removeItem('token');
        setUser(null);
        setStep(1);
        setActiveTab('home');
    };

    const handleFeatureAccess = (tabName) => {
        if (!user) {
            setIntendedTab(tabName);
            setAuthDefaultMode('login');
            setIsAuthOpen(true);
            return;
        }
        setActiveTab(tabName);
        if (tabName === 'validate') setStep(1);
        setIsSidebarOpen(false); // Close mobile sidebar if open
    };

    const startValidation = () => {
        if (!user) {
            setIntendedTab('validate');
            setAuthDefaultMode('signup');
            setIsAuthOpen(true);
            return;
        }
        setValidationResults(null);
        setColumns([]);
        setFilename('');
        setSessionId(null);
        handleFeatureAccess('validate');
    };
    const goToLanding = () => setActiveTab(user ? 'dashboard' : 'home');
    const formatJobDate = (iso) => {
        try {
            return new Date(iso).toLocaleString();
        } catch {
            return iso;
        }
    };

    const getTabFromModule = (moduleName) => {
        if (moduleName === 'mapper') return 'mapper';
        if (moduleName === 'enrichment') return 'enrichment';
        if (moduleName === 'scraper') return 'scraper';
        if (moduleName === 'matching') return 'matching';
        if (moduleName === 'pipeline') return 'pipeline-runs';
        return 'validate';
    };

    const resumeJob = (job) => {
        const targetTab = getTabFromModule(job.module);
        if (targetTab === 'validate') {
            setFilename(job.file_name || job.filename || '');
            const allColumns = job.column_stats ? Object.keys(job.column_stats) : [];
            const uniqueColumns = Array.from(new Set([...allColumns, ...(job.rules || []).map(r => r.column).filter(Boolean)]));
            if (uniqueColumns.length > 0) {
                setColumns(uniqueColumns);
            }
            setValidationResults({
                total_rows: job.total_rows || 0,
                valid_rows: job.valid_rows || 0,
                invalid_rows: job.invalid_rows || 0,
                column_stats: job.column_stats || {},
                rules: job.rules || []
            });
            setStep(3);
        }
        setActiveTab(targetTab);
    };

    const deleteHistoryItem = async (jobId) => {
        if (!window.confirm("Delete this history item?")) return;
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            await axios.delete(`${API_BASE}/history/jobs/${jobId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchRecentJobs();
        } catch (err) {
            console.error("Failed to delete history item:", err);
            alert("Failed to delete history item.");
        }
    };

    const clearHistory = async (moduleName) => {
        const title = moduleName === 'all' ? 'all history' : `${moduleName} history`;
        if (!window.confirm(`Clear ${title}? This cannot be undone.`)) return;
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const url = moduleName === 'all'
                ? `${API_BASE}/history/jobs`
                : `${API_BASE}/history/jobs?module=${moduleName}`;
            await axios.delete(url, { headers: { Authorization: `Bearer ${token}` } });
            fetchRecentJobs();
        } catch (err) {
            console.error("Failed to clear history:", err);
            alert("Failed to clear history.");
        }
    };

    // Main UI components (Workspace / Feature Tabs)
    const renderWorkspaceContent = () => (
        <AnimatePresence mode='wait'>
            {/* DASHBOARD VIEW */}
            {activeTab === 'dashboard' && user && (
                <motion.div
                    key="dashboard-tab"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="w-full max-w-7xl mx-auto pb-20"
                >
                    {/* Hero Section */}
                    <div className="mb-10 relative rounded-3xl overflow-hidden shadow-2xl" style={{background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)'}}>
                        {/* Ambient glow blobs */}
                        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute -top-10 -right-10 opacity-5"><Sparkles size={200} className="text-white" /></div>

                        <div className="relative z-10 px-8 md:px-12 py-10 md:py-12">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
                                {/* Left: Text + CTAs */}
                                <div className="flex-1 min-w-0">
                                    {/* Badge */}
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-bold tracking-widest uppercase">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        Active Workspace
                                    </div>

                                    {/* Heading */}
                                    <h1 className="text-4xl md:text-5xl font-black text-white mb-1 leading-tight tracking-tight">
                                        Welcome back,
                                    </h1>
                                    <p className="text-4xl md:text-5xl font-black mb-5 leading-tight tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-400">
                                        {user.full_name || 'User'}
                                    </p>

                                    {/* Subtitle */}
                                    <p className="text-slate-400 text-base leading-relaxed max-w-xl mb-8 font-medium">
                                        Execute intelligent data workflows, manage your recent jobs, and read through how to leverage the toolset below.
                                    </p>

                                    {/* CTA Buttons */}
                                    <div className="flex flex-wrap items-center gap-3">
                                        <button
                                            onClick={() => setActiveTab('pipeline')}
                                            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-slate-900 rounded-xl font-black text-sm hover:bg-slate-100 hover:scale-[1.02] transition-all shadow-lg"
                                        >
                                            <Zap size={16} className="text-emerald-600" /> New Workflow
                                        </button>
                                        <button
                                            onClick={() => document.getElementById('job-history-section')?.scrollIntoView({ behavior: 'smooth' })}
                                            className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl font-bold text-sm transition-all"
                                        >
                                            <BarChart3 size={16} /> View Recent Jobs
                                        </button>
                                    </div>
                                </div>

                                {/* Right: Stats */}
                                <div className="flex flex-row lg:flex-col gap-6 lg:gap-5 shrink-0">
                                    {[
                                        { value: recentJobs.length, label: 'active jobs', color: 'text-white' },
                                        { value: recentJobs.length > 0 ? '98%' : '—', label: 'success rate', color: 'text-emerald-400' },
                                        { value: recentJobs.reduce((acc, j) => acc + (j.total_rows || 0), 0).toLocaleString() || '0', label: 'rows processed', color: 'text-sky-400' },
                                    ].map(({ value, label, color }) => (
                                        <div key={label} className="flex flex-col items-center lg:items-end">
                                            <span className={`text-3xl font-black ${color} tracking-tight`}>{value}</span>
                                            <span className="text-slate-500 text-xs font-semibold mt-0.5">{label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>


                    {/* Section: Tutorials & Tools */}
                    <div className="mb-12">
                        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <Database className="text-emerald-500" /> Data Services & Tutorials
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {[
                                {
                                    title: 'Quality Validation',
                                    description: 'Upload data, configure rules, and validate records.',
                                    tutorial: '1. Connect your dataset via file upload or DB.\n2. Define column rules (e.g., regex, ranges).\n3. Review pass/fail metrics and export clean data.',
                                    icon: ShieldCheck,
                                    color: 'text-blue-500',
                                    bg: 'bg-blue-50',
                                    action: () => {
                                        setValidationResults(null);
                                        setColumns([]);
                                        setFilename('');
                                        setSessionId(null);
                                        setStep(1);
                                        setActiveTab('validate');
                                    }
                                },
                                {
                                    title: 'Data Cleaning',
                                    description: 'Clean data and enhance records with verified attributes.',
                                    tutorial: '1. Select an entity type.\n2. Upload source rows with target attributes.\n3. The engine automatically finds missing data via web integration.',
                                    icon: Sparkles,
                                    color: 'text-emerald-500',
                                    bg: 'bg-emerald-50',
                                    action: () => setActiveTab('enrichment'),
                                },
                                {
                                    title: 'Schema Mapping',
                                    description: 'Map and transform columns between datasets.',
                                    tutorial: '1. Define your target schema (e.g., standard standard_name).\n2. Drag & Drop columns from source to target.\n3. Validate the structural transformation.',
                                    icon: GitMerge,
                                    color: 'text-indigo-500',
                                    bg: 'bg-indigo-50',
                                    action: () => setActiveTab('mapper'),
                                },
                                {
                                    title: 'Web Scraping',
                                    description: 'Extract structured data from URLs at scale.',
                                    tutorial: '1. Choose an extraction template.\n2. Paste target URLs or CSS selectors.\n3. The system parallelizes the scrape and chunks the HTML to JSON.',
                                    icon: Globe,
                                    color: 'text-orange-500',
                                    bg: 'bg-orange-50',
                                    action: () => setActiveTab('scraper'),
                                },
                                {
                                    title: 'Data Matching',
                                    description: 'Identify duplicate or related entities across datasets.',
                                    tutorial: '1. Select two datasets for comparison.\n2. Choose algorithms (Fuzzy, Cosine, Exact) and set thresholds.\n3. Review similarity scores and merge rows.',
                                    icon: Shuffle,
                                    color: 'text-purple-500',
                                    bg: 'bg-purple-50',
                                    action: () => setActiveTab('matching'),
                                },
                                {
                                    title: 'Pipeline Builder',
                                    description: 'Design orchestrated flows across multiple data operations.',
                                    tutorial: '1. Drag Data Sources to the canvas.\n2. Connect them to Cleaning/Validation nodes.\n3. Route the output to an Export node, then click Run.',
                                    icon: GitMerge,
                                    color: 'text-slate-700',
                                    bg: 'bg-slate-100',
                                    action: () => setActiveTab('pipeline'),
                                }
                            ].map((item) => (
                                <div key={item.title} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all group flex flex-col h-full">
                                    <div className="p-6 flex-1">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${item.bg}`}>
                                            <item.icon size={24} className={item.color} />
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900 mb-2">{item.title}</h3>
                                        <p className="text-sm font-medium text-slate-500 mb-6">{item.description}</p>

                                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 relative overflow-hidden group-hover:border-slate-300 transition-colors">
                                            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">How it works</h4>
                                            <ul className="space-y-2">
                                                {item.tutorial.split('\n').map((step, idx) => (
                                                    <li key={idx} className="text-sm text-slate-600 flex gap-2">
                                                        <span className="text-slate-400 font-bold shrink-0">{step.charAt(0)}</span>
                                                        <span>{step.substring(2)}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                    <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
                                        <button
                                            onClick={item.action}
                                            className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 flex items-center justify-center gap-2"
                                        >
                                            Launch Tool <ArrowRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Section: Job History & Orchestration */}
                    <div id="job-history-section" className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
                        <div className="lg:col-span-3">
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                                <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900">Job History</h3>
                                        <p className="text-sm text-slate-500 mt-1">Review outputs from your recent pipeline runs and data services.</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={fetchRecentJobs} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors" title="Refresh">
                                            <RefreshCw size={18} />
                                        </button>
                                        <button onClick={() => clearHistory(historyModuleTab)} className="px-4 py-2 text-sm font-bold rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors">
                                            Clear Data
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 flex flex-wrap gap-2 border-b border-slate-100 bg-white">
                                    {[
                                        { id: 'validation', label: 'Quality Validation' },
                                        { id: 'enrichment', label: 'Data Enrichment' },
                                        { id: 'mapper', label: 'Schema Mapping' },
                                        { id: 'scraper', label: 'Web Scraping' },
                                        { id: 'matching', label: 'Data Matching' },
                                        { id: 'pipeline', label: 'Pipelines' }
                                    ].map((tab) => {
                                        const count = recentJobs.filter(j => (j.module || 'validation') === tab.id).length;
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => setHistoryModuleTab(tab.id)}
                                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${historyModuleTab === tab.id
                                                    ? 'bg-slate-900 text-white shadow-md'
                                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 hover:border-slate-300'
                                                    }`}
                                            >
                                                {tab.label} <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${historyModuleTab === tab.id ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-500'}`}>{count}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="bg-white rounded-b-2xl">
                                    {jobsLoading ? (
                                        <div className="py-16 text-center text-slate-400 flex flex-col items-center">
                                            <RefreshCw size={32} className="animate-spin mb-4 text-emerald-500" />
                                            <p className="font-medium">Loading historical records...</p>
                                        </div>
                                    ) : recentJobs.filter(j => (j.module || 'validation') === historyModuleTab).length === 0 ? (
                                        <div className="py-16 text-center flex flex-col items-center justify-center">
                                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                                                <FolderClock className="text-slate-300" size={32} />
                                            </div>
                                            <p className="text-lg font-bold text-slate-900 mb-1">No execution history</p>
                                            <p className="text-sm text-slate-500 max-w-sm">You haven't executed any jobs using the {historyModuleTab} module yet. Launch the tool above to get started.</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50/50 border-b border-slate-100 text-xs font-black uppercase text-slate-400 tracking-wider">
                                                        <th className="p-4 pl-6">Job Summary</th>
                                                        <th className="p-4">Status</th>
                                                        <th className="p-4">Execution Date</th>
                                                        <th className="p-4 pr-6 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {recentJobs
                                                        .filter(j => (j.module || 'validation') === historyModuleTab)
                                                        .map((job) => (
                                                            <tr key={job.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors group">
                                                                <td className="p-4 pl-6 align-middle">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                                                                        <span className="font-bold text-slate-800 truncate block max-w-[200px] md:max-w-md xl:max-w-lg" title={job.file_name || job.filename || 'Automated Job'}>
                                                                            {job.file_name || job.filename || 'Automated Job'}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="p-4 align-middle">
                                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                                        <Check size={12} /> Completed
                                                                    </span>
                                                                </td>
                                                                <td className="p-4 align-middle text-sm text-slate-500 font-medium">
                                                                    {formatJobDate(job.created_at)}
                                                                </td>
                                                                <td className="p-4 pr-6 align-middle text-right">
                                                                    <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button
                                                                            onClick={() => resumeJob(job)}
                                                                            className="px-4 py-2 text-xs font-bold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-all"
                                                                        >
                                                                            View Insights
                                                                        </button>
                                                                        <button
                                                                            onClick={() => deleteHistoryItem(job.id)}
                                                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-all"
                                                                            title="Delete Record"
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* 2. QUALITY VALIDATION VIEW */}
            {activeTab === 'validate' && (
                <motion.div key="validate-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex flex-col">
                    {/* Page Header */}
                    <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 bg-white shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                                <ShieldCheck size={20} className="text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Quality Validation</h2>
                                <p className="text-sm text-slate-500 mt-0.5">Upload, define rules, and review quality issues in one place.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {['Upload', 'Configure', 'Results'].map((label, i) => {
                                const s = i + 1;
                                return (
                                    <div key={s} className="flex items-center">
                                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${step === s ? 'bg-slate-900 text-white' :
                                                step > s ? 'bg-emerald-100 text-emerald-700' :
                                                    'bg-slate-100 text-slate-400'
                                            }`}>
                                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${step === s ? 'bg-white text-slate-900' :
                                                    step > s ? 'bg-emerald-500 text-white' :
                                                        'bg-slate-300 text-slate-500'
                                                }`}>{step > s ? '✓' : s}</span>
                                            {label}
                                        </div>
                                        {s < 3 && <div className={`w-6 h-px mx-1 ${step > s ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto px-8 py-6">
                        {step === 1 && (
                            <div>
                                <div className="mb-5">
                                    <h3 className="text-lg font-bold text-slate-800">Import Dataset</h3>
                                    <p className="text-sm text-slate-500 mt-1">Provide data via CSV, Excel, or a live database connection.</p>
                                </div>
                                <DataConnection compact={true} onUploadSuccess={(data) => { setSessionId(data.session_id); setFilename(data.filename || `Dataset_${new Date().getTime()}`); setColumns(data.columns); setStep(2); }} />
                            </div>
                        )}

                        {step === 2 && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                                <RuleBuilder
                                    compact={true}
                                    columns={columns}
                                    initialRules={validationResults?.rules || []}
                                    onRunValidation={async (rules) => {
                                        try {
                                            const token = localStorage.getItem('token');
                                            const headers = token ? { Authorization: `Bearer ${token}` } : {};
                                            const res = await axios.post(`${API_BASE}/validate/${sessionId}`, { rules }, { headers });
                                            setValidationResults({ ...res.data, rules });

                                            if (token) {
                                                try {
                                                    await axios.post(`${API_BASE}/history/jobs`, {
                                                        session_id: sessionId,
                                                        file_name: filename,
                                                        rules: rules,
                                                        total_rows: res.data.total_rows || 0,
                                                        valid_rows: res.data.valid_rows || 0,
                                                        invalid_rows: res.data.invalid_rows || 0,
                                                        column_stats: res.data.column_stats || null
                                                    }, { headers });
                                                    fetchRecentJobs();
                                                } catch (histErr) {
                                                    console.error("Failed to save history:", histErr);
                                                }
                                            }

                                            setStep(3);
                                        } catch (e) { alert("Validation Failed: " + (e.response?.data?.detail || e.message)); }
                                    }}
                                />
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                                <ResultsDashboard results={validationResults} onReset={() => {
                                    setValidationResults(null);
                                    setColumns([]);
                                    setFilename('');
                                    setSessionId(null);
                                    setStep(1);
                                }} onEditRules={() => setStep(2)} />
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* 3. ENRICHMENT VIEW */}
            {activeTab === 'enrichment' && (
                <motion.div key="enrichment-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">

                    <EnrichmentBuilder onComplete={goToLanding} />
                </motion.div>
            )}

            {/* 4. SCRAPER VIEW */}
            {activeTab === 'scraper' && (
                <motion.div key="scraper-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">

                    <ScraperBuilder onComplete={goToLanding} />
                </motion.div>
            )}

            {/* 5. MAPPER VIEW */}
            {activeTab === 'mapper' && (
                <motion.div key="mapper-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">

                    <SchemaMapper onComplete={goToLanding} />
                </motion.div>
            )}

            {/* 6. DATA MATCHING VIEW */}
            {activeTab === 'matching' && (
                <motion.div key="matching-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">

                    <DataMatchingBuilder onComplete={goToLanding} />
                </motion.div>
            )}

            {/* 7. PIPELINE ORCHESTRATOR VIEW */}
            {activeTab === 'pipeline' && (
                <motion.div key="pipeline-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
                    <PipelineBuilder onComplete={goToLanding} />
                </motion.div>
            )}

            {/* 8. PIPELINE SCHEDULER VIEW */}
            {activeTab === 'scheduler' && (
                <motion.div key="scheduler-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
                    <SchedulerBuilder />
                </motion.div>
            )}

            {/* 9. PIPELINE RUNS VIEW */}
            {activeTab === 'pipeline-runs' && (
                <motion.div key="pipeline-runs-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
                    <PipelineRuns />
                </motion.div>
            )}

            {/* PRICING VIEW */}
            {activeTab === 'pricing' && (
                <motion.div key="pricing-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full pb-20 pt-4">
                    <PricingPage onClose={goToLanding} />
                </motion.div>
            )}

            {/* USER PROFILE VIEW */}
            {activeTab === 'profile' && user && (
                <motion.div key="profile-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full pb-20 pt-4">
                    <UserProfilePage
                        user={user}
                        onClose={goToLanding}
                        onLogout={handleLogout}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );

    // Unauthenticated / Landing Page Render
    if (!user) {
        return (
            <div className={`min-h-screen font-sans overflow-x-hidden transition-colors duration-500 ${(activeTab === 'home' || activeTab === 'pricing') ? 'bg-slate-950 text-slate-50' : 'bg-white text-slate-900'}`}>
                {/* Navigation */}
                <nav className={`fixed top-0 w-full backdrop-blur-md border-b z-50 transition-colors duration-500 ${(activeTab === 'home' || activeTab === 'pricing') ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
                    <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                        <div className="flex items-center gap-8">
                            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={goToLanding}>
                                <img src={Logo} alt="CleanFlow" className={`h-10 w-auto transition-all ${(activeTab === 'home' || activeTab === 'pricing') ? 'brightness-0 invert' : 'brightness-0'}`} />
                            </div>
                            <div className="hidden md:flex items-center gap-6">
                                {['Solutions', 'Resources', 'Pricing'].map((item) => (
                                    <button
                                        key={item}
                                        onClick={() => {
                                            if (item === 'Pricing') setActiveTab('pricing');
                                        }}
                                        className={`text-sm font-medium transition-colors ${(activeTab === 'home' || activeTab === 'pricing') ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        {item}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => { setAuthDefaultMode('login'); setIsAuthOpen(true); }}
                                className={`px-4 py-2 text-sm font-bold transition-colors ${(activeTab === 'home' || activeTab === 'pricing') ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                Log in
                            </button>
                            <button
                                onClick={() => { setAuthDefaultMode('signup'); setIsAuthOpen(true); }}
                                className={`px-6 py-2.5 text-sm rounded-xl font-bold transition-all hover:-translate-y-0.5 ${(activeTab === 'home' || activeTab === 'pricing') ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20'}`}
                            >
                                Get Started
                            </button>
                        </div>
                    </div>
                </nav>

                <main className={`${activeTab === 'home' ? 'pt-20 pb-20 relative min-h-screen flex flex-col' : activeTab === 'pricing' ? 'pt-28 pb-20 relative' : 'pt-28 pb-20 px-6 max-w-7xl mx-auto relative'}`}>
                    <AnimatePresence mode='wait'>
                        {activeTab === 'home' && (
                            <motion.div
                                key="home-tab"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                className="flex flex-col items-center"
                            >
                                <HomePage
                                    startValidation={startValidation}
                                    onViewPricing={() => setActiveTab('pricing')}
                                    handleFeatureAccess={handleFeatureAccess}
                                />
                            </motion.div>
                        )}

                        {activeTab === 'pricing' && (
                            <motion.div key="pricing-tab-landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
                                <PricingPage onClose={goToLanding} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>

                <AuthModal
                    isOpen={isAuthOpen}
                    defaultMode={authDefaultMode}
                    onClose={() => {
                        setIsAuthOpen(false);
                        setIntendedTab(null);
                    }}
                    onLoginSuccess={(u) => {
                        setUser(u);
                        fetchRecentJobs();
                        if (intendedTab) {
                            setActiveTab(intendedTab);
                            if (intendedTab === 'validate') setStep(1);
                            setIntendedTab(null);
                        } else {
                            setActiveTab('dashboard');
                        }
                    }}
                />
                <Footer />
            </div>
        );
    }

    // Authenticated Sidebar Workspace Layout (Databricks-style)
    return (
        <div className="flex h-screen w-full bg-[#111928] font-sans overflow-hidden">

            {/* Mobile Header Toggle */}
            <div className="lg:hidden fixed top-0 w-full h-16 bg-[#111928] border-b border-gray-800 flex items-center justify-between px-4 z-40">
                <img src={Logo} alt="CleanFlow" className="h-8 w-auto brightness-0 invert" />
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-gray-300 hover:text-white transition-colors">
                    {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Left Vertical Sidebar Workspace */}
            <nav className={`fixed lg:static top-0 left-0 h-screen w-[260px] bg-[#111928] border-r border-gray-800 flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <div className="h-20 flex items-center px-6 border-b border-gray-800 pt-16 lg:pt-0 shrink-0">
                    <img src={Logo} alt="CleanFlow" className="h-8 w-auto brightness-0 invert opacity-90 cursor-pointer" onClick={() => handleFeatureAccess('dashboard')} />
                </div>

                <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8 sidebar-scrollbar">

                    {/* Section: Core Workspace */}
                    <div>
                        <h4 className="px-3 mb-2 text-xs font-black uppercase tracking-wider text-gray-500">Workspace</h4>
                        <ul className="space-y-1">
                            <li>
                                <button onClick={() => handleFeatureAccess('dashboard')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'dashboard' ? 'bg-[#1f2937] text-white shadow-xl border border-gray-700' : 'text-gray-400 hover:text-gray-100 hover:bg-[#1f2937]'}`}>
                                    <Home size={18} /> Home
                                </button>
                            </li>
                        </ul>
                    </div>

                    {/* Section: Data Operation Features */}
                    <div>
                        <h4 className="px-3 mb-2 text-xs font-black uppercase tracking-wider text-gray-500">Data Services</h4>
                        <ul className="space-y-1">
                            {[
                                { id: 'validate', label: 'Quality Validation', icon: ShieldCheck },
                                { id: 'enrichment', label: 'Data Cleaning', icon: Sparkles },
                                { id: 'mapper', label: 'Schema Mapping', icon: GitMerge },
                                { id: 'scraper', label: 'Web Scraping', icon: Globe },
                                { id: 'matching', label: 'Data Matching', icon: Shuffle }
                            ].map(feat => (
                                <li key={feat.id}>
                                    <button onClick={() => handleFeatureAccess(feat.id)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group ${activeTab === feat.id ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-900/50' : 'text-gray-400 hover:text-gray-100 hover:bg-[#1f2937]'}`}>
                                        <div className="flex items-center gap-3">
                                            <feat.icon size={18} className={activeTab === feat.id ? 'text-emerald-500' : 'text-gray-500 group-hover:text-gray-300'} />
                                            {feat.label}
                                        </div>
                                        {activeTab === feat.id && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="px-3 mb-2 text-xs font-black uppercase tracking-wider text-gray-500">Data Orchestrate</h4>
                        <ul className="space-y-1">
                            {[
                                { id: 'pipeline', label: 'Pipeline Builder', icon: GitMerge },
                                { id: 'scheduler', label: 'Scheduler', icon: Clock3 },
                                { id: 'pipeline-runs', label: 'Pipeline Runs', icon: FolderClock }
                            ].map(feat => (
                                <li key={feat.id}>
                                    <button onClick={() => handleFeatureAccess(feat.id)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group ${activeTab === feat.id ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-900/50' : 'text-gray-400 hover:text-gray-100 hover:bg-[#1f2937]'}`}>
                                        <div className="flex items-center gap-3">
                                            <feat.icon size={18} className={activeTab === feat.id ? 'text-emerald-500' : 'text-gray-500 group-hover:text-gray-300'} />
                                            {feat.label}
                                        </div>
                                        {activeTab === feat.id && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Section: External */}
                    <div>
                        <h4 className="px-3 mb-2 text-xs font-black uppercase tracking-wider text-gray-500">Resources</h4>
                        <ul className="space-y-1">
                            <li>
                                <button onClick={() => handleFeatureAccess('pricing')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'pricing' ? 'bg-[#1f2937] text-white border border-gray-700' : 'text-gray-400 hover:text-gray-100 hover:bg-[#1f2937]'}`}>
                                    <CreditCard size={18} className="text-gray-500" /> Billing & Pricing
                                </button>
                            </li>
                        </ul>
                    </div>

                </div>

                {/* Bottom Profile Section */}
                <div className="p-4 border-t border-gray-800 bg-[#0d131f] shrink-0">
                    <div className="flex items-center justify-between">
                        <button onClick={() => handleFeatureAccess('profile')} className="flex items-center gap-3 group px-2 py-1.5 rounded-lg hover:bg-[#1f2937] transition-colors flex-1 overflow-hidden">
                            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                                {user.full_name?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <div className="text-left overflow-hidden">
                                <p className="text-sm font-bold text-gray-200 truncate">{user.full_name || 'My Account'}</p>
                                <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            </div>
                        </button>
                        <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Log Out">
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </nav>

            {/* Overlay for mobile sidebar */}
            {isSidebarOpen && (
                <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
            )}

            {/* Main Central Content Area */}
            <main className="flex-1 flex flex-col bg-slate-50 relative h-screen pt-16 lg:pt-0 overflow-hidden">
                <div className={`flex-1 w-full max-w-full h-full overflow-y-auto ${activeTab === 'pipeline' ? 'p-0' : activeTab === 'validate' || activeTab === 'enrichment' || activeTab === 'scraper' || activeTab === 'mapper' || activeTab === 'matching' ? 'p-0' : 'p-6 md:p-8'}`}>
                    {renderWorkspaceContent()}
                </div>
            </main>

            {/* Support Tools */}
            <ChatBot />
        </div>
    );
}

export default App;
