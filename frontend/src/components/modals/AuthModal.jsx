import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    AlertCircle,
    ArrowRight,
    Briefcase,
    Building2,
    CheckCircle2,
    ChevronDown,
    Eye,
    EyeOff,
    Globe,
    Lock,
    Mail,
    Monitor,
    Phone,
    Server,
    ShieldCheck,
    Sparkles,
    User,
    X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import AuthImage from '../../assets/auth_platform_art.png';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const COUNTRY_CODES = [
    { code: '+1', label: 'US/CA (+1)' },
    { code: '+44', label: 'UK (+44)' },
    { code: '+49', label: 'DE (+49)' },
    { code: '+61', label: 'AU (+61)' },
    { code: '+91', label: 'IN (+91)' },
    { code: '+971', label: 'UAE (+971)' },
];

const PROFESSIONS = [
    'Data Engineer',
    'Data Scientist',
    'Analytics Lead',
    'Operations Manager',
    'Product Manager',
    'Founder',
    'Other',
];

const SERVICE_META = {
    checking: {
        badge: 'Checking service',
        badgeClass: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
        dotClass: 'bg-amber-300',
    },
    online: {
        badge: 'Service online',
        badgeClass: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
        dotClass: 'bg-emerald-300',
    },
    degraded: {
        badge: 'Service degraded',
        badgeClass: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
        dotClass: 'bg-amber-300',
    },
    offline: {
        badge: 'Service offline',
        badgeClass: 'border-rose-400/30 bg-rose-400/10 text-rose-100',
        dotClass: 'bg-rose-300',
    },
};

const INPUT_BASE =
    'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-[15px] font-medium text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition-all duration-200 placeholder:text-slate-400 focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-50';

const FEATURES = [
    {
        icon: ShieldCheck,
        title: 'Validation-first workflows',
        description: 'Run quality checks, track issues, and keep every dataset audit-ready.',
    },
    {
        icon: Sparkles,
        title: 'Faster operator flow',
        description: 'Desktop-friendly workspace with local file access and a dedicated local backend.',
    },
    {
        icon: Server,
        title: 'Local service runtime',
        description: 'Your desktop app talks to a bundled service so imports, exports, and jobs stay close to your machine.',
    },
];

const InputField = ({ label, icon: Icon, trailing, className = '', ...props }) => (
    <label className="block">
        <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {label}
        </span>
        <div className="relative">
            {Icon && <Icon size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />}
            <input
                className={`${INPUT_BASE} ${Icon ? 'pl-12' : ''} ${trailing ? 'pr-12' : ''} ${className}`}
                {...props}
            />
            {trailing}
        </div>
    </label>
);

const SelectField = ({ label, icon: Icon, children, className = '', ...props }) => (
    <label className="block">
        <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {label}
        </span>
        <div className="relative">
            {Icon && <Icon size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />}
            <select
                className={`${INPUT_BASE} ${Icon ? 'pl-12' : ''} appearance-none pr-12 ${className}`}
                {...props}
            >
                {children}
            </select>
            <ChevronDown size={17} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
    </label>
);

