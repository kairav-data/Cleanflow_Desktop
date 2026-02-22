import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut, Search, Sparkles, Database,
  FileCheck, ArrowRight, Zap,
  Globe, ChevronRight, Shuffle, GitMerge
} from 'lucide-react';

// Components
import { DataConnection, RuleBuilder, ResultsDashboard } from './components';
import { AuthModal, PaymentModal } from './components/modals';
import { Footer, UserSidebar, PlatformDropdown } from './components/common';
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [intendedTab, setIntendedTab] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.get(`${API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('token');
          setUser(null);
        });
    }
  }, []);

  const handleLogout = () => {
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

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white border-b border-slate-200 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setActiveTab('home')}>
              <img src={Logo} alt="CleanFlow" className="h-10 w-auto" style={{ filter: 'brightness(0)' }} />
            </div>
            <div className="hidden md:flex items-center gap-6">
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

      <main className="pt-24 pb-20 px-6 max-w-7xl mx-auto relative">
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
              <div className="text-center mb-16 pt-8">
                <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-4 leading-tight">
                  Clean & Transform
                  <br />
                  Your Data
                </h1>
                <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                  Validate, enrich, and transform enterprise data with confidence. All in one platform.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={startValidation}
                    className="px-6 py-3 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
                  >
                    Get Started
                  </button>
                  <button
                    onClick={() => setActiveTab('pricing')}
                    className="px-6 py-3 border border-slate-300 text-slate-900 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                  >
                    View Pricing
                  </button>
                </div>
              </div>

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
            </motion.div>
          )}

          {/* 2. QUALITY VALIDATION VIEW */}
          {activeTab === 'validate' && (
            <motion.div key="validate-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <button onClick={() => setActiveTab('home')} className="text-slate-600 hover:text-slate-900 font-medium flex items-center gap-2">
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

          {/* 3. ENRICHMENT VIEW */}
          {activeTab === 'enrichment' && (
            <motion.div key="enrichment-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-4xl mx-auto">
              <button onClick={() => setActiveTab('home')} className="mb-8 text-slate-600 hover:text-slate-900 font-medium flex items-center gap-2">
                <ArrowRight className="rotate-180" size={18} /> Back
              </button>
              <EnrichmentBuilder onComplete={() => setActiveTab('home')} />
            </motion.div>
          )}

          {/* 4. SCRAPER VIEW */}
          {activeTab === 'scraper' && (
            <motion.div key="scraper-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-4xl mx-auto">
              <button onClick={() => setActiveTab('home')} className="mb-8 text-slate-600 hover:text-slate-900 font-medium flex items-center gap-2">
                <ArrowRight className="rotate-180" size={18} /> Back
              </button>
              <ScraperBuilder onComplete={() => setActiveTab('home')} />
            </motion.div>
          )}

          {/* 5. MAPPER VIEW */}
          {activeTab === 'mapper' && (
            <motion.div key="mapper-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-4xl mx-auto">
              <button onClick={() => setActiveTab('home')} className="mb-8 text-slate-600 hover:text-slate-900 font-medium flex items-center gap-2">
                <ArrowRight className="rotate-180" size={18} /> Back
              </button>
              <SchemaMapper onComplete={() => setActiveTab('home')} />
            </motion.div>
          )}

          {/* 6. DATA MATCHING VIEW */}
          {activeTab === 'matching' && (
            <motion.div key="matching-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-4xl mx-auto">
              <button onClick={() => setActiveTab('home')} className="mb-8 text-slate-600 hover:text-slate-900 font-medium flex items-center gap-2">
                <ArrowRight className="rotate-180" size={18} /> Back
              </button>
              <DataMatchingBuilder onComplete={() => setActiveTab('home')} />
            </motion.div>
          )}

          {/* PRICING VIEW */}
          {activeTab === 'pricing' && (
            <motion.div key="pricing-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
              <PricingPage onClose={() => setActiveTab('home')} />
            </motion.div>
          )}

          {/* USER PROFILE VIEW */}
          {activeTab === 'profile' && user && (
            <motion.div key="profile-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
              <UserProfilePage
                user={user}
                onClose={() => setActiveTab('home')}
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
          if (intendedTab) {
            setActiveTab(intendedTab);
            if (intendedTab === 'validate') setStep(1);
            setIntendedTab(null);
          }
        }}
      />
      <UserSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} user={user} />
      <Footer />
    </div>
  );
}

export default App;