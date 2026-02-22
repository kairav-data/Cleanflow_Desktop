import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Pricing() {
    const [billingCycle, setBillingCycle] = useState('monthly');

    const plans = [
        {
            name: 'Free Starter',
            price: billingCycle === 'monthly' ? '$0' : '$0',
            description: 'Perfect for individuals and small tests.',
            features: [
                '500 rows per month',
                'Basic Data Validation',
                'Email Support',
                'Single User',
                'No API Access',
            ],
            cta: 'Get Started',
            popular: false,
        },
        {
            name: 'Pro',
            price: billingCycle === 'monthly' ? '$29' : '$290',
            period: billingCycle === 'monthly' ? '/mo' : '/yr',
            description: 'For professionals who need power.',
            features: [
                'Unlimited rows',
                'Advanced Validation & Matching',
                'Web Scraping (10k pages/mo)',
                'Priority 24/7 Support',
                'API Access',
            ],
            cta: 'Start Free Trial',
            popular: true,
        },
        {
            name: 'Enterprise',
            price: 'Custom',
            description: 'For large teams and organizations.',
            features: [
                'Unlimited Everything',
                'Custom Data Connectors',
                'Dedicated Success Manager',
                'SLA 99.9%',
                'On-premise Deployment',
            ],
            cta: 'Contact Sales',
            popular: false,
        },
    ];

    return (
        <div className="min-h-screen bg-slate-50 py-20 px-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <h1 className="text-5xl font-black mb-6">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-accent-600">
                            Simple, Transparent Pricing
                        </span>
                    </h1>
                    <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-8">
                        Choose the perfect plan for your data needs. No hidden fees.
                    </p>

                    {/* Toggle */}
                    <div className="flex items-center justify-center gap-4">
                        <span className={`text-sm font-bold ${billingCycle === 'monthly' ? 'text-slate-900' : 'text-slate-500'}`}>Monthly</span>
                        <button
                            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                            className="w-16 h-8 bg-slate-200 rounded-full p-1 relative transition-colors duration-300 focus:outline-none"
                        >
                            <div
                                className={`w-6 h-6 bg-brand-600 rounded-full shadow-md transform transition-transform duration-300 ${billingCycle === 'yearly' ? 'translate-x-8' : 'translate-x-0'}`}
                            />
                        </button>
                        <span className={`text-sm font-bold ${billingCycle === 'yearly' ? 'text-slate-900' : 'text-slate-500'}`}>
                            Yearly <span className="text-accent-500 text-xs">(Save 20%)</span>
                        </span>
                    </div>
                </div>

                {/* Pricing Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {plans.map((plan, index) => (
                        <motion.div
                            key={plan.name}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`relative bg-white rounded-3xl p-8 border ${plan.popular ? 'border-brand-500 ring-4 ring-brand-500/10 shadow-2xl scale-105 z-10' : 'border-slate-200 shadow-xl'
                                } flex flex-col`}
                        >
                            {plan.popular && (
                                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-brand-500 to-accent-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
                                    Most Popular
                                </div>
                            )}

                            <div className="mb-6">
                                <h3 className="text-2xl font-bold text-slate-900">{plan.name}</h3>
                                <p className="text-slate-500 mt-2 text-sm">{plan.description}</p>
                            </div>

                            <div className="mb-6">
                                <span className="text-5xl font-black text-slate-900">{plan.price}</span>
                                {plan.period && <span className="text-slate-400 font-medium">{plan.period}</span>}
                            </div>

                            <div className="flex-grow space-y-4 mb-8">
                                {plan.features.map((feature, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        <div className={`p-1 rounded-full ${plan.popular ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-500'}`}>
                                            <Check size={14} strokeWidth={3} />
                                        </div>
                                        <span className="text-slate-700 font-medium text-sm">{feature}</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                className={`w-full py-4 rounded-2xl font-bold text-lg transition-all ${plan.popular
                                    ? 'bg-gradient-to-r from-brand-600 to-brand-800 text-white hover:shadow-lg hover:shadow-brand-500/30'
                                    : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                                    }`}
                            >
                                {plan.cta}
                            </button>
                        </motion.div>
                    ))}
                </div>

                {/* FAQ Section */}
                <div className="mt-24 max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold text-center mb-12 text-slate-900">Frequently Asked Questions</h2>
                    <div className="space-y-6">
                        {[
                            { q: 'Can I change plans later?', a: 'Yes, you can upgrade or downgrade at any time. Prorated charges will apply.' },
                            { q: 'Is my data secure?', a: 'Absolutely. We use enterprise-grade encryption for all data transmission and storage.' },
                            { q: 'Do you offer a free trial?', a: 'Yes, the Pro plan comes with a 14-day free trial. No credit card required.' },
                        ].map((item, idx) => (
                            <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <h4 className="font-bold text-lg text-slate-900 mb-2">{item.q}</h4>
                                <p className="text-slate-600">{item.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
