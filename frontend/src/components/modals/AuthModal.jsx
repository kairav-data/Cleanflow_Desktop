import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    Phone, Briefcase, Globe, Building2, Eye, EyeOff, Lock, User, AlertCircle, CheckCircle2, ChevronDown, Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import NetworkAnimation from '../animations/NetworkAnimation';
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

/* ── Compact Input Classes ── */
const inputCls = (hasIcon = false) =>
    `w-full ${hasIcon ? 'pl-10' : 'px-3'} pr-3 py-2.5 rounded-lg text-[13px] font-medium
     bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400
     focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20
     transition-all duration-200 shadow-sm relative z-20`;

const selectCls = (hasIcon = false, hasValue = true) =>
    `w-full ${hasIcon ? 'pl-10' : 'px-3'} pr-10 py-2.5 rounded-lg text-[13px] font-medium
     ${hasValue ? 'text-slate-900' : 'text-slate-400'}
     bg-slate-50 border border-slate-200
     focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20
     transition-all duration-200 shadow-sm appearance-none cursor-pointer relative z-20`;

/* ── Field Wrapper ── */
const Field = ({ icon: Icon, children }) => (
    <div className="relative mb-3 group z-20">
        {Icon && (
            <Icon
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none z-30"
            />
        )}
        {children}
    </div>
);

