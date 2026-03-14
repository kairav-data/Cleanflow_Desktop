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
  const [comingSoon, setComingSoon] = useState(null);

  useEffect(() => {
    if (!comingSoon) return;
    const t = setTimeout(() => setComingSoon(null), 2200);
    return () => clearTimeout(t);
  }, [comingSoon]);

  return (
    <>
      <div className="w-full mb-16">
        <div className="relative overflow-visible min-h-[420px] md:min-h-[500px] bg-transparent">
          <div className="absolute inset-y-0 right-0 w-[58%] hidden md:block">
            <div className="absolute inset-0 flex items-center justify-center px-6">
              <div className="relative w-full max-w-[520px]">
                <div
                  className="absolute -inset-6 rounded-3xl blur-2xl opacity-70"
                  style={{
                    background:
                      'radial-gradient(420px 220px at 35% 25%, rgba(15,23,42,0.10), transparent 60%), radial-gradient(420px 240px at 70% 65%, rgba(34,211,238,0.14), transparent 62%)'
                  }}
                />

                <div className="relative rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-sm shadow-[0_18px_50px_rgba(15,23,42,0.10)] overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-white to-slate-50">
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Workflow</p>
                    <div className="mt-2 flex items-center justify-between">
                      <h3 className="text-lg font-black text-slate-900">Upload → Validate → Transform → Export</h3>
                      <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-900 text-white">Live loop</span>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="relative">
                      <div className="absolute left-5 right-5 top-1/2 -translate-y-1/2 h-[2px] bg-slate-200 rounded-full" />
                      <MotionDiv
                        className="absolute left-5 top-1/2 -translate-y-1/2 h-[2px] rounded-full"
                        style={{
                          background: 'linear-gradient(90deg, rgba(15,23,42,0.0), rgba(15,23,42,0.92), rgba(34,211,238,0.0))'
                        }}
                        animate={{ x: ['0%', '78%', '0%'] }}
                        transition={{ duration: 5.8, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <MotionDiv
                        className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-slate-900 shadow-[0_0_0_6px_rgba(34,211,238,0.10),0_0_22px_rgba(34,211,238,0.22)]"
                        animate={{ x: ['0%', '78%', '0%'] }}
                        transition={{ duration: 5.8, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ left: '20px' }}
                      />

                      <div className="grid grid-cols-4 gap-3">
                        {[
                          {
                            title: 'Upload',
                            desc: 'CSV, Excel',
                            icon: <Database size={18} className="text-slate-900" />
                          },
                          {
                            title: 'Validate',
                            desc: 'Rules & checks',
                            icon: <ShieldCheck size={18} className="text-slate-900" />
                          },
                          {
                            title: 'Transform',
                            desc: 'Fix + map',
                            icon: <Shuffle size={18} className="text-slate-900" />
                          },
                          {
                            title: 'Export',
                            desc: 'Clean output',
                            icon: <ArrowRight size={18} className="text-slate-900" />
                          }
                        ].map((step) => (
                          <div key={step.title} className="relative">
                            <div className="mx-auto w-10 h-10 rounded-2xl border border-slate-200 bg-white flex items-center justify-center shadow-sm">
                              {step.icon}
                            </div>
                            <div className="mt-3 text-center">
                              <p className="text-sm font-bold text-slate-900">{step.title}</p>
                              <p className="text-xs text-slate-600">{step.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-3">
                      {[
                        { k: 'Rules', v: '50+', tone: 'bg-slate-50 border-slate-200' },
                        { k: 'Outputs', v: 'Clean + Errors', tone: 'bg-slate-50 border-slate-200' },
                        { k: 'History', v: 'Auditable runs', tone: 'bg-slate-50 border-slate-200' }
                      ].map((s) => (
                        <div key={s.k} className={`p-3 rounded-2xl border ${s.tone}`}>
                          <p className="text-[11px] text-slate-500 font-semibold">{s.k}</p>
                          <p className="text-sm font-black text-slate-900 mt-0.5">{s.v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

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
                className="text-5xl md:text-6xl font-bold text-slate-900 mb-4 leading-tight"
              >
                Clean & Transform
                <br />
                Your Data
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                className="text-lg md:text-xl text-slate-600 mb-10 leading-relaxed"
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
                  className="px-6 py-3 bg-slate-900 text-white rounded-md font-semibold hover:bg-slate-800 transition-colors"
                >
                  Get Started
                </button>
                <button
                  onClick={onViewPricing}
                  className="px-6 py-3 border border-slate-300 text-slate-900 rounded-md font-medium hover:bg-slate-50 transition-colors"
                >
                  View Pricing
                </button>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="px-6 max-w-7xl mx-auto">
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
                cta: () => handleFeatureAccess('enrichment'),
                disabled: true
              },
              {
                title: "Schema Mapping",
                icon: <Shuffle size={20} className="text-cyan-700" />,
                tone: "bg-cyan-50 border-cyan-100",
                stat: "Auto-match fields",
                desc: "Standardize headers and map to target formats fast.",
                cta: () => handleFeatureAccess('mapper'),
                disabled: true
              },
              {
                title: "Web Scraping",
                icon: <Globe size={20} className="text-indigo-700" />,
                tone: "bg-indigo-50 border-indigo-100",
                stat: "Template-driven",
                desc: "Extract clean tables from websites with previews.",
                cta: () => handleFeatureAccess('scraper'),
                disabled: true
              },
              {
                title: "Data Matching",
                icon: <GitMerge size={20} className="text-purple-700" />,
                tone: "bg-purple-50 border-purple-100",
                stat: "Fuzzy record linking",
                desc: "Identify duplicate or related entities across datasets.",
                cta: () => handleFeatureAccess('matching'),
                disabled: true
              }
            ].map((m) => (
              <button
                key={m.title}
                onClick={() => {
                  if (m.disabled) {
                    setComingSoon(m.title);
                    return;
                  }
                  m.cta();
                }}
                className={`text-left p-5 rounded-xl border transition-all h-full flex flex-col ${m.disabled ? 'opacity-50 cursor-not-allowed grayscale bg-slate-50 border-slate-200' : `hover:-translate-y-0.5 hover:shadow-md ${m.tone}`}`}
              >
                <div className="flex items-center justify-between mb-3 min-h-[42px]">
                  <div className="p-2 rounded-lg bg-white border border-slate-200">{m.icon}</div>
                  <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-700">
                    {m.stat}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2 min-h-[48px]">{m.title}</h3>
                <p className="text-sm text-slate-600 mb-4 leading-relaxed min-h-[66px]">{m.desc}</p>
                <span className={`inline-flex items-center gap-1 text-sm font-semibold mt-auto ${m.disabled ? 'text-slate-500' : 'text-slate-900'}`}>
                  {m.disabled ? 'Coming soon' : 'Open module'} <ChevronRight size={14} />
                </span>
              </button>
            ))}
          </div>
        </div>

        {comingSoon && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120]">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xl px-4 py-3 flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-900 text-white font-black">
                !
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{comingSoon}</p>
                <p className="text-xs text-slate-600">Coming soon</p>
              </div>
            </div>
          </div>
        )}

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

        {/* Schema Mapping Snapshot */}
        <div className="w-full mb-20 border border-slate-200 rounded-2xl p-8 md:p-10 bg-[radial-gradient(circle_at_15%_20%,rgba(14,165,233,0.10),transparent_55%),linear-gradient(to_bottom_right,#ffffff,#f8fafc)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                <Shuffle size={14} /> Schema Mapping Snapshot
              </p>
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Turn messy headers into a clean schema</h2>
              <p className="text-slate-600 leading-relaxed mb-6">
                Auto-suggest mappings, spot conflicts, and export a consistent output format across teams and vendors.
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="text-emerald-600 mt-0.5" size={18} />
                  <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Suggested matches</span> speed up field alignment.</p>
                </div>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-amber-600 mt-0.5" size={18} />
                  <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Conflict warnings</span> catch duplicates and missing targets.</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold text-slate-900">Mapping Preview</h3>
                <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-100">Auto-mapped: 12/15</span>
              </div>
              <div className="space-y-3">
                {[
                  { left: 'cust_email', right: 'email', badge: 'Match' },
                  { left: 'phone_no', right: 'phone', badge: 'Match' },
                  { left: 'zip', right: 'postal_code', badge: 'Match' },
                  { left: 'state_name', right: 'state', badge: 'Review' }
                ].map((row) => (
                  <div key={`${row.left}:${row.right}`} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">Source</p>
                      <p className="text-sm font-semibold text-slate-900 truncate">{row.left}</p>
                    </div>
                    <ChevronRight className="text-slate-400 shrink-0" size={16} />
                    <div className="min-w-0 text-right">
                      <p className="text-xs text-slate-500">Target</p>
                      <p className="text-sm font-semibold text-slate-900 truncate">{row.right}</p>
                    </div>
                    <span className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full border ${row.badge === 'Match' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-900 border-amber-100'}`}>
                      {row.badge}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => handleFeatureAccess('mapper')}
                className="w-full mt-5 px-4 py-3 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors inline-flex items-center justify-center gap-2"
              >
                Map your schema <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Enrichment Snapshot */}
        <div className="w-full mb-20 border border-slate-200 rounded-2xl p-8 md:p-10 bg-[radial-gradient(circle_at_80%_25%,rgba(16,185,129,0.10),transparent_55%),linear-gradient(to_bottom_right,#ffffff,#f8fafc)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                <Sparkles size={14} /> Enrichment Snapshot
              </p>
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Fill gaps without guessing</h2>
              <p className="text-slate-600 leading-relaxed mb-6">
                Enrich incomplete records with consistent attributes and track coverage before you export to downstream systems.
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="text-emerald-600 mt-0.5" size={18} />
                  <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Coverage metrics</span> show how much you improved.</p>
                </div>
                <div className="flex items-start gap-3">
                  <RefreshCw className="text-blue-700 mt-0.5" size={18} />
                  <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Provider-ready output</span> keeps formatting consistent.</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold text-slate-900">Enrichment Preview</h3>
                <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100">+3 fields</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Coverage</p>
                  <p className="text-lg font-bold text-slate-900">72%</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">New Values</p>
                  <p className="text-lg font-bold text-emerald-700">9,014</p>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { field: 'Company', before: '—', after: 'Acme Corp' },
                  { field: 'Industry', before: '—', after: 'Manufacturing' },
                  { field: 'Website', before: '—', after: 'acme.com' }
                ].map((r) => (
                  <div key={r.field} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-xs font-semibold text-slate-900 mb-1">{r.field}</p>
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
                      <span className="truncate">Before: {r.before}</span>
                      <span className="truncate">After: {r.after}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => handleFeatureAccess('enrichment')}
                className="w-full mt-5 px-4 py-3 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors inline-flex items-center justify-center gap-2"
              >
                Enrich your data <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Web Scraping Snapshot */}
        <div className="w-full mb-20 border border-slate-200 rounded-2xl p-8 md:p-10 bg-[radial-gradient(circle_at_20%_70%,rgba(99,102,241,0.10),transparent_55%),linear-gradient(to_bottom_right,#ffffff,#f8fafc)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                <Globe size={14} /> Web Scraping Snapshot
              </p>
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Extract structured data from any page</h2>
              <p className="text-slate-600 leading-relaxed mb-6">
                Preview selectors, validate outputs, and ship a clean table without writing a scraper from scratch.
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Search className="text-slate-900 mt-0.5" size={18} />
                  <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Template-driven</span> extraction for repeatable sources.</p>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="text-emerald-600 mt-0.5" size={18} />
                  <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Output checks</span> ensure the table stays consistent.</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold text-slate-900">Preview Table</h3>
                <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">Rows: 120</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="grid grid-cols-3 bg-slate-50 text-xs font-semibold text-slate-700">
                  <div className="p-2 border-r border-slate-200">Name</div>
                  <div className="p-2 border-r border-slate-200">Price</div>
                  <div className="p-2">Rating</div>
                </div>
                {[
                  { a: 'Widget Pro', b: '$49', c: '4.6' },
                  { a: 'Widget Mini', b: '$19', c: '4.2' },
                  { a: 'Widget Max', b: '$79', c: '4.8' }
                ].map((r) => (
                  <div key={r.a} className="grid grid-cols-3 text-xs text-slate-700">
                    <div className="p-2 border-t border-r border-slate-200 truncate">{r.a}</div>
                    <div className="p-2 border-t border-r border-slate-200">{r.b}</div>
                    <div className="p-2 border-t border-slate-200">{r.c}</div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => handleFeatureAccess('scraper')}
                className="w-full mt-5 px-4 py-3 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors inline-flex items-center justify-center gap-2"
              >
                Build a scraper <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Comparison Section */}
        <div className="w-full mb-20 border border-slate-200 rounded-2xl overflow-hidden bg-white">
          <div className="px-8 md:px-10 py-10 bg-[radial-gradient(circle_at_20%_15%,rgba(15,23,42,0.06),transparent_55%),radial-gradient(circle_at_90%_35%,rgba(34,211,238,0.10),transparent_55%),linear-gradient(to_bottom_right,#ffffff,#f8fafc)]">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div className="max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500 mb-3">Comparison</p>
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">CleanFlow vs spreadsheets</h2>
                <p className="text-slate-600 leading-relaxed">
                  Excel and Google Sheets are great for quick analysis. CleanFlow is built for repeatable, auditable data quality workflows at scale.
                </p>
              </div>
              <button
                onClick={startValidation}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors w-full lg:w-auto"
              >
                Try it on a dataset <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <div className="grid grid-cols-4 gap-3 items-center text-sm">
              <div className="hidden md:block" />
              <div className="rounded-xl border border-slate-200 bg-slate-900 text-white px-4 py-3 font-bold text-center">CleanFlow</div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-center text-slate-900">Excel</div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-center text-slate-900">Google Sheets</div>
            </div>

            <div className="mt-4 space-y-3">
              {[
                { label: 'Reusable validation rules', cf: 'full', excel: 'limited', sheets: 'limited' },
                { label: 'Rule failure breakdown by column', cf: 'full', excel: 'limited', sheets: 'limited' },
                { label: 'Audit trail + history of runs', cf: 'full', excel: 'no', sheets: 'no' },
                { label: 'Exports (clean + error files)', cf: 'full', excel: 'limited', sheets: 'limited' },
                { label: 'Team workflows & workspaces', cf: 'full', excel: 'limited', sheets: 'limited' },
                { label: 'Handles large datasets reliably', cf: 'full', excel: 'limited', sheets: 'limited' }
              ].map((row) => {
                const Cell = ({ value }) => {
                  if (value === 'full') {
                    return (
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100">
                        <Check size={16} className="text-emerald-700" />
                      </span>
                    );
                  }
                  if (value === 'no') {
                    return (
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 border border-slate-200 text-slate-500 font-bold">
                        —
                      </span>
                    );
                  }
                  return (
                    <span className="inline-flex items-center justify-center px-2.5 h-8 rounded-full bg-amber-50 border border-amber-100 text-amber-900 text-xs font-semibold">
                      Limited
                    </span>
                  );
                };

                return (
                  <div key={row.label} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-slate-900 font-semibold md:col-span-1">{row.label}</div>
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
    </>
  );
}
