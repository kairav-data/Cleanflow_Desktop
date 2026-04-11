import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
    AlertCircle,
    BadgeCheck,
    BookOpen,
    CheckCircle2,
    Eye,
    Info,
    Search,
    Settings2,
    ShieldCheck,
    Sparkles,
} from 'lucide-react';
import { WorkspaceTabs } from '../components';
import {
    buildCleaningTemplatePayload,
    buildValidationTemplatePayload,
    CLEANING_LIBRARY_CATEGORIES,
    REPOSITORY_SEVERITY_OPTIONS,
    REPOSITORY_SPACE_OPTIONS,
    VALIDATION_DATA_TYPE_OPTIONS,
    VALIDATION_LIBRARY_CATEGORIES,
    VALIDATION_OPERATOR_OPTIONS,
} from '../lib/repositoryTemplates';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';

const COLLECTION_CONFIG = {
    validation: {
        label: 'Validation Rules',
        singular: 'rule',
        endpoint: '/repo/validation-rules',
        tone: 'blue',
        icon: ShieldCheck,
        iconClass: 'text-blue-600',
        badgeClass: 'border-blue-200 bg-blue-50 text-blue-700',
        buttonClass: 'bg-blue-600 text-white hover:bg-blue-700',
        softSurfaceClass: 'border-blue-100 bg-blue-50',
        focusClass: 'focus:border-blue-500 focus:ring-blue-500/20',
        panelGlowClass: 'from-blue-500/15 via-sky-500/10 to-transparent',
        emptyTitle: 'No shared validation rules yet',
        emptyDescription: 'Create a reusable rule in the editor and publish it here for global use.',
    },
    cleaning: {
        label: 'Cleaning Operations',
        singular: 'operation',
        endpoint: '/repo/cleaning-ops',
        tone: 'emerald',
        icon: Sparkles,
        iconClass: 'text-emerald-600',
        badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        buttonClass: 'bg-emerald-600 text-white hover:bg-emerald-700',
        softSurfaceClass: 'border-emerald-100 bg-emerald-50',
        focusClass: 'focus:border-emerald-500 focus:ring-emerald-500/20',
        panelGlowClass: 'from-emerald-500/15 via-lime-500/10 to-transparent',
        emptyTitle: 'No shared cleaning operations yet',
        emptyDescription: 'Create a reusable cleaning operation in the editor and publish it here for global use.',
    },
};

const emptyValidationForm = () => ({
    name: '',
    severity: 'Standard',
    space: 'Global Repository',
    category: 'Validity',
    description: '',
    use_for_validation: true,
    define_conditions: true,
    variable_name: 'field_value',
    data_type: 'text',
    operator: 'matches_regex',
    primary_value: '',
    secondary_value: '',
});

const emptyCleaningForm = (operations = []) => ({
    name: '',
    severity: 'Standard',
    space: 'Global Repository',
    category: 'Standardization',
    description: '',
    variable_name: 'field_value',
    operation: operations[0]?.id || 'replace_value',
    params: {},
});

const formatDate = (value) => {
    if (!value) return 'Recently created';
    try {
        return new Date(value).toLocaleString();
    } catch {
        return 'Recently created';
    }
};

const renderValue = (value) => {
    if (value === null || value === undefined || value === '') return 'Not specified';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
};

function FieldLabel({ children, info }) {
    return (
        <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            <span>{children}</span>
            {info ? <Info size={13} className="text-slate-300" /> : null}
        </label>
    );
}

function SummaryPill({ children, className = '' }) {
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${className}`}>
            {children}
        </span>
    );
}

function DetailRow({ label, value }) {
    return (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
            <p className="mt-1 text-sm font-medium whitespace-pre-wrap break-words text-slate-700">{renderValue(value)}</p>
        </div>
    );
}

function LibraryCard({ item, config, onSelect, active }) {
    const Icon = config.icon;
    return (
        <button
            type="button"
            onClick={() => onSelect(item)}
            className={`w-full rounded-3xl border p-4 text-left shadow-sm transition-all ${
                active
                    ? 'border-slate-300 bg-white shadow-md'
                    : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:shadow-md'
            }`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${config.softSurfaceClass}`}>
                        <Icon size={18} className={config.iconClass} />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-900">{item.name}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-slate-500">
                            {item.description || `Reusable shared ${config.singular} for other users.`}
                        </p>
                    </div>
                </div>
                <SummaryPill className={config.badgeClass}>{item.severity || 'Standard'}</SummaryPill>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                <SummaryPill className="border-slate-200 bg-slate-50 text-slate-600">{item.category || 'Shared'}</SummaryPill>
                <SummaryPill className="border-slate-200 bg-slate-50 text-slate-600">{item.space || 'Global Repository'}</SummaryPill>
            </div>
        </button>
    );
}

