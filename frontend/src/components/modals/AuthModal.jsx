import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    Phone, Briefcase, Globe, Building2, Eye, EyeOff, Lock, User, AlertCircle, CheckCircle2, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import AuthImage from '../../assets/auth_platform_art.png';
import { API_BASE } from '../../lib/runtimeConfig';

const COUNTRY_CODES = [
    { code: '+1',   label: 'US/CA (+1)' },
    { code: '+44',  label: 'UK (+44)'   },
    { code: '+49',  label: 'DE (+49)'   },
    { code: '+61',  label: 'AU (+61)'   },
    { code: '+91',  label: 'IN (+91)'   },
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

/* ── clean white input base class ── */
const inputCls = (hasIcon = false) =>
    `w-full ${hasIcon ? 'pl-10' : 'px-4'} pr-4 py-3 rounded-full text-[15px] font-medium
     bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400
     focus:outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-50
     transition-all duration-200 appearance-none`;

const selectCls = (hasIcon = false, hasValue = true) =>
    `w-full ${hasIcon ? 'pl-10' : 'px-4'} pr-11 py-3.5 rounded-[1.15rem] text-[15px]
     ${hasValue ? 'text-slate-900' : 'text-slate-400'} font-semibold
     bg-gradient-to-b from-white to-slate-50/90 border border-slate-200
     shadow-[0_10px_30px_rgba(15,23,42,0.04)] hover:border-slate-300
     focus:outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-50
     transition-all duration-200 appearance-none`;

/* ── Field Wrapper ── */
const Field = ({ icon: Icon, children }) => (
    <div className="relative mb-4">
        {Icon && (
            <Icon
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10"
            />
        )}
        {children}
    </div>
);

const SelectField = ({ icon: Icon, value, onChange, children, className = '', ...props }) => (
    <div className="relative mb-4">
        {Icon && (
            <Icon
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10"
            />
        )}
        <select
            value={value}
            onChange={onChange}
            className={`${selectCls(Boolean(Icon), Boolean(value))} ${className}`}
            {...props}
        >
            {children}
        </select>
        <ChevronDown
            size={16}
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
        />
    </div>
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
            setError(Array.isArray(detail) ? detail[0].msg : detail || 'Connection error.');
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

    return (
        <div className="fixed inset-0 z-[200] flex bg-white w-screen h-screen overflow-hidden">

            {/* Left Image Section */}
            <div className="hidden lg:block lg:w-1/2 h-full relative border-r border-slate-100">
                <img src={AuthImage} alt="Cleanflow Platform" className="absolute inset-0 w-full h-full object-cover" />
            </div>

            {/* Right Form Section */}
            <div className="w-full lg:w-1/2 h-full overflow-y-auto">
                <div className="min-h-full flex flex-col justify-center px-10 py-12 max-w-[480px] mx-auto relative">
                    
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h2 className="text-[32px] font-medium tracking-tight text-[#1c1c1c] mb-[2px]">
                            {showOtp ? 'Verify your email' : isLogin ? 'Login to your account' : 'Create an account'}
                        </h2>
                    </div>

                    <form onSubmit={handleSubmit} className="w-full">
                        {!showOtp && (
                            <>
                                {/* SSO Buttons */}
                                <div className="grid grid-cols-3 gap-4 mb-6">
                                    <button 
                                        type="button"
                                        onClick={() => window.location.href = `${API_BASE}/auth/google`}
                                        className="flex items-center justify-center gap-2.5 py-2.5 rounded-full border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors text-[13px] font-bold text-[#1c1c1c] whitespace-nowrap shadow-sm"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                        </svg>
                                        Google
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => window.location.href = `${API_BASE}/auth/microsoft`}
                                        className="flex items-center justify-center gap-2.5 py-2.5 rounded-full border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors text-[13px] font-bold text-[#1c1c1c] whitespace-nowrap shadow-sm"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                                            <path fill="#f25022" d="M1 1h9v9H1z"/>
                                            <path fill="#00a4ef" d="M1 11h9v9H1z"/>
                                            <path fill="#7fba00" d="M11 1h9v9h-9z"/>
                                            <path fill="#ffb900" d="M11 11h9v9h-9z"/>
                                        </svg>
                                        Microsoft
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => window.location.href = `${API_BASE}/auth/apple`}
                                        className="flex items-center justify-center gap-2.5 py-2.5 rounded-full border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors text-[13px] font-bold text-[#1c1c1c] whitespace-nowrap shadow-sm"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                                        </svg>
                                        Apple
                                    </button>
                                </div>

                                {/* Divider */}
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="h-px bg-slate-100 flex-1"></div>
                                    <span className="text-[11px] font-bold text-slate-400 uppercase">OR</span>
                                    <div className="h-px bg-slate-100 flex-1"></div>
                                </div>
                            </>
                        )}

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={showOtp ? 'otp' : isLogin ? 'login' : 'signup'}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                {showOtp ? (
                                    <>
                                        <p className="text-center text-sm text-slate-500 mb-6">
                                            Enter the 6-digit code sent to {email}
                                        </p>
                                        <Field icon={Lock}>
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
                                        <div className="flex justify-between px-2 mb-4">
                                            <button
                                                type="button"
                                                onClick={() => { setShowOtp(false); reset(); setOtp(''); }}
                                                className="text-[13px] text-slate-500 hover:text-slate-700 font-semibold transition-colors"
                                            >
                                                ← Back
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleResendOtp}
                                                disabled={loading}
                                                className="text-[13px] text-slate-900 hover:text-black font-bold transition-colors"
                                            >
                                                Resend Code
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {!isLogin && (
                                            <>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <Field icon={User}>
                                                        <input
                                                            type="text"
                                                            value={fullName}
                                                            onChange={(e) => setFullName(e.target.value)}
                                                            className={inputCls(true)}
                                                            placeholder="Full Name"
                                                            required
                                                        />
                                                    </Field>
                                                    <Field icon={Building2}>
                                                        <input
                                                            type="text"
                                                            value={companyName}
                                                            onChange={(e) => setCompanyName(e.target.value)}
                                                            className={inputCls(true)}
                                                            placeholder="Company"
                                                            required
                                                        />
                                                    </Field>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <SelectField
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
                                                    <Field icon={Globe}>
                                                        <input
                                                            type="text"
                                                            value={country}
                                                            onChange={(e) => setCountry(e.target.value)}
                                                            className={inputCls(true)}
                                                            placeholder="Country"
                                                            required
                                                        />
                                                    </Field>
                                                </div>
                                                <div className="flex gap-2">
                                                    <div className="w-[40%]">
                                                        <SelectField
                                                            icon={Phone}
                                                            value={phoneCountryCode}
                                                            onChange={(e) => setPhoneCountryCode(e.target.value)}
                                                            className="mb-0"
                                                            required
                                                        >
                                                            {COUNTRY_CODES.map((c) => (
                                                                <option key={c.code} value={c.code}>{c.label}</option>
                                                            ))}
                                                        </SelectField>
                                                    </div>
                                                    <div className="flex-1">
                                                        <Field>
                                                            <input
                                                                type="tel"
                                                                value={phoneLocalNumber}
                                                                onChange={(e) => setPhoneLocalNumber(e.target.value)}
                                                                className={inputCls()}
                                                                placeholder="Mobile Number"
                                                                required
                                                            />
                                                        </Field>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                        
                                        <Field>
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className={inputCls()}
                                                placeholder="Email"
                                                required
                                            />
                                        </Field>

                                        <Field>
                                            <input
                                                type={showPwd ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className={inputCls()}
                                                placeholder={isLogin ? "Password" : "Create Password"}
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPwd(!showPwd)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                            >
                                                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </Field>
                                    </>
                                )}
                            </motion.div>
                        </AnimatePresence>

                        {/* Alerts */}
                        {error && (
                            <div className="mb-4 flex items-start gap-2.5 text-red-600 text-[13px] font-semibold bg-red-50 border border-red-100 px-4 py-3 rounded-xl shadow-sm">
                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                {error}
                            </div>
                        )}
                        {successMsg && (
                            <div className="mb-4 flex items-start gap-2.5 text-emerald-600 text-[13px] font-semibold bg-emerald-50 border border-emerald-100 px-4 py-3 rounded-xl shadow-sm">
                                <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                                {successMsg}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 rounded-full font-bold text-[14px]
                                       bg-[#f5f5f5] text-slate-800 border border-slate-200
                                       hover:bg-[#ebebeb] hover:border-slate-300
                                       transition-all duration-200
                                       disabled:opacity-60 disabled:pointer-events-none
                                       flex items-center justify-center gap-2 mt-4"
                        >
                            {loading ? 'Processing…' : 'Continue'}
                        </button>
                        
                        {/* Toggle Link */}
                        {!showOtp && (
                            <div className="mt-8 text-center text-[13px] font-semibold text-slate-500">
                                {isLogin ? "Don't have an account? " : "Already have an account? "}
                                <button
                                    type="button"
                                    onClick={() => { setIsLogin(!isLogin); reset(); }}
                                    className="text-slate-900 border-b border-slate-900 pb-0.5 hover:text-slate-600 transition-colors"
                                >
                                    {isLogin ? 'Create one' : 'Login'}
                                </button>
                            </div>
                        )}
                    </form>
                    
                    {/* Footer branding */}
                    <div className="absolute bottom-6 left-0 right-0 text-center flex flex-col items-center">
                       <span className="text-[10px] font-bold text-slate-400">
                           <span className="text-slate-700">IN</span> Crafted with Care. For India, from India
                       </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
