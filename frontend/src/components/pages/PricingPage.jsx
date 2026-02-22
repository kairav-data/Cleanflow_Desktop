import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Zap, Sparkles, Crown } from 'lucide-react';

const PricingPage = ({ onClose }) => {
  const plans = [
    {
      name: 'Starter',
      price: '$29',
      period: '/month',
      description: 'Perfect for individuals and small teams',
      features: [
        'Up to 100k records/month',
        'Basic validation rules',
        'CSV export',
        'Email support',
        '1 workspace',
        'Basic API access'
      ],
      cta: 'Get Started',
      highlighted: false,
      icon: <Zap className="text-orange-500" size={24} />
    },
    {
      name: 'Professional',
      price: '$99',
      period: '/month',
      description: 'For growing data teams',
      features: [
        'Up to 5M records/month',
        'Advanced validation rules',
        'Data enrichment',
        'Web scraping',
        'Priority support',
        'Unlimited workspaces',
        'Advanced API access',
        'Custom connectors'
      ],
      cta: 'Start Free Trial',
      highlighted: true,
      icon: <Sparkles className="text-blue-600" size={24} />
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: 'pricing',
      description: 'For large-scale operations',
      features: [
        'Unlimited records',
        'All features included',
        'Dedicated support',
        'SLA guarantees',
        'On-premise deployment',
        'Custom integrations',
        'Advanced security',
        'Audit logs'
      ],
      cta: 'Contact Sales',
      highlighted: false,
      icon: <Crown className="text-yellow-500" size={24} />
    }
  ];

  const faqs = [
    {
      q: 'Can I cancel anytime?',
      a: 'Yes, cancel at any time with no questions asked. We offer a 30-day money-back guarantee.'
    },
    {
      q: 'What payment methods do you accept?',
      a: 'We accept all major credit cards, bank transfers, and PayPal. Annual billing also available with 20% discount.'
    },
    {
      q: 'Do you offer discounts for annual billing?',
      a: 'Yes! Prepay annually and save 20% on any plan. Perfect for committed teams.'
    },
    {
      q: 'Is there a free trial?',
      a: 'Absolutely. All plans come with a 14-day free trial. No credit card required to start.'
    },
    {
      q: 'What happens to my data if I cancel?',
      a: 'Your data remains yours. We provide a 30-day export period after cancellation.'
    },
    {
      q: 'Can I upgrade or downgrade anytime?',
      a: 'Yes, change your plan anytime. We\'ll prorate your billing accordingly.'
    }
  ];

  return (
    <motion.div
      key="pricing-tab"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="flex flex-col items-center w-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between w-full mb-16">
        <button
          onClick={onClose}
          className="text-slate-600 hover:text-slate-900 font-medium flex items-center gap-2 transition-colors"
        >
          <ArrowRight className="rotate-180" size={18} /> Back
        </button>
      </div>

      {/* Hero Section */}
      <div className="text-center mb-20">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
          Simple, Transparent Pricing
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8 leading-relaxed">
          Choose the perfect plan for your data validation needs. All plans include a 14-day free trial.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button className="px-6 py-2 text-sm font-medium text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all">
            Monthly
          </button>
          <button className="px-6 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-all">
            Annual <span className="ml-1 text-slate-300">-20%</span>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-24 max-w-6xl">
        {plans.map((plan, idx) => (
          <motion.div
            key={idx}
            whileHover={{ y: -4 }}
            className={`relative rounded-lg p-8 transition-all duration-300 ${
              plan.highlighted
                ? 'bg-slate-900 text-white border border-slate-800 shadow-soft'
                : 'bg-white border border-slate-200 text-slate-900'
            }`}
          >
            {/* Badge for highlighted plan */}
            {plan.highlighted && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-slate-700 text-white px-3 py-1 rounded-full text-xs font-semibold">
                  Most Popular
                </span>
              </div>
            )}

            <div className="mb-6">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${plan.highlighted ? 'bg-slate-800' : 'bg-slate-100'}`}>
                {plan.icon}
              </div>
              <h3 className={`text-xl font-bold mb-2 ${plan.highlighted ? 'text-white' : 'text-slate-900'}`}>
                {plan.name}
              </h3>
              <p className={`text-sm ${plan.highlighted ? 'text-slate-400' : 'text-slate-600'}`}>
                {plan.description}
              </p>
            </div>

            <div className="mb-8">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.period !== 'pricing' && (
                  <span className={plan.highlighted ? 'text-slate-400' : 'text-slate-600'}>
                    {plan.period}
                  </span>
                )}
              </div>
            </div>

            <button
              className={`w-full mb-8 py-2.5 px-6 font-semibold rounded-lg transition-all duration-300 ${
                plan.highlighted
                  ? 'bg-white text-slate-900 hover:bg-slate-100'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {plan.cta}
            </button>

            <div className={`space-y-3 ${plan.highlighted ? 'border-t border-slate-700 pt-6' : 'border-t border-slate-200 pt-6'}`}>
              {plan.features.map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Check
                    size={18}
                    className={plan.highlighted ? 'text-white' : 'text-slate-900'}
                  />
                  <span className={`text-sm ${plan.highlighted ? 'text-slate-300' : 'text-slate-600'}`}>
                    {feature}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Features Comparison */}
      <div className="w-full max-w-4xl mb-24">
        <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
          Everything you need
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { title: 'Unlimited Datasets', desc: 'Process as many datasets as you need.' },
            { title: 'Real-time Validation', desc: 'Get instant feedback on data quality.' },
            { title: 'API Access', desc: 'Integrate with your existing tools.' },
            { title: 'Audit Logs', desc: 'Track all changes and access.' },
            { title: 'Team Collaboration', desc: 'Work together seamlessly.' },
            { title: 'Advanced Analytics', desc: 'Gain deeper insights into your data.' }
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-4 bg-slate-50 p-6 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
              <div className="w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check size={14} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">{item.title}</h3>
                <p className="text-sm text-slate-600">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="w-full max-w-4xl mb-20">
        <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
          Frequently Asked Questions
        </h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.details
              key={i}
              className="group bg-white border border-slate-200 rounded-lg overflow-hidden hover:border-slate-300 transition-colors"
            >
              <summary className="flex items-center justify-between px-6 py-4 cursor-pointer font-medium text-slate-900 hover:text-slate-700">
                {faq.q}
                <span className="text-slate-600 group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <div className="px-6 py-4 border-t border-slate-100 text-slate-600">
                {faq.a}
              </div>
            </motion.details>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="w-full max-w-4xl bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-12 text-center mb-12">
        <h2 className="text-3xl font-black text-white mb-4">
          Ready to transform your data?
        </h2>
        <p className="text-blue-100 mb-8 text-lg">
          Start your 14-day free trial today. No credit card required.
        </p>
        <button className="bg-white text-blue-600 px-8 py-4 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-lg">
          Start Free Trial <ArrowRight className="inline ml-2" size={20} />
        </button>
      </div>
    </motion.div>
  );
};

export default PricingPage;
