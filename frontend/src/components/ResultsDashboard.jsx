import React, { useRef, useState } from 'react';
import { Download, CheckCircle, XCircle, RotateCcw, FileText, AlertTriangle, BarChart3, ShieldCheck, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import { API_BASE } from '../lib/runtimeConfig';

const ResultsDashboard = ({ results, onReset, onEditRules }) => {
    const reportRef = useRef(null);
    const [showJsonRules, setShowJsonRules] = useState(false);

    if (!results) return null;

    const validPercent = results.total_rows > 0 ? Math.round((results.valid_rows / results.total_rows) * 100) : 0;

    // Sort columns by number of errors, descending, to show top rule failures
    const columnFailures = Object.entries(results.column_stats || {})
        .filter(([_, stats]) => !stats.passed)
        .map(([colName, stats]) => ({
            label: colName,
            // sum failed_count (the actual row-failure count per rule) sent by backend
            errors: stats.errors ? stats.errors.reduce((acc, err) => acc + (err.failed_count || 0), 0) : 0
        }))
        .filter(item => item.errors > 0)   // exclude columns that had no actual failures
        .sort((a, b) => b.errors - a.errors);

    // If we only have some errors, let's normalize their width against the worst column
    const maxErrors = columnFailures.length > 0 ? columnFailures[0].errors : 1;

    const getFilename = (path) => {
        return path.split(/[\\/]/).pop();
    };

    const handleDownload = (path) => {
        if (!path) return;
        const filename = getFilename(path);
        window.open(`${API_BASE}/download/${filename}`, '_blank');
    };

    const handleImageDownload = async () => {
        if (!reportRef.current) return;
        try {
            const canvas = await html2canvas(reportRef.current, {
                scale: 2, // higher resolution
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true
            });
            const image = canvas.toDataURL('image/png', 1.0);
            const link = document.createElement('a');
            link.download = `validation-report-${new Date().getTime()}.png`;
            link.href = image;
            link.click();
        } catch (err) {
            console.error("Failed to generate image:", err);
            alert("Could not download the report as an image.");
        }
    };

    // Calculate DashArray for SVG doughnut chart
    const dashArray = `${validPercent} ${100 - validPercent}`;

    return (
        <div className="flex w-full flex-col items-center">
            <div className="mb-7 text-center">
                <h2 className="mb-3 text-3xl font-black text-slate-900">Validation Complete</h2>
                <p className="mx-auto max-w-2xl text-base text-slate-500">
                    Your data has been processed. Download the dataset or review the validation summary below.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <button
                        onClick={handleImageDownload}
                        className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
                    >
                        <ImageIcon size={18} /> Download as Image
                    </button>
                    {(results.valid_file || results.error_file) && (
                        <div className="flex gap-2">
                            {results.valid_file && (
                                <button
                                    onClick={() => handleDownload(results.valid_file)}
                                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                    <FileText size={18} className="text-emerald-600" /> Download Valid CSV
                                </button>
                            )}
                            {results.error_file && (
                                <button
                                    onClick={() => handleDownload(results.error_file)}
                                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                    <FileText size={18} className="text-red-500" /> Download Error CSV
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* The Report Container to capture via html2canvas */}
            <motion.div
                ref={reportRef}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
            >
                <div className="mb-6 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">Validation Report Preview</h3>
                    <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${validPercent > 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {validPercent}% Healthy
                    </span>
                </div>

                <div className="mb-6 grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-500 mb-2">Total Rows</p>
                        <p className="text-2xl font-bold text-slate-900">{results.total_rows.toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-500 mb-2">Invalid Rows</p>
                        <p className="text-2xl font-bold text-red-600">{results.invalid_rows.toLocaleString()}</p>
                    </div>
                </div>

                <div className="mb-8">
                    <p className="text-sm text-slate-500 mb-4 font-medium">Rule Failures by Column</p>
                    {columnFailures.length === 0 ? (
                        <p className="text-sm text-slate-500 italic">No failures found.</p>
                    ) : (
                        <div className="space-y-4">
                            {columnFailures.slice(0, 5).map((item) => {
                                // Bar width relative to the worst column (always fills to 100% for top column)
                                const failurePercentage = Math.round((item.errors / maxErrors) * 100);
                                // Display % = row failures for this column as % of total rows in dataset
                                const displayPercent = results.total_rows > 0
                                    ? Math.min(100, Math.round((item.errors / results.total_rows) * 100))
                                    : 0;
                                return (
                                    <div key={item.label}>
                                        <div className="flex justify-between text-sm text-slate-700 mb-1.5">
                                            <span>{item.label}</span>
                                            <span className="font-medium text-slate-500">{displayPercent}%</span>
                                        </div>
                                        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                                            <div className="h-full bg-slate-800 rounded-full" style={{ width: `${failurePercentage}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                
                {results.rules && results.rules.length > 0 && (
                    <div className="mb-8">
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-sm text-slate-500 font-medium">Rules Applied</p>
                            <button onClick={() => setShowJsonRules(!showJsonRules)} className="text-xs text-brand-blue font-semibold hover:underline bg-slate-100 px-3 py-1 rounded-lg">
                                {showJsonRules ? 'View as Cards' : 'View JSON'}
                            </button>
                        </div>
                        {showJsonRules ? (
                            <pre className="p-4 bg-slate-900 text-slate-300 rounded-xl overflow-x-auto text-xs font-mono">
                                {JSON.stringify(results.rules, null, 2)}
                            </pre>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {results.rules.map((rule, idx) => (
                                    <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                                        <p className="text-sm font-semibold text-slate-900">{rule.rule_type} <span className="text-slate-500 font-normal">on</span> {rule.column}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div>
                    <p className="text-sm text-slate-500 mb-4 font-medium">Data Quality Mix</p>
                    <div className="flex items-center gap-6">
                        <svg width="100" height="100" viewBox="0 0 42 42" className="shrink-0 drop-shadow-sm">
                            <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#e2e8f0" strokeWidth="6" />
                            <circle
                                cx="21"
                                cy="21"
                                r="15.915"
                                fill="transparent"
                                stroke="#0f172a"
                                strokeWidth="6"
                                strokeDasharray={dashArray}
                                strokeLinecap="round"
                                transform="rotate(-90 21 21)"
                            />
                        </svg>
                        <div className="space-y-2 text-sm">
                            <p className="text-slate-700 flex items-center">
                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-900 mr-3" />
                                Valid: <span className="font-semibold ml-1">{results.valid_rows.toLocaleString()}</span>
                            </p>
                            <p className="text-slate-700 flex items-center">
                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-200 mr-3" />
                                Invalid: <span className="font-semibold ml-1">{results.invalid_rows.toLocaleString()}</span>
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>

            <div className="mt-8 flex flex-wrap gap-3">
                {onEditRules && (
                    <button
                        onClick={onEditRules}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-900"
                    >
                        <ShieldCheck size={18} /> Edit Rules & Re-run
                    </button>
                )}
                <button
                    onClick={onReset}
                    className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                    <RotateCcw size={18} /> Process Another File
                </button>
            </div>
        </div>
    );
};

export default ResultsDashboard;
