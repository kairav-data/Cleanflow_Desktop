import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
	import {
	  LogOut, Search, Sparkles, Database,
	  FileCheck, ArrowRight, Zap, Check,
	  Globe, ChevronRight, Shuffle, GitMerge, RefreshCw, Trash2, ShieldCheck, AlertTriangle, BarChart3
	} from 'lucide-react';

// Components
import { DataConnection, RuleBuilder, ResultsDashboard } from './components';
import { AuthModal, PaymentModal } from './components/modals';
import { Footer, PlatformDropdown } from './components/common';
import { HomePage, PricingPage, UserProfilePage } from './components/pages';
import ChatBot from './components/ChatBot';

// Feature Builders
import { EnrichmentBuilder, ScraperBuilder, SchemaMapper, DataMatchingBuilder } from './features';

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
    return 'validate';
  };

  const resumeJob = (job) => {
    const targetTab = getTabFromModule(job.module);
    if (targetTab === 'validate') {
      setFilename(job.file_name || job.filename || '');
      // Extract columns from job rules and stats so RuleBuilder has column options if the user edits
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
                <button
                  onClick={() => { setAuthDefaultMode('login'); setIsAuthOpen(true); }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium"
                >
                  Log in
                </button>
                <button
                  onClick={() => { setAuthDefaultMode('signup'); setIsAuthOpen(true); }}
                  className="px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium"
                >
                  Get Started
                </button>
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
	                            <HomePage
                startValidation={startValidation}
                onViewPricing={() => setActiveTab('pricing')}
                handleFeatureAccess={handleFeatureAccess}
              />
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
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
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
                    description: 'Enhance records with additional verified attributes.',
                    action: () => setActiveTab('enrichment'),
                    //disabled: true
                  },
                  {
                    title: 'Schema Mapping',
                    description: 'Map and transform columns between datasets.',
                    action: () => setActiveTab('mapper'),
                    //disabled: true
                  },
                  {
                    title: 'Web Scraping',
                    description: 'Extract structured data from URLs at scale.',
                    action: () => setActiveTab('scraper'),
                    //disabled: true
                  },
                  {
                    title: 'Data Matching',
                    description: 'Identify duplicate or related entities across datasets.',
                    action: () => setActiveTab('matching'),
                    //disabled: true
                  }
                ].map((item) => (
                  <button
                    key={item.title}
                    onClick={() => !item.disabled && item.action()}
                    disabled={item.disabled}
                    className={`text-left p-6 bg-white border border-slate-200 rounded-xl ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-300 hover:shadow-sm transition-all'}`}
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
      <ChatBot />
      <Footer />
    </div>
  );
}

export default App;
