import React, { useState } from 'react';
import { ChevronDown, FileCheck, Shuffle, Sparkles, Globe, GitMerge } from 'lucide-react';

const PlatformDropdown = ({ setActiveTab }) => {
  const [isOpen, setIsOpen] = useState(false);

  const features = [
    {
      title: 'Quality Validation',
      desc: 'Apply 50+ intelligent validation rules',
      icon: <FileCheck className="text-slate-900" size={20} />,
      tabName: 'validate'
    },
    {
      title: 'Schema Mapping',
      desc: 'Automatically map and transform files',
      icon: <Shuffle className="text-slate-900" size={20} />,
      tabName: 'mapper'
    },
    {
      title: 'Data Enrichment',
      desc: 'Enhance datasets with verified data',
      icon: <Sparkles className="text-slate-900" size={20} />,
      tabName: 'enrichment'
    },
    {
      title: 'Web Scraping',
      desc: 'Extract structured data from websites',
      icon: <Globe className="text-slate-900" size={20} />,
      tabName: 'scraper'
    },
    {
      title: 'Data Matching',
      desc: 'Match data with reference datasets',
      icon: <GitMerge className="text-slate-900" size={20} />,
      tabName: 'matching'
    }
  ];

  const handleFeatureClick = (tabName) => {
    setActiveTab(tabName);
    setIsOpen(false);
  };

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => {
        const timer = setTimeout(() => setIsOpen(false), 100);
        return () => clearTimeout(timer);
      }}
    >
      <button
        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer flex items-center gap-1"
      >
        Platform
        <ChevronDown
          size={16}
          className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div 
          className="absolute top-full left-0 mt-2 w-96 bg-white rounded-lg shadow-soft border border-slate-200 z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-900">Platform Features</h3>
            <p className="text-xs text-slate-600 mt-1">Choose a tool to get started</p>
          </div>

          {/* Features Grid */}
          <div className="p-4 space-y-2">
            {features.map((feature, idx) => (
              <button
                key={idx}
                onClick={() => handleFeatureClick(feature.tabName)}
                className="w-full flex items-start gap-3 px-4 py-3 rounded-lg hover:bg-slate-100 transition-all duration-200 group text-left"
              >
                <div className="mt-1 p-2 bg-slate-100 group-hover:bg-slate-200 rounded-lg transition-colors duration-200">
                  {feature.icon}
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-slate-900 group-hover:text-slate-900 transition-colors">
                    {feature.title}
                  </h4>
                  <p className="text-xs text-slate-600 group-hover:text-slate-700 transition-colors">
                    {feature.desc}
                  </p>
                </div>
                <div className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  →
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
            <a href="#" className="text-xs font-semibold text-slate-900 hover:text-slate-700 transition-colors">
              Explore all features →
            </a>
          </div>
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default PlatformDropdown;
