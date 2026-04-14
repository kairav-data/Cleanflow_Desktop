import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
import { Database, Sparkles, ShieldCheck, Download, Play, CheckCircle, X, Plus, Trash2, AlertCircle, Globe, GitMerge, Shuffle, BarChart3, Activity, TrendingUp, PieChart as PieIcon, RefreshCw, ChevronDown, ChevronUp, Zap, Settings, Filter, Calculator, Link, Files, Repeat, GitBranch, Mail, Webhook, Save, FolderOpen, Clock, CalendarDays } from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

// Component Imports
import { DataConnection, RuleBuilder } from '../components';
import DataVisualizer from './DataVisualizer';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'import.meta.env.VITE_API_URL';
const PIPELINE_RUNS_KEY = 'cleanflow_pipeline_runs_v1';

let id = 0;
const getId = () => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return `node_${globalThis.crypto.randomUUID()}`;
  }
  return `node_${Date.now()}_${id++}`;
};

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
  if (normalized.includes('filter')) return 'filter';
  if (normalized.includes('aggregate')) return 'aggregate';
  if (normalized.includes('join')) return 'join';
  if (normalized.includes('deduplicate')) return 'deduplicate';
  if (normalized.includes('loop')) return 'loop';
  if (normalized.includes('conditional')) return 'conditional';
  if (normalized.includes('email')) return 'email';
  if (normalized.includes('webhook')) return 'webhook';
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
  if (kind === 'filter') return Array.isArray(node.data?.filterRules) && node.data.filterRules.length > 0;
  if (kind === 'aggregate') return !!node.data?.groupByColumn && !!node.data?.aggFunction;
  if (kind === 'join') return !!node.data?.leftKey && !!node.data?.rightKey;
  if (kind === 'deduplicate') return Array.isArray(node.data?.subsetColumns) && node.data.subsetColumns.length > 0;
  if (kind === 'loop') return !!node.data?.chunkSize;
  if (kind === 'conditional') return !!node.data?.conditionExpression;
  if (kind === 'email') return !!node.data?.toEmail;
  if (kind === 'webhook') return !!node.data?.webhookUrl;
  
  if (kind === 'export') return true;
  return false;
};

