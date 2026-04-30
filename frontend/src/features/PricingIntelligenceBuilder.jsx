import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
    Activity,
    AlertCircle,
    CheckCircle,
    Database,
    Eye,
    FileSpreadsheet,
    FileText,
    Play,
    Plus,
    Settings,
    ShieldCheck,
    Sparkles,
    Target,
    Trash2,
    TrendingUp,
    Upload,
} from 'lucide-react';
import { API_BASE } from '../lib/runtimeConfig';
const Motion = motion;
const STEPS = ['Upload', 'Match Setup', 'Review', 'Pricing', 'Results'];
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

const createCompetitorSource = (index, connectionId = '') => {
    const seed = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${index}`;
    return {
        id: seed,
        datasetId: `competitor_${seed}`,
        label: `Competitor ${index}`,
        loaded: false,
        rows: 0,
        columns: [],
        mode: 'file',
        connectionId,
        query: 'SELECT * FROM competitor_prices LIMIT 100',
        separator: ',',
        matchColumn: '',
        matchColumns: {},
        columnsMap: {
            productName: '',
            sellerName: '',
            price: '',
            rating: '',
            stock: '',
            productUrl: '',
            imageUrl: '',
        },
    };
};

const createMatchRule = (index, algorithm = 'fuzzy') => ({
    id: `rule_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
    ourColumn: '',
    algorithm,
    threshold: 0.82,
});

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
    const normalized = (value ?? '').toString().trim();
    if (!normalized || normalized === 'default') return ',';
    if (normalized.toLowerCase() === '\\t' || normalized.toLowerCase() === 'tab') return '\t';
    return normalized.charAt(0);
};

