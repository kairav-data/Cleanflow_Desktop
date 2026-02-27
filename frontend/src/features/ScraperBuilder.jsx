import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Globe, Play, Eye, CheckCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'import.meta.env.VITE_API_URL';

export default function ScraperBuilder({ onComplete }) {
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [url, setUrl] = useState('');
    const [urls, setUrls] = useState('');
    const [previewData, setPreviewData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const res = await axios.get(`${API_BASE}/features/scraper/templates`);
            setTemplates(res.data.templates || []);
        } catch (e) {
            console.error('Error fetching templates:', e);
        }
    };

    const handlePreview = async () => {
        if (!url || !selectedTemplate) return;

        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/features/scraper/preview`, {
                url,
                template: selectedTemplate.id
            });
            setPreviewData(res.data.data);
            setStep(2);
        } catch (e) {
            alert('Preview failed: ' + (e.response?.data?.detail || e.message));
        }
        setLoading(false);
    };

    const handleExecute = async () => {
        const urlList = urls.split('\n').filter(u => u.trim());
        if (urlList.length === 0) return;

        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/features/scraper/execute`, {
                urls: urlList,
                template: selectedTemplate.id
            });

            try {
                // Log history
                const token = localStorage.getItem('token');
                const headers = token ? { Authorization: `Bearer ${token}` } : {};

                await axios.post(`${API_BASE}/history/jobs`, {
                    session_id: `scrape_${Date.now()}`,
                    file_name: `${urlList.length} URLs (Template: ${selectedTemplate.name})`,
                    rules: [{ template: selectedTemplate.name, count: urlList.length }],
                    total_rows: urlList.length,
                    valid_rows: urlList.length,
                    invalid_rows: 0,
                    module: 'scraper'
                }, { headers });
            } catch (histErr) {
                console.error("Failed to save history:", histErr);
            }

            setStep(3);
            if (onComplete) onComplete(res.data);
        } catch (e) {
            alert('Scraping failed: ' + (e.response?.data?.detail || e.message));
        }
        setLoading(false);
    };

    return (
        <div className="bg-white p-12 rounded-[48px] shadow-2xl">
            <div className="mb-10 text-center">
                <div className="inline-flex items-center gap-2 mb-4">
                    <Globe className="text-orange-600" size={32} />
                    <h2 className="text-4xl font-black text-slate-900">Web Scraping</h2>
                </div>
                <p className="text-slate-500 font-medium">Extract data from websites with pre-built templates</p>
            </div>

            {step === 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="mb-8">
                        <label className="block text-sm font-bold text-slate-700 mb-3">Choose Template</label>
                        <div className="grid grid-cols-1 gap-4">
                            {templates.map(template => (
                                <motion.div
                                    key={template.id}
                                    whileHover={{ scale: 1.01 }}
                                    onClick={() => setSelectedTemplate(template)}
                                    className={`p-6 rounded-2xl border-2 cursor-pointer ${selectedTemplate?.id === template.id
                                        ? 'border-orange-500 bg-orange-50'
                                        : 'border-slate-200 hover:border-orange-300'
                                        }`}
                                >
                                    <h3 className="font-black text-lg mb-2">{template.name}</h3>
                                    <p className="text-sm text-slate-600 mb-3">{template.description}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {template.fields.map(field => (
                                            <span key={field} className="text-xs px-2 py-1 bg-slate-100 rounded-lg">{field}</span>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2">Example: {template.example_url}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    <div className="mb-8">
                        <label className="block text-sm font-bold text-slate-700 mb-3">Enter URL to Preview</label>
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com/page"
                            className="w-full p-4 border-2 border-slate-200 rounded-2xl text-lg focus:border-orange-500 focus:outline-none"
                        />
                    </div>

                    <button
                        onClick={handlePreview}
                        disabled={!url || !selectedTemplate || loading}
                        className="w-full py-4 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-2"
                    >
                        <Eye size={20} /> {loading ? 'Loading...' : 'Preview Scraping'}
                    </button>
                </motion.div>
            )}

            {step === 2 && previewData && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="mb-6">
                        <h3 className="text-xl font-black mb-4">Preview Results</h3>
                        <div className="bg-slate-50 p-6 rounded-2xl">
                            {previewData.map((item, idx) => (
                                <div key={idx} className="mb-4">
                                    {Object.entries(item).map(([key, value]) => (
                                        <div key={key} className="mb-2">
                                            <span className="font-bold text-sm text-slate-600">{key}:</span>
                                            <p className="text-slate-900">{String(value)}</p>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-bold text-slate-700 mb-3">Enter URLs to Scrape (one per line)</label>
                        <textarea
                            value={urls}
                            onChange={(e) => setUrls(e.target.value)}
                            placeholder="https://example.com/page1&#10;https://example.com/page2"
                            rows={5}
                            className="w-full p-4 border-2 border-slate-200 rounded-2xl focus:border-orange-500 focus:outline-none"
                        />
                    </div>

                    <div className="flex gap-4">
                        <button onClick={() => setStep(1)} className="flex-1 py-4 bg-slate-200 hover:bg-slate-300 rounded-2xl font-black">
                            Back
                        </button>
                        <button
                            onClick={handleExecute}
                            disabled={loading}
                            className="flex-1 py-4 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black flex items-center justify-center gap-2"
                        >
                            <Play size={20} /> {loading ? 'Scraping...' : 'Scrape All URLs'}
                        </button>
                    </div>
                </motion.div>
            )}

            {step === 3 && (
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center py-12">
                    <CheckCircle className="mx-auto text-orange-600 mb-4" size={64} />
                    <h3 className="text-3xl font-black mb-4">Scraping Complete!</h3>
                    <p className="text-slate-600 mb-8">Data extracted successfully</p>
                    <button
                        onClick={() => onComplete && onComplete()}
                        className="px-8 py-4 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black"
                    >
                        Continue
                    </button>
                </motion.div>
            )}
        </div>
    );
}
