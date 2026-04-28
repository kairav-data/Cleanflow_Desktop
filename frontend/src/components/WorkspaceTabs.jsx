import React from 'react';

const TONE_STYLES = {
    blue: {
        active: 'bg-blue-600 text-white shadow-sm shadow-blue-600/20',
    },
    emerald: {
        active: 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20',
    },
    violet: {
        active: 'bg-violet-600 text-white shadow-sm shadow-violet-600/20',
    },
    indigo: {
        active: 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20',
    },
};

export default function WorkspaceTabs({ tabs = [], activeTab, onChange, tone = 'indigo', className = '' }) {
    const styles = TONE_STYLES[tone] || TONE_STYLES.indigo;

    return (
        <div className={`inline-flex flex-wrap items-center gap-1 rounded-2xl border border-[var(--border-soft)] bg-[var(--panel)] p-1 shadow-sm ${className}`}>
            {tabs.map(({ id, label, icon: Icon, disabled = false }) => {
                const isActive = activeTab === id;

                return (
                    <button
                        key={id}
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange(id)}
                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                            isActive
                                ? styles.active
                                : 'text-[var(--text-secondary)] hover:bg-[var(--panel-muted)] hover:text-[var(--text-primary)]'
                        } ${disabled ? 'cursor-not-allowed opacity-45 hover:bg-transparent hover:text-[var(--text-secondary)]' : ''}`}
                    >
                        {Icon ? <Icon size={14} /> : null}
                        {label}
                    </button>
                );
            })}
        </div>
    );
}
