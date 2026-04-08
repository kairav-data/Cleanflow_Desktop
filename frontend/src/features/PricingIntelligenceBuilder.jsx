import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
    Activity,
    AlertCircle,
    CheckCircle,
    Database,
    FileSpreadsheet,
    FileText,
    Play,
    Settings,
    ShieldCheck,
    Sparkles,
    Target,
    TrendingUp,
    Upload,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const STEPS = ['Upload', 'Configure', 'Results'];
const Motion = motion;
const PRESET_SEPARATORS = [',', ';', '|'];

const SIGNAL_OPTIONS = {
    demand: [
        { value: 'auto', label: 'Auto from demand column' },
        { value: 'normal', label: 'Normal demand' },
        { value: 'rising', label: 'Rising demand' },
        { value: 'surging', label: 'Surging demand' },
    ],
    stock: [
        { value: 'auto', label: 'Auto from stock column' },
        { value: 'normal', label: 'Healthy inventory' },
        { value: 'low', label: 'Low stock' },
        { value: 'critical', label: 'Critical stock' },
    ],
    review: [
        { value: 'auto', label: 'Auto from rating columns' },
        { value: 'neutral', label: 'Neutral review position' },
        { value: 'better', label: 'Our reviews are stronger' },
        { value: 'worse', label: 'Competitors review better' },
    ],
};

const createSessionId = () => `pricing_${Date.now()}`;

const formatCurrency = (value) => {
    const num = Number(value || 0);
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
    }).format(Number.isFinite(num) ? num : 0);
};

const inferColumn = (columns, candidates) => {
    const lowered = (columns || []).map((column) => ({ original: column, lower: column.toLowerCase() }));
    const match = lowered.find(({ lower }) => candidates.some((token) => lower.includes(token)));
    return match?.original || '';
};

const normalizeSeparator = (value) => {
    if (!value) return ',';
    if (value === '\\t') return '\t';
    return value;
};

