import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Github, Linkedin, Twitter } from 'lucide-react';

export default function AboutUs() {
    const team = [
        {
            name: 'Sarah Chen',
            role: 'CEO & Co-Founder',
            image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=crop&w=256&q=80',
        },
        {
            name: 'Michael Ross',
            role: 'CTO',
            image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=crop&w=256&q=80',
        },
        {
            name: 'Jessica Lee',
            role: 'Head of Product',
            image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-1.2.1&auto=format&fit=crop&w=256&q=80',
        },
    ];

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Hero Section */}
            <div className="relative py-24 px-6 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-slate-50 z-0" />
                {/* Background Blobs */}
                <div className="absolute top-20 right-20 w-96 h-96 bg-brand-200/50 rounded-full blur-3xl animate-blob" />
                <div className="absolute bottom-20 left-20 w-96 h-96 bg-accent-200/50 rounded-full blur-3xl animate-blob animation-delay-2000" />

                <div className="max-w-7xl mx-auto relative z-10 text-center">
                    <h1 className="text-6xl font-black mb-8 leading-tight text-slate-900">
                        We're on a mission to <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-accent-600">
                            clean up the world's data.
                        </span>
                    </h1>
                    <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-12">
                        CleanFlow was built by data engineers who were tired of spending 80% of their time cleaning data. We believe data quality should be automated, intelligent, and beautiful.
                    </p>
                </div>
            </div>

            {/* Stats Section */}
            <div className="bg-white py-16 border-y border-slate-200">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                    {[
                        { label: 'Rows Processed', value: '10B+' },
                        { label: 'Data Sources', value: '50+' },
                        { label: 'Accuracy', value: '99.9%' },
                        { label: 'Happy Clients', value: '500+' },
                    ].map((stat, idx) => (
                        <div key={idx}>
                            <div className="text-4xl font-black text-slate-900 mb-2">{stat.value}</div>
                            <div className="text-sm font-bold text-brand-600 uppercase tracking-wider">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Team Section */}
            <div className="py-24 px-6 max-w-7xl mx-auto">
                <h2 className="text-4xl font-black text-center mb-16 text-slate-900">Meet the Team</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {team.map((member) => (
                        <motion.div
                            key={member.name}
                            whileHover={{ y: -10 }}
                            className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl text-center group"
                        >
                            <div className="mb-6 relative inline-block">
                                <div className="absolute inset-0 bg-gradient-to-r from-brand-500 to-accent-500 rounded-full blur opacity-0 group-hover:opacity-50 transition-opacity duration-500" />
                                <img
                                    src={member.image}
                                    alt={member.name}
                                    className="w-32 h-32 rounded-full object-cover relative z-10 border-4 border-white"
                                />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 mb-2">{member.name}</h3>
                            <p className="text-brand-600 font-medium mb-6">{member.role}</p>
                            <div className="flex justify-center gap-4 text-slate-400">
                                <Github size={20} className="hover:text-slate-900 cursor-pointer transition-colors" />
                                <Linkedin size={20} className="hover:text-blue-700 cursor-pointer transition-colors" />
                                <Twitter size={20} className="hover:text-blue-400 cursor-pointer transition-colors" />
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Join CTA */}
            <div className="py-24 px-6">
                <div className="max-w-5xl mx-auto bg-slate-900 rounded-[3rem] p-12 md:p-24 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/20 rounded-full blur-3xl -mr-20 -mt-20" />
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent-500/20 rounded-full blur-3xl -ml-20 -mb-20" />

                    <div className="relative z-10">
                        <h2 className="text-4xl md:text-5xl font-black text-white mb-6">Ready to join the revolution?</h2>
                        <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
                            We're always looking for talented individuals to join our team. Check out our open roles.
                        </p>
                        <button className="bg-white text-slate-900 hover:bg-brand-50 px-8 py-4 rounded-xl font-bold text-lg transition-all inline-flex items-center gap-2">
                            View Careers <ArrowRight size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
