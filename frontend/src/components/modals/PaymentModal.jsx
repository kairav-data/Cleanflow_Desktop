import React, { useState } from 'react';
import axios from 'axios';
import { X, Check, CreditCard, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

// Pulling the URL from the .env file
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'import.meta.env.VITE_API_URL';

const PaymentModal = ({ isOpen, onClose, onPaymentSuccess }) => {
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handlePayment = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE}/pay`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Refresh user data or just notify success
            onPaymentSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            alert("Payment failed");
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
                className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col items-center text-center"
            >
                <div className="bg-gradient-to-br from-brand-blue to-brand-dark w-full p-8 pb-12 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
                    <div className="relative z-10">
                        <h2 className="text-3xl font-black mb-2">Upgrade to Pro</h2>
                        <p className="text-white/80">Unlock unlimited validations and exports.</p>
                    </div>
                    <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 -mt-8 w-full bg-white rounded-t-3xl relative z-20">
                    <div className="flex justify-center mb-8">
                        <div className="text-5xl font-black text-slate-900 tracking-tight">$29<span className="text-xl text-slate-400 font-medium">/mo</span></div>
                    </div>

                    <div className="space-y-4 mb-8 text-left max-w-xs mx-auto">
                        <div className="flex items-center gap-3 text-slate-600 font-medium">
                            <div className="p-1 rounded-full bg-green-100 text-green-600"><Check size={14} /></div>
                            Unlimited CSV Uploads
                        </div>
                        <div className="flex items-center gap-3 text-slate-600 font-medium">
                            <div className="p-1 rounded-full bg-green-100 text-green-600"><Check size={14} /></div>
                            Advanced Validation Rules
                        </div>
                        <div className="flex items-center gap-3 text-slate-600 font-medium">
                            <div className="p-1 rounded-full bg-green-100 text-green-600"><Check size={14} /></div>
                            Priority Support
                        </div>
                    </div>

                    <button
                        onClick={handlePayment}
                        disabled={loading}
                        className="w-full bg-slate-900 hover:bg-black text-white font-bold py-4 rounded-xl shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-3"
                    >
                        {loading ? (
                            "Processing..."
                        ) : (
                            <>
                                <CreditCard size={20} /> Pay with Card
                            </>
                        )}
                    </button>

                    <p className="mt-4 text-xs text-slate-400 flex items-center justify-center gap-1">
                        <ShieldCheck size={12} /> Secure encrypted payment
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default PaymentModal;
