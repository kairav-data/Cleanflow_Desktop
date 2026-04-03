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
                    <div className="mb-10 pt-4">
                        <h1 className="text-4xl font-bold text-slate-900 mb-2">Welcome back, {user.full_name || 'User'}</h1>
                        <p className="text-slate-600">Choose a workflow to continue.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5 mb-10">
                        {[
                            {
                                title: 'Quality Validation',
                                description: 'Upload data, configure rules, and validate records.',
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
                                title: 'Data Enrichment',
                                description: 'Clean data and enhance records with verified attributes.',
                                action: () => setActiveTab('enrichment'),
                            },
                            {
                                title: 'Schema Mapping',
                                description: 'Map and transform columns between datasets.',
                                action: () => setActiveTab('mapper'),
                            },
                            {
                                title: 'Web Scraping',
                                description: 'Extract structured data from URLs at scale.',
                                action: () => setActiveTab('scraper'),
                            },
                            {
                                title: 'Data Matching',
                                description: 'Identify duplicate or related entities across datasets.',
                                action: () => setActiveTab('matching'),
                            },
                            {
                                title: 'Pipeline Builder',
                                description: 'Design orchestrated flows across multiple data operations.',
                                action: () => setActiveTab('pipeline'),
                            }
                        ].map((item) => (
                            <button
                                key={item.title}
                                onClick={() => !item.disabled && item.action()}
                                disabled={item.disabled}
                                className={`text-left p-6 bg-white border border-slate-200 rounded-xl ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-300 hover:shadow-lg hover:-translate-y-1 transition-all'}`}
                            >
                                <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                                <p className="text-sm text-slate-600 mb-4 leading-relaxed">{item.description}</p>
                                <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900">
                                    Open <ChevronRight size={16} />
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
                        {[
                            {
                                title: 'Pipeline Builder',
                                description: 'Create graph-based workflows for orchestrated processing.',
                                action: () => setActiveTab('pipeline'),
                                icon: GitMerge,
                            },
                            {
                                title: 'Scheduler',
                                description: 'Plan recurring runs and keep upcoming workflows organized.',
                                action: () => setActiveTab('scheduler'),
                                icon: Clock3,
                            },
                            {
                                title: 'Pipeline Runs',
                                description: 'Review recent run status, logs, and outputs.',
                                action: () => setActiveTab('pipeline-runs'),
                                icon: FolderClock,
                            }
                        ].map((item) => (
                            <button
                                key={item.title}
                                onClick={item.action}
                                className="text-left p-6 bg-slate-900 rounded-2xl text-white hover:bg-slate-800 transition-all hover:-translate-y-1"
                            >
                                <item.icon size={20} className="mb-4 text-emerald-300" />
                                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                                <p className="text-sm text-slate-300 leading-relaxed">{item.description}</p>
                            </button>
                        ))}
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex flex-wrap gap-2 mb-4">
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
                                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${historyModuleTab === tab.id
                                            ? 'bg-slate-900 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        {tab.label} ({count})
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex items-center justify-between mb-4 mt-6">
                            <h3 className="text-lg font-bold text-slate-900">Job History</h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={fetchRecentJobs}
                                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Refresh"
                                >
                                    <RefreshCw size={16} />
                                </button>
                                <button
                                    onClick={() => clearHistory(historyModuleTab)}
                                    className="px-3 py-2 text-sm rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                                >
                                    Clear Current Tab
                                </button>
                                <button
                                    onClick={() => clearHistory('all')}
                                    className="px-3 py-2 text-sm rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                                >
                                    Clear All
                                </button>
                            </div>
                        </div>

                        {jobsLoading ? (
                            <p className="text-sm text-slate-500 py-8 text-center">Loading history...</p>
                        ) : recentJobs.filter(j => (j.module || 'validation') === historyModuleTab).length === 0 ? (
                            <div className="text-center py-12 rounded-xl bg-slate-50 border border-slate-100 border-dashed">
                                <FolderClock className="mx-auto text-slate-300 mb-3" size={32} />
                                <p className="text-sm font-medium text-slate-500">No history in this module yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {recentJobs
                                    .filter(j => (j.module || 'validation') === historyModuleTab)
                                    .map((job) => (
                                        <div key={job.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex items-center justify-between group hover:bg-slate-100 transition-colors">
                                            <div>
                                                <p className="font-semibold text-slate-900 truncate max-w-sm xl:max-w-xl" title={job.file_name || job.filename}>
                                                    {job.file_name || job.filename || 'Untitled job'}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1 font-medium">{formatJobDate(job.created_at)}</p>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-100 xl:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => resumeJob(job)}
                                                    className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                                                >
                                                    Open Result
                                                </button>
                                                <button
                                                    onClick={() => deleteHistoryItem(job.id)}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete Record"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* 2. QUALITY VALIDATION VIEW */}
            {activeTab === 'validate' && (
                <motion.div key="validate-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-5xl mx-auto pb-20 pt-4">
                    <div className="flex items-center justify-end mb-8">
                        <div className="flex items-center gap-2">
                            {[1, 2, 3].map((s) => (
                                <div key={s} className="flex items-center">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step === s ? 'bg-slate-900 text-white shadow-md' : step > s ? 'bg-slate-300 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                        {step > s ? '✓' : s}
                                    </div>
                                    {s < 3 && <div className={`w-8 h-1 rounded-full mx-1 ${step > s ? 'bg-slate-300' : 'bg-slate-200'}`} />}
                                </div>
                            ))}
                        </div>
                    </div>

                    {step === 1 && (
                        <div className="bg-white p-10 rounded-[32px] border border-slate-200 shadow-sm">
                            <h2 className="text-3xl font-black text-slate-900 mb-2">Upload Your Data</h2>
                            <p className="text-slate-500 font-medium mb-8 text-lg">Provide data via CSV, Excel, or direct database connection.</p>
                            <DataConnection onUploadSuccess={(data) => { setSessionId(data.session_id); setFilename(data.filename || `Dataset_${new Date().getTime()}`); setColumns(data.columns); setStep(2); }} />
                        </div>
                    )}

                    {step === 2 && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <RuleBuilder
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
                </motion.div>
            )}

            {/* 3. ENRICHMENT VIEW */}
            {activeTab === 'enrichment' && (
                <motion.div key="enrichment-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-5xl mx-auto pb-20 pt-4">

                    <EnrichmentBuilder onComplete={goToLanding} />
                </motion.div>
            )}

            {/* 4. SCRAPER VIEW */}
            {activeTab === 'scraper' && (
                <motion.div key="scraper-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-5xl mx-auto pb-20 pt-4">

                    <ScraperBuilder onComplete={goToLanding} />
                </motion.div>
            )}

            {/* 5. MAPPER VIEW */}
            {activeTab === 'mapper' && (
                <motion.div key="mapper-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-5xl mx-auto pb-20 pt-4">

                    <SchemaMapper onComplete={goToLanding} />
                </motion.div>
            )}

            {/* 6. DATA MATCHING VIEW */}
            {activeTab === 'matching' && (
                <motion.div key="matching-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-5xl mx-auto pb-20 pt-4">

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
            <div className="min-h-screen bg-white font-sans text-slate-900 overflow-x-hidden">
                {/* Navigation */}
                <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 z-50">
                    <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                        <div className="flex items-center gap-8">
                            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={goToLanding}>
                                <img src={Logo} alt="CleanFlow" className="h-10 w-auto" style={{ filter: 'brightness(0)' }} />
                            </div>
                            <div className="hidden md:flex items-center gap-6">
                                {['Solutions', 'Resources', 'Pricing'].map((item) => (
                                    <button
                                        key={item}
                                        onClick={() => {
                                            if (item === 'Pricing') setActiveTab('pricing');
                                        }}
                                        className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors"
                                    >
                                        {item}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => { setAuthDefaultMode('login'); setIsAuthOpen(true); }}
                                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-bold"
                            >
                                Log in
                            </button>
                            <button
                                onClick={() => { setAuthDefaultMode('signup'); setIsAuthOpen(true); }}
                                className="px-5 py-2.5 text-sm bg-slate-900 text-white rounded-xl hover:bg-slate-800 font-bold shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-0.5"
                            >
                                Get Started
                            </button>
                        </div>
                    </div>
                </nav>

                <main className={`${activeTab === 'home' ? 'pt-0 pb-20 relative' : 'pt-24 pb-20 px-6 max-w-7xl mx-auto relative'}`}>
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
                                    <Home size={18} /> Dashboard Home
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
                <div className={`flex-1 w-full max-w-full h-full overflow-y-auto ${activeTab === 'pipeline' ? 'p-0' : 'p-6 md:p-8'}`}>
                    {renderWorkspaceContent()}
                </div>
            </main>

            {/* Support Tools */}
            <ChatBot />
        </div>
    );
}

export default App;
