import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    X, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle2,
    Phone, Briefcase, Globe, Building2, Eye, EyeOff, Sparkles, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

const COUNTRY_CODES = [
    { code: '+1',   label: 'US/CA (+1)' },
    { code: '+44',  label: 'UK (+44)'   },
    { code: '+49',  label: 'DE (+49)'   },
    { code: '+61',  label: 'AU (+61)'   },
    { code: '+91',  label: 'IN (+91)'   },
    { code: '+971', label: 'UAE (+971)' },
];

/* ── dark input base class ── */
const inputCls = (hasIcon = true) =>
    `w-full ${hasIcon ? 'pl-10' : 'px-4'} pr-4 py-3 rounded-xl text-sm font-medium
     bg-[#0d1424] border border-slate-700/70 text-slate-100 placeholder:text-slate-600
     focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/15
     transition-all duration-200 appearance-none`;

/* ── labelled field wrapper ── */
const Field = ({ label, icon: Icon, children }) => (
    <div className="space-y-1.5">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.14em]">{label}</label>
        <div className="relative">
            {Icon && (
                <Icon
                    size={14}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10"
                />
            )}
            {children}
        </div>
    </div>
);

/* ── animated content block ── */
const SlidePanel = ({ children, dir = 0 }) => (
    <motion.div
        initial={{ opacity: 0, x: dir * 28 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: dir * -28 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="space-y-4"
    >
        {children}
    </motion.div>
);

const AuthModal = ({ isOpen, onClose, onLoginSuccess, defaultMode = 'login' }) => {
    const [isLogin, setIsLogin]                   = useState(true);
    const [showOtp, setShowOtp]                   = useState(false);
    const [otp, setOtp]                           = useState('');
    const [email, setEmail]                       = useState('');
    const [password, setPassword]                 = useState('');
    const [showPwd, setShowPwd]                   = useState(false);
    const [fullName, setFullName]                 = useState('');
    const [phoneCountryCode, setPhoneCountryCode] = useState('+91');
    const [phoneLocalNumber, setPhoneLocalNumber] = useState('');
    const [profession, setProfession]             = useState('');
    const [country, setCountry]                   = useState('');
    const [companyName, setCompanyName]           = useState('');
    const [error, setError]                       = useState('');
    const [successMsg, setSuccessMsg]             = useState('');
    const [loading, setLoading]                   = useState(false);
    const [tabDir, setTabDir]                     = useState(0); // -1 = left, 1 = right

    useEffect(() => {
        if (!isOpen) return;
        setIsLogin(defaultMode !== 'signup');
        setShowOtp(false);
        setOtp('');
        setError('');
        setSuccessMsg('');
        setShowPwd(false);
    }, [isOpen, defaultMode]);

    if (!isOpen) return null;

    const reset = () => { setError(''); setSuccessMsg(''); };

    const switchTab = (toLogin) => {
        if (toLogin === isLogin) return;
        setTabDir(toLogin ? -1 : 1);
        setIsLogin(toLogin);
        reset();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        reset();
        setLoading(true);
        try {
            if (showOtp) {
                const response = await axios.post(`${API_BASE}/verify-otp`, { email, otp });
                const token = response.data.access_token;
                localStorage.setItem('token', token);
                const userRes = await axios.get(`${API_BASE}/users/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                onLoginSuccess(userRes.data);
                onClose();

            } else if (isLogin) {
                const formData = new FormData();
                formData.append('username', email);
                formData.append('password', password);
                try {
                    const response = await axios.post(`${API_BASE}/token`, formData);
                    const token = response.data.access_token;
                    localStorage.setItem('token', token);
                    const userRes = await axios.get(`${API_BASE}/users/me`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    onLoginSuccess(userRes.data);
                    onClose();
                } catch (err) {
                    if (err.response?.data?.detail === 'OTP_REQUIRED') {
                        setShowOtp(true);
                        setSuccessMsg('A verification code has been sent to your email.');
                        setLoading(false);
                        return;
                    }
                    throw err;
                }

            } else {
                try {
                    const phoneNumber = `${phoneCountryCode} ${phoneLocalNumber}`.trim();
                    await axios.post(`${API_BASE}/register`, {
                        email, password, full_name: fullName,
                        phone_number: phoneNumber,
                        professional_field: profession,
                        country, company_name: companyName,
                    });
                } catch (err) {
                    if (err.response?.data?.detail === 'OTP_REQUIRED') {
                        setShowOtp(true);
                        setSuccessMsg('A verification code has been sent to your email.');
                        setLoading(false);
                        return;
                    }
                    throw err;
                }
            }
        } catch (err) {
            const detail = err.response?.data?.detail;
            setError(Array.isArray(detail) ? detail[0].msg : detail || 'Connection error. Is the server running?');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        try { setLoading(true); reset();
            await axios.post(`${API_BASE}/resend-otp`, { email });
            setSuccessMsg('A new code has been sent to your email.');
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to resend OTP');
        } finally { setLoading(false); }
    };

    /* ── derived labels ── */
    const title    = showOtp ? 'Verify your email' : isLogin ? 'Welcome back'    : 'Get started free';
    const subtitle = showOtp
        ? `Enter the 6-digit code sent to ${email}`
        : isLogin
            ? 'Sign in to your CleanFlow workspace'
            : 'No credit card needed. 14-day free trial.';

    return (
        /* Outer overlay — scrollable so modal never gets clipped */
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto py-8 px-4">

            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-950/85 backdrop-blur-md"
                onClick={onClose}
            />

            {/* Card */}
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                transition={{ type: 'spring', damping: 30, stiffness: 360 }}
                className="relative w-full max-w-md my-auto overflow-hidden rounded-[28px]
                           bg-[#0c1320] border border-white/[0.07]
                           shadow-[0_32px_80px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)]"
                style={{ isolation: 'isolate' }}
            >
                {/* Emerald glow blob */}
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-48 rounded-full
                                bg-emerald-500/10 blur-3xl pointer-events-none" />

                {/* Top accent stripe */}
                <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

                {/* ── Header ── */}
                <div className="px-8 pt-8 pb-6">
                    {/* Brand chip */}
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                {showOtp
                                    ? <ShieldCheck size={13} className="text-emerald-400" />
                                    : <Sparkles    size={13} className="text-emerald-400" />
                                }
                            </div>
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.18em]">
                                CleanFlow
                            </span>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-500 hover:text-slate-200
                                       hover:bg-white/5 transition-all duration-150"
                        >
                            <X size={17} />
                        </button>
                    </div>

                    {/* Title */}
                    <h2 className="text-[1.6rem] font-black text-white tracking-tight leading-tight">
                        {title}
                    </h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">{subtitle}</p>
                </div>

                {/* ── Tab switcher ── */}
                {!showOtp && (
                    <div className="px-8 mb-1">
                        <div className="flex gap-1 p-1 bg-white/[0.04] rounded-2xl border border-white/[0.06]">
                            {[
                                { label: 'Sign In',        toLogin: true  },
                                { label: 'Create Account', toLogin: false },
                            ].map(({ label, toLogin }) => {
                                const active = isLogin === toLogin;
                                return (
                                    <button
                                        key={label}
                                        type="button"
                                        onClick={() => switchTab(toLogin)}
                                        className={`relative flex-1 py-2.5 rounded-xl text-sm font-bold
                                                    transition-colors duration-200
                                                    ${active ? 'text-slate-950' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        {active && (
                                            <motion.div
                                                layoutId="auth-tab-pill"
                                                className="absolute inset-0 rounded-xl bg-white"
                                                transition={{ type: 'spring', damping: 28, stiffness: 380 }}
                                            />
                                        )}
                                        <span className="relative z-10">{label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Form body ── */}
                <div className="px-8 pb-0">
                    <form onSubmit={handleSubmit}>

                        {/* Animated panel swap */}
                        <div className="overflow-hidden">
                            <AnimatePresence mode="wait" initial={false}>

                                {/* OTP step */}
                                {showOtp && (
                                    <SlidePanel key="otp" dir={1}>
                                        <div className="pt-6 space-y-4">
                                            <Field label="6-Digit Verification Code" icon={Lock}>
                                                <input
                                                    type="text"
                                                    value={otp}
                                                    onChange={(e) => setOtp(e.target.value)}
                                                    className={`${inputCls(true)} text-center tracking-[0.7em] text-xl font-black`}
                                                    placeholder="· · · · · ·"
                                                    maxLength={6}
                                                    required
                                                    autoFocus
                                                />
                                            </Field>
                                            <div className="flex justify-between">
                                                <button
                                                    type="button"
                                                    onClick={() => { setShowOtp(false); reset(); setOtp(''); }}
                                                    className="text-xs text-slate-500 hover:text-slate-300 font-semibold transition-colors"
                                                >
                                                    ← Back
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleResendOtp}
                                                    disabled={loading}
                                                    className="text-xs text-emerald-400 hover:text-emerald-300 font-bold transition-colors disabled:opacity-40"
                                                >
                                                    Resend Code
                                                </button>
                                            </div>
                                        </div>
                                    </SlidePanel>
                                )}

                                {/* Sign In */}
                                {!showOtp && isLogin && (
                                    <SlidePanel key="login" dir={tabDir}>
                                        <div className="pt-5 space-y-4">
                                            <Field label="Email" icon={Mail}>
                                                <input
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    className={inputCls()}
                                                    placeholder="you@company.com"
                                                    required
                                                    autoFocus
                                                />
                                            </Field>
                                            <Field label="Password" icon={Lock}>
                                                <input
                                                    type={showPwd ? 'text' : 'password'}
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    className={`${inputCls()} pr-10`}
                                                    placeholder="••••••••"
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPwd(!showPwd)}
                                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                                >
                                                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </button>
                                            </Field>
                                        </div>
                                    </SlidePanel>
                                )}

                                {/* Create Account */}
                                {!showOtp && !isLogin && (
                                    <SlidePanel key="signup" dir={tabDir}>
                                        <div className="pt-5 space-y-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                <Field label="Full Name" icon={User}>
                                                    <input
                                                        type="text"
                                                        value={fullName}
                                                        onChange={(e) => setFullName(e.target.value)}
                                                        className={inputCls()}
                                                        placeholder="Jane Smith"
                                                        required
                                                        autoFocus
                                                    />
                                                </Field>
                                                <Field label="Company" icon={Building2}>
                                                    <input
                                                        type="text"
                                                        value={companyName}
                                                        onChange={(e) => setCompanyName(e.target.value)}
                                                        className={inputCls()}
                                                        placeholder="Acme Corp"
                                                        required
                                                    />
                                                </Field>
                                            </div>

                                            <Field label="Work Email" icon={Mail}>
                                                <input
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    className={inputCls()}
                                                    placeholder="you@company.com"
                                                    required
                                                />
                                            </Field>

                                            <Field label="Password" icon={Lock}>
                                                <input
                                                    type={showPwd ? 'text' : 'password'}
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    className={`${inputCls()} pr-10`}
                                                    placeholder="Create a strong password"
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPwd(!showPwd)}
                                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                                >
                                                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </button>
                                            </Field>

                                            <div className="grid grid-cols-2 gap-3">
                                                <Field label="Profession" icon={Briefcase}>
                                                    <select
                                                        value={profession}
                                                        onChange={(e) => setProfession(e.target.value)}
                                                        className={inputCls()}
                                                        required
                                                    >
                                                        <option value="" disabled>Select…</option>
                                                        <option>Engineer</option>
                                                        <option>Data Scientist</option>
                                                        <option>Product Manager</option>
                                                        <option>Analyst</option>
                                                        <option>Other</option>
                                                    </select>
                                                </Field>
                                                <Field label="Country" icon={Globe}>
                                                    <input
                                                        type="text"
                                                        value={country}
                                                        onChange={(e) => setCountry(e.target.value)}
                                                        className={inputCls()}
                                                        placeholder="India"
                                                        required
                                                    />
                                                </Field>
                                            </div>

                                            <Field label="Mobile Number" icon={Phone}>
                                                <div className="flex gap-2">
                                                    <div className="relative w-[38%]">
                                                        <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10" />
                                                        <select
                                                            value={phoneCountryCode}
                                                            onChange={(e) => setPhoneCountryCode(e.target.value)}
                                                            className={inputCls(true)}
                                                            required
                                                        >
                                                            {COUNTRY_CODES.map(c => (
                                                                <option key={c.code} value={c.code}>{c.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <input
                                                        type="tel"
                                                        inputMode="tel"
                                                        value={phoneLocalNumber}
                                                        onChange={(e) => setPhoneLocalNumber(e.target.value)}
                                                        className={`${inputCls(false)} flex-1`}
                                                        placeholder="9876543210"
                                                        required
                                                    />
                                                </div>
                                            </Field>
                                        </div>
                                    </SlidePanel>
                                )}

                            </AnimatePresence>
                        </div>

                        {/* Alerts */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    key="err"
                                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    className="mt-4 flex items-start gap-2.5 text-red-400 text-xs font-semibold
                                               bg-red-500/[0.08] border border-red-500/20 px-4 py-3 rounded-xl"
                                >
                                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                    {error}
                                </motion.div>
                            )}
                            {successMsg && (
                                <motion.div
                                    key="ok"
                                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    className="mt-4 flex items-start gap-2.5 text-emerald-400 text-xs font-semibold
                                               bg-emerald-500/[0.08] border border-emerald-500/20 px-4 py-3 rounded-xl"
                                >
                                    <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                                    {successMsg}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* CTA */}
                        <div className="mt-6">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 rounded-2xl font-black text-sm tracking-wide
                                           bg-emerald-500 text-slate-950
                                           hover:bg-emerald-400 hover:-translate-y-0.5
                                           shadow-[0_0_28px_rgba(52,211,153,0.22)]
                                           hover:shadow-[0_0_36px_rgba(52,211,153,0.35)]
                                           transition-all duration-200
                                           disabled:opacity-50 disabled:pointer-events-none
                                           flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10"
                                                stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Processing…
                                    </>
                                ) : (
                                    <>
                                        {showOtp
                                            ? 'Verify & Continue'
                                            : isLogin
                                                ? 'Sign In to CleanFlow'
                                                : 'Create My Account'}
                                        <ArrowRight size={15} />
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Legal note (signup only) */}
                        {!isLogin && !showOtp && (
                            <p className="text-center text-[10.5px] text-slate-600 mt-3 leading-relaxed pb-2">
                                By signing up you agree to our{' '}
                                <span className="text-slate-500 font-semibold cursor-pointer hover:text-slate-400 transition-colors">Terms</span>
                                {' '}and{' '}
                                <span className="text-slate-500 font-semibold cursor-pointer hover:text-slate-400 transition-colors">Privacy Policy</span>.
                            </p>
                        )}
                    </form>
                </div>

                {/* ── Bottom trust strip ── */}
                <div className="mx-8 my-5 px-5 py-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]
                                flex items-center justify-center gap-3">
                    {[
                        { emoji: '🔒', text: '256-bit TLS' },
                        { emoji: '🛡️', text: 'SOC 2 Type II' },
                        { emoji: '🌍', text: 'GDPR Ready' },
                    ].map(({ emoji, text }) => (
                        <div key={text} className="flex items-center gap-1.5">
                            <span className="text-xs">{emoji}</span>
                            <span className="text-[10px] font-semibold text-slate-600">{text}</span>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
};

export default AuthModal;
