import React, { useRef } from 'react';
import { Download, CheckCircle, XCircle, RotateCcw, FileText, AlertTriangle, BarChart3, ShieldCheck, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';

// Pulling the URL from the .env file
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const ResultsDashboard = ({ results, onReset }) => {
    const reportRef = useRef(null);

    if (!results) return null;

    const validPercent = results.total_rows > 0 ? Math.round((results.valid_rows / results.total_rows) * 100) : 0;

    // Sort columns by number of errors, descending, to show top rule failures
    const columnFailures = Object.entries(results.column_stats || {})
        .filter(([_, stats]) => !stats.passed)
        .map(([colName, stats]) => ({
            label: colName,
            errors: stats.errors ? stats.errors.reduce((acc, err) => acc + (err.count || 1), 0) : 1 // Fallback to 1 if no count
        }))
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
        <div className="flex flex-col items-center w-full">
            <div className="text-center mb-8">
                <h2 className="text-4xl font-black text-slate-900 mb-4">Validation Complete</h2>
                <p className="text-slate-500 text-lg max-w-2xl mx-auto">
                    Your data has been processed. Download the dataset or review the validation summary below.
                </p>
                <div className="mt-6 flex justify-center gap-4">
                    <button
                        onClick={handleImageDownload}
                        className="px-5 py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <ImageIcon size={18} /> Download as Image
                    </button>
                    {(results.valid_file || results.error_file) && (
                        <div className="flex gap-2">
                            {results.valid_file && (
                                <button
                                    onClick={() => handleDownload(results.valid_file)}
                                    className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
                                >
                                    <FileText size={18} className="text-emerald-600" /> Download Valid CSV
                                </button>
                            )}
                            {results.error_file && (
                                <button
                                    onClick={() => handleDownload(results.error_file)}
                                    className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
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
                className="w-full max-w-3xl bg-white border border-slate-200 rounded-2xl p-8 shadow-sm"
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
            >
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold text-slate-900">Validation Report Preview</h3>
                    <span className={`text-sm px-3 py-1.5 rounded-full font-semibold flex items-center gap-1 ${validPercent > 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {validPercent}% Healthy
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-8">
                    <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
                        <p className="text-sm text-slate-500 mb-2">Total Rows</p>
                        <p className="text-3xl font-bold text-slate-900">{results.total_rows.toLocaleString()}</p>
                    </div>
                    <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
                        <p className="text-sm text-slate-500 mb-2">Invalid Rows</p>
                        <p className="text-3xl font-bold text-red-600">{results.invalid_rows.toLocaleString()}</p>
                    </div>
                </div>

                <div className="mb-10">
                    <p className="text-sm text-slate-500 mb-4 font-medium">Rule Failures by Column</p>
                    {columnFailures.length === 0 ? (
                        <p className="text-sm text-slate-500 italic">No failures found.</p>
                    ) : (
                        <div className="space-y-4">
                            {columnFailures.slice(0, 5).map((item) => {
                                const failurePercentage = Math.round((item.errors / maxErrors) * 100);
                                // Real failure percentage roughly vs invalid rows for display purpose:
                                const displayPercent = Math.round((item.errors / (results.invalid_rows || 1)) * 100);
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

            <div className="mt-12">
                <button
                    onClick={onReset}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-medium px-4 py-2 hover:bg-slate-100 rounded-lg"
                >
                    <RotateCcw size={18} /> Process Another File
                </button>
            </div>
        </div>
    );
};

export default ResultsDashboard;
