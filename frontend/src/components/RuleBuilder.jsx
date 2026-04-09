import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Play, AlertCircle, CheckCircle2, History, X, Save, FolderOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'import.meta.env.VITE_API_URL';
const SAVED_RULESETS_KEY = 'cleanflow_saved_rulesets_v1';

const RULE_CATEGORIES = {
    "Data Type & Format": [
        { label: "Check Type (Integer, Decimal, etc.)", value: "type_check" },
        { label: "Date Format", value: "date_format" }
    ],
    "Length & Size": [
        { label: "Minimum Length", value: "length_min" },
        { label: "Maximum Length", value: "length_max" },
        { label: "Exact Length", value: "length_exact" },
        // { label: "Length Between", value: "length_between" }
    ],
    "Value Range": [
        { label: "Greater Than", value: "value_gt" },
        { label: "Less Than", value: "value_lt" },
        { label: "Between (Inclusive)", value: "value_between" },
        { label: "Positive Only", value: "value_positive" },
        { label: "Negative Only", value: "value_negative" },
        { label: "Not Null", value: "not_null" }, // Moving logic here for UI simplicity? Or separate? 
    ],
    "Patterns": [
        { label: "Email Format", value: "regex_email" },
        { label: "Starts With", value: "starts_with" },
        { label: "Ends With", value: "ends_with" },
        { label: "Custom Regex", value: "regex_custom" },
        { label: "Allowed Values (List)", value: "allowed_values" },
        { label: "Disallowed Values (List)", value: "disallowed_values" }
    ],
    "Custom Rules": [
        { label: "Custom Expression", value: "custom_expression" },
        { label: "Compare with Column", value: "column_compare" },
        { label: "Conditional Rule", value: "conditional_rule" }
    ]
};

const DATA_TYPES = [
    { label: "Integer", value: "integer" },
    { label: "Float/Decimal", value: "float" },
    { label: "String", value: "string" },
    { label: "Boolean", value: "boolean" },
    { label: "Date", value: "date" },
    { label: "Alphabetic", value: "alphabetic" },
    { label: "Alphanumeric", value: "alphanumeric" }
];

const DATE_FORMATS = [
    { label: "YYYY-MM-DD (2023-12-31)", value: "%Y-%m-%d" },
    { label: "DD-MM-YYYY (31-12-2023)", value: "%d-%m-%Y" },
    { label: "MM-DD-YYYY (12-31-2023)", value: "%m-%d-%Y" },
    { label: "YYYY/MM/DD (2023/12/31)", value: "%Y/%m/%d" },
    { label: "DD/MM/YYYY (31/12/2023)", value: "%d/%m/%Y" },
    { label: "MM/DD/YYYY (12/31/2023)", value: "%m/%d/%Y" },
    { label: "DD-MM-YYYY HH:MM:SS", value: "%d-%m-%Y %H:%M:%S" },
    { label: "YYYY-MM-DD HH:MM:SS", value: "%Y-%m-%d %H:%M:%S" },
    { label: "MM/DD/YYYY HH:MM:SS", value: "%m/%d/%Y %H:%M:%S" },
];

