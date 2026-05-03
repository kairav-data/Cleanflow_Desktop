import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, Zap, Sparkles, Crown, ChevronDown, Shield, Clock, Headphones, Database, Gauge, ScanSearch, Webhook, Workflow, History, Users } from 'lucide-react';

const PricingPage = ({ onClose }) => {
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [openFaq, setOpenFaq] = useState(null);

  const basePlans = useMemo(() => ([
    {
      name: 'Starter',
      monthlyPrice: 2499,
      description: 'Perfect for individuals and small teams getting started.',
      features: [
        'Up to 1,00,000 records/month',
        'Basic validation rules (20+ types)',
        'CSV & JSON export',
        'Email support',
        '1 workspace',
        'Basic API access',
        '7-day data retention'
      ],
      cta: 'Get Started',
      highlighted: false,
      accentColor: 'emerald',
      icon: <Zap size={20} className="text-emerald-400" />,
      badge: null
    },
    {
      name: 'Professional',
      monthlyPrice: 8499,
      description: 'Built for growing data teams with advanced requirements.',
      features: [
        'Up to 50,00,000 records/month',
        'Advanced validation rules (50+ types)',
        'Data enrichment module',
        'Schema mapping & web scraping',
        'Priority support (< 4hr response)',
        'Unlimited workspaces',
        'Advanced API + webhooks',
        'Custom connectors',
        '90-day audit logs'
      ],
      cta: 'Start Free Trial',
      highlighted: true,
      accentColor: 'sky',
      icon: <Sparkles size={20} className="text-sky-400" />,
      badge: 'Most Popular'
    },
    {
      name: 'Enterprise',
      monthlyPrice: null,
      description: 'Custom infrastructure for large-scale operations and compliance.',
      features: [
        'Unlimited records & pipelines',
        'All modules included',
        'Dedicated success manager',
        'SLA guarantees (99.99% uptime)',
        'On-premise deployment option',
        'Custom integrations & SSO',
        'Advanced security & compliance',
        'Unlimited audit logs',
        'Custom data retention'
      ],
      cta: 'Contact Sales',
      highlighted: false,
      accentColor: 'amber',
      icon: <Crown size={20} className="text-amber-400" />,
      badge: 'Custom'
    }
  ]), []);

  const plans = useMemo(() => {
    return basePlans.map((p) => {
      if (!p.monthlyPrice) return { ...p, price: 'Custom', period: '' };
      const monthly = p.monthlyPrice;
      const annual = Math.round(monthly * 12 * 0.8);
      return billingCycle === 'annual'
        ? { ...p, price: `₹${annual.toLocaleString('en-IN')}`, period: '/year', saving: `Save ₹${Math.round(monthly * 12 * 0.2).toLocaleString('en-IN')}` }
        : { ...p, price: `₹${monthly.toLocaleString('en-IN')}`, period: '/month', saving: null };
    });
  }, [basePlans, billingCycle]);

  const faqs = [
    { q: 'Can I cancel anytime?', a: 'Yes, cancel at any time with no questions asked. We offer a 30-day money-back guarantee on all paid plans.' },
    { q: 'What payment methods do you accept?', a: 'We accept all major credit/debit cards, UPI, net banking, and bank transfers. GST invoices are provided for Indian businesses.' },
    { q: 'Do you offer discounts for annual billing?', a: 'Yes! Prepay annually and save 20% on any plan. Perfect for committed teams with predictable usage.' },
    { q: 'Is there a free trial?', a: 'Absolutely. The Professional plan comes with a 14-day free trial. No credit card required to start.' },
    { q: 'What happens to my data if I cancel?', a: 'Your data remains yours. We provide a 30-day export window after cancellation before secure deletion.' },
    { q: 'Can I upgrade or downgrade anytime?', a: "Yes, switch plans at any time. We'll prorate your billing accordingly — no wasted spend." }
  ];

  const trustStats = [
    { icon: <Database size={20} className="text-emerald-400" />, value: '2B+', label: 'Records Processed' },
    { icon: <Shield size={20} className="text-sky-400" />, value: '99.99%', label: 'Uptime SLA' },
    { icon: <Headphones size={20} className="text-purple-400" />, value: '< 4hr', label: 'Support Response' },
    { icon: <Clock size={20} className="text-amber-400" />, value: '14 days', label: 'Free Trial' },
  ];

  const accentMap = {
    emerald: {
      border: 'hover:border-emerald-500/50',
      glow: 'hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]',
      badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
      btn: 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20',
      check: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    sky: {
      border: 'border-sky-500/40',
      glow: 'shadow-[0_0_40px_rgba(56,189,248,0.2)]',
      badge: 'bg-sky-500/20 border-sky-400/40 text-sky-300',
      btn: 'bg-sky-500 text-slate-950 hover:bg-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.3)]',
      check: 'text-sky-400',
      iconBg: 'bg-sky-500/10 border-sky-500/20',
    },
    amber: {
      border: 'hover:border-amber-500/50',
      glow: 'hover:shadow-[0_0_30px_rgba(251,191,36,0.12)]',
      badge: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
      btn: 'bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20',
      check: 'text-amber-400',
      iconBg: 'bg-amber-500/10 border-amber-500/20',
    },
  };

  const capabilityIcons = {
    'Execution Engine': Gauge,
    'Real-time Validation': ScanSearch,
    'API & Webhooks': Webhook,
    'Schema Mapping': Workflow,
    'Audit Trails': History,
    'Team Collaboration': Users,
  };

  return (
    <motion.div
      key="pricing-tab"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="flex min-h-screen w-full flex-col items-center"
    >
      {/* Back button */}
      <div className="mb-10 flex w-full max-w-7xl items-center px-6">
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white font-medium flex items-center gap-2 transition-colors text-sm"
        >
          <ArrowRight className="rotate-180" size={16} /> Back to Home
        </button>
      </div>

      <div className="w-full max-w-7xl px-6">

        {/* Hero */}
        <div className="relative mb-14 text-center">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[260px] w-[640px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(52,211,153,0.1),transparent_70%)]" />
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-400"
          >
            <Sparkles size={13} /> Transparent Pricing
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="mb-4 text-4xl font-black leading-[1.04] tracking-tight text-white md:text-6xl"
          >
            Plans that scale
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-400">
              with your data.
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="mx-auto mb-8 max-w-xl text-base font-medium text-slate-400"
          >
            All plans include a 14-day free trial. No credit card required. Cancel anytime.
          </motion.p>

          {/* Billing Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 p-1"
          >
            {['monthly', 'annual'].map((cycle) => (
              <button
                key={cycle}
                onClick={() => setBillingCycle(cycle)}
                className={`rounded-lg px-5 py-2 text-sm font-semibold capitalize transition-all ${billingCycle === cycle
                  ? 'bg-white text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
                  }`}
              >
                {cycle}
                {cycle === 'annual' && (
                  <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-black ${billingCycle === 'annual' ? 'bg-emerald-500/20 text-emerald-600' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    −20%
                  </span>
                )}
              </button>
            ))}
          </motion.div>
        </div>

        {/* Trust Stats Bar */}
        <div className="mb-14 grid grid-cols-2 gap-3 md:grid-cols-4">
          {trustStats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }}
              className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3.5"
            >
              <div className="rounded-lg border border-slate-700 bg-slate-800 p-2">{stat.icon}</div>
              <div>
                <p className="text-base font-black leading-none text-white">{stat.value}</p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Pricing Cards */}
        <div className="mb-20 grid grid-cols-1 gap-5 md:grid-cols-3">
          {plans.map((plan, idx) => {
            const ac = accentMap[plan.accentColor];
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * idx }}
                whileHover={{ y: -4 }}
                className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-300
                  ${plan.highlighted
                    ? `bg-slate-900 ${ac.border} ${ac.glow}`
                    : `bg-slate-900/40 border-slate-800 ${ac.border} ${ac.glow}`
                  }`}
              >
                {/* Top badge */}
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${ac.badge}`}>
                      {plan.badge}
                    </span>
                  </div>
                )}

                {/* Icon + Name */}
                <div className="mb-4 flex items-center gap-3">
                  <div className={`rounded-lg border p-2 ${ac.iconBg}`}>{plan.icon}</div>
                  <div>
                    <h3 className="text-lg font-black text-white">{plan.name}</h3>
                    <p className="text-xs text-slate-500 font-medium">{plan.description}</p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-5 border-b border-slate-800 pb-5">
                  <div className="flex items-end gap-2 mb-1">
                    <span className="text-4xl font-black tracking-tight text-white">{plan.price}</span>
                    {plan.period && <span className="text-slate-500 font-medium mb-1.5">{plan.period}</span>}
                  </div>
                  {plan.saving && (
                    <span className="inline-block text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                      {plan.saving} annually
                    </span>
                  )}
                  {!plan.price.includes('₹') && !plan.saving && (
                    <p className="text-xs text-slate-500 font-medium">Talk to us for a tailored quote</p>
                  )}
                </div>

                {/* CTA */}
                <button className={`mb-5 w-full rounded-xl py-3 text-sm font-semibold tracking-wide transition-all ${ac.btn}`}>
                  {plan.cta} <ArrowRight className="inline ml-1.5" size={14} />
                </button>

                {/* Features */}
                <ul className="space-y-3 mt-auto">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check size={15} className={`${ac.check} mt-0.5 shrink-0`} />
                      <span className="text-sm text-slate-600 font-medium">{feat}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        {/* Feature Highlights Grid */}
        <div className="mb-20">
          <div className="mb-10 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-emerald-500">Platform Capabilities</p>
            <h2 className="mb-4 text-2xl font-black text-white md:text-3xl">Everything included, out of the box</h2>
            <p className="text-slate-400 max-w-xl mx-auto font-medium">No hidden add-ons. Every plan is built on the same high-performance engine.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: '⚡', title: 'Execution Engine', desc: 'Process millions of records in seconds with our distributed pipeline.' },
              { icon: '🔍', title: 'Real-time Validation', desc: 'Instant rule failure detection with column-level granularity.' },
              { icon: '🔗', title: 'API & Webhooks', desc: 'Connect CleanFlow to your stack with our REST API and webhook triggers.' },
              { icon: '🗂️', title: 'Schema Mapping', desc: 'Auto-match fields and standardize headers to target formats.' },
              { icon: '🛡️', title: 'Audit Trails', desc: 'Full history of every pipeline run, change, and export.' },
              { icon: '👥', title: 'Team Collaboration', desc: 'Shared workspaces, role-based access, and activity feeds.' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
                className="group rounded-xl border border-slate-800 bg-slate-900/50 p-5 transition-all hover:border-slate-700 hover:bg-slate-900"
              >
                {(() => {
                  const CapabilityIcon = capabilityIcons[item.title] || Zap;
                  return (
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-emerald-400">
                      <CapabilityIcon size={18} />
                    </div>
                  );
                })()}
                <h3 className="font-black text-white mb-2 group-hover:text-emerald-400 transition-colors">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mx-auto mb-20 w-full max-w-3xl">
          <div className="mb-10 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-sky-400">Got Questions?</p>
            <h2 className="text-2xl font-black text-white md:text-3xl">Frequently Asked</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 transition-colors hover:border-slate-700"
              >
                <button
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-bold text-white text-sm">{faq.q}</span>
                  <ChevronDown
                    size={18}
                    className={`text-slate-400 transition-transform duration-300 shrink-0 ml-4 ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-slate-800 px-5 pb-4 pt-4 text-sm font-medium leading-relaxed text-slate-400">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="relative mb-12 w-full overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-600 to-sky-600 p-10 text-center text-white shadow-xl md:p-12">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay" />
          <div className="relative z-10">
            <h2 className="mb-5 text-3xl font-black tracking-tight md:text-4xl">Start free. Scale fast.</h2>
            <p className="mx-auto mb-8 max-w-xl text-base font-medium text-emerald-50">
              14 days free on any plan. No credit card. Full access to every feature.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-8 py-3.5 text-base font-semibold text-white transition-all hover:bg-black">
                Start Free Trial <Zap className="text-emerald-400" fill="currentColor" size={18} />
              </button>
              <button className="rounded-xl border border-white/30 bg-white/20 px-8 py-3.5 text-base font-semibold text-white backdrop-blur transition-all hover:bg-white/30">
                Talk to Sales
              </button>
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
};

export default PricingPage;
