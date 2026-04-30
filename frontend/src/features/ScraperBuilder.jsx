import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Globe, Play, Eye, CheckCircle, ArrowLeft, Link, Tag } from 'lucide-react';
import { API_BASE } from '../lib/runtimeConfig';
const STEPS = ['Upload', 'Configure', 'Results'];

export default function ScraperBuilder({ onComplete }) {
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [url, setUrl] = useState('');
    const [urls, setUrls] = useState('');
    const [previewData, setPreviewData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);

    useEffect(() => { fetchTemplates(); }, []);

    const fetchTemplates = async () => {
        try {
            const res = await axios.get(`${API_BASE}/features/scraper/templates`);
            setTemplates(res.data.templates || []);
        } catch (e) { console.error('Error fetching templates:', e); }
    };

    const handlePreview = async () => {
        if (!url || !selectedTemplate) return;
        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/features/scraper/preview`, { url, template: selectedTemplate.id });
            setPreviewData(res.data.data);
            setStep(2);
        } catch (e) { alert('Preview failed: ' + (e.response?.data?.detail || e.message)); }
        setLoading(false);
    };

    const handleExecute = async () => {
        const urlList = urls.split('\n').filter(u => u.trim());
        if (urlList.length === 0) return;
        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/features/scraper/execute`, { urls: urlList, template: selectedTemplate.id });
            try {
                const token = localStorage.getItem('token');
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                await axios.post(`${API_BASE}/history/jobs`, {
                    session_id: `scrape_${Date.now()}`,
                    file_name: `${urlList.length} URLs (Template: ${selectedTemplate.name})`,
                    rules: [{ template: selectedTemplate.name, count: urlList.length }],
                    total_rows: urlList.length, valid_rows: urlList.length, invalid_rows: 0, module: 'scraper'
                }, { headers });
            } catch (histErr) { console.error("Failed to save history:", histErr); }
            setStep(3);
            if (onComplete) onComplete(res.data);
        } catch (e) { alert('Scraping failed: ' + (e.response?.data?.detail || e.message)); }
        setLoading(false);
    };

    return (
        <div className="w-full h-full flex flex-col">
            {/* ── Page Header ── */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 bg-white shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center">
                        <Globe size={20} className="text-orange-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Web Scraping</h2>
                        <p className="text-sm text-slate-500 mt-0.5">Extract structured data from websites using pre-built templates.</p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {STEPS.map((label, i) => {
                        const s = i + 1;
                        return (
                            <div key={s} className="flex items-center">
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                    step === s ? 'bg-orange-500 text-white' :
                                    step > s ? 'bg-orange-100 text-orange-700' :
                                    'bg-slate-100 text-slate-400'
                                }`}>
                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                                        step === s ? 'bg-white text-orange-600' :
                                        step > s ? 'bg-orange-400 text-white' :
                                        'bg-slate-300 text-slate-500'
                                    }`}>{step > s ? '✓' : s}</span>
                                    {label}
                                </div>
                                {s < STEPS.length && <div className={`w-6 h-px mx-1 ${step > s ? 'bg-orange-300' : 'bg-slate-200'}`} />}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Content ── */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
                {step === 1 && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        {/* Template Grid */}
                        <div className="mb-7">
                            <h3 className="text-base font-bold text-slate-800 mb-1">Select a Scraping Template</h3>
                            <p className="text-sm text-slate-500 mb-4">Each template defines what data fields to extract from the target page.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {templates.map(template => (
                                    <motion.div
                                        key={template.id}
                                        whileHover={{ y: -2 }}
                                        onClick={() => setSelectedTemplate(template)}
                                        className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                                            selectedTemplate?.id === template.id
                                                ? 'border-orange-400 bg-orange-50 shadow-md shadow-orange-100'
                                                : 'border-slate-200 bg-white hover:border-orange-300 hover:shadow-sm'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                                                selectedTemplate?.id === template.id ? 'bg-orange-500' : 'bg-slate-100'
                                            }`}>
                                                <Globe size={16} className={selectedTemplate?.id === template.id ? 'text-white' : 'text-slate-500'} />
                                            </div>
                                            <h3 className="font-black text-sm text-slate-800">{template.name}</h3>
                                        </div>
                                        <p className="text-xs text-slate-500 mb-3 leading-relaxed">{template.description}</p>
                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                            {template.fields.map(field => (
                                                <span key={field} className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-semibold">
                                                    <Tag size={8} />{field}
                                                </span>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-slate-400 truncate">
                                            <span className="font-semibold">eg:</span> {template.example_url}
                                        </p>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* URL Input */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                            <label className="block text-sm font-bold text-slate-700 mb-1">Preview URL</label>
                            <p className="text-xs text-slate-500 mb-3">Enter one URL to test and preview the extracted data before batch scraping.</p>
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <Link size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input type="url" value={url} onChange={e => setUrl(e.target.value)}
                                        placeholder="https://example.com/page"
                                        className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:border-orange-400 focus:ring-2 focus:ring-orange-400/10 outline-none" />
                                </div>
                                <button onClick={handlePreview} disabled={!url || !selectedTemplate || loading}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-orange-500/20 hover:-translate-y-0.5">
                                    <Eye size={16} /> {loading ? 'Loading…' : 'Preview'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {step === 2 && previewData && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Extraction Preview</h3>
                                <p className="text-sm text-slate-500 mt-1">Review the scraped fields from your preview URL.</p>
                            </div>
                            <button onClick={() => setStep(1)} className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                                <ArrowLeft size={15} /> Change Template
                            </button>
                        </div>

                        {/* Preview cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-7">
                            {previewData.map((item, idx) => (
                                <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                    {Object.entries(item).map(([key, value]) => (
                                        <div key={key} className="mb-3 last:mb-0">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">{key}</p>
                                            <p className="text-sm text-slate-800 font-medium leading-relaxed">{String(value)}</p>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>

                        {/* Batch URLs */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                            <label className="block text-sm font-bold text-slate-700 mb-1">Batch URLs to Scrape</label>
                            <p className="text-xs text-slate-500 mb-3">Enter one URL per line to scrape all pages in bulk.</p>
                            <textarea value={urls} onChange={e => setUrls(e.target.value)}
                                placeholder={"https://example.com/page1\nhttps://example.com/page2"}
                                rows={5}
                                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:border-orange-400 focus:ring-2 focus:ring-orange-400/10 outline-none resize-none" />
                            <div className="flex justify-end mt-3">
                                <button onClick={handleExecute} disabled={loading || !urls.trim()}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-orange-500/20 hover:-translate-y-0.5">
                                    <Play size={16} fill="currentColor" /> {loading ? 'Scraping…' : 'Scrape All URLs'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {step === 3 && (
                    <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-16">
                        <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="text-orange-500" size={44} />
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-3">Scraping Complete!</h3>
                        <p className="text-slate-500 text-base mb-8">All URLs have been scraped and data extracted successfully.</p>
                        <button onClick={() => onComplete && onComplete()}
                            className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-orange-500/20">
                            Continue
                        </button>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
