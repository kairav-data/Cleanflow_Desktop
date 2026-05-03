import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    FileCheck, Shuffle, Sparkles, Globe, GitMerge,
    ChevronRight, Search, ArrowRight, Zap, Database
} from 'lucide-react';

export default function Home() {
    const navigate = useNavigate();

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex flex-col items-center"
        >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 text-brand-600 text-xs font-bold uppercase tracking-widest mb-8">
                <Zap size={14} fill="currentColor" /> v2.0 is now live
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-center text-slate-900 mb-8 tracking-tight leading-[1.1]">
                Modern Data Quality <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-accent-600">
                    built for scale.
                </span>
            </h1>

            <p className="text-slate-500 text-xl text-center max-w-2xl mb-12 leading-relaxed font-normal">
                The fastest way to validate, clean, and transform your enterprise data.
                Trusted by data teams to process millions of records daily.
            </p>

            <div className="w-full max-w-3xl relative mb-20 group">
                <div className="absolute -inset-1 bg-gradient-to-r from-brand-400 to-accent-400 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                <div className="relative bg-white rounded-2xl shadow-lg flex items-center p-2 pl-6 border border-slate-200">
                    <Search className="text-slate-400 mr-4" size={24} />
                    <input
                        type="text"
                        placeholder="Ask CleanFlow to 'Validate my sales_data.csv'..."
                        className="w-full bg-transparent outline-none text-lg text-slate-900 placeholder:text-slate-600 font-medium h-12"
                    />
                    <button onClick={() => navigate('/validate')} className="bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2">
                        Start <ArrowRight size={18} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-7xl">
                {[
                    {
                        title: "Quality Validation",
                        desc: "Apply 50+ intelligent validation rules to instantly detect anomalies, missing values, and format inconsistencies.",
                        icon: <FileCheck />,
                        color: "text-brand-600 bg-brand-50",
                        badge: "Popular",
                        path: '/validate'
                    },
                    {
                        title: "Schema Mapping",
                        desc: "Automatically map and transform messy source files into your target database schema with zero manual effort.",
                        icon: <Shuffle />,
                        color: "text-purple-600 bg-purple-50",
                        badge: "Smart",
                        path: '/mapper'
                    },
                    {
                        title: "Data Enrichment",
                        desc: "Enhance your datasets with verified emails, addresses, and AI-driven attributes.",
                        icon: <Sparkles />,
                        color: "text-amber-500 bg-amber-50",
                        badge: "AI",
                        path: '/enrichment'
                    },
                    {
                        title: "No-Code Scraping",
                        desc: "Extract structured data from any website in just a few clicks—no code, no bots, no headaches.",
                        icon: <Globe />,
                        color: "text-sky-500 bg-sky-50",
                        badge: "Beta",
                        path: '/scraper'
                    },
                    {
                        title: "Data Matching",
                        desc: "Match your data with reference datasets using fuzzy matching, vector embeddings, and AI-powered resolution.",
                        icon: <GitMerge />,
                        color: "text-rose-500 bg-rose-50",
                        badge: "New",
                        path: '/matching'
                    }
                ].map((card, i) => (
                    <motion.div
                        key={i}
                        whileHover={{ y: -4 }}
                        onClick={() => navigate(card.path)}
                        className="bg-white p-8 rounded-2xl border border-slate-200 hover:border-brand-300 hover:shadow-xl hover:shadow-brand-500/10 transition-all cursor-pointer group"
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${card.color}`}>
                                {React.cloneElement(card.icon, { size: 24 })}
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-slate-50 text-slate-500 rounded-md border border-slate-100">
                                {card.badge}
                            </span>
                        </div>

                        <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-brand-600 transition-colors">{card.title}</h3>
                        <p className="text-slate-500 leading-relaxed text-sm font-medium mb-6">{card.desc}</p>

                        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 group-hover:gap-3 transition-all">
                            Try Tool <ChevronRight size={16} className="text-slate-300 group-hover:text-brand-600" />
                        </div>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}
