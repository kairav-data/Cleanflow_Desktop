import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Database,
  FileCheck,
  GitMerge,
  Globe,
  RefreshCw,
  Search,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Trash2,
  Zap,
  AlertTriangle
} from 'lucide-react';

export default function HomePage({ startValidation, onViewPricing, handleFeatureAccess }) {
  const MotionDiv = motion.div;

  return (
    <>
      <div className="w-full mb-16 relative">
        {/* Ambient Dark Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[500px] bg-[radial-gradient(ellipse_at_center,rgba(52,211,153,0.15),transparent_70%)] pointer-events-none" />

        <div className="relative overflow-visible min-h-[420px] md:min-h-[60vh] flex flex-col justify-center bg-transparent mt-16 md:mt-24 z-10">
          <div className="relative max-w-5xl mx-auto px-8 w-full">
            <motion.div
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
                className="inline-flex items-center justify-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(16,185,129,0.2)]"
              >
                <Sparkles size={16} /> The New CleanFlow v2.5
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
                className="text-6xl md:text-8xl font-black text-white mb-6 leading-[1.1] tracking-tight"
              >
                Clean &amp; Transform
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-400">
                  Your Data.
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                className="text-lg md:text-2xl text-slate-400 mb-12 leading-relaxed max-w-3xl font-medium"
              >
                Validate, enrich, and transform enterprise data with absolute confidence. Millions of records, all in one platform.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
                className="flex flex-col sm:flex-row items-center justify-center gap-5 w-full sm:w-auto"
              >
                <button
                  onClick={startValidation}
                  className="w-full sm:w-auto px-10 py-5 bg-white text-slate-950 rounded-2xl font-black shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:scale-105 transition-all flex items-center justify-center gap-3 text-xl"
                >
                  Start Execution Engine <ArrowRight size={22} className="text-emerald-600" />
                </button>
                <button
                  onClick={onViewPricing}
                  className="w-full sm:w-auto px-8 py-5 border-2 border-slate-700 text-white rounded-2xl font-bold hover:bg-slate-800 transition-colors text-xl"
                >
                  Explore Pricing
                </button>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="px-6 max-w-7xl mx-auto">
        {/* Modules Overview Section */}
        <div className="w-full mb-32 relative">
          <div className="absolute inset-0 bg-slate-900 rounded-[40px] blur-3xl opacity-50 -z-10" />

          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500 mb-3">Modules At A Glance</p>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">One platform, unlimited data workflows</h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg font-medium">
              From data quality checks to enrichment and extraction, each module is purpose-built and connected to the same high-performance engine.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5">
            {[
              {
                title: "Quality Validation",
                icon: <FileCheck size={20} className="text-emerald-400" />,
                tone: "bg-slate-900/50 border-slate-800 hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]",
                stat: "50+ rule types",
                desc: "Catch nulls, format drift, and invalid values instantly.",
                cta: () => handleFeatureAccess('validate')
              },
              {
                title: "Data Enrichment",
                icon: <Sparkles size={20} className="text-sky-400" />,
                tone: "bg-slate-900/50 border-slate-800 hover:border-sky-500/50 hover:shadow-[0_0_20px_rgba(56,189,248,0.15)]",
                stat: "Provider-ready",
                desc: "Append missing attributes to make records more complete.",
                cta: () => handleFeatureAccess('enrichment')
              },
              {
                title: "Schema Mapping",
                icon: <Shuffle size={20} className="text-purple-400" />,
                tone: "bg-slate-900/50 border-slate-800 hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]",
                stat: "Auto-match fields",
                desc: "Standardize headers and map to target formats fast.",
                cta: () => handleFeatureAccess('mapper')
              },
              {
                title: "Web Scraping",
                icon: <Globe size={20} className="text-amber-400" />,
                tone: "bg-slate-900/50 border-slate-800 hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(251,191,36,0.15)]",
                stat: "Template-driven",
                desc: "Extract clean tables from websites with visual previews.",
                cta: () => handleFeatureAccess('scraper')
              },
              {
                title: "Data Matching",
                icon: <GitMerge size={20} className="text-rose-400" />,
                tone: "bg-slate-900/50 border-slate-800 hover:border-rose-500/50 hover:shadow-[0_0_20px_rgba(244,63,94,0.15)]",
                stat: "Fuzzy matching",
                desc: "Identify duplicate or related entities across datasets.",
                cta: () => handleFeatureAccess('matching')
              }
            ].map((m) => (
              <button
                key={m.title}
                onClick={m.cta}
                className={`text-left p-6 rounded-2xl backdrop-blur-md border transition-all h-full flex flex-col group hover:-translate-y-1 ${m.tone}`}
              >
                <div className="flex items-center justify-between mb-4 min-h-[42px]">
                  <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 shadow-inner group-hover:scale-110 transition-transform">{m.icon}</div>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                    {m.stat}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2 min-h-[48px] group-hover:text-emerald-400 transition-colors">{m.title}</h3>
                <p className="text-sm text-slate-400 mb-6 leading-relaxed font-medium min-h-[66px]">{m.desc}</p>
                <span className="inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wider mt-auto text-emerald-500 group-hover:text-emerald-400">
                  Launch Module <ChevronRight size={14} />
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Validation Visual Section */}
        <div className="w-full mb-20 border-2 border-slate-800 shadow-2xl rounded-[32px] p-8 md:p-12 bg-slate-900 overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(16,185,129,0.15),transparent_60%)]" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400 mb-4">
                <BarChart3 size={16} /> Data Validation Snapshot
              </p>
              <h2 className="text-4xl font-black text-white mb-5 tracking-tight">Understand data quality instantly</h2>
              <p className="text-slate-400 leading-relaxed font-medium mb-8 text-lg">
                CleanFlow highlights invalid records, missing fields, and pattern failures with clear visual summaries so teams can act exactly where they need to.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                  <ShieldCheck className="text-emerald-400 shrink-0" size={24} />
                  <p className="text-sm font-medium text-slate-300"><span className="font-bold text-emerald-200">Validity score tracking</span> gives you a continuous pulse on overall dataset health.</p>
                </div>
                <div className="flex items-start gap-3 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                  <AlertTriangle className="text-amber-400 shrink-0" size={24} />
                  <p className="text-sm font-medium text-slate-300"><span className="font-bold text-amber-200">Deep rule failure insights</span> isolate the top anomalies down to the specific column.</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-emerald-900/20">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-base font-bold text-white uppercase tracking-wider">Report Output</h3>
                <span className="text-xs px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">86% Healthy Validation</span>
              </div>

              <div className="grid grid-cols-2 gap-5 mb-8">
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Total Load</p>
                  <p className="text-3xl font-black text-white tracking-tight">12,540</p>
                </div>
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Flagged</p>
                  <p className="text-3xl font-black text-red-400 tracking-tight">1,754</p>
                </div>
              </div>

              <div className="mb-8 p-6 rounded-2xl bg-slate-900 border border-slate-800">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5">Critical Failure Rates</p>
                <div className="space-y-4">
                  {[
                    { label: 'Email Format RegExp', width: '78%' },
                    { label: 'Phone Number Sequence', width: '54%' },
                    { label: 'ZIP Code Boundary', width: '33%' }
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs font-bold text-slate-400 mb-1.5">
                        <span>{item.label}</span>
                        <span className="text-slate-300">{item.width}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden shadow-inner">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: item.width }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Comparison Section */}
        <div className="w-full mb-10 border border-slate-800 rounded-3xl overflow-hidden bg-slate-900 relative shadow-2xl">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.1),transparent_60%)] pointer-events-none" />
          <div className="px-8 md:px-12 py-12 relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
              <div className="max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-400 mb-4">Enterprise Grade vs Local</p>
                <h2 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">CleanFlow vs manual sheets</h2>
                <p className="text-slate-400 leading-relaxed font-medium text-lg">
                  Stop wrestling with nested IF statements and crashing workbooks. CleanFlow is built to process identical validation models across data at massive scale.
                </p>
              </div>
              <button
                onClick={startValidation}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-sky-500 text-slate-950 font-black hover:bg-sky-400 transition-colors w-full lg:w-auto shadow-[0_0_20px_rgba(56,189,248,0.3)] hover:shadow-[0_0_30px_rgba(56,189,248,0.5)]"
              >
                Benchmark the Speed <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="p-6 md:p-10 bg-slate-950/50 border-t border-slate-800 relative z-10">
            <div className="grid grid-cols-4 gap-4 items-center text-sm mb-6">
              <div className="hidden md:block" />
              <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 text-sky-400 px-4 py-3 font-black text-center uppercase tracking-wider text-xs">CleanFlow</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 font-bold text-center text-slate-500">Excel</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 font-bold text-center text-slate-500">Google Sheets</div>
            </div>

            <div className="space-y-4 text-sm font-medium">
              {[
                { label: 'Reusable pipeline state preservation', cf: 'full', excel: 'limited', sheets: 'limited' },
                { label: 'Real-time rule failure breakdown isolation', cf: 'full', excel: 'limited', sheets: 'limited' },
                { label: 'Audit trails & historical logs', cf: 'full', excel: 'no', sheets: 'no' },
                { label: 'Export multi-modal output simultaneously', cf: 'full', excel: 'limited', sheets: 'limited' },
                { label: 'Handles multi-million row files instantly', cf: 'full', excel: 'limited', sheets: 'limited' }
              ].map((row) => {
                const Cell = ({ value }) => {
                  if (value === 'full') {
                    return (
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                        <Check size={20} className="text-emerald-400" />
                      </span>
                    );
                  }
                  if (value === 'no') {
                    return (
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-800 border border-slate-700 text-slate-600 font-bold">
                        —
                      </span>
                    );
                  }
                  return (
                    <span className="inline-flex items-center justify-center px-3 h-8 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-bold uppercase tracking-wider">
                      Basic
                    </span>
                  );
                };

                return (
                  <div key={row.label} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center rounded-2xl border border-slate-800 bg-slate-900/50 p-5 hover:bg-slate-800/50 transition-colors">
                    <div className="text-slate-300 font-bold md:col-span-1">{row.label}</div>
                    <div className="flex md:justify-center items-center md:col-span-1">
                      <Cell value={row.cf} />
                    </div>
                    <div className="flex md:justify-center items-center md:col-span-1">
                      <Cell value={row.excel} />
                    </div>
                    <div className="flex md:justify-center items-center md:col-span-1">
                      <Cell value={row.sheets} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="w-full text-center bg-gradient-to-br from-emerald-600 to-sky-600 text-white p-16 rounded-[40px] shadow-2xl relative overflow-hidden mb-10">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">Ready to activate your data?</h2>
            <p className="text-emerald-50 max-w-2xl mx-auto mb-10 text-xl font-medium">Join leading data engineers and operators using CleanFlow to streamline their quality and cleaning pipelines.</p>
            <button
              onClick={startValidation}
              className="px-10 py-5 bg-slate-950 text-white rounded-2xl font-black hover:bg-black hover:-translate-y-1 hover:shadow-xl transition-all inline-flex items-center gap-3 text-lg"
            >
              Initialize Workspace <Zap className="text-emerald-400 flex-shrink-0" fill="currentColor" size={20} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}