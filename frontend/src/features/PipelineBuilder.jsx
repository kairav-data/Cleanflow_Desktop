import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Handle,
  Position,
  ConnectionLineType,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Database, Sparkles, ShieldCheck, Download, Play, CheckCircle, X, Plus, Trash2, AlertCircle, Globe, GitMerge, Shuffle, BarChart3, Activity, TrendingUp, PieChart as PieIcon, RefreshCw, ChevronDown, ChevronUp, Zap, Settings } from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Component Imports
import { DataConnection, RuleBuilder } from '../components';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'import.meta.env.VITE_API_URL';
const PIPELINE_RUNS_KEY = 'cleanflow_pipeline_runs_v1';

let id = 0;
const getId = () => `node_${id++}`;

const SCRAPER_TEMPLATES = [
  { id: 'amazon_product', name: 'Amazon Product' },
  { id: 'news_article', name: 'News Article' },
  { id: 'linkedin_profile', name: 'LinkedIn Profile' },
];

const MATCHING_ALGORITHMS = [
  { id: 'fuzzy', name: 'Fuzzy Match' },
  { id: 'exact', name: 'Exact Match' },
  { id: 'cosine', name: 'Cosine Similarity' },
  { id: 'jaccard', name: 'Jaccard Similarity' },
];

const getNodeKind = (label = '') => {
  const normalized = label.toLowerCase();
  if (normalized.includes('dataset')) return 'dataset';
  if (normalized.includes('scraping')) return 'scraper';
  if (normalized.includes('cleaner')) return 'cleaner';
  if (normalized.includes('validation')) return 'validation';
  if (normalized.includes('mapping')) return 'mapper';
  if (normalized.includes('matching')) return 'matching';
  if (normalized.includes('export')) return 'export';
  return 'unknown';
};

// ─── Helper: is a node "configured"? ────────────────────────────────────────
const isNodeConfigured = (node) => {
  const kind = getNodeKind(node.data?.label || '');
  if (kind === 'dataset') return !!node.data?.sessionId;
  if (kind === 'cleaner' || kind === 'validation') {
    return Array.isArray(node.data?.rules) && node.data.rules.length > 0;
  }
  if (kind === 'mapper') {
    return !!node.data?.targetSchema?.trim() || Object.keys(node.data?.mappings || {}).length > 0;
  }
  if (kind === 'matching') {
    return Array.isArray(node.data?.matchRules) && node.data.matchRules.length > 0;
  }
  if (kind === 'scraper') {
    return !!node.data?.template && (((node.data?.urls || []).length > 0) || !!node.data?.url?.trim());
  }
  if (kind === 'export') return true;
  return false;
};

// ─── Custom Node Component ───────────────────────────────────────────────────
const PipelineNode = ({ id: nodeId, data, selected }) => {
  const configured = isNodeConfigured({ id: nodeId, data });
  const kind = getNodeKind(data.label || '');

  const icon = kind === 'dataset' ? <Database size={15} />
    : kind === 'scraper' ? <Globe size={15} />
    : kind === 'cleaner' ? <Sparkles size={15} />
    : kind === 'validation' ? <ShieldCheck size={15} />
    : kind === 'mapper' ? <GitMerge size={15} />
    : kind === 'matching' ? <Shuffle size={15} />
    : <Download size={15} />;

  const borderColor = configured ? '#10b981' : '#f59e0b';
  const bgColor     = configured ? '#f0fdf4' : '#fffbeb';
  const textColor   = configured ? '#065f46' : '#92400e';
  const badgeColor  = configured ? '#10b981' : '#f59e0b';

  return (
    <div
      style={{
        border: `2px solid ${selected ? '#6366f1' : borderColor}`,
        borderRadius: '14px',
        background: bgColor,
        minWidth: '160px',
        padding: '10px 14px 10px 12px',
        boxShadow: selected
          ? '0 0 0 3px rgba(99,102,241,0.25)'
          : '0 4px 12px rgba(0,0,0,0.08)',
        position: 'relative',
        fontFamily: 'inherit',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {/* Handles — wired per node role */}
      {/* Sources only emit (right handle) */}
      {(kind !== 'dataset' && kind !== 'scraper') && (
        <Handle type="target" position={Position.Left}
          style={{ background: borderColor, width: 10, height: 10, border: '2px solid white', boxShadow: '0 0 0 2px ' + borderColor }} />
      )}
      {/* Export only receives (left handle) */}
      {kind !== 'export' && (
        <Handle type="source" position={Position.Right}
          style={{ background: borderColor, width: 10, height: 10, border: '2px solid white', boxShadow: '0 0 0 2px ' + borderColor }} />
      )}

      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); data.onDelete(nodeId); }}
        style={{
          position: 'absolute', top: -10, right: -10,
          background: '#ef4444', border: '2px solid white',
          borderRadius: '50%', width: 22, height: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'white', zIndex: 10,
        }}
        title="Delete node"
      >
        <X size={12} />
      </button>

      {/* Content */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: badgeColor }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: 13, color: textColor }}>{data.label}</span>
      </div>

      {/* Status badge */}
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
        {configured ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: '#10b981' }}>
            <CheckCircle size={10} /> Configured
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>
            <AlertCircle size={10} /> Needs Setup
          </span>
        )}
      </div>
    </div>
  );
};

