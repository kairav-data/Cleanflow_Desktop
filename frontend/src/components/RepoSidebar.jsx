import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import {
    AlertCircle,
    BookOpen,
    Calendar,
    ChevronLeft,
    Download,
    Layers3,
    Search,
    ShieldCheck,
    Sparkles,
    Trash2,
    User,
    X,
} from 'lucide-react';
import {
    applyTemplateFieldMappings,
    getTemplateFieldPrompts,
    templateNeedsFieldMapping,
    VALIDATION_OPERATOR_OPTIONS,
} from '../lib/repositoryTemplates';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';

const LIBRARY_CONFIG = {
    validation: {
        endpoint: '/repo/validation-rules',
        title: 'Validation Repository',
        subtitle: 'Reusable custom validation rules shared across the platform.',
        singular: 'rule',
        plural: 'rules',
        emptyTitle: 'No shared validation rules yet',
        emptyDescription: 'Create custom rules in the Global Repository workspace and they will appear here for every user.',
        accentClass: 'text-blue-600',
        badgeClass: 'border-blue-200 bg-blue-50 text-blue-700',
        buttonClass: 'bg-blue-600 text-white hover:bg-blue-700',
        secondaryButtonClass: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
        focusClass: 'focus:border-blue-500 focus:ring-blue-500/20',
        icon: ShieldCheck,
    },
    cleaning: {
        endpoint: '/repo/cleaning-ops',
        title: 'Cleaning Repository',
        subtitle: 'Reusable custom cleaning operations for shared dataset workflows.',
        singular: 'operation',
        plural: 'operations',
        emptyTitle: 'No shared cleaning operations yet',
        emptyDescription: 'Create custom operations in the Global Repository workspace and they will appear here for every user.',
        accentClass: 'text-emerald-600',
        badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        buttonClass: 'bg-emerald-600 text-white hover:bg-emerald-700',
        secondaryButtonClass: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
        focusClass: 'focus:border-emerald-500 focus:ring-emerald-500/20',
        icon: Sparkles,
    },
};

const formatDate = (value) => {
    if (!value) return 'Recently created';
    try {
        return new Date(value).toLocaleString();
    } catch {
        return 'Recently created';
    }
};

const formatLabel = (value = '') =>
    String(value)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());

const renderValue = (value) => {
    if (value === null || value === undefined || value === '') return 'Not specified';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
};

function DetailRow({ label, value }) {
    return (
        <div className="grid gap-1.5 rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-muted)] px-4 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</span>
            <span className="text-sm font-medium text-[var(--text-primary)] whitespace-pre-wrap break-words">{renderValue(value)}</span>
        </div>
    );
}

