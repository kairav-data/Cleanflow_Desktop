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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Database, Sparkles, ShieldCheck, Download, Play, CheckCircle, X, Plus, Trash2, AlertCircle, Globe, GitMerge, Shuffle } from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

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
      {/* Source / Target handles */}
      <Handle type="target" position={Position.Left}  style={{ background: borderColor, width: 10, height: 10 }} />
      <Handle type="source" position={Position.Right} style={{ background: borderColor, width: 10, height: 10 }} />

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
    <div className="flex flex-col h-full w-full relative bg-white overflow-hidden">
      
      {/* Top Header */}
      <div className="h-16 shrink-0 border-b border-slate-200 bg-slate-50 flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-800">Pipeline Orchestrator</h1>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">Beta</span>
          </div>
          <button 
              onClick={handleRunPipeline}
              disabled={isExecuting || nodes.length === 0}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white shadow-lg transition-all ${isExecuting ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-0.5 shadow-emerald-500/30'}`}
          >
              <Play size={18} /> {isExecuting ? 'Running...' : 'Run Pipeline'}
          </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Toolbar / Node Palette */}
        <aside className="w-64 border-r border-slate-200 bg-white p-4 flex flex-col gap-6 overflow-y-auto z-10 shrink-0">
          <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Input Sources</h3>
              <div 
                  className="flex items-center gap-3 p-3 mb-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-700 cursor-grab hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
                  onDragStart={(e) => onDragStart(e, 'dataset')} draggable
              >
                  <Database size={18} className="text-slate-400" /> <span className="text-sm font-bold">Dataset Input</span>
              </div>
              <div 
                  className="flex items-center gap-3 p-3 mb-2 rounded-xl border border-slate-200 shadow-sm cursor-grab hover:border-emerald-500 hover:shadow-md transition-all"
                  onDragStart={(e) => onDragStart(e, 'scraper')} draggable
              >
                  <Globe size={18} className="text-orange-500" /> <span className="text-sm font-bold text-slate-700">Web Scraping</span>
              </div>
          </div>

          <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Transformations</h3>
              <div 
                  className="flex items-center gap-3 p-3 mb-2 rounded-xl border border-slate-200 shadow-sm cursor-grab hover:border-emerald-500 hover:shadow-md transition-all"
                  onDragStart={(e) => onDragStart(e, 'cleaner')} draggable
              >
                  <Sparkles size={18} className="text-emerald-500" /> <span className="text-sm font-bold text-slate-700">Data Cleaner</span>
              </div>
              <div 
                  className="flex items-center gap-3 p-3 mb-2 rounded-xl border border-slate-200 shadow-sm cursor-grab hover:border-emerald-500 hover:shadow-md transition-all"
                  onDragStart={(e) => onDragStart(e, 'validation')} draggable
              >
                  <ShieldCheck size={18} className="text-blue-500" /> <span className="text-sm font-bold text-slate-700">Quality Validation</span>
              </div>
              <div 
                  className="flex items-center gap-3 p-3 mb-2 rounded-xl border border-slate-200 shadow-sm cursor-grab hover:border-emerald-500 hover:shadow-md transition-all"
                  onDragStart={(e) => onDragStart(e, 'mapper')} draggable
              >
                  <GitMerge size={18} className="text-indigo-500" /> <span className="text-sm font-bold text-slate-700">Schema Mapping</span>
              </div>
              <div 
                  className="flex items-center gap-3 p-3 mb-2 rounded-xl border border-slate-200 shadow-sm cursor-grab hover:border-emerald-500 hover:shadow-md transition-all"
                  onDragStart={(e) => onDragStart(e, 'matching')} draggable
              >
                  <Shuffle size={18} className="text-purple-500" /> <span className="text-sm font-bold text-slate-700">Data Matching</span>
              </div>
          </div>

          <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Outputs</h3>
              <div 
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 shadow-sm cursor-grab hover:border-emerald-500 hover:shadow-md transition-all bg-slate-900 text-white"
                  onDragStart={(e) => onDragStart(e, 'export')} draggable
              >
                  <Download size={18} className="text-emerald-400" /> <span className="text-sm font-bold">File Export</span>
              </div>
          </div>

        </aside>

        {/* Center Canvas */}
        <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
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
                fitView
                >
                <Controls />
                <Background variant="dots" gap={20} size={1.5} color="#cbd5e1" />
                </ReactFlow>
            </ReactFlowProvider>

            {/* Right Side Configuration Panel */}
            <AnimatePresence>
                {activeNode && (
                    <motion.div 
                        initial={{ x: '100%', opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '100%', opacity: 0 }}
                        className="absolute right-0 top-0 h-full w-[500px] max-w-full bg-white shadow-2xl border-l border-slate-200 z-40 flex flex-col"
                    >
                        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 shrink-0 bg-slate-50">
                            <h2 className="text-lg font-bold text-slate-800">
                                Configure: {activeNode.data.label}
                            </h2>
                            <button onClick={() => setActiveNode(null)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
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
                <div className="absolute right-6 bottom-6 w-80 bg-slate-900 text-slate-100 p-5 rounded-2xl shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4">
                    <h3 className="text-sm font-bold mb-4 flex items-center gap-2 border-b border-slate-800 pb-2">Execution Logs</h3>
                    <div className="space-y-3 font-mono text-xs max-h-60 overflow-y-auto logs-scrollbar pr-2">
                        {executionLogs.map((log, idx) => (
                            <div key={idx} className="flex flex-col">
                                <span className={log.status === 'success' ? 'text-emerald-400' : 'text-red-400'}>
                                    [{log.type.toUpperCase()}] {log.status}
                                </span>
                                <span className="text-slate-400">{log.message || log.error}</span>
                            </div>
                        ))}
                    </div>
                    {downloadUrl && (
                        <a href={downloadUrl} target="_blank" rel="noreferrer" className="mt-4 w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold py-2 rounded-lg transition-colors">
                            <Download size={16} /> Download Result Here
                        </a>
                    )}
                </div>
            )}
        </div>
      </div>
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