const nodeTypes = { pipelineNode: PipelineNode };

export const PipelineBuilder = ({ onComplete }) => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeNode, setActiveNode] = useState(null);
  const [pipelineColumns, setPipelineColumns] = useState([]);  // columns from uploaded dataset
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionLogs, setExecutionLogs] = useState([]);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [logsExpanded, setLogsExpanded] = useState(true);

  // AI Visualizer state
  const [vizAnalysis, setVizAnalysis] = useState(null);
  const [vizLoading, setVizLoading] = useState(false);
  const [vizError, setVizError] = useState('');
  const [showViz, setShowViz] = useState(false);

  const CHART_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16'];
  const GRADIENT_PAIRS = [['#6366f1','#818cf8'],['#10b981','#34d399'],['#f59e0b','#fbbf24'],['#ef4444','#f87171'],['#8b5cf6','#a78bfa'],['#06b6d4','#22d3ee']];

  const VizTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 shadow-2xl">
        {label !== undefined && <p className="text-slate-400 text-xs mb-0.5 font-medium">{label}</p>}
        {payload.map((p, i) => (
          <p key={i} className="text-sm font-bold" style={{ color: p.color || p.fill || '#fff' }}>
            {typeof p.value === 'number' ? Number(p.value).toLocaleString() : p.value}
          </p>
        ))}
      </div>
    );
  };

  const renderVizChart = (chart, idx) => {
    const grad = GRADIENT_PAIRS[idx % GRADIENT_PAIRS.length];
    const col  = CHART_COLORS[idx % CHART_COLORS.length];
    const common = { data: chart.data, margin: { top: 4, right: 8, left: 0, bottom: 4 } };
    if (chart.type === 'bar') return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart {...common}>
          <defs><linearGradient id={`bg-${idx}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={grad[0]} stopOpacity={0.9}/><stop offset="100%" stopColor={grad[1]} stopOpacity={0.6}/></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey={chart.xKey} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={42} />
          <Tooltip content={<VizTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
          <Bar dataKey={chart.dataKey} fill={`url(#bg-${idx})`} radius={[5,5,0,0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    );
    if (chart.type === 'area') return (
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart {...common}>
          <defs><linearGradient id={`ag-${idx}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={col} stopOpacity={0.3}/><stop offset="95%" stopColor={col} stopOpacity={0}/></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey={chart.xKey} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={42} />
          <Tooltip content={<VizTooltip />} />
          <Area type="monotone" dataKey={chart.dataKey} stroke={col} strokeWidth={2} fill={`url(#ag-${idx})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    );
    if (chart.type === 'line') return (
      <ResponsiveContainer width="100%" height={200}>
        <LineChart {...common}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey={chart.xKey} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={42} />
          <Tooltip content={<VizTooltip />} />
          <Line type="monotone" dataKey={chart.dataKey} stroke={col} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: col }} />
        </LineChart>
      </ResponsiveContainer>
    );
    if (chart.type === 'pie') return (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={chart.data} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value">
            {chart.data.map((entry, i) => <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip content={<VizTooltip />} />
          <Legend formatter={(v) => <span style={{ color: '#64748b', fontSize: 10 }}>{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
    );
    if (chart.type === 'scatter') return (
      <ResponsiveContainer width="100%" height={200}>
        <ScatterChart {...common}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="x" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
          <YAxis dataKey="y" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={42} />
          <Tooltip content={<VizTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={chart.data} fill={col} fillOpacity={0.65} />
        </ScatterChart>
      </ResponsiveContainer>
    );
    return null;
  };

  const runVisualizerAnalysis = async () => {
    if (!activeSessionId) return;
    setVizLoading(true);
    setVizError('');
    setShowViz(true);
    try {
      const res = await axios.post(`${API_BASE}/features/visualizer/analyze/${activeSessionId}`);
      setVizAnalysis(res.data);
    } catch (err) {
      setVizError(err.response?.data?.detail || err.message || 'Visualization failed');
    } finally {
      setVizLoading(false);
    }
  };

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), []);

  const deleteNode = useCallback((nodeId) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setActiveNode((prev) => (prev?.id === nodeId ? null : prev));
  }, [setNodes, setEdges]);

  // Inject onDelete into every node's data so custom node can call it
  const nodesWithHandlers = nodes.map((n) => ({
    ...n,
    data: { ...n.data, onDelete: deleteNode },
  }));

  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      if (!reactFlowInstance) return;

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      let label = type.charAt(0).toUpperCase() + type.slice(1);
      if (type === 'dataset')    label = 'Dataset Input';
      if (type === 'scraper')    label = 'Web Scraping';
      if (type === 'cleaner')    label = 'Data Cleaner';
      if (type === 'validation') label = 'Quality Validation';
      if (type === 'mapper')     label = 'Schema Mapping';
      if (type === 'matching')   label = 'Data Matching';
      if (type === 'export')     label = 'File Export';

      const newNode = {
        id: getId(),
        type: 'pipelineNode',
        position,
        data: { label, rules: [], onDelete: deleteNode },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, deleteNode]
  );

  const onNodeClick = useCallback((event, node) => {
      setActiveNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
      setActiveNode(null);
  }, []);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleRunPipeline = async () => {
      if (!activeSessionId) {
          alert('Please configure a Dataset Input node first to initialize a session!');
          return;
      }
      
      setIsExecuting(true);
      setExecutionLogs([]);
      setDownloadUrl(null);
      
      // Serialize nodes to send to backend
      // In a full implementation we would extract node-specific configurations (like rules for Cleaner) from node.data
      const payload = {
          nodes: nodes.map(n => ({
              id: n.id,
              type: getNodeKind(n.data.label),
              data: n.data
          })),
          edges: edges
      };

      const runRecord = {
        id: `run_${Date.now()}`,
        name: `Pipeline run ${new Date().toLocaleString()}`,
        startedAt: new Date().toISOString(),
        status: 'running',
        nodeCount: nodes.length,
        logs: [],
        outputFile: null
      };

      const persistRun = (updater) => {
        try {
          const currentRuns = JSON.parse(localStorage.getItem(PIPELINE_RUNS_KEY) || '[]');
          const nextRuns = updater(Array.isArray(currentRuns) ? currentRuns : []);
          localStorage.setItem(PIPELINE_RUNS_KEY, JSON.stringify(nextRuns));
        } catch {
          // Ignore local storage failures in runtime flow
        }
      };

      persistRun((currentRuns) => [runRecord, ...currentRuns].slice(0, 25));

      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.post(`${API_BASE}/features/pipeline/execute/${activeSessionId}`, payload, { headers });
        
        setExecutionLogs(res.data.logs || []);
        
        if (res.data.output_file) {
            // Usually we construct a download URL
            const filename = res.data.output_file.split('/').pop().split('\\').pop();
            setDownloadUrl(`${API_BASE}/download/${filename}`);
        }
        // Auto-trigger visualization on successful run
        setVizAnalysis(null);
        setShowViz(false);

        persistRun((currentRuns) => currentRuns.map((run) => (
          run.id === runRecord.id
            ? {
                ...run,
                status: 'completed',
                finishedAt: new Date().toISOString(),
                logs: res.data.logs || [],
                outputFile: res.data.output_file ? `${API_BASE}/download/${res.data.output_file.split('/').pop().split('\\').pop()}` : null
              }
            : run
        )));
        
      } catch (err) {
          console.error("Pipeline run failed", err);
          persistRun((currentRuns) => currentRuns.map((run) => (
            run.id === runRecord.id
              ? {
                  ...run,
                  status: 'failed',
                  finishedAt: new Date().toISOString(),
                  logs: [{ type: 'pipeline', status: 'failed', error: err.response?.data?.detail || err.message, message: err.response?.data?.detail || err.message }]
                }
              : run
          )));
          alert("Pipeline failed to execute. Check logs.");
      } finally {
          setIsExecuting(false);
      }
  };

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden" style={{ background: '#f8fafc' }}>

      {/* ── Premium Header ── */}
      <div className="h-[60px] shrink-0 flex items-center justify-between px-6 z-10 bg-white border-b border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-200">
                  <GitMerge size={15} className="text-white" />
              </div>
              <div>
                  <h1 className="text-sm font-black text-slate-900 leading-tight">Pipeline Orchestrator</h1>
                  <p className="text-xs text-slate-400 font-medium leading-none mt-0.5">Drag • Connect • Run</p>
              </div>
              {nodes.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                      {nodes.length} node{nodes.length !== 1 ? 's' : ''}
                  </span>
              )}
          </div>
          <div className="flex items-center gap-3">
              {isExecuting && (
                  <span className="flex items-center gap-1.5 text-xs text-amber-600 font-bold animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" /> Executing…
                  </span>
              )}
              <button
                  onClick={handleRunPipeline}
                  disabled={isExecuting || nodes.length === 0}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all ${
                      isExecuting || nodes.length === 0
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-400 hover:to-teal-500 shadow-lg shadow-emerald-200 hover:scale-[1.02]'
                  }`}
              >
                  <Play size={15} fill={isExecuting || nodes.length === 0 ? 'currentColor' : 'currentColor'} />
                  {isExecuting ? 'Running…' : 'Run Pipeline'}
              </button>
          </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Node Palette (white) ── */}
        <aside className="w-[210px] shrink-0 z-10 flex flex-col overflow-hidden bg-white border-r border-slate-100">

          {/* Palette header */}
          <div className="px-4 py-3.5 border-b border-slate-100">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Node Library</p>
              <p className="text-xs mt-0.5 text-slate-400">Drag nodes to canvas</p>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">

            {/* Input Sources */}
            <div>
              <p className="text-xs font-black uppercase tracking-widest mb-2 px-1 text-slate-400">Sources</p>
              <div className="space-y-1.5">
                {[{ type: 'dataset', label: 'Dataset Input', icon: Database,  color: '#10b981', bg: '#10b98115' },
                  { type: 'scraper', label: 'Web Scraping',  icon: Globe,     color: '#f97316', bg: '#f9731615' }]
                .map(n => (
                    <div key={n.type}
                        draggable
                        onDragStart={(e) => onDragStart(e, n.type)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-grab select-none transition-all border border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                    >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: n.bg }}>
                            <n.icon size={14} style={{ color: n.color }} />
                        </div>
                        <span className="text-xs font-bold text-slate-600">{n.label}</span>
                    </div>
                ))}
              </div>
            </div>

            {/* Transformations */}
            <div>
              <p className="text-xs font-black uppercase tracking-widest mb-2 px-1 text-slate-400">Transform</p>
              <div className="space-y-1.5">
                {[{ type: 'cleaner',    label: 'Data Cleaner',       icon: Sparkles,    color: '#10b981', bg: '#10b98115' },
                  { type: 'validation', label: 'Quality Validation', icon: ShieldCheck, color: '#3b82f6', bg: '#3b82f615' },
                  { type: 'mapper',     label: 'Schema Mapping',     icon: GitMerge,    color: '#6366f1', bg: '#6366f115' },
                  { type: 'matching',   label: 'Data Matching',      icon: Shuffle,     color: '#8b5cf6', bg: '#8b5cf615' }]
                .map(n => (
                    <div key={n.type}
                        draggable
                        onDragStart={(e) => onDragStart(e, n.type)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-grab select-none transition-all border border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                    >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: n.bg }}>
                            <n.icon size={14} style={{ color: n.color }} />
                        </div>
                        <span className="text-xs font-bold text-slate-600">{n.label}</span>
                    </div>
                ))}
              </div>
            </div>

            {/* Output */}
            <div>
              <p className="text-xs font-black uppercase tracking-widest mb-2 px-1 text-slate-400">Output</p>
              <div
                  draggable
                  onDragStart={(e) => onDragStart(e, 'export')}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-grab select-none transition-all border border-emerald-100 bg-emerald-50 hover:bg-emerald-100"
              >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#10b98120' }}>
                      <Download size={14} style={{ color: '#10b981' }} />
                  </div>
                  <span className="text-xs font-bold text-emerald-700">File Export</span>
              </div>
            </div>

          </div>

          {/* Keyboard hint */}
          <div className="px-4 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-300">Del — remove selected node</p>
          </div>
        </aside>

        {/* Center Canvas */}
        <div className="flex-1 h-full relative" ref={reactFlowWrapper}>

            {/* Hidden SVG — defines a small circle endpoint marker */}
            <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
                <defs>
                    <marker id="cf-dot" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                        <circle cx="4" cy="4" r="2.5" fill="#94a3b8" />
                    </marker>
                </defs>
            </svg>

            <ReactFlowProvider>
                <ReactFlow
                nodes={nodesWithHandlers}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onInit={setReactFlowInstance}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                deleteKeyCode="Delete"
                connectionLineType={ConnectionLineType.Step}
                connectionLineStyle={{ stroke: '#cbd5e1', strokeWidth: 1.5, strokeDasharray: '4 3' }}
                defaultEdgeOptions={{
                  type: 'step',
                  animated: false,
                  style: { stroke: '#cbd5e1', strokeWidth: 1.5 },
                  markerEnd: 'url(#cf-dot)',
                }}
                fitView
                >
                <Controls style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }} />
                <Background variant="dots" gap={24} size={1.2} color="#94a3b8" style={{ background: '#f8fafc' }} />
                </ReactFlow>
            </ReactFlowProvider>


            {/* Right Side Configuration Panel */}
            <AnimatePresence>
                {activeNode && (
                    <motion.div
                        initial={{ x: '100%', opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                        className="absolute right-0 top-0 h-full w-[480px] max-w-full shadow-2xl z-40 flex flex-col"
                        style={{ background: '#ffffff', borderLeft: '1px solid #e2e8f0' }}
                    >
                        {/* Panel accent bar */}
                        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg,#10b981,#6366f1,#8b5cf6)' }} />
                        <div className="h-14 flex items-center justify-between px-5 border-b border-slate-100 shrink-0 bg-white">
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                                    <Settings size={13} className="text-slate-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-900">{activeNode.data.label}</p>
                                    <p className="text-xs text-slate-400">Configuration</p>
                                </div>
                            </div>
                            <button onClick={() => setActiveNode(null)}
                                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5">
                            {/* Validation Configuration */}
                            {activeNode.data.label.toLowerCase().includes('validation') && (
                                <RuleBuilder 
                                    isEmbedded={true} 
                                    columns={activeNode.data.columns || pipelineColumns} 
                                    initialRules={activeNode.data.rules || []}
                                    onSaveRules={(rules) => {
                                        setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, rules } } : n));
                                        setActiveNode(prev => prev ? { ...prev, data: { ...prev.data, rules } } : null);
                                    }}
                                />
                            )}
                            
                            {/* Cleaner Configuration */}
                            {activeNode.data.label.toLowerCase().includes('cleaner') && (
                                <CleanerConfigPanel 
                                    node={activeNode} 
                                    columns={activeNode.data.columns || pipelineColumns}
                                    onSave={(rules) => {
                                        setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, rules } } : n));
                                        setActiveNode(prev => prev ? { ...prev, data: { ...prev.data, rules } } : null);
                                    }} 
                                />
                            )}

                            {activeNode.data.label.toLowerCase().includes('mapping') && (
                                <MapperConfigPanel
                                    node={activeNode}
                                    columns={activeNode.data.columns || pipelineColumns}
                                    onSave={(config) => {
                                        setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n));
                                        setActiveNode(prev => prev ? { ...prev, data: { ...prev.data, ...config } } : null);
                                    }}
                                />
                            )}

                            {activeNode.data.label.toLowerCase().includes('matching') && (
                                <MatchingConfigPanel
                                    node={activeNode}
                                    columns={activeNode.data.columns || pipelineColumns}
                                    onSave={(config) => {
                                        setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n));
                                        setActiveNode(prev => prev ? { ...prev, data: { ...prev.data, ...config } } : null);
                                    }}
                                />
                            )}

                            {activeNode.data.label.toLowerCase().includes('scraping') && (
                                <ScraperConfigPanel
                                    node={activeNode}
                                    onSave={(config) => {
                                        setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n));
                                        setActiveNode(prev => prev ? { ...prev, data: { ...prev.data, ...config } } : null);
                                    }}
                                />
                            )}

                            {activeNode.data.label.toLowerCase().includes('dataset') && (
                                <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl border border-slate-100 py-6 px-4">
                                     <h3 className="font-bold text-lg text-slate-800 mb-6">Import Dataset</h3>
                                     <div className="mt-4">
                                        <DataConnection onUploadSuccess={(uploadData) => {
                                             setActiveSessionId(uploadData.session_id);
                                             setPipelineColumns(uploadData.columns || []);
                                             // Mark this node as configured by storing sessionId in its data
                                             setNodes(nds => nds.map(n => n.id === activeNode.id 
                                               ? { ...n, data: { ...n.data, sessionId: uploadData.session_id, columns: uploadData.columns || [] } } 
                                               : n
                                             ));
                                             setActiveNode(prev => prev ? { ...prev, data: { ...prev.data, sessionId: uploadData.session_id, columns: uploadData.columns || [] } } : null);
                                             setActiveNode(null);
                                        }} />
                                     </div>
                                </div>
                            )}

                            {activeNode.data.label.toLowerCase().includes('export') && (
                                <div className="text-slate-500 text-center mt-10 space-y-3">
                                    <Download size={32} className="mx-auto text-emerald-400" />
                                    <p className="font-semibold text-slate-700">Export Node Ready</p>
                                    <p className="text-sm">This node automatically exports pipeline results. No configuration needed.</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Logs panel overlay if logs exist */}
            {executionLogs.length > 0 && (
                <div className="absolute right-6 bottom-6 w-96 bg-slate-900 text-slate-100 rounded-2xl shadow-2xl z-50" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                    {/* Log header */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 shrink-0">
                        <h3 className="text-sm font-bold flex items-center gap-2">
                            <CheckCircle size={14} className="text-emerald-400" /> Execution Complete
                        </h3>
                        <button onClick={() => setLogsExpanded(v => !v)} className="text-slate-400 hover:text-white p-1 rounded">
                            {logsExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                        </button>
                    </div>

                    {logsExpanded && (
                        <div className="space-y-2 font-mono text-xs max-h-40 overflow-y-auto px-5 py-3 shrink-0">
                            {executionLogs.map((log, idx) => (
                                <div key={idx} className="flex flex-col">
                                    <span className={log.status === 'success' ? 'text-emerald-400' : 'text-red-400'}>
                                        [{log.type.toUpperCase()}] {log.status}
                                    </span>
                                    <span className="text-slate-400">{log.message || log.error}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="px-5 py-3 border-t border-slate-800 flex flex-col gap-2 shrink-0">
                        {downloadUrl && (
                            <a href={downloadUrl} target="_blank" rel="noreferrer"
                               className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold py-2 rounded-xl transition-colors text-sm">
                                <Download size={15} /> Download Result
                            </a>
                        )}
                        <button
                            onClick={runVisualizerAnalysis}
                            disabled={vizLoading}
                            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-bold py-2 rounded-xl transition-colors text-sm"
                        >
                            {vizLoading
                                ? <><RefreshCw size={14} className="animate-spin" /> Analyzing…</>
                                : <><BarChart3 size={14} /> Visualize Output</>}
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* ── AI Visualizer Results Panel (slides up below canvas) ── */}
      <AnimatePresence>
        {showViz && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="shrink-0 border-t border-slate-200 bg-slate-50 overflow-hidden"
          >
            <div className="p-6">
              {/* Panel header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-200">
                    <BarChart3 size={18} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-800 leading-tight">AI Visualizer — Pipeline Output</h2>
                    <p className="text-xs text-slate-400 font-medium">Auto-generated charts from pipeline result dataset</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowViz(false); setVizAnalysis(null); }}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Loading */}
              {vizLoading && (
                <div className="flex items-center justify-center py-16 gap-3 text-violet-600">
                  <RefreshCw size={22} className="animate-spin" />
                  <span className="font-bold text-sm">AI is analyzing the pipeline output…</span>
                </div>
              )}

              {/* Error */}
              {vizError && !vizLoading && (
                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                  <AlertCircle size={16} /> {vizError}
                </div>
              )}

              {/* Results */}
              {vizAnalysis && !vizLoading && (
                <>
                  {/* KPI tiles */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {vizAnalysis.kpis?.map((kpi, i) => (
                      <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: kpi.color + '18' }}>
                          <BarChart3 size={18} style={{ color: kpi.color }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xl font-black text-slate-900 leading-none truncate">{kpi.value}</p>
                          <p className="text-xs text-slate-400 font-semibold mt-0.5">{kpi.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Chart grid */}
                  {vizAnalysis.charts?.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {vizAnalysis.charts.map((chart, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.06 }}
                          className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                        >
                          <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${(GRADIENT_PAIRS[i % GRADIENT_PAIRS.length])[0]}, ${(GRADIENT_PAIRS[i % GRADIENT_PAIRS.length])[1]})` }} />
                          <div className="p-4 pb-1">
                            <p className="text-sm font-black text-slate-800 truncate">{chart.title}</p>
                            <p className="text-xs text-slate-400 truncate">{chart.description}</p>
                          </div>
                          <div className="px-2 pb-4">
                            {renderVizChart(chart, i)}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <BarChart3 size={28} className="text-slate-300 mb-2" />
                      <p className="text-slate-500 font-bold text-sm">No charts could be generated from this dataset.</p>
                      <p className="text-slate-400 text-xs mt-1">Try a dataset with mixed numeric and categorical columns.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Inline helper for Data Cleaning Panel
