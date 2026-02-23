import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Play, AlertCircle, CheckCircle2, History, X, Save, FolderOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
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

const RuleBuilder = ({ columns, onRunValidation }) => {
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

    return (
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 w-full">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">Validation Rules</h3>
                    <p className="text-slate-400 text-sm">{rules.length} rules defined</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={saveCurrentRules}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold transition-colors"
                    >
                        <Save size={18} /> Save Rule Set
                    </button>
                    {savedRuleSets.length > 0 && (
                        <button
                            onClick={() => setShowSavedRulesModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold transition-colors"
                        >
                            <FolderOpen size={18} /> Use Saved Rules
                        </button>
                    )}
                    {pastJobs.length > 0 && (
                        <button
                            onClick={() => setShowHistoryModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold transition-colors"
                        >
                            <History size={18} /> Load Previous
                        </button>
                    )}
                    <button
                        onClick={addRule}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
                    >
                        <Plus size={18} /> Add Rule
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
                            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto"
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
                            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto"
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
                            className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row gap-4 items-start md:items-center relative group"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 w-full">
                                {/* Column Selection */}
                                <div className="col-span-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Column</label>
                                    <select
                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium focus:border-brand-blue outline-none"
                                        value={rule.column}
                                        onChange={(e) => updateRule(rule.id, 'column', e.target.value)}
                                    >
                                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>

                                {/* Category Selection */}
                                <div className="col-span-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Category</label>
                                    <select
                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium focus:border-brand-blue outline-none"
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
                                <div className="col-span-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Rule</label>
                                    <select
                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium focus:border-brand-blue outline-none"
                                        value={rule.rule_type}
                                        onChange={(e) => updateRule(rule.id, 'rule_type', e.target.value)}
                                    >
                                        {RULE_CATEGORIES[rule.category].map(type => (
                                            <option key={type.value} value={type.value}>{type.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Dynamic Parameters */}
                                <div className="col-span-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Parameters</label>
                                    {rule.rule_type === 'type_check' && (
                                        <select
                                            className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium focus:border-brand-blue outline-none"
                                            onChange={(e) => updateParams(rule.id, 'type', e.target.value)}
                                            value={rule.params.type || 'string'}
                                        >
                                            {DATA_TYPES.map(dt => <option key={dt.value} value={dt.value}>{dt.label}</option>)}
                                        </select>
                                    )}

                                    {rule.rule_type === 'date_format' && (
                                        <select
                                            className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium focus:border-brand-blue outline-none"
                                            onChange={(e) => updateParams(rule.id, 'format', e.target.value)}
                                            value={rule.params.format || '%Y-%m-%d'}
                                        >
                                            {DATE_FORMATS.map(fmt => <option key={fmt.value} value={fmt.value}>{fmt.label}</option>)}
                                        </select>
                                    )}

                                    {(rule.rule_type === 'length_min' || rule.rule_type === 'length_max' || rule.rule_type === 'length_exact') && (
                                        <input
                                            type="number"
                                            placeholder="Value"
                                            className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium outline-none"
                                            value={rule.params[rule.rule_type === 'length_exact' ? 'len' : rule.rule_type.split('_')[1]] || ''}
                                            onChange={(e) => updateParams(rule.id, rule.rule_type === 'length_exact' ? 'len' : (rule.rule_type.split('_')[1]), e.target.value)}
                                        />
                                    )}

                                    {(rule.rule_type === 'value_gt' || rule.rule_type === 'value_lt') && (
                                        <input
                                            type="number"
                                            placeholder="Threshold"
                                            className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium outline-none"
                                            value={rule.params.value || ''}
                                            onChange={(e) => updateParams(rule.id, 'value', e.target.value)}
                                        />
                                    )}

                                    {(rule.rule_type === 'value_between') && (
                                        <div className="flex gap-2">
                                            <input
                                                type="number" placeholder="Min"
                                                className="w-1/2 p-3 bg-white border border-slate-200 rounded-xl font-medium outline-none"
                                                value={rule.params.min || ''}
                                                onChange={(e) => updateParams(rule.id, 'min', e.target.value)}
                                            />
                                            <input
                                                type="number" placeholder="Max"
                                                className="w-1/2 p-3 bg-white border border-slate-200 rounded-xl font-medium outline-none"
                                                value={rule.params.max || ''}
                                                onChange={(e) => updateParams(rule.id, 'max', e.target.value)}
                                            />
                                        </div>
                                    )}

                                    {(rule.rule_type === 'regex_email' || rule.rule_type === 'not_null' || rule.rule_type === 'value_positive' || rule.rule_type === 'value_negative') && (
                                        <div className="p-3 bg-slate-100 rounded-xl text-slate-400 text-sm text-center italic">
                                            No params needed
                                        </div>
                                    )}

                                    {rule.rule_type === 'regex_custom' && (
                                        <input
                                            type="text"
                                            placeholder="Regex Pattern (e.g. ^[0-9]{3}$)"
                                            className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium outline-none"
                                            value={rule.params.regex || ''}
                                            onChange={(e) => updateParams(rule.id, 'regex', e.target.value)}
                                        />
                                    )}

                                    {(rule.rule_type === 'allowed_values' || rule.rule_type === 'disallowed_values') && (
                                        <input
                                            type="text"
                                            placeholder="Comma separated (e.g. A,B,C)"
                                            className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium outline-none"
                                            value={rule.params.values ? (Array.isArray(rule.params.values) ? rule.params.values.join(',') : rule.params.values) : ''}
                                            onChange={(e) => updateParams(rule.id, 'values', e.target.value.split(','))}
                                        />
                                    )}

                                    {(rule.rule_type === 'starts_with' || rule.rule_type === 'ends_with') && (
                                        <input
                                            type="text"
                                            placeholder="Value..."
                                            className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium outline-none"
                                            value={rule.params[rule.rule_type === 'starts_with' ? 'prefix' : 'suffix'] || ''}
                                            onChange={(e) => updateParams(rule.id, rule.rule_type === 'starts_with' ? 'prefix' : 'suffix', e.target.value)}
                                        />
                                    )}

                                    {rule.rule_type === 'custom_expression' && (
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                placeholder="Expression (e.g. value > 100 and value < 500)"
                                                className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium outline-none text-sm"
                                                value={rule.params.expression || ''}
                                                onChange={(e) => updateParams(rule.id, 'expression', e.target.value)}
                                            />
                                            <p className="text-xs text-slate-400">Use 'value' to reference the column value. Supports: &gt;, &lt;, ==, !=, and, or, len()</p>
                                        </div>
                                    )}

                                    {rule.rule_type === 'column_compare' && (
                                        <div className="flex gap-2 items-center">
                                            <select
                                                className="w-1/3 p-3 bg-white border border-slate-200 rounded-xl font-medium outline-none"
                                                value={rule.params.operator || '=='}
                                                onChange={(e) => updateParams(rule.id, 'operator', e.target.value)}
                                            >
                                                <option value="==">Equals (==)</option>
                                                <option value="!=">Not Equals (!=)</option>
                                                <option value=">">Greater Than (&gt;)</option>
                                                <option value="<">Less Than (&lt;)</option>
                                                <option value=">=">Greater or Equal (&gt;=)</option>
                                                <option value="<=">Less or Equal (&lt;=)</option>
                                            </select>
                                            <select
                                                className="w-2/3 p-3 bg-white border border-slate-200 rounded-xl font-medium outline-none"
                                                value={rule.params.compare_column || ''}
                                                onChange={(e) => updateParams(rule.id, 'compare_column', e.target.value)}
                                            >
                                                <option value="">Select column...</option>
                                                {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {rule.rule_type === 'conditional_rule' && (
                                        <div className="space-y-2">
                                            <div className="flex gap-2">
                                                <select
                                                    className="w-1/2 p-3 bg-white border border-slate-200 rounded-xl font-medium outline-none text-sm"
                                                    value={rule.params.condition_column || ''}
                                                    onChange={(e) => updateParams(rule.id, 'condition_column', e.target.value)}
                                                >
                                                    <option value="">If column...</option>
                                                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                                <input
                                                    type="text"
                                                    placeholder="equals value..."
                                                    className="w-1/2 p-3 bg-white border border-slate-200 rounded-xl font-medium outline-none text-sm"
                                                    value={rule.params.condition_value || ''}
                                                    onChange={(e) => updateParams(rule.id, 'condition_value', e.target.value)}
                                                />
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Then this column must match (regex or value)"
                                                className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium outline-none text-sm"
                                                value={rule.params.expected_value || ''}
                                                onChange={(e) => updateParams(rule.id, 'expected_value', e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => removeRule(rule.id)}
                                className="bg-red-50 hover:bg-red-100 text-red-500 p-3 rounded-xl transition-colors md:self-center self-end"
                            >
                                <Trash2 size={20} />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {rules.length === 0 && (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                        <AlertCircle className="mx-auto text-slate-300 mb-2" size={32} />
                        <p className="text-slate-400">No rules defined yet.</p>
                        <button onClick={addRule} className="mt-4 text-brand-blue font-bold hover:underline">Add your first rule</button>
                    </div>
                )}
            </div>

            {/* Submit Button Area - always visible, just disabled if empty */}
            <div className="mt-8 flex justify-end">
                <button
                    onClick={handleRun}
                    disabled={loading || rules.length === 0}
                    className={`
                        px-8 py-4 rounded-xl font-bold flex items-center gap-2 transition-all 
                        ${rules.length === 0
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 hover:scale-105'
                        }
                    `}
                >
                    {loading ? "Running Checks..." : "Run Validation Check"}
                    {!loading && <Play size={20} fill="currentColor" />}
                </button>
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