const SelectField = ({ icon: Icon, value, onChange, children, className = '', ...props }) => (
    <div className="relative mb-3 group z-20">
        {Icon && (
            <Icon
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none z-30"
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
            size={14}
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors z-30"
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
                    
                    setIsLogin(true);
                    setSuccessMsg('Account created successfully. Please log in.');
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
        try { 
            setLoading(true); 
            reset();
            await axios.post(`${API_BASE}/resend-otp`, { email });
            setSuccessMsg('A new code has been sent to your email.');
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to resend OTP');
        } finally { 
            setLoading(false); 
        }
    };

    return (
        <div className="absolute inset-0 z-50 flex bg-white w-full h-full overflow-hidden">
            
            {/* Left Image Section */}
            <div className="hidden lg:block lg:w-1/2 h-full relative border-r border-[#1e293b]">
                <NetworkAnimation />
                
                <div className="absolute bottom-8 left-10 right-10 z-20 text-white pointer-events-none drop-shadow-lg">
                    <h1 className="text-3xl font-bold mb-2 tracking-tight leading-tight">
                        Power your data workflows
                    </h1>
                    <p className="text-[15px] text-slate-300 font-medium max-w-md">
                        Join thousands of data teams transforming their pipelines with Cleanflow.
                    </p>
                </div>
            </div>

            {/* Right Form Section */}
            <div className="w-full lg:w-1/2 h-full overflow-y-auto bg-white relative">

                <div className="min-h-full flex flex-col justify-center px-6 py-6 max-w-[420px] mx-auto relative z-20">
                    
                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 shadow-md shadow-indigo-500/20 mb-4">
                            <Lock size={20} className="text-white" />
                        </div>
                        <h2 className="text-[24px] font-bold tracking-tight text-slate-900 mb-2">
                            {showOtp ? 'Verify your email' : isLogin ? 'Welcome back' : 'Create an account'}
                        </h2>
                        <p className="text-[13px] text-slate-500 font-medium">
                            {showOtp 
                                ? 'We\'ve sent a verification code to your email' 
                                : isLogin 
                                    ? 'Enter your details to access your workspace' 
                                    : 'Start your journey with Cleanflow today'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="w-full relative z-30">
                        {!showOtp && (
                            <>
                                {/* SSO Buttons */}
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    <button 
                                        type="button"
                                        onClick={() => window.location.href = `${API_BASE}/auth/google`}
                                        className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all text-[13px] font-semibold text-slate-700 relative z-30 cursor-pointer"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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
                                        className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all text-[13px] font-semibold text-slate-700 relative z-30 cursor-pointer"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                                            <path fill="#f25022" d="M1 1h9v9H1z"/>
                                            <path fill="#00a4ef" d="M1 11h9v9H1z"/>
                                            <path fill="#7fba00" d="M11 1h9v9h-9z"/>
                                            <path fill="#ffb900" d="M11 11h9v9h-9z"/>
                                        </svg>
                                        Microsoft
                                    </button>
                                </div>

                                {/* Divider */}
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="h-[1px] bg-slate-200 flex-1"></div>
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">OR</span>
                                    <div className="h-[1px] bg-slate-200 flex-1"></div>
                                </div>
                            </>
                        )}

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={showOtp ? 'otp' : isLogin ? 'login' : 'signup'}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                            >
                                {showOtp ? (
                                    <>
                                        <p className="text-center text-[13px] text-slate-600 font-medium mb-6">
                                            Code sent to <span className="text-slate-900 font-bold">{email}</span>
                                        </p>
                                        <div className="mb-6 relative z-40">
                                            <input
                                                type="text"
                                                value={otp}
                                                onChange={(e) => setOtp(e.target.value)}
                                                className="w-full text-center tracking-[1em] text-2xl font-black py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all duration-300 shadow-sm relative z-40"
                                                placeholder="------"
                                                maxLength={6}
                                                required
                                                autoFocus
                                            />
                                        </div>
                                        <div className="flex justify-between items-center px-2 mb-4">
                                            <button
                                                type="button"
                                                onClick={() => { setShowOtp(false); reset(); setOtp(''); }}
                                                className="text-[12px] text-slate-500 hover:text-indigo-600 font-bold transition-colors cursor-pointer relative z-40"
                                            >
                                                &larr; Back
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleResendOtp}
                                                disabled={loading}
                                                className="text-[12px] text-indigo-600 hover:text-indigo-700 font-bold transition-colors disabled:opacity-50 cursor-pointer relative z-40"
                                            >
                                                Resend Code
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {!isLogin && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
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
                                                        <option value="" disabled>Profession</option>
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
                                                    <div className="w-[35%]">
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
                                                                className={inputCls(false)}
                                                                placeholder="Mobile Number"
                                                                required
                                                            />
                                                        </Field>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                        
                                        <Field icon={Mail}>
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className={inputCls(true)}
                                                placeholder="Email Address"
                                                required
                                            />
                                        </Field>

                                        <Field icon={Lock}>
                                            <input
                                                type={showPwd ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className={inputCls(true)}
                                                placeholder={isLogin ? "Password" : "Create Password"}
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPwd(!showPwd)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition-colors z-30 cursor-pointer"
                                                tabIndex="-1"
                                            >
                                                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </Field>

                                        {isLogin && !showOtp && (
                                            <div className="flex justify-end mb-2 -mt-1 relative z-30">
                                                <button type="button" className="text-[12px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer">
                                                    Forgot password?
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </motion.div>
                        </AnimatePresence>

                        {/* Alerts */}
                        <AnimatePresence>
                            {error && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                    <div className="mt-3 flex items-start gap-2 text-rose-600 text-[12px] font-medium bg-rose-50 border border-rose-100 px-3 py-2.5 rounded-lg shadow-sm">
                                        <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-500" />
                                        <span>{error}</span>
                                    </div>
                                </motion.div>
                            )}
                            {successMsg && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                    <div className="mt-3 flex items-start gap-2 text-emerald-700 text-[12px] font-medium bg-emerald-50 border border-emerald-100 px-3 py-2.5 rounded-lg shadow-sm">
                                        <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-500" />
                                        <span>{successMsg}</span>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-5 py-2.5 rounded-lg font-bold text-[14px] text-white
                                       bg-gradient-to-r from-indigo-600 to-sky-500 
                                       hover:from-indigo-500 hover:to-sky-400
                                       shadow-sm hover:shadow-md
                                       transition-all duration-300
                                       disabled:opacity-70 disabled:pointer-events-none
                                       flex items-center justify-center gap-2 relative z-30 cursor-pointer"
                        >
                            {loading ? (
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                showOtp ? 'Verify Code' : isLogin ? 'Sign In' : 'Create Account'
                            )}
                        </button>
                        
                        {/* Toggle Link */}
                        {!showOtp && (
                            <div className="mt-6 text-center text-[13px] font-medium text-slate-500 relative z-30">
                                {isLogin ? "Don't have an account? " : "Already have an account? "}
                                <button
                                    type="button"
                                    onClick={() => { setIsLogin(!isLogin); reset(); }}
                                    className="text-indigo-600 font-bold hover:text-indigo-700 transition-colors ml-1 cursor-pointer"
                                >
                                    {isLogin ? 'Create one for free' : 'Sign in instead'}
                                </button>
                            </div>
                        )}
                    </form>
                    
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