const extractUrlValue = (value) => {
    if (value == null) return '';
    if (Array.isArray(value)) return extractUrlValue(value[0]);

    if (typeof value === 'object') {
        const preferredKeys = ['url', 'src', 'image', 'image_url', 'imageUrl', 'product_url', 'productUrl', 'link', 'href'];
        for (const key of preferredKeys) {
            if (value[key]) return extractUrlValue(value[key]);
        }
        const firstValue = Object.values(value).find(Boolean);
        return extractUrlValue(firstValue);
    }

    let text = String(value).trim().replace(/^['"]|['"]$/g, '').replace(/\\\//g, '/');
    if (!text) return '';

    if ((text.startsWith('[') || text.startsWith('{')) && text.length < 5000) {
        try {
            return extractUrlValue(JSON.parse(text));
        } catch {
            // Ignore invalid JSON-like strings and continue with plain text parsing.
        }
    }

    const embeddedUrl = text.match(/https?:\/\/[^\s"'<>]+|\/\/[^\s"'<>]+|\/[^\s"'<>]+\.(?:png|jpe?g|webp|gif|svg|bmp)(?:\?[^\s"'<>]*)?/i);
    if (embeddedUrl?.[0]) {
        text = embeddedUrl[0];
    }

    return text;
};

const normalizeExternalUrl = (value, baseHref = '') => {
    const trimmed = extractUrlValue(value);
    if (!trimmed) return '';
    if (/^data:image\//i.test(trimmed) || /^blob:/i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('//')) return `https:${trimmed}`;
    try {
        if (baseHref) return new URL(trimmed, baseHref).toString();
        return new URL(trimmed).toString();
    } catch {
        // Fall through to loose host-based normalization below.
    }
    if (/^[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(trimmed)) return `https://${trimmed}`;
    return '';
};

const humanizeColumn = (value) => (value || '')
    .toString()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export default function PricingIntelligenceBuilder() {
    const [sessionId, setSessionId] = useState(createSessionId());
    const [algorithms, setAlgorithms] = useState([]);
    const [strategies, setStrategies] = useState([]);
    const [connections, setConnections] = useState([]);
    const [ourDataset, setOurDataset] = useState({
        label: 'Client Catalog',
        loaded: false,
        rows: 0,
        columns: [],
        mode: 'file',
        connectionId: '',
        query: 'SELECT * FROM products LIMIT 100',
        separator: ',',
    });
    const [competitorSources, setCompetitorSources] = useState([createCompetitorSource(1)]);
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState({ percent: 0, message: '', status: 'idle' });
    const [elapsedTime, setElapsedTime] = useState(0);
    const [summary, setSummary] = useState(null);
    const [finalRows, setFinalRows] = useState([]);
    const [reviewRows, setReviewRows] = useState([]);
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [excludedMatchIds, setExcludedMatchIds] = useState([]);

    const [matchRules, setMatchRules] = useState([createMatchRule(1)]);
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
        productUrl: '',
        imageUrl: '',
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

    const loadedCompetitors = useMemo(
        () => competitorSources.filter((source) => source.loaded),
        [competitorSources]
    );

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
                const res = await axios.get(`${API_BASE}/connections`, { headers: { Authorization: `Bearer ${token}` } });
                const available = res.data || [];
                setConnections(available);
                if (available.length > 0) {
                    const defaultConnectionId = available[0].id;
                    setOurDataset((prev) => ({ ...prev, connectionId: prev.connectionId || defaultConnectionId }));
                    setCompetitorSources((prev) => prev.map((source) => ({
                        ...source,
                        connectionId: source.connectionId || defaultConnectionId,
                    })));
                }
            } catch (error) {
                console.error('Failed to load saved connections:', error);
            }
        };

        loadMetadata();
        loadConnections();
    }, [token]);

    const addCompetitorSource = () => {
        setCompetitorSources((prev) => {
            const nextSource = createCompetitorSource(prev.length + 1, connections[0]?.id || '');
            nextSource.matchColumns = Object.fromEntries(matchRules.map((rule) => [rule.id, '']));
            return [...prev, nextSource];
        });
    };

    const addMatchRule = () => {
        const nextRule = createMatchRule(matchRules.length + 1, algorithms[0]?.id || 'fuzzy');
        setMatchRules((prev) => [...prev, nextRule]);
        setCompetitorSources((prev) => prev.map((source) => ({
            ...source,
            matchColumns: {
                ...source.matchColumns,
                [nextRule.id]: source.columnsMap.productName || source.matchColumn || '',
            },
        })));
    };

    const updateMatchRule = (ruleId, field, value) => {
        setMatchRules((prev) => prev.map((rule) => (rule.id === ruleId ? { ...rule, [field]: value } : rule)));
    };

    const removeMatchRule = (ruleId) => {
        setMatchRules((prev) => prev.length === 1 ? prev : prev.filter((rule) => rule.id !== ruleId));
        setCompetitorSources((prev) => prev.map((source) => {
            const nextMatchColumns = { ...source.matchColumns };
            delete nextMatchColumns[ruleId];
            return {
                ...source,
                matchColumns: nextMatchColumns,
            };
        }));
    };

    const updateCompetitorSource = (sourceId, updater) => {
        setCompetitorSources((prev) => prev.map((source) => {
            if (source.id !== sourceId) return source;
            const patch = typeof updater === 'function' ? updater(source) : updater;
            return { ...source, ...patch };
        }));
    };

    const removeCompetitorSource = (sourceId) => {
        setCompetitorSources((prev) => prev.length === 1 ? prev : prev.filter((source) => source.id !== sourceId));
    };

    const suggestOurColumns = (columns) => {
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
            productUrl: inferColumn(columns, ['product_url', 'producturl', 'url', 'link', 'product_link', 'page']),
            imageUrl: inferColumn(columns, ['image_url', 'imageurl', 'image', 'img', 'thumbnail', 'photo']),
        };
        setOurColumns((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(suggested).filter(([, value]) => value)) }));
        setMatchRules((prev) => prev.map((rule, index) => (
            index === 0 && !rule.ourColumn
                ? { ...rule, ourColumn: suggested.productName || columns[0] || '' }
                : rule
        )));
    };

    const suggestCompetitorColumns = (sourceId, columns) => {
        const suggested = {
            productName: inferColumn(columns, ['product', 'name', 'title', 'item', 'description']),
            sellerName: inferColumn(columns, ['seller', 'competitor', 'platform', 'marketplace', 'store']),
            price: inferColumn(columns, ['selling_price', 'price', 'offer_price', 'final_price', 'mrp']),
            rating: inferColumn(columns, ['rating', 'review']),
            stock: inferColumn(columns, ['stock', 'inventory', 'qty', 'quantity']),
            productUrl: inferColumn(columns, ['product_url', 'producturl', 'url', 'link', 'product_link', 'page']),
            imageUrl: inferColumn(columns, ['image_url', 'imageurl', 'image', 'img', 'thumbnail', 'photo']),
        };
        updateCompetitorSource(sourceId, (source) => ({
            columns: columns || [],
            matchColumn: source.matchColumn || suggested.productName || columns[0] || '',
            matchColumns: matchRules.reduce((acc, rule, index) => ({
                ...acc,
                [rule.id]: source.matchColumns?.[rule.id] || (index === 0 ? (suggested.productName || columns[0] || '') : ''),
            }), {}),
            columnsMap: {
                ...source.columnsMap,
                ...Object.fromEntries(Object.entries(suggested).filter(([, value]) => value)),
            },
        }));
    };

    const handleOurFileUpload = async (file) => {
        try {
            const formData = new FormData();
            formData.append('session_id', sessionId);
            formData.append('dataset_id', 'our_dataset');
            formData.append('delimiter', normalizeSeparator(ourDataset.separator));
            formData.append('file', file);
            const res = await axios.post(`${API_BASE}/features/pricing/upload-dataset`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const columns = res.data.columns || [];
            setOurDataset((prev) => ({ ...prev, loaded: true, rows: res.data.rows || 0, columns }));
            suggestOurColumns(columns);
        } catch (error) {
            alert('Client dataset upload failed: ' + (error.response?.data?.detail || error.message));
        }
    };

    const handleCompetitorFileUpload = async (sourceId, datasetId, separator, file) => {
        try {
            const formData = new FormData();
            formData.append('session_id', sessionId);
            formData.append('dataset_id', datasetId);
            formData.append('delimiter', normalizeSeparator(separator));
            formData.append('file', file);
            const res = await axios.post(`${API_BASE}/features/pricing/upload-dataset`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const columns = res.data.columns || [];
            updateCompetitorSource(sourceId, { loaded: true, rows: res.data.rows || 0, columns });
            suggestCompetitorColumns(sourceId, columns);
        } catch (error) {
            alert('Competitor dataset upload failed: ' + (error.response?.data?.detail || error.message));
        }
    };

    const handleOurDatabaseIngest = async () => {
        if (!ourDataset.connectionId || !ourDataset.query) {
            alert('Select a connection and enter a query first.');
            return;
        }
        try {
            const res = await axios.post(`${API_BASE}/features/pricing/ingest-database`, {
                session_id: sessionId,
                dataset_id: 'our_dataset',
                connection_id: ourDataset.connectionId,
                query: ourDataset.query,
            }, { headers: authHeaders });
            const columns = res.data.columns || [];
            setOurDataset((prev) => ({ ...prev, loaded: true, rows: res.data.rows || 0, columns }));
            suggestOurColumns(columns);
        } catch (error) {
            alert('Client database import failed: ' + (error.response?.data?.detail || error.message));
        }
    };

    const handleCompetitorDatabaseIngest = async (source) => {
        if (!source.connectionId || !source.query) {
            alert('Select a connection and enter a query first.');
            return;
        }
        try {
            const res = await axios.post(`${API_BASE}/features/pricing/ingest-database`, {
                session_id: sessionId,
                dataset_id: source.datasetId,
                connection_id: source.connectionId,
                query: source.query,
            }, { headers: authHeaders });
            const columns = res.data.columns || [];
            updateCompetitorSource(source.id, { loaded: true, rows: res.data.rows || 0, columns });
            suggestCompetitorColumns(source.id, columns);
        } catch (error) {
            alert('Competitor database import failed: ' + (error.response?.data?.detail || error.message));
        }
    };

    const buildMatchingConfig = () => ({
        our_dataset: 'our_dataset',
        competitor_sources: loadedCompetitors.map((source) => ({
            dataset_id: source.datasetId,
            label: source.label,
            match_column: source.matchColumn || source.columnsMap.productName,
            match_columns: Object.fromEntries(
                matchRules
                    .map((rule) => [rule.id, source.matchColumns?.[rule.id] || ''])
                    .filter(([, column]) => column)
            ),
            columns: {
                product_name: source.columnsMap.productName,
                seller_name: source.columnsMap.sellerName,
                price: source.columnsMap.price,
                rating: source.columnsMap.rating,
                stock: source.columnsMap.stock,
                product_url: source.columnsMap.productUrl,
                image_url: source.columnsMap.imageUrl,
            },
        })),
        match_rules: matchRules.map((rule, index) => ({
            id: rule.id,
            label: `Rule ${index + 1}`,
            our_column: rule.ourColumn,
            algorithm: rule.algorithm,
            threshold: Number(rule.threshold),
        })),
        match_rule: {
            our_column: matchRules[0]?.ourColumn || '',
            algorithm: matchRules[0]?.algorithm || 'fuzzy',
            threshold: Number(matchRules[0]?.threshold || 0.82),
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
            product_url: ourColumns.productUrl,
            image_url: ourColumns.imageUrl,
        },
    });

    const buildPricingConfig = () => ({
        ...buildMatchingConfig(),
        excluded_match_ids: excludedMatchIds,
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

    const toggleExcludedMatch = (matchId) => {
        if (!matchId) return;
        setExcludedMatchIds((prev) => (
            prev.includes(matchId)
                ? prev.filter((currentId) => currentId !== matchId)
                : [...prev, matchId]
        ));
        setFinalRows([]);
    };

    const hasCompleteMatchRules = matchRules.length > 0 && matchRules.every((rule) => rule.ourColumn);
    const canGenerateReview = Boolean(
        hasCompleteMatchRules &&
        ourColumns.productName &&
        loadedCompetitors.length > 0 &&
        loadedCompetitors.every((source) => (
            source.columnsMap.productName
            && matchRules.every((rule) => source.matchColumns?.[rule.id])
        ))
    );

    const canRunPricing = Boolean(
        reviewRows.length > 0 &&
        ourColumns.currentPrice &&
        loadedCompetitors.length > 0 &&
        loadedCompetitors.every((source) => source.columnsMap.price)
    );

    const handleGenerateReview = async () => {
        if (!canGenerateReview) {
            alert('Complete the matching rules and review field mappings before generating the match report.');
            return;
        }

        setLoading(true);
        setElapsedTime(0);
        setProgress({ percent: 15, message: 'Generating side-by-side match review...', status: 'running' });

        try {
            const reviewRes = await axios.post(`${API_BASE}/features/pricing/review/${sessionId}`, buildMatchingConfig());
            setSummary(reviewRes.data.summary || null);
            setReviewRows(reviewRes.data.review_rows || []);
            setExcludedMatchIds([]);
            setSelectedMatch(null);
            setFinalRows([]);
            setStep(3);
            setLoading(false);
        } catch (error) {
            setLoading(false);
            alert('Match review generation failed: ' + (error.response?.data?.detail || error.message));
        }
    };

    const handleExecute = async () => {
        if (!canRunPricing) {
            alert('Complete the pricing fields before running the Pricing Intelligence engine.');
            return;
        }

        setLoading(true);
        setElapsedTime(0);
        setProgress({ percent: 0, message: 'Preparing pricing engine...', status: 'running' });

        try {
            await axios.post(`${API_BASE}/features/pricing/start/${sessionId}`, buildPricingConfig());

            let done = false;
            const interval = setInterval(async () => {
                if (done) return;
                try {
                    const statusRes = await axios.get(`${API_BASE}/features/pricing/status/${sessionId}`);
                    setProgress(statusRes.data);

                    if (statusRes.data.status === 'completed') {
                        done = true;
                        clearInterval(interval);

                        const resultRes = await axios.get(`${API_BASE}/features/pricing/results/${sessionId}`);
                        setSummary(resultRes.data.summary || null);
                        setFinalRows(resultRes.data.rows || []);
                        setReviewRows(resultRes.data.review_rows || []);
                        setSelectedMatch(null);
                        setStep(5);
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
                                        type: 'pricing_match_rules',
                                        rule_count: matchRules.length,
                                        rules: matchRules.map((rule, index) => ({
                                            label: `Rule ${index + 1}`,
                                            our_column: rule.ourColumn,
                                            algorithm: rule.algorithm,
                                            threshold: rule.threshold,
                                        })),
                                        competitor_sources: loadedCompetitors.length,
                                    },
                                ],
                                total_rows: resultRes.data.total_rows || 0,
                                valid_rows: resultRes.data.summary?.matched_products || 0,
                                invalid_rows: Math.max((resultRes.data.total_rows || 0) - (resultRes.data.summary?.matched_products || 0), 0),
                                column_stats: resultRes.data.summary || null,
                                module: 'pricing',
                            }, { headers: authHeaders }).catch((error) => console.warn('Pricing history save skipped:', error.message));
                        }
                    } else if (statusRes.data.status === 'error') {
                        done = true;
                        clearInterval(interval);
                        setLoading(false);
                        alert('Pricing analysis failed: ' + statusRes.data.message);
                    }
                } catch (error) {
                    console.warn('Pricing polling error:', error.message);
                }
            }, 1200);
        } catch (error) {
            setLoading(false);
            alert('Pricing engine start failed: ' + (error.response?.data?.detail || error.message));
        }
    };

    const resetBuilder = () => {
        setSessionId(createSessionId());
        setOurDataset({
            label: 'Client Catalog',
            loaded: false,
            rows: 0,
            columns: [],
            mode: 'file',
            connectionId: connections[0]?.id || '',
            query: 'SELECT * FROM products LIMIT 100',
            separator: ',',
        });
        setCompetitorSources([createCompetitorSource(1, connections[0]?.id || '')]);
        setSummary(null);
        setFinalRows([]);
        setReviewRows([]);
        setSelectedMatch(null);
        setExcludedMatchIds([]);
        setStep(1);
        setElapsedTime(0);
        setProgress({ percent: 0, message: '', status: 'idle' });
        setMatchRules([createMatchRule(1, algorithms[0]?.id || 'fuzzy')]);
        setOurColumns({
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
            productUrl: '',
            imageUrl: '',
        });
        setStrategy({
            position: 'match',
            adjustmentValue: 0,
            minMarginPct: 15,
            roundingStep: 1,
        });
        setSignals({
            demandMode: 'auto',
            stockMode: 'auto',
            reviewMode: 'auto',
            demandRisingThreshold: 60,
            demandSurgingThreshold: 85,
            stockLowThreshold: 15,
            stockCriticalThreshold: 5,
            reviewDeltaThreshold: 0.2,
        });
        setElasticity({
            enabled: true,
            coefficient: 1.1,
        });
        setPricingLimits({
            minPrice: '',
            maxPrice: '',
        });
    };

    const summaryCards = [
        { label: 'Products Analyzed', value: summary?.analyzed_products || 0, tone: 'text-slate-900' },
        { label: 'Competitor Coverage', value: `${summary?.coverage_pct || 0}%`, tone: 'text-violet-700' },
        { label: 'Competitor Sources', value: summary?.competitor_source_count || 0, tone: 'text-amber-600' },
        { label: 'Review Pairs', value: summary?.review_pair_count || 0, tone: 'text-emerald-600' },
    ];

    const currentStrategy = strategies.find((item) => item.id === strategy.position);
    const groupedReviewRows = useMemo(() => {
        const groups = new Map();

        reviewRows.forEach((row, index) => {
            const key = row.client_index != null
                ? `client::${row.client_index}`
                : [
                    row.client_product_name || '',
                    row.client_sku || '',
                    row.client_product_url || '',
                    row.client_match_value || '',
                ].join('||');

            if (!groups.has(key)) {
                groups.set(key, {
                    id: `${key}::${index}`,
                    client_index: row.client_index,
                    client_product_name: row.client_product_name,
                    client_sku: row.client_sku,
                    client_match_value: row.client_match_value,
                    client_price: row.client_price,
                    client_product_url: row.client_product_url,
                    client_image_url: row.client_image_url,
                    client_fields: row.client_fields || [],
                    competitors: [],
                });
            }

            groups.get(key).competitors.push(row);
        });

        return Array.from(groups.values()).map((group) => ({
            ...group,
            competitors: [...group.competitors].sort((left, right) => Number(right.similarity_score || 0) - Number(left.similarity_score || 0)),
        }));
    }, [reviewRows]);

    return (
        <div className="w-full h-full flex flex-col">
            <Header step={step} />
            <div className="flex-1 overflow-y-auto px-6 py-5">
                {loading ? <LoadingState progress={progress} elapsedTime={elapsedTime} /> : null}
                {!loading && step === 1 ? (
                    <Motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                        <IntroCards />
                        <DatasetCard
                            title="Client Product Catalog"
                            subtitle="Internal products, current prices, and cost structure."
                            label={ourDataset.label}
                            onLabelChange={(label) => setOurDataset((prev) => ({ ...prev, label }))}
                            loaded={ourDataset.loaded}
                            rows={ourDataset.rows}
                            columns={ourDataset.columns}
                            mode={ourDataset.mode}
                            onModeChange={(mode) => setOurDataset((prev) => ({ ...prev, mode }))}
                            separator={ourDataset.separator}
                            onSeparatorChange={(separator) => setOurDataset((prev) => ({ ...prev, separator }))}
                            connectionId={ourDataset.connectionId}
                            onConnectionChange={(connectionId) => setOurDataset((prev) => ({ ...prev, connectionId }))}
                            query={ourDataset.query}
                            onQueryChange={(query) => setOurDataset((prev) => ({ ...prev, query }))}
                            connections={connections}
                            onUpload={handleOurFileUpload}
                            onDatabaseLoad={handleOurDatabaseIngest}
                        />

                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between gap-4 mb-5">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">Competitor Datasets</h3>
                                    <p className="text-sm text-slate-500 mt-1">Add as many competitor price feeds as you need for pricing comparison.</p>
                                </div>
                                <button onClick={addCompetitorSource} className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-colors">
                                    <Plus size={15} /> Add Competitor
                                </button>
                            </div>
                            <div className="space-y-4">
                                {competitorSources.map((source, index) => (
                                    <CompetitorSourceCard
                                        key={source.id}
                                        source={source}
                                        index={index}
                                        connections={connections}
                                        onChange={(patch) => updateCompetitorSource(source.id, patch)}
                                        onUpload={(file) => handleCompetitorFileUpload(source.id, source.datasetId, source.separator, file)}
                                        onDatabaseLoad={() => handleCompetitorDatabaseIngest(source)}
                                        onRemove={() => removeCompetitorSource(source.id)}
                                        canRemove={competitorSources.length > 1}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-end">
                            <button
                                onClick={() => setStep(2)}
                                disabled={!ourDataset.loaded || loadedCompetitors.length === 0}
                                className="px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm transition-all shadow-md shadow-amber-600/20"
                            >
                                Continue to Match Setup
                            </button>
                        </div>
                    </Motion.div>
                ) : null}
                {!loading && step === 2 ? (
                    <Motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center justify-between gap-4 mb-4">
                                    <SectionTitle icon={Target} iconClass="text-violet-600" iconBg="bg-violet-50 border-violet-100" title="Matching Strategy" description="Add multiple match criteria just like Data Matching. Each rule compares one client column against one mapped competitor column per source." />
                                    <button onClick={addMatchRule} className="inline-flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm transition-colors shadow-sm shadow-violet-600/20">
                                        <Plus size={15} /> Add Rule
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {matchRules.map((rule, index) => (
                                        <div key={rule.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 relative">
                                            <div className="absolute top-4 left-4 text-[11px] font-black uppercase tracking-wider text-slate-400">Rule {index + 1}</div>
                                            {matchRules.length > 1 ? (
                                                <button onClick={() => removeMatchRule(rule.id)} className="absolute top-3.5 right-4 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                                                    <Trash2 size={15} />
                                                </button>
                                            ) : null}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 mb-4">
                                                <SelectField
                                                    label="Client column"
                                                    value={rule.ourColumn}
                                                    onChange={(value) => updateMatchRule(rule.id, 'ourColumn', value)}
                                                    options={ourDataset.columns}
                                                    required
                                                />
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Matching algorithm</label>
                                                    <select value={rule.algorithm} onChange={(event) => updateMatchRule(rule.id, 'algorithm', event.target.value)} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:border-violet-400 outline-none">
                                                        {algorithms.map((algorithm) => <option key={algorithm.id} value={algorithm.id}>{algorithm.name}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1.5">Threshold <span className="text-slate-700">{Math.round(Number(rule.threshold) * 100)}%</span></label>
                                                <input type="range" min="0.5" max="1" step="0.01" value={rule.threshold} onChange={(event) => updateMatchRule(rule.id, 'threshold', Number(event.target.value))} className="w-full mt-2 accent-violet-600" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                <SectionTitle icon={Settings} iconClass="text-sky-600" iconBg="bg-sky-50 border-sky-100" title="Client Fields for Review" description="Choose the client columns that should appear in the match report before pricing begins." />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <SelectField label="Product name" value={ourColumns.productName} onChange={(value) => setOurColumns((prev) => ({ ...prev, productName: value }))} options={ourDataset.columns} required />
                                    <SelectField label="SKU / Model" value={ourColumns.sku} onChange={(value) => setOurColumns((prev) => ({ ...prev, sku: value }))} options={ourDataset.columns} />
                                    <SelectField label="Current price" value={ourColumns.currentPrice} onChange={(value) => setOurColumns((prev) => ({ ...prev, currentPrice: value }))} options={ourDataset.columns} />
                                    <SelectField label="Stock qty" value={ourColumns.stock} onChange={(value) => setOurColumns((prev) => ({ ...prev, stock: value }))} options={ourDataset.columns} />
                                    <SelectField label="Rating" value={ourColumns.rating} onChange={(value) => setOurColumns((prev) => ({ ...prev, rating: value }))} options={ourDataset.columns} />
                                    <SelectField label="Demand / velocity" value={ourColumns.demand} onChange={(value) => setOurColumns((prev) => ({ ...prev, demand: value }))} options={ourDataset.columns} />
                                    <SelectField label="Product URL" value={ourColumns.productUrl} onChange={(value) => setOurColumns((prev) => ({ ...prev, productUrl: value }))} options={ourDataset.columns} />
                                    <SelectField label="Image URL" value={ourColumns.imageUrl} onChange={(value) => setOurColumns((prev) => ({ ...prev, imageUrl: value }))} options={ourDataset.columns} />
                                </div>
                                <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
                                    Product URLs will be clickable in the review report, and image URLs will render product thumbnails when they can be loaded.
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                <SectionTitle icon={Eye} iconClass="text-amber-600" iconBg="bg-amber-50 border-amber-100" title="Review Workflow" description="Pricing setup comes later. This page only prepares the matching report." />
                                <div className="space-y-3 text-sm text-slate-600">
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">1. Choose client attributes and match types.</div>
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">2. Map the competitor attribute name for each rule in every competitor source.</div>
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">3. Generate the matching report and validate links, images, and side-by-side values.</div>
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">4. Only after the review looks correct, continue to Pricing Setup.</div>
                                </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                <SectionTitle icon={Database} iconClass="text-emerald-600" iconBg="bg-emerald-50 border-emerald-100" title="Competitor Source Mapping" description="Map the competitor fields to display in the report and the competitor attribute name for every client rule." />
                                <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                                    {loadedCompetitors.map((source) => (
                                        <div key={source.id} className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                                            <div className="flex items-center justify-between gap-3 mb-3">
                                                <p className="font-bold text-slate-900">{source.label}</p>
                                                <span className="text-xs font-semibold text-slate-500">{source.rows} rows</span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                                <SelectField label="Competitor product name" value={source.columnsMap.productName} onChange={(value) => updateCompetitorSource(source.id, (current) => ({ columnsMap: { ...current.columnsMap, productName: value } }))} options={source.columns} required />
                                                <SelectField label="Competitor seller" value={source.columnsMap.sellerName} onChange={(value) => updateCompetitorSource(source.id, (current) => ({ columnsMap: { ...current.columnsMap, sellerName: value } }))} options={source.columns} />
                                                <SelectField label="Competitor price" value={source.columnsMap.price} onChange={(value) => updateCompetitorSource(source.id, (current) => ({ columnsMap: { ...current.columnsMap, price: value } }))} options={source.columns} />
                                                <SelectField label="Competitor stock qty" value={source.columnsMap.stock} onChange={(value) => updateCompetitorSource(source.id, (current) => ({ columnsMap: { ...current.columnsMap, stock: value } }))} options={source.columns} />
                                                <SelectField label="Competitor rating" value={source.columnsMap.rating} onChange={(value) => updateCompetitorSource(source.id, (current) => ({ columnsMap: { ...current.columnsMap, rating: value } }))} options={source.columns} />
                                                <SelectField label="Competitor product URL" value={source.columnsMap.productUrl} onChange={(value) => updateCompetitorSource(source.id, (current) => ({ columnsMap: { ...current.columnsMap, productUrl: value } }))} options={source.columns} />
                                                <SelectField label="Competitor image URL" value={source.columnsMap.imageUrl} onChange={(value) => updateCompetitorSource(source.id, (current) => ({ columnsMap: { ...current.columnsMap, imageUrl: value } }))} options={source.columns} />
                                            </div>
                                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                                <div className="flex items-center justify-between gap-3 mb-3">
                                                    <p className="text-sm font-bold text-slate-900">Competitor Attribute Names for Matching</p>
                                                    <span className="text-xs text-slate-500">Map every rule for this source</span>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {matchRules.map((rule, index) => (
                                                        <SelectField
                                                            key={rule.id}
                                                            label={`Rule ${index + 1} competitor attribute${rule.ourColumn ? ` for ${humanizeColumn(rule.ourColumn)}` : ''}`}
                                                            value={source.matchColumns?.[rule.id] || ''}
                                                            onChange={(value) => updateCompetitorSource(source.id, (current) => ({
                                                                matchColumn: index === 0 ? value : current.matchColumn,
                                                                matchColumns: {
                                                                    ...current.matchColumns,
                                                                    [rule.id]: value,
                                                                },
                                                            }))}
                                                            options={source.columns}
                                                            required
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-4 text-sm text-slate-600">
                            Pricing strategy, cost structure, elasticity, and repricing guardrails will appear after you review the matching report.
                        </div>

                        <div className="flex items-center justify-between">
                            <button onClick={() => setStep(1)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Back to Upload</button>
                            <button onClick={handleGenerateReview} disabled={!canGenerateReview} className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-amber-600/20">
                                <Eye size={16} /> Generate Matching Report
                            </button>
                        </div>
                    </Motion.div>
                ) : null}

                {!loading && step === 3 ? (
                    <Motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">Matching Report</h3>
                                <p className="text-sm text-slate-500 mt-1">Review client and competitor fields side by side, click any competitor card to inspect the full raw rows, and exclude outliers before moving on to pricing.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button onClick={() => setStep(2)} className="px-4 py-2.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm transition-all">Refine Matching</button>
                                <button onClick={() => setStep(4)} disabled={reviewRows.length === 0} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold text-sm transition-all">
                                    <Play size={15} fill="currentColor" /> Continue to Pricing Setup
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
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                            <div>
                                <p className="text-sm font-bold text-slate-900">Interactive Match Review</p>
                                <p className="text-xs text-slate-500 mt-1">Click a competitor card to inspect the full client and competitor records before pricing uses that match.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                                    {reviewRows.length} total matched row{reviewRows.length === 1 ? '' : 's'}
                                </span>
                                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${excludedMatchIds.length ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {excludedMatchIds.length} excluded from pricing
                                </span>
                            </div>
                        </div>
                        {groupedReviewRows.length > 0 ? (
                            <div className="space-y-3">
                                {groupedReviewRows.map((group) => (
                                    <ReviewGroupCard
                                        key={group.id}
                                        group={group}
                                        clientLabel={ourDataset.label}
                                        onOpenMatch={setSelectedMatch}
                                        onToggleExclude={toggleExcludedMatch}
                                        excludedMatchIds={excludedMatchIds}
                                    />
                        ))}
                    </div>
                ) : (
                    <EmptyState title="No side-by-side matches were generated" text="Try lowering the threshold or checking the competitor match columns for each source." />
                )}
                <MatchDetailDialog
                    selection={selectedMatch}
                    excluded={Boolean(selectedMatch?.row?.match_id && excludedMatchIds.includes(selectedMatch.row.match_id))}
                    excludedMatchIds={excludedMatchIds}
                    onClose={() => setSelectedMatch(null)}
                    onToggleExclude={toggleExcludedMatch}
                    clientLabel={ourDataset.label}
                />
            </Motion.div>
                ) : null}

                {!loading && step === 4 ? (
                    <Motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">Pricing Setup</h3>
                                <p className="text-sm text-slate-500 mt-1">Add pricing fields, market position, and guardrails. The engine will reuse the reviewed matches from the matching report.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                <SectionTitle icon={TrendingUp} iconClass="text-amber-600" iconBg="bg-amber-50 border-amber-100" title="Market Position Strategy" description="Choose how your final price should sit relative to the reviewed competitor market." />
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                                    {(strategies.length ? strategies : []).map((item) => (
                                        <button key={item.id} onClick={() => setStrategy((prev) => ({ ...prev, position: item.id }))} className={`text-left rounded-2xl border p-4 transition-all ${strategy.position === item.id ? 'border-amber-500 bg-amber-50 shadow-sm' : 'border-slate-200 bg-white hover:border-amber-300'}`}>
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
                                {currentStrategy ? <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600"><span className="font-bold text-slate-900">{currentStrategy.name}: </span>{currentStrategy.description}</div> : null}
                            </div>

                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                <SectionTitle icon={Settings} iconClass="text-sky-600" iconBg="bg-sky-50 border-sky-100" title="Client Pricing Fields" description="Map the internal cost and pricing columns used by the engine." />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <SelectField label="Current price" value={ourColumns.currentPrice} onChange={(value) => setOurColumns((prev) => ({ ...prev, currentPrice: value }))} options={ourDataset.columns} required />
                                    <SelectField label="COGS" value={ourColumns.cogs} onChange={(value) => setOurColumns((prev) => ({ ...prev, cogs: value }))} options={ourDataset.columns} />
                                    <SelectField label="Fulfillment / Shipping" value={ourColumns.fulfillment} onChange={(value) => setOurColumns((prev) => ({ ...prev, fulfillment: value }))} options={ourDataset.columns} />
                                    <SelectField label="Commission" value={ourColumns.commission} onChange={(value) => setOurColumns((prev) => ({ ...prev, commission: value }))} options={ourDataset.columns} />
                                    <SelectField label="Advertising" value={ourColumns.advertising} onChange={(value) => setOurColumns((prev) => ({ ...prev, advertising: value }))} options={ourDataset.columns} />
                                    <SelectField label="Stock qty" value={ourColumns.stock} onChange={(value) => setOurColumns((prev) => ({ ...prev, stock: value }))} options={ourDataset.columns} />
                                    <SelectField label="Demand / velocity" value={ourColumns.demand} onChange={(value) => setOurColumns((prev) => ({ ...prev, demand: value }))} options={ourDataset.columns} />
                                    <SelectField label="Rating" value={ourColumns.rating} onChange={(value) => setOurColumns((prev) => ({ ...prev, rating: value }))} options={ourDataset.columns} />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                <SectionTitle icon={Activity} iconClass="text-rose-600" iconBg="bg-rose-50 border-rose-100" title="Dynamic Repricing Signals" description="Model demand, stock, and rating shifts before final pricing." />
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
                                <SectionTitle icon={Sparkles} iconClass="text-indigo-600" iconBg="bg-indigo-50 border-indigo-100" title="Elasticity and Guardrails" description="Test price sensitivity and enforce allowed price limits." />
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50">
                                        <input type="checkbox" checked={elasticity.enabled} onChange={(event) => setElasticity((prev) => ({ ...prev, enabled: event.target.checked }))} className="w-4 h-4 accent-indigo-600" />
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">Enable elasticity testing</p>
                                            <p className="text-xs text-slate-500">Compare multiple price points before the final recommendation.</p>
                                        </div>
                                    </label>
                                    <NumericField label="Elasticity coefficient" value={elasticity.coefficient} step="0.1" onChange={(value) => setElasticity((prev) => ({ ...prev, coefficient: value }))} />
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">CleanFlow tests five price points around the market-adjusted price and keeps the most profitable candidate.</div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <NumericField label="Minimum price guardrail" value={pricingLimits.minPrice} onChange={(value) => setPricingLimits((prev) => ({ ...prev, minPrice: value }))} />
                                    <NumericField label="Maximum price guardrail" value={pricingLimits.maxPrice} onChange={(value) => setPricingLimits((prev) => ({ ...prev, maxPrice: value }))} />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <button onClick={() => setStep(3)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Back to Review</button>
                            <button onClick={handleExecute} disabled={!canRunPricing} className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-amber-600/20">
                                <Play size={16} fill="currentColor" /> Run Pricing Engine
                            </button>
                        </div>
                    </Motion.div>
                ) : null}

                {!loading && step === 5 ? (
                    <Motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">Pricing Recommendations Ready</h3>
                                <p className="text-sm text-slate-500 mt-1">CleanFlow used the reviewed matches and all loaded competitor datasets to generate a market-backed price recommendation.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <DownloadButton sessionId={sessionId} format="csv" label="Download CSV" icon={FileText} />
                                <DownloadButton sessionId={sessionId} format="excel" label="Download Excel" icon={FileSpreadsheet} />
                                <button onClick={() => setStep(4)} className="px-4 py-2.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm transition-all">Back to Pricing Setup</button>
                                <button onClick={resetBuilder} className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all">New Pricing Run</button>
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
                        {finalRows.length > 0 ? <ResultsTable rows={finalRows} /> : <EmptyState title="No recommendations were generated" text="Try lowering the threshold or loading more competitor datasets." />}
                    </Motion.div>
                ) : null}
            </div>
        </div>
    );
}

function Header({ step }) {
    return (
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
            <div className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                    <TrendingUp size={18} className="text-amber-600" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Pricing Intelligence</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Load one client dataset, compare with multiple competitors, review matches, then price confidently.</p>
                </div>
            </div>
            <div className="flex items-center gap-1">
                {STEPS.map((label, index) => {
                    const current = index + 1;
                    return (
                        <div key={label} className="flex items-center">
                            <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${step === current ? 'bg-amber-600 text-white' : step > current ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${step === current ? 'bg-white text-amber-600' : step > current ? 'bg-amber-500 text-white' : 'bg-slate-300 text-slate-500'}`}>{step > current ? 'v' : current}</span>
                                {label}
                            </div>
                            {current < STEPS.length ? <div className={`w-6 h-px mx-1 ${step > current ? 'bg-amber-300' : 'bg-slate-200'}`} /> : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function LoadingState({ progress, elapsedTime }) {
    return (
        <div className="flex flex-col items-center justify-center h-72 gap-5">
            <div className="w-full max-w-xl">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-600 mb-2">
                    <span>{progress.message || 'Analyzing competitor markets...'}</span>
                    <span>{progress.percent}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <Motion.div className="bg-amber-500 h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${progress.percent}%` }} transition={{ duration: 0.4 }} />
                </div>
            </div>
            <p className="text-slate-400 text-sm">Elapsed: <span className="font-mono font-bold">{Math.floor(elapsedTime / 60)}:{String(elapsedTime % 60).padStart(2, '0')}</span></p>
        </div>
    );
}

function IntroCards() {
    const cards = [
        { icon: Database, title: 'Competitor Price Monitoring', text: 'Upload any number of competitor datasets and benchmark the market continuously.' },
        { icon: Eye, title: 'Side-by-Side Match Review', text: 'Review client products and competitor matches before trusting the price recommendation.' },
        { icon: ShieldCheck, title: 'Margin-Safe Recommendation', text: 'Protect gross margin using cost floors, strategy, dynamic signals, and elasticity.' },
    ];
    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {cards.map((item) => (
                <div key={item.title} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-3">
                        <item.icon size={18} className="text-amber-600" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mb-1.5">{item.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{item.text}</p>
                </div>
            ))}
        </div>
    );
}

function SectionTitle({ icon, iconClass, iconBg, title, description }) {
    const IconComponent = icon;

    return (
        <div className="flex items-center gap-3 mb-4">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${iconBg}`}>
                <IconComponent size={16} className={iconClass} />
            </div>
            <div>
                <h3 className="text-base font-bold text-slate-900">{title}</h3>
                <p className="text-xs text-slate-500">{description}</p>
            </div>
        </div>
    );
}

function DatasetCard({
    title,
    subtitle,
    label,
    onLabelChange,
    loaded,
    rows,
    columns,
    mode,
    onModeChange,
    separator,
    onSeparatorChange,
    connectionId,
    onConnectionChange,
    query,
    onQueryChange,
    connections,
    onUpload,
    onDatabaseLoad,
}) {
    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-base font-bold text-slate-900">{title}</h3>
                            <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
                        </div>
                        {onLabelChange ? (
                            <div className="w-full max-w-[220px]">
                                <label className="block text-[11px] font-bold text-slate-500 mb-1.5">Client label</label>
                                <input value={label || ''} onChange={(event) => onLabelChange(event.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-amber-400 outline-none" />
                            </div>
                        ) : null}
                    </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${loaded ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{loaded ? 'Loaded' : 'Pending'}</div>
            </div>
            <div className="flex bg-slate-100 rounded-lg p-0.5 mb-4 w-fit">
                {['file', 'database'].map((item) => (
                    <button key={item} onClick={() => onModeChange(item)} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${mode === item ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{item === 'file' ? 'File Upload' : 'Database'}</button>
                ))}
            </div>
            {mode === 'file' ? (
                <div className="space-y-4">
                    <SeparatorInput value={separator} onChange={onSeparatorChange} />
                    <input type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" id={`upload-${title.replace(/\s+/g, '-').toLowerCase()}`} onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0])} />
                    <label htmlFor={`upload-${title.replace(/\s+/g, '-').toLowerCase()}`} className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm cursor-pointer transition-all ${loaded ? 'bg-emerald-50 border-2 border-emerald-200 text-emerald-700' : 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm shadow-amber-600/20'}`}>
                        {loaded ? <><CheckCircle size={15} /> Replace Dataset</> : <><Upload size={15} /> Upload CSV or Excel</>}
                    </label>
                </div>
            ) : (
                <div className="space-y-3">
                    {connections.length === 0 ? (
                        <div className="text-sm text-slate-500 bg-slate-50 rounded-xl border border-slate-200 px-4 py-5">Save a database connection in CleanFlow first, then return here to query pricing inputs directly.</div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">Connection</label>
                                <select value={connectionId} onChange={(event) => onConnectionChange(event.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-amber-400 outline-none">
                                    {connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">SQL Query</label>
                                <textarea rows={4} value={query} onChange={(event) => onQueryChange(event.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-amber-400 outline-none resize-none" />
                            </div>
                            <button onClick={onDatabaseLoad} className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition-colors">Load Dataset from Database</button>
                        </>
                    )}
                </div>
            )}
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>{columns.length} columns detected</span>
                <span>{rows} rows loaded</span>
            </div>
        </div>
    );
}

function CompetitorSourceCard({ source, index, connections, onChange, onUpload, onDatabaseLoad, onRemove, canRemove }) {
    return (
        <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
            <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5">Competitor label</label>
                    <input value={source.label} onChange={(event) => onChange({ label: event.target.value })} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:border-amber-400 outline-none" />
                </div>
                <div className="flex items-center gap-2">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${source.loaded ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-500 border border-slate-200'}`}>{source.loaded ? 'Loaded' : `Competitor ${index + 1}`}</div>
                    {canRemove ? <button onClick={onRemove} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button> : null}
                </div>
            </div>
            <div className="flex bg-white rounded-lg p-0.5 mb-4 w-fit border border-slate-200">
                {['file', 'database'].map((item) => (
                    <button key={item} onClick={() => onChange({ mode: item })} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${source.mode === item ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{item === 'file' ? 'File Upload' : 'Database'}</button>
                ))}
            </div>
            {source.mode === 'file' ? (
                <div className="space-y-4">
                    <SeparatorInput value={source.separator} onChange={(separator) => onChange({ separator })} />
                    <input type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" id={`upload-${source.id}`} onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0])} />
                    <label htmlFor={`upload-${source.id}`} className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm cursor-pointer transition-all ${source.loaded ? 'bg-emerald-50 border-2 border-emerald-200 text-emerald-700' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}>
                        {source.loaded ? <><CheckCircle size={15} /> Replace Dataset</> : <><Upload size={15} /> Upload Competitor Feed</>}
                    </label>
                </div>
            ) : (
                <div className="space-y-3">
                    {connections.length === 0 ? (
                        <div className="text-sm text-slate-500 bg-white rounded-xl border border-slate-200 px-4 py-5">Save a database connection in CleanFlow first, then return here to query competitor feeds directly.</div>
                    ) : (
                        <>
                            <select value={source.connectionId} onChange={(event) => onChange({ connectionId: event.target.value })} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:border-amber-400 outline-none">
                                {connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name}</option>)}
                            </select>
                            <textarea rows={4} value={source.query} onChange={(event) => onChange({ query: event.target.value })} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:border-amber-400 outline-none resize-none" />
                            <button onClick={onDatabaseLoad} className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition-colors">Load Competitor Dataset</button>
                        </>
                    )}
                </div>
            )}
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>{source.columns.length} columns detected</span>
                <span>{source.rows} rows loaded</span>
            </div>
        </div>
    );
}

function SeparatorInput({ value, onChange }) {
    return (
        <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-500">Separator</span>
            <div className="flex flex-wrap items-center gap-1.5">
                {PRESET_SEPARATORS.map((delimiter) => (
                    <button key={delimiter} onClick={() => onChange(delimiter)} className={`w-8 h-8 rounded-lg border font-mono text-xs transition-all ${value === delimiter ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-500 border-slate-200 hover:border-amber-400'}`}>{delimiter}</button>
                ))}
                <input type="text" maxLength={4} placeholder="Custom" value={!PRESET_SEPARATORS.includes(value) ? value : ''} onChange={(event) => onChange(event.target.value)} className={`w-20 h-8 px-2 py-1 border rounded-lg text-xs font-mono focus:outline-none transition-all ${!PRESET_SEPARATORS.includes(value) && value ? 'border-amber-600 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-600 focus:border-amber-400'}`} />
            </div>
            <p className="text-[11px] text-slate-400">Use one character like `^`, `:`, `|`, or type `\t` for tab-separated files.</p>
        </div>
    );
}

function ReviewGroupCard({ group, clientLabel, onOpenMatch, onToggleExclude, excludedMatchIds }) {
    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-4 items-start">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{clientLabel || 'Client'}</p>
                        <span className="px-2 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-600">{group.competitors.length} match{group.competitors.length === 1 ? '' : 'es'}</span>
                    </div>
                    <div className="flex gap-3">
                        <ProductThumbnail key={`${group.client_product_url || ''}-${group.client_image_url || ''}`} src={group.client_image_url} alt={group.client_product_name} baseHref={group.client_product_url} />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-900 break-words">{group.client_product_name}</p>
                            <p className="text-xs text-slate-500 mt-1">{group.client_sku || 'No SKU provided'}</p>
                            <p className="text-xs text-slate-600 mt-2">Primary match value: <span className="font-semibold text-slate-900 break-all">{group.client_match_value}</span></p>
                            <p className="text-xs text-slate-600 mt-1.5">Current price: <span className="font-semibold text-slate-900">{group.client_price ? formatCurrency(group.client_price) : 'Not mapped'}</span></p>
                            <div className="mt-2">
                                <ExternalProductLink href={group.client_product_url} emptyLabel="No client product URL" />
                            </div>
                        </div>
                    </div>
                    <CompactFieldList title="Client Selected Fields" fields={group.client_fields || []} tone="slate" />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Matched Competitors</p>
                            <p className="text-xs text-slate-500 mt-1">Click a competitor card to inspect the full matched dataset and exclude any outlier before pricing runs.</p>
                        </div>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-1">
                        {group.competitors.map((row, index) => (
                            <CompetitorReviewPanel
                                key={row.match_id || `${row.competitor_source}-${row.competitor_product_name}-${index}`}
                                row={row}
                                excluded={Boolean(row.match_id && excludedMatchIds.includes(row.match_id))}
                                onOpen={() => onOpenMatch({ row, group })}
                                onToggleExclude={() => onToggleExclude(row.match_id)}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function CompetitorReviewPanel({ row, excluded, onOpen, onToggleExclude }) {
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onOpen}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpen();
                }
            }}
            className={`min-w-[320px] max-w-[360px] rounded-2xl border p-4 transition-all cursor-pointer ${excluded ? 'border-rose-200 bg-rose-50/70 opacity-80' : 'border-slate-200 bg-amber-50/40 hover:border-amber-300 hover:shadow-sm'}`}
        >
            <div className="flex items-center justify-between gap-3 mb-3">
                <span className={`px-2 py-1 rounded-full bg-white border text-[11px] font-bold ${excluded ? 'border-rose-200 text-rose-700' : 'border-amber-200 text-amber-700'}`}>{row.competitor_source}</span>
                <div className="flex items-center gap-2">
                    {excluded ? <span className="inline-flex px-2 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">Excluded</span> : null}
                    <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-bold ${row.match_quality === 'High' ? 'bg-emerald-100 text-emerald-700' : row.match_quality === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>{row.match_quality}</span>
                </div>
            </div>
            <div className="flex gap-3">
                <ProductThumbnail key={`${row.competitor_product_url || ''}-${row.competitor_image_url || ''}`} src={row.competitor_image_url} alt={row.competitor_product_name} baseHref={row.competitor_product_url} />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 break-words">{row.competitor_product_name}</p>
                    <p className="text-xs text-slate-500 mt-1">{row.competitor_seller || 'Seller not provided'}</p>
                    <p className="text-xs text-slate-600 mt-2">Price: <span className="font-semibold text-slate-900">{row.competitor_price ? formatCurrency(row.competitor_price) : 'Not mapped'}</span></p>
                    <p className="text-xs text-slate-600 mt-1.5">Similarity: <span className="font-semibold text-violet-700">{(Number(row.similarity_score || 0) * 100).toFixed(1)}%</span></p>
                    <p className="text-xs text-slate-600 mt-1.5">Rules matched: <span className="font-semibold text-slate-900">{row.matched_rule_count || 0}/{row.total_rule_count || 0}</span></p>
                    <div className="mt-2">
                        <ExternalProductLink href={row.competitor_product_url} emptyLabel="No competitor product URL" />
                    </div>
                </div>
            </div>
            <CompactFieldList title="Competitor Selected Fields" fields={row.competitor_fields || []} tone="amber" />
            <CompactMatchAttributeList attributes={row.matched_attributes || []} />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onOpen();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                    <Eye size={14} /> View full match data
                </button>
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onToggleExclude();
                    }}
                    className={`rounded-xl px-3 py-2 text-xs font-bold transition-colors ${excluded ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-rose-600 text-white hover:bg-rose-700'}`}
                >
                    {excluded ? 'Restore match' : 'Exclude from pricing'}
                </button>
            </div>
        </div>
    );
}

function CompactFieldList({ title, fields, tone = 'slate' }) {
    if (!fields.length) {
        return null;
    }

    const toneClasses = tone === 'amber'
        ? 'bg-white/80 border-amber-200'
        : 'bg-white border-slate-200';

    return (
        <div className={`mt-3 rounded-2xl border p-3 ${toneClasses}`}>
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">{title}</p>
            <div className="space-y-1.5">
                {fields.map((field, index) => (
                    <div key={`${field.key || field.label}-${index}`} className="grid grid-cols-[120px_1fr] gap-2 text-xs">
                        <span className="font-semibold text-slate-500">{field.label}</span>
                        <span className="text-slate-800 break-words">{field.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function CompactMatchAttributeList({ attributes }) {
    if (!attributes.length) {
        return null;
    }

    return (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white/90 p-3">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Matched Attributes</p>
            <div className="space-y-2">
                {attributes.map((attribute, index) => (
                    <div key={`${attribute.client_column}-${attribute.competitor_column}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="font-semibold text-slate-900">{attribute.label || humanizeColumn(attribute.client_column)}</span>
                            <span className="font-bold text-violet-700">{(Number(attribute.score || 0) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="mt-1.5 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                            <div className="break-words"><span className="font-semibold text-slate-500">Client:</span> {attribute.client_value || '—'}</div>
                            <div className="break-words"><span className="font-semibold text-slate-500">Competitor:</span> {attribute.competitor_value || '—'}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function MatchDetailDialog({ selection, excluded, excludedMatchIds, onClose, onToggleExclude, clientLabel }) {
    if (!selection?.row) {
        return null;
    }

    const { row: match, group } = selection;

    return (
        <div className="fixed inset-y-0 left-0 right-0 z-[70] bg-slate-950/45 p-3 overflow-y-auto lg:left-[260px] lg:p-6" onClick={onClose}>
            <div className="min-h-full flex items-start lg:items-center justify-center">
                <div className="w-full max-w-7xl max-h-[94vh] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Matched Dataset Inspection</p>
                        <h4 className="mt-1 text-lg font-black text-slate-900">Validate the full client and competitor rows</h4>
                        <p className="mt-1 text-sm text-slate-500">Use this view to verify the matched records and remove any outlier before pricing uses it.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{match.competitor_source}</span>
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${excluded ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {excluded ? 'Excluded from pricing' : 'Included in pricing'}
                        </span>
                        <button
                            type="button"
                            onClick={() => onToggleExclude(match.match_id)}
                            className={`rounded-xl px-3 py-2 text-xs font-bold transition-colors ${excluded ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-rose-600 text-white hover:bg-rose-700'}`}
                        >
                            {excluded ? 'Restore match' : 'Exclude match'}
                        </button>
                        <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                            Close
                        </button>
                    </div>
                </div>

                <div className="max-h-[calc(92vh-88px)] overflow-y-auto px-5 py-5">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                            <div className="flex items-start justify-between gap-3 mb-4">
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{clientLabel || 'Client'}</p>
                                    <p className="mt-1 text-lg font-bold text-slate-900 break-words">{match.client_product_name}</p>
                                    <p className="mt-1 text-xs text-slate-500">{match.client_sku || 'No SKU provided'}</p>
                                </div>
                                <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 border border-slate-200">Client row #{Number(match.client_index ?? 0) + 1}</span>
                            </div>
                            <div className="flex gap-4">
                                <ProductThumbnail src={match.client_image_url} alt={match.client_product_name} baseHref={match.client_product_url} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-slate-600">Primary match value: <span className="font-semibold text-slate-900 break-all">{match.client_match_value || 'Not provided'}</span></p>
                                    <p className="mt-2 text-sm text-slate-600">Current price: <span className="font-semibold text-slate-900">{match.client_price ? formatCurrency(match.client_price) : 'Not mapped'}</span></p>
                                    <div className="mt-3">
                                        <ExternalProductLink href={match.client_product_url} emptyLabel="No client product URL" />
                                    </div>
                                </div>
                            </div>
                            <CompactFieldList title="Selected Review Fields" fields={match.client_fields || []} tone="slate" />
                            <RecordFieldGrid title="Complete Client Row" fields={match.client_record || []} tone="slate" />
                        </div>

                        <div className="rounded-3xl border border-amber-200 bg-amber-50/40 p-5">
                            <div className="flex items-start justify-between gap-3 mb-4">
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-wider text-amber-700/80">Competitor</p>
                                    <p className="mt-1 text-lg font-bold text-slate-900 break-words">{match.competitor_product_name}</p>
                                    <p className="mt-1 text-xs text-slate-500">{match.competitor_seller || 'Seller not provided'}</p>
                                </div>
                                <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 border border-amber-200">Competitor row #{Number(match.competitor_index ?? 0) + 1}</span>
                            </div>
                            <div className="flex gap-4">
                                <ProductThumbnail src={match.competitor_image_url} alt={match.competitor_product_name} baseHref={match.competitor_product_url} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-slate-600">Similarity: <span className="font-semibold text-violet-700">{(Number(match.similarity_score || 0) * 100).toFixed(1)}%</span></p>
                                    <p className="mt-2 text-sm text-slate-600">Competitor price: <span className="font-semibold text-slate-900">{match.competitor_price ? formatCurrency(match.competitor_price) : 'Not mapped'}</span></p>
                                    <div className="mt-3">
                                        <ExternalProductLink href={match.competitor_product_url} emptyLabel="No competitor product URL" />
                                    </div>
                                </div>
                            </div>
                            <CompactFieldList title="Selected Review Fields" fields={match.competitor_fields || []} tone="amber" />
                            <RecordFieldGrid title="Complete Competitor Row" fields={match.competitor_record || []} tone="amber" />
                        </div>
                    </div>

                    <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Matched Attributes</p>
                                <p className="mt-1 text-sm text-slate-500">These are the compared attributes that produced this client-to-competitor match.</p>
                            </div>
                            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                                {match.matched_rule_count || 0}/{match.total_rule_count || 0} rules matched
                            </span>
                        </div>
                        <CompactMatchAttributeList attributes={match.matched_attributes || []} />
                    </div>

                    {group?.competitors?.length > 1 ? (
                        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Other Matched Competitors</p>
                                    <p className="mt-1 text-sm text-slate-500">These additional competitor rows were matched against the same client product.</p>
                                </div>
                                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                                    {group.competitors.length} competitor match{group.competitors.length === 1 ? '' : 'es'}
                                </span>
                            </div>
                            <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                                {group.competitors.map((candidate, index) => {
                                    const candidateExcluded = Boolean(candidate.match_id && excludedMatchIds.includes(candidate.match_id));
                                    return (
                                        <div
                                            key={candidate.match_id || `${candidate.competitor_source}-${index}`}
                                            className={`min-w-[240px] rounded-2xl border p-3 ${candidate.match_id === match.match_id ? 'border-violet-300 bg-violet-50' : candidateExcluded ? 'border-rose-200 bg-rose-50/70' : 'border-slate-200 bg-slate-50'}`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-bold text-slate-700">{candidate.competitor_source}</span>
                                                <span className="text-xs font-bold text-violet-700">{(Number(candidate.similarity_score || 0) * 100).toFixed(1)}%</span>
                                            </div>
                                            <p className="mt-2 text-sm font-bold text-slate-900 break-words">{candidate.competitor_product_name}</p>
                                            <p className="mt-1 text-xs text-slate-500">{candidateExcluded ? 'Excluded from pricing' : 'Included in pricing'}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
            </div>
        </div>
    );
}

function RecordFieldGrid({ title, fields, tone = 'slate' }) {
    if (!fields.length) {
        return (
            <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white/80 px-4 py-3 text-xs text-slate-500">
                No dataset values were returned for this row.
            </div>
        );
    }

    const toneClasses = tone === 'amber'
        ? 'border-amber-200 bg-white/85'
        : 'border-slate-200 bg-white';

    return (
        <div className={`mt-3 rounded-2xl border ${toneClasses}`}>
            <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{title}</p>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
                <div className="divide-y divide-slate-100">
                    {fields.map((field, index) => (
                        <div key={`${field.column}-${index}`} className="grid grid-cols-[170px_1fr] gap-3 px-4 py-2.5 text-xs">
                            <span className="font-semibold text-slate-500 break-words">{field.label || humanizeColumn(field.column)}</span>
                            <span className="text-slate-800 break-words">{field.value || '—'}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function ReviewCard({ row }) {
    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto_1fr_auto] gap-4 items-stretch">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Client Product</p>
                    <div className="flex gap-4">
                        <ProductThumbnail key={`${row.client_product_url || ''}-${row.client_image_url || ''}`} src={row.client_image_url} alt={row.client_product_name} baseHref={row.client_product_url} />
                        <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-900 break-words">{row.client_product_name}</p>
                            <p className="text-sm text-slate-500 mt-1">{row.client_sku || 'No SKU provided'}</p>
                            <p className="text-sm text-slate-600 mt-3">Primary match value: <span className="font-semibold text-slate-900 break-all">{row.client_match_value}</span></p>
                            <p className="text-sm text-slate-600 mt-2">Current price: <span className="font-semibold text-slate-900">{row.client_price ? formatCurrency(row.client_price) : 'Not mapped'}</span></p>
                            <div className="mt-3">
                                <ExternalProductLink href={row.client_product_url} emptyLabel="No client product URL" />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-center text-amber-500 font-black text-xl">vs</div>
                <div className="rounded-2xl border border-slate-200 bg-amber-50/50 p-4">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Competitor Product</p>
                    <div className="flex gap-4">
                        <ProductThumbnail key={`${row.competitor_product_url || ''}-${row.competitor_image_url || ''}`} src={row.competitor_image_url} alt={row.competitor_product_name} baseHref={row.competitor_product_url} />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                                <p className="font-bold text-slate-900 break-words">{row.competitor_product_name}</p>
                                <span className="px-2.5 py-1 rounded-full bg-white border border-amber-200 text-amber-700 text-xs font-bold shrink-0">{row.competitor_source}</span>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">{row.competitor_seller || 'Seller not provided'}</p>
                            <p className="text-sm text-slate-600 mt-3">Competitor price: <span className="font-semibold text-slate-900">{row.competitor_price ? formatCurrency(row.competitor_price) : 'Not mapped'}</span></p>
                            <p className="text-sm text-slate-600 mt-2">Rating: <span className="font-semibold text-slate-900">{row.competitor_rating || 'N/A'}</span></p>
                            <div className="mt-3">
                                <ExternalProductLink href={row.competitor_product_url} emptyLabel="No competitor product URL" />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 min-w-[150px]">
                    <div>
                        <p className="text-xs font-black uppercase tracking-wider text-slate-400">Similarity</p>
                        <p className="text-2xl font-black text-violet-700 mt-2">{(Number(row.similarity_score) * 100).toFixed(1)}%</p>
                    </div>
                    <div className="space-y-2">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${row.match_quality === 'High' ? 'bg-emerald-100 text-emerald-700' : row.match_quality === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>{row.match_quality}</span>
                        <p className="text-xs text-slate-500">Rules matched: <span className="font-semibold text-slate-900">{row.matched_rule_count || 0}/{row.total_rule_count || 0}</span></p>
                        <p className="text-xs text-slate-500">Price gap: <span className="font-semibold text-slate-900">{row.price_gap_pct > 0 ? '+' : ''}{row.price_gap_pct}%</span></p>
                    </div>
                </div>
            </div>
            <SelectedFieldTable clientFields={row.client_fields || []} competitorFields={row.competitor_fields || []} />
            <MatchAttributeTable attributes={row.matched_attributes || []} />
        </div>
    );
}

function ProductThumbnail({ src, alt, baseHref = '' }) {
    const [failed, setFailed] = useState(false);
    const normalizedSrc = normalizeExternalUrl(src, baseHref);

    if (!normalizedSrc || failed) {
        return (
            <div aria-label="No image available" className="w-24 h-24 rounded-2xl border border-dashed border-slate-300 bg-slate-100/80 shrink-0" />
        );
    }

    return (
        <img
            src={normalizedSrc}
            alt={alt || 'Product'}
            className="w-24 h-24 rounded-2xl object-cover border border-slate-200 bg-white shrink-0"
            loading="lazy"
            onError={() => setFailed(true)}
        />
    );
}

function ExternalProductLink({ href, emptyLabel }) {
    const normalizedHref = normalizeExternalUrl(href);

    if (!normalizedHref) {
        return <span className="text-xs text-slate-400">{emptyLabel}</span>;
    }

    return (
        <a href={normalizedHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 hover:underline break-all">
            Open product page
        </a>
    );
}

function MatchAttributeTable({ attributes }) {
    if (!attributes.length) {
        return (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                No matched attributes were returned for this pair.
            </div>
        );
    }

    return (
        <div className="mt-4 rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
                <div className="min-w-[720px]">
                    <div className="grid grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_96px] bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                        <div className="px-4 py-3">Attribute</div>
                        <div className="px-4 py-3">Client</div>
                        <div className="px-4 py-3">Competitor</div>
                        <div className="px-4 py-3 text-right">Score</div>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {attributes.map((attribute, index) => (
                            <div key={`${attribute.client_column}-${attribute.competitor_column}-${index}`} className="grid grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_96px] text-sm">
                                <div className="px-4 py-3 bg-white">
                                    <p className="font-semibold text-slate-900">{attribute.label || humanizeColumn(attribute.client_column)}</p>
                                    <p className="text-xs text-slate-400 mt-1">{attribute.algorithm} • {Math.round(Number(attribute.threshold || 0) * 100)}%</p>
                                </div>
                                <div className="px-4 py-3 bg-white text-slate-700 break-words">{attribute.client_value || '—'}</div>
                                <div className="px-4 py-3 bg-white text-slate-700 break-words">{attribute.competitor_value || '—'}</div>
                                <div className="px-4 py-3 bg-white text-right font-bold text-violet-700">{(Number(attribute.score || 0) * 100).toFixed(1)}%</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function SelectedFieldTable({ clientFields, competitorFields }) {
    const rows = Array.from({ length: Math.max(clientFields.length, competitorFields.length) }, (_, index) => ({
        client: clientFields[index] || null,
        competitor: competitorFields[index] || null,
    })).filter((row) => row.client || row.competitor);

    if (!rows.length) {
        return null;
    }

    return (
        <div className="mt-4 rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
                <div className="min-w-[760px]">
                    <div className="grid grid-cols-[180px_minmax(0,1fr)_180px_minmax(0,1fr)] bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                        <div className="px-4 py-3">Client Field</div>
                        <div className="px-4 py-3">Client Value</div>
                        <div className="px-4 py-3">Competitor Field</div>
                        <div className="px-4 py-3">Competitor Value</div>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {rows.map((row, index) => (
                            <div key={`selected-field-${index}`} className="grid grid-cols-[180px_minmax(0,1fr)_180px_minmax(0,1fr)] text-sm">
                                <div className="px-4 py-3 bg-white font-semibold text-slate-900">{row.client?.label || '—'}</div>
                                <div className="px-4 py-3 bg-white text-slate-700 break-words">{row.client?.value || '—'}</div>
                                <div className="px-4 py-3 bg-white font-semibold text-slate-900">{row.competitor?.label || '—'}</div>
                                <div className="px-4 py-3 bg-white text-slate-700 break-words">{row.competitor?.value || '—'}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ResultsTable({ rows }) {
    return (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100">
                <h4 className="font-bold text-slate-900">Recommendation Table</h4>
                <p className="text-sm text-slate-500 mt-1">Showing up to {rows.length} pricing recommendations from the current run.</p>
            </div>
            <div className="overflow-x-auto max-h-[560px]">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase sticky top-0 border-b border-slate-200">
                        <tr>
                            {['Product', 'Current', 'Recommended', 'Competitor Min', 'Competitor Avg', 'Competitor Max', 'Margin', 'Action', 'Signals', 'Note'].map((header) => <th key={header} className="px-5 py-3 whitespace-nowrap font-bold tracking-wider">{header}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rows.map((row, index) => (
                            <tr key={`${row.product_name}-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                                <td className="px-5 py-4 min-w-[280px]"><p className="font-bold text-slate-900">{row.product_name}</p><p className="text-xs text-slate-500 mt-1">{row.sku || 'No SKU provided'}</p><p className="text-xs text-slate-400 mt-1">Sources: {row.matched_competitors || 'None'}</p></td>
                                <td className="px-5 py-4 whitespace-nowrap text-slate-700 font-semibold">{formatCurrency(row.current_price)}</td>
                                <td className="px-5 py-4 whitespace-nowrap"><div className="inline-flex flex-col"><span className="font-black text-emerald-700">{formatCurrency(row.recommended_price)}</span><span className={`text-xs font-semibold ${Number(row.recommended_vs_current_pct) >= 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{Number(row.recommended_vs_current_pct) > 0 ? '+' : ''}{row.recommended_vs_current_pct}%</span></div></td>
                                <td className="px-5 py-4 whitespace-nowrap text-slate-700">{formatCurrency(row.competitor_min_price)}</td>
                                <td className="px-5 py-4 whitespace-nowrap text-slate-700">{formatCurrency(row.competitor_avg_price)}</td>
                                <td className="px-5 py-4 whitespace-nowrap text-slate-700">{formatCurrency(row.competitor_max_price)}</td>
                                <td className="px-5 py-4 whitespace-nowrap"><div className="inline-flex flex-col"><span className="font-bold text-slate-900">{row.margin_pct}%</span><span className="text-xs text-slate-400">Floor {formatCurrency(row.floor_price)}</span></div></td>
                                <td className="px-5 py-4 min-w-[170px]"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${String(row.pricing_action || '').startsWith('Increase') ? 'bg-amber-100 text-amber-700' : String(row.pricing_action || '').startsWith('Decrease') ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{row.pricing_action}</span></td>
                                <td className="px-5 py-4 min-w-[220px] text-slate-600"><div className="space-y-1 text-xs"><p>Demand: <span className="font-bold capitalize text-slate-900">{row.demand_signal}</span></p><p>Stock: <span className="font-bold capitalize text-slate-900">{row.stock_signal}</span></p><p>Review: <span className="font-bold capitalize text-slate-900">{row.review_signal}</span></p><p>Dynamic adj: <span className="font-bold text-slate-900">{row.dynamic_adjustment_pct}%</span></p></div></td>
                                <td className="px-5 py-4 min-w-[280px] text-slate-600 leading-relaxed">{row.note}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function EmptyState({ title, text }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white border border-slate-200 rounded-2xl">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <AlertCircle size={26} className="text-slate-300" />
            </div>
            <p className="font-bold text-slate-700 mb-1">{title}</p>
            <p className="text-sm text-slate-400 max-w-md">{text}</p>
        </div>
    );
}

function SelectField({ label, value, onChange, options, required = false }) {
    return (
        <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">{label} {required ? <span className="text-rose-500">*</span> : null}</label>
            <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-slate-400 outline-none">
                <option value="">Select column...</option>
                {options.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
        </div>
    );
}

function SignalField({ label, value, options, onChange }) {
    return (
        <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">{label}</label>
            <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-slate-400 outline-none">
                {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
        </div>
    );
}

function NumericField({ label, value, onChange, step = '1' }) {
    return (
        <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">{label}</label>
            <input type="number" step={step} value={value} onChange={(event) => onChange(event.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-slate-400 outline-none" />
        </div>
    );
}

function DownloadButton({ sessionId, format, label, icon }) {
    const IconComponent = icon;
    const handleDownload = async () => {
        try {
            const res = await axios.get(`${API_BASE}/features/pricing/download/${sessionId}?fmt=${format}`, { responseType: 'blob' });
            const mime = format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv';
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

    return <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all shadow-md"><IconComponent size={15} /> {label}</button>;
}
