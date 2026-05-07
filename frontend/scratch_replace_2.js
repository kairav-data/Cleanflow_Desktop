const fs = require('fs');

const fullPath = 'c:/Users/KAIRAV/Cleamflow_DesktopApp/cleanflow-pro_Desktop1/frontend/src/features/GlobalRepositoryBuilder.jsx';
let content = fs.readFileSync(fullPath, 'utf8');

const targetStr = `                <motion.section
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-[34px] border border-gray-800 bg-[#030303] px-6 py-7 shadow-2xl"
                >
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #050505 0%, #0a0a0a 50%, #020202 100%)' }} />
                    <div className="absolute top-0 left-1/4 h-[400px] w-[400px] rounded-full bg-sky-500/20 blur-[100px] pointer-events-none mix-blend-screen" />
                    <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-sky-500/20 blur-[100px] pointer-events-none mix-blend-screen" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] bg-blue-600/10 blur-[120px] pointer-events-none mix-blend-screen" />
                    <div className={\`absolute inset-0 bg-gradient-to-r \${config.panelGlowClass} opacity-30\`} />
                    <div className="relative grid gap-6 xl:grid-cols-[1.6fr,1fr] xl:items-end">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-200">
                                <BookOpen size={13} />
                                Shared Repository Workspace
                            </div>
                            <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">Global Repository</h1>
                            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-[15px]">
                                Create custom validation rules and reusable cleaning operations once, then let every CleanFlow user apply them to their own dataset fields.
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">Validation</p>
                                <p className="mt-2 text-3xl font-black text-white">{validationTemplates.length}</p>
                                <p className="mt-1 text-sm font-medium text-slate-300">Shared custom rules</p>
                            </div>
                            <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">Cleaning</p>
                                <p className="mt-2 text-3xl font-black text-white">{cleaningTemplates.length}</p>
                                <p className="mt-1 text-sm font-medium text-slate-300">Shared operations</p>
                            </div>
                            <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">Scope</p>
                                <p className="mt-2 text-3xl font-black text-white">Global</p>
                                <p className="mt-1 text-sm font-medium text-slate-300">Available to all users</p>
                            </div>
                        </div>
                    </div>
                </motion.section>`;

const replaceStr = `                <motion.section
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-[34px] border border-blue-100 bg-white px-6 py-7 shadow-sm"
                >
                    <div className="absolute inset-0 bg-white" />
                    <div className="absolute top-0 left-1/4 h-[400px] w-[400px] rounded-full bg-blue-300/40 blur-[100px] pointer-events-none mix-blend-multiply" />
                    <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-[#00A3AD]/20 blur-[100px] pointer-events-none mix-blend-multiply" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] bg-sky-300/20 blur-[120px] pointer-events-none mix-blend-multiply" />
                    <div className={\`absolute inset-0 bg-gradient-to-r \${config.panelGlowClass} opacity-30\`} />
                    <div className="relative grid gap-6 xl:grid-cols-[1.6fr,1fr] xl:items-end">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">
                                <BookOpen size={13} />
                                Shared Repository Workspace
                            </div>
                            <h1 className="mt-4 text-3xl font-black tracking-tight text-[#0f2040] md:text-4xl">Global Repository</h1>
                            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-500 md:text-[15px]">
                                Create custom validation rules and reusable cleaning operations once, then let every CleanFlow user apply them to their own dataset fields.
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-3xl border border-blue-100 bg-white/60 p-4 backdrop-blur-md shadow-sm">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Validation</p>
                                <p className="mt-2 text-3xl font-black text-blue-600">{validationTemplates.length}</p>
                                <p className="mt-1 text-sm font-medium text-slate-500">Shared custom rules</p>
                            </div>
                            <div className="rounded-3xl border border-sky-100 bg-white/60 p-4 backdrop-blur-md shadow-sm">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Cleaning</p>
                                <p className="mt-2 text-3xl font-black text-sky-600">{cleaningTemplates.length}</p>
                                <p className="mt-1 text-sm font-medium text-slate-500">Shared operations</p>
                            </div>
                            <div className="rounded-3xl border border-slate-200 bg-white/60 p-4 backdrop-blur-md shadow-sm">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Scope</p>
                                <p className="mt-2 text-3xl font-black text-[#0f2040]">Global</p>
                                <p className="mt-1 text-sm font-medium text-slate-500">Available to all users</p>
                            </div>
                        </div>
                    </div>
                </motion.section>`;

const targetNormalized = targetStr.replace(/\\r\\n/g, '\\n');
const contentNormalized = content.replace(/\\r\\n/g, '\\n');

if (contentNormalized.includes(targetNormalized)) {
    const finalContent = contentNormalized.replace(targetNormalized, replaceStr);
    fs.writeFileSync(fullPath, finalContent);
    console.log("Success! File replaced via scratch file script.");
} else {
    console.log("Target not found. Doing manual regex fallback...");
    // Fallback exactly
    let newContent = contentNormalized
        .replace('className="relative overflow-hidden rounded-[34px] border border-gray-800 bg-[#030303] px-6 py-7 shadow-2xl"', 'className="relative overflow-hidden rounded-[34px] border border-blue-100 bg-white px-6 py-7 shadow-sm"')
        .replace(\`<div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #050505 0%, #0a0a0a 50%, #020202 100%)' }} />\`, '<div className="absolute inset-0 bg-white" />')
        .replace(/bg-sky-500\\/20 blur-\\[100px\\] pointer-events-none mix-blend-screen/g, 'bg-blue-300/40 blur-[100px] pointer-events-none mix-blend-multiply')
        .replace(/bg-blue-600\\/10 blur-\\[120px\\] pointer-events-none mix-blend-screen/g, 'bg-sky-300/20 blur-[120px] pointer-events-none mix-blend-multiply')
        .replace('border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-200', 'border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-blue-600')
        .replace('text-white md:text-4xl', 'text-[#0f2040] md:text-4xl')
        .replace('text-slate-300 md:text-[15px]', 'text-slate-500 md:text-[15px]')
        .replace(/border-white\\/15 bg-white\\/10 p-4 backdrop-blur-sm/g, 'border-blue-100 bg-white/60 p-4 backdrop-blur-md shadow-sm')
        .replace(/<p className=\"text-\\[11px\\] font-black uppercase tracking-\\[0.18em\\] text-slate-300\">Validation<\\/p>\\n\\s*<p className=\"mt-2 text-3xl font-black text-white\">/g, '<p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Validation</p>\\n                                <p className="mt-2 text-3xl font-black text-blue-600">')
        .replace(/<p className=\"text-\\[11px\\] font-black uppercase tracking-\\[0.18em\\] text-slate-300\">Cleaning<\\/p>\\n\\s*<p className=\"mt-2 text-3xl font-black text-white\">/g, '<p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Cleaning</p>\\n                                <p className="mt-2 text-3xl font-black text-sky-600">')
        .replace(/<p className=\"text-\\[11px\\] font-black uppercase tracking-\\[0.18em\\] text-slate-300\">Scope<\\/p>\\n\\s*<p className=\"mt-2 text-3xl font-black text-white\">/g, '<p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Scope</p>\\n                                <p className="mt-2 text-3xl font-black text-[#0f2040]">')
        .replace(/text-slate-300/g, 'text-slate-500');
        
    fs.writeFileSync(fullPath, newContent);
    console.log("Fallback regex applied.");
}
