import React from 'react';
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
  ShieldCheck,
  Shuffle,
  Sparkles,
  Zap,
  AlertTriangle,
  Star,
  TrendingUp,
  Lock,
  Layers
} from 'lucide-react';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: 'easeOut' }
});

export default function HomePage({ startValidation, onViewPricing, handleFeatureAccess }) {
  const modules = [
    {
      title: 'Quality Validation',
      icon: <FileCheck size={20} className="text-blue-600" />,
      iconBg: 'bg-blue-50 border-blue-100',
      stat: '50+ rule types',
      statColor: 'text-blue-600 bg-blue-50 border-blue-100',
      desc: 'Catch nulls, format drift, and invalid values instantly.',
      accent: 'hover:border-blue-300 hover:shadow-blue-100/80',
      cta: () => handleFeatureAccess('validate')
    },
    {
      title: 'Data Enrichment',
      icon: <Sparkles size={20} className="text-sky-600" />,
      iconBg: 'bg-sky-50 border-sky-100',
      stat: 'Provider-ready',
      statColor: 'text-sky-600 bg-sky-50 border-sky-100',
      desc: 'Append missing attributes to make records more complete.',
      accent: 'hover:border-sky-300 hover:shadow-sky-100/80',
      cta: () => handleFeatureAccess('enrichment')
    },
    {
      title: 'Schema Mapping',
      icon: <Shuffle size={20} className="text-purple-600" />,
      iconBg: 'bg-purple-50 border-purple-100',
      stat: 'Auto-match fields',
      statColor: 'text-purple-600 bg-purple-50 border-purple-100',
      desc: 'Standardize headers and map to target formats fast.',
      accent: 'hover:border-purple-300 hover:shadow-purple-100/80',
      cta: () => handleFeatureAccess('mapper')
    },
    {
      title: 'Web Scraping',
      icon: <Globe size={20} className="text-amber-600" />,
      iconBg: 'bg-amber-50 border-amber-100',
      stat: 'Template-driven',
      statColor: 'text-amber-600 bg-amber-50 border-amber-100',
      desc: 'Extract clean tables from websites with visual previews.',
      accent: 'hover:border-amber-300 hover:shadow-amber-100/80',
      cta: () => handleFeatureAccess('scraper')
    },
    {
      title: 'Data Matching',
      icon: <GitMerge size={20} className="text-rose-600" />,
      iconBg: 'bg-rose-50 border-rose-100',
      stat: 'Fuzzy matching',
      statColor: 'text-rose-600 bg-rose-50 border-rose-100',
      desc: 'Identify duplicate or related entities across datasets.',
      accent: 'hover:border-rose-300 hover:shadow-rose-100/80',
      cta: () => handleFeatureAccess('matching')
    },
    {
      title: 'AI Visualizer',
      icon: <BarChart3 size={20} className="text-violet-600" />,
      iconBg: 'bg-violet-50 border-violet-100',
      stat: 'Auto-generated',
      statColor: 'text-violet-600 bg-violet-50 border-violet-100',
      desc: 'Instantly generate stunning chart dashboards from any dataset.',
      accent: 'hover:border-violet-300 hover:shadow-violet-100/80',
      cta: () => handleFeatureAccess('visualizer')
    }
  ];

  const comparison = [
    { label: 'Reusable pipeline state preservation', cf: 'full', excel: 'limited', sheets: 'limited' },
    { label: 'Real-time rule failure breakdown isolation', cf: 'full', excel: 'limited', sheets: 'limited' },
    { label: 'Audit trails & historical logs', cf: 'full', excel: 'no', sheets: 'no' },
    { label: 'Export multi-modal output simultaneously', cf: 'full', excel: 'limited', sheets: 'limited' },
    { label: 'Handles multi-million row files instantly', cf: 'full', excel: 'limited', sheets: 'limited' }
  ];

  const Cell = ({ value }) => {
    if (value === 'full') return (
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200">
        <Check size={18} className="text-emerald-600" />
      </span>
    );
    if (value === 'no') return (
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-50 border border-slate-200 text-slate-400 font-bold text-base">—</span>
    );
    return (
      <span className="inline-flex items-center justify-center px-3 h-8 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold uppercase tracking-wider">Basic</span>
    );
  };

  return (
    <>
      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative w-full pt-12 pb-20 md:pt-20 md:pb-28 px-6 overflow-hidden">
        {/* Subtle background */}
        <div className="pointer-events-none absolute inset-0 bg-slate-50/30" />

        <div className="relative z-10 max-w-[1200px] mx-auto grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          
          {/* Left Column Text */}
          <div className="flex flex-col items-start text-left max-w-xl">
            <motion.div {...fadeUp(0)}>
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-200/50 bg-blue-50/80 px-3.5 py-1.5 text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-8 shadow-sm">
                CleanFlow v2.5
              </span>
            </motion.div>

            <motion.h1
              {...fadeUp(0.08)}
              className="mb-6 text-5xl font-medium leading-[1.08] tracking-[-0.03em] text-[#1c1c1c] md:text-6xl lg:text-[68px]"
            >
              Clean &amp; Transform
              <br />
              Your Data.
            </motion.h1>

            <motion.p
              {...fadeUp(0.16)}
              className="mb-10 text-[17px] font-normal leading-relaxed text-slate-500 max-w-[420px]"
            >
              The most accurate data validation and enrichment platform. 50+ rules, 10+ integrations, sub-250ms streaming.
            </motion.p>

            <motion.div
              {...fadeUp(0.24)}
              className="flex items-center gap-4"
            >
              <button
                onClick={startValidation}
                className="rounded-full bg-[#1c1c1c] shadow-[0_4px_14px_0_rgb(0,0,0,0.39)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.23)] hover:bg-[#000000] px-8 py-3.5 text-[16px] font-medium text-white transition-all hover:scale-[1.02]"
              >
                Sign up
              </button>
            </motion.div>

            <motion.div {...fadeUp(0.32)} className="mt-14 flex items-center justify-start text-xs font-bold tracking-[0.2em] uppercase text-slate-400">
               Trusted by leading teams
            </motion.div>
          </div>

          {/* Right Column AI Snapshot UI */}
          <motion.div {...fadeUp(0.2)} className="relative w-full max-w-[600px] mx-auto lg:ml-auto">
            {/* Soft decorative background rings */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] rounded-[40px] bg-blue-100/30 blur-3xl -z-10" />

            <div className="rounded-[28px] border-[1.5px] border-blue-100 bg-blue-50/50 p-2.5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md">
                <div className="rounded-[20px] bg-white border border-slate-100/80 shadow-sm overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="flex items-center gap-2 p-4 border-b border-slate-50 bg-slate-50/50">
                        <div className="h-2.5 w-2.5 rounded-full bg-slate-300"></div>
                        <div className="h-2.5 w-2.5 rounded-full bg-slate-200"></div>
                        <div className="h-2.5 w-2.5 rounded-full bg-slate-200"></div>
                        <div className="ml-2 flex items-center gap-2 text-xs font-bold text-slate-700">
                          <BarChart3 size={14} className="text-violet-500" />
                          AI Visualizer Workspace
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-5 flex flex-col gap-3">
                        {/* Mock Insight 1 */}
                        <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 bg-white hover:border-violet-200 hover:shadow-md cursor-pointer transition-all shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                                    <BarChart3 strokeWidth={2.5} size={20} />
                                </div>
                                <div>
                                    <p className="text-[14px] font-bold text-[#1c1c1c]">Employee Count by Dept</p>
                                    <p className="text-[12px] font-medium text-slate-400 mt-0.5">Distribution analysis • 1.2k rows</p>
                                </div>
                            </div>
                            <ChevronRight size={18} className="text-slate-300" />
                        </div>

                        {/* Mock Insight 2 */}
                        <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 bg-white hover:border-emerald-200 hover:shadow-md cursor-pointer transition-all shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                                    <TrendingUp strokeWidth={2.5} size={20} />
                                </div>
                                <div>
                                    <p className="text-[14px] font-bold text-[#1c1c1c]">Average Salary Trends</p>
                                    <p className="text-[12px] font-medium text-slate-400 mt-0.5">Time-series plotting • 5 yrs</p>
                                </div>
                            </div>
                            <ChevronRight size={18} className="text-slate-300" />
                        </div>

                        {/* Collapsed Rows */}
                        <div className="mt-2 flex flex-col gap-1">
                          <div className="flex items-center justify-between p-3 border-b border-slate-50 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                              <span className="text-[13px] font-semibold text-slate-600 flex items-center gap-3">
                                <Layers size={15} className="text-slate-400"/> Status Proportions
                              </span>
                              <ChevronRight size={15} className="text-slate-300" />
                          </div>
                          <div className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                              <span className="text-[13px] font-semibold text-slate-600 flex items-center gap-3">
                                <Database size={15} className="text-slate-400"/> Geographic Heatmap
                              </span>
                              <ChevronRight size={15} className="text-slate-300" />
                          </div>
                        </div>
                    </div>
                </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Modules Grid ───────────────────────────────────── */}
      <section className="w-full max-w-7xl mx-auto px-6 pb-20">
        <motion.div {...fadeUp(0)} className="text-center mb-12">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-emerald-600">Modules At A Glance</p>
          <h2 className="mb-3 text-2xl font-black text-slate-900 md:text-3xl">One platform, unlimited data workflows</h2>
          <p className="mx-auto max-w-2xl text-base font-medium text-slate-500">
            From data quality checks to enrichment and extraction, each module is purpose-built and connected to the same high-performance engine.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((m, i) => (
            <motion.button
              key={m.title}
              {...fadeUp(i * 0.05)}
              onClick={m.cta}
              className={`group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg ${m.accent}`}
            >
              <div className="mb-5 flex items-center justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${m.iconBg} transition-transform group-hover:scale-110`}>
                  {m.icon}
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${m.statColor}`}>
                  {m.stat}
                </span>
              </div>
              <h3 className="mb-2 text-base font-bold text-slate-900 transition-colors group-hover:text-emerald-600">{m.title}</h3>
              <p className="mb-5 flex-1 text-sm font-medium leading-relaxed text-slate-500">{m.desc}</p>
              <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-emerald-600 group-hover:gap-2.5 transition-all">
                Launch Module <ChevronRight size={14} />
              </span>
            </motion.button>
          ))}
        </div>
      </section>

      {/* ── Validation Snapshot ────────────────────────────── */}
      <section className="w-full max-w-7xl mx-auto px-6 pb-20">
        <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          {/* Decorative gradient accent */}
          <div className="pointer-events-none absolute top-0 right-0 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 rounded-full bg-sky-400/10 blur-3xl" />

          <div className="relative z-10 grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
                <BarChart3 size={14} /> Data Validation Snapshot
              </p>
              <h2 className="mb-4 text-3xl font-black tracking-tight text-slate-900">Understand data quality instantly</h2>
              <p className="mb-6 text-base font-medium leading-relaxed text-slate-500">
                CleanFlow highlights invalid records, missing fields, and pattern failures with clear visual summaries so teams can act exactly where they need to.
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                  <ShieldCheck className="shrink-0 text-emerald-600 mt-0.5" size={18} />
                  <p className="text-sm font-medium text-slate-700"><span className="font-bold text-emerald-700">Validity score tracking</span> gives you a continuous pulse on overall dataset health.</p>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4">
                  <AlertTriangle className="shrink-0 text-amber-600 mt-0.5" size={18} />
                  <p className="text-sm font-medium text-slate-700"><span className="font-bold text-amber-700">Deep rule failure insights</span> isolate the top anomalies down to the specific column.</p>
                </div>
              </div>
            </div>

            {/* Mock report card */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-inner">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Report Output</h3>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">86% Healthy</span>
              </div>

              <div className="mb-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Total Load</p>
                  <p className="text-2xl font-black tracking-tight text-slate-900">12,540</p>
                </div>
                <div className="rounded-xl border border-red-100 bg-red-50 p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-1.5">Flagged</p>
                  <p className="text-2xl font-black tracking-tight text-red-600">1,754</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Critical Failure Rates</p>
                <div className="space-y-4">
                  {[
                    { label: 'Email Format RegExp', width: '78%', color: 'bg-red-400' },
                    { label: 'Phone Number Sequence', width: '54%', color: 'bg-orange-400' },
                    { label: 'ZIP Code Boundary', width: '33%', color: 'bg-amber-400' }
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1.5">
                        <span>{item.label}</span>
                        <span className="font-bold text-slate-700">{item.width}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full`} style={{ width: item.width }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Comparison Table ───────────────────────────────── */}
      <section className="w-full max-w-7xl mx-auto px-6 pb-20">
        <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          {/* Accent */}
          <div className="pointer-events-none absolute top-0 right-0 w-96 h-96 bg-sky-100/50 rounded-full blur-3xl" />

          <div className="relative z-10 px-6 py-8 md:px-10 md:py-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-sky-600">Enterprise Grade vs Local</p>
                <h2 className="mb-3 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">CleanFlow vs manual sheets</h2>
                <p className="text-base font-medium leading-relaxed text-slate-500">
                  Stop wrestling with nested IF statements and crashing workbooks. CleanFlow is built to process identical validation models across data at massive scale.
                </p>
              </div>
              <button
                onClick={startValidation}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-sky-500/20 transition-all hover:bg-sky-600 hover:-translate-y-0.5 lg:w-auto"
              >
                Benchmark the Speed <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="relative z-10 border-t border-slate-100 bg-slate-50/60 p-5 md:p-8">
            <div className="mb-5 grid grid-cols-4 items-center gap-3 text-sm">
              <div className="hidden md:block" />
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-center text-sky-700">
                <span className="uncial-antiqua-regular text-[18px] leading-none">Cleanflow</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center font-bold text-slate-500">Excel</div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center font-bold text-slate-500">Google Sheets</div>
            </div>

            <div className="space-y-3 text-sm font-medium">
              {comparison.map((row) => (
                <div key={row.label} className="grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-white p-4 transition-colors hover:border-slate-200 hover:shadow-sm md:grid-cols-4 md:items-center">
                  <div className="text-slate-700 font-semibold md:col-span-1">{row.label}</div>
                  <div className="flex md:justify-center items-center"><Cell value={row.cf} /></div>
                  <div className="flex md:justify-center items-center"><Cell value={row.excel} /></div>
                  <div className="flex md:justify-center items-center"><Cell value={row.sheets} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────── */}
      <section className="w-full max-w-7xl mx-auto px-6 pb-16">
        <div className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#121413_0%,#181b1a_52%,#0b0d0c_100%)] p-10 text-center shadow-[0_30px_80px_rgba(0,0,0,0.18)] md:p-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),transparent_58%)]" />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/45 to-transparent opacity-80" />
          <div className="relative z-10">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">
              <TrendingUp size={12} /> Trusted by data teams worldwide
            </span>
            <h2 className="mb-4 text-3xl font-black tracking-tight text-white md:text-4xl">Ready to activate your data?</h2>
            <p className="mx-auto mb-8 max-w-lg text-base font-medium text-slate-400">
              Join leading data engineers and operators using CleanFlow to streamline their quality and cleaning pipelines.
            </p>
            <button
              onClick={startValidation}
              className="inline-flex items-center gap-3 rounded-xl bg-emerald-500 px-9 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all hover:bg-emerald-400 hover:-translate-y-0.5"
            >
              Initialize Workspace <Zap className="flex-shrink-0" fill="currentColor" size={18} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
