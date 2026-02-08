import React, { useState, useEffect } from 'react';
import DataConnection from './components/DataConnection';
import RuleBuilder from './components/RuleBuilder';
import ResultsDashboard from './components/ResultsDashboard';
import AuthModal from './components/AuthModal';
import UserSidebar from './components/UserSidebar';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Snowflake, LogOut, Search, Sparkles, Database, 
  FileCheck, ArrowRight, Zap, ShieldCheck, BarChart3, 
  Globe, ChevronRight, LayoutGrid
} from 'lucide-react';
import axios from 'axios';


// Pulling the URL from the .env file
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('home'); 
  const [step, setStep] = useState(1); 
  const [sessionId, setSessionId] = useState(null);
  const [columns, setColumns] = useState([]);
  const [validationResults, setValidationResults] = useState(null);

  // Auth State
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.get(`${API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => setUser(res.data)).catch(() => localStorage.removeItem('token'));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setStep(1);
    setActiveTab('home');
  };

  const startValidation = () => {
    setActiveTab('validate');
    setStep(1);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 selection:bg-brand-blue/30">
      {/* Dynamic Background Ornament */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-brand-blue/5 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-purple-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Navigation Bar */}
      <nav className="fixed top-0 w-full bg-white/70 backdrop-blur-xl border-b border-slate-200/60 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div
              className="flex items-center gap-2.5 cursor-pointer group"
              onClick={() => setActiveTab('home')}
            >
              <div className="bg-gradient-to-br from-brand-blue to-brand-dark p-2 rounded-xl text-white shadow-lg shadow-brand-blue/20 group-hover:rotate-12 transition-transform">
                <Snowflake size={22} />
              </div>
              <span className="font-black text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-slate-900 to-slate-600">
                CleanFlow
              </span>
            </div>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-1">
              {['Platform', 'Solutions', 'Resources', 'Pricing'].map((item) => (
                <button key={item} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-brand-blue transition-colors">
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="flex items-center gap-2.5 bg-white hover:bg-slate-50 px-4 py-2 rounded-full border border-slate-200 shadow-sm transition-all"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-brand-blue to-purple-500 text-white flex items-center justify-center text-xs font-bold">
                    {user.full_name?.[0] || user.email[0].toUpperCase()}
                  </div>
                  <span className="text-sm font-bold text-slate-700">{user.full_name || 'Account'}</span>
                </button>
                <button onClick={handleLogout} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all">
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => setIsAuthOpen(true)} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900">
                  Log in
                </button>
                <button onClick={() => setIsAuthOpen(true)} className="px-5 py-2.5 text-sm font-bold bg-slate-900 text-white rounded-full hover:bg-black transition-all shadow-md">
                  Get Started
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-20 px-6 max-w-7xl mx-auto relative">
        <AnimatePresence mode='wait'>
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex flex-col items-center"
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-blue/10 border border-brand-blue/20 text-brand-blue text-xs font-black uppercase tracking-widest mb-8">
                <Zap size={14} fill="currentColor" /> v2.0 is now live
              </div>

              <h1 className="text-5xl md:text-7xl font-black text-center text-slate-900 mb-8 tracking-tight leading-[1.1]">
                Modern Data Quality <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-blue via-purple-600 to-brand-blue bg-[length:200%_auto] animate-gradient">
                  built for scale.
                </span>
              </h1>

              <p className="text-slate-500 text-xl text-center max-w-2xl mb-12 leading-relaxed font-medium">
                The fastest way to validate, clean, and transform your enterprise data. 
                Trusted by data teams to process millions of records daily.
              </p>

              {/* Enhanced Search / Prompt Bar */}
              <div className="w-full max-w-3xl relative group mb-20">
                <div className="absolute -inset-1 bg-gradient-to-r from-brand-blue to-purple-600 rounded-[32px] blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative bg-white rounded-3xl shadow-2xl flex items-center p-2.5 pl-7 border border-slate-100">
                  <Search className="text-slate-400 mr-4" size={24} />
                  <input
                    type="text"
                    placeholder="Ask CleanFlow to 'Validate my sales_data.csv for duplicates'..."
                    className="w-full bg-transparent outline-none text-lg text-slate-700 placeholder:text-slate-400 font-medium h-14"
                  />
                  <button onClick={startValidation} className="bg-brand-blue hover:bg-brand-dark text-white px-8 py-4 rounded-2xl font-black transition-all shadow-lg hover:shadow-brand-blue/40 flex items-center gap-2">
                    Start <ArrowRight size={20} />
                  </button>
                </div>
              </div>

              {/* Quick Actions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
                {[
                  { 
                    title: "Quality Validation", 
                    desc: "Apply 50+ semantic rules to find anomalies and format errors in seconds.",
                    icon: <FileCheck className="text-blue-600" />,
                    color: "blue",
                    action: startValidation,
                    badge: "Popular"
                  },
                  { 
                    title: "Schema Mapping", 
                    desc: "Automatically align messy source files to your production database schema.",
                    icon: <LayoutGrid className="text-purple-600" />,
                    color: "purple",
                    badge: "Beta"
                  },
                  { 
                    title: "Data Enrichment", 
                    desc: "Verify emails, clean addresses, and normalize currency formats with AI.",
                    icon: <Sparkles className="text-emerald-600" />,
                    color: "emerald",
                    badge: "Coming Soon"
                  }
                ].map((card, i) => (
                  <motion.div
                    key={i}
                    whileHover={{ y: -8, transition: { duration: 0.2 } }}
                    onClick={card.action}
                    className={`bg-white p-10 rounded-[40px] shadow-sm border border-slate-100 cursor-pointer group relative overflow-hidden`}
                  >
                    <div className={`absolute top-0 right-0 p-4`}>
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-slate-100 text-slate-500 rounded-lg group-hover:bg-brand-blue group-hover:text-white transition-colors">
                            {card.badge}
                        </span>
                    </div>
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                      {card.icon}
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 mb-4">{card.title}</h3>
                    <p className="text-slate-500 leading-relaxed font-medium mb-8">{card.desc}</p>
                    <div className="flex items-center gap-2 text-sm font-black text-slate-900 group-hover:gap-4 transition-all">
                      Try Tool <ChevronRight size={18} className="text-brand-blue" />
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Trust Section */}
              <div className="mt-32 w-full border-t border-slate-200 pt-16 flex flex-col items-center">
                <p className="text-slate-400 font-bold text-sm uppercase tracking-[0.2em] mb-10">Trusted by Global Teams</p>
                <div className="flex flex-wrap justify-center gap-12 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
                   <div className="flex items-center gap-2 font-black text-2xl"><Globe size={24}/> ATLASSIAN</div>
                   <div className="flex items-center gap-2 font-black text-2xl"><Database size={24}/> SNOWFLAKE</div>
                   <div className="flex items-center gap-2 font-black text-2xl"><ShieldCheck size={24}/> OKTA</div>
                   <div className="flex items-center gap-2 font-black text-2xl"><BarChart3 size={24}/> DATADOG</div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'validate' && (
            <motion.div
              key="validate"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="w-full max-w-5xl mx-auto"
            >
              {/* Stepper Header */}
              <div className="flex items-center justify-between mb-12">
                <button
                    onClick={() => setActiveTab('home')}
                    className="p-2 -ml-2 text-slate-400 hover:text-slate-900 transition-colors flex items-center gap-2 font-bold"
                >
                    <ArrowRight className="rotate-180" size={20} /> Exit
                </button>
                
                <div className="flex items-center gap-3">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black transition-all ${step === s ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/30 scale-110' : step > s ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                {step > s ? '✓' : s}
                            </div>
                            {s < 3 && <div className={`w-8 h-1 rounded-full ${step > s ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
                        </div>
                    ))}
                </div>
                <div className="w-20" /> {/* Spacer */}
              </div>

              {step === 1 && (
                <div className="bg-white p-12 rounded-[48px] shadow-2xl shadow-slate-200/60 border border-slate-100">
                  <div className="mb-10 text-center">
                    <h2 className="text-4xl font-black text-slate-900 mb-4">Connect your data</h2>
                    <p className="text-slate-500 font-medium">Upload a CSV, Excel file, or connect directly to your SQL database.</p>
                  </div>
                  <DataConnection onUploadSuccess={(data) => {
                    setSessionId(data.session_id);
                    setColumns(data.columns);
                    setStep(2);
                  }} />
                </div>
              )}

              {step === 2 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="flex justify-between items-end mb-8">
                    <div>
                        <h2 className="text-4xl font-black text-slate-900 mb-2">Build Quality Rules</h2>
                        <p className="text-slate-500 font-medium">Select columns and apply validation logic.</p>
                    </div>
                    <div className="px-4 py-2 bg-slate-100 rounded-xl text-slate-600 text-sm font-bold border border-slate-200">
                        {columns.length} Columns Detected
                    </div>
                  </div>
                  <RuleBuilder
                    columns={columns}
                    onRunValidation={async (rules) => {
                      try {
                        const token = localStorage.getItem('token');
                        const headers = token ? { Authorization: `Bearer ${token}` } : {};
                        const res = await axios.post(
                          `${API_BASE}/validate/${sessionId}`,
                          { rules },
                          { headers }
                        );
                        setValidationResults(res.data);
                        setStep(3);
                      } catch (e) {
                        alert("Validation Failed: " + (e.response?.data?.detail || e.message));
                      }
                    }}
                  />
                </motion.div>
              )}

              {step === 3 && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                  <ResultsDashboard results={validationResults} onReset={() => setStep(1)} />
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={(userData) => setUser(userData)}
      />

      <UserSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        user={user}
      />
    </div>
  );
}

export default App;