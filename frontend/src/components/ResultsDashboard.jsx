import React from 'react';
import { Download, CheckCircle, XCircle, RotateCcw, FileText, BarChart3, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

// Pulling the URL from the .env file
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const ResultsDashboard = ({ results, onReset }) => {
    if (!results) return null;

    const validPercent = ((results.valid_rows / results.total_rows) * 100).toFixed(1);
    const errorPercent = ((results.invalid_rows / results.total_rows) * 100).toFixed(1);

    const getFilename = (path) => {
        return path.split(/[\\/]/).pop();
    };

    const handleDownload = (path) => {
        const filename = getFilename(path);
        window.open(`${API_BASE}/download/${filename}`, '_blank');
    };

    const columnStats = results.column_stats || {};

    return (
        <div className="flex flex-col items-center w-full">
            <div className="text-center mb-12">
                <h2 className="text-4xl font-black text-slate-900 mb-4">Validation Complete</h2>
                <p className="text-slate-500 text-lg max-w-2xl mx-auto">
                    Your data has been processed. Download the clean dataset below or review the error logs for items that failed validation.
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-8 w-full mb-12 max-w-5xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-3xl p-8 shadow-soft border border-slate-100 flex flex-col items-center"
                >
                    <div className="p-3 bg-blue-50 text-brand-blue rounded-xl mb-4">
                        <BarChart3 size={32} />
                    </div>
                    <div className="text-5xl font-black text-slate-900 mb-2">{results.total_rows}</div>
                    <div className="text-slate-400 text-sm font-bold uppercase tracking-widest">Total Rows</div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-3xl p-8 shadow-soft border border-slate-100 flex flex-col items-center relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-full h-2 bg-green-500" />
                    <div className="p-3 bg-green-50 text-green-500 rounded-xl mb-4">
                        <CheckCircle size={32} />
                    </div>
                    <div className="text-5xl font-black text-slate-900 mb-2">{results.valid_rows}</div>
                    <div className="text-green-600 text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                        Valid ({validPercent}%)
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white rounded-3xl p-8 shadow-soft border border-slate-100 flex flex-col items-center relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-full h-2 bg-red-500" />
                    <div className="p-3 bg-red-50 text-red-500 rounded-xl mb-4">
                        <XCircle size={32} />
                    </div>
                    <div className="text-5xl font-black text-slate-900 mb-2">{results.invalid_rows}</div>
                    <div className="text-red-500 text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                        Invalid ({errorPercent}%)
                    </div>
                </motion.div>
            </div>

            {/* Per-Column Stats */}
            {Object.keys(columnStats).length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="w-full max-w-5xl mb-12 bg-white rounded-3xl shadow-soft border border-slate-100 p-8"
                >
                    <h3 className="text-xl font-bold text-slate-900 mb-6">Column Validation Summary</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(columnStats).map(([colName, stats]) => (
                            <div
                                key={colName}
                                className={`p-4 rounded-2xl border ${stats.passed ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    {stats.passed ? (
                                        <CheckCircle className="text-green-500" size={20} />
                                    ) : (
                                        <XCircle className="text-red-500" size={20} />
                                    )}
                                    <span className="font-bold text-slate-800">{colName}</span>
                                </div>
                                {!stats.passed && stats.errors && stats.errors.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                        {stats.errors.map((err, idx) => (
                                            <div key={idx} className="text-xs text-red-600 flex items-start gap-2">
                                                <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                                                <span>{err.description}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {stats.passed && (
                                    <p className="text-xs text-green-600 mt-1">All rows passed validation</p>
                                )}
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Download Buttons */}
            <div className="flex gap-8 w-full justify-center max-w-4xl">
                <button
                    onClick={() => handleDownload(results.valid_file)}
                    className="group flex-1 bg-white hover:bg-slate-50 border border-slate-200 hover:border-green-400 transition-all p-6 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-slate-100 group-hover:bg-green-100 text-slate-500 group-hover:text-green-600 transition-colors">
                            <FileText size={24} />
                        </div>
                        <div className="text-left">
                            <div className="text-lg font-bold text-slate-800 group-hover:text-green-700">Clean Data</div>
                            <div className="text-sm text-slate-400 group-hover:text-green-600/70">Download CSV</div>
                        </div>
                    </div>
                    <Download size={24} className="text-slate-300 group-hover:text-green-500" />
                </button>

                <button
                    onClick={() => handleDownload(results.error_file)}
                    className="group flex-1 bg-white hover:bg-slate-50 border border-slate-200 hover:border-red-400 transition-all p-6 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-slate-100 group-hover:bg-red-100 text-slate-500 group-hover:text-red-600 transition-colors">
                            <FileText size={24} />
                        </div>
                        <div className="text-left">
                            <div className="text-lg font-bold text-slate-800 group-hover:text-red-700">Error Records</div>
                            <div className="text-sm text-slate-400 group-hover:text-red-600/70">Download CSV</div>
                        </div>
                    </div>
                    <Download size={24} className="text-slate-300 group-hover:text-red-500" />
                </button>
            </div>

            <div className="mt-16">
                <button
                    onClick={onReset}
                    className="flex items-center gap-2 text-slate-400 hover:text-brand-blue transition-colors font-medium"
                >
                    <RotateCcw size={18} /> Process Another File
                </button>
            </div>
        </div>
    );
};

export default ResultsDashboard;
