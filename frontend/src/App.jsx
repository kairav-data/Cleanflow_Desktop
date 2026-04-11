import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LogOut, Search, Sparkles, Database,
    FileCheck, ArrowRight, Zap, Check,
    Globe, ChevronRight, Shuffle, GitMerge, RefreshCw, Trash2, ShieldCheck, AlertTriangle, BarChart3, TrendingUp,
    Menu, X, Home, LayoutDashboard, Settings, User, FolderClock, Clock3, BarChart2, BookOpen
} from 'lucide-react';

// Components
import { DataConnection, RuleBuilder, ResultsDashboard, DatasetViewer, WorkspaceTabs } from './components';
import { AuthModal, PaymentModal } from './components/modals';
import { Footer, PlatformDropdown } from './components/common';
import { HomePage, PricingPage, UserProfilePage, UsagePage } from './components/pages';
import ChatBot from './components/ChatBot';

// Feature Builders
import { EnrichmentBuilder, ScraperBuilder, SchemaMapper, DataMatchingBuilder, PricingIntelligenceBuilder, PipelineBuilder, SchedulerBuilder, PipelineRuns, DataVisualizer, GlobalRepositoryBuilder } from './features';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';
const Motion = motion;

function App() {
    const [activeTab, setActiveTab] = useState('home');
    const [step, setStep] = useState(1);
    const [sessionId, setSessionId] = useState(null);
    const [columns, setColumns] = useState([]);
    const [filename, setFilename] = useState('');
    const [validationResults, setValidationResults] = useState(null);
    const [validationView, setValidationView] = useState('dataset');
    const [validationRules, setValidationRules] = useState([]); // lifted so rules survive tab switches

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
        setValidationRules([]);
        setValidationView('dataset');
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
        if (moduleName === 'pricing') return 'pricing-intelligence';
        if (moduleName === 'pipeline') return 'pipeline-runs';
        return 'validate';
    };

    const resumeJob = (job) => {
        const targetTab = getTabFromModule(job.module);
        if (targetTab === 'validate') {
            setFilename(job.file_name || job.filename || '');
            setValidationRules(job.rules || []);
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

    const handleRunValidation = async (rules) => {
        if (!sessionId) {
            alert('This validation session is no longer active. Please upload the dataset again to run validation.');
            return;
        }

        try {
            const res = await axios.post(`${API_BASE}/validate/${sessionId}`, { rules });
            const nextResults = { ...res.data, rules };

            setValidationResults(nextResults);
            setStep(3);

            try {
                const token = localStorage.getItem('token');
                const headers = token ? { Authorization: `Bearer ${token}` } : {};

                await axios.post(`${API_BASE}/history/jobs`, {
                    session_id: sessionId,
                    file_name: filename || 'Validation Job',
                    rules,
                    total_rows: nextResults.total_rows || 0,
                    valid_rows: nextResults.valid_rows || 0,
                    invalid_rows: nextResults.invalid_rows || 0,
                    column_stats: nextResults.column_stats || {},
                    module: 'validation',
                }, { headers });

                fetchRecentJobs();
            } catch (historyError) {
                console.error('Failed to save validation history:', historyError);
            }
        } catch (err) {
            alert(`Validation failed: ${err.response?.data?.detail || err.message}`);
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
                    className="w-full max-w-7xl mx-auto pb-16"
                >
                    {/* Hero Section */}
                    <div className="mb-8 relative overflow-hidden rounded-[28px] border border-gray-800 shadow-2xl bg-[#030303]">
                        {/* Ambient glow blobs for an impressive color gradient */}
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #050505 0%, #0a0a0a 50%, #020202 100%)' }} />
                        <div className="absolute top-0 left-1/4 h-[400px] w-[400px] rounded-full bg-purple-500/20 blur-[100px] pointer-events-none mix-blend-screen" />
                        <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-emerald-500/20 blur-[100px] pointer-events-none mix-blend-screen" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] bg-blue-600/10 blur-[120px] pointer-events-none mix-blend-screen" />
                        <div className="absolute -top-10 -right-10 opacity-[0.04]"><Sparkles size={250} className="text-white" /></div>

                        <div className="relative z-10 px-6 py-8 md:px-8 md:py-9">
                            <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
                                {/* Left: Text + CTAs */}
                                <div className="flex-1 min-w-0">
                                    {/* Badge */}
                                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-400">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        Active Workspace
                                    </div>

                                    {/* Heading */}
                                    <h1 className="mb-1 text-3xl font-black leading-tight tracking-tight text-white md:text-4xl">
                                        Welcome back,
                                    </h1>
                                    <p className="mb-4 bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-400 bg-clip-text text-3xl font-black leading-tight tracking-tight text-transparent md:text-4xl">
                                        {user.full_name || 'User'}
                                    </p>

                                    {/* Subtitle */}
                                    <p className="mb-6 max-w-lg text-sm font-medium leading-relaxed text-slate-400 md:text-[15px]">
                                        Execute intelligent data workflows, manage your recent jobs, and read through how to leverage the toolset below.
                                    </p>

                                    {/* CTA Buttons */}
                                    <div className="flex flex-wrap items-center gap-3">
                                        <button
                                            onClick={() => setActiveTab('pipeline')}
                                            className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-md transition-all hover:bg-slate-100"
                                        >
                                            <Zap size={16} className="text-emerald-600" /> New Workflow
                                        </button>
                                        <button
                                            onClick={() => document.getElementById('job-history-section')?.scrollIntoView({ behavior: 'smooth' })}
                                            className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white/20"
                                        >
                                            <BarChart3 size={16} /> View Recent Jobs
                                        </button>
                                    </div>
                                </div>

                                {/* Right: Stats */}
                                <div className="flex shrink-0 flex-row gap-5 lg:flex-col lg:gap-4">
                                    {[
                                        { value: recentJobs.length, label: 'active jobs', color: 'text-white' },
                                        { value: recentJobs.length > 0 ? '98%' : '—', label: 'success rate', color: 'text-emerald-400' },
                                        { value: recentJobs.reduce((acc, j) => acc + (j.total_rows || 0), 0).toLocaleString() || '0', label: 'rows processed', color: 'text-sky-400' },
                                    ].map(({ value, label, color }) => (
                                        <div key={label} className="flex flex-col items-center lg:items-end">
                                            <span className={`text-2xl font-black tracking-tight ${color}`}>{value}</span>
                                            <span className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>


                    {/* Section: Tutorials & Tools */}
                    <div className="mb-10">
                        <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-slate-900">
                            <Database className="text-emerald-500" /> Data Services & Tutorials
                        </h2>

                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
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
                                        setValidationRules([]);
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
                                    title: 'Pricing Intelligence',
                                    description: 'Recommend margin-safe prices after benchmarking against competitor products.',
                                    tutorial: '1. Load your catalog and competitor price feed.\n2. Choose Below / Match / Above market and your margin floor.\n3. Review dynamic repricing signals and export recommended prices.',
                                    icon: TrendingUp,
                                    color: 'text-amber-500',
                                    bg: 'bg-amber-50',
                                    action: () => setActiveTab('pricing-intelligence'),
                                },
                                {
                                    title: 'AI Visualizer',
                                    description: 'Upload a dataset and get an instant AI-generated chart dashboard.',
                                    tutorial: '1. Upload your CSV or TSV file.\n2. AI analyzes column types & distributions.\n3. A beautiful dashboard of charts is auto-generated.',
                                    icon: BarChart3,
                                    color: 'text-violet-600',
                                    bg: 'bg-violet-50',
                                    action: () => setActiveTab('visualizer'),
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

                                <div key={item.title} className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-slate-300 hover:shadow-lg">
                                    <div className="flex-1 p-5">
                                        <div className={`mb-5 flex h-10 w-10 items-center justify-center rounded-lg ${item.bg}`}>
                                            <item.icon size={20} className={item.color} />
                                        </div>
                                        <h3 className="mb-2 text-lg font-bold text-slate-900">{item.title}</h3>
                                        <p className="mb-5 text-sm font-medium text-slate-500">{item.description}</p>

                                        <div className="relative overflow-hidden rounded-lg border border-slate-100 bg-slate-50 p-3.5 transition-colors group-hover:border-slate-300">
                                            <h4 className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">How it works</h4>
                                            <ul className="space-y-2">
                                                {item.tutorial.split('\n').map((step, idx) => (
                                                    <li key={idx} className="flex gap-2 text-[13px] text-slate-600">
                                                        <span className="text-slate-400 font-bold shrink-0">{step.charAt(0)}</span>
                                                        <span>{step.substring(2)}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                    <div className="shrink-0 border-t border-slate-100 bg-slate-50 p-4">
                                        <button
                                            onClick={item.action}
                                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800"
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
                                        { id: 'pricing', label: 'Pricing Intelligence' },
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
                    <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
                        <div className="flex items-center gap-4">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 bg-blue-50">
                                <ShieldCheck size={18} className="text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black tracking-tight text-slate-900">Quality Validation</h2>
                                <p className="mt-0.5 text-sm text-slate-500">Upload, define rules, and review quality issues in one place.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {['Upload', 'Configure', 'Results'].map((label, i) => {
                                const s = i + 1;
                                return (
                                    <div key={s} className="flex items-center">
                                        <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] transition-all ${step === s ? 'bg-slate-900 text-white' :
                                            step > s ? 'bg-emerald-100 text-emerald-700' :
                                                'bg-slate-100 text-slate-400'
                                            }`}>
                                            <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black ${step === s ? 'bg-white text-slate-900' :
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
                    <div className="flex-1 overflow-y-auto px-6 py-5">
                        {step === 1 && (
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                                <div className="mb-5">
                                    <h3 className="text-lg font-bold text-slate-800">Import Dataset</h3>
                                    <p className="mt-1 text-sm text-slate-500">Upload a file or connect a database to begin your quality validation run.</p>
                                </div>
                                <DataConnection
                                    compact={true}
                                    onUploadSuccess={(data) => {
                                        setSessionId(data.session_id);
                                        setColumns(data.columns || []);
                                        setFilename(data.filename || data.file_name || '');
                                        setValidationResults(null);
                                        setValidationRules([]); // reset rules on new dataset
                                        setValidationView('dataset');
                                        setStep(2);
                                    }}
                                />
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">Validation Workspace</h3>
                                        <p className="mt-1 text-sm text-slate-500">Switch between the live dataset preview and the rules builder while you configure the validation run.</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {filename && (
                                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                                                {filename}
                                            </span>
                                        )}
                                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                                            {columns.length} columns
                                        </span>
                                    </div>
                                </div>

                                <WorkspaceTabs
                                    tone="blue"
                                    activeTab={validationView}
                                    onChange={setValidationView}
                                    tabs={[
                                        { id: 'dataset', label: 'Dataset', icon: Database, disabled: !sessionId },
                                        { id: 'rules', label: 'Rules', icon: FileCheck },
                                    ]}
                                />

                                {/* Dataset panel */}
                                <div style={{ display: validationView === 'dataset' && sessionId ? 'block' : 'none' }}>
                                    <DatasetViewer
                                        sessionId={sessionId}
                                        tone="blue"
                                        title="Validation Dataset"
                                        subtitle="Review inserted rows before switching back to rules or running validation."
                                    />
                                </div>

                                {/* Rules panel – always mounted so rules are never lost on tab switch */}
                                <div style={{ display: validationView === 'rules' || !sessionId ? 'block' : 'none' }}>
                                    <RuleBuilder
                                        compact={true}
                                        columns={columns}
                                        initialRules={validationRules}
                                        onRulesChange={setValidationRules}
                                        onRunValidation={handleRunValidation}
                                        showRepoLibrary={true}
                                        user={user}
                                    />
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && validationResults && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <ResultsDashboard
                                    results={validationResults}
                                    onReset={() => {
                                        setValidationResults(null);
                                        setColumns([]);
                                        setFilename('');
                                        setSessionId(null);
                                        setValidationView('dataset');
                                        setStep(1);
                                    }}
                                    onEditRules={() => {
                                        setValidationRules(validationResults?.rules || []);
                                        setValidationView('rules');
                                        setStep(2);
                                    }}
                                />
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* 3. GLOBAL REPOSITORY VIEW */}
            {activeTab === 'repository' && (
                <motion.div key="repository-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
                    <GlobalRepositoryBuilder user={user} />
                </motion.div>
            )}

            {/* 4. ENRICHMENT VIEW */}
            {activeTab === 'enrichment' && (
                <motion.div key="enrichment-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">

                    <EnrichmentBuilder user={user} onComplete={goToLanding} />
                </motion.div>
            )}

            {/* 5. SCRAPER VIEW */}
            {activeTab === 'scraper' && (
                <motion.div key="scraper-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">

                    <ScraperBuilder onComplete={goToLanding} />
                </motion.div>
            )}

            {/* 6. MAPPER VIEW */}
            {activeTab === 'mapper' && (
                <motion.div key="mapper-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">

                    <SchemaMapper onComplete={goToLanding} />
                </motion.div>
            )}

            {/* 7. DATA MATCHING VIEW */}
            {activeTab === 'matching' && (
                <motion.div key="matching-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">

                    <DataMatchingBuilder />
                </motion.div>
            )}

            {/* 8. PRICING INTELLIGENCE VIEW */}
            {activeTab === 'pricing-intelligence' && (
                <motion.div key="pricing-intelligence-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
                    <PricingIntelligenceBuilder />
                </motion.div>
            )}

            {/* 9. AI VISUALIZER VIEW */}
            {activeTab === 'visualizer' && (
                <motion.div key="visualizer-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
                    <DataVisualizer />
                </motion.div>
            )}

            {/* 10. PIPELINE ORCHESTRATOR VIEW */}
            {activeTab === 'pipeline' && (
                <motion.div key="pipeline-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
                    <PipelineBuilder onComplete={goToLanding} />
                </motion.div>
            )}

            {/* 11. PIPELINE SCHEDULER VIEW */}
            {activeTab === 'scheduler' && (
                <motion.div key="scheduler-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
                    <SchedulerBuilder />
                </motion.div>
            )}

            {/* 12. PIPELINE RUNS VIEW */}
            {activeTab === 'pipeline-runs' && (
                <motion.div key="pipeline-runs-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
                    <PipelineRuns />
                </motion.div>
            )}

            {/* USAGE VIEW */}
            {activeTab === 'usage' && (
                <motion.div key="usage-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
                    <UsagePage user={user} />
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
            <div className="min-h-screen font-sans overflow-x-hidden bg-white text-slate-900">
                {/* Navigation */}
                <nav className="fixed top-0 z-50 w-full bg-white/90 backdrop-blur-md">
                    <div className="mx-auto flex h-24 max-w-[1200px] items-center justify-between px-6 lg:px-8">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2 cursor-pointer transition-opacity" onClick={goToLanding}>
                                <span className="uncial-antiqua-regular text-[28px] text-black leading-none">Cleanflow</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => { setAuthDefaultMode('login'); setIsAuthOpen(true); }}
                                className="rounded-full bg-[#1c1c1c] shadow-[0_4px_14px_0_rgb(0,0,0,0.39)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.23)] hover:bg-[#000000] px-8 py-2.5 text-[15px] font-medium text-white transition-all hover:scale-[1.02]"
                            >
                                Sign up
                            </button>
                        </div>
                    </div>
                </nav>

                <main className={`${activeTab === 'home' ? 'relative flex min-h-screen flex-col pb-16 pt-16' : activeTab === 'pricing' ? 'relative pb-16 pt-24' : 'relative mx-auto max-w-7xl px-5 pb-16 pt-24 lg:px-6'}`}>
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
        <div className="flex h-screen w-full overflow-hidden bg-black font-sans">

            {/* Mobile Header Toggle */}
            <div className="fixed top-0 z-40 flex h-14 w-full items-center justify-between border-b border-gray-800 bg-black px-3.5 lg:hidden">
                <span className="uncial-antiqua-regular text-[24px] leading-none text-white">Cleanflow</span>
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-gray-300 hover:text-white transition-colors">
                    {isSidebarOpen ? <X size={22} /> : <Menu size={22} />}
                </button>
            </div>

            {/* Left Vertical Sidebar Workspace */}
            <nav className={`fixed top-0 left-0 z-50 flex h-screen w-[244px] flex-col border-r border-gray-800 bg-black transform transition-transform duration-300 ease-in-out lg:static ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <div className="flex h-16 shrink-0 items-center border-b border-gray-800 px-5 pt-14 lg:pt-0">
                    <span
                        className="uncial-antiqua-regular cursor-pointer text-[24px] leading-none text-white opacity-90 transition-opacity hover:opacity-100"
                        onClick={() => handleFeatureAccess('dashboard')}
                    >
                        Cleanflow
                    </span>
                </div>

                <div className="sidebar-scrollbar flex-1 space-y-6 overflow-y-auto px-3.5 py-5">

                    {/* Section: Core Workspace */}
                    <div>
                        <h4 className="mb-2 px-3 text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">Workspace</h4>
                        <ul className="space-y-1">
                            <li>
                                <button onClick={() => handleFeatureAccess('dashboard')} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold transition-all ${activeTab === 'dashboard' ? 'border border-gray-700 bg-[#1f2937] text-white shadow-lg' : 'text-gray-400 hover:bg-[#1f2937] hover:text-gray-100'}`}>
                                    <Home size={18} /> Home
                                </button>
                            </li>
                        </ul>
                    </div>

                    {/* Section: Data Operation Features */}
                    <div>
                        <h4 className="mb-2 px-3 text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">Data Services</h4>
                        <ul className="space-y-1">
                            {[
                                { id: 'validate', label: 'Quality Validation', icon: ShieldCheck },
                                { id: 'enrichment', label: 'Data Cleaning', icon: Sparkles },
                                { id: 'mapper', label: 'Schema Mapping', icon: GitMerge },
                                { id: 'scraper', label: 'Web Scraping', icon: Globe },
                                { id: 'matching', label: 'Data Matching', icon: Shuffle },
                                { id: 'pricing-intelligence', label: 'Pricing Intelligence', icon: TrendingUp },
                                { id: 'visualizer', label: 'AI Visualizer', icon: BarChart3 }
                            ].map(feat => (
                                <li key={feat.id}>
                                    <button onClick={() => handleFeatureAccess(feat.id)} className={`group flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] font-semibold transition-all ${activeTab === feat.id ? 'border border-emerald-900/50 bg-emerald-600/10 text-emerald-400' : 'text-gray-400 hover:bg-[#1f2937] hover:text-gray-100'}`}>
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
                        <h4 className="mb-2 px-3 text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">Data Orchestrate</h4>
                        <ul className="space-y-1">
                            {[
                                { id: 'pipeline', label: 'Pipeline Builder', icon: GitMerge },
                                { id: 'scheduler', label: 'Scheduler', icon: Clock3 },
                                { id: 'pipeline-runs', label: 'Pipeline Runs', icon: FolderClock }
                            ].map(feat => (
                                <li key={feat.id}>
                                    <button onClick={() => handleFeatureAccess(feat.id)} className={`group flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] font-semibold transition-all ${activeTab === feat.id ? 'border border-emerald-900/50 bg-emerald-600/10 text-emerald-400' : 'text-gray-400 hover:bg-[#1f2937] hover:text-gray-100'}`}>
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

                    {/* Section: Resources */}
                    <div>
                        <h4 className="mb-2 px-3 text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">Resources</h4>
                        <ul className="space-y-1">
                            <li>
                                <button onClick={() => handleFeatureAccess('repository')} className={`group flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] font-semibold transition-all ${activeTab === 'repository' ? 'border border-emerald-900/50 bg-emerald-600/10 text-emerald-400' : 'text-gray-400 hover:bg-[#1f2937] hover:text-gray-100'}`}>
                                    <div className="flex items-center gap-3">
                                        <BookOpen size={18} className={activeTab === 'repository' ? 'text-emerald-500' : 'text-gray-500 group-hover:text-gray-300'} />
                                        Global Repository
                                    </div>
                                    {activeTab === 'repository' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />}
                                </button>
                            </li>
                            <li>
                                <button onClick={() => handleFeatureAccess('usage')} className={`group flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] font-semibold transition-all ${activeTab === 'usage' ? 'border border-emerald-900/50 bg-emerald-600/10 text-emerald-400' : 'text-gray-400 hover:bg-[#1f2937] hover:text-gray-100'}`}>
                                    <div className="flex items-center gap-3">
                                        <BarChart2 size={18} className={activeTab === 'usage' ? 'text-emerald-500' : 'text-gray-500 group-hover:text-gray-300'} />
                                        Usage & Resources
                                    </div>
                                    {activeTab === 'usage' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />}
                                </button>
                            </li>
                        </ul>
                    </div>

                </div>

                {/* Bottom Profile Section */}
                <div className="shrink-0 border-t border-gray-800 bg-[#0a0a0a] p-3.5">
                    <div className="flex items-center justify-between">
                        <button onClick={() => handleFeatureAccess('profile')} className="group flex flex-1 items-center gap-3 overflow-hidden rounded-lg px-2 py-1.5 transition-colors hover:bg-[#1f2937]">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                                {user.full_name?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <div className="text-left overflow-hidden">
                                <p className="truncate text-[13px] font-bold text-gray-200">{user.full_name || 'My Account'}</p>
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
            <main className="relative flex h-screen flex-1 flex-col overflow-hidden bg-slate-50 pt-14 lg:pt-0">
                <div className={`h-full w-full max-w-full flex-1 overflow-y-auto ${activeTab === 'pipeline' ? 'p-0' : activeTab === 'validate' || activeTab === 'repository' || activeTab === 'enrichment' || activeTab === 'scraper' || activeTab === 'mapper' || activeTab === 'matching' || activeTab === 'pricing-intelligence' || activeTab === 'visualizer' ? 'p-0' : 'p-4 md:p-6'}`}>
                    {renderWorkspaceContent()}
                </div>
            </main>

            {/* Support Tools */}
            <ChatBot />
        </div>
    );
}

export default App;
