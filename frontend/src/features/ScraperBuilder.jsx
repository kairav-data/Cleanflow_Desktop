import React, { useEffect, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    CheckCircle,
    Code,
    Coins,
    Download,
    Eye,
    FileSpreadsheet,
    FileText,
    Globe,
    Image as ImageIcon,
    Link,
    Monitor,
    Play,
    RefreshCw,
    Settings2,
    Table2,
    Tag,
    Zap
} from 'lucide-react';
import { API_BASE } from '../lib/runtimeConfig';

const STEPS = ['Configure', 'Preview', 'Results'];

const COUNTRY_OPTIONS = [
    { code: 'US', label: 'United States' },
    { code: 'IN', label: 'India' },
    { code: 'GB', label: 'United Kingdom' },
    { code: 'AU', label: 'Australia' },
    { code: 'CA', label: 'Canada' },
    { code: 'DE', label: 'Germany' },
    { code: 'FR', label: 'France' },
    { code: 'ES', label: 'Spain' },
    { code: 'JP', label: 'Japan' },
    { code: 'SG', label: 'Singapore' },
    { code: 'AE', label: 'United Arab Emirates' }
];

const LANGUAGE_OPTIONS = [
    { value: 'en-US', label: 'English (US)' },
    { value: 'en-IN', label: 'English (India)' },
    { value: 'en-GB', label: 'English (UK)' },
    { value: 'hi-IN', label: 'Hindi (India)' },
    { value: 'de-DE', label: 'German' },
    { value: 'fr-FR', label: 'French' },
    { value: 'es-ES', label: 'Spanish' },
    { value: 'ja-JP', label: 'Japanese' },
    { value: 'ar-AE', label: 'Arabic (UAE)' }
];

const VIEWPORT_PRESETS = {
    desktop: { label: 'Desktop', width: 1440, height: 900 },
    laptop: { label: 'Laptop', width: 1280, height: 800 },
    tablet: { label: 'Tablet', width: 834, height: 1194 },
    mobile: { label: 'Mobile', width: 390, height: 844 }
};

const normalizeRow = (row) => {
    const normalized = {};
    Object.entries(row || {}).forEach(([key, value]) => {
        if (value === null || value === undefined) {
            normalized[key] = '';
        } else if (typeof value === 'object') {
            normalized[key] = JSON.stringify(value);
        } else {
            normalized[key] = value;
        }
    });
    return normalized;
};

const downloadBlob = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};

