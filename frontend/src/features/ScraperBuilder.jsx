import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Play, Eye, CheckCircle, ArrowLeft, Link, Tag, FileText, Code, Image as ImageIcon, Box, Coins, RefreshCw, Zap } from 'lucide-react';
import { API_BASE } from '../lib/runtimeConfig';

const STEPS = ['Configure', 'Preview', 'Results'];

export default function ScraperBuilder({ onComplete }) {
    const [formats, setFormats] = useState([]);
    const [selectedFormats, setSelectedFormats] = useState(['markdown']);
    const [extractPrompt, setExtractPrompt] = useState('');
    const [url, setUrl] = useState('');
    const [urls, setUrls] = useState('');
    const [previewData, setPreviewData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);
    
    const [credits, setCredits] = useState(null);
    const [loadingCredits, setLoadingCredits] = useState(false);

    const formatCreditValue = (value) => (
        typeof value === 'number' && Number.isFinite(value)
            ? value.toLocaleString()
            : 'N/A'
    );

    useEffect(() => { 
        fetchFormats(); 
        fetchCredits();
    }, []);

    const fetchFormats = async () => {
        try {
            const res = await axios.get(`${API_BASE}/features/scraper/templates`);
            setFormats(res.data.templates || []);
        } catch (e) { console.error('Error fetching formats:', e); }
    };

    const fetchCredits = async () => {
        setLoadingCredits(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.get(`${API_BASE}/features/scraper/credits`, { headers });
            setCredits(res.data);
        } catch (e) { console.error('Error fetching credits:', e); }
        setLoadingCredits(false);
    };

    const toggleFormat = (formatId) => {
        if (selectedFormats.includes(formatId)) {
            setSelectedFormats(selectedFormats.filter(id => id !== formatId));
        } else {
            setSelectedFormats([...selectedFormats, formatId]);
        }
    };

    const handlePreview = async () => {
        if (!url || selectedFormats.length === 0) return;
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.post(`${API_BASE}/features/scraper/preview`, { 
                url, 
                formats: selectedFormats,
                extract_prompt: extractPrompt 
            }, { headers });
            setPreviewData(res.data.data);
            setStep(2);
            fetchCredits();
        } catch (e) { alert('Preview failed: ' + (e.response?.data?.detail || e.message)); }
        setLoading(false);
    };

    const handleExecute = async () => {
        const urlList = urls.split('\n').filter(u => u.trim());
        if (urlList.length === 0) return;
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.post(`${API_BASE}/features/scraper/execute`, { 
                urls: urlList, 
                formats: selectedFormats,
                extract_prompt: extractPrompt 
            }, { headers });
            
            try {
                await axios.post(`${API_BASE}/history/jobs`, {
                    session_id: `scrape_${Date.now()}`,
                    file_name: `${urlList.length} URLs (Firecrawl)`,
                    rules: [{ formats: selectedFormats, count: urlList.length }],
                    total_rows: urlList.length, valid_rows: urlList.length, invalid_rows: 0, module: 'scraper'
                }, { headers });
            } catch (histErr) { console.error("Failed to save history:", histErr); }
            
            setStep(3);
            fetchCredits();
            if (onComplete) onComplete(res.data);
        } catch (e) { alert('Scraping failed: ' + (e.response?.data?.detail || e.message)); }
        setLoading(false);
    };

    const getFormatIcon = (id) => {
        switch(id) {
            case 'markdown': return <FileText size={14} />;
            case 'html': return <Code size={14} />;
            case 'screenshot': return <ImageIcon size={14} />;
            case 'extract': return <Zap size={14} />;
            default: return <Tag size={14} />;
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-slate-50/50">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center">
                        <Globe size={16} className="text-orange-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 tracking-tight">AI Web Scraper</h2>
                        <p className="text-[11px] text-slate-500 font-medium">Powered by Firecrawl API</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 border border-slate-200 rounded-lg">
                        <Coins size={14} className="text-amber-500" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none">Credits</span>
                            <span className="text-xs font-black text-slate-800 leading-none mt-0.5">
                                {loadingCredits ? '...' : formatCreditValue(credits?.remaining)}
                            </span>
                        </div>
                        {typeof credits?.extra_credits === 'number' && credits.extra_credits > 0 && (
                            <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 border border-amber-200">
                                +{formatCreditValue(credits.extra_credits)} extra
                            </span>
                        )}
                        <button onClick={fetchCredits} className="ml-1 p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-slate-600 transition-colors">
                            <RefreshCw size={12} className={loadingCredits ? "animate-spin" : ""} />
                        </button>
                    </div>

                    <div className="w-px h-6 bg-slate-200 mx-1"></div>

                    <div className="flex items-center gap-1">
                        {STEPS.map((label, i) => {
                            const s = i + 1;
                            return (
                                <div key={s} className="flex items-center">
                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                        step === s ? 'bg-orange-500 text-white shadow-sm' :
                                        step > s ? 'bg-orange-50 text-orange-600' :
                                        'bg-transparent text-slate-400'
                                    }`}>
                                        <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-black ${
                                            step === s ? 'bg-white text-orange-600' :
                                            step > s ? 'bg-orange-200 text-orange-700' :
                                            'bg-slate-200 text-slate-500'
                                        }`}>{step > s ? '✓' : s}</span>
                                        {label}
                                    </div>
                                    {s < STEPS.length && <div className={`w-3 h-[2px] mx-0.5 rounded-full ${step > s ? 'bg-orange-200' : 'bg-slate-200'}`} />}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="max-w-4xl mx-auto">
                    {step === 1 && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-800 mb-1">Extraction Formats</h3>
                                <p className="text-xs text-slate-500 mb-4">Select the data formats you want to extract from the target pages.</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {formats.map(format => {
                                        const isSelected = selectedFormats.includes(format.id);
                                        return (
                                            <div
                                                key={format.id}
                                                onClick={() => toggleFormat(format.id)}
                                                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                                    isSelected
                                                        ? 'border-orange-400 bg-orange-50 shadow-sm shadow-orange-100/50'
                                                        : 'border-slate-200 bg-white hover:border-orange-200'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <div className={`p-1.5 rounded-md ${isSelected ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                        {getFormatIcon(format.id)}
                                                    </div>
                                                    <h3 className="font-bold text-xs text-slate-800">{format.name}</h3>
                                                </div>
                                                <p className="text-[10px] text-slate-500 leading-tight">{format.description}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <AnimatePresence>
                                {selectedFormats.includes('extract') && (
                                    <motion.div 
                                        initial={{ opacity: 0, height: 0 }} 
                                        animate={{ opacity: 1, height: 'auto' }} 
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-5 shadow-sm">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Zap size={16} className="text-indigo-500" />
                                                <label className="block text-sm font-bold text-indigo-900">AI Extraction Prompt</label>
                                            </div>
                                            <p className="text-xs text-indigo-700/70 mb-3">Describe exactly what data points the AI should extract from the page into a structured JSON format.</p>
                                            <textarea 
                                                value={extractPrompt} 
                                                onChange={e => setExtractPrompt(e.target.value)}
                                                placeholder="e.g. Extract the product name, price, description, and an array of customer reviews with their ratings."
                                                rows={3}
                                                className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-white/80 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 outline-none resize-none transition-all placeholder:text-slate-400" 
                                            />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                                <label className="block text-sm font-bold text-slate-800 mb-1">Test & Preview</label>
                                <p className="text-xs text-slate-500 mb-4">Enter a single URL to test your configuration before running a batch scrape.</p>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Link size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input type="url" value={url} onChange={e => setUrl(e.target.value)}
                                            placeholder="https://example.com/page"
                                            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 outline-none transition-all" />
                                    </div>
                                    <button onClick={handlePreview} disabled={!url || selectedFormats.length === 0 || loading || (selectedFormats.includes('extract') && !extractPrompt)}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 text-white rounded-lg font-bold text-xs transition-all shadow-sm">
                                        <Eye size={14} /> {loading ? 'Loading...' : 'Preview'}
                                    </button>
                                </div>
                                {(selectedFormats.includes('extract') && !extractPrompt) && (
                                    <p className="text-[10px] text-red-500 mt-2 font-medium">An extraction prompt is required when AI Extraction is selected.</p>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && previewData && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-bold text-slate-800">Preview Results</h3>
                                    <p className="text-xs text-slate-500">Review the extracted data from your test URL.</p>
                                </div>
                                <button onClick={() => setStep(1)} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                                    <ArrowLeft size={14} /> Back to Config
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {previewData.map((item, idx) => (
                                    <div key={idx} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-600 truncate">{item.url}</span>
                                        </div>
                                        <div className="p-4 space-y-4">
                                            {Object.entries(item).filter(([k]) => k !== 'url').map(([key, value]) => (
                                                <div key={key}>
                                                    <p className="text-[10px] font-black text-orange-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                        <Box size={10} /> {key.replace('_', ' ')}
                                                    </p>
                                                    {key === 'screenshot_url' ? (
                                                        <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                                                            <img src={value} alt="Page Screenshot" className="max-w-full h-auto object-contain max-h-[300px] mx-auto" />
                                                        </div>
                                                    ) : key === 'markdown' || key === 'html' ? (
                                                        <div className="bg-slate-900 text-slate-300 p-3 rounded-lg text-xs font-mono overflow-auto max-h-[200px] whitespace-pre-wrap">
                                                            {String(value)}
                                                        </div>
                                                    ) : typeof value === 'object' ? (
                                                        <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs font-mono overflow-auto max-h-[200px]">
                                                            <pre>{JSON.stringify(value, null, 2)}</pre>
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-slate-800 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-100">{String(value)}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-white border border-orange-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-bl-[100px] -z-10"></div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Batch Scrape URLs</label>
                                <p className="text-xs text-slate-500 mb-3">Ready? Enter one URL per line to scrape multiple pages using this configuration.</p>
                                <textarea value={urls} onChange={e => setUrls(e.target.value)}
                                    placeholder={"https://example.com/page1\nhttps://example.com/page2"}
                                    rows={4}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 outline-none resize-none transition-all" />
                                <div className="flex justify-end mt-4">
                                    <button onClick={handleExecute} disabled={loading || !urls.trim()}
                                        className="flex items-center gap-1.5 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg font-bold text-sm transition-all shadow-md shadow-orange-500/20 hover:-translate-y-0.5">
                                        {loading ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />} 
                                        {loading ? 'Scraping...' : 'Start Batch Scrape'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm">
                            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
                                <CheckCircle className="text-emerald-500" size={32} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Scraping Complete!</h3>
                            <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">All URLs have been successfully processed through Firecrawl. Your data is ready in the pipeline.</p>
                            <button onClick={() => onComplete && onComplete()}
                                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-sm transition-all shadow-md">
                                Continue to Pipeline
                            </button>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}
