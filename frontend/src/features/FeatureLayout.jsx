import React from 'react';
import { Check } from 'lucide-react';

/**
 * FeatureLayout — shared themed shell for all CleanFlow feature modules.
 *
 * Props:
 *   icon       — ReactElement (lucide icon component)
 *   accentColor — CSS color string for the icon + step accent, e.g. 'var(--accent-strong)'
 *   accentBg    — CSS color string for the icon background, e.g. 'rgba(31,143,116,0.12)'
 *   title       — string
 *   subtitle    — string
 *   steps       — string[] | null  (optional; omit to hide stepper)
 *   currentStep — 1-based index of the active step
 *   children    — the scrollable content
 *   headerRight — optional ReactElement rendered on the right side of the header
 */
export default function FeatureLayout({
  icon,
  accentColor = 'var(--accent-strong)',
  accentBg    = 'var(--accent-soft)',
  title,
  subtitle,
  steps,
  currentStep = 1,
  children,
  headerRight,
}) {
  return (
    <div className="flex h-full w-full flex-col">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="relative shrink-0 overflow-hidden border-b border-[var(--border-soft)] bg-[var(--panel)]/90 backdrop-blur-xl">
        {/* subtle ambient gradient */}
        <div
          className="pointer-events-none absolute inset-0 -z-0 opacity-30"
          style={{
            background: `radial-gradient(circle at top right, ${accentColor}40 0%, transparent 60%)`,
          }}
        />

        <div className="relative z-10 flex items-center justify-between gap-4 px-6 py-4">
          {/* left — icon + title */}
          <div className="flex items-center gap-4 min-w-0">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-soft)] shadow-[var(--shadow-soft)]"
              style={{ background: accentBg, color: accentColor }}
            >
              {icon}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)] truncate">
                {title}
              </h2>
              {subtitle && (
                <p className="mt-0.5 text-xs text-[var(--text-muted)] truncate">{subtitle}</p>
              )}
            </div>
          </div>

          {/* right — step pills OR custom slot */}
          <div className="shrink-0 flex items-center gap-3">
            {steps && steps.length > 0 && (
              <div className="hidden sm:flex items-center gap-1">
                {steps.map((label, index) => {
                  const num     = index + 1;
                  const active  = currentStep === num;
                  const done    = currentStep > num;
                  return (
                    <React.Fragment key={label}>
                      <div
                        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                          active
                            ? 'border border-[var(--border-soft)] shadow-[var(--shadow-soft)] text-[var(--text-primary)] bg-[var(--panel)]'
                            : done
                            ? 'text-[var(--text-muted)] bg-[var(--panel-muted)]'
                            : 'text-[var(--text-muted)] bg-[var(--panel-muted)]'
                        }`}
                      >
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                          style={
                            active
                              ? { background: accentColor, color: '#fff' }
                              : done
                              ? { background: accentColor + '33', color: accentColor }
                              : { background: 'var(--border-strong)', color: 'var(--text-muted)' }
                          }
                        >
                          {done ? <Check className="h-2.5 w-2.5" /> : num}
                        </span>
                        {label}
                      </div>
                      {index < steps.length - 1 && (
                        <div
                          className="w-4 h-px"
                          style={{ background: done ? accentColor + '55' : 'var(--border-soft)' }}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
            {headerRight}
          </div>
        </div>
      </header>

      {/* ── Scrollable content ─────────────────────────────── */}
      <div className="flex-1 overflow-y-auto glass-scrollbar">
        {children}
      </div>
    </div>
  );
}

/* ─── smaller shared primitives used by features ───────────── */

/** A themed card panel */
export function FeatureCard({ children, className = '', noPad = false }) {
  return (
    <div
      className={`rounded-[24px] border border-[var(--border-soft)] bg-[var(--panel)] shadow-[var(--shadow-soft)] ${noPad ? '' : 'p-5'} ${className}`}
    >
      {children}
    </div>
  );
}

/** A small muted badge */
export function FeatureBadge({ label, accentColor }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
      style={{
        background: accentColor ? `${accentColor}18` : 'var(--panel-muted)',
        color: accentColor ?? 'var(--text-secondary)',
        border: `1px solid ${accentColor ? `${accentColor}30` : 'var(--border-soft)'}`,
      }}
    >
      {label}
    </span>
  );
}

/** A section label inside a feature card */
export function FieldLabel({ children }) {
  return (
    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
      {children}
    </label>
  );
}

/** A themed primary action button */
export function FeatureButton({ children, onClick, disabled, icon: Icon, variant = 'primary', accentColor }) {
  const base = 'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0';
  const styles = variant === 'primary'
    ? { background: accentColor ?? 'var(--accent-strong)', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }
    : { background: 'var(--panel-muted)', color: 'var(--text-primary)', border: '1px solid var(--border-soft)' };

  return (
    <button type="button" className={base} style={styles} onClick={onClick} disabled={disabled}>
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

/** Empty state placeholder */
export function FeatureEmpty({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-muted)] text-[var(--text-muted)]">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <p className="text-base font-semibold text-[var(--text-primary)]">{title}</p>
      {description && <p className="mt-1 text-sm text-[var(--text-muted)] max-w-xs">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