export default function PricingIntelligenceBuilder() {
    const [sessionId, setSessionId] = useState(createSessionId());
    const [algorithms, setAlgorithms] = useState([]);
    const [strategies, setStrategies] = useState([]);
    const [connections, setConnections] = useState([]);
    const [datasets, setDatasets] = useState({ our: false, competitor: false });
    const [datasetRows, setDatasetRows] = useState({ our: 0, competitor: 0 });
    const [datasetColumns, setDatasetColumns] = useState({ our: [], competitor: [] });
    const [datasetMode, setDatasetMode] = useState({ our: 'file', competitor: 'file' });
    const [datasetQueries, setDatasetQueries] = useState({
        our: 'SELECT * FROM products LIMIT 100',
        competitor: 'SELECT * FROM competitor_prices LIMIT 100',
    });
    const [datasetConnections, setDatasetConnections] = useState({ our: '', competitor: '' });
    const [separators, setSeparators] = useState({ our: ',', competitor: ',' });
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState({ percent: 0, message: '', status: 'idle' });
    const [elapsedTime, setElapsedTime] = useState(0);
    const [summary, setSummary] = useState(null);
    const [finalRows, setFinalRows] = useState([]);

    const [matchRule, setMatchRule] = useState({
        ourColumn: '',
        competitorColumn: '',
        algorithm: 'fuzzy',
        threshold: 0.82,
    });
    const [ourColumns, setOurColumns] = useState({
        productName: '',
        sku: '',
        currentPrice: '',
        cogs: '',
        fulfillment: '',
        commission: '',
        advertising: '',
        stock: '',
        demand: '',
        rating: '',
    });
    const [competitorColumns, setCompetitorColumns] = useState({
        productName: '',
        sellerName: '',
        price: '',
        rating: '',
    });
    const [strategy, setStrategy] = useState({
        position: 'match',
        adjustmentValue: 0,
        minMarginPct: 15,
        roundingStep: 1,
    });
    const [signals, setSignals] = useState({
        demandMode: 'auto',
        stockMode: 'auto',
        reviewMode: 'auto',
        demandRisingThreshold: 60,
        demandSurgingThreshold: 85,
        stockLowThreshold: 15,
        stockCriticalThreshold: 5,
        reviewDeltaThreshold: 0.2,
    });
    const [elasticity, setElasticity] = useState({
        enabled: true,
        coefficient: 1.1,
    });
    const [pricingLimits, setPricingLimits] = useState({
        minPrice: '',
        maxPrice: '',
    });

    const token = localStorage.getItem('token');
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

    useEffect(() => {
        let interval;
        if (loading) {
            const start = Date.now();
            interval = setInterval(() => setElapsedTime(Math.floor((Date.now() - start) / 1000)), 1000);
        }
        return () => clearInterval(interval);
    }, [loading]);

    useEffect(() => {
        const loadMetadata = async () => {
            try {
                const [algoRes, strategyRes] = await Promise.all([
                    axios.get(`${API_BASE}/features/pricing/algorithms`),
                    axios.get(`${API_BASE}/features/pricing/strategies`),
                ]);
                setAlgorithms(algoRes.data.algorithms || []);
                setStrategies(strategyRes.data.strategies || []);
            } catch (error) {
                console.error('Failed to load pricing metadata:', error);
            }
        };

        const loadConnections = async () => {
            if (!token) return;
            try {
                const res = await axios.get(`${API_BASE}/history/connections`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setConnections(res.data || []);
                if ((res.data || []).length > 0) {
                    setDatasetConnections({ our: res.data[0].id, competitor: res.data[0].id });
                }
            } catch (error) {
                console.error('Failed to load saved connections:', error);
            }
        };

        loadMetadata();
        loadConnections();
    }, [token]);

    const suggestColumns = (datasetId, columns) => {
        if (datasetId === 'our') {
            const suggested = {
                productName: inferColumn(columns, ['product', 'name', 'title', 'item', 'description']),
                sku: inferColumn(columns, ['sku', 'code', 'model', 'item_id', 'product_id']),
                currentPrice: inferColumn(columns, ['selling_price', 'current_price', 'price', 'our_price', 'mrp']),
                cogs: inferColumn(columns, ['cogs', 'cost', 'buying_price', 'product_cost']),
                fulfillment: inferColumn(columns, ['fulfillment', 'shipping', 'delivery', 'handling']),
                commission: inferColumn(columns, ['commission', 'platform_fee', 'fee']),
                advertising: inferColumn(columns, ['advertising', 'ad_cost', 'marketing', 'campaign']),
                stock: inferColumn(columns, ['stock', 'inventory', 'qty', 'quantity']),
                demand: inferColumn(columns, ['demand', 'velocity', 'trend', 'score']),
                rating: inferColumn(columns, ['rating', 'review']),
            };
            setOurColumns((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(suggested).filter(([, value]) => value)) }));
            setMatchRule((prev) => ({ ...prev, ourColumn: prev.ourColumn || suggested.productName || columns[0] || '' }));
            return;
        }

        const suggested = {
            productName: inferColumn(columns, ['product', 'name', 'title', 'item', 'description']),
            sellerName: inferColumn(columns, ['seller', 'competitor', 'platform', 'marketplace', 'store']),
            price: inferColumn(columns, ['selling_price', 'price', 'offer_price', 'final_price', 'mrp']),
            rating: inferColumn(columns, ['rating', 'review']),
        };
        setCompetitorColumns((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(suggested).filter(([, value]) => value)) }));
        setMatchRule((prev) => ({ ...prev, competitorColumn: prev.competitorColumn || suggested.productName || columns[0] || '' }));
    };

    const handleFileUpload = async (datasetId, file) => {
        const mappedId = datasetId === 'our' ? 'our_dataset' : 'competitor_dataset';
        try {
            const formData = new FormData();
            formData.append('session_id', sessionId);
            formData.append('dataset_id', mappedId);
            formData.append('delimiter', normalizeSeparator(separators[datasetId]));
            formData.append('file', file);
            const res = await axios.post(`${API_BASE}/features/pricing/upload-dataset`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setDatasets((prev) => ({ ...prev, [datasetId]: true }));
            setDatasetColumns((prev) => ({ ...prev, [datasetId]: res.data.columns || [] }));
            setDatasetRows((prev) => ({ ...prev, [datasetId]: res.data.rows || 0 }));
            suggestColumns(datasetId, res.data.columns || []);
        } catch (error) {
            alert('Dataset upload failed: ' + (error.response?.data?.detail || error.message));
        }
    };

    const handleDatabaseIngest = async (datasetId) => {
        const mappedId = datasetId === 'our' ? 'our_dataset' : 'competitor_dataset';
        const connectionId = datasetConnections[datasetId];
        const query = datasetQueries[datasetId];
        if (!connectionId || !query) {
            alert('Select a connection and enter a query first.');
            return;
        }
        try {
            const res = await axios.post(`${API_BASE}/features/pricing/ingest-database`, {
                session_id: sessionId,
                dataset_id: mappedId,
                connection_id: connectionId,
                query,
            }, { headers: authHeaders });
            setDatasets((prev) => ({ ...prev, [datasetId]: true }));
            setDatasetColumns((prev) => ({ ...prev, [datasetId]: res.data.columns || [] }));
            setDatasetRows((prev) => ({ ...prev, [datasetId]: res.data.rows || 0 }));
            suggestColumns(datasetId, res.data.columns || []);
        } catch (error) {
            alert('Database import failed: ' + (error.response?.data?.detail || error.message));
        }
    };

    const buildConfig = () => ({
        our_dataset: 'our_dataset',
        competitor_dataset: 'competitor_dataset',
        match_rule: {
            our_column: matchRule.ourColumn,
            competitor_column: matchRule.competitorColumn,
            algorithm: matchRule.algorithm,
            threshold: Number(matchRule.threshold),
        },
        our_columns: {
            product_name: ourColumns.productName,
            sku: ourColumns.sku,
            current_price: ourColumns.currentPrice,
            cogs: ourColumns.cogs,
            fulfillment: ourColumns.fulfillment,
            commission: ourColumns.commission,
            advertising: ourColumns.advertising,
            stock: ourColumns.stock,
            demand: ourColumns.demand,
            rating: ourColumns.rating,
        },
        competitor_columns: {
            product_name: competitorColumns.productName,
            seller_name: competitorColumns.sellerName,
            price: competitorColumns.price,
            rating: competitorColumns.rating,
        },
        strategy: {
            position: strategy.position,
            adjustment_value: Number(strategy.adjustmentValue || 0),
            min_margin_pct: Number(strategy.minMarginPct || 0),
            rounding_step: Number(strategy.roundingStep || 1),
        },
        signals: {
            demand_mode: signals.demandMode,
            stock_mode: signals.stockMode,
            review_mode: signals.reviewMode,
            demand_rising_threshold: Number(signals.demandRisingThreshold || 0),
            demand_surging_threshold: Number(signals.demandSurgingThreshold || 0),
            stock_low_threshold: Number(signals.stockLowThreshold || 0),
            stock_critical_threshold: Number(signals.stockCriticalThreshold || 0),
            review_delta_threshold: Number(signals.reviewDeltaThreshold || 0),
        },
        elasticity: {
            enabled: elasticity.enabled,
            coefficient: Number(elasticity.coefficient || 1.1),
        },
        pricing_limits: {
            min_price: pricingLimits.minPrice === '' ? null : Number(pricingLimits.minPrice),
            max_price: pricingLimits.maxPrice === '' ? null : Number(pricingLimits.maxPrice),
        },
    });

    const handleExecute = async () => {
        if (!matchRule.ourColumn || !matchRule.competitorColumn || !ourColumns.currentPrice || !competitorColumns.price) {
            alert('Please finish the required column mapping before running the pricing engine.');
            return;
        }

        setLoading(true);
        setElapsedTime(0);
        setProgress({ percent: 0, message: 'Preparing pricing engine...', status: 'running' });

        try {
            await axios.post(`${API_BASE}/features/pricing/start/${sessionId}`, buildConfig());

            let done = false;
            const interval = setInterval(async () => {
                if (done) return;
                try {
                    const statusRes = await axios.get(`${API_BASE}/features/pricing/status/${sessionId}`);
                    setProgress(statusRes.data);

                    if (statusRes.data.status === 'completed') {
                        done = true;
                        clearInterval(interval);

                        try {
                            const resultRes = await axios.get(`${API_BASE}/features/pricing/results/${sessionId}`);
                            setSummary(resultRes.data.summary || null);
                            setFinalRows(resultRes.data.rows || []);
                            setStep(3);
                            setLoading(false);

                            if (token) {
                                axios.post(`${API_BASE}/history/jobs`, {
                                    session_id: sessionId,
                                    file_name: 'Pricing Intelligence Job',
                                    rules: [
                                        {
                                            type: 'pricing_strategy',
                                            position: strategy.position,
                                            adjustment_value: strategy.adjustmentValue,
                                            min_margin_pct: strategy.minMarginPct,
                                        },
                                        {
                                            type: 'pricing_match',
                                            our_column: matchRule.ourColumn,
                                            competitor_column: matchRule.competitorColumn,
                                            algorithm: matchRule.algorithm,
                                            threshold: matchRule.threshold,
                                        },
                                    ],
                                    total_rows: resultRes.data.total_rows || 0,
                                    valid_rows: resultRes.data.summary?.matched_products || 0,
                                    invalid_rows: Math.max(
                                        (resultRes.data.total_rows || 0) - (resultRes.data.summary?.matched_products || 0),
                                        0
                                    ),
                                    column_stats: resultRes.data.summary || null,
                                    module: 'pricing',
                                }, { headers: authHeaders }).catch((error) => console.warn('Pricing history save skipped:', error.message));
                            }
                        } catch (resultError) {
                            setLoading(false);
                            alert('Failed to fetch pricing results: ' + (resultError.response?.data?.detail || resultError.message));
                        }
                    } else if (statusRes.data.status === 'error') {
                        done = true;
                        clearInterval(interval);
                        setLoading(false);
                        alert('Pricing analysis failed: ' + statusRes.data.message);
                    }
                } catch (pollError) {
                    console.warn('Pricing polling error:', pollError.message);
                }
            }, 1200);
        } catch (error) {
            setLoading(false);
            alert('Pricing engine start failed: ' + (error.response?.data?.detail || error.message));
        }
    };

    const resetBuilder = () => {
        setSessionId(createSessionId());
        setDatasets({ our: false, competitor: false });
        setDatasetRows({ our: 0, competitor: 0 });
        setDatasetColumns({ our: [], competitor: [] });
        setStep(1);
        setSummary(null);
        setFinalRows([]);
        setElapsedTime(0);
        setProgress({ percent: 0, message: '', status: 'idle' });
    };

    const summaryCards = [
        { label: 'Products Analyzed', value: summary?.analyzed_products || 0, tone: 'text-slate-900' },
        { label: 'Competitor Coverage', value: `${summary?.coverage_pct || 0}%`, tone: 'text-violet-700' },
        { label: 'Average Margin', value: `${summary?.avg_margin_pct || 0}%`, tone: 'text-emerald-600' },
        { label: 'Average Price Shift', value: `${summary?.avg_price_change_pct || 0}%`, tone: 'text-amber-600' },
    ];

    const currentStrategy = strategies.find((item) => item.id === strategy.position);

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 bg-white shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                        <TrendingUp size={20} className="text-amber-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Pricing Intelligence</h2>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Match products, compare competitors, protect margins, and recommend the next best price.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {STEPS.map((label, index) => {
                        const current = index + 1;
                        return (
                            <div key={label} className="flex items-center">
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                    step === current ? 'bg-amber-600 text-white' :
                                    step > current ? 'bg-amber-100 text-amber-700' :
                                    'bg-slate-100 text-slate-400'
                                }`}>
                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                                        step === current ? 'bg-white text-amber-600' :
                                        step > current ? 'bg-amber-500 text-white' :
                                        'bg-slate-300 text-slate-500'
                                    }`}>
                                        {step > current ? 'v' : current}
                                    </span>
                                    {label}
                                </div>
                                {current < STEPS.length && <div className={`w-6 h-px mx-1 ${step > current ? 'bg-amber-300' : 'bg-slate-200'}`} />}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-72 gap-5">
                        <div className="w-full max-w-xl">
                            <div className="flex items-center justify-between text-sm font-semibold text-slate-600 mb-2">
                                <span>{progress.message || 'Analyzing market position...'}</span>
                                <span>{progress.percent}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                <Motion.div
                                    className="bg-amber-500 h-full rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress.percent}%` }}
                                    transition={{ duration: 0.4 }}
                                />
                            </div>
                        </div>
                        <p className="text-slate-400 text-sm">
                            Elapsed: <span className="font-mono font-bold">{Math.floor(elapsedTime / 60)}:{String(elapsedTime % 60).padStart(2, '0')}</span>
                        </p>
                    </div>
                ) : step === 1 ? (
                    <Motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-6">
                            {[
                                {
                                    icon: Database,
                                    title: 'Competitor Price Monitoring',
                                    text: 'Upload competitor feeds or query a database so CleanFlow can benchmark the market.',
                                },
                                {
                                    icon: Target,
                                    title: 'Market Position Strategy',
                                    text: 'Choose whether to price below, match, or price above the market before execution.',
                                },
                                {
                                    icon: ShieldCheck,
                                    title: 'Margin Protection',
                                    text: 'Validate every recommendation against cost, fulfillment, commission, and ad spend.',
                                },
                            ].map((item) => (
                                <div key={item.title} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                    <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-4">
                                        <item.icon size={20} className="text-amber-600" />
                                    </div>
                                    <h3 className="text-base font-bold text-slate-900 mb-2">{item.title}</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed">{item.text}</p>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {[
                                {
                                    id: 'our',
                                    title: 'Your Product Catalog',
                                    subtitle: 'Internal products, current prices, and cost structure.',
                                },
                                {
                                    id: 'competitor',
                                    title: 'Competitor Price Dataset',
                                    subtitle: 'Matched market feed with competitor names and live prices.',
                                },
                            ].map((dataset) => (
                                <div key={dataset.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                    <div className="flex items-start justify-between mb-4 gap-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900">{dataset.title}</h3>
                                            <p className="text-sm text-slate-500 mt-1">{dataset.subtitle}</p>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${datasets[dataset.id] ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {datasets[dataset.id] ? 'Loaded' : 'Pending'}
                                        </div>
                                    </div>

                                    <div className="flex bg-slate-100 rounded-lg p-0.5 mb-4 w-fit">
                                        {['file', 'database'].map((mode) => (
                                            <button
                                                key={mode}
                                                onClick={() => setDatasetMode((prev) => ({ ...prev, [dataset.id]: mode }))}
                                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                                                    datasetMode[dataset.id] === mode ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                            >
                                                {mode === 'file' ? 'File Upload' : 'Database'}
                                            </button>
                                        ))}
                                    </div>

                                    {datasetMode[dataset.id] === 'file' ? (
                                        <div className="space-y-4">
                                            <div className="flex flex-col gap-2">
                                                <span className="text-xs font-semibold text-slate-500">Separator</span>
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {PRESET_SEPARATORS.map((delimiter) => (
                                                        <button
                                                            key={delimiter}
                                                            onClick={() => setSeparators((prev) => ({ ...prev, [dataset.id]: delimiter }))}
                                                            className={`w-8 h-8 rounded-lg border font-mono text-xs transition-all ${
                                                                separators[dataset.id] === delimiter
                                                                    ? 'bg-amber-600 text-white border-amber-600'
                                                                    : 'bg-white text-slate-500 border-slate-200 hover:border-amber-400'
                                                            }`}
                                                        >
                                                            {delimiter}
                                                        </button>
                                                    ))}
                                                    <input
                                                        type="text"
                                                        placeholder="Custom"
                                                        value={!PRESET_SEPARATORS.includes(separators[dataset.id]) ? separators[dataset.id] : ''}
                                                        onChange={(event) => setSeparators((prev) => ({ ...prev, [dataset.id]: event.target.value }))}
                                                        className={`w-20 h-8 px-2 py-1 border rounded-lg text-xs font-mono focus:outline-none transition-all ${
                                                            !PRESET_SEPARATORS.includes(separators[dataset.id]) && separators[dataset.id]
                                                                ? 'border-amber-600 bg-amber-50 text-amber-700'
                                                                : 'border-slate-200 text-slate-600 focus:border-amber-400'
                                                        }`}
                                                    />
                                                </div>
                                                <p className="text-[11px] text-slate-400">Use `\t` for tab-separated files.</p>
                                            </div>

                                            <input
                                                type="file"
                                                accept=".csv,.txt,.xlsx,.xls"
                                                className="hidden"
                                                id={`pricing-upload-${dataset.id}`}
                                                onChange={(event) => event.target.files?.[0] && handleFileUpload(dataset.id, event.target.files[0])}
                                            />
                                            <label
                                                htmlFor={`pricing-upload-${dataset.id}`}
                                                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm cursor-pointer transition-all ${
                                                    datasets[dataset.id]
                                                        ? 'bg-emerald-50 border-2 border-emerald-200 text-emerald-700'
                                                        : 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm shadow-amber-600/20'
                                                }`}
                                            >
                                                {datasets[dataset.id] ? <><CheckCircle size={15} /> Replace Dataset</> : <><Upload size={15} /> Upload CSV or Excel</>}
                                            </label>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {connections.length === 0 ? (
                                                <div className="text-sm text-slate-500 bg-slate-50 rounded-xl border border-slate-200 px-4 py-5">
                                                    Save a database connection in CleanFlow first, then return here to query pricing inputs directly.
                                                </div>
                                            ) : (
                                                <>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 mb-1.5">Connection</label>
                                                        <select
                                                            value={datasetConnections[dataset.id]}
                                                            onChange={(event) => setDatasetConnections((prev) => ({ ...prev, [dataset.id]: event.target.value }))}
                                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-amber-400 outline-none"
                                                        >
                                                            {connections.map((connection) => (
                                                                <option key={connection.id} value={connection.id}>{connection.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 mb-1.5">SQL Query</label>
                                                        <textarea
                                                            rows={4}
                                                            value={datasetQueries[dataset.id]}
                                                            onChange={(event) => setDatasetQueries((prev) => ({ ...prev, [dataset.id]: event.target.value }))}
                                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-amber-400 outline-none resize-none"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => handleDatabaseIngest(dataset.id)}
                                                        className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition-colors"
                                                    >
                                                        Load Dataset from Database
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                                        <span>{datasetColumns[dataset.id].length} columns detected</span>
                                        <span>{datasetRows[dataset.id]} rows loaded</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-end pt-6">
                            <button
                                onClick={() => setStep(2)}
                                disabled={!datasets.our || !datasets.competitor}
                                className="px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm transition-all shadow-md shadow-amber-600/20"
                            >
                                Continue to Pricing Strategy
                            </button>
                        </div>
                    </Motion.div>
                ) : step === 2 ? (
                    <Motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center">
                                        <Target size={18} className="text-violet-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">Product Matching Setup</h3>
                                        <p className="text-sm text-slate-500">Choose how CleanFlow decides which products are similar across both datasets.</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <SelectField label="Your product column" value={matchRule.ourColumn} onChange={(value) => setMatchRule((prev) => ({ ...prev, ourColumn: value }))} options={datasetColumns.our} required />
                                    <SelectField label="Competitor product column" value={matchRule.competitorColumn} onChange={(value) => setMatchRule((prev) => ({ ...prev, competitorColumn: value }))} options={datasetColumns.competitor} required />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1.5">Matching algorithm</label>
                                        <select
                                            value={matchRule.algorithm}
                                            onChange={(event) => setMatchRule((prev) => ({ ...prev, algorithm: event.target.value }))}
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-violet-400 outline-none"
                                        >
                                            {algorithms.map((algorithm) => (
                                                <option key={algorithm.id} value={algorithm.id}>{algorithm.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1.5">
                                            Threshold <span className="text-slate-700">{Math.round(Number(matchRule.threshold) * 100)}%</span>
                                        </label>
                                        <input
                                            type="range"
                                            min="0.5"
                                            max="1"
                                            step="0.01"
                                            value={matchRule.threshold}
                                            onChange={(event) => setMatchRule((prev) => ({ ...prev, threshold: Number(event.target.value) }))}
                                            className="w-full mt-2 accent-violet-600"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                                        <TrendingUp size={18} className="text-amber-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">Market Position Strategy</h3>
                                        <p className="text-sm text-slate-500">Translate competitor tracking into a clear below, match, or above market posture.</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                                    {(strategies.length ? strategies : [
                                        { id: 'below', name: 'Price Below Market', description: 'Beat the lowest competitor.' },
                                        { id: 'match', name: 'Price Match Market', description: 'Stay around the market average.' },
                                        { id: 'above', name: 'Price Above Market', description: 'Maintain a premium position.' },
                                    ]).map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => setStrategy((prev) => ({ ...prev, position: item.id }))}
                                            className={`text-left rounded-2xl border p-4 transition-all ${
                                                strategy.position === item.id ? 'border-amber-500 bg-amber-50 shadow-sm' : 'border-slate-200 bg-white hover:border-amber-300'
                                            }`}
                                        >
                                            <p className="font-bold text-sm text-slate-900">{item.name}</p>
                                            <p className="text-xs text-slate-500 mt-2 leading-relaxed">{item.description}</p>
                                        </button>
                                    ))}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <NumericField label="Adjustment value" value={strategy.adjustmentValue} onChange={(value) => setStrategy((prev) => ({ ...prev, adjustmentValue: value }))} />
                                    <NumericField label="Minimum margin %" value={strategy.minMarginPct} onChange={(value) => setStrategy((prev) => ({ ...prev, minMarginPct: value }))} />
                                    <NumericField label="Rounding step" value={strategy.roundingStep} onChange={(value) => setStrategy((prev) => ({ ...prev, roundingStep: value }))} />
                                </div>
                                {currentStrategy && (
                                    <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
                                        <span className="font-bold text-slate-900">{currentStrategy.name}: </span>
                                        {currentStrategy.description}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center">
                                        <Settings size={18} className="text-sky-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">Internal Cost Structure</h3>
                                        <p className="text-sm text-slate-500">These columns protect margin before any competitor-led price drop is accepted.</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <SelectField label="Product name" value={ourColumns.productName} onChange={(value) => setOurColumns((prev) => ({ ...prev, productName: value }))} options={datasetColumns.our} required />
                                    <SelectField label="SKU / Model" value={ourColumns.sku} onChange={(value) => setOurColumns((prev) => ({ ...prev, sku: value }))} options={datasetColumns.our} />
                                    <SelectField label="Current price" value={ourColumns.currentPrice} onChange={(value) => setOurColumns((prev) => ({ ...prev, currentPrice: value }))} options={datasetColumns.our} required />
                                    <SelectField label="COGS" value={ourColumns.cogs} onChange={(value) => setOurColumns((prev) => ({ ...prev, cogs: value }))} options={datasetColumns.our} />
                                    <SelectField label="Fulfillment / Shipping" value={ourColumns.fulfillment} onChange={(value) => setOurColumns((prev) => ({ ...prev, fulfillment: value }))} options={datasetColumns.our} />
                                    <SelectField label="Commission / Platform Fee" value={ourColumns.commission} onChange={(value) => setOurColumns((prev) => ({ ...prev, commission: value }))} options={datasetColumns.our} />
                                    <SelectField label="Advertising Cost" value={ourColumns.advertising} onChange={(value) => setOurColumns((prev) => ({ ...prev, advertising: value }))} options={datasetColumns.our} />
                                    <SelectField label="Our Rating" value={ourColumns.rating} onChange={(value) => setOurColumns((prev) => ({ ...prev, rating: value }))} options={datasetColumns.our} />
                                </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                                        <Database size={18} className="text-emerald-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">Competitor Market Feed</h3>
                                        <p className="text-sm text-slate-500">Map the key fields CleanFlow needs to benchmark the market accurately.</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <SelectField label="Competitor product name" value={competitorColumns.productName} onChange={(value) => setCompetitorColumns((prev) => ({ ...prev, productName: value }))} options={datasetColumns.competitor} required />
                                    <SelectField label="Competitor / Seller name" value={competitorColumns.sellerName} onChange={(value) => setCompetitorColumns((prev) => ({ ...prev, sellerName: value }))} options={datasetColumns.competitor} />
                                    <SelectField label="Competitor price" value={competitorColumns.price} onChange={(value) => setCompetitorColumns((prev) => ({ ...prev, price: value }))} options={datasetColumns.competitor} required />
                                    <SelectField label="Competitor rating" value={competitorColumns.rating} onChange={(value) => setCompetitorColumns((prev) => ({ ...prev, rating: value }))} options={datasetColumns.competitor} />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center">
                                        <Activity size={18} className="text-rose-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">Dynamic Repricing Signals</h3>
                                        <p className="text-sm text-slate-500">Model Amazon-style demand, stock, and review changes before publishing a price.</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <SelectField label="Stock column" value={ourColumns.stock} onChange={(value) => setOurColumns((prev) => ({ ...prev, stock: value }))} options={datasetColumns.our} />
                                    <SelectField label="Demand / velocity column" value={ourColumns.demand} onChange={(value) => setOurColumns((prev) => ({ ...prev, demand: value }))} options={datasetColumns.our} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <SignalField label="Demand mode" value={signals.demandMode} options={SIGNAL_OPTIONS.demand} onChange={(value) => setSignals((prev) => ({ ...prev, demandMode: value }))} />
                                    <SignalField label="Stock mode" value={signals.stockMode} options={SIGNAL_OPTIONS.stock} onChange={(value) => setSignals((prev) => ({ ...prev, stockMode: value }))} />
                                    <SignalField label="Review mode" value={signals.reviewMode} options={SIGNAL_OPTIONS.review} onChange={(value) => setSignals((prev) => ({ ...prev, reviewMode: value }))} />
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                    <NumericField label="Demand rising" value={signals.demandRisingThreshold} onChange={(value) => setSignals((prev) => ({ ...prev, demandRisingThreshold: value }))} />
                                    <NumericField label="Demand surging" value={signals.demandSurgingThreshold} onChange={(value) => setSignals((prev) => ({ ...prev, demandSurgingThreshold: value }))} />
                                    <NumericField label="Stock low" value={signals.stockLowThreshold} onChange={(value) => setSignals((prev) => ({ ...prev, stockLowThreshold: value }))} />
                                    <NumericField label="Stock critical" value={signals.stockCriticalThreshold} onChange={(value) => setSignals((prev) => ({ ...prev, stockCriticalThreshold: value }))} />
                                    <NumericField label="Review delta" value={signals.reviewDeltaThreshold} step="0.1" onChange={(value) => setSignals((prev) => ({ ...prev, reviewDeltaThreshold: value }))} />
                                </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                                        <Sparkles size={18} className="text-indigo-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">Elasticity and Guardrails</h3>
                                        <p className="text-sm text-slate-500">Test price sensitivity and keep recommendations inside your allowed range.</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50">
                                        <input type="checkbox" checked={elasticity.enabled} onChange={(event) => setElasticity((prev) => ({ ...prev, enabled: event.target.checked }))} className="w-4 h-4 accent-indigo-600" />
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">Enable elasticity testing</p>
                                            <p className="text-xs text-slate-500">Compare price points before recommending the final price.</p>
                                        </div>
                                    </label>
                                    <NumericField label="Elasticity coefficient" value={elasticity.coefficient} step="0.1" onChange={(value) => setElasticity((prev) => ({ ...prev, coefficient: value }))} />
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                        CleanFlow tests five price points around the market-adjusted price and keeps the most profitable candidate.
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <NumericField label="Minimum price guardrail" value={pricingLimits.minPrice} onChange={(value) => setPricingLimits((prev) => ({ ...prev, minPrice: value }))} />
                                    <NumericField label="Maximum price guardrail" value={pricingLimits.maxPrice} onChange={(value) => setPricingLimits((prev) => ({ ...prev, maxPrice: value }))} />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <button onClick={() => setStep(1)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                                Back to Dataset Upload
                            </button>
                            <button onClick={handleExecute} className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-amber-600/20">
                                <Play size={16} fill="currentColor" /> Run Pricing Intelligence
                            </button>
                        </div>
                    </Motion.div>
                ) : (
                    <Motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">Pricing Recommendations Ready</h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    CleanFlow blended competitor tracking, cost checks, dynamic signals, and elasticity analysis into a single recommendation set.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <DownloadButton sessionId={sessionId} format="csv" label="Download CSV" icon={FileText} />
                                <DownloadButton sessionId={sessionId} format="excel" label="Download Excel" icon={FileSpreadsheet} />
                                <button onClick={() => setStep(2)} className="px-4 py-2.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm transition-all">
                                    Refine Strategy
                                </button>
                                <button onClick={resetBuilder} className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all">
                                    New Pricing Run
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                            {summaryCards.map((card) => (
                                <div key={card.label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                    <p className="text-sm font-semibold text-slate-500">{card.label}</p>
                                    <p className={`text-3xl font-black mt-2 ${card.tone}`}>{card.value}</p>
                                </div>
                            ))}
                        </div>

                        {finalRows.length > 0 ? (
                            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-slate-900">Recommendation Table</h4>
                                        <p className="text-sm text-slate-500 mt-1">Showing up to {finalRows.length} recommendations from this pricing run.</p>
                                    </div>
                                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Session {sessionId}</div>
                                </div>
                                <div className="overflow-x-auto max-h-[560px]">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-xs text-slate-500 uppercase sticky top-0 border-b border-slate-200">
                                            <tr>
                                                {['Product', 'Current', 'Recommended', 'Competitor Min', 'Competitor Avg', 'Competitor Max', 'Margin', 'Action', 'Signals', 'Note'].map((header) => (
                                                    <th key={header} className="px-5 py-3 whitespace-nowrap font-bold tracking-wider">{header}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {finalRows.map((row, index) => (
                                                <tr key={`${row.product_name}-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                                                    <td className="px-5 py-4 min-w-[280px]">
                                                        <p className="font-bold text-slate-900">{row.product_name}</p>
                                                        <p className="text-xs text-slate-500 mt-1">{row.sku || 'No SKU provided'}</p>
                                                        <p className="text-xs text-slate-400 mt-1">Competitors: {row.matched_competitors || 'None'}</p>
                                                    </td>
                                                    <td className="px-5 py-4 whitespace-nowrap text-slate-700 font-semibold">{formatCurrency(row.current_price)}</td>
                                                    <td className="px-5 py-4 whitespace-nowrap">
                                                        <div className="inline-flex flex-col">
                                                            <span className="font-black text-emerald-700">{formatCurrency(row.recommended_price)}</span>
                                                            <span className={`text-xs font-semibold ${Number(row.recommended_vs_current_pct) >= 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                                {Number(row.recommended_vs_current_pct) > 0 ? '+' : ''}{row.recommended_vs_current_pct}%
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 whitespace-nowrap text-slate-700">{formatCurrency(row.competitor_min_price)}</td>
                                                    <td className="px-5 py-4 whitespace-nowrap text-slate-700">{formatCurrency(row.competitor_avg_price)}</td>
                                                    <td className="px-5 py-4 whitespace-nowrap text-slate-700">{formatCurrency(row.competitor_max_price)}</td>
                                                    <td className="px-5 py-4 whitespace-nowrap">
                                                        <div className="inline-flex flex-col">
                                                            <span className="font-bold text-slate-900">{row.margin_pct}%</span>
                                                            <span className="text-xs text-slate-400">Floor {formatCurrency(row.floor_price)}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 min-w-[170px]">
                                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${
                                                            String(row.pricing_action || '').startsWith('Increase') ? 'bg-amber-100 text-amber-700' :
                                                            String(row.pricing_action || '').startsWith('Decrease') ? 'bg-emerald-100 text-emerald-700' :
                                                            'bg-slate-100 text-slate-700'
                                                        }`}>
                                                            {row.pricing_action}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4 min-w-[220px] text-slate-600">
                                                        <div className="space-y-1 text-xs">
                                                            <p>Demand: <span className="font-bold capitalize text-slate-900">{row.demand_signal}</span></p>
                                                            <p>Stock: <span className="font-bold capitalize text-slate-900">{row.stock_signal}</span></p>
                                                            <p>Review: <span className="font-bold capitalize text-slate-900">{row.review_signal}</span></p>
                                                            <p>Dynamic adj: <span className="font-bold text-slate-900">{row.dynamic_adjustment_pct}%</span></p>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 min-w-[280px] text-slate-600 leading-relaxed">{row.note}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-center bg-white border border-slate-200 rounded-2xl">
                                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                                    <AlertCircle size={26} className="text-slate-300" />
                                </div>
                                <p className="font-bold text-slate-700 mb-1">No recommendations were generated</p>
                                <p className="text-sm text-slate-400 max-w-md">
                                    Try lowering the matching threshold, uploading more competitor prices, or mapping the product and price columns again.
                                </p>
                            </div>
                        )}
                    </Motion.div>
                )}
            </div>
        </div>
    );
}

function SelectField({ label, value, onChange, options, required = false }) {
    return (
        <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">
                {label} {required && <span className="text-rose-500">*</span>}
            </label>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-slate-400 outline-none"
            >
                <option value="">Select column...</option>
                {options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                ))}
            </select>
        </div>
    );
}

function SignalField({ label, value, options, onChange }) {
    return (
        <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">{label}</label>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-slate-400 outline-none"
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
        </div>
    );
}

function NumericField({ label, value, onChange, step = '1' }) {
    return (
        <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">{label}</label>
            <input
                type="number"
                step={step}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-slate-400 outline-none"
            />
        </div>
    );
}

function DownloadButton({ sessionId, format, label, icon }) {
    const IconComponent = icon;

    const handleDownload = async () => {
        try {
            const res = await axios.get(`${API_BASE}/features/pricing/download/${sessionId}?fmt=${format}`, {
                responseType: 'blob',
            });
            const mime = format === 'excel'
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                : 'text/csv';
            const extension = format === 'excel' ? 'xlsx' : 'csv';
            const url = window.URL.createObjectURL(new Blob([res.data], { type: mime }));
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `pricing_results_${sessionId}.${extension}`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            alert(`${label} failed: ` + (error.response?.data?.detail || error.message));
        }
    };

    return (
        <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all shadow-md"
        >
            <IconComponent size={15} /> {label}
        </button>
    );
}
