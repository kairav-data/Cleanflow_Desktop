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
      <div className="relative mb-12 w-full">
        {/* Ambient Dark Glows */}
        <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-full max-w-[920px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(52,211,153,0.14),transparent_70%)]" />

        <div className="relative z-10 mt-12 flex min-h-[380px] flex-col justify-center overflow-visible bg-transparent md:mt-16 md:min-h-[52vh]">
          <div className="relative mx-auto w-full max-w-4xl px-6">
            <motion.div
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
                className="mb-6 inline-flex items-center justify-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.18)]"
              >
                <Sparkles size={16} /> The New CleanFlow v2.5
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
                className="mb-5 text-5xl font-black leading-[1.02] tracking-tight text-white md:text-6xl"
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
                className="mb-8 max-w-2xl text-base font-medium leading-relaxed text-slate-400 md:text-lg"
              >
                Validate, enrich, and transform enterprise data with absolute confidence. Millions of records, all in one platform.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
                className="flex w-full flex-col items-center justify-center gap-4 sm:w-auto sm:flex-row"
              >
                <button
                  onClick={startValidation}
                  className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-8 py-4 text-base font-semibold text-slate-950 shadow-[0_0_24px_rgba(255,255,255,0.14)] transition-all hover:bg-slate-100 sm:w-auto"
                >
                  Start Execution Engine <ArrowRight size={18} className="text-emerald-600" />
                </button>
                <button
                  onClick={onViewPricing}
                  className="w-full rounded-xl border border-slate-700 px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-slate-900/80 sm:w-auto"
                >
                  Explore Pricing
                </button>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6">
        {/* Modules Overview Section */}
        <div className="relative mb-24 w-full">
          <div className="absolute inset-0 -z-10 rounded-[32px] bg-slate-900 opacity-45 blur-3xl" />

          <div className="mb-10 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-emerald-500">Modules At A Glance</p>
            <h2 className="mb-4 text-2xl font-black text-white md:text-3xl">One platform, unlimited data workflows</h2>
            <p className="mx-auto max-w-2xl text-base font-medium text-slate-400">
              From data quality checks to enrichment and extraction, each module is purpose-built and connected to the same high-performance engine.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
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
                className={`group flex h-full flex-col rounded-xl border p-5 text-left backdrop-blur-md transition-all hover:-translate-y-0.5 ${m.tone}`}
              >
                <div className="mb-4 flex min-h-[38px] items-center justify-between">
                  <div className="rounded-lg border border-slate-700 bg-slate-800 p-2 shadow-inner transition-transform group-hover:scale-105">{m.icon}</div>
                  <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">
                    {m.stat}
                  </span>
                </div>
                <h3 className="mb-2 min-h-[40px] text-base font-bold text-white transition-colors group-hover:text-emerald-400">{m.title}</h3>
                <p className="mb-5 min-h-[60px] text-sm font-medium leading-relaxed text-slate-400">{m.desc}</p>
                <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-emerald-500 group-hover:text-emerald-400">
                  Launch Module <ChevronRight size={14} />
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Validation Visual Section */}
        <div className="relative mb-16 w-full overflow-hidden rounded-[28px] border border-slate-800 bg-slate-900 p-6 shadow-xl md:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(16,185,129,0.15),transparent_60%)]" />
          <div className="relative z-10 grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
            <div>
              <p className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">
                <BarChart3 size={16} /> Data Validation Snapshot
              </p>
              <h2 className="mb-4 text-3xl font-black tracking-tight text-white">Understand data quality instantly</h2>
              <p className="mb-6 text-base font-medium leading-relaxed text-slate-400">
                CleanFlow highlights invalid records, missing fields, and pattern failures with clear visual summaries so teams can act exactly where they need to.
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-lg border border-slate-700/50 bg-slate-800/50 p-3.5">
                  <ShieldCheck className="shrink-0 text-emerald-400" size={20} />
                  <p className="text-sm font-medium text-slate-300"><span className="font-bold text-emerald-200">Validity score tracking</span> gives you a continuous pulse on overall dataset health.</p>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-slate-700/50 bg-slate-800/50 p-3.5">
                  <AlertTriangle className="shrink-0 text-amber-400" size={20} />
                  <p className="text-sm font-medium text-slate-300"><span className="font-bold text-amber-200">Deep rule failure insights</span> isolate the top anomalies down to the specific column.</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-xl shadow-emerald-900/20">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-base font-bold text-white uppercase tracking-wider">Report Output</h3>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-400">86% Healthy Validation</span>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Total Load</p>
                  <p className="text-2xl font-black tracking-tight text-white">12,540</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Flagged</p>
                  <p className="text-2xl font-black tracking-tight text-red-400">1,754</p>
                </div>
              </div>

              <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-5">
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
        <div className="relative mb-8 w-full overflow-hidden rounded-[28px] border border-slate-800 bg-slate-900 shadow-xl">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.1),transparent_60%)] pointer-events-none" />
          <div className="relative z-10 px-6 py-8 md:px-8 md:py-9">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-sky-400">Enterprise Grade vs Local</p>
                <h2 className="mb-4 text-3xl font-black tracking-tight text-white md:text-4xl">CleanFlow vs manual sheets</h2>
                <p className="text-base font-medium leading-relaxed text-slate-400">
                  Stop wrestling with nested IF statements and crashing workbooks. CleanFlow is built to process identical validation models across data at massive scale.
                </p>
              </div>
              <button
                onClick={startValidation}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_18px_rgba(56,189,248,0.24)] transition-colors hover:bg-sky-400 lg:w-auto"
              >
                Benchmark the Speed <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="relative z-10 border-t border-slate-800 bg-slate-950/50 p-5 md:p-8">
            <div className="mb-5 grid grid-cols-4 items-center gap-3 text-sm">
              <div className="hidden md:block" />
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2.5 text-center text-xs font-black uppercase tracking-[0.16em] text-sky-400">CleanFlow</div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-center font-bold text-slate-500">Excel</div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-center font-bold text-slate-500">Google Sheets</div>
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
                  <div key={row.label} className="grid grid-cols-1 gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 transition-colors hover:bg-slate-800/50 md:grid-cols-4 md:items-center">
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
        <div className="relative mb-10 w-full overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-600 to-sky-600 p-10 text-center text-white shadow-xl md:p-12">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
          <div className="relative z-10">
            <h2 className="mb-5 text-3xl font-black tracking-tight md:text-4xl">Ready to activate your data?</h2>
            <p className="mx-auto mb-8 max-w-2xl text-base font-medium text-emerald-50">Join leading data engineers and operators using CleanFlow to streamline their quality and cleaning pipelines.</p>
            <button
              onClick={startValidation}
              className="inline-flex items-center gap-3 rounded-xl bg-slate-950 px-8 py-4 text-base font-semibold text-white transition-all hover:bg-black"
            >
              Initialize Workspace <Zap className="text-emerald-400 flex-shrink-0" fill="currentColor" size={20} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