// ─── Custom Node Component ───────────────────────────────────────────────────
const PipelineNode = ({ id: nodeId, data, selected }) => {
  const configured = isNodeConfigured({ id: nodeId, data });
  const kind = getNodeKind(data.label || '');

  const iconMap = {
      dataset: <Database size={15} />, scraper: <Globe size={15} />, cleaner: <Sparkles size={15} />,
      validation: <ShieldCheck size={15} />, mapper: <GitMerge size={15} />, matching: <Shuffle size={15} />,
      filter: <Filter size={15} />, aggregate: <Calculator size={15} />, join: <Link size={15} />,
      deduplicate: <Files size={15} />, loop: <Repeat size={15} />, conditional: <GitBranch size={15} />,
      email: <Mail size={15} />, webhook: <Webhook size={15} />, export: <Download size={15} />
  };
  const icon = iconMap[kind] || iconMap.export;

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
  const [outputSessionId, setOutputSessionId] = useState(null);
  const [activeNode, setActiveNode] = useState(null);
  const [pipelineColumns, setPipelineColumns] = useState([]);  // columns from uploaded dataset
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionLogs, setExecutionLogs] = useState([]);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [logsExpanded, setLogsExpanded] = useState(true);

  // Backend state for Pipeline Saving/Scheduling
  const [pipelineName, setPipelineName] = useState('Untitled Pipeline');
  const [pipelineId, setPipelineId] = useState(null);
  const [showLoadDrawer, setShowLoadDrawer] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [savedPipelines, setSavedPipelines] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // AI Visualizer overlay state
  const [showViz, setShowViz] = useState(false);
  const [showVisualizerOverlay, setShowVisualizerOverlay] = useState(false);
  const [outputFilename, setOutputFilename] = useState('');
  const [outputRowCount, setOutputRowCount] = useState(0);
  const [vizAnalysis, setVizAnalysis] = useState(null);
  const [vizError] = useState('');
  const vizLoading = false;
  const GRADIENT_PAIRS = [['#6366f1','#818cf8']];
  const renderVizChart = () => null;

  const runVisualizerAnalysis = async () => {
    setShowViz(true);
    setShowVisualizerOverlay(true);
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
      if (type === 'filter')     label = 'Filter Rows';
      if (type === 'aggregate')  label = 'Aggregate';
      if (type === 'join')       label = 'Dataset Join';
      if (type === 'deduplicate') label = 'Deduplicate';
      if (type === 'loop')       label = 'Loop';
      if (type === 'conditional') label = 'Conditional Branch';
      if (type === 'email')      label = 'Email Notification';
      if (type === 'webhook')    label = 'Webhook';
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

  const loadSavedPipelines = async () => {
      try {
          const token = localStorage.getItem('token');
          const headers = token ? { Authorization: `Bearer ${token}` } : {};
          const res = await axios.get(`${API_BASE}/pipeline/saved`, { headers });
          setSavedPipelines(res.data || []);
      } catch (err) {
          console.error("Failed to load pipelines", err);
      }
  };

  useEffect(() => {
      loadSavedPipelines();
  }, []);

  const handleSavePipeline = async () => {
      setIsSaving(true);
      try {
          const payload = {
              id: pipelineId,
              name: pipelineName,
              nodes: nodes,
              edges: edges
          };
          const token = localStorage.getItem('token');
          const headers = token ? { Authorization: `Bearer ${token}` } : {};
          const res = await axios.post(`${API_BASE}/pipeline/saved`, payload, { headers });
          if (res.data.id) {
              setPipelineId(res.data.id);
          }
          // Fallback to local storage
          const localSaved = JSON.parse(localStorage.getItem('cleanflow_saved_pipelines_v2') || '[]');
          const idx = localSaved.findIndex(p => p.id === (res.data.id || pipelineId));
          const newEntry = { id: res.data.id || pipelineId || Date.now().toString(), name: pipelineName, nodes, edges, savedAt: new Date().toISOString() };
          if (idx >= 0) localSaved[idx] = newEntry;
          else localSaved.push(newEntry);
          localStorage.setItem('cleanflow_saved_pipelines_v2', JSON.stringify(localSaved));
          
          alert("Pipeline saved successfully!");
          loadSavedPipelines();
      } catch (err) {
          alert('Failed to save pipeline: ' + err.message);
      } finally {
          setIsSaving(false);
      }
  };

  const handleRunPipeline = async () => {
      if (!activeSessionId) {
          alert('Please configure a Dataset Input node first to initialize a session!');
          return;
      }
      
      setIsExecuting(true);
      setExecutionLogs([]);
      setDownloadUrl(null);
      setOutputSessionId(null);
      setOutputFilename('');
      setOutputRowCount(0);
      setShowViz(false);
      setShowVisualizerOverlay(false);
      
      // Serialize nodes to send to backend
      // In a full implementation we would extract node-specific configurations (like rules for Cleaner) from node.data
      const hasExportNode = nodes.some((node) => getNodeKind(node.data.label) === 'export');
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
        const nextOutputSessionId = res.data.output_session_id || null;
        setOutputSessionId(nextOutputSessionId);
        const nextOutputFilename = res.data.output_file
            ? res.data.output_file.split('/').pop().split('\\').pop()
            : `${(pipelineName || 'pipeline-output').trim() || 'pipeline-output'}.xlsx`;
        setOutputFilename(nextOutputFilename);
        setOutputRowCount(res.data.output_row_count || 0);

        if (nextOutputSessionId && hasExportNode) {
            setDownloadUrl(`${API_BASE}/features/export/${nextOutputSessionId}?format=xlsx`);
        } else if (res.data.output_file) {
            const filename = res.data.output_file.split('/').pop().split('\\').pop();
            setDownloadUrl(`${API_BASE}/download/${filename}`);
        }
        setShowViz(false);
        setShowVisualizerOverlay(false);

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
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1 mr-2 hidden md:flex">
                  <input
                      type="text"
                      className="bg-transparent text-sm font-bold text-slate-700 px-3 py-1.5 w-48 outline-none"
                      value={pipelineName}
                      onChange={e => setPipelineName(e.target.value)}
                      placeholder="Name your pipeline..."
                  />
                  <button onClick={handleSavePipeline} disabled={isSaving} className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-200 shadow-sm transition-colors" title="Save Pipeline"><Save size={16} /></button>
                  <button onClick={() => setShowLoadDrawer(true)} className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-500 hover:text-sky-600 hover:border-sky-200 shadow-sm transition-colors" title="Load Pipeline"><FolderOpen size={16} /></button>
                  <button onClick={() => setShowScheduleModal(true)} disabled={!pipelineId} className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 shadow-sm transition-colors disabled:opacity-50" title="Schedule Pipeline (Save first)"><Clock size={16} /></button>
              </div>

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
                  { type: 'matching',   label: 'Data Matching',      icon: Shuffle,     color: '#8b5cf6', bg: '#8b5cf615' },
                  { type: 'filter',     label: 'Filter Rows',        icon: Filter,      color: '#f59e0b', bg: '#f59e0b15' },
                  { type: 'aggregate',  label: 'Aggregate',          icon: Calculator,  color: '#ec4899', bg: '#ec489915' },
                  { type: 'join',       label: 'Dataset Join',       icon: Link,        color: '#14b8a6', bg: '#14b8a615' },
                  { type: 'deduplicate',label: 'Deduplicate',        icon: Files,       color: '#64748b', bg: '#64748b15' },
                  { type: 'loop',       label: 'Loop (Iterator)',    icon: Repeat,      color: '#8b5cf6', bg: '#8b5cf615' },
                  { type: 'conditional',label: 'Conditional Branch', icon: GitBranch,   color: '#06b6d4', bg: '#06b6d415' }]
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

            {/* Notify */}
            <div>
              <p className="text-xs font-black uppercase tracking-widest mb-2 px-1 text-slate-400">Notify</p>
              <div className="space-y-1.5">
                {[{ type: 'email',      label: 'Email Notification', icon: Mail,        color: '#f43f5e', bg: '#f43f5e15' },
                  { type: 'webhook',    label: 'Webhook / HTTP Call',icon: Webhook,     color: '#3b82f6', bg: '#3b82f615' }]
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


            {/* Full-Screen Configuration Modal Portal */}
            {activeNode && createPortal(
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex flex-col pt-20 pb-10 px-4 items-center"
                        style={{ background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)' }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-white rounded-[24px] shadow-2xl flex flex-col overflow-hidden h-full max-h-[800px] w-full max-w-3xl border border-slate-100"
                        >
                            {/* Header */}
                            <div className="h-1.5 w-full shrink-0" style={{ background: 'linear-gradient(90deg,#10b981,#6366f1,#8b5cf6)' }} />
                            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-white shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-slate-50 shadow-sm flex items-center justify-center border border-slate-100">
                                        <Settings size={22} className="text-slate-700" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black text-slate-800">{activeNode.data.label}</h2>
                                        <p className="text-xs text-slate-400 font-medium tracking-wide uppercase mt-0.5">Node Configuration</p>
                                    </div>
                                </div>
                                <button onClick={() => setActiveNode(null)} className="p-2.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            
                            {/* Body */}
                            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                                {/* Validation Configuration */}
                                {activeNode.data.label.toLowerCase().includes('validation') && (
                                    <RuleBuilder 
                                        isEmbedded={true} 
                                        columns={activeNode.data.columns || pipelineColumns} 
                                        initialRules={activeNode.data.rules || []}
                                        onSaveRules={(rules) => {
                                            setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, rules } } : n));
                                            setActiveNode(null);
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
                                            setActiveNode(null);
                                        }} 
                                    />
                                )}

                                {activeNode.data.label.toLowerCase().includes('mapping') && (
                                    <MapperConfigPanel
                                        node={activeNode}
                                        columns={activeNode.data.columns || pipelineColumns}
                                        onSave={(config) => {
                                            setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n));
                                            setActiveNode(null);
                                        }}
                                    />
                                )}

                                {activeNode.data.label.toLowerCase().includes('matching') && (
                                    <MatchingConfigPanel
                                        node={activeNode}
                                        columns={activeNode.data.columns || pipelineColumns}
                                        onSave={(config) => {
                                            setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n));
                                            setActiveNode(null);
                                        }}
                                    />
                                )}

                                {activeNode.data.label.toLowerCase().includes('scraping') && (
                                    <ScraperConfigPanel
                                        node={activeNode}
                                        onSave={(config) => {
                                            setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n));
                                            setActiveNode(null);
                                        }}
                                    />
                                )}

                                {activeNode.data.label.toLowerCase().includes('dataset') && (
                                    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-100 py-6 px-4">
                                         <h3 className="font-bold text-lg text-slate-800 mb-6">Import Dataset</h3>
                                         <div className="mt-4">
                                            <DataConnection onUploadSuccess={(uploadData) => {
                                                 setActiveSessionId(uploadData.session_id);
                                                 setOutputSessionId(null);
                                                 setOutputFilename('');
                                                 setOutputRowCount(0);
                                                 setPipelineColumns(uploadData.columns || []);
                                                 setDownloadUrl(null);
                                                 setShowViz(false);
                                                 setShowVisualizerOverlay(false);
                                                 setNodes(nds => nds.map(n => n.id === activeNode.id 
                                                   ? { ...n, data: { ...n.data, sessionId: uploadData.session_id, columns: uploadData.columns || [] } } 
                                                   : n
                                                 ));
                                                 setActiveNode(null);
                                            }} />
                                         </div>
                                    </div>
                                )}

                                {/* NEW NODES START */}
                                {/* Filter Rows */}
                                {activeNode.data.label.toLowerCase().includes('filter') && (
                                    <FilterConfigPanel node={activeNode} columns={activeNode.data.columns || pipelineColumns} onSave={(config) => { setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n)); setActiveNode(null); }} />
                                )}

                                {/* Aggregate */}
                                {activeNode.data.label.toLowerCase().includes('aggregate') && (
                                    <AggregateConfigPanel node={activeNode} columns={activeNode.data.columns || pipelineColumns} onSave={(config) => { setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n)); setActiveNode(null); }} />
                                )}
                                
                                {/* Join */}
                                {activeNode.data.label.toLowerCase().includes('join') && (
                                    <JoinConfigPanel node={activeNode} columns={activeNode.data.columns || pipelineColumns} onSave={(config) => { setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n)); setActiveNode(null); }} />
                                )}

                                {/* Deduplicate */}
                                {activeNode.data.label.toLowerCase().includes('deduplicate') && (
                                    <DeduplicateConfigPanel node={activeNode} columns={activeNode.data.columns || pipelineColumns} onSave={(config) => { setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n)); setActiveNode(null); }} />
                                )}
                                
                                {/* Loop */}
                                {activeNode.data.label.toLowerCase().includes('loop') && (
                                    <LoopConfigPanel node={activeNode} onSave={(config) => { setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n)); setActiveNode(null); }} />
                                )}

                                {/* Conditional */}
                                {activeNode.data.label.toLowerCase().includes('conditional') && (
                                    <ConditionalConfigPanel node={activeNode} columns={activeNode.data.columns || pipelineColumns} onSave={(config) => { setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n)); setActiveNode(null); }} />
                                )}

                                {/* Email */}
                                {activeNode.data.label.toLowerCase().includes('email') && (
                                    <EmailConfigPanel node={activeNode} onSave={(config) => { setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n)); setActiveNode(null); }} />
                                )}

                                {/* Webhook */}
                                {activeNode.data.label.toLowerCase().includes('webhook') && (
                                    <WebhookConfigPanel node={activeNode} onSave={(config) => { setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n)); setActiveNode(null); }} />
                                )}
                                {/* NEW NODES END */}

                                {activeNode.data.label.toLowerCase().includes('export') && (
                                    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm py-16 px-4 text-center items-center justify-center">
                                        <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mb-6">
                                            <Download size={36} className="text-emerald-500" />
                                        </div>
                                        <h3 className="font-black text-2xl text-slate-800">Export Node Ready</h3>
                                        <p className="text-slate-500 mt-2 max-w-sm">This node handles automatic file export after the pipeline successfully runs. No further configuration is needed here.</p>
                                        <button onClick={() => setActiveNode(null)} className="mt-8 px-6 py-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-transform hover:-translate-y-0.5">
                                            Awesome, Looks Good
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>,
                document.body
            )}

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
                            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-2 rounded-xl transition-colors text-sm"
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
            className="shrink-0 max-h-[72vh] border-t border-slate-200 bg-slate-50 overflow-hidden"
          >
            <div className="max-h-[72vh] overflow-y-auto overscroll-contain p-6">
              {/* Panel header */}
              <div className="sticky top-0 z-10 -mx-6 mb-5 flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 pb-4 pt-1">
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

      {(showVisualizerOverlay || showViz) && createPortal(
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[70] bg-slate-950/45 p-3 backdrop-blur-sm md:p-5"
            onClick={() => { setShowVisualizerOverlay(false); setShowViz(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="mx-auto h-full w-full max-w-[1600px] overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-2xl shadow-slate-900/25"
              onClick={(event) => event.stopPropagation()}
            >
              {outputSessionId ? (
                <DataVisualizer
                  initialSessionId={outputSessionId}
                  initialFilename={outputFilename}
                  initialRowCount={outputRowCount}
                  onClose={() => { setShowVisualizerOverlay(false); setShowViz(false); }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-50 p-6">
                  <div className="w-full max-w-2xl rounded-[28px] border border-slate-100 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-200">
                      <AlertCircle size={26} className="text-white" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900">Pipeline output is not ready</h2>
                    <p className="mt-2 text-sm font-medium text-slate-400">
                      We could not find a generated output session for this run, so the full visualizer cannot open yet.
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-400">
                      Run the pipeline again. If this still happens, restart the backend so the latest pipeline output session changes are active.
                    </p>
                    <div className="mt-6 flex items-center justify-center gap-3">
                      <button
                        onClick={() => { setShowVisualizerOverlay(false); setShowViz(false); }}
                        className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-500 transition-all hover:bg-slate-50"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>,
          document.body
        )}

      {/* Load Pipeline Drawer */}
      <AnimatePresence>
        {showLoadDrawer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex" style={{ background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)' }}>
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="ml-auto w-96 bg-white h-full shadow-2xl flex flex-col border-l border-slate-100">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-3">
                        <FolderOpen className="text-sky-500" size={20} />
                        <div>
                            <h3 className="font-black text-slate-800">Saved Pipelines</h3>
                            <p className="text-xs text-slate-400">Load or restore your work</p>
                        </div>
                    </div>
                    <button onClick={() => setShowLoadDrawer(false)} className="p-2 rounded-xl hover:bg-slate-200 text-slate-400"><X size={18} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {savedPipelines.map(p => (
                        <div key={p.id} className="p-4 border border-slate-200 rounded-xl hover:border-sky-300 hover:shadow-md transition-all cursor-pointer bg-white group" onClick={() => {
                            setNodes(p.nodes || (p.pipeline_data?.nodes || []));
                            setEdges(p.edges || (p.pipeline_data?.edges || []));
                            setPipelineName(p.name);
                            setPipelineId(p.id);
                            setShowLoadDrawer(false);
                        }}>
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-sm text-slate-800 group-hover:text-sky-600 transition-colors">{p.name || 'Untitled'}</h4>
                            </div>
                            <div className="text-xs text-slate-400 space-y-1">
                                <p>ID: <span className="font-mono">{String(p.id).slice(0,8)}...</span></p>
                                <p>Last Updated: {new Date(p.updated_at || p.savedAt).toLocaleString()}</p>
                            </div>
                        </div>
                    ))}
                    {savedPipelines.length === 0 && (
                        <div className="text-center py-10 text-slate-400">
                            <FolderOpen size={32} className="mx-auto mb-3 opacity-50" />
                            <p className="text-sm font-semibold">No saved pipelines found.</p>
                        </div>
                    )}
                </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Schedule Modal */}
      <AnimatePresence>
          {showScheduleModal && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)' }}>
                  <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
                      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <CalendarDays className="text-indigo-500" size={20} />
                              <h3 className="font-black text-slate-800">Schedule Pipeline</h3>
                          </div>
                          <button onClick={() => setShowScheduleModal(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X size={18} /></button>
                      </div>
                      <form className="p-6 space-y-5" onSubmit={async (e) => {
                          e.preventDefault();
                          const fd = new FormData(e.target);
                          const scheduleData = {
                              is_active: true,
                              frequency: fd.get('frequency'),
                              run_time: fd.get('run_time'),
                              timezone: fd.get('timezone') || 'UTC'
                          };
                          try {
                              const token = localStorage.getItem('token');
                              const headers = token ? { Authorization: `Bearer ${token}` } : {};
                              await axios.post(`${API_BASE}/pipeline/saved/${pipelineId}/schedules`, scheduleData, { headers });
                              alert("Schedule saved successfully!");
                              setShowScheduleModal(false);
                          } catch (err) {
                              alert("Failed to save schedule: " + (err.response?.data?.detail || err.message));
                          }
                      }}>
                          <div className="px-3 py-2 bg-indigo-50 text-indigo-700 text-xs rounded-lg mb-4">
                              <strong>Note:</strong> Scheduling relies on an active cron execution backend connected to this target API.
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Frequency</label>
                              <select name="frequency" className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white" required defaultValue="daily">
                                  <option value="hourly">Hourly</option>
                                  <option value="daily">Daily</option>
                                  <option value="weekly">Weekly</option>
                                  <option value="monthly">Monthly</option>
                              </select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Run Time</label>
                                  <input type="time" name="run_time" className="w-full p-2 border border-slate-200 rounded-lg text-sm" required defaultValue="00:00" />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Timezone</label>
                                  <select name="timezone" className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white" defaultValue="UTC">
                                      <option value="UTC">UTC</option>
                                      <option value="America/New_York">EST</option>
                                      <option value="America/Los_Angeles">PST</option>
                                      <option value="Europe/London">GMT</option>
                                      <option value="Asia/Tokyo">JST</option>
                                      <option value="Asia/Kolkata">IST</option>
                                  </select>
                              </div>
                          </div>
                          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 mt-4">
                              <button type="button" onClick={() => setShowScheduleModal(false)} className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-semibold text-sm transition-colors">Cancel</button>
                              <button type="submit" className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-md transition-colors">Save Schedule</button>
                          </div>
                      </form>
                  </motion.div>
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

// --- NEW CONFIG PANELS ---

const FilterConfigPanel = ({ node, columns = [], onSave }) => {
    const [filterRules, setFilterRules] = useState(node.data.filterRules || [{ column: '', condition: 'equals', value: '' }]);

    const updateFilterParams = (index, field, val) => {
        const newRules = [...filterRules];
        newRules[index][field] = val;
        setFilterRules(newRules);
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl border border-slate-100 py-6 px-4">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg text-slate-800">Filter Rows</h3>
                <button onClick={() => setFilterRules([...filterRules, { column: '', condition: 'equals', value: '' }])} className="text-xs font-bold bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-100">
                    + Add Condition
                </button>
            </div>
            <div className="space-y-4 mb-6">
                {filterRules.map((r, i) => (
                    <div key={i} className="flex gap-2 relative">
                        <select className="flex-1 text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none" value={r.column} onChange={e => updateFilterParams(i, 'column', e.target.value)}>
                            <option value="">Column...</option>
                            {columns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select className="flex-1 text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none" value={r.condition} onChange={e => updateFilterParams(i, 'condition', e.target.value)}>
                            <option value="equals">Equals</option>
                            <option value="not_equals">Does Not Equal</option>
                            <option value="contains">Contains</option>
                            <option value="greater_than">Greater Than</option>
                            <option value="less_than">Less Than</option>
                            <option value="is_null">Is Null</option>
                        </select>
                        {r.condition !== 'is_null' && <input type="text" className="flex-1 text-sm p-2 border border-slate-200 rounded-lg outline-none" placeholder="Value" value={r.value} onChange={e => updateFilterParams(i, 'value', e.target.value)} />}
                        {filterRules.length > 1 && (
                            <button onClick={() => setFilterRules(filterRules.filter((_, idx) => idx !== i))} className="absolute -left-6 top-2 text-slate-300 hover:text-red-500">
                                <X size={16} />
                            </button>
                        )}
                    </div>
                ))}
            </div>
            <div className="mt-auto pt-4 border-t border-slate-200 flex justify-end">
                <button onClick={() => onSave({ filterRules })} className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-transform hover:-translate-y-0.5">Save Filter Rules</button>
            </div>
        </div>
    );
};

const AggregateConfigPanel = ({ node, columns = [], onSave }) => {
    const [groupByColumn, setGroupByColumn] = useState(node.data.groupByColumn || '');
    const [aggFunction, setAggFunction] = useState(node.data.aggFunction || 'sum');
    const [targetColumn, setTargetColumn] = useState(node.data.targetColumn || '');

    return (
        <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl border border-slate-100 py-6 px-4">
            <h3 className="font-bold text-lg text-slate-800 mb-6">Aggregate / Group-By</h3>
            <div className="space-y-4 mb-6">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Group By Column</label>
                    <select className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none" value={groupByColumn} onChange={e => setGroupByColumn(e.target.value)}>
                        <option value="">Select column...</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="flex gap-4">
                    <div className="w-1/2">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Function</label>
                        <select className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none" value={aggFunction} onChange={e => setAggFunction(e.target.value)}>
                            <option value="sum">SUM</option>
                            <option value="avg">AVG</option>
                            <option value="min">MIN</option>
                            <option value="max">MAX</option>
                            <option value="count">COUNT</option>
                        </select>
                    </div>
                    <div className="w-1/2">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Target Variable</label>
                        <select className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none" value={targetColumn} onChange={e => setTargetColumn(e.target.value)}>
                            <option value="">Select column...</option>
                            {columns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>
            </div>
            <div className="mt-auto pt-4 border-t border-slate-200 flex justify-end">
                <button onClick={() => onSave({ groupByColumn, aggFunction, targetColumn })} className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-transform hover:-translate-y-0.5">Save Aggregation</button>
            </div>
        </div>
    );
};

const JoinConfigPanel = ({ node, columns = [], onSave }) => {
    const [leftKey, setLeftKey] = useState(node.data.leftKey || '');
    const [rightKey, setRightKey] = useState(node.data.rightKey || '');
    const [joinType, setJoinType] = useState(node.data.joinType || 'inner');
    return (
        <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl border border-slate-100 py-6 px-4">
            <h3 className="font-bold text-lg text-slate-800 mb-6">Dataset Join</h3>
            <div className="space-y-5 mb-6">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Join Type</label>
                    <select className="w-full text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none" value={joinType} onChange={e => setJoinType(e.target.value)}>
                        <option value="inner">Inner Join</option>
                        <option value="left">Left Join</option>
                        <option value="right">Right Join</option>
                        <option value="outer">Full Outer Join</option>
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-5">
                    <div>
                        <label className="block text-xs font-bold text-emerald-600 uppercase mb-2">Left Key (This Dataset)</label>
                        <select className="w-full text-sm p-2.5 bg-emerald-50 border border-emerald-200/50 rounded-lg outline-none" value={leftKey} onChange={e => setLeftKey(e.target.value)}>
                            <option value="">Source branch...</option>
                            {columns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-indigo-600 uppercase mb-2">Right Key (Merging Dataset)</label>
                        <input type="text" className="w-full text-sm p-2.5 bg-indigo-50 border border-indigo-200/50 rounded-lg outline-none placeholder:text-indigo-300" placeholder="e.g. customer_id..." value={rightKey} onChange={e => setRightKey(e.target.value)} />
                    </div>
                </div>
            </div>
            <div className="mt-auto pt-4 border-t border-slate-200 flex justify-end">
                <button onClick={() => onSave({ leftKey, rightKey, joinType })} className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-transform hover:-translate-y-0.5">Save Join Config</button>
            </div>
        </div>
    );
};

const DeduplicateConfigPanel = ({ node, columns = [], onSave }) => {
    const [subsetColumns, setSubsetColumns] = useState(node.data.subsetColumns || []);
    
    return (
        <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl border border-slate-100 py-6 px-4">
            <h3 className="font-bold text-lg text-slate-800 mb-6">Deduplicate Rows</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">Select columns to determine uniqueness. If multiple columns are selected, a row is considered a duplicate if all selected columns match.</p>
            <div className="space-y-4 mb-6">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Uniqueness Subset</label>
                    <select multiple className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl h-48 outline-none" value={subsetColumns} onChange={e => setSubsetColumns(Array.from(e.target.selectedOptions, option => option.value))}>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <p className="text-xs text-slate-400 mt-2 font-medium">Hold CMD/Ctrl to select multiple fields.</p>
                </div>
            </div>
            <div className="mt-auto pt-4 border-t border-slate-200 flex justify-end">
                <button onClick={() => onSave({ subsetColumns })} className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-transform hover:-translate-y-0.5">Save Configuration</button>
            </div>
        </div>
    );
};

const LoopConfigPanel = ({ node, onSave }) => {
    const [chunkSize, setChunkSize] = useState(node.data.chunkSize || 100);
    return (
        <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl border border-slate-100 py-6 px-4">
            <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2"><Repeat size={20} className="text-purple-500" /> Loop (Iterator)</h3>
            <div className="space-y-4 mb-6 border border-slate-200 rounded-xl p-5 bg-slate-50">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Chunk Processing Size</label>
                    <input type="number" className="w-full text-sm p-2.5 border border-slate-200 rounded-lg outline-none text-slate-700 font-medium bg-white" value={chunkSize} onChange={e => setChunkSize(e.target.value)} min={1} />
                </div>
                <p className="text-xs text-slate-500 mt-2">Pipeline nodes linked after this iterator will be executed in batches of {chunkSize} rows.</p>
            </div>
            <div className="mt-auto pt-4 border-t border-slate-200 flex justify-end">
                <button onClick={() => onSave({ chunkSize })} className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-transform hover:-translate-y-0.5">Save Iterator</button>
            </div>
        </div>
    );
};

const ConditionalConfigPanel = ({ node, onSave }) => {
    const [conditionExpression, setConditionExpression] = useState(node.data.conditionExpression || '');
    return (
        <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl border border-slate-100 py-6 px-4">
            <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2"><GitBranch size={20} className="text-cyan-500" /> Conditional Branch</h3>
            <div className="space-y-4 mb-6">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Expression (Python Eval Subset)</label>
                    <textarea rows="3" className="w-full text-sm p-3 border border-slate-200 rounded-xl font-mono text-slate-800 outline-none bg-slate-50 focus:border-cyan-500 transition-colors" placeholder="e.g. df['amount'] > 1000 and df['status'] == 'active'" value={conditionExpression} onChange={e => setConditionExpression(e.target.value)} />
                </div>
                <div className="px-4 py-3 bg-cyan-50 border border-cyan-100 rounded-xl">
                    <p className="text-xs text-cyan-800">Only rows evaluating to TRUE for this expression will pass through to the subsequent nodes. The expression uses a standard pandas syntax evaluation.</p>
                </div>
            </div>
            <div className="mt-auto pt-4 border-t border-slate-200 flex justify-end">
                <button onClick={() => onSave({ conditionExpression })} className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-transform hover:-translate-y-0.5">Save Expression</button>
            </div>
        </div>
    );
};

const EmailConfigPanel = ({ node, onSave }) => {
    const [smtpHost, setSmtpHost] = useState(node.data.smtpHost || '');
    const [toEmail, setToEmail] = useState(node.data.toEmail || '');
    const [emailSubject, setEmailSubject] = useState(node.data.emailSubject || 'Pipeline Alert');
    const [emailBody, setEmailBody] = useState(node.data.emailBody || '');
    
    const insertMacro = (macro) => {
        setEmailBody(prev => prev + macro);
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl border border-slate-100 py-6 px-4">
            <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2"><Mail size={20} className="text-rose-500" /> Email Notification</h3>
            <div className="space-y-5 mb-6 overflow-y-auto pr-2 no-scrollbar">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Email Connection (Pre-configured)</label>
                    <input type="text" className="w-full text-sm p-3 bg-slate-100 border border-slate-200 rounded-xl outline-none text-slate-500 cursor-not-allowed" placeholder="Resend (onboarding.cleanflow.one)" value="Resend (onboarding.cleanflow.one)" disabled />
                    <p className="text-[10px] text-slate-400 mt-1">System automatically sends via @onboarding.cleanflow.one</p>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Recipient Email Address</label>
                    <input type="email" className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-rose-300 transition-colors" placeholder="admin@example.com" value={toEmail} onChange={e => setToEmail(e.target.value)} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Email Subject Line</label>
                    <input type="text" className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-rose-300 transition-colors" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
                </div>
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase">Email Body</label>
                        <div className="flex gap-1.5 flex-wrap">
                            {[ 
                                { label: 'Date', tag: '{{TODAY_DATE}}' }, 
                                { label: 'Status', tag: '{{STATUS}}' }, 
                                { label: 'Rows', tag: '{{ROW_COUNT}}' },
                                { label: 'Pipeline Name', tag: '{{PIPELINE_NAME}}' }
                            ].map(m => (
                                <button key={m.tag} onClick={() => insertMacro(m.tag)} className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-md font-bold transition-colors">
                                    + {m.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <textarea rows="5" className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-rose-300 transition-colors leading-relaxed" placeholder="Write your email message..." value={emailBody} onChange={e => setEmailBody(e.target.value)} />
                    <p className="text-[11px] font-medium text-slate-400 mt-2">Use the buttons above to insert dynamic template variables that populate dynamically on execution.</p>
                </div>
            </div>
            <div className="mt-auto pt-4 border-t border-slate-200 flex justify-end">
                <button onClick={() => onSave({ smtpHost, toEmail, emailSubject, emailBody })} className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-transform hover:-translate-y-0.5">Save Target</button>
            </div>
        </div>
    );
};

const WebhookConfigPanel = ({ node, onSave }) => {
    const [webhookUrl, setWebhookUrl] = useState(node.data.webhookUrl || '');
    const [httpMethod, setHttpMethod] = useState(node.data.httpMethod || 'POST');
    return (
        <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl border border-slate-100 py-6 px-4">
            <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2"><Webhook size={20} className="text-blue-500" /> Webhook Trigger</h3>
            <div className="space-y-5 mb-6">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Target Webhook URL</label>
                    <input type="url" className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400 text-slate-700 font-mono" placeholder="https://api.example.com/v1/event" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">HTTP Method</label>
                    <select className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400" value={httpMethod} onChange={e => setHttpMethod(e.target.value)}>
                        <option value="POST">POST (Payload passed in body)</option>
                        <option value="GET">GET</option>
                        <option value="PUT">PUT</option>
                    </select>
                </div>
            </div>
            <div className="mt-auto pt-4 border-t border-slate-200 flex justify-end">
                <button onClick={() => onSave({ webhookUrl, httpMethod })} className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-transform hover:-translate-y-0.5">Save Target</button>
            </div>
        </div>
    );
};
