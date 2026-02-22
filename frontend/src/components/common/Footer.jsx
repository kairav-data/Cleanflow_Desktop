import React, { useState } from 'react';
import { Mail, Linkedin, Twitter, Github, ArrowRight, Send } from 'lucide-react';
import Logo from '../../assets/logo.png';

const Footer = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 3000);
    }
  };

  const footerLinks = {
    Product: [
      { label: 'Features', href: '#' },
      { label: 'Pricing', href: '#' },
      { label: 'Security', href: '#' },
      { label: 'Changelog', href: '#' },
      { label: 'API Docs', href: '#' }
    ],
    Company: [
      { label: 'About Us', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Careers', href: '#' },
      { label: 'Press', href: '#' },
      { label: 'Contact', href: '#' }
    ],
    Resources: [
      { label: 'Documentation', href: '#' },
      { label: 'Support', href: '#' },
      { label: 'Community', href: '#' },
      { label: 'Templates', href: '#' },
      { label: 'Integrations', href: '#' }
    ],
    Legal: [
      { label: 'Privacy Policy', href: '#' },
      { label: 'Terms of Service', href: '#' },
      { label: 'Cookie Policy', href: '#' },
      { label: 'GDPR', href: '#' },
      { label: 'Compliance', href: '#' }
    ]
  };

  const socialLinks = [
    { icon: Twitter, label: 'Twitter', href: '#', color: 'text-slate-400 hover:text-blue-500' },
    { icon: Linkedin, label: 'LinkedIn', href: '#', color: 'text-slate-400 hover:text-blue-600' },
    { icon: Github, label: 'GitHub', href: '#', color: 'text-slate-400 hover:text-slate-900' },
    { icon: Mail, label: 'Email', href: 'mailto:hello@cleanflow.com', color: 'text-slate-400 hover:text-red-500' }
  ];

  return (
    <footer className="bg-[#F8FAFC] border-t border-slate-200/60 mt-20 relative">
      {/* Background Ornament */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute bottom-0 left-10 w-72 h-72 bg-blue-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Newsletter Section */}
      <div className="border-b border-slate-200/60 relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">Stay updated</h2>
              <p className="text-slate-500 text-lg font-medium leading-relaxed">Get the latest features, tips, and data quality insights delivered to your inbox.</p>
            </div>
            <form onSubmit={handleSubscribe} className="flex gap-3">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1 px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap shadow-md hover:shadow-lg"
              >
                {subscribed ? '✓' : <Send size={18} />} {subscribed ? 'Subscribed' : 'Subscribe'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-6 py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-16">
          {/* Brand Section */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-6">
              <img
                src={Logo}
                alt="CleanFlow"
                className="h-8 w-auto object-contain"
                style={{ filter: 'brightness(0) saturate(100%) invert(18%) sepia(15%) saturate(1235%) hue-rotate(182deg) brightness(92%) contrast(92%)' }}
              />
              <span className="text-lg font-black text-slate-900">CleanFlow</span>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed mb-8 font-medium">
              The modern data quality platform for enterprises. Clean, validate, and transform your data with confidence.
            </p>
            <div className="flex items-center gap-3">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    className={`${social.color} transition-colors p-2 hover:bg-slate-100 rounded-lg`}
                    title={social.label}
                  >
                    <Icon size={18} />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Links Sections */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="font-black text-slate-900 mb-6 text-sm uppercase tracking-widest">{category}</h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-slate-500 hover:text-blue-600 transition-colors text-sm font-medium"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Footer */}
        <div className="border-t border-slate-200/60 pt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="text-slate-500 text-sm font-medium">
              <p>&copy; 2026 CleanFlow. All rights reserved.</p>
              <p className="mt-2">Transforming data quality for modern enterprises.</p>
            </div>
            <div className="flex flex-wrap gap-4 md:justify-end">
              <a href="#" className="text-slate-500 hover:text-blue-600 text-sm transition-colors font-medium">
                Status
              </a>
              <span className="text-slate-300">•</span>
              <a href="#" className="text-slate-500 hover:text-blue-600 text-sm transition-colors font-medium">
                Sitemap
              </a>
              <span className="text-slate-300">•</span>
              <a href="#" className="text-slate-500 hover:text-blue-600 text-sm transition-colors font-medium">
                License
              </a>
              <span className="text-slate-300">•</span>
              <a href="#" className="text-slate-500 hover:text-blue-600 text-sm transition-colors font-medium">
                Accessibility
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