const CleanerConfigPanel = ({ node, columns = [], onSave }) => {
    const [rules, setRules] = useState(node.data.rules || []);

    useEffect(() => {
        setRules(node.data.rules || []);
    }, [node]);

    const addRule = () => {
        setRules([...rules, { id: Date.now(), column: '', operation: 'trim_whitespace', params: {} }]);
    };

    const updateRule = (id, field, value) => {
        setRules(rules.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const updateParam = (id, paramKey, paramVal) => {
        setRules(rules.map(r => r.id === id ? { ...r, params: { ...r.params, [paramKey]: paramVal } } : r));
    };

    const removeRule = (id) => setRules(rules.filter(r => r.id !== id));

    return (
        <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl border border-slate-100 py-6 px-4">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-slate-800">Cleaning Operations</h3>
                <button onClick={addRule} className="flex items-center gap-1 text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors">
                    <Plus size={14} /> Add Op
                </button>
            </div>
            <div className="space-y-4 mb-8">
                {rules.length === 0 && <p className="text-center text-sm text-slate-400 italic">No cleaning rules. Add one!</p>}
                {rules.map(r => (
                    <div key={r.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative">
                        <button onClick={() => removeRule(r.id)} className="absolute top-2 right-2 text-red-500 hover:bg-red-100 p-1.5 rounded-md">
                            <Trash2 size={16} />
                        </button>
                        
                        <div className="space-y-3 mt-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Column Name</label>
                                {columns.length > 0 ? (
                                    <select
                                        className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none focus:border-emerald-500"
                                        value={r.column}
                                        onChange={e => updateRule(r.id, 'column', e.target.value)}
                                    >
                                        <option value="">Select column...</option>
                                        {columns.map((column) => (
                                            <option key={column} value={column}>{column}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input type="text" className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none focus:border-emerald-500" placeholder="e.g. email" value={r.column} onChange={e => updateRule(r.id, 'column', e.target.value)} />
                                )}
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Operation</label>
                                <select className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none focus:border-emerald-500" value={r.operation} onChange={e => { const val = e.target.value; setRules(prev => prev.map(rule => rule.id === r.id ? { ...rule, operation: val, params: {} } : rule)); }}>
                                    <option value="trim_whitespace">Trim Whitespace</option>
                                    <option value="uppercase">Uppercase</option>
                                    <option value="lowercase">Lowercase</option>
                                    <option value="fill_nulls">Fill Empty/Null Cells</option>
                                    <option value="replace_value">Replace Custom Value</option>
                                </select>
                            </div>
                            
                            {/* Parameters dependent on operation */}
                            {r.operation === 'fill_nulls' && (
                                <input type="text" className="w-full text-sm p-2 border border-slate-200 rounded-lg" placeholder="Replace nulls with..." value={r.params.custom_value || ''} onChange={e => updateParam(r.id, 'custom_value', e.target.value)} />
                            )}
                            
                            {r.operation === 'replace_value' && (
                                <div className="space-y-2">
                                    <input type="text" className="w-full text-sm p-2 border border-slate-200 rounded-lg" placeholder="Target text to replace" value={r.params.target_value || ''} onChange={e => updateParam(r.id, 'target_value', e.target.value)} />
                                    <input type="text" className="w-full text-sm p-2 border border-slate-200 rounded-lg" placeholder="Replace with..." value={r.params.replacement_value || ''} onChange={e => updateParam(r.id, 'replacement_value', e.target.value)} />
                                    <select className="w-full text-sm p-2 border border-slate-200 rounded-lg" value={r.params.match_type || 'whole'} onChange={e => updateParam(r.id, 'match_type', e.target.value)}>
                                        <option value="whole">Exact Match Only (Cell)</option>
                                        <option value="partial">Partial Match (Contains)</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="mt-auto pt-4 border-t border-slate-200 flex justify-end">
                <button onClick={() => onSave(rules)} className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-transform hover:-translate-y-0.5">
                    Save Operations
                </button>
            </div>
        </div>
    )
}

const MapperConfigPanel = ({ node, columns = [], onSave }) => {
    const [targetSchema, setTargetSchema] = useState(node.data.targetSchema || '');
    const [mappings, setMappings] = useState(node.data.mappings || {});

    useEffect(() => {
        setTargetSchema(node.data.targetSchema || '');
        setMappings(node.data.mappings || {});
    }, [node]);

    const targetColumns = targetSchema.split('\n').map(col => col.trim()).filter(Boolean);

    const autoMap = () => {
        const nextMappings = {};
        columns.forEach((sourceCol) => {
            const match = targetColumns.find((targetCol) => (
                sourceCol.toLowerCase().includes(targetCol.toLowerCase()) ||
                targetCol.toLowerCase().includes(sourceCol.toLowerCase())
            ));
            if (match) nextMappings[sourceCol] = match;
        });
        setMappings(nextMappings);
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl border border-slate-100 py-6 px-4">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg text-slate-800">Schema Mapping</h3>
                <button onClick={autoMap} className="text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                    Auto-Map
                </button>
            </div>

            <label className="text-xs font-bold text-slate-500 uppercase mb-2">Target Schema</label>
            <textarea
                rows={5}
                className="w-full text-sm p-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                placeholder="customer_name&#10;customer_email&#10;signup_date"
                value={targetSchema}
                onChange={(e) => setTargetSchema(e.target.value)}
            />

            <div className="mt-6 space-y-3">
                <h4 className="text-sm font-bold text-slate-700">Source to Target Mapping</h4>
                {columns.length === 0 && (
                    <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        Upload a dataset first to map detected source columns.
                    </p>
                )}
                {columns.map((sourceCol) => (
                    <div key={sourceCol} className="grid grid-cols-[1fr_1fr] gap-3 items-center">
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700">
                            {sourceCol}
                        </div>
                        <select
                            className="w-full text-sm p-2.5 border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
                            value={mappings[sourceCol] || ''}
                            onChange={(e) => setMappings((prev) => ({ ...prev, [sourceCol]: e.target.value }))}
                        >
                            <option value="">Select target...</option>
                            {targetColumns.map((targetCol) => (
                                <option key={targetCol} value={targetCol}>{targetCol}</option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>

            <div className="mt-auto pt-4 border-t border-slate-200 flex justify-end">
                <button onClick={() => onSave({ targetSchema, mappings })} className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-transform hover:-translate-y-0.5">
                    Save Mapping
                </button>
            </div>
        </div>
    );
};

const MatchingConfigPanel = ({ node, columns = [], onSave }) => {
    const [matchRules, setMatchRules] = useState(node.data.matchRules || [
        { id: Date.now(), column1: '', column2: '', algorithm: 'fuzzy', threshold: 0.8 }
    ]);

    useEffect(() => {
        setMatchRules(node.data.matchRules || [
            { id: Date.now(), column1: '', column2: '', algorithm: 'fuzzy', threshold: 0.8 }
        ]);
    }, [node]);

    const addRule = () => {
        setMatchRules((prev) => [...prev, { id: Date.now(), column1: '', column2: '', algorithm: 'fuzzy', threshold: 0.8 }]);
    };

    const updateRule = (id, field, value) => {
        setMatchRules((prev) => prev.map((rule) => rule.id === id ? { ...rule, [field]: value } : rule));
    };

    const removeRule = (id) => {
        setMatchRules((prev) => prev.filter((rule) => rule.id !== id));
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl border border-slate-100 py-6 px-4">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="font-bold text-lg text-slate-800">Data Matching</h3>
                    <p className="text-sm text-slate-500">Configure duplicate or similarity rules on pipeline columns.</p>
                </div>
                <button onClick={addRule} className="text-xs font-bold bg-purple-50 text-purple-700 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors">
                    <Plus size={14} className="inline mr-1" /> Rule
                </button>
            </div>

            <div className="space-y-4 mb-8">
                {matchRules.map((rule) => (
                    <div key={rule.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative">
                        {matchRules.length > 1 && (
                            <button onClick={() => removeRule(rule.id)} className="absolute top-2 right-2 text-red-500 hover:bg-red-100 p-1.5 rounded-md">
                                <Trash2 size={16} />
                            </button>
                        )}
                        <div className="space-y-3 mt-4">
                            <div className="grid grid-cols-2 gap-3">
                                <select
                                    className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none focus:border-purple-500"
                                    value={rule.column1}
                                    onChange={(e) => updateRule(rule.id, 'column1', e.target.value)}
                                >
                                    <option value="">Column 1...</option>
                                    {columns.map((column) => <option key={column} value={column}>{column}</option>)}
                                </select>
                                <select
                                    className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none focus:border-purple-500"
                                    value={rule.column2}
                                    onChange={(e) => updateRule(rule.id, 'column2', e.target.value)}
                                >
                                    <option value="">Column 2...</option>
                                    {columns.map((column) => <option key={column} value={column}>{column}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                                <select
                                    className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none focus:border-purple-500"
                                    value={rule.algorithm}
                                    onChange={(e) => updateRule(rule.id, 'algorithm', e.target.value)}
                                >
                                    {MATCHING_ALGORITHMS.map((algorithm) => (
                                        <option key={algorithm.id} value={algorithm.id}>{algorithm.name}</option>
                                    ))}
                                </select>
                                <div className="text-xs font-bold text-slate-500">
                                    {(Number(rule.threshold || 0) * 100).toFixed(0)}%
                                </div>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                className="w-full accent-purple-600"
                                value={rule.threshold}
                                onChange={(e) => updateRule(rule.id, 'threshold', Number(e.target.value))}
                            />
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-auto pt-4 border-t border-slate-200 flex justify-end">
                <button onClick={() => onSave({ matchRules })} className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-transform hover:-translate-y-0.5">
                    Save Matching Rules
                </button>
            </div>
        </div>
    );
};

const ScraperConfigPanel = ({ node, onSave }) => {
    const [template, setTemplate] = useState(node.data.template || '');
    const [url, setUrl] = useState(node.data.url || '');
    const [urlsText, setUrlsText] = useState((node.data.urls || []).join('\n'));

    useEffect(() => {
        setTemplate(node.data.template || '');
        setUrl(node.data.url || '');
        setUrlsText((node.data.urls || []).join('\n'));
    }, [node]);

    return (
        <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl border border-slate-100 py-6 px-4">
            <h3 className="font-bold text-lg text-slate-800 mb-6">Web Scraping Source</h3>

            <label className="text-xs font-bold text-slate-500 uppercase mb-2">Template</label>
            <select
                className="w-full text-sm p-2.5 border border-slate-200 rounded-lg outline-none focus:border-orange-500"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
            >
                <option value="">Select template...</option>
                {SCRAPER_TEMPLATES.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                ))}
            </select>

            <label className="text-xs font-bold text-slate-500 uppercase mt-5 mb-2">Preview URL</label>
            <input
                type="url"
                className="w-full text-sm p-2.5 border border-slate-200 rounded-lg outline-none focus:border-orange-500"
                placeholder="https://example.com/page"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
            />

            <label className="text-xs font-bold text-slate-500 uppercase mt-5 mb-2">URLs To Scrape</label>
            <textarea
                rows={6}
                className="w-full text-sm p-3 border border-slate-200 rounded-xl outline-none focus:border-orange-500"
                placeholder="https://example.com/page-1&#10;https://example.com/page-2"
                value={urlsText}
                onChange={(e) => setUrlsText(e.target.value)}
            />

            <div className="mt-auto pt-4 border-t border-slate-200 flex justify-end">
                <button
                    onClick={() => onSave({
                        template,
                        url,
                        urls: urlsText.split('\n').map((item) => item.trim()).filter(Boolean)
                    })}
                    className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-transform hover:-translate-y-0.5"
                >
                    Save Scraper Source
                </button>
            </div>
        </div>
    );
};
