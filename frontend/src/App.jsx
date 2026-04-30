import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LogOut, Search, Sparkles, Database,
    FileCheck, ArrowRight, Zap, Check,
    Globe, ChevronRight, Shuffle, GitMerge, RefreshCw, Trash2, ShieldCheck, AlertTriangle, BarChart3, TrendingUp,
    Menu, X, Home, LayoutDashboard, Settings, User, FolderClock, Clock3, BarChart2, BookOpen, ArrowLeftRight
} from 'lucide-react';

// Components
import { DataConnection, RuleBuilder, ResultsDashboard, DatasetViewer, WorkspaceTabs } from './components';
import { AuthModal, PaymentModal } from './components/modals';
import { Footer, PlatformDropdown } from './components/common';
import { HomePage, PricingPage, UserProfilePage, UsagePage } from './components/pages';
import ChatBot from './components/ChatBot';
import { formatDateTimeInIST } from './lib/utils';
import { API_BASE } from './lib/runtimeConfig';
import cleanflowLogo from './assets/logo.png';

// Feature Builders
import { EnrichmentBuilder, ScraperBuilder, SchemaMapper, DataMatchingBuilder, PricingIntelligenceBuilder, PipelineBuilder, SchedulerBuilder, PipelineRuns, DataVisualizer, GlobalRepositoryBuilder, DataTransformer } from './features';

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
    const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
    const [activeMenu, setActiveMenu] = useState(null); // title-bar dropdown
    const menuBarRef = useRef(null);

    // Close title-bar menu when clicking outside
    useEffect(() => {
        if (!activeMenu) return;
        const handleOutsideClick = (e) => {
            if (menuBarRef.current && !menuBarRef.current.contains(e.target)) {
                setActiveMenu(null);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [activeMenu]);

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
        } else {
            // Check for OAuth callback token
            const urlParams = new URLSearchParams(window.location.search);
            const oauthToken = urlParams.get('token');
            if (oauthToken) {
                localStorage.setItem('token', oauthToken);
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);
                // Fetch user
                axios.get(`${API_BASE}/users/me`, {
                    headers: { Authorization: `Bearer ${oauthToken}` }
                })
                    .then(res => {
                        setUser(res.data);
                        setActiveTab('dashboard');
                    })
                    .catch(() => {
                        localStorage.removeItem('token');
                        setUser(null);
                    });
            }
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

    // VSCode-style activity bar item
    const renderActivityItem = ({ id, label, icon: Icon }) => (
        <button
            key={id}
            onClick={() => handleFeatureAccess(id)}
            title={label}
            className={`relative flex h-[58px] w-full items-center justify-center transition-colors duration-150 ${
                activeTab === id ? 'text-white' : 'text-[#858585] hover:text-white'
            }`}
        >
            {activeTab === id && (
                <span className="absolute left-0 top-[5px] h-[48px] w-[3px] rounded-r bg-[#007acc]" />
            )}
            <span className="relative z-10 flex h-10 w-10 items-center justify-center">
                <Icon size={22} strokeWidth={1.7} />
            </span>
        </button>
    );

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
            return formatDateTimeInIST(iso);
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

    const dashboardCards = [
        {
            title: 'Quality Validation',
            description: 'Upload data, configure rules, and validate records.',
            tutorial: [
                'Connect your dataset via file upload or DB.',
                'Define column rules such as regex patterns and ranges.',
                'Review pass/fail metrics and export clean data.',
            ],
            icon: ShieldCheck,
            iconWrap: 'bg-[#eff5ff] text-[#4f7cff]',
            accent: 'from-[#4f7cff] to-[#7aa2ff]',
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
            tutorial: [
                'Select an entity type.',
                'Upload source rows with target attributes.',
                'Auto-complete missing data with enrichment workflows.',
            ],
            icon: Sparkles,
            iconWrap: 'bg-[#eefcf5] text-[#1ab67d]',
            accent: 'from-[#1ab67d] to-[#57d3a4]',
            action: () => setActiveTab('enrichment'),
        },
        {
            title: 'Schema Mapping',
            description: 'Map and transform columns between datasets.',
            tutorial: [
                'Define your target schema.',
                'Drag and drop columns from source to target.',
                'Validate the structural transformation before export.',
            ],
            icon: GitMerge,
            iconWrap: 'bg-[#eef0ff] text-[#6c74ff]',
            accent: 'from-[#6c74ff] to-[#959cff]',
            action: () => setActiveTab('mapper'),
        },
        {
            title: 'Web Scraping',
            description: 'Extract structured data from URLs at scale.',
            tutorial: [
                'Choose an extraction template.',
                'Paste target URLs or selectors.',
                'Parallelize the scrape and normalize the output.',
            ],
            icon: Globe,
            iconWrap: 'bg-[#fff4e8] text-[#ff9b45]',
            accent: 'from-[#ff9b45] to-[#ffba74]',
            action: () => setActiveTab('scraper'),
        },
        {
            title: 'Data Matching',
            description: 'Identify duplicate or related entities across datasets.',
            tutorial: [
                'Select two datasets for comparison.',
                'Set thresholds for fuzzy, cosine, or exact matching.',
                'Review similarity scores and merge rows safely.',
            ],
            icon: Shuffle,
            iconWrap: 'bg-[#f7efff] text-[#9f67ff]',
            accent: 'from-[#9f67ff] to-[#c49cff]',
            action: () => setActiveTab('matching'),
        },
        {
            title: 'Pricing Intelligence',
            description: 'Recommend margin-safe prices using competitor benchmarks.',
            tutorial: [
                'Load your catalog and competitor price feed.',
                'Choose market position and margin floor.',
                'Export recommended prices with confidence signals.',
            ],
            icon: TrendingUp,
            iconWrap: 'bg-[#fff7df] text-[#d89a11]',
            accent: 'from-[#d89a11] to-[#f1bf43]',
            action: () => setActiveTab('pricing-intelligence'),
        },
        {
            title: 'AI Visualizer',
            description: 'Generate an instant chart dashboard from uploaded data.',
            tutorial: [
                'Upload your CSV or TSV file.',
                'Let AI infer types and distributions.',
                'Explore the generated dashboard of charts.',
            ],
            icon: BarChart3,
            iconWrap: 'bg-[#f1efff] text-[#7f67ff]',
            accent: 'from-[#7f67ff] to-[#aa98ff]',
            action: () => setActiveTab('visualizer'),
        },
        {
            title: 'Pipeline Builder',
            description: 'Design orchestrated flows across multiple data operations.',
            tutorial: [
                'Drag data sources to the canvas.',
                'Connect them to cleaning and validation nodes.',
                'Route outputs and run the pipeline end to end.',
            ],
            icon: ArrowLeftRight,
            iconWrap: 'bg-[#edf2f7] text-[#4a5568]',
            accent: 'from-[#334155] to-[#64748b]',
            action: () => setActiveTab('pipeline'),
        }
    ];

    const historyTabs = [
        { id: 'validation', label: 'Quality Validation' },
        { id: 'enrichment', label: 'Data Enrichment' },
        { id: 'mapper', label: 'Schema Mapping' },
        { id: 'scraper', label: 'Web Scraping' },
        { id: 'matching', label: 'Data Matching' },
        { id: 'pricing', label: 'Pricing Intelligence' },
        { id: 'pipeline', label: 'Pipelines' }
    ];

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
                    className="mx-auto w-full max-w-[1560px] pb-16"
                >
                    {/* Hero Section */}
                    <div className="mb-10 relative overflow-hidden rounded-[34px] border border-[#1b2230] shadow-[0_28px_80px_rgba(10,18,34,0.28)] bg-[#05070b]">
                        {/* Ambient glow blobs for an impressive color gradient */}
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(120deg, #05070b 0%, #0a1220 52%, #05110f 100%)' }} />
                        <div className="absolute top-0 left-1/4 h-[420px] w-[420px] rounded-full bg-[#6f47ff]/20 blur-[110px] pointer-events-none mix-blend-screen" />
                        <div className="absolute bottom-0 right-1/4 h-[420px] w-[420px] rounded-full bg-[#18c58f]/20 blur-[110px] pointer-events-none mix-blend-screen" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[540px] w-[540px] bg-[#3cb4ff]/10 blur-[130px] pointer-events-none mix-blend-screen" />
                        <div className="absolute -top-10 -right-10 opacity-[0.04]"><Sparkles size={270} className="text-white" /></div>

                        <div className="relative z-10 px-8 py-8 md:px-10 md:py-10">
                            <div className="flex flex-col gap-10 xl:flex-row xl:items-start xl:justify-between">
                                {/* Left: Text + CTAs */}
                                <div className="flex-1 min-w-0">
                                    {/* Badge */}
                                    <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#1ab67d]/25 bg-[#04281c] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.24em] text-[#26d59a]">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#26d59a] opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#26d59a]"></span>
                                        </span>
                                        Active Workspace
                                    </div>

                                    {/* Heading */}
                                    <h1 className="mb-1 text-4xl font-black leading-[0.95] tracking-[-0.04em] text-white md:text-6xl">
                                        Welcome back,
                                    </h1>
                                    <p className="mb-4 bg-gradient-to-r from-[#2ce5a6] via-[#22d1a0] to-[#87f5d0] bg-clip-text text-4xl font-black leading-[0.95] tracking-[-0.04em] text-transparent md:text-6xl">
                                        {user.full_name || 'User'}
                                    </p>

                                    {/* Subtitle */}
                                    <p className="mb-8 max-w-2xl text-base font-medium leading-8 text-[#9aa7bd] md:text-lg">
                                        Execute intelligent data workflows, manage your recent jobs, and move through the platform with the guided toolset below.
                                    </p>

                                    {/* CTA Buttons */}
                                    <div className="flex flex-wrap items-center gap-4">
                                        <button
                                            onClick={() => setActiveTab('pipeline')}
                                            className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-[15px] font-bold text-[#141923] shadow-[0_16px_35px_rgba(255,255,255,0.08)] transition-all hover:-translate-y-0.5 hover:bg-[#f7f9fc]"
                                        >
                                            <Zap size={17} className="text-[#10b981]" /> New Workflow
                                        </button>
                                        <button
                                            onClick={() => document.getElementById('job-history-section')?.scrollIntoView({ behavior: 'smooth' })}
                                            className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.06] px-6 py-3 text-[15px] font-semibold text-white transition-all hover:bg-white/[0.11]"
                                        >
                                            <BarChart3 size={17} /> View Recent Jobs
                                        </button>
                                    </div>
                                </div>

                                {/* Right: Stats */}
                                <div className="grid min-w-[220px] gap-6 self-stretch xl:pt-6">
                                    {[
                                        { value: recentJobs.length, label: 'active jobs', color: 'text-white' },
                                        { value: recentJobs.length > 0 ? '98%' : '—', label: 'success rate', color: 'text-emerald-400' },
                                        { value: recentJobs.reduce((acc, j) => acc + (j.total_rows || 0), 0).toLocaleString() || '0', label: 'rows processed', color: 'text-[#3cb4ff]' },
                                    ].map(({ value, label, color }) => (
                                        <div key={label} className="text-left xl:text-right">
                                            <span className={`text-4xl font-black tracking-[-0.04em] ${color}`}>{value}</span>
                                            <span className="mt-1 block text-[13px] font-semibold uppercase tracking-[0.28em] text-[#72809a]">{label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>


                    {/* Section: Tutorials & Tools */}
                    <div className="mb-10">
                        <h2 className="mb-6 flex items-center gap-3 text-[22px] font-black tracking-[-0.02em] text-[#10203a]">
                            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e7fbf3] text-[#14b87f]">
                                <Database size={20} />
                            </span>
                            Data Services & Tutorials
                        </h2>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-3">
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

                                <div key={item.title} className="group flex h-full flex-col overflow-hidden rounded-[24px] border border-[#dbe4f1] bg-white shadow-[0_16px_45px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(15,23,42,0.1)]">
                                    <div className="flex-1 p-6">
                                        <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl ${item.bg}`}>
                                            <item.icon size={20} className={item.color} />
                                        </div>
                                        <h3 className="text-[22px] font-black tracking-[-0.02em] text-[#0d1b31]">{item.title}</h3>
                                        <p className="mt-3 text-[15px] leading-7 text-[#5d6b83]">{item.description}</p>

                                        <div className="mt-6 rounded-[18px] border border-[#edf2f8] bg-[#f7fafe] p-5">
                                            <h4 className="mb-4 text-[12px] font-black uppercase tracking-[0.22em] text-[#8ea0bc]">How it works</h4>
                                            <ul className="space-y-3">
                                                {item.tutorial.split('\n').map((step, idx) => (
                                                    <li key={idx} className="flex gap-3 text-[14px] leading-7 text-[#40516d]">
                                                        <span className="mt-[2px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[12px] font-black text-[#7f91ad] shadow-sm">{step.charAt(0)}</span>
                                                        <span>{step.substring(2)}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                    <div className="shrink-0 border-t border-[#edf2f8] bg-[#fbfdff] p-5">
                                        <button
                                            onClick={item.action}
                                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#10203a] py-3 text-[15px] font-bold text-white shadow-[0_16px_28px_rgba(15,23,42,0.12)] transition-all hover:bg-[#162b4b]"
                                        >
                                            Launch Tool <ArrowRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Section: Job History & Orchestration */}
                    <div id="job-history-section" className="mb-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <div className="lg:col-span-3">
                            <div className="flex flex-col overflow-hidden rounded-[26px] border border-[#dbe4f1] bg-white shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
                                <div className="flex items-center justify-between border-b border-[#edf2f8] bg-[#f8fbff] p-6">
                                    <div>
                                        <h3 className="text-[24px] font-black tracking-[-0.02em] text-[#10203a]">Job History</h3>
                                        <p className="mt-1 text-[15px] text-[#60708a]">Review outputs from your recent pipeline runs and data services.</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={fetchRecentJobs} className="rounded-xl p-2 text-[#71829f] transition-colors hover:bg-white hover:text-[#10203a]" title="Refresh">
                                            <RefreshCw size={18} />
                                        </button>
                                        <button onClick={() => clearHistory(historyModuleTab)} className="rounded-xl bg-[#fff0f0] px-4 py-2 text-sm font-bold text-[#d1495b] transition-colors hover:bg-[#ffe4e7]">
                                            Clear Data
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2 border-b border-[#edf2f8] bg-white p-4">
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
                                                className={`rounded-2xl px-4 py-2 text-sm font-bold transition-all ${historyModuleTab === tab.id
                                                    ? 'bg-[#10203a] text-white shadow-md'
                                                    : 'border border-[#dbe4f1] bg-[#f8fbff] text-[#60708a] hover:border-[#c8d5e6] hover:bg-white'
                                                    }`}
                                            >
                                                {tab.label} <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${historyModuleTab === tab.id ? 'bg-white/15 text-[#d6deed]' : 'bg-[#e9eff8] text-[#7a8ba8]'}`}>{count}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="rounded-b-[26px] bg-white">
                                    {jobsLoading ? (
                                        <div className="flex flex-col items-center py-16 text-center text-slate-400">
                                            <RefreshCw size={32} className="mb-4 animate-spin text-emerald-500" />
                                            <p className="font-medium">Loading historical records...</p>
                                        </div>
                                    ) : recentJobs.filter(j => (j.module || 'validation') === historyModuleTab).length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-center">
                                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#e7edf6] bg-[#f8fbff]">
                                                <FolderClock className="text-[#b0bfd4]" size={32} />
                                            </div>
                                            <p className="mb-1 text-lg font-bold text-[#10203a]">No execution history</p>
                                            <p className="max-w-sm text-sm text-[#60708a]">You haven't executed any jobs using the {historyModuleTab} module yet. Launch the tool above to get started.</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b border-[#edf2f8] bg-[#f8fbff] text-xs font-black uppercase tracking-[0.16em] text-[#8ea0bc]">
                                                        <th className="p-4 pl-6">Job Summary</th>
                                                        <th className="p-4">Status</th>
                                                        <th className="p-4">Execution Time</th>
                                                        <th className="p-4 pr-6 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {recentJobs
                                                        .filter(j => (j.module || 'validation') === historyModuleTab)
                                                        .map((job) => (
                                                            <tr key={job.id} className="group border-b border-[#f1f5fb] transition-colors hover:bg-[#fbfdff]">
                                                                <td className="p-4 pl-6 align-middle">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[#19c88f]" />
                                                                        <span className="block max-w-[200px] truncate font-bold text-[#10203a] md:max-w-md xl:max-w-lg" title={job.file_name || job.filename || 'Automated Job'}>
                                                                            {job.file_name || job.filename || 'Automated Job'}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="p-4 align-middle">
                                                                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#d6f6e9] bg-[#effcf5] px-2.5 py-1 text-xs font-bold text-[#159b6d]">
                                                                        <Check size={12} /> Completed
                                                                    </span>
                                                                </td>
                                                                <td className="p-4 align-middle text-sm font-medium text-[#60708a]">
                                                                    {formatJobDate(job.created_at)}
                                                                </td>
                                                                <td className="p-4 pr-6 align-middle text-right">
                                                                    <div className="flex items-center justify-end gap-2 opacity-100 transition-opacity md:opacity-0 group-hover:opacity-100">
                                                                        <button
                                                                            onClick={() => resumeJob(job)}
                                                                            className="rounded-xl border border-[#dbe4f1] bg-white px-4 py-2 text-xs font-bold text-[#42536f] shadow-sm transition-all hover:bg-[#f8fbff] hover:text-[#10203a]"
                                                                        >
                                                                            View Insights
                                                                        </button>
                                                                        <button
                                                                            onClick={() => deleteHistoryItem(job.id)}
                                                                            className="rounded-xl border border-transparent p-2 text-[#8ea0bc] transition-all hover:border-[#ffd8dd] hover:bg-[#fff3f5] hover:text-[#d1495b]"
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

            {/* 13. DATA TRANSFORMER VIEW */}
            {activeTab === 'transformer' && (
                <motion.div key="transformer-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
                    <DataTransformer />
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
            <AuthModal
                isOpen={true}
                defaultMode={authDefaultMode}
                onClose={() => {}}
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
        );
    }

    // Authenticated Layout: VSCode-style title bar + narrow activity bar
    const FULL_TAB_IDS = ['pipeline', 'validate', 'repository', 'enrichment', 'scraper', 'mapper', 'matching', 'pricing-intelligence', 'visualizer', 'transformer'];

    return (
        <div className="flex h-screen w-full flex-col overflow-hidden bg-[#121723] font-sans text-[#e8edf6]">

            {/* ── TOP TITLE BAR (VSCode-style) ── */}
            <div
                className="vscode-titlebar relative flex h-[32px] shrink-0 items-center justify-between border-b border-white/6 bg-[#262229] px-3 select-none"
                style={{ WebkitAppRegion: 'drag' }}
            >
                {/* Left: Logo + Menu items */}
                <div ref={menuBarRef} className="flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' }}>
                    <button
                        onClick={() => { handleFeatureAccess('dashboard'); setActiveMenu(null); }}
                        className="mr-2 flex items-center gap-2 rounded-md px-2 py-0.5 transition-colors hover:bg-white/10"
                        title="Cleanflow Home"
                    >
                        <img src={cleanflowLogo} alt="Cleanflow" className="h-4 w-4 shrink-0 object-contain" />
                        <span className="text-[12px] font-semibold leading-none text-[#f3f6fb]">Cleanflow</span>
                    </button>

                    {/* ── FUNCTIONAL MENU BUTTONS ── */}
                    {[
                        {
                            label: 'File',
                            items: [
                                { label: 'New Validation Session', action: () => { setValidationResults(null); setColumns([]); setFilename(''); setSessionId(null); setValidationRules([]); setStep(1); handleFeatureAccess('validate'); } },
                                { label: 'Open Pipeline Builder', action: () => handleFeatureAccess('pipeline') },
                                { label: 'Open Scheduler', action: () => handleFeatureAccess('scheduler') },
                                null,
                                { label: 'Export Results', action: () => { alert('Export: navigate to your results view and use the Export button there.'); } },
                                null,
                                { label: 'Account & Profile', action: () => handleFeatureAccess('profile') },
                                null,
                                { label: 'Exit Application', action: () => { if (window.confirm('Exit Cleanflow?')) window.close(); } },
                            ]
                        },
                        {
                            label: 'Edit',
                            items: [
                                { label: 'Find / Search (Ctrl+F)', action: () => { document.activeElement?.blur(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true })); } },
                                null,
                                { label: 'Zoom In', action: () => { const z = parseFloat(document.body.style.zoom || '1') + 0.1; document.body.style.zoom = z; } },
                                { label: 'Zoom Out', action: () => { const z = Math.max(0.5, parseFloat(document.body.style.zoom || '1') - 0.1); document.body.style.zoom = z; } },
                                { label: 'Reset Zoom', action: () => { document.body.style.zoom = '1'; } },
                                null,
                                { label: 'Clear All History', action: () => clearHistory('all') },
                            ]
                        },
                        {
                            label: 'View',
                            items: [
                                { label: 'Dashboard / Home', action: () => handleFeatureAccess('dashboard') },
                                { label: 'Usage & Resources', action: () => handleFeatureAccess('usage') },
                                { label: 'Global Repository', action: () => handleFeatureAccess('repository') },
                                null,
                                { label: 'Toggle Full Screen', action: () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); else document.exitFullscreen(); } },
                                null,
                                { label: 'Reload App', action: () => window.location.reload() },
                            ]
                        },
                        {
                            label: 'Help',
                            items: [
                                { label: 'Usage & Resources', action: () => handleFeatureAccess('usage') },
                                { label: 'AI Visualizer', action: () => handleFeatureAccess('visualizer') },
                                null,
                                { label: 'About Cleanflow', action: () => alert('Cleanflow — Data Intelligence Platform\nVersion 1.0\n\nBuilt for intelligent data workflows.') },
                                { label: 'Report an Issue', action: () => window.open('mailto:support@cleanflow.ai?subject=Issue Report', '_blank') },
                            ]
                        },
                    ].map(({ label, items }) => (
                        <div key={label} className="relative">
                            <button
                                onClick={() => setActiveMenu(prev => prev === label ? null : label)}
                                className={`rounded px-[8px] py-[3px] text-[12px] leading-5 transition-colors ${
                                    activeMenu === label ? 'bg-[#18c58f] text-[#07130f]' : 'text-[#d4dae5] hover:bg-white/12'
                                }`}
                            >
                                {label}
                            </button>

                            {activeMenu === label && (
                                <div className="absolute top-full left-0 z-[200] mt-[4px] min-w-[220px] rounded-xl border border-white/10 bg-[#151b27] py-1 shadow-2xl">
                                    {items.map((item, idx) =>
                                        item === null ? (
                                            <div key={idx} className="mx-2 my-1 h-px bg-white/8" />
                                        ) : (
                                            <button
                                                key={item.label}
                                                onClick={() => { item.action(); setActiveMenu(null); }}
                                                className="flex w-full items-center px-4 py-[6px] text-left text-[12px] text-[#d8dfeb] transition-colors hover:bg-[#1f2a3d] hover:text-white"
                                            >
                                                {item.label}
                                            </button>
                                        )
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Center: App title */}
                <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[12px] text-[#c7d1e0]/80">
                    Cleanflow — Data Intelligence Platform
                </div>

                {/* Right: mobile toggle */}
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    style={{ WebkitAppRegion: 'no-drag' }}
                    className="flex rounded p-1 text-[#d8dfeb] transition-colors hover:bg-white/15 lg:hidden"
                >
                    {isSidebarOpen ? <X size={14} /> : <Menu size={14} />}
                </button>
            </div>

            {/* ── BODY: Activity Bar + Main ── */}
            <div className="flex flex-1 overflow-hidden">

                {/* Mobile overlay */}
                {isSidebarOpen && (
                    <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
                )}

                {/* ── LEFT ACTIVITY BAR (always 48px, VSCode style) ── */}
                <nav className={`fixed left-0 top-[32px] z-50 flex w-[48px] shrink-0 flex-col items-center border-r border-[#252526] bg-[#333333] transition-transform duration-300 lg:static ${
                    isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                }`} style={{ height: 'calc(100vh - 32px)' }}>

                    {/* ── Top icons: Nav items ── */}
                    <div className="sidebar-scrollbar flex w-full flex-1 flex-col items-center overflow-y-auto pt-1">

                        {/* Home */}
                        {renderActivityItem({ id: 'dashboard', label: 'Home', icon: Home })}

                        {/* Divider */}
                        <div className="my-1 mx-auto h-px w-7 bg-[#454545]" />

                        {/* Data Services */}
                        {[
                            { id: 'validate', label: 'Quality Validation', icon: ShieldCheck },
                            { id: 'enrichment', label: 'Data Cleaning', icon: Sparkles },
                            { id: 'transformer', label: 'Data Transformation', icon: ArrowLeftRight },
                            { id: 'mapper', label: 'Schema Mapping', icon: GitMerge },
                            { id: 'scraper', label: 'Web Scraping', icon: Globe },
                            { id: 'matching', label: 'Data Matching', icon: Shuffle },
                            { id: 'pricing-intelligence', label: 'Pricing Intelligence', icon: TrendingUp },
                            { id: 'visualizer', label: 'AI Visualizer', icon: BarChart3 },
                        ].map(renderActivityItem)}

                        {/* Divider */}
                        <div className="my-1 mx-auto h-px w-7 bg-[#454545]" />

                        {/* Orchestration */}
                        {[
                            { id: 'pipeline', label: 'Pipeline Builder', icon: GitMerge },
                            { id: 'scheduler', label: 'Scheduler', icon: Clock3 },
                            { id: 'pipeline-runs', label: 'Pipeline Runs', icon: FolderClock },
                        ].map(renderActivityItem)}

                        {/* Divider */}
                        <div className="my-1 mx-auto h-px w-7 bg-[#454545]" />

                        {/* Resources */}
                        {[
                            { id: 'repository', label: 'Global Repository', icon: BookOpen },
                            { id: 'usage', label: 'Usage & Resources', icon: BarChart2 },
                        ].map(renderActivityItem)}
                    </div>

                    {/* ── Bottom: Profile + Logout ── */}
                    <div className="flex w-full shrink-0 flex-col items-center gap-0 border-t border-[#252526] pb-1">
                        <button
                            onClick={() => handleFeatureAccess('profile')}
                            title={user.full_name || 'My Account'}
                            className={`relative flex h-[48px] w-full items-center justify-center transition-colors duration-150 ${
                                activeTab === 'profile' ? 'text-white' : 'text-[#858585] hover:text-white'
                            }`}
                        >
                            {activeTab === 'profile' && (
                                <span className="absolute left-0 top-0 h-full w-[2px] rounded-r bg-[#007acc]" />
                            )}
                            <div className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                                {user.full_name?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
                            </div>
                        </button>
                        <button
                            onClick={handleLogout}
                            title="Log Out"
                            className="flex h-[44px] w-full items-center justify-center text-[#858585] transition-colors duration-150 hover:text-red-400"
                        >
                            <LogOut size={20} strokeWidth={1.6} />
                        </button>
                    </div>
                </nav>

                {/* ── MAIN CONTENT ── */}
                <main className="relative flex h-full flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,#f4f7fb_0%,#eef3f9_100%)]">
                    <div className={`h-full w-full max-w-full flex-1 overflow-y-auto ${
                        FULL_TAB_IDS.includes(activeTab) ? 'p-0' : 'p-5 md:p-7'
                    }`}>
                        {renderWorkspaceContent()}
                    </div>
                </main>

            </div>

            {/* Support Tools */}
            <ChatBot />
        </div>
    );
}

export default App;