const AuthModal = ({
    isOpen,
    onClose,
    onLoginSuccess,
    defaultMode = 'login',
    allowClose = true,
    connectionStatus = 'checking',
    connectionMessage = 'Connecting to CleanFlow...',
    isDesktop = false,
    runtimeInfo = null,
}) => {
    const [isLogin, setIsLogin] = useState(true);
    const [showOtp, setShowOtp] = useState(false);
    const [otp, setOtp] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [fullName, setFullName] = useState('');
    const [phoneCountryCode, setPhoneCountryCode] = useState('+91');
    const [phoneLocalNumber, setPhoneLocalNumber] = useState('');
    const [profession, setProfession] = useState('');
    const [country, setCountry] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const serviceMeta = SERVICE_META[connectionStatus] || SERVICE_META.checking;
    const desktopMode = Boolean(isDesktop);

    useEffect(() => {
        if (!isOpen) return;

        setIsLogin(defaultMode !== 'signup');
        setShowOtp(false);
        setOtp('');
        setError('');
        setSuccessMsg('');
        setShowPwd(false);
    }, [isOpen, defaultMode]);

    const statusNote = useMemo(() => {
        if (connectionStatus === 'offline') {
            return 'Restart the desktop app if this status does not recover.';
        }
        if (connectionStatus === 'degraded') {
            return 'The UI is reachable, but login and saved data actions may fail until the database reconnects.';
        }
        if (connectionStatus === 'online') {
            return 'Your local desktop service is ready for sign-in.';
        }
        return 'The app is checking the local service right now.';
    }, [connectionStatus]);

    if (!isOpen) return null;

    const resetFeedback = () => {
        setError('');
        setSuccessMsg('');
    };

    const extractErrorMessage = (err) => {
        const detail = err?.response?.data?.detail;
        if (!err?.response) {
            if (connectionStatus === 'offline') {
                return 'CleanFlow Desktop cannot reach its local service. Please restart the app and try again.';
            }
            if (connectionStatus === 'degraded') {
                return 'The desktop service is running, but its database connection is unavailable right now.';
            }
            return 'Unable to reach the CleanFlow service.';
        }
        if (Array.isArray(detail)) {
            return detail[0]?.msg || 'Request failed.';
        }
        return detail || 'Request failed.';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        resetFeedback();
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
                return;
            }

            if (isLogin) {
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
                    return;
                } catch (err) {
                    if (err.response?.data?.detail === 'OTP_REQUIRED') {
                        setShowOtp(true);
                        setSuccessMsg('A verification code has been sent to your email.');
                        return;
                    }
                    throw err;
                }
            }

            const phoneNumber = `${phoneCountryCode} ${phoneLocalNumber}`.trim();
            try {
                await axios.post(`${API_BASE}/register`, {
                    email,
                    password,
                    full_name: fullName,
                    phone_number: phoneNumber,
                    professional_field: profession,
                    country,
                    company_name: companyName,
                });
            } catch (err) {
                if (err.response?.data?.detail === 'OTP_REQUIRED') {
                    setShowOtp(true);
                    setSuccessMsg('A verification code has been sent to your email.');
                    return;
                }
                throw err;
            }
        } catch (err) {
            setError(extractErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        resetFeedback();
        setLoading(true);
        try {
            await axios.post(`${API_BASE}/resend-otp`, { email });
            setSuccessMsg('A new code has been sent to your email.');
        } catch (err) {
            setError(extractErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] overflow-auto bg-[#020617]">
            <div className="min-h-full px-4 py-5 lg:px-6 lg:py-6">
                <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1460px] overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.03] shadow-[0_40px_140px_rgba(15,23,42,0.55)] backdrop-blur-xl lg:grid-cols-[1.08fr_0.92fr]">
                    {allowClose && (
                        <button
                            onClick={onClose}
                            className="absolute right-8 top-8 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/80 transition hover:bg-white/12 hover:text-white"
                            title="Close"
                        >
                            <X size={18} />
                        </button>
                    )}

                    <aside className="relative hidden min-h-full overflow-hidden border-r border-white/10 lg:flex lg:flex-col lg:justify-between">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.32),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_28%),linear-gradient(180deg,#06101e_0%,#020617_100%)]" />
                        <img
                            src={AuthImage}
                            alt="CleanFlow Workspace"
                            className="absolute inset-y-0 right-0 h-full w-full object-cover opacity-[0.13] mix-blend-screen"
                        />
                        <div className="relative z-10 flex h-full flex-col justify-between p-12">
                            <div>
                                <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/7 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                                    <Monitor size={15} className="text-sky-300" />
                                    Desktop Workspace
                                </div>

                                <div className="mb-8">
                                    <div className="uncial-antiqua-regular text-[34px] leading-none text-white">Cleanflow</div>
                                    <h1 className="mt-8 max-w-xl text-[44px] font-semibold leading-[1.02] tracking-[-0.03em] text-white">
                                        Data operations with a local desktop workflow.
                                    </h1>
                                    <p className="mt-5 max-w-xl text-[16px] leading-7 text-slate-300">
                                        Sign in to access validation, transformation, pricing, orchestration, and export flows inside a dedicated desktop workspace.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    {FEATURES.map(({ icon: Icon, title, description }) => (
                                        <div
                                            key={title}
                                            className="rounded-[22px] border border-white/10 bg-white/[0.05] p-5 shadow-[0_16px_48px_rgba(15,23,42,0.16)]"
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sky-200">
                                                    <Icon size={19} />
                                                </div>
                                                <div>
                                                    <h3 className="text-[17px] font-semibold text-white">{title}</h3>
                                                    <p className="mt-1 text-[14px] leading-6 text-slate-300">{description}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                            Local runtime
                                        </p>
                                        <p className="mt-2 text-[20px] font-semibold text-white">{serviceMeta.badge}</p>
                                    </div>
                                    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold ${serviceMeta.badgeClass}`}>
                                        <span className={`h-2.5 w-2.5 rounded-full ${serviceMeta.dotClass}`} />
                                        {connectionStatus}
                                    </div>
                                </div>
                                <p className="mt-3 text-[14px] leading-6 text-slate-300">{connectionMessage}</p>
                                <p className="mt-2 text-[13px] leading-5 text-slate-400">{statusNote}</p>
                                {runtimeInfo?.apiBaseUrl && (
                                    <div className="mt-4 rounded-2xl border border-white/8 bg-slate-950/35 px-4 py-3 text-[12px] font-medium text-slate-300">
                                        API Endpoint: <span className="text-sky-200">{runtimeInfo.apiBaseUrl}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>

                    <section className="relative flex min-h-full items-center justify-center px-4 py-6 sm:px-6 lg:px-10 xl:px-14">
                        <div className="w-full max-w-[560px]">
                            <div className="mb-6 flex items-center justify-between lg:hidden">
                                <div>
                                    <div className="uncial-antiqua-regular text-[28px] leading-none text-white">Cleanflow</div>
                                    <p className="mt-2 text-sm text-slate-300">Desktop workspace sign-in</p>
                                </div>
                                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold ${serviceMeta.badgeClass}`}>
                                    <span className={`h-2.5 w-2.5 rounded-full ${serviceMeta.dotClass}`} />
                                    {serviceMeta.badge}
                                </div>
                            </div>

                            <div className="rounded-[30px] border border-slate-200/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.16)] backdrop-blur-xl sm:p-8 lg:p-9">
                                <div className="mb-8">
                                    <div className="mb-4 flex flex-wrap items-center gap-3">
                                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-600">
                                            <Sparkles size={14} className="text-sky-500" />
                                            {desktopMode ? 'Desktop sign-in' : 'Secure access'}
                                        </div>
                                        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold ${connectionStatus === 'offline' ? 'border-rose-200 bg-rose-50 text-rose-700' : connectionStatus === 'degraded' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                                            <Server size={14} />
                                            {serviceMeta.badge}
                                        </div>
                                    </div>
                                    <h2 className="text-[34px] font-semibold leading-tight tracking-[-0.03em] text-slate-950">
                                        {showOtp ? 'Verify your email' : isLogin ? 'Sign in to CleanFlow' : 'Create your workspace account'}
                                    </h2>
                                    <p className="mt-3 text-[15px] leading-6 text-slate-500">
                                        {showOtp
                                            ? `Enter the verification code sent to ${email}.`
                                            : isLogin
                                                ? 'Use your account credentials to open the desktop workspace.'
                                                : 'Create an account to start working with validation, transformation, and pipeline tools.'}
                                    </p>
                                </div>

                                {(connectionStatus === 'offline' || connectionStatus === 'degraded') && (
                                    <div className={`mb-6 rounded-2xl border px-4 py-3 text-[13px] font-medium ${connectionStatus === 'offline' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                                        <div className="flex items-start gap-3">
                                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                            <div>
                                                <p>{connectionMessage}</p>
                                                <p className="mt-1 opacity-80">{statusNote}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {!showOtp && !desktopMode && (
                                    <>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                            <button
                                                type="button"
                                                onClick={() => { window.location.href = `${API_BASE}/auth/google`; }}
                                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                                            >
                                                Google
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { window.location.href = `${API_BASE}/auth/microsoft`; }}
                                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                                            >
                                                Microsoft
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { window.location.href = `${API_BASE}/auth/apple`; }}
                                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                                            >
                                                Apple
                                            </button>
                                        </div>
                                        <div className="my-6 flex items-center gap-4">
                                            <div className="h-px flex-1 bg-slate-200" />
                                            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">or</span>
                                            <div className="h-px flex-1 bg-slate-200" />
                                        </div>
                                    </>
                                )}

                                {!showOtp && desktopMode && (
                                    <div className="mb-6 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-[13px] font-medium text-sky-700">
                                        Desktop mode uses email and password sign-in. Browser-based OAuth redirects are disabled in the packaged app.
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={showOtp ? 'otp' : isLogin ? 'login' : 'signup'}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="space-y-5"
                                        >
                                            {showOtp ? (
                                                <>
                                                    <InputField
                                                        label="Verification code"
                                                        icon={Lock}
                                                        value={otp}
                                                        onChange={(e) => setOtp(e.target.value)}
                                                        placeholder="Enter 6-digit code"
                                                        maxLength={6}
                                                        required
                                                        autoFocus
                                                        autoComplete="one-time-code"
                                                        className="text-center text-lg font-black tracking-[0.45em]"
                                                    />
                                                    <div className="flex items-center justify-between text-[13px] font-semibold">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setShowOtp(false);
                                                                setOtp('');
                                                                resetFeedback();
                                                            }}
                                                            className="text-slate-500 transition hover:text-slate-900"
                                                        >
                                                            Back to sign-in
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleResendOtp}
                                                            disabled={loading}
                                                            className="text-sky-700 transition hover:text-sky-900 disabled:opacity-60"
                                                        >
                                                            Resend code
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    {!isLogin && (
                                                        <>
                                                            <div className="grid gap-4 sm:grid-cols-2">
                                                                <InputField
                                                                    label="Full name"
                                                                    icon={User}
                                                                    value={fullName}
                                                                    onChange={(e) => setFullName(e.target.value)}
                                                                    placeholder="Your full name"
                                                                    required
                                                                    autoComplete="name"
                                                                />
                                                                <InputField
                                                                    label="Company"
                                                                    icon={Building2}
                                                                    value={companyName}
                                                                    onChange={(e) => setCompanyName(e.target.value)}
                                                                    placeholder="Company name"
                                                                    required
                                                                    autoComplete="organization"
                                                                />
                                                            </div>

                                                            <div className="grid gap-4 sm:grid-cols-2">
                                                                <SelectField
                                                                    label="Profession"
                                                                    icon={Briefcase}
                                                                    value={profession}
                                                                    onChange={(e) => setProfession(e.target.value)}
                                                                    required
                                                                >
                                                                    <option value="" disabled>Select profession</option>
                                                                    {PROFESSIONS.map((item) => (
                                                                        <option key={item} value={item}>{item}</option>
                                                                    ))}
                                                                </SelectField>
                                                                <InputField
                                                                    label="Country"
                                                                    icon={Globe}
                                                                    value={country}
                                                                    onChange={(e) => setCountry(e.target.value)}
                                                                    placeholder="Country"
                                                                    required
                                                                    autoComplete="country-name"
                                                                />
                                                            </div>

                                                            <div className="grid gap-4 sm:grid-cols-[0.42fr_0.58fr]">
                                                                <SelectField
                                                                    label="Country code"
                                                                    icon={Phone}
                                                                    value={phoneCountryCode}
                                                                    onChange={(e) => setPhoneCountryCode(e.target.value)}
                                                                    required
                                                                >
                                                                    {COUNTRY_CODES.map((item) => (
                                                                        <option key={item.code} value={item.code}>{item.label}</option>
                                                                    ))}
                                                                </SelectField>
                                                                <InputField
                                                                    label="Mobile number"
                                                                    icon={Phone}
                                                                    value={phoneLocalNumber}
                                                                    onChange={(e) => setPhoneLocalNumber(e.target.value)}
                                                                    placeholder="Mobile number"
                                                                    required
                                                                    autoComplete="tel"
                                                                />
                                                            </div>
                                                        </>
                                                    )}

                                                    <InputField
                                                        label="Email"
                                                        icon={Mail}
                                                        type="email"
                                                        value={email}
                                                        onChange={(e) => setEmail(e.target.value)}
                                                        placeholder="you@company.com"
                                                        required
                                                        autoComplete="email"
                                                    />

                                                    <InputField
                                                        label={isLogin ? 'Password' : 'Create password'}
                                                        icon={Lock}
                                                        type={showPwd ? 'text' : 'password'}
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
                                                        placeholder={isLogin ? 'Enter your password' : 'Create a secure password'}
                                                        required
                                                        autoComplete={isLogin ? 'current-password' : 'new-password'}
                                                        trailing={(
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowPwd((current) => !current)}
                                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                                                            >
                                                                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                                                            </button>
                                                        )}
                                                    />
                                                </>
                                            )}
                                        </motion.div>
                                    </AnimatePresence>

                                    {error && (
                                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700">
                                            <div className="flex items-start gap-3">
                                                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                                <span>{error}</span>
                                            </div>
                                        </div>
                                    )}

                                    {successMsg && (
                                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-700">
                                            <div className="flex items-start gap-3">
                                                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                                                <span>{successMsg}</span>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-[14px] font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.16)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {loading ? 'Processing...' : showOtp ? 'Verify and continue' : isLogin ? 'Sign in' : 'Create account'}
                                        {!loading && <ArrowRight size={16} />}
                                    </button>

                                    {!showOtp && (
                                        <div className="pt-2 text-center text-[13px] font-medium text-slate-500">
                                            {isLogin ? "Don't have an account yet?" : 'Already have an account?'}{' '}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsLogin((current) => !current);
                                                    resetFeedback();
                                                }}
                                                className="font-semibold text-slate-900 transition hover:text-sky-700"
                                            >
                                                {isLogin ? 'Create one' : 'Sign in'}
                                            </button>
                                        </div>
                                    )}
                                </form>

                                <div className="mt-7 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] text-slate-500">
                                    <Server size={15} className="text-slate-400" />
                                    <span>{connectionMessage}</span>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