function ValidationEditor({ form, onChange, config, publishing, onPublish }) {
    const inputClass = `w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all focus:ring-2 ${config.focusClass}`;
    const operatorMeta = VALIDATION_OPERATOR_OPTIONS.find((option) => option.id === form.operator);
    const preview = buildValidationTemplatePayload(form);

    return (
        <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
                <div>
                    <FieldLabel>Name</FieldLabel>
                    <input
                        type="text"
                        value={form.name}
                        onChange={(event) => onChange('name', event.target.value)}
                        placeholder="Enter a name for the new validation rule"
                        className={inputClass}
                    />
                </div>
                <div>
                    <FieldLabel info>Severity</FieldLabel>
                    <select value={form.severity} onChange={(event) => onChange('severity', event.target.value)} className={inputClass}>
                        {REPOSITORY_SEVERITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                </div>
                <div>
                    <FieldLabel>Space</FieldLabel>
                    <select value={form.space} onChange={(event) => onChange('space', event.target.value)} className={inputClass}>
                        {REPOSITORY_SPACE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                </div>
                <div>
                    <FieldLabel info>Category</FieldLabel>
                    <select value={form.category} onChange={(event) => onChange('category', event.target.value)} className={inputClass}>
                        {VALIDATION_LIBRARY_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                </div>
            </div>

            <div>
                <FieldLabel>Description</FieldLabel>
                <textarea
                    rows={3}
                    value={form.description}
                    onChange={(event) => onChange('description', event.target.value)}
                    className={`${inputClass} resize-none`}
                    placeholder="Describe what this rule validates and when other users should apply it."
                />
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                        <h3 className="text-xl font-black text-slate-900">Validation Logic</h3>
                        <p className="mt-1 text-sm text-slate-500">Create a field-agnostic rule that any user can apply to their own dataset column.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => onChange('use_for_validation', !form.use_for_validation)}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                            form.use_for_validation
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white text-slate-500'
                        }`}
                    >
                        <BadgeCheck size={15} />
                        {form.use_for_validation ? 'Use for validation' : 'Draft only'}
                    </button>
                </div>

                <label className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <input
                        type="checkbox"
                        checked={form.define_conditions}
                        onChange={(event) => onChange('define_conditions', event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    <span className="text-sm font-semibold text-slate-700">Define conditions</span>
                </label>

                {form.define_conditions && (
                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="grid gap-4 md:grid-cols-[1.2fr,0.7fr,1fr]">
                            <div>
                                <FieldLabel>Variable Name</FieldLabel>
                                <input
                                    type="text"
                                    value={form.variable_name}
                                    onChange={(event) => onChange('variable_name', event.target.value)}
                                    placeholder="Enter a variable name"
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <FieldLabel>Type</FieldLabel>
                                <select value={form.data_type} onChange={(event) => onChange('data_type', event.target.value)} className={inputClass}>
                                    {VALIDATION_DATA_TYPE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <FieldLabel>Operator</FieldLabel>
                                <select value={form.operator} onChange={(event) => onChange('operator', event.target.value)} className={inputClass}>
                                    {VALIDATION_OPERATOR_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                                </select>
                            </div>
                        </div>

                        {form.operator === 'between' ? (
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <FieldLabel>Minimum Value</FieldLabel>
                                    <input
                                        type={form.data_type === 'number' ? 'number' : 'text'}
                                        value={form.primary_value}
                                        onChange={(event) => onChange('primary_value', event.target.value)}
                                        placeholder="Enter minimum value"
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <FieldLabel>Maximum Value</FieldLabel>
                                    <input
                                        type={form.data_type === 'number' ? 'number' : 'text'}
                                        value={form.secondary_value}
                                        onChange={(event) => onChange('secondary_value', event.target.value)}
                                        placeholder="Enter maximum value"
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                        ) : form.operator === 'not_null' ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500">
                                This rule only checks whether the selected field contains a value.
                            </div>
                        ) : (
                            <div>
                                <FieldLabel>{form.operator === 'matches_regex' ? 'Regular Expression' : 'Comparison Value'}</FieldLabel>
                                <input
                                    type={form.data_type === 'number' && !['matches_regex', 'contains', 'not_contains', 'starts_with', 'not_starts_with', 'ends_with', 'not_ends_with'].includes(form.operator) ? 'number' : 'text'}
                                    value={form.primary_value}
                                    onChange={(event) => onChange('primary_value', event.target.value)}
                                    placeholder={form.operator === 'matches_regex' ? 'e.g. ^([a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,24}$' : 'Enter a value'}
                                    className={inputClass}
                                />
                            </div>
                        )}

                        <div className={`rounded-2xl border ${config.softSurfaceClass} p-4`}>
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                                <Eye size={16} className={config.iconClass} />
                                Rule Preview
                            </div>
                            <p className="mt-2 text-sm text-slate-600">
                                Variable <span className="font-semibold text-slate-900">{form.variable_name || 'field_value'}</span> will use
                                {' '}
                                <span className="font-semibold text-slate-900">{operatorMeta?.label || form.operator}</span>
                                {' '}logic and compile to <span className="font-semibold text-slate-900">{preview.rules[0]?.rule_type}</span>.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                    type="button"
                    onClick={onPublish}
                    disabled={publishing || !form.name.trim() || !form.define_conditions}
                    className={`rounded-2xl px-5 py-3 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${config.buttonClass}`}
                >
                    {publishing ? 'Publishing...' : 'Create Shared Validation Rule'}
                </button>
            </div>
        </div>
    );
}

function CleaningParameterFields({ operationId, params, onParamChange, inputClass }) {
    if (operationId === 'fill_nulls') {
        return (
            <div className="grid gap-4 md:grid-cols-[220px,1fr]">
                <div>
                    <FieldLabel>Method</FieldLabel>
                    <select value={params.method || 'mean'} onChange={(event) => onParamChange('method', event.target.value)} className={inputClass}>
                        <option value="mean">Average (Mean)</option>
                        <option value="median">Median</option>
                        <option value="min">Minimum</option>
                        <option value="max">Maximum</option>
                        <option value="custom">Custom Value</option>
                    </select>
                </div>
                {(params.method || 'mean') === 'custom' ? (
                    <div>
                        <FieldLabel>Custom Value</FieldLabel>
                        <input
                            type="text"
                            value={params.custom_value || ''}
                            onChange={(event) => onParamChange('custom_value', event.target.value)}
                            placeholder="e.g. Unknown"
                            className={inputClass}
                        />
                    </div>
                ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500">
                        The shared template will keep this fill strategy when another user imports it.
                    </div>
                )}
            </div>
        );
    }

    if (operationId === 'replace_value') {
        return (
            <div className="space-y-4">
                <div>
                    <FieldLabel>Match Type</FieldLabel>
                    <select value={params.match_type || 'whole'} onChange={(event) => onParamChange('match_type', event.target.value)} className={inputClass}>
                        <option value="whole">Replace whole cell value</option>
                        <option value="partial">Replace partial text</option>
                    </select>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <FieldLabel>Find</FieldLabel>
                        <input
                            type="text"
                            value={params.target_value || ''}
                            onChange={(event) => onParamChange('target_value', event.target.value)}
                            placeholder="Find text..."
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <FieldLabel>Replace With</FieldLabel>
                        <input
                            type="text"
                            value={params.replacement_value || ''}
                            onChange={(event) => onParamChange('replacement_value', event.target.value)}
                            placeholder="Replace with..."
                            className={inputClass}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500">
            This operation uses the selected action with no extra parameters.
        </div>
    );
}

function CleaningEditor({ form, operations, onChange, onParamChange, config, publishing, onPublish }) {
    const inputClass = `w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all focus:ring-2 ${config.focusClass}`;
    const operationMeta = operations.find((operation) => operation.id === form.operation) || null;
    const preview = buildCleaningTemplatePayload(form);

    return (
        <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
                <div>
                    <FieldLabel>Name</FieldLabel>
                    <input
                        type="text"
                        value={form.name}
                        onChange={(event) => onChange('name', event.target.value)}
                        placeholder="Enter a name for the new cleaning operation"
                        className={inputClass}
                    />
                </div>
                <div>
                    <FieldLabel info>Severity</FieldLabel>
                    <select value={form.severity} onChange={(event) => onChange('severity', event.target.value)} className={inputClass}>
                        {REPOSITORY_SEVERITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                </div>
                <div>
                    <FieldLabel>Space</FieldLabel>
                    <select value={form.space} onChange={(event) => onChange('space', event.target.value)} className={inputClass}>
                        {REPOSITORY_SPACE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                </div>
                <div>
                    <FieldLabel>Category</FieldLabel>
                    <select value={form.category} onChange={(event) => onChange('category', event.target.value)} className={inputClass}>
                        {CLEANING_LIBRARY_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                </div>
            </div>

            <div>
                <FieldLabel>Description</FieldLabel>
                <textarea
                    rows={3}
                    value={form.description}
                    onChange={(event) => onChange('description', event.target.value)}
                    className={`${inputClass} resize-none`}
                    placeholder="Describe what this operation does and when it should be applied."
                />
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                <div className="mb-4">
                    <h3 className="text-xl font-black text-slate-900">Operation Logic</h3>
                    <p className="mt-1 text-sm text-slate-500">Package a reusable transformation so another user can map it to one of their own fields.</p>
                </div>

                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="grid gap-4 md:grid-cols-[1fr,1.3fr]">
                        <div>
                            <FieldLabel>Variable Name</FieldLabel>
                            <input
                                type="text"
                                value={form.variable_name}
                                onChange={(event) => onChange('variable_name', event.target.value)}
                                placeholder="field_value"
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <FieldLabel>Operation Type</FieldLabel>
                            <select value={form.operation} onChange={(event) => onChange('operation', event.target.value)} className={inputClass}>
                                {operations.map((operation) => <option key={operation.id} value={operation.id}>{operation.name}</option>)}
                            </select>
                            {operationMeta?.description ? <p className="mt-2 text-sm text-slate-500">{operationMeta.description}</p> : null}
                        </div>
                    </div>

                    <CleaningParameterFields
                        operationId={form.operation}
                        params={form.params}
                        onParamChange={onParamChange}
                        inputClass={inputClass}
                    />

                    <div className={`rounded-2xl border ${config.softSurfaceClass} p-4`}>
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                            <Eye size={16} className={config.iconClass} />
                            Operation Preview
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                            This shared operation will import as <span className="font-semibold text-slate-900">{preview.operations[0]?.operation}</span> and ask the user to map it onto one of their dataset fields.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                    type="button"
                    onClick={onPublish}
                    disabled={publishing || !form.name.trim()}
                    className={`rounded-2xl px-5 py-3 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${config.buttonClass}`}
                >
                    {publishing ? 'Publishing...' : 'Create Shared Cleaning Operation'}
                </button>
            </div>
        </div>
    );
}

function RepositoryDetails({ item, config, context }) {
    if (!item) {
        return (
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
                <AlertCircle className="mx-auto mb-4 text-slate-300" size={36} />
                <h3 className="text-lg font-black text-slate-800">Select a shared item</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm font-medium leading-relaxed text-slate-500">
                    Pick a {config.singular} from the library to inspect its configuration and metadata.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="border-b border-slate-100 pb-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h3 className="text-2xl font-black tracking-tight text-slate-900">{item.name}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.description || 'No description provided.'}</p>
                    </div>
                    <SummaryPill className={config.badgeClass}>{item.severity || 'Standard'}</SummaryPill>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    <SummaryPill className="border-slate-200 bg-slate-50 text-slate-600">{item.category || 'Shared'}</SummaryPill>
                    <SummaryPill className="border-slate-200 bg-slate-50 text-slate-600">{item.space || 'Global Repository'}</SummaryPill>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.3fr,0.8fr]">
                <div className="space-y-4">
                    <div>
                        <h4 className="text-lg font-black text-slate-900">Configuration</h4>
                        <div className="mt-3 grid gap-3">
                            {context === 'validation' ? (
                                <>
                                    <DetailRow label="Type" value={item.logic_type || 'condition'} />
                                    <DetailRow label="Variable Name" value={item.definition?.variable_name} />
                                    <DetailRow label="Data Type" value={item.definition?.data_type} />
                                    <DetailRow label="Operator" value={item.definition?.operator} />
                                    <DetailRow label="Value" value={item.definition?.primary_value} />
                                    {item.definition?.secondary_value ? <DetailRow label="Secondary Value" value={item.definition?.secondary_value} /> : null}
                                    <DetailRow label="Use For Validation" value={item.use_for_validation ? 'Yes' : 'No'} />
                                </>
                            ) : (
                                <>
                                    <DetailRow label="Operation Type" value={item.operation_kind || item.definition?.operation} />
                                    <DetailRow label="Variable Name" value={item.definition?.variable_name} />
                                    <DetailRow label="Parameters" value={item.definition?.params || {}} />
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h4 className="text-lg font-black text-slate-900">Details</h4>
                    <DetailRow label="Modified On" value={formatDate(item.updated_at || item.created_at)} />
                    <DetailRow label="Created On" value={formatDate(item.created_at)} />
                    <DetailRow label="Creator" value={item.author_name || item.author_email || 'Community'} />
                </div>
            </div>
        </div>
    );
}

export default function GlobalRepositoryBuilder({ user = null }) {
    const [activeCollection, setActiveCollection] = useState('validation');
    const [validationTemplates, setValidationTemplates] = useState([]);
    const [cleaningTemplates, setCleaningTemplates] = useState([]);
    const [selectedValidationItem, setSelectedValidationItem] = useState(null);
    const [selectedCleaningItem, setSelectedCleaningItem] = useState(null);
    const [validationForm, setValidationForm] = useState(emptyValidationForm);
    const [cleaningForm, setCleaningForm] = useState(emptyCleaningForm([]));
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [cleaningOperations, setCleaningOperations] = useState([]);

    const config = COLLECTION_CONFIG[activeCollection];
    const Icon = config.icon;
    const currentTemplates = activeCollection === 'validation' ? validationTemplates : cleaningTemplates;
    const selectedItem = activeCollection === 'validation' ? selectedValidationItem : selectedCleaningItem;

    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            const [validationResult, cleaningResult, opsResult] = await Promise.allSettled([
                axios.get(`${API_BASE}/repo/validation-rules`),
                axios.get(`${API_BASE}/repo/cleaning-ops`),
                axios.get(`${API_BASE}/features/cleaner/operations`),
            ]);

            if (validationResult.status === 'fulfilled') {
                const items = Array.isArray(validationResult.value.data) ? validationResult.value.data : [];
                setValidationTemplates(items);
                setSelectedValidationItem((current) => items.find((item) => item.id === current?.id) || items[0] || null);
            } else {
                console.error('Failed to fetch validation repository items:', validationResult.reason);
            }

            if (cleaningResult.status === 'fulfilled') {
                const items = Array.isArray(cleaningResult.value.data) ? cleaningResult.value.data : [];
                setCleaningTemplates(items);
                setSelectedCleaningItem((current) => items.find((item) => item.id === current?.id) || items[0] || null);
            } else {
                console.error('Failed to fetch cleaning repository items:', cleaningResult.reason);
            }

            if (opsResult.status === 'fulfilled') {
                const operations = opsResult.value.data?.operations || [];
                setCleaningOperations(operations);
                setCleaningForm((current) => ({
                    ...current,
                    operation: current.operation || operations[0]?.id || 'replace_value',
                }));
            } else {
                console.error('Failed to fetch cleaning operations:', opsResult.reason);
            }

            setLoading(false);
        };

        fetchAll();
    }, []);

    const filteredTemplates = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return currentTemplates;
        return currentTemplates.filter((item) =>
            [item.name, item.description, item.category, item.severity, item.author_name, item.author_email]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query))
        );
    }, [currentTemplates, search]);

    const refreshCollection = async (collection) => {
        const targetConfig = COLLECTION_CONFIG[collection];
        const { data } = await axios.get(`${API_BASE}${targetConfig.endpoint}`);
        const items = Array.isArray(data) ? data : [];

        if (collection === 'validation') {
            setValidationTemplates(items);
            setSelectedValidationItem(items[0] || null);
        } else {
            setCleaningTemplates(items);
            setSelectedCleaningItem(items[0] || null);
        }
    };

    const handlePublish = async () => {
        if (!user) {
            alert('You must be logged in to publish to the global repository.');
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            alert('Your session expired. Please log in again to publish.');
            return;
        }

        const form = activeCollection === 'validation' ? validationForm : cleaningForm;
        if (!form.name.trim()) {
            alert(`Please enter a ${config.singular} name before publishing.`);
            return;
        }

        if (activeCollection === 'validation' && validationForm.define_conditions && validationForm.operator !== 'not_null' && !validationForm.primary_value && validationForm.operator !== 'between') {
            alert('Please complete the validation condition before publishing.');
            return;
        }

        if (activeCollection === 'validation' && validationForm.operator === 'between' && (!validationForm.primary_value || !validationForm.secondary_value)) {
            alert('Please provide both minimum and maximum values for the between condition.');
            return;
        }

        const machinePayload = activeCollection === 'validation'
            ? buildValidationTemplatePayload(validationForm)
            : buildCleaningTemplatePayload(cleaningForm);

        const payload = {
            name: form.name.trim(),
            description: form.description.trim(),
            severity: form.severity,
            space: form.space,
            category: form.category,
            ...machinePayload,
        };

        setPublishing(true);
        try {
            await axios.post(`${API_BASE}${config.endpoint}`, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });
            await refreshCollection(activeCollection);
            if (activeCollection === 'validation') {
                setValidationForm(emptyValidationForm());
            } else {
                setCleaningForm(emptyCleaningForm(cleaningOperations));
            }
        } catch (error) {
            console.error('Failed to publish repository item:', error);
            alert(`Failed to publish: ${error.response?.data?.detail || error.message}`);
        } finally {
            setPublishing(false);
        }
    };

    return (
        <div className="min-h-full bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.10),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.10),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#f1f5f9_100%)]">
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-6 py-6">
                <motion.section
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-[34px] border border-gray-800 bg-[#030303] px-6 py-7 shadow-2xl"
                >
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #050505 0%, #0a0a0a 50%, #020202 100%)' }} />
                    <div className="absolute top-0 left-1/4 h-[400px] w-[400px] rounded-full bg-purple-500/20 blur-[100px] pointer-events-none mix-blend-screen" />
                    <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-emerald-500/20 blur-[100px] pointer-events-none mix-blend-screen" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] bg-blue-600/10 blur-[120px] pointer-events-none mix-blend-screen" />
                    <div className={`absolute inset-0 bg-gradient-to-r ${config.panelGlowClass} opacity-50`} />
                    <div className="relative grid gap-6 xl:grid-cols-[1.6fr,1fr] xl:items-end">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-200">
                                <BookOpen size={13} />
                                Shared Repository Workspace
                            </div>
                            <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">Global Repository</h1>
                            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-[15px]">
                                Create custom validation rules and reusable cleaning operations once, then let every CleanFlow user apply them to their own dataset fields.
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">Validation</p>
                                <p className="mt-2 text-3xl font-black text-white">{validationTemplates.length}</p>
                                <p className="mt-1 text-sm font-medium text-slate-300">Shared custom rules</p>
                            </div>
                            <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">Cleaning</p>
                                <p className="mt-2 text-3xl font-black text-white">{cleaningTemplates.length}</p>
                                <p className="mt-1 text-sm font-medium text-slate-300">Shared operations</p>
                            </div>
                            <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">Scope</p>
                                <p className="mt-2 text-3xl font-black text-white">Global</p>
                                <p className="mt-1 text-sm font-medium text-slate-300">Available to all users</p>
                            </div>
                        </div>
                    </div>
                </motion.section>

                <div className="grid gap-6 xl:grid-cols-[1.12fr,0.88fr]">
                    <motion.section
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-lg shadow-slate-900/5"
                    >
                        <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
                            <div>
                                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                                    <Settings2 size={13} />
                                    Create Shared Template
                                </div>
                                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Custom Template Builder</h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Build field-agnostic repository items that another user can map onto their own dataset fields later.
                                </p>
                            </div>
                            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${config.softSurfaceClass}`}>
                                <Icon size={20} className={config.iconClass} />
                            </div>
                        </div>

                        <WorkspaceTabs
                            tone={config.tone}
                            activeTab={activeCollection}
                            onChange={setActiveCollection}
                            tabs={[
                                { id: 'validation', label: 'Validation Rules', icon: ShieldCheck },
                                { id: 'cleaning', label: 'Cleaning Operations', icon: Sparkles },
                            ]}
                        />

                        <div className="mt-5">
                            {activeCollection === 'validation' ? (
                                <ValidationEditor
                                    form={validationForm}
                                    onChange={(field, value) => setValidationForm((current) => ({ ...current, [field]: value }))}
                                    config={config}
                                    publishing={publishing}
                                    onPublish={handlePublish}
                                />
                            ) : (
                                <CleaningEditor
                                    form={cleaningForm}
                                    operations={cleaningOperations}
                                    onChange={(field, value) => {
                                        setCleaningForm((current) => ({
                                            ...current,
                                            [field]: value,
                                            params: field === 'operation' ? {} : current.params,
                                        }));
                                    }}
                                    onParamChange={(key, value) =>
                                        setCleaningForm((current) => ({
                                            ...current,
                                            params: {
                                                ...current.params,
                                                [key]: value,
                                            },
                                        }))
                                    }
                                    config={config}
                                    publishing={publishing}
                                    onPublish={handlePublish}
                                />
                            )}
                        </div>
                    </motion.section>

                    <motion.aside
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-lg shadow-slate-900/5"
                    >
                        <div className="mb-5 border-b border-slate-100 pb-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight text-slate-900">Shared Library</h2>
                                    <p className="mt-1 text-sm text-slate-500">Inspect published repository items and review their full details.</p>
                                </div>
                                <SummaryPill className={config.badgeClass}>
                                    <CheckCircle2 size={14} />
                                    {currentTemplates.length} published
                                </SummaryPill>
                            </div>

                            <div className="mt-4 relative">
                                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder={`Search ${config.label.toLowerCase()}...`}
                                    className={`w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition-all focus:ring-2 ${config.focusClass}`}
                                />
                            </div>
                        </div>

                        <div className="space-y-5">
                            <RepositoryDetails item={selectedItem} config={config} context={activeCollection} />

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-400">Published Items</h3>
                                    <button
                                        type="button"
                                        onClick={() => refreshCollection(activeCollection)}
                                        className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-800"
                                    >
                                        Refresh
                                    </button>
                                </div>

                                {loading ? (
                                    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
                                        <div className={`mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-current ${config.iconClass}`} />
                                        <h3 className="text-base font-black text-slate-800">Loading shared templates</h3>
                                        <p className="mt-2 text-sm font-medium text-slate-500">Fetching the latest repository items.</p>
                                    </div>
                                ) : filteredTemplates.length === 0 ? (
                                    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
                                        <AlertCircle className="mx-auto mb-4 text-slate-300" size={34} />
                                        <h3 className="text-base font-black text-slate-800">{config.emptyTitle}</h3>
                                        <p className="mx-auto mt-2 max-w-sm text-sm font-medium leading-relaxed text-slate-500">{config.emptyDescription}</p>
                                    </div>
                                ) : (
                                    filteredTemplates.map((item) => (
                                        <LibraryCard
                                            key={item.id}
                                            item={item}
                                            config={config}
                                            onSelect={(selected) => {
                                                if (activeCollection === 'validation') {
                                                    setSelectedValidationItem(selected);
                                                } else {
                                                    setSelectedCleaningItem(selected);
                                                }
                                            }}
                                            active={selectedItem?.id === item.id}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    </motion.aside>
                </div>
            </div>
        </div>
    );
}
