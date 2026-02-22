import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DataMatchingBuilder from '../features/DataMatchingBuilder';

export default function Matching() {
    const navigate = useNavigate();

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            className="w-full max-w-7xl mx-auto"
        >
            <div className="flex items-center justify-between mb-8 px-6">
                <button
                    onClick={() => navigate('/')}
                    className="p-2 -ml-2 text-slate-400 hover:text-brand-600 transition-colors flex items-center gap-2 font-bold"
                >
                    <ArrowRight className="rotate-180" size={20} /> Back to Home
                </button>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <DataMatchingBuilder
                    onComplete={() => navigate('/')}
                />
            </motion.div>
        </motion.div>
    );
}
