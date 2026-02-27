import React, { useState } from 'react';
import axios from 'axios';
import { X, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Pulling the URL from the .env file
const API_BASE = import.meta.env.VITE_API_BASE_URL;

const AuthModal = ({ isOpen, onClose, onLoginSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [showOtp, setShowOtp] = useState(false);
    const [otp, setOtp] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            if (showOtp) {
                // OTP VERIFICATION FLOW
                const response = await axios.post(`${API_BASE}/verify-otp`, {
                    email: email,
                    otp: otp
                });
                const token = response.data.access_token;
                localStorage.setItem('token', token);

                const userRes = await axios.get(`${API_BASE}/users/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                onLoginSuccess(userRes.data);
                onClose();
            } else if (isLogin) {
                // LOGIN FLOW (Uses OAuth2 Password Grant - requires Form Data)
                const formData = new FormData();
                formData.append('username', email);
                formData.append('password', password);

                try {
                    const response = await axios.post(`${API_BASE}/token`, formData);
                    const token = response.data.access_token;
                    localStorage.setItem('token', token);

                    // Get user details immediately after login
                    const userRes = await axios.get(`${API_BASE}/users/me`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    onLoginSuccess(userRes.data);
                    onClose();
                } catch (err) {
                    const detail = err.response?.data?.detail;
                    if (detail === "OTP_REQUIRED") {
                        setShowOtp(true);
                        setSuccessMsg("An OTP code has been sent to your email.");
                        setLoading(false);
                        return;
                    }
                    throw err; // re-throw to be caught by outer catch
                }
            } else {
                // REGISTRATION FLOW (Uses JSON)
                await axios.post(`${API_BASE}/register`, {
                    email: email,
                    password: password,
                    full_name: fullName
                });

                setSuccessMsg("Account created! You can now sign in.");
                setIsLogin(true); // Switch to login view
                setLoading(false);
            }
        } catch (err) {
            console.error("Auth Error:", err);
            const detail = err.response?.data?.detail;
            setError(Array.isArray(detail) ? detail[0].msg : detail || "Connection error. Is the server running?");
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        try {
            setLoading(true);
            setError('');
            await axios.post(`${API_BASE}/resend-otp`, { email });
            setSuccessMsg("A new OTP code has been sent.");
        } catch (err) {
            const detail = err.response?.data?.detail;
            setError(detail || "Failed to resend OTP");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={onClose}
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
                <div className="p-8">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-2xl font-black text-slate-900">
                            {showOtp ? "Verify Email" : isLogin ? "Welcome Back" : "Create Account"}
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {showOtp ? (
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">OTP Code</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-3.5 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono tracking-[0.5em] text-center text-lg"
                                        placeholder="123456"
                                        maxLength={6}
                                        required
                                    />
                                </div>
                                <div className="text-right mt-2">
                                    <button type="button" onClick={handleResendOtp} disabled={loading} className="text-sm text-blue-600 font-medium hover:underline">
                                        Resend Code
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {!isLogin && (
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name</label>
                                        <div className="relative">
                                            <User className="absolute left-4 top-3.5 text-slate-400" size={18} />
                                            <input
                                                type="text"
                                                value={fullName}
                                                onChange={(e) => setFullName(e.target.value)}
                                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                                placeholder="John Doe"
                                                required={!isLogin}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-3.5 text-slate-400" size={18} />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                            placeholder="you@company.com"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-3.5 text-slate-400" size={18} />
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                            placeholder="••••••••"
                                            required
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {error && (
                            <div className="flex items-center gap-2 text-red-500 text-sm font-medium bg-red-50 p-3 rounded-lg border border-red-100">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        {successMsg && (
                            <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                                <CheckCircle2 size={16} />
                                {successMsg}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-70"
                        >
                            {loading ? "Processing..." : showOtp ? "Verify OTP" : (isLogin ? "Sign In" : "Create Account")}
                            {!loading && <ArrowRight size={18} />}
                        </button>
                    </form>

                    {!showOtp && (
                        <div className="mt-6 text-center">
                            <p className="text-slate-500 text-sm">
                                {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                                <button
                                    onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMsg(''); }}
                                    className="text-blue-600 font-bold hover:underline"
                                >
                                    {isLogin ? "Sign up" : "Log in"}
                                </button>
                            </p>
                        </div>
                    )}

                    {showOtp && (
                        <div className="mt-6 text-center">
                            <button
                                onClick={() => { setShowOtp(false); setError(''); setSuccessMsg(''); setOtp(''); }}
                                className="text-slate-500 text-sm font-medium hover:text-slate-700"
                            >
                                Back to login
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default AuthModal;