const downloadFileFromUrl = async (fileUrl, fallbackName) => {
    if (!fileUrl) return;
    const response = await fetch(fileUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fallbackName;
    link.click();
    URL.revokeObjectURL(url);
};

const formatLabel = (value) => value.replaceAll('_', ' ');

export default function ScraperBuilder({ onComplete }) {
    const MotionDiv = motion.div;
    const [formats, setFormats] = useState([]);
    const [selectedFormats, setSelectedFormats] = useState(['markdown']);
    const [extractPrompt, setExtractPrompt] = useState('');
    const [url, setUrl] = useState('');
    const [urls, setUrls] = useState('');
    const [previewData, setPreviewData] = useState(null);
    const [batchResults, setBatchResults] = useState([]);
    const [executionMetadata, setExecutionMetadata] = useState(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);

    const [country, setCountry] = useState('US');
    const [language, setLanguage] = useState('en-US');
    const [screenshotOptions, setScreenshotOptions] = useState({
        full_page: true,
        quality: 85,
        viewport_preset: 'desktop',
        viewport_width: VIEWPORT_PRESETS.desktop.width,
        viewport_height: VIEWPORT_PRESETS.desktop.height
    });

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
        } catch (e) {
            console.error('Error fetching formats:', e);
        }
    };

    const fetchCredits = async () => {
        setLoadingCredits(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.get(`${API_BASE}/features/scraper/credits`, { headers });
            setCredits(res.data);
        } catch (e) {
            console.error('Error fetching credits:', e);
        } finally {
            setLoadingCredits(false);
        }
    };

    const toggleFormat = (formatId) => {
        setSelectedFormats((current) => (
            current.includes(formatId)
                ? current.filter((id) => id !== formatId)
                : [...current, formatId]
        ));
    };

    const updateViewportPreset = (preset) => {
        const viewport = VIEWPORT_PRESETS[preset];
        setScreenshotOptions((current) => ({
            ...current,
            viewport_preset: preset,
            viewport_width: viewport.width,
            viewport_height: viewport.height
        }));
    };

    const buildScrapeConfig = (targetConfig) => ({
        ...targetConfig,
        formats: selectedFormats,
        extract_prompt: extractPrompt,
        location: {
            country,
            languages: [language]
        },
        screenshot_options: selectedFormats.includes('screenshot')
            ? {
                full_page: screenshotOptions.full_page,
                quality: Number(screenshotOptions.quality),
                viewport_width: Number(screenshotOptions.viewport_width),
                viewport_height: Number(screenshotOptions.viewport_height)
            }
            : undefined
    });

    const handlePreview = async () => {
        if (!url || selectedFormats.length === 0) return;
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const payload = buildScrapeConfig({ url });
            const res = await axios.post(`${API_BASE}/features/scraper/preview`, payload, { headers });
            setPreviewData(res.data.data || []);
            setStep(2);
            fetchCredits();
        } catch (e) {
            alert('Preview failed: ' + (e.response?.data?.detail || e.message));
        } finally {
            setLoading(false);
        }
    };

    const handleExecute = async () => {
        const urlList = urls.split('\n').map((item) => item.trim()).filter(Boolean);
        if (urlList.length === 0) return;
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const payload = buildScrapeConfig({ urls: urlList });
            const res = await axios.post(`${API_BASE}/features/scraper/execute`, payload, { headers });

            try {
                await axios.post(`${API_BASE}/history/jobs`, {
                    session_id: `scrape_${Date.now()}`,
                    file_name: `${urlList.length} URLs (Firecrawl)`,
                    rules: [{
                        formats: selectedFormats,
                        count: urlList.length,
                        country,
                        language
                    }],
                    total_rows: urlList.length,
                    valid_rows: urlList.length,
                    invalid_rows: 0,
                    module: 'scraper'
                }, { headers });
            } catch (histErr) {
                console.error('Failed to save history:', histErr);
            }

            setBatchResults(res.data.data || []);
            setExecutionMetadata(res.data.metadata || null);
            setStep(3);
            fetchCredits();
        } catch (e) {
            alert('Scraping failed: ' + (e.response?.data?.detail || e.message));
        } finally {
            setLoading(false);
        }
    };

    const getFormatIcon = (id) => {
        switch (id) {
            case 'markdown':
                return <FileText size={14} />;
            case 'html':
                return <Code size={14} />;
            case 'screenshot':
                return <ImageIcon size={14} />;
            case 'extract':
                return <Zap size={14} />;
            default:
                return <Tag size={14} />;
        }
    };

    const exportRows = batchResults.map(normalizeRow);
    const exportFilenameBase = `cleanflow-scrape-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
    const previewColumns = Array.from(new Set(exportRows.flatMap((row) => Object.keys(row))));
    const successfulRows = batchResults.filter((row) => row.status === 'success').length;
    const failedRows = batchResults.length - successfulRows;

    const handleDownloadCsv = () => {
        if (!exportRows.length) return;
        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        downloadBlob(csv, `${exportFilenameBase}.csv`, 'text/csv;charset=utf-8;');
    };

    const handleDownloadExcel = () => {
        if (!exportRows.length) return;
        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Scraped Data');
        XLSX.writeFile(workbook, `${exportFilenameBase}.xlsx`);
    };

    return (
        <div className="w-full h-full flex flex-col bg-slate-50/50">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center shadow-sm">
                        <Globe size={17} className="text-orange-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 tracking-tight">AI Web Scraper</h2>
                        <p className="text-[11px] text-slate-500 font-medium">Localized scraping, configurable screenshots, and export-ready data</p>
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
                            <RefreshCw size={12} className={loadingCredits ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    <div className="w-px h-6 bg-slate-200 mx-1"></div>

                    <div className="flex items-center gap-1">
                        {STEPS.map((label, index) => {
                            const currentStep = index + 1;
                            const isComplete = step > currentStep;
                            const isActive = step === currentStep;
                            return (
                                <div key={currentStep} className="flex items-center">
                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                        isActive ? 'bg-orange-500 text-white shadow-sm' :
                                        isComplete ? 'bg-orange-50 text-orange-600' :
                                        'bg-transparent text-slate-400'
                                    }`}>
                                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${
                                            isActive ? 'bg-white text-orange-600' :
                                            isComplete ? 'bg-orange-200 text-orange-700' :
                                            'bg-slate-200 text-slate-500'
                                        }`}>
                                            {isComplete ? <CheckCircle size={10} /> : currentStep}
                                        </span>
                                        {label}
                                    </div>
                                    {currentStep < STEPS.length && (
                                        <div className={`w-3 h-[2px] mx-0.5 rounded-full ${isComplete ? 'bg-orange-200' : 'bg-slate-200'}`} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="max-w-5xl mx-auto">
                    {step === 1 && (
                        <MotionDiv initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                            <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_1fr] gap-4">
                                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                    <h3 className="text-xs font-bold text-slate-800 mb-1">Extraction Formats</h3>
                                    <p className="text-xs text-slate-500 mb-4">Choose the outputs you want from each page. Combine readable content, screenshots, and structured extraction in one run.</p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {formats.map((format) => {
                                            const isSelected = selectedFormats.includes(format.id);
                                            return (
                                                <div
                                                    key={format.id}
                                                    onClick={() => toggleFormat(format.id)}
                                                    className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                                                        isSelected
                                                            ? 'border-orange-300 bg-orange-50 shadow-sm shadow-orange-100/60'
                                                            : 'border-slate-200 bg-white hover:border-orange-200 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <div className={`p-1.5 rounded-md ${isSelected ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                            {getFormatIcon(format.id)}
                                                        </div>
                                                        <h3 className="font-bold text-[11px] text-slate-800">{format.name}</h3>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 leading-tight">{format.description}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3 mb-4">
                                        <div>
                                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 font-bold">Scrape Profile</p>
                                            <h3 className="text-xs font-bold text-slate-800 mt-1">Current Request</h3>
                                        </div>
                                        <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                                            {selectedFormats.length} outputs
                                        </div>
                                    </div>
                                    <div className="space-y-2.5">
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                            <p className="text-[10px] uppercase tracking-wide text-slate-500 font-bold mb-1">Country</p>
                                            <p className="text-[13px] font-semibold text-slate-900">{COUNTRY_OPTIONS.find((item) => item.code === country)?.label}</p>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                            <p className="text-[10px] uppercase tracking-wide text-slate-500 font-bold mb-1">Language</p>
                                            <p className="text-[13px] font-semibold text-slate-900">{LANGUAGE_OPTIONS.find((item) => item.value === language)?.label}</p>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                            <p className="text-[10px] uppercase tracking-wide text-slate-500 font-bold mb-1">Active Outputs</p>
                                            <p className="text-[13px] font-semibold text-slate-900">{selectedFormats.join(', ')}</p>
                                        </div>
                                        {selectedFormats.includes('screenshot') && (
                                            <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5">
                                                <p className="text-[10px] uppercase tracking-wide text-orange-600 font-bold mb-1">Screenshot</p>
                                                <p className="text-[13px] font-semibold text-slate-900">
                                                    {screenshotOptions.full_page ? 'Full page' : 'Viewport only'} at {screenshotOptions.viewport_width} x {screenshotOptions.viewport_height}
                                                </p>
                                            </div>
                                        )}
                                        {!selectedFormats.includes('screenshot') && (
                                            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-center">
                                                <ImageIcon size={16} className="text-slate-300 mx-auto mb-1.5" />
                                                <p className="text-[11px] font-semibold text-slate-600">Screenshot controls stay hidden until needed</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-4">
                                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Globe size={15} className="text-sky-500" />
                                        <h3 className="text-xs font-bold text-slate-800">Location & Language</h3>
                                    </div>
                                    <p className="text-xs text-slate-500 mb-4">Send Firecrawl a regional country and language preference so page rendering aligns better with your target market.</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Country</label>
                                            <select
                                                value={country}
                                                onChange={(e) => setCountry(e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[13px] text-slate-900 bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 outline-none transition-all"
                                            >
                                                {COUNTRY_OPTIONS.map((option) => (
                                                    <option key={option.code} value={option.code}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Language</label>
                                            <select
                                                value={language}
                                                onChange={(e) => setLanguage(e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[13px] text-slate-900 bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 outline-none transition-all"
                                            >
                                                {LANGUAGE_OPTIONS.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <AnimatePresence mode="wait">
                                    {selectedFormats.includes('screenshot') ? (
                                        <MotionDiv
                                            key="screenshot-settings"
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 6 }}
                                        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm"
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <Settings2 size={15} className="text-violet-500" />
                                                <h3 className="text-xs font-bold text-slate-800">Screenshot Settings</h3>
                                            </div>
                                            <p className="text-xs text-slate-500 mb-3">Compact controls for full-page capture, viewport size, and image quality.</p>
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                                    <div>
                                                        <p className="text-[13px] font-semibold text-slate-800">Full page screenshot</p>
                                                        <p className="text-[11px] text-slate-500">Include the entire scrollable page, not just the visible viewport.</p>
                                                    </div>
                                                    <label className="inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={screenshotOptions.full_page}
                                                            onChange={(e) => setScreenshotOptions((current) => ({ ...current, full_page: e.target.checked }))}
                                                            className="sr-only peer"
                                                        />
                                                        <span className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-orange-500 relative transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:bg-white after:rounded-full after:transition-transform peer-checked:after:translate-x-5" />
                                                    </label>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Viewport preset</label>
                                                        <div className="grid grid-cols-4 gap-2">
                                                            {Object.entries(VIEWPORT_PRESETS).map(([presetKey, preset]) => (
                                                                <button
                                                                    key={presetKey}
                                                                    type="button"
                                                                    onClick={() => updateViewportPreset(presetKey)}
                                                                    className={`rounded-xl border px-2 py-2 text-[11px] font-bold transition-all ${
                                                                        screenshotOptions.viewport_preset === presetKey
                                                                            ? 'border-violet-300 bg-violet-50 text-violet-700'
                                                                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                                                    }`}
                                                                >
                                                                    <Monitor size={12} className="mx-auto mb-1" />
                                                                    {preset.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Image quality</label>
                                                        <select
                                                            value={screenshotOptions.quality}
                                                            onChange={(e) => setScreenshotOptions((current) => ({ ...current, quality: Number(e.target.value) }))}
                                                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[13px] text-slate-900 bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 outline-none transition-all"
                                                        >
                                                            <option value={60}>60% - Lightweight</option>
                                                            <option value={75}>75% - Balanced</option>
                                                            <option value={85}>85% - Crisp</option>
                                                            <option value={100}>100% - Maximum quality</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Viewport width</label>
                                                        <input
                                                            type="number"
                                                            min="320"
                                                            max="7680"
                                                            value={screenshotOptions.viewport_width}
                                                            onChange={(e) => setScreenshotOptions((current) => ({ ...current, viewport_width: Number(e.target.value) }))}
                                                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[13px] text-slate-900 bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 outline-none transition-all"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Viewport height</label>
                                                        <input
                                                            type="number"
                                                            min="240"
                                                            max="4320"
                                                            value={screenshotOptions.viewport_height}
                                                            onChange={(e) => setScreenshotOptions((current) => ({ ...current, viewport_height: Number(e.target.value) }))}
                                                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[13px] text-slate-900 bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 outline-none transition-all"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </MotionDiv>
                                    ) : (
                                        <MotionDiv
                                            key="screenshot-empty"
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 6 }}
                                            className="bg-white border border-dashed border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-center text-center"
                                        >
                                            <div>
                                                <ImageIcon size={16} className="text-slate-300 mx-auto mb-2" />
                                                <p className="text-[13px] font-semibold text-slate-700">Screenshot options appear when Screenshot is selected</p>
                                                <p className="text-xs text-slate-500 mt-1">Keep the configuration panel focused until you need image capture.</p>
                                            </div>
                                        </MotionDiv>
                                    )}
                                </AnimatePresence>
                            </div>

                            <AnimatePresence>
                                {selectedFormats.includes('extract') && (
                                    <MotionDiv
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="bg-gradient-to-br from-indigo-50 to-sky-50 border border-indigo-100 rounded-2xl p-5 shadow-sm">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Zap size={16} className="text-indigo-500" />
                                                <label className="block text-sm font-bold text-indigo-900">AI Extraction Prompt</label>
                                            </div>
                                            <p className="text-xs text-indigo-700/70 mb-3">Describe the fields you want extracted into a structured table. Clear prompts make CSV and Excel downloads much more useful.</p>
                                            <textarea
                                                value={extractPrompt}
                                                onChange={(e) => setExtractPrompt(e.target.value)}
                                                placeholder="Example: Extract product name, price, rating, availability, and product URL."
                                                rows={4}
                                                className="w-full px-3 py-2.5 border border-indigo-200 rounded-xl text-[13px] text-slate-900 bg-white/95 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 outline-none resize-none transition-all placeholder:text-slate-400"
                                            />
                                        </div>
                                    </MotionDiv>
                                )}
                            </AnimatePresence>

                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                <label className="block text-sm font-bold text-slate-800 mb-1">Test & Preview</label>
                                <p className="text-xs text-slate-500 mb-4">Preview one page first so you can confirm language, content, and screenshot behavior before running a larger batch.</p>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <div className="relative flex-1">
                                        <Link size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="url"
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                            placeholder="https://example.com/page"
                                            className="w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-xl text-[13px] text-slate-900 placeholder:text-slate-400 bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 outline-none transition-all"
                                        />
                                    </div>
                                    <button
                                        onClick={handlePreview}
                                        disabled={!url || selectedFormats.length === 0 || loading || (selectedFormats.includes('extract') && !extractPrompt)}
                                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 text-white rounded-xl font-bold text-sm transition-all shadow-sm"
                                    >
                                        <Eye size={14} /> {loading ? 'Loading...' : 'Preview'}
                                    </button>
                                </div>
                                {selectedFormats.includes('extract') && !extractPrompt && (
                                    <p className="text-[10px] text-red-500 mt-2 font-medium">An extraction prompt is required when AI Extraction is selected.</p>
                                )}
                            </div>
                        </MotionDiv>
                    )}

                    {step === 2 && previewData && (
                        <MotionDiv initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <h3 className="text-base font-bold text-slate-800">Preview Results</h3>
                                    <p className="text-xs text-slate-500">Confirm the page output before launching the batch scrape.</p>
                                </div>
                                <button onClick={() => setStep(1)} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                                    <ArrowLeft size={14} /> Back to Config
                                </button>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <p className="text-[11px] uppercase tracking-wide font-bold text-slate-500">Country</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">{COUNTRY_OPTIONS.find((item) => item.code === country)?.label}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <p className="text-[11px] uppercase tracking-wide font-bold text-slate-500">Language</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">{LANGUAGE_OPTIONS.find((item) => item.value === language)?.label}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <p className="text-[11px] uppercase tracking-wide font-bold text-slate-500">Screenshot</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">
                                        {selectedFormats.includes('screenshot')
                                            ? `${screenshotOptions.full_page ? 'Full page' : 'Viewport'} at ${screenshotOptions.viewport_width} x ${screenshotOptions.viewport_height}`
                                            : 'Not selected'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {previewData.map((item, idx) => (
                                    <div key={idx} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-600 truncate">{item.url}</span>
                                            <span className="text-[10px] uppercase tracking-wide font-bold text-slate-400">{selectedFormats.length} outputs</span>
                                        </div>
                                        <div className="p-4 space-y-4">
                                            {Object.entries(item).filter(([key]) => key !== 'url').map(([key, value]) => (
                                                <div key={key}>
                                                    <p className="text-[10px] font-black text-orange-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                        <Table2 size={10} /> {formatLabel(key)}
                                                    </p>
                                                    {key === 'screenshot_url' ? (
                                                        <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                                                            <img src={value} alt="Page Screenshot" className="max-w-full h-auto object-contain max-h-[340px] mx-auto" />
                                                            <div className="flex justify-end gap-2 px-3 py-2 border-t border-slate-200 bg-white">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => downloadFileFromUrl(String(value), `scrape-preview-screenshot-${idx + 1}.png`)}
                                                                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                                                >
                                                                    <Download size={13} /> Download Screenshot
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : key === 'markdown' || key === 'html' ? (
                                                        <div className="bg-slate-50 border border-slate-200 text-slate-700 p-3 rounded-xl text-[12px] font-mono overflow-auto max-h-[220px] whitespace-pre-wrap">
                                                            {String(value)}
                                                        </div>
                                                    ) : typeof value === 'object' ? (
                                                        <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-[12px] font-mono overflow-auto max-h-[220px]">
                                                            <pre className="whitespace-pre-wrap break-words">{JSON.stringify(value, null, 2)}</pre>
                                                        </div>
                                                    ) : (
                                                        <p className="text-[13px] text-slate-800 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-100">{String(value)}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-white border border-orange-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/5 rounded-bl-[120px] -z-10"></div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Batch Scrape URLs</label>
                                <p className="text-xs text-slate-500 mb-3">Enter one URL per line. The same country, language, and screenshot settings will be used across the full run.</p>
                                <textarea
                                    value={urls}
                                    onChange={(e) => setUrls(e.target.value)}
                                    placeholder={'https://example.com/page1\nhttps://example.com/page2'}
                                    rows={5}
                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-[13px] text-slate-900 placeholder:text-slate-400 font-mono bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 outline-none resize-none transition-all"
                                />
                                <div className="flex justify-end mt-4">
                                    <button
                                        onClick={handleExecute}
                                        disabled={loading || !urls.trim()}
                                        className="flex items-center gap-1.5 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-orange-500/20 hover:-translate-y-0.5"
                                    >
                                        {loading ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                                        {loading ? 'Scraping...' : 'Start Batch Scrape'}
                                    </button>
                                </div>
                            </div>
                        </MotionDiv>
                    )}

                    {step === 3 && (
                        <MotionDiv initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-5">
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
                                            <CheckCircle className="text-emerald-500" size={30} />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-1">Scraping Complete</h3>
                                            <p className="text-slate-500 text-sm max-w-2xl">Review the scraped dataset below or download it directly as CSV or Excel. This view is optimized for quick QA before you move on.</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 xl:min-w-[520px]">
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={handleDownloadCsv}
                                                disabled={!exportRows.length}
                                                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                                            >
                                                <Download size={16} /> Download CSV
                                            </button>
                                            <button
                                                onClick={handleDownloadExcel}
                                                disabled={!exportRows.length}
                                                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                                            >
                                                <FileSpreadsheet size={16} /> Download Excel
                                            </button>
                                            {batchResults.some((row) => row.screenshot_url) && (
                                                <button
                                                    onClick={() => {
                                                        const firstScreenshot = batchResults.find((row) => row.screenshot_url)?.screenshot_url;
                                                        if (firstScreenshot) {
                                                            downloadFileFromUrl(String(firstScreenshot), 'scrape-screenshot.png');
                                                        }
                                                    }}
                                                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                                >
                                                    <ImageIcon size={16} /> Download Screenshot
                                                </button>
                                            )}
                                        </div>
                                        {onComplete && (
                                            <button
                                                onClick={() => onComplete({ rows: batchResults, metadata: executionMetadata })}
                                                className="shrink-0 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
                                            >
                                                Continue
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <p className="text-[11px] uppercase tracking-wide font-bold text-slate-500">Total URLs</p>
                                    <p className="mt-2 text-2xl font-black text-slate-900">{batchResults.length.toLocaleString()}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <p className="text-[11px] uppercase tracking-wide font-bold text-slate-500">Successful</p>
                                    <p className="mt-2 text-2xl font-black text-emerald-600">{successfulRows.toLocaleString()}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <p className="text-[11px] uppercase tracking-wide font-bold text-slate-500">Failed</p>
                                    <p className="mt-2 text-2xl font-black text-rose-600">{failedRows.toLocaleString()}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <p className="text-[11px] uppercase tracking-wide font-bold text-slate-500">Formats Used</p>
                                    <p className="mt-2 text-sm font-bold text-slate-900">{selectedFormats.join(', ')}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                    <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-900">Tabular Data Preview</h4>
                                            <p className="text-xs text-slate-500">All extracted columns are shown here. Scroll horizontally to inspect the full schema.</p>
                                        </div>
                                        <span className="text-[11px] uppercase tracking-wide font-bold text-slate-400">{exportRows.length} rows</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-max w-full text-sm">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    {previewColumns.map((column) => (
                                                        <th key={column} className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide text-slate-500 border-b border-slate-200">
                                                            {formatLabel(column)}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {exportRows.slice(0, 8).map((row, rowIndex) => (
                                                    <tr key={rowIndex} className="border-b border-slate-100 last:border-b-0">
                                                        {previewColumns.map((column) => (
                                                            <td key={column} className="px-4 py-3 align-top text-slate-700 min-w-[180px] max-w-[320px]">
                                                                <div className="break-words whitespace-pre-wrap">{String(row[column] ?? '')}</div>
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                        <h4 className="text-sm font-bold text-slate-900 mb-3">Run Profile</h4>
                                        <div className="space-y-3 text-sm">
                                            <div className="flex justify-between gap-4">
                                                <span className="text-slate-500">Country</span>
                                                <span className="font-semibold text-slate-900 text-right">{COUNTRY_OPTIONS.find((item) => item.code === country)?.label}</span>
                                            </div>
                                            <div className="flex justify-between gap-4">
                                                <span className="text-slate-500">Language</span>
                                                <span className="font-semibold text-slate-900 text-right">{LANGUAGE_OPTIONS.find((item) => item.value === language)?.label}</span>
                                            </div>
                                            <div className="flex justify-between gap-4">
                                                <span className="text-slate-500">Screenshot</span>
                                                <span className="font-semibold text-slate-900 text-right">
                                                    {selectedFormats.includes('screenshot')
                                                        ? `${screenshotOptions.full_page ? 'Full page' : 'Viewport'}`
                                                        : 'Off'}
                                                </span>
                                            </div>
                                            {selectedFormats.includes('screenshot') && (
                                                <div className="flex justify-between gap-4">
                                                    <span className="text-slate-500">Viewport</span>
                                                    <span className="font-semibold text-slate-900 text-right">
                                                        {screenshotOptions.viewport_width} x {screenshotOptions.viewport_height}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                        <h4 className="text-sm font-bold text-slate-900 mb-3">Export Notes</h4>
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            Nested objects are flattened into JSON strings in the exported files so the dataset stays compatible with spreadsheet tools.
                                        </p>
                                        {executionMetadata && (
                                            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                                <p className="text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1">Execution Metadata</p>
                                                <p className="text-xs text-slate-600">Successful: {executionMetadata.successful ?? successfulRows}</p>
                                                <p className="text-xs text-slate-600">Failed: {executionMetadata.failed ?? failedRows}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </MotionDiv>
                    )}
                </div>
            </div>
        </div>
    );
}