export default function RepoSidebar({
    isOpen,
    onClose,
    context = 'validation',
    onApplyRules,
    user,
    availableColumns = [],
}) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [mappingDraft, setMappingDraft] = useState(null);

    const config = LIBRARY_CONFIG[context] || LIBRARY_CONFIG.validation;
    const Icon = config.icon;

    const fetchItems = async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(`${API_BASE}${config.endpoint}`);
            const repoItems = Array.isArray(data) ? data : [];
            setItems(repoItems);
            setSelectedItem((current) => repoItems.find((item) => item.id === current?.id) || null);
        } catch (error) {
            console.error('Failed to fetch repository items:', error);
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        setSearch('');
        setMappingDraft(null);
        fetchItems();
    }, [context, isOpen]);

    const filteredItems = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return items;
        return items.filter((item) =>
            [item.name, item.description, item.author_name, item.author_email, item.category, item.severity]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query))
        );
    }, [items, search]);

    const openMappingModal = (item) => {
        const prompts = getTemplateFieldPrompts(item, context);
        const initialMapping = Object.fromEntries(
            prompts.map((prompt) => [prompt.index, availableColumns[0] || ''])
        );
        setMappingDraft({ item, prompts, values: initialMapping });
    };

    const handleApply = (item) => {
        if (!onApplyRules) return;

        if (templateNeedsFieldMapping(item, context)) {
            if (!availableColumns.length) {
                alert('Upload or connect a dataset first so the shared template can be mapped to a field.');
                return;
            }
            openMappingModal(item);
            return;
        }

        const entries = applyTemplateFieldMappings(item, context);
        onApplyRules(entries, 'append');
        onClose?.();
    };

    const confirmFieldMapping = () => {
        if (!mappingDraft || !onApplyRules) return;
        const missingField = Object.values(mappingDraft.values).some((value) => !value);
        if (missingField) {
            alert('Select a dataset field for every imported template item.');
            return;
        }
        const entries = applyTemplateFieldMappings(mappingDraft.item, context, mappingDraft.values);
        onApplyRules(entries, 'append');
        setMappingDraft(null);
        onClose?.();
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this shared repository item?')) {
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            alert('Your session expired. Please log in again to delete this item.');
            return;
        }

        try {
            await axios.delete(`${API_BASE}${config.endpoint}/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchItems();
            if (selectedItem?.id === id) {
                setSelectedItem(null);
            }
        } catch (error) {
            console.error('Failed to delete repository item:', error);
            alert(error.response?.data?.detail || 'Only the original author can delete this shared item.');
        }
    };

    const operatorLabel = useMemo(() => {
        if (context !== 'validation' || !selectedItem?.definition?.operator) return null;
        return VALIDATION_OPERATOR_OPTIONS.find((option) => option.id === selectedItem.definition.operator)?.label || formatLabel(selectedItem.definition.operator);
    }, [context, selectedItem]);

    const canDeleteSelected = Boolean(user && selectedItem?.author_email === user.email);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-sm"
                    />

                    <motion.aside
                        initial={{ x: '100%', opacity: 0.7 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '100%', opacity: 0.7 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                        className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-[540px] flex-col border-l border-[var(--border-soft)] bg-[var(--panel)] shadow-2xl"
                    >
                        <div className="border-b border-[var(--border-soft)] px-5 py-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-muted)] ${config.accentClass}`}>
                                        <Icon size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{config.title}</h2>
                                        <p className="mt-0.5 text-sm font-medium text-[var(--text-secondary)]">{config.subtitle}</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="rounded-xl p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--panel-muted)] hover:text-[var(--text-primary)]"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <div className={`rounded-2xl border px-4 py-3 ${config.badgeClass}`}>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Shared</p>
                                    <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{items.length}</p>
                                    <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">Reusable custom templates available now.</p>
                                </div>
                                <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-muted)] px-4 py-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Dataset Fields</p>
                                    <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{availableColumns.length}</p>
                                    <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">Current columns ready for field mapping.</p>
                                </div>
                            </div>
                        </div>

                        {selectedItem ? (
                            <div className="flex-1 overflow-y-auto bg-[var(--panel-muted)]">
                                <div className="sticky top-0 z-10 border-b border-[var(--border-soft)] bg-[var(--panel)] px-5 py-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedItem(null)}
                                            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                                        >
                                            <ChevronLeft size={16} />
                                            Back to library
                                        </button>
                                        {canDeleteSelected && (
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(selectedItem.id)}
                                                className="rounded-xl p-2 text-[var(--text-muted)] transition-colors hover:bg-rose-50 hover:text-rose-500"
                                                title="Delete shared item"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4 p-5">
                                    <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--panel)] p-5 shadow-sm">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <h3 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{selectedItem.name}</h3>
                                                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{selectedItem.description || 'No description provided.'}</p>
                                            </div>
                                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${config.badgeClass}`}>
                                                <Layers3 size={13} />
                                                {context === 'validation' ? (selectedItem.rules || []).length : (selectedItem.operations || []).length} {config.plural}
                                            </span>
                                        </div>

                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-soft)] bg-[var(--panel-muted)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                                                {selectedItem.severity || 'Standard'}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-soft)] bg-[var(--panel-muted)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                                                {selectedItem.category || (context === 'validation' ? 'Validity' : 'Standardization')}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-soft)] bg-[var(--panel-muted)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                                                {selectedItem.space || 'Global Repository'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid gap-4 rounded-3xl border border-[var(--border-soft)] bg-[var(--panel)] p-5 shadow-sm">
                                        <h4 className="text-lg font-semibold text-[var(--text-primary)]">Configuration</h4>
                                        {context === 'validation' ? (
                                            <>
                                                <DetailRow label="Type" value={formatLabel(selectedItem.logic_type || 'condition')} />
                                                <DetailRow label="Operator" value={operatorLabel} />
                                                <DetailRow label="Variable" value={selectedItem.definition?.variable_name || 'field_value'} />
                                                <DetailRow label="Data Type" value={formatLabel(selectedItem.definition?.data_type || 'text')} />
                                                <DetailRow label="Primary Value" value={selectedItem.definition?.primary_value} />
                                                {selectedItem.definition?.secondary_value ? (
                                                    <DetailRow label="Secondary Value" value={selectedItem.definition?.secondary_value} />
                                                ) : null}
                                                <DetailRow label="Engine Rule" value={formatLabel(selectedItem.definition?.generated_rule_type || selectedItem.rules?.[0]?.rule_type)} />
                                                <DetailRow label="Use For Validation" value={selectedItem.use_for_validation ? 'Yes' : 'No'} />
                                            </>
                                        ) : (
                                            <>
                                                <DetailRow label="Operation Type" value={formatLabel(selectedItem.operation_kind || selectedItem.definition?.operation)} />
                                                <DetailRow label="Variable" value={selectedItem.definition?.variable_name || 'field_value'} />
                                                <DetailRow label="Parameters" value={selectedItem.definition?.params || selectedItem.operations?.[0]?.params || {}} />
                                            </>
                                        )}
                                    </div>

                                    <div className="grid gap-4 rounded-3xl border border-[var(--border-soft)] bg-[var(--panel)] p-5 shadow-sm">
                                        <h4 className="text-lg font-semibold text-[var(--text-primary)]">Details</h4>
                                        <DetailRow label="Modified On" value={formatDate(selectedItem.updated_at || selectedItem.created_at)} />
                                        <DetailRow label="Created On" value={formatDate(selectedItem.created_at)} />
                                        <DetailRow label="Creator" value={selectedItem.author_name || selectedItem.author_email || 'Community'} />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleApply(selectedItem)}
                                        className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition-all ${config.buttonClass}`}
                                    >
                                        <Download size={16} />
                                        Apply To Current Dataset
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto bg-[var(--panel-muted)]">
                                <div className="sticky top-0 z-10 border-b border-[var(--border-soft)] bg-[var(--panel)] px-5 py-4">
                                    <div className="relative">
                                        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                                        <input
                                            type="text"
                                            value={search}
                                            onChange={(event) => setSearch(event.target.value)}
                                            placeholder={`Search shared ${config.plural}...`}
                                            className={`w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-muted)] py-3 pl-10 pr-4 text-sm font-medium text-[var(--text-primary)] outline-none transition-all focus:ring-2 ${config.focusClass}`}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3 p-5">
                                    {loading ? (
                                        <div className="rounded-3xl border border-dashed border-[var(--border-soft)] bg-[var(--panel)] px-6 py-14 text-center shadow-sm">
                                            <div className={`mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-soft)] border-t-current ${config.accentClass}`} />
                                            <h3 className="text-base font-semibold text-[var(--text-primary)]">Loading shared templates</h3>
                                            <p className="mt-2 text-sm font-medium text-[var(--text-secondary)]">Pulling the latest repository items for this workspace.</p>
                                        </div>
                                    ) : filteredItems.length === 0 ? (
                                        <div className="rounded-3xl border border-dashed border-[var(--border-soft)] bg-[var(--panel)] px-6 py-14 text-center shadow-sm">
                                            <AlertCircle className="mx-auto mb-4 text-[var(--text-muted)]" size={34} />
                                            <h3 className="text-base font-semibold text-[var(--text-primary)]">{config.emptyTitle}</h3>
                                            <p className="mx-auto mt-2 max-w-sm text-sm font-medium leading-relaxed text-[var(--text-secondary)]">{config.emptyDescription}</p>
                                        </div>
                                    ) : (
                                        filteredItems.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => setSelectedItem(item)}
                                                className="w-full rounded-3xl border border-[var(--border-soft)] bg-[var(--panel)] p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <h3 className="text-base font-semibold text-[var(--text-primary)]">{item.name}</h3>
                                                        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                                                            {item.description || `Reusable custom ${config.singular} for shared dataset workflows.`}
                                                        </p>
                                                    </div>
                                                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${config.badgeClass}`}>
                                                        {item.severity || 'Standard'}
                                                    </span>
                                                </div>

                                                <div className="mt-4 flex flex-wrap gap-2">
                                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-soft)] bg-[var(--panel-muted)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                                                        <BookOpen size={13} />
                                                        {item.category || (context === 'validation' ? 'Validity' : 'Standardization')}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-soft)] bg-[var(--panel-muted)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                                                        <User size={13} />
                                                        {item.author_name || item.author_email || 'Community'}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-soft)] bg-[var(--panel-muted)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                                                        <Calendar size={13} />
                                                        {formatDate(item.created_at)}
                                                    </span>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.aside>

                    <AnimatePresence>
                        {mappingDraft && (
                            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
                                    onClick={() => setMappingDraft(null)}
                                />
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.96, y: 12 }}
                                    className="relative w-full max-w-lg rounded-3xl border border-[var(--border-soft)] bg-[var(--panel)] p-6 shadow-2xl"
                                >
                                    <div className="mb-5 flex items-start justify-between gap-4">
                                        <div>
                                            <h3 className="text-xl font-semibold text-[var(--text-primary)]">Map Template To Dataset Field</h3>
                                            <p className="mt-1 text-sm text-[var(--text-secondary)]">
                                                Choose which dataset field should receive this shared {config.singular}.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setMappingDraft(null)}
                                            className="rounded-xl p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--panel-muted)] hover:text-[var(--text-primary)]"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        {mappingDraft.prompts.map((prompt) => (
                                            <div key={prompt.key}>
                                                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                                                    {prompt.label}
                                                </label>
                                                <select
                                                    value={mappingDraft.values[prompt.index] || ''}
                                                    onChange={(event) =>
                                                        setMappingDraft((current) => ({
                                                            ...current,
                                                            values: {
                                                                ...current.values,
                                                                [prompt.index]: event.target.value,
                                                            },
                                                        }))
                                                    }
                                                    className={`w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-muted)] px-3.5 py-3 text-sm font-medium text-[var(--text-primary)] outline-none transition-all focus:ring-2 ${config.focusClass}`}
                                                >
                                                    <option value="" disabled>Select dataset column...</option>
                                                    {availableColumns.map((column) => (
                                                        <option key={column} value={column}>{column}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-6 flex justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setMappingDraft(null)}
                                            className="rounded-2xl border border-[var(--border-soft)] px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--panel-muted)]"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={confirmFieldMapping}
                                            className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition-colors ${config.buttonClass}`}
                                        >
                                            Apply Template
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                </>
            )}
        </AnimatePresence>
    );
}
