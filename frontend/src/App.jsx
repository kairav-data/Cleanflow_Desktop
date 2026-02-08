import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LogOut, Search, Sparkles, Database, 
  FileCheck, ArrowRight, Zap, ShieldCheck, BarChart3, 
  Globe, ChevronRight, LayoutGrid, Shuffle // Added Shuffle
} from 'lucide-react';

// Components
import DataConnection from './components/DataConnection';
import RuleBuilder from './components/RuleBuilder';
import ResultsDashboard from './components/ResultsDashboard';
import AuthModal from './components/AuthModal';
import UserSidebar from './components/UserSidebar';

// Assets
import Logo from './assets/logo.png'; 

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('home'); 
  const [step, setStep] = useState(1); 
  const [sessionId, setSessionId] = useState(null);
  const [columns, setColumns] = useState([]);
  const [validationResults, setValidationResults] = useState(null);

  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  const startValidation = () => {
    setActiveTab('validate');
    setStep(1);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 selection:bg-blue-500/30">
      {/* Background Ornament */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-purple-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/70 backdrop-blur-xl border-b border-slate-200/60 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div
              className="flex items-center gap-2 cursor-pointer group"
              onClick={() => setActiveTab('home')}
            >
              <img 
                src={Logo} 
                alt="CleanFlow" 
                className="h-9 w-auto object-contain transition-transform group-hover:scale-110" 
                style={{ filter: 'brightness(0) saturate(100%) invert(18%) sepia(15%) saturate(1235%) hue-rotate(182deg) brightness(92%) contrast(92%)' }} 
              />
            </div>

            <div className="hidden md:flex items-center gap-1">
              {['Platform', 'Solutions', 'Resources', 'Pricing'].map((item) => (
                <button key={item} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors">
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
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-purple-500 text-white flex items-center justify-center text-xs font-bold">
                    {user.full_name?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
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
          {activeTab === 'home' ? (
            <motion.div
              key="home-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex flex-col items-center"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 text-xs font-black uppercase tracking-widest mb-8">
                <Zap size={14} fill="currentColor" /> v2.0 is now live
              </div>

              <h1 className="text-5xl md:text-7xl font-black text-center text-slate-900 mb-8 tracking-tight leading-[1.1]">
                Modern Data Quality <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-[length:200%_auto] animate-gradient">
                  built for scale.
                </span>
              </h1>

              <p className="text-slate-500 text-xl text-center max-w-2xl mb-12 leading-relaxed font-medium">
                The fastest way to validate, clean, and transform your enterprise data. 
                Trusted by data teams to process millions of records daily.
              </p>

              <div className="w-full max-w-3xl relative group mb-20">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-[32px] blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative bg-white rounded-3xl shadow-2xl flex items-center p-2.5 pl-7 border border-slate-100">
                  <Search className="text-slate-400 mr-4" size={24} />
                  <input
                    type="text"
                    placeholder="Ask CleanFlow to 'Validate my sales_data.csv'..."
                    className="w-full bg-transparent outline-none text-lg text-slate-700 placeholder:text-slate-400 font-medium h-14"
                  />
                  <button onClick={startValidation} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black transition-all shadow-lg flex items-center gap-2">
                    Start <ArrowRight size={20} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
                {[
                  {
                    title: "Quality Validation",
                    desc: "Apply 50+ intelligent validation rules to instantly detect anomalies, missing values, and format inconsistencies.",
                    icon: <FileCheck className="text-blue-600" />,
                    badge: "Popular",
                    action: startValidation
                  },
                  {
                    title: "Schema Mapping",
                    desc: "Automatically map and transform messy source files into your target database schema with zero manual effort.",
                    icon: <LayoutGrid className="text-purple-600" />,
                    badge: "Beta"
                  },
                  {
                    title: "Data Matching",
                    desc: "Match your data with reference datasets using fuzzy matching, vector embeddings, and AI-powered resolution.",
                    icon: <Shuffle className="text-indigo-600" />,
                    badge: "Advanced"
                  },
                  {
                    title: "No-Code Scraping",
                    desc: "Extract structured data from any website in just a few clicks—no code, no bots, no headaches.",
                    icon: <Globe className="text-orange-600" />,
                    badge: "New"
                  },
                  {
                    title: "Data Enrichment",
                    desc: "Enhance your datasets with verified emails, addresses, and AI-driven attributes.",
                    icon: <Sparkles className="text-emerald-600" />,
                    badge: "Coming Soon"
                  }
                ].map((card, i) => (
                  <motion.div
                    key={i}
                    whileHover={{ y: -8 }}
                    onClick={card.action}
                    className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100 cursor-pointer group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4">
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-slate-100 text-slate-500 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            {card.badge}
                        </span>
                    </div>
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                      {card.icon}
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 mb-4">{card.title}</h3>
                    <p className="text-slate-500 leading-relaxed font-medium mb-8">{card.desc}</p>
                    <div className="flex items-center gap-2 text-sm font-black text-slate-900 group-hover:gap-4 transition-all">
                      Try Tool <ChevronRight size={18} className="text-blue-600" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="validate-tab"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="w-full max-w-5xl mx-auto"
            >
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
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black transition-all ${step === s ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-110' : step > s ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                {step > s ? '✓' : s}
                            </div>
                            {s < 3 && <div className={`w-8 h-1 rounded-full ${step > s ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
                        </div>
                    ))}
                </div>
                <div className="w-20" />
              </div>

              {step === 1 && (
                <div className="bg-white p-12 rounded-[48px] shadow-2xl shadow-slate-200/60 border border-slate-100">
                  <div className="mb-10 text-center">
                    <h2 className="text-4xl font-black text-slate-900 mb-4">Connect your data</h2>
                    <p className="text-slate-500 font-medium">Upload a CSV or connect to your database.</p>
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
                  <RuleBuilder
                    columns={columns}
                    onRunValidation={async (rules) => {
                      try {
                        const token = localStorage.getItem('token');
                        const headers = token ? { Authorization: `Bearer ${token}` } : {};
                        const res = await axios.post(`${API_BASE}/validate/${sessionId}`, { rules }, { headers });
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

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onLoginSuccess={(u) => setUser(u)} />
      <UserSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} user={user} />
    </div>
  );
}

export default App;