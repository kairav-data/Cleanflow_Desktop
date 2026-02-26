import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut, Search, Sparkles, Database,
  FileCheck, ArrowRight, Zap,
  Globe, ChevronRight, Shuffle, GitMerge, RefreshCw, Trash2, ShieldCheck, AlertTriangle, BarChart3
} from 'lucide-react';

// Components
import { DataConnection, RuleBuilder, ResultsDashboard } from './components';
import { AuthModal, PaymentModal } from './components/modals';
import { Footer, PlatformDropdown } from './components/common';
import { PricingPage, UserProfilePage } from './components/pages';

// Feature Builders
import { EnrichmentBuilder, ScraperBuilder, SchemaMapper, DataMatchingBuilder } from './features';

// Assets
import Logo from './assets/logo.png';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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
  const [recentJobs, setRecentJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [historyModuleTab, setHistoryModuleTab] = useState('validation');

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
      setIsAuthOpen(true);
      return;
    }
    setActiveTab(tabName);
    if (tabName === 'validate') setStep(1);
  };

  const startValidation = () => {
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
    return 'validate';
  };

  const resumeJob = (job) => {
    const targetTab = getTabFromModule(job.module);
    if (targetTab === 'validate') {
      setFilename(job.file_name || job.filename || '');
      setValidationResults({
        total_rows: job.total_rows || 0,
        valid_rows: job.valid_rows || 0,
        invalid_rows: job.invalid_rows || 0,
        column_stats: job.column_stats || {},
        // valid_file and error_file will be undefined for history items
      });
      setStep(3); // Jump straight to results dashboard
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
    } catch (e) {
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
    } catch (e) {
      alert("Failed to clear history.");
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white border-b border-slate-200 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={goToLanding}>
              <img src={Logo} alt="CleanFlow" className="h-10 w-auto" style={{ filter: 'brightness(0)' }} />
            </div>
            <div className="hidden md:flex items-center gap-6">
              {user && (
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Dashboard
                </button>
              )}
              <PlatformDropdown onFeatureSelect={handleFeatureAccess} />
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
            {user ? (
              <>
                <button onClick={() => setActiveTab('profile')} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg transition-colors">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
                    {user.full_name?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="text-sm text-slate-900">{user.full_name || 'Account'}</span>
                </button>
                <button onClick={handleLogout} className="p-2 text-slate-600 hover:text-slate-900 transition-colors">
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setIsAuthOpen(true)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium">Log in</button>
                <button onClick={() => setIsAuthOpen(true)} className="px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium">Get Started</button>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className={`${activeTab === 'home' ? 'pt-0 pb-20 relative' : 'pt-24 pb-20 px-6 max-w-7xl mx-auto relative'}`}>
        <AnimatePresence mode='wait'>

          {/* 1. HOME VIEW */}
          {activeTab === 'home' && (
            <motion.div
              key="home-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex flex-col items-center"
            >
              <div className="w-full mb-16">
                <div className="relative overflow-hidden min-h-[420px] md:min-h-[500px] bg-slate-950">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:56px_56px]" />
                  <motion.div
                    className="absolute inset-0 opacity-50"
                    animate={{ backgroundPosition: ['0px 0px', '140px 80px', '0px 0px'] }}
                    transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
                    style={{
                      backgroundImage:
                        'radial-gradient(circle at 1px 1px, rgba(226,232,240,0.2) 1px, transparent 0)',
                      backgroundSize: '36px 36px'
                    }}
                  />
                  <div className="absolute inset-y-0 right-0 w-[58%] hidden md:block">
                    <svg className="h-full w-full" viewBox="0 0 900 520" fill="none" aria-hidden="true">
                      <g opacity="0.8">
                        <motion.path
                          d="M80 420 L280 300 L460 330 L650 200 L840 260"
                          stroke="rgba(34,211,238,0.55)"
                          strokeWidth="2"
                          initial={{ pathLength: 0, opacity: 0.2 }}
                          animate={{ pathLength: 1, opacity: 0.9 }}
                          transition={{ duration: 1.8, ease: "easeInOut" }}
                        />
                        <motion.path
                          d="M120 160 L290 220 L460 180 L630 260 L820 150"
                          stroke="rgba(16,185,129,0.55)"
                          strokeWidth="2"
                          initial={{ pathLength: 0, opacity: 0.2 }}
                          animate={{ pathLength: 1, opacity: 0.8 }}
                          transition={{ duration: 1.6, ease: "easeInOut", delay: 0.2 }}
                        />
                        <motion.path
                          d="M90 280 L260 260 L430 120 L610 140 L800 90"
                          stroke="rgba(125,211,252,0.45)"
                          strokeWidth="1.5"
                          initial={{ pathLength: 0, opacity: 0.1 }}
                          animate={{ pathLength: 1, opacity: 0.75 }}
                          transition={{ duration: 2.1, ease: "easeInOut", delay: 0.35 }}
                        />
                      </g>
                      {[["80", "420"], ["280", "300"], ["460", "330"], ["650", "200"], ["840", "260"], ["120", "160"], ["460", "180"], ["820", "150"]].map((n, i) => (
                        <motion.circle
                          key={`n-${i}`}
                          cx={n[0]}
                          cy={n[1]}
                          r="6"
                          fill="rgba(226,232,240,0.95)"
                          animate={{ r: [5.5, 7.5, 5.5], opacity: [0.7, 1, 0.7] }}
                          transition={{ duration: 2.8 + (i % 3), repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
                        />
                      ))}
                    </svg>

                    <motion.div
                      className="absolute h-2.5 w-2.5 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(103,232,249,0.95)]"
                      animate={{ x: [120, 310, 480, 670, 860], y: [430, 305, 335, 205, 265] }}
                      transition={{ duration: 6.5, repeat: Infinity, ease: "linear" }}
                    />
                    <motion.div
                      className="absolute h-2.5 w-2.5 rounded-full bg-emerald-200 shadow-[0_0_12px_rgba(110,231,183,0.95)]"
                      animate={{ x: [130, 300, 470, 640, 830], y: [165, 225, 185, 265, 155] }}
                      transition={{ duration: 7.5, repeat: Infinity, ease: "linear", delay: 0.5 }}
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/70 to-slate-900/45" />

                  <div className="relative max-w-7xl mx-auto px-8 py-24 md:py-32">
                    <motion.div
                      className="max-w-2xl text-left"
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    >
                      <motion.h1
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
                        className="text-5xl md:text-6xl font-bold text-white mb-4 leading-tight"
                      >
                        Clean & Transform
                        <br />
                        Your Data
                      </motion.h1>
                      <motion.p
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                        className="text-lg md:text-xl text-slate-100 mb-10 leading-relaxed"
                      >
                        Validate, enrich, and transform enterprise data with confidence. All in one platform.
                      </motion.p>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
                        className="flex flex-wrap gap-3"
                      >
                        <button
                          onClick={startValidation}
                          className="px-6 py-3 bg-white text-slate-900 rounded-md font-semibold hover:bg-slate-100 transition-colors"
                        >
                          Get Started
                        </button>
                        <button
                          onClick={() => setActiveTab('pricing')}
                          className="px-6 py-3 border border-white/40 text-white rounded-md font-medium hover:bg-white/10 transition-colors"
                        >
                          View Pricing
                        </button>
                      </motion.div>
                    </motion.div>
                  </div>
                </div>
              </div>

              <div className="px-6 max-w-7xl mx-auto">
                {/* How It Works Section */}
                <div className="w-full mb-20">
                  <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">How CleanFlow Works</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                      {
                        step: "01",
                        title: "Upload Data",
                        desc: "Connect your CSV, Excel, or database. CleanFlow instantly analyzes your data structure and identifies quality issues.",
                        icon: <Database size={28} className="text-slate-900" />
                      },
                      {
                        step: "02",
                        title: "Define Rules",
                        desc: "Set up validation rules without code. Our intelligent rule builder suggests best practices for your data type.",
                        icon: <FileCheck size={28} className="text-slate-900" />
                      },
                      {
                        step: "03",
                        title: "Transform & Export",
                        desc: "Apply rules, enrich data, and export clean results. Download or sync directly to your warehouse.",
                        icon: <ArrowRight size={28} className="text-slate-900" />
                      }
                    ].map((item, i) => (
                      <div key={i} className="relative">
                        <div className="text-5xl font-bold text-slate-200 mb-4">{item.step}</div>
                        <div className="p-3 bg-slate-100 rounded-lg w-fit">{item.icon}</div>
                        <h3 className="text-xl font-bold text-slate-900 mb-3 mt-4">{item.title}</h3>
                        <p className="text-slate-600 leading-relaxed">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Modules Overview Section */}
                <div className="w-full mb-20">
                  <div className="text-center mb-10">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">Modules At A Glance</p>
                    <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">One platform, multiple data workflows</h2>
                    <p className="text-slate-600 max-w-2xl mx-auto">
                      From data quality checks to enrichment and extraction, each module is purpose-built and connected to the same history and output flow.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                    {[
                      {
                        title: "Quality Validation",
                        icon: <FileCheck size={20} className="text-blue-700" />,
                        tone: "bg-blue-50 border-blue-100",
                        stat: "50+ rule types",
                        desc: "Catch nulls, format drift, and invalid values instantly.",
                        cta: () => handleFeatureAccess('validate')
                      },
                      {
                        title: "Data Enrichment",
                        icon: <Sparkles size={20} className="text-emerald-700" />,
                        tone: "bg-emerald-50 border-emerald-100",
                        stat: "Provider-ready flow",
                        desc: "Append missing attributes to make records more complete.",
                        cta: () => handleFeatureAccess('enrichment')
                      },
                      {
                        title: "Schema Mapping",
                        icon: <Shuffle size={20} className="text-indigo-700" />,
                        tone: "bg-indigo-50 border-indigo-100",
                        stat: "Field-level transforms",
                        desc: "Map and reshape source columns into target schema.",
                        cta: () => handleFeatureAccess('mapper')
                      },
                      {
                        title: "Web Scraping",
                        icon: <Globe size={20} className="text-orange-700" />,
                        tone: "bg-orange-50 border-orange-100",
                        stat: "Template-driven extraction",
                        desc: "Collect structured web data without writing scraper code.",
                        cta: () => handleFeatureAccess('scraper')
                      },
                      {
                        title: "Data Matching",
                        icon: <GitMerge size={20} className="text-purple-700" />,
                        tone: "bg-purple-50 border-purple-100",
                        stat: "Fuzzy record linking",
                        desc: "Identify duplicate or related entities across datasets.",
                        cta: () => handleFeatureAccess('matching')
                      }
                    ].map((m) => (
                      <button
                        key={m.title}
                        onClick={m.cta}
                        className={`text-left p-5 rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-md ${m.tone} h-full flex flex-col`}
                      >
                        <div className="flex items-center justify-between mb-3 min-h-[42px]">
                          <div className="p-2 rounded-lg bg-white border border-slate-200">{m.icon}</div>
                          <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-700">
                            {m.stat}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mb-2 min-h-[48px]">{m.title}</h3>
                        <p className="text-sm text-slate-600 mb-4 leading-relaxed min-h-[66px]">{m.desc}</p>
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900 mt-auto">
                          Open module <ChevronRight size={14} />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Platform Features Section */}
                <div className="w-full mb-20 bg-slate-50 p-12 rounded-xl">
                  <h2 className="text-3xl font-bold text-slate-900 mb-4">CleanFlow Platform</h2>
                  <p className="text-lg text-slate-600 mb-8 max-w-3xl">
                    Everything you need to maintain data quality at scale. Our unified platform combines validation, enrichment,
                    mapping, and extraction tools designed for modern data teams.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      {
                        title: "Quality Validation",
                        desc: "Apply 50+ intelligent validation rules. Detect anomalies, duplicates, and inconsistencies automatically.",
                        icon: <FileCheck size={24} className="text-slate-900" />,
                        action: startValidation
                      },
                      {
                        title: "Schema Mapping",
                        desc: "Auto-map fields between datasets. Transform messy sources into clean, structured data.",
                        icon: <Shuffle size={24} className="text-slate-900" />,
                        action: () => handleFeatureAccess('mapper')
                      },
                      {
                        title: "Data Enrichment",
                        desc: "Enhance datasets with verified information. Append emails, demographics, and verified attributes.",
                        icon: <Sparkles size={24} className="text-slate-900" />,
                        action: () => handleFeatureAccess('enrichment')
                      },
                      {
                        title: "Web Scraping",
                        desc: "Extract structured data from any website. No coding required, instantly ready to use.",
                        icon: <Globe size={24} className="text-slate-900" />,
                        action: () => handleFeatureAccess('scraper')
                      }
                    ].map((card, i) => (
                      <div
                        key={i}
                        onClick={card.action}
                        className="p-6 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-soft transition-all cursor-pointer"
                      >
                        <div className="mb-4">{card.icon}</div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">{card.title}</h3>
                        <p className="text-slate-600 text-sm leading-relaxed">{card.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Validation Visual Section */}
                <div className="w-full mb-20 border border-slate-200 rounded-2xl p-8 md:p-10 bg-gradient-to-br from-white to-slate-50">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                    <div>
                      <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                        <BarChart3 size={14} /> Data Validation Snapshot
                      </p>
                      <h2 className="text-3xl font-bold text-slate-900 mb-4">Understand data quality in seconds</h2>
                      <p className="text-slate-600 leading-relaxed mb-6">
                        CleanFlow highlights invalid records, missing fields, and pattern failures with clear visual summaries so teams can act fast.
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <ShieldCheck className="text-emerald-600 mt-0.5" size={18} />
                          <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Validity score</span> tracks overall dataset health.</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="text-amber-600 mt-0.5" size={18} />
                          <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Rule failure insights</span> show top issues by column.</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="text-sm font-bold text-slate-900">Validation Report Preview</h3>
                        <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold">86% Healthy</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-5">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <p className="text-xs text-slate-500 mb-1">Total Rows</p>
                          <p className="text-lg font-bold text-slate-900">12,540</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <p className="text-xs text-slate-500 mb-1">Invalid Rows</p>
                          <p className="text-lg font-bold text-red-600">1,754</p>
                        </div>
                      </div>

                      <div className="mb-5">
                        <p className="text-xs text-slate-500 mb-2">Rule Failures by Column</p>
                        <div className="space-y-2">
                          {[
                            { label: 'Email', width: '78%' },
                            { label: 'Phone', width: '54%' },
                            { label: 'Zip Code', width: '33%' }
                          ].map((item) => (
                            <div key={item.label}>
                              <div className="flex justify-between text-xs text-slate-600 mb-1">
                                <span>{item.label}</span>
                                <span>{item.width}</span>
                              </div>
                              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                <div className="h-full bg-slate-800 rounded-full" style={{ width: item.width }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500 mb-2">Data Quality Mix</p>
                        <div className="flex items-center gap-4">
                          <svg width="72" height="72" viewBox="0 0 42 42" className="shrink-0">
                            <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#e2e8f0" strokeWidth="5" />
                            <circle
                              cx="21"
                              cy="21"
                              r="15.915"
                              fill="transparent"
                              stroke="#0f172a"
                              strokeWidth="5"
                              strokeDasharray="86 14"
                              strokeLinecap="round"
                              transform="rotate(-90 21 21)"
                            />
                          </svg>
                          <div className="space-y-1 text-xs">
                            <p className="text-slate-700"><span className="inline-block w-2 h-2 rounded-full bg-slate-900 mr-2" />Valid: 10,786</p>
                            <p className="text-slate-700"><span className="inline-block w-2 h-2 rounded-full bg-slate-300 mr-2" />Invalid: 1,754</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CTA Section */}
                <div className="w-full text-center bg-slate-900 text-white p-12 rounded-xl">
                  <h2 className="text-3xl font-bold mb-4">Ready to transform your data?</h2>
                  <p className="text-slate-300 mb-8 text-lg leading-relaxed">Join thousands of data teams using CleanFlow to maintain data quality.</p>
                  <button
                    onClick={startValidation}
                    className="px-8 py-3 bg-white text-slate-900 rounded-lg font-semibold hover:bg-slate-100 transition-colors"
                  >
                    Start Free Trial
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* 2. QUALITY VALIDATION VIEW */}
          {activeTab === 'validate' && (
            <motion.div key="validate-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <button onClick={goToLanding} className="text-slate-600 hover:text-slate-900 font-medium flex items-center gap-2">
                  <ArrowRight className="rotate-180" size={18} /> Back
                </button>
                <div className="flex items-center gap-2">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step === s ? 'bg-slate-900 text-white' : step > s ? 'bg-slate-300 text-white' : 'bg-slate-200 text-slate-500'}`}>
                        {step > s ? '✓' : s}
                      </div>
                      {s < 3 && <div className={`w-6 h-0.5 ${step > s ? 'bg-slate-300' : 'bg-slate-200'}`} />}
                    </div>
                  ))}
                </div>
                <div className="w-16" />
              </div>

              {step === 1 && (
                <div className="bg-white p-8 rounded-lg border border-slate-200">
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Upload Your Data</h2>
                  <p className="text-slate-600 mb-6">CSV, Excel, or database connection.</p>
                  <DataConnection onUploadSuccess={(data) => { setSessionId(data.session_id); setFilename(data.filename || `Dataset_${new Date().getTime()}`); setColumns(data.columns); setStep(2); }} />
                </div>
              )}

              {step === 2 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <RuleBuilder
                    columns={columns}
                    onRunValidation={async (rules) => {
                      try {
                        const token = localStorage.getItem('token');
                        const headers = token ? { Authorization: `Bearer ${token}` } : {};
                        const res = await axios.post(`${API_BASE}/validate/${sessionId}`, { rules }, { headers });
                        setValidationResults(res.data);

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
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <ResultsDashboard results={validationResults} onReset={() => setStep(1)} />
                </motion.div>
              )}
            </motion.div>
          )}

          {/* DASHBOARD VIEW */}
          {activeTab === 'dashboard' && user && (
            <motion.div
              key="dashboard-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full"
            >
              <div className="mb-10">
                <h1 className="text-4xl font-bold text-slate-900 mb-2">Welcome back, {user.full_name || 'User'}</h1>
                <p className="text-slate-600">Choose a workflow to continue.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5 mb-10">
                {[
                  {
                    title: 'Quality Validation',
                    description: 'Upload data, configure rules, and validate records.',
                    action: () => {
                      setStep(1);
                      setActiveTab('validate');
                    }
                  },
                  {
                    title: 'Data Enrichment',
                    description: 'Enhance records with additional verified attributes.',
                    action: () => setActiveTab('enrichment')
                  },
                  {
                    title: 'Schema Mapping',
                    description: 'Map and transform columns between datasets.',
                    action: () => setActiveTab('mapper')
                  },
                  {
                    title: 'Web Scraping',
                    description: 'Extract structured data from URLs at scale.',
                    action: () => setActiveTab('scraper')
                  },
                  {
                    title: 'Data Matching',
                    description: 'Identify duplicate or related entities across datasets.',
                    action: () => setActiveTab('matching')
                  }
                ].map((item) => (
                  <button
                    key={item.title}
                    onClick={item.action}
                    className="text-left p-6 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all"
                  >
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                    <p className="text-sm text-slate-600 mb-4 leading-relaxed">{item.description}</p>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900">
                      Open <ChevronRight size={16} />
                    </span>
                  </button>
                ))}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    { id: 'validation', label: 'Quality Validation' },
                    { id: 'enrichment', label: 'Data Enrichment' },
                    { id: 'mapper', label: 'Schema Mapping' },
                    { id: 'scraper', label: 'Web Scraping' },
                    { id: 'matching', label: 'Data Matching' }
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

                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900">History</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={fetchRecentJobs}
                      className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                      title="Refresh"
                    >
                      <RefreshCw size={16} />
                    </button>
                    <button
                      onClick={() => clearHistory(historyModuleTab)}
                      className="px-3 py-2 text-sm rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100"
                    >
                      Clear Current Tab
                    </button>
                    <button
                      onClick={() => clearHistory('all')}
                      className="px-3 py-2 text-sm rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {jobsLoading ? (
                  <p className="text-sm text-slate-500">Loading history...</p>
                ) : recentJobs.filter(j => (j.module || 'validation') === historyModuleTab).length === 0 ? (
                  <p className="text-sm text-slate-500">No history in this module yet.</p>
                ) : (
                  <div className="space-y-3">
                    {recentJobs
                      .filter(j => (j.module || 'validation') === historyModuleTab)
                      .map((job) => (
                        <div key={job.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                          <p className="font-semibold text-slate-900 truncate" title={job.file_name || job.filename}>
                            {job.file_name || job.filename || 'Untitled job'}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">{formatJobDate(job.created_at)}</p>
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              onClick={() => resumeJob(job)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                            >
                              Open
                            </button>
                            <button
                              onClick={() => deleteHistoryItem(job.id)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-700 hover:bg-red-100 inline-flex items-center gap-1"
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* 3. ENRICHMENT VIEW */}
          {activeTab === 'enrichment' && (
            <motion.div key="enrichment-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-4xl mx-auto">
              <button onClick={goToLanding} className="mb-8 text-slate-600 hover:text-slate-900 font-medium flex items-center gap-2">
                <ArrowRight className="rotate-180" size={18} /> Back
              </button>
              <EnrichmentBuilder onComplete={goToLanding} />
            </motion.div>
          )}

          {/* 4. SCRAPER VIEW */}
          {activeTab === 'scraper' && (
            <motion.div key="scraper-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-4xl mx-auto">
              <button onClick={goToLanding} className="mb-8 text-slate-600 hover:text-slate-900 font-medium flex items-center gap-2">
                <ArrowRight className="rotate-180" size={18} /> Back
              </button>
              <ScraperBuilder onComplete={goToLanding} />
            </motion.div>
          )}

          {/* 5. MAPPER VIEW */}
          {activeTab === 'mapper' && (
            <motion.div key="mapper-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-4xl mx-auto">
              <button onClick={goToLanding} className="mb-8 text-slate-600 hover:text-slate-900 font-medium flex items-center gap-2">
                <ArrowRight className="rotate-180" size={18} /> Back
              </button>
              <SchemaMapper onComplete={goToLanding} />
            </motion.div>
          )}

          {/* 6. DATA MATCHING VIEW */}
          {activeTab === 'matching' && (
            <motion.div key="matching-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-4xl mx-auto">
              <button onClick={goToLanding} className="mb-8 text-slate-600 hover:text-slate-900 font-medium flex items-center gap-2">
                <ArrowRight className="rotate-180" size={18} /> Back
              </button>
              <DataMatchingBuilder onComplete={goToLanding} />
            </motion.div>
          )}

          {/* PRICING VIEW */}
          {activeTab === 'pricing' && (
            <motion.div key="pricing-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
              <PricingPage onClose={goToLanding} />
            </motion.div>
          )}

          {/* USER PROFILE VIEW */}
          {activeTab === 'profile' && user && (
            <motion.div key="profile-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
              <UserProfilePage
                user={user}
                onClose={goToLanding}
                onLogout={handleLogout}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      <AuthModal
        isOpen={isAuthOpen}
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

export default App;
