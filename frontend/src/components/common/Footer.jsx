import React, { useState } from 'react';
import { ArrowRight, Youtube, Linkedin, Twitter } from 'lucide-react';
import Logo from '../../assets/logo.png';

const Footer = () => {
  const [email, setEmail] = useState('');

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email) {
      setEmail('');
    }
  };

  return (
    <footer className="w-full bg-[#121413] text-white py-16 px-8 relative overflow-hidden flex flex-col mt-auto items-center">
      {/* Faint bottom gradient to match screenshot aesthetic */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-gray-900 to-transparent pointer-events-none opacity-40" />

      <div className="w-full max-w-7xl flex flex-col md:flex-row justify-between gap-16 relative z-10">
        
        {/* Left Section */}
        <div className="max-w-xs">
          <div className="mb-8">
            <img
              src={Logo}
              alt="CleanFlow Logo"
              className="h-8 w-auto brightness-0 invert"
            />
          </div>
          
          <h2 className="text-lg font-medium mb-6 leading-relaxed">
            Subscribe to the<br />
            CleanFlow Newsletter
          </h2>
          
          <form onSubmit={handleSubscribe} className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-transparent border border-gray-600 rounded-full px-5 py-2.5 text-sm font-medium text-white placeholder-gray-400 focus:outline-none focus:border-gray-400 transition-colors"
                style={{ backdropFilter: 'blur(4px)' }}
              />
            </div>
            <button
              type="submit"
              className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 hover:bg-gray-200 transition-colors"
            >
              <ArrowRight size={18} className="text-black" />
            </button>
          </form>
        </div>

        {/* Right Section (Links) */}
        <div className="flex gap-20">
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider mb-6 text-white">Company</h3>
            <ul className="space-y-4">
              <li><a href="#" className="text-[13px] text-gray-400 hover:text-white transition-colors">Contact</a></li>
              <li><a href="#" className="text-[13px] text-gray-400 hover:text-white transition-colors">Careers</a></li>
              <li><a href="#" className="text-[13px] text-gray-400 hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="text-[13px] text-gray-400 hover:text-white transition-colors">Refund Policy</a></li>
              <li><a href="#" className="text-[13px] text-gray-400 hover:text-white transition-colors">Terms of Service</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider mb-6 text-white">Products</h3>
            <ul className="space-y-4">
              <li><a href="#" className="text-[13px] text-gray-400 hover:text-white transition-colors">CleanFlow</a></li>
            </ul>
          </div>
        </div>

      </div>

      {/* Bottom Section */}
      <div className="w-full max-w-7xl mt-32 flex flex-col md:flex-row items-end justify-between gap-6 relative z-10">
        <div className="flex flex-col gap-5">
          <p className="text-[11px] text-gray-400">© 2026 CleanFlow™. All Rights Reserved.</p>
        </div>
        <div className="flex items-center gap-5">
          <a href="#" className="text-gray-400 hover:text-white transition-colors"><Youtube size={20} strokeWidth={1.5} /></a>
          <a href="#" className="text-gray-400 hover:text-white transition-colors"><Twitter size={20} strokeWidth={1.5} /></a>
          <a href="#" className="text-gray-400 hover:text-white transition-colors"><Linkedin size={20} strokeWidth={1.5} /></a>
        </div>
      </div>
      
    </footer>
  );
};

export default Footer;