const RuleBuilder = ({ columns = [], onRunValidation, onSaveRules, isEmbedded = false, initialRules = [], compact = false }) => {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pastJobs, setPastJobs] = useState([]);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [savedRuleSets, setSavedRuleSets] = useState([]);
    const [showSavedRulesModal, setShowSavedRulesModal] = useState(false);

    const mapRawRulesToUiRules = (rawRules = []) =>
        rawRules.map(r => {
            const cat = Object.keys(RULE_CATEGORIES).find(c =>
                RULE_CATEGORIES[c].some(rc => rc.value === r.rule_type)
            ) || "Data Type & Format";
            return {
                ...r,
                id: Math.random().toString(36).substring(7),
                category: cat
            };
        });

    useEffect(() => {
        if (initialRules && initialRules.length > 0) {
            setRules(mapRawRulesToUiRules(initialRules));
        }
    }, [initialRules]);

    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(SAVED_RULESETS_KEY) || '[]');
            setSavedRuleSets(Array.isArray(saved) ? saved : []);
        } catch {
            setSavedRuleSets([]);
        }
    }, []);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const res = await axios.get(`${API_BASE}/history/jobs`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                // Filter to jobs that actually have rules
                const withRules = (res.data || []).filter(j => j.rules && j.rules.length > 0);
                setPastJobs(withRules);
            } catch (err) {
                console.error("Failed to fetch history:", err);
            }
        };
        fetchHistory();
    }, []);

    const loadRulesFromJob = (job) => {
        if (!job.rules) return;
        const mappedRules = mapRawRulesToUiRules(job.rules);

        // Append rules
        setRules(prev => [...prev, ...mappedRules]);
        setShowHistoryModal(false);
    };

    const saveCurrentRules = () => {
        if (rules.length === 0) {
            alert('Add at least one rule before saving.');
            return;
        }

        const name = window.prompt('Enter a name for this rule set:');
        if (!name || !name.trim()) return;

        const payloadRules = rules.map(({ column, rule_type, params }) => ({ column, rule_type, params }));
        const next = [
            {
                id: `ruleset_${Date.now()}`,
                name: name.trim(),
                rules: payloadRules,
                created_at: new Date().toISOString()
            },
            ...savedRuleSets
        ];

        setSavedRuleSets(next);
        localStorage.setItem(SAVED_RULESETS_KEY, JSON.stringify(next));
    };

    const applySavedRuleSet = (ruleSet) => {
        const mappedRules = mapRawRulesToUiRules(ruleSet.rules || []);
        if (mappedRules.length === 0) return;

        const shouldReplace = window.confirm('Replace current rules with this saved rule set?');
        if (shouldReplace) {
            setRules(mappedRules);
        } else {
            setRules(prev => [...prev, ...mappedRules]);
        }
        setShowSavedRulesModal(false);
    };

    const deleteSavedRuleSet = (ruleSetId) => {
        const next = savedRuleSets.filter(s => s.id !== ruleSetId);
        setSavedRuleSets(next);
        localStorage.setItem(SAVED_RULESETS_KEY, JSON.stringify(next));
    };

    const addRule = () => {
        setRules([...rules, {
            id: Date.now(),
            column: columns[0] || '',
            category: "Data Type & Format",
            rule_type: "type_check",
            params: {}
        }]);
    };

    const removeRule = (id) => {
        setRules(rules.filter(r => r.id !== id));
    };

    const updateRule = (id, field, value) => {
        // Reset params if type changes
        if (field === 'rule_type') {
            setRules(rules.map(r => r.id === id ? { ...r, [field]: value, params: {} } : r));
        } else {
            setRules(rules.map(r => r.id === id ? { ...r, [field]: value } : r));
        }
    };

    const updateParams = (id, paramKey, paramValue) => {
        setRules(rules.map(r => {
            if (r.id === id) {
                return { ...r, params: { ...r.params, [paramKey]: paramValue } };
            }
            return r;
        }));
    };

    const handleRun = async () => {
        setLoading(true);
        // Clean up rule objects before sending (remove UI ids, categories)
        const payload = rules.map(({ column, rule_type, params }) => ({
            column,
            rule_type,
            params
        }));
        await onRunValidation(payload);
        setLoading(false);
    };

    const shellClass = compact
        ? 'w-full'
        : 'w-full rounded-[28px] border border-slate-200 bg-white p-6 shadow-lg';
    const headerClass = compact
        ? 'flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6'
        : 'mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between';
    const actionsClass = compact
        ? 'flex flex-wrap gap-2'
        : 'flex flex-wrap gap-3';
    const secondaryButtonClass = compact
        ? 'flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold text-sm transition-colors'
        : 'flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-100';
    const accentButtonClass = compact
        ? 'flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 rounded-lg font-semibold text-sm transition-colors'
        : 'flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 transition-all hover:bg-emerald-100';
    const modalCardClass = compact
        ? 'relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 max-h-[80vh] overflow-y-auto'
        : 'relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl';
    
    const getCategoryColor = (category) => {
        const colors = {
            "Data Type & Format": "border-l-blue-500",
            "Length & Size": "border-l-purple-500",
            "Value Range": "border-l-amber-500",
            "Patterns": "border-l-emerald-500",
            "Custom Rules": "border-l-indigo-500"
        };
        return colors[category] || "border-l-slate-400";
    };

    const ruleCardClass = (category) => compact
        ? `p-4 rounded-xl bg-white border border-slate-200 flex flex-col gap-4 relative shadow-sm border-l-4 ${getCategoryColor(category)}`
        : `relative flex flex-col items-start gap-4 rounded-xl border border-slate-200 border-l-4 bg-white p-5 shadow-sm transition-shadow hover:shadow-md md:flex-row md:items-center ${getCategoryColor(category)}`;
    
    const gridClass = compact
        ? 'grid grid-cols-1 lg:grid-cols-2 gap-4 w-full'
        : 'grid w-full grid-cols-1 items-end gap-4 md:grid-cols-12';
    
    const columnSpanClass = compact ? '' : 'col-span-3';
    
    const emptyStateClass = compact
        ? 'text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200'
        : 'rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center';

    return (
        <div className={shellClass}>
            <div className={headerClass}>
                <div className="flex items-center gap-3">
                    {!compact && (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                            <CheckCircle2 size={20} />
                        </div>
                    )}
                    <div>
                        <h3 className={`${compact ? 'text-lg' : 'text-xl'} font-black text-slate-900 tracking-tight`}>Validation Rules</h3>
                        <p className="text-slate-500 font-medium text-sm mt-0.5">{rules.length} conditions established</p>
                    </div>
                </div>
                <div className={actionsClass}>
                    <button
                        onClick={saveCurrentRules}
                        className={accentButtonClass}
                    >
                        <Save size={compact ? 16 : 18} /> Save Config
                    </button>
                    {savedRuleSets.length > 0 && (
                        <button
                            onClick={() => setShowSavedRulesModal(true)}
                            className={compact ? 'flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-lg font-semibold text-sm transition-colors' : 'flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-sm transition-all shadow-sm hover:shadow-md'}
                        >
                            <FolderOpen size={compact ? 16 : 18} /> Use Template
                        </button>
                    )}
                    {pastJobs.length > 0 && (
                        <button
                            onClick={() => setShowHistoryModal(true)}
                            className={secondaryButtonClass}
                        >
                            <History size={compact ? 16 : 18} /> Load Previous
                        </button>
                    )}
                    <button
                        onClick={addRule}
                            className={compact ? 'flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-sm transition-colors' : 'flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800'}
                    >
                        <Plus size={compact ? 16 : 18} /> Add Rule
                    </button>
                </div>
            </div>

            {/* History Modal */}
            <AnimatePresence>
                {showSavedRulesModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                            onClick={() => setShowSavedRulesModal(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className={modalCardClass}
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-slate-900">Saved Rule Sets</h3>
                                <button onClick={() => setShowSavedRulesModal(false)} className="text-slate-400 hover:text-slate-600">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-3">
                                {savedRuleSets.map((set) => (
                                    <div key={set.id} className="p-4 border border-slate-200 rounded-xl">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h4 className="font-bold text-slate-800">{set.name}</h4>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    {new Date(set.created_at).toLocaleString()} • {set.rules?.length || 0} rules
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => deleteSavedRuleSet(set.id)}
                                                className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => applySavedRuleSet(set)}
                                            className="w-full mt-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors"
                                        >
                                            Use This Rule Set
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
                {showHistoryModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                            onClick={() => setShowHistoryModal(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className={modalCardClass}
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-slate-900">Past Validations</h3>
                                <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-3">
                                {pastJobs.map((job) => (
                                    <div key={job.id} className="p-4 border border-slate-200 rounded-xl hover:border-brand-blue/50 transition-colors group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-bold text-slate-800">{job.file_name || job.filename}</h4>
                                                <p className="text-xs text-slate-500">{new Date(job.created_at).toLocaleString()}</p>
                                            </div>
                                            <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded-lg">
                                                {job.rules.length} rules
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => loadRulesFromJob(job)}
                                            className="w-full mt-3 py-2 bg-slate-50 group-hover:bg-blue-600 group-hover:text-white text-slate-600 rounded-lg font-medium text-sm transition-colors"
                                        >
                                            Apply Rules
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <div className="space-y-4 mb-8">
                <AnimatePresence>
                    {rules.map((rule, index) => (
                        <motion.div
                            key={rule.id}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className={ruleCardClass(rule.category)}
                        >
                            {/* Card header: rule number + delete */}
                            <div className="flex items-center justify-between mb-4">
                                <span className="inline-flex items-center gap-1.5 text-xs font-black text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                                    Rule {index + 1}
                                </span>
                                <button
                                    onClick={() => removeRule(rule.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                    title="Remove Rule"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>

                            <div className={gridClass}>
                                {/* Column Selection */}
                                <div className={columnSpanClass}>
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 block">Column Target</label>
                                    {columns.length > 0 ? (
                                        <select
                                            className={`w-full ${compact ? 'p-2.5 rounded-lg text-sm' : 'p-3.5 rounded-xl'} bg-slate-50 border border-slate-200 font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all`}
                                            value={rule.column}
                                            onChange={(e) => updateRule(rule.id, 'column', e.target.value)}
                                        >
                                            <option value="" disabled>Select target...</option>
                                            {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            placeholder="Type column name"
                                            className={`w-full ${compact ? 'p-2.5 rounded-lg' : 'p-3.5 rounded-xl'} bg-slate-50 border border-slate-200 font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm`}
                                            value={rule.column}
                                            onChange={(e) => updateRule(rule.id, 'column', e.target.value)}
                                        />
                                    )}
                                </div>

                                {/* Category Selection */}
                                <div className={columnSpanClass}>
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 block">Rule Category</label>
                                    <select
                                        className={`w-full ${compact ? 'p-2.5 rounded-lg text-sm' : 'p-3.5 rounded-xl'} bg-slate-50 border border-slate-200 font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all`}
                                        value={rule.category}
                                        onChange={(e) => {
                                            const newCategory = e.target.value;
                                            const newRuleType = RULE_CATEGORIES[newCategory][0].value;
                                            setRules(rules.map(r =>
                                                r.id === rule.id
                                                    ? { ...r, category: newCategory, rule_type: newRuleType, params: {} }
                                                    : r
                                            ));
                                        }}
                                    >
                                        {Object.keys(RULE_CATEGORIES).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </div>

                                {/* Rule Type Selection */}
                                <div className={columnSpanClass}>
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 block">Specific Condition</label>
                                    <select
                                        className={`w-full ${compact ? 'p-2.5 rounded-lg text-sm' : 'p-3.5 rounded-xl'} bg-slate-50 border border-slate-200 font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all`}
                                        value={rule.rule_type}
                                        onChange={(e) => updateRule(rule.id, 'rule_type', e.target.value)}
                                    >
                                        {RULE_CATEGORIES[rule.category].map(type => (
                                            <option key={type.value} value={type.value}>{type.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Dynamic Parameters */}
                                <div className={columnSpanClass}>
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 block">Parameters Config</label>
                                    {rule.rule_type === 'type_check' && (
                                        <select
                                            className={`w-full ${compact ? 'p-2.5 rounded-lg text-sm' : 'p-3.5 rounded-xl'} bg-slate-50 border border-slate-200 font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all`}
                                            onChange={(e) => updateParams(rule.id, 'type', e.target.value)}
                                            value={rule.params.type || 'string'}
                                        >
                                            {DATA_TYPES.map(dt => <option key={dt.value} value={dt.value}>{dt.label}</option>)}
                                        </select>
                                    )}

                                    {rule.rule_type === 'date_format' && (
                                        <select
                                            className={`w-full ${compact ? 'p-2.5 rounded-lg text-sm' : 'p-3.5 rounded-xl'} bg-slate-50 border border-slate-200 font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all`}
                                            onChange={(e) => updateParams(rule.id, 'format', e.target.value)}
                                            value={rule.params.format || '%Y-%m-%d'}
                                        >
                                            {DATE_FORMATS.map(fmt => <option key={fmt.value} value={fmt.value}>{fmt.label}</option>)}
                                        </select>
                                    )}

                                    {(rule.rule_type === 'length_min' || rule.rule_type === 'length_max' || rule.rule_type === 'length_exact') && (
                                        <input
                                            type="number"
                                            placeholder="Numeric Value"
                                            className={`w-full ${compact ? 'p-2.5 rounded-lg text-sm' : 'p-3.5 rounded-xl'} bg-slate-50 border border-slate-200 font-semibold outline-none transition-all`}
                                            value={rule.params[rule.rule_type === 'length_exact' ? 'len' : rule.rule_type.split('_')[1]] || ''}
                                            onChange={(e) => updateParams(rule.id, rule.rule_type === 'length_exact' ? 'len' : (rule.rule_type.split('_')[1]), e.target.value)}
                                        />
                                    )}

                                    {(rule.rule_type === 'value_gt' || rule.rule_type === 'value_lt') && (
                                        <input
                                            type="number"
                                            placeholder="Set Threshold"
                                            className={`w-full ${compact ? 'p-2.5 rounded-lg text-sm' : 'p-3.5 rounded-xl'} bg-slate-50 border border-slate-200 font-semibold outline-none transition-all`}
                                            value={rule.params.value || ''}
                                            onChange={(e) => updateParams(rule.id, 'value', e.target.value)}
                                        />
                                    )}

                                    {(rule.rule_type === 'value_between') && (
                                        <div className="flex gap-2">
                                            <input
                                                type="number" placeholder="Min"
                                                className={`w-1/2 ${compact ? 'p-2.5 rounded-lg text-sm' : 'p-3.5 rounded-xl'} bg-slate-50 border border-slate-200 font-semibold outline-none transition-all`}
                                                value={rule.params.min || ''}
                                                onChange={(e) => updateParams(rule.id, 'min', e.target.value)}
                                            />
                                            <input
                                                type="number" placeholder="Max"
                                                className={`w-1/2 ${compact ? 'p-2.5 rounded-lg text-sm' : 'p-3.5 rounded-xl'} bg-slate-50 border border-slate-200 font-semibold outline-none transition-all`}
                                                value={rule.params.max || ''}
                                                onChange={(e) => updateParams(rule.id, 'max', e.target.value)}
                                            />
                                        </div>
                                    )}

                                    {(rule.rule_type === 'regex_email' || rule.rule_type === 'not_null' || rule.rule_type === 'value_positive' || rule.rule_type === 'value_negative') && (
                                        <div className={`p-3.5 bg-slate-100 rounded-xl text-slate-400 text-sm font-semibold text-center h-full flex flex-col justify-center border border-slate-200 border-dashed`}>
                                            No additional parameters
                                        </div>
                                    )}

                                    {rule.rule_type === 'regex_custom' && (
                                        <input
                                            type="text"
                                            placeholder="Pattern (e.g. ^[0-9]{3}$)"
                                            className={`w-full ${compact ? 'p-2.5 rounded-lg text-sm' : 'p-3.5 rounded-xl'} bg-slate-50 border border-slate-200 font-semibold outline-none transition-all text-sm`}
                                            value={rule.params.regex || ''}
                                            onChange={(e) => updateParams(rule.id, 'regex', e.target.value)}
                                        />
                                    )}

                                    {(rule.rule_type === 'allowed_values' || rule.rule_type === 'disallowed_values') && (
                                        <input
                                            type="text"
                                            placeholder="Comma separated lists"
                                            className={`w-full ${compact ? 'p-2.5 rounded-lg text-sm' : 'p-3.5 rounded-xl'} bg-slate-50 border border-slate-200 font-semibold outline-none transition-all text-sm`}
                                            value={rule.params.values ? (Array.isArray(rule.params.values) ? rule.params.values.join(',') : rule.params.values) : ''}
                                            onChange={(e) => updateParams(rule.id, 'values', e.target.value.split(','))}
                                        />
                                    )}

                                    {(rule.rule_type === 'starts_with' || rule.rule_type === 'ends_with') && (
                                        <input
                                            type="text"
                                            placeholder="Target substring..."
                                            className={`w-full ${compact ? 'p-2.5 rounded-lg text-sm' : 'p-3.5 rounded-xl'} bg-slate-50 border border-slate-200 font-semibold outline-none transition-all`}
                                            value={rule.params[rule.rule_type === 'starts_with' ? 'prefix' : 'suffix'] || ''}
                                            onChange={(e) => updateParams(rule.id, rule.rule_type === 'starts_with' ? 'prefix' : 'suffix', e.target.value)}
                                        />
                                    )}

                                    {rule.rule_type === 'custom_expression' && (
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                placeholder="e.g. value > 100"
                                                className={`w-full ${compact ? 'p-2.5 rounded-lg' : 'p-3.5 rounded-xl'} bg-slate-50 border border-slate-200 font-semibold outline-none transition-all text-sm`}
                                                value={rule.params.expression || ''}
                                                onChange={(e) => updateParams(rule.id, 'expression', e.target.value)}
                                            />
                                        </div>
                                    )}

                                    {rule.rule_type === 'column_compare' && (
                                        <div className="flex gap-2 items-center">
                                            <select
                                                className={`w-1/3 ${compact ? 'p-2.5 rounded-lg text-sm' : 'p-3.5 rounded-xl'} bg-slate-50 border border-slate-200 font-semibold outline-none transition-all`}
                                                value={rule.params.operator || '=='}
                                                onChange={(e) => updateParams(rule.id, 'operator', e.target.value)}
                                            >
                                                <option value="==">==</option>
                                                <option value="!=">!=</option>
                                                <option value=">">&gt;</option>
                                                <option value="<">&lt;</option>
                                                <option value=">=">&gt;=</option>
                                                <option value="<=">&lt;=</option>
                                            </select>
                                            <select
                                                className={`w-2/3 ${compact ? 'p-2.5 rounded-lg text-sm' : 'p-3.5 rounded-xl'} bg-slate-50 border border-slate-200 font-semibold outline-none transition-all`}
                                                value={rule.params.compare_column || ''}
                                                onChange={(e) => updateParams(rule.id, 'compare_column', e.target.value)}
                                            >
                                                <option value="" disabled>Column...</option>
                                                {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {rule.rule_type === 'conditional_rule' && (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex gap-2">
                                                <select
                                                    className={`w-1/2 ${compact ? 'p-2.5 rounded-lg text-xs' : 'p-3.5 rounded-xl text-sm'} bg-slate-50 border border-slate-200 font-semibold outline-none transition-all`}
                                                    value={rule.params.condition_column || ''}
                                                    onChange={(e) => updateParams(rule.id, 'condition_column', e.target.value)}
                                                >
                                                    <option value="" disabled>If col...</option>
                                                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                                <input
                                                    type="text"
                                                    placeholder="is equal to..."
                                                    className={`w-1/2 ${compact ? 'p-2.5 rounded-lg text-xs' : 'p-3.5 rounded-xl text-sm'} bg-slate-50 border border-slate-200 font-semibold outline-none transition-all`}
                                                    value={rule.params.condition_value || ''}
                                                    onChange={(e) => updateParams(rule.id, 'condition_value', e.target.value)}
                                                />
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Then expect this value"
                                                className={`w-full ${compact ? 'p-2.5 rounded-lg text-xs' : 'p-3.5 rounded-xl text-sm'} bg-slate-50 border border-slate-200 font-semibold outline-none transition-all`}
                                                value={rule.params.expected_value || ''}
                                                onChange={(e) => updateParams(rule.id, 'expected_value', e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                        </motion.div>
                    ))}
                </AnimatePresence>

                {rules.length === 0 && (
                    <div className={emptyStateClass}>
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                            <AlertCircle className="text-slate-400" size={32} />
                        </div>
                        <h4 className="text-lg font-bold text-slate-800 mb-1">No execution rules defined</h4>
                        <p className="text-slate-500 font-medium max-w-sm mx-auto mb-6">Build a robust rule set by adding conditions to validate your dataset columns.</p>
                        <button onClick={addRule} className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800">
                            + Add Data Rule
                        </button>
                    </div>
                )}
            </div>

            {/* Submit Button Area - always visible, just disabled if empty */}
            <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5">
                {isEmbedded && (
                    <button
                        onClick={() => {
                            const payload = rules.map(({ column, rule_type, params }) => ({ column, rule_type, params }));
                            if (onSaveRules) onSaveRules(payload);
                        }}
                        className={`${compact ? 'px-4 py-2.5 rounded-xl text-sm' : 'px-5 py-3 rounded-xl'} flex items-center gap-2 bg-slate-900 text-sm font-semibold text-white transition-all hover:bg-slate-800 shadow-md`}
                    >
                        Save Configuration <Save size={compact ? 16 : 18} />
                    </button>
                )}
                
                {!isEmbedded && (
                    <button
                        onClick={handleRun}
                        disabled={loading || rules.length === 0}
                        className={`
                            ${compact ? 'px-5 py-3 rounded-xl text-sm' : 'px-6 py-3 rounded-xl'} flex items-center gap-3 text-sm font-semibold transition-all tracking-wide
                            ${rules.length === 0
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25 hover:from-blue-700 hover:to-indigo-700'
                            }
                        `}
                    >
                        {loading ? "Processing..." : "Execute Validation Pipeline"}
                        {!loading && <Play size={compact ? 18 : 20} fill="currentColor" />}
                    </button>
                )}
            </div>

            {columns.length === 0 && (
                <div className="mt-4 p-4 bg-amber-50 text-amber-600 rounded-xl flex items-center gap-2 text-sm border border-amber-200">
                    <AlertCircle size={16} />
                    <span>Warning: No columns detected. Please check your file upload.</span>
                </div>
            )}
        </div>
    );
};

export default RuleBuilder;
