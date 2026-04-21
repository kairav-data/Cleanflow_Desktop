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
import { Database, Sparkles, ShieldCheck, Download, Play, CheckCircle, X, Plus, Trash2, AlertCircle, Globe, GitMerge, Shuffle, BarChart3, Activity, TrendingUp, PieChart as PieIcon, RefreshCw, ChevronDown, ChevronUp, Zap, Settings, Filter, Calculator, Link, Files, Repeat, GitBranch, Mail, Webhook, Save, FolderOpen, Clock, CalendarDays, Workflow, ArrowDownUp, ArrowRightLeft, TerminalSquare, ArrowLeftRight } from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

// Component Imports
import { DataConnection, DatasetViewer, RuleBuilder, WorkspaceTabs } from '../components';
import EnrichmentBuilder from './EnrichmentBuilder';
import SchemaMapper from './SchemaMapper';
import DataMatchingBuilder from './DataMatchingBuilder';
import DataVisualizer from './DataVisualizer';
import DataTransformer from './DataTransformer';
import PipelineScriptWorkspace from './PipelineScriptWorkspace';
import {
  SCRIPT_NODE_KIND,
  SCRIPT_NODE_LABEL,
  buildScriptNodeData,
  isScriptConfigured,
} from './scriptTaskConfig';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';
const PIPELINE_RUNS_KEY = 'cleanflow_pipeline_runs_v1';
const getSourceConfigFromResponse = (payload = {}) => payload?.source_config || payload?.sourceConfig || null;
const hasResolvableSource = (nodeData = {}) => Boolean(nodeData?.sessionId || nodeData?.sourceConfig || nodeData?.source_config);

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

const FLOW_LIBRARY_TABS = [
  { id: 'data', label: 'Data Flow', subtitle: 'Share datasets between services' },
  { id: 'sequence', label: 'Sequence Flow', subtitle: 'Define orchestration and actions' },
];

const FLOW_HANDLE_IDS = {
  sequenceIn: 'sequence-in',
  sequenceOut: 'sequence-out',
  dataIn: 'data-in',
  dataOut: 'data-out',
};

const EDGE_KINDS = {
  data: 'data',
  sequence: 'sequence',
};

const PIPELINE_NODE_DEFS = {
  dataset: {
    kind: 'dataset',
    label: 'Dataset Input',
    library: 'data',
    section: 'sources',
    sectionLabel: 'Sources',
    description: 'Start a data stream from an uploaded or connected dataset.',
    icon: Database,
    accent: '#0f766e',
    bg: '#ecfeff',
    libraryBadgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    supportsSequenceIn: false,
    supportsSequenceOut: true,
    supportsDataIn: false,
    supportsDataOut: true,
  },
  scraper: {
    kind: 'scraper',
    label: 'Web Scraping',
    library: 'data',
    section: 'sources',
    sectionLabel: 'Sources',
    description: 'Create a dataset by scraping configured web pages or templates.',
    icon: Globe,
    accent: '#ea580c',
    bg: '#fff7ed',
    libraryBadgeClass: 'border-orange-200 bg-orange-50 text-orange-700',
    supportsSequenceIn: false,
    supportsSequenceOut: true,
    supportsDataIn: false,
    supportsDataOut: true,
  },
  cleaner: {
    kind: 'cleaner',
    label: 'Data Cleaning',
    library: 'data',
    section: 'services',
    sectionLabel: 'Data Services',
    description: 'Apply reusable cleaning operations and pass the refined dataset downstream.',
    icon: Sparkles,
    accent: '#059669',
    bg: '#ecfdf5',
    libraryBadgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    supportsSequenceIn: true,
    supportsSequenceOut: true,
    supportsDataIn: true,
    supportsDataOut: true,
  },
  validation: {
    kind: 'validation',
    label: 'Quality Validation',
    library: 'data',
    section: 'services',
    sectionLabel: 'Data Services',
    description: 'Evaluate data quality rules while keeping the dataset available for the next service.',
    icon: ShieldCheck,
    accent: '#2563eb',
    bg: '#eff6ff',
    libraryBadgeClass: 'border-blue-200 bg-blue-50 text-blue-700',
    supportsSequenceIn: true,
    supportsSequenceOut: true,
    supportsDataIn: true,
    supportsDataOut: true,
  },
  mapper: {
    kind: 'mapper',
    label: 'Schema Mapping',
    library: 'data',
    section: 'services',
    sectionLabel: 'Data Services',
    description: 'Map, rename, and transform columns before handing off the output dataset.',
    icon: GitMerge,
    accent: '#4f46e5',
    bg: '#eef2ff',
    libraryBadgeClass: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    supportsSequenceIn: true,
    supportsSequenceOut: true,
    supportsDataIn: true,
    supportsDataOut: true,
  },
  matching: {
    kind: 'matching',
    label: 'Data Matching',
    library: 'data',
    section: 'services',
    sectionLabel: 'Data Services',
    description: 'Compare records across one or more inputs and emit a matched dataset.',
    icon: Shuffle,
    accent: '#7c3aed',
    bg: '#f5f3ff',
    libraryBadgeClass: 'border-violet-200 bg-violet-50 text-violet-700',
    supportsSequenceIn: true,
    supportsSequenceOut: true,
    supportsDataIn: true,
    supportsDataOut: true,
  },
  filter: {
    kind: 'filter',
    label: 'Filter Rows',
    library: 'data',
    section: 'services',
    sectionLabel: 'Data Services',
    description: 'Keep only rows that match the configured rules.',
    icon: Filter,
    accent: '#d97706',
    bg: '#fffbeb',
    libraryBadgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    supportsSequenceIn: true,
    supportsSequenceOut: true,
    supportsDataIn: true,
    supportsDataOut: true,
  },
  aggregate: {
    kind: 'aggregate',
    label: 'Aggregate',
    library: 'data',
    section: 'services',
    sectionLabel: 'Data Services',
    description: 'Group and summarize incoming rows into a smaller analytic dataset.',
    icon: Calculator,
    accent: '#db2777',
    bg: '#fdf2f8',
    libraryBadgeClass: 'border-pink-200 bg-pink-50 text-pink-700',
    supportsSequenceIn: true,
    supportsSequenceOut: true,
    supportsDataIn: true,
    supportsDataOut: true,
  },
  join: {
    kind: 'join',
    label: 'Dataset Join',
    library: 'data',
    section: 'services',
    sectionLabel: 'Data Services',
    description: 'Merge two incoming datasets by key and pass the combined result forward.',
    icon: ArrowRightLeft,
    accent: '#0f766e',
    bg: '#f0fdfa',
    libraryBadgeClass: 'border-teal-200 bg-teal-50 text-teal-700',
    supportsSequenceIn: true,
    supportsSequenceOut: true,
    supportsDataIn: true,
    supportsDataOut: true,
  },
  deduplicate: {
    kind: 'deduplicate',
    label: 'Deduplicate',
    library: 'data',
    section: 'services',
    sectionLabel: 'Data Services',
    description: 'Remove duplicate rows and forward the unique result set.',
    icon: Files,
    accent: '#475569',
    bg: '#f8fafc',
    libraryBadgeClass: 'border-slate-200 bg-slate-50 text-slate-700',
    supportsSequenceIn: true,
    supportsSequenceOut: true,
    supportsDataIn: true,
    supportsDataOut: true,
  },
  transformer: {
    kind: 'transformer',
    label: 'Data Transformation',
    library: 'data',
    section: 'services',
    sectionLabel: 'Data Services',
    description: 'Apply a low-code chain of Polars transformations — rename, split, lookup join, math, and more.',
    icon: ArrowLeftRight,
    accent: '#7c3aed',
    bg: '#f5f3ff',
    libraryBadgeClass: 'border-violet-200 bg-violet-50 text-violet-700',
    supportsSequenceIn: true,
    supportsSequenceOut: true,
    supportsDataIn: true,
    supportsDataOut: true,
  },
  conditional: {
    kind: 'conditional',
    label: 'Conditional Branch',
    library: 'sequence',
    section: 'logic',
    sectionLabel: 'Logic',
    description: 'Control which rows continue based on a branching expression.',
    icon: GitBranch,
    accent: '#0891b2',
    bg: '#ecfeff',
    libraryBadgeClass: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    supportsSequenceIn: true,
    supportsSequenceOut: true,
    supportsDataIn: true,
    supportsDataOut: true,
  },
  loop: {
    kind: 'loop',
    label: 'For Each Loop',
    library: 'sequence',
    section: 'logic',
    sectionLabel: 'Logic',
    description: 'Iterate over the incoming dataset in chunks while preserving orchestration order.',
    icon: Repeat,
    accent: '#7c3aed',
    bg: '#f5f3ff',
    libraryBadgeClass: 'border-violet-200 bg-violet-50 text-violet-700',
    supportsSequenceIn: true,
    supportsSequenceOut: true,
    supportsDataIn: true,
    supportsDataOut: true,
  },
  script: {
    kind: SCRIPT_NODE_KIND,
    label: SCRIPT_NODE_LABEL,
    library: 'sequence',
    section: 'automation',
    sectionLabel: 'Execution',
    description: 'Run SQL or Python against the incoming dataset from one professional script workspace.',
    icon: TerminalSquare,
    accent: '#2563eb',
    bg: '#eff6ff',
    libraryBadgeClass: 'border-blue-200 bg-blue-50 text-blue-700',
    supportsSequenceIn: true,
    supportsSequenceOut: true,
    supportsDataIn: true,
    supportsDataOut: true,
  },
  email: {
    kind: 'email',
    label: 'Email Notification',
    library: 'sequence',
    section: 'delivery',
    sectionLabel: 'Actions',
    description: 'Send a notification after the sequence reaches this point.',
    icon: Mail,
    accent: '#e11d48',
    bg: '#fff1f2',
    libraryBadgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
    supportsSequenceIn: true,
    supportsSequenceOut: true,
    supportsDataIn: true,
    supportsDataOut: false,
  },
  webhook: {
    kind: 'webhook',
    label: 'Webhook / HTTP Call',
    library: 'sequence',
    section: 'delivery',
    sectionLabel: 'Actions',
    description: 'Call an external endpoint when the process reaches this stage.',
    icon: Webhook,
    accent: '#2563eb',
    bg: '#eff6ff',
    libraryBadgeClass: 'border-blue-200 bg-blue-50 text-blue-700',
    supportsSequenceIn: true,
    supportsSequenceOut: true,
    supportsDataIn: true,
    supportsDataOut: false,
  },
  export: {
    kind: 'export',
    label: 'Export Dataset',
    library: 'sequence',
    section: 'delivery',
    sectionLabel: 'Actions',
    description: 'Persist the connected dataset to a file only when you explicitly add an export step.',
    icon: Download,
    accent: '#059669',
    bg: '#ecfdf5',
    libraryBadgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    supportsSequenceIn: true,
    supportsSequenceOut: false,
    supportsDataIn: true,
    supportsDataOut: false,
  },
};

const getNodeDefinition = (value) => {
  const rawValue = typeof value === 'string'
    ? value
    : value?.data?.nodeType || value?.nodeType || value?.type || value?.data?.label || value?.label || '';
  const normalized = String(rawValue || '').trim().toLowerCase();

  if (PIPELINE_NODE_DEFS[normalized]) return PIPELINE_NODE_DEFS[normalized];
  if (normalized.includes('execute sql') || normalized.includes('sql task') || normalized === 'sql') return PIPELINE_NODE_DEFS.script;
  if (normalized.includes('execute python') || normalized.includes('python task') || normalized === 'python') return PIPELINE_NODE_DEFS.script;
  if (normalized === 'pipelinenode' && (value?.data?.sqlQuery || value?.data?.pythonCode || value?.data?.scriptCode)) {
    return PIPELINE_NODE_DEFS.script;
  }
  return null;
};

const getNodeKind = (value = '') => {
  const explicitDefinition = getNodeDefinition(value);
  if (explicitDefinition) return explicitDefinition.kind;

  const normalized = String(
    typeof value === 'string'
      ? value
      : value?.data?.nodeType || value?.nodeType || value?.type || value?.data?.label || value?.label || '',
  ).toLowerCase();
  if (normalized.includes('dataset')) return 'dataset';
  if (normalized.includes('scraping')) return 'scraper';
  if (normalized.includes('cleaner') || normalized.includes('cleaning')) return 'cleaner';
  if (normalized.includes('validation')) return 'validation';
  if (normalized.includes('mapping')) return 'mapper';
  if (normalized.includes('matching')) return 'matching';
  if (normalized.includes('filter')) return 'filter';
  if (normalized.includes('aggregate')) return 'aggregate';
  if (normalized.includes('join')) return 'join';
  if (normalized.includes('deduplicate')) return 'deduplicate';
  if (normalized.includes('loop')) return 'loop';
  if (normalized.includes('conditional')) return 'conditional';
  if (normalized.includes('execute sql') || normalized.includes('sql task') || normalized === 'sql') return SCRIPT_NODE_KIND;
  if (normalized.includes('execute python') || normalized.includes('python task') || normalized === 'python') return SCRIPT_NODE_KIND;
  if (normalized.includes('email')) return 'email';
  if (normalized.includes('webhook')) return 'webhook';
  if (normalized.includes('export')) return 'export';
  if (value?.data?.sqlQuery || value?.data?.pythonCode || value?.data?.scriptCode) return SCRIPT_NODE_KIND;
  return 'unknown';
};

const getEdgeKind = (edge = {}) => {
  if (edge?.data?.kind) return edge.data.kind;
  if (edge?.kind && Object.values(EDGE_KINDS).includes(edge.kind)) return edge.kind;
  if ((edge?.sourceHandle || '').startsWith('data') || (edge?.targetHandle || '').startsWith('data')) return EDGE_KINDS.data;
  return EDGE_KINDS.sequence;
};

const getEdgePresentation = (kind = EDGE_KINDS.sequence) => {
  if (kind === EDGE_KINDS.data) {
    return {
      type: 'smoothstep',
      animated: true,
      markerEnd: 'url(#cf-data-arrow)',
      style: { stroke: '#10b981', strokeWidth: 2.2 },
      label: 'DATA',
      labelStyle: { fill: '#047857', fontSize: 10, fontWeight: 800 },
      labelBgStyle: { fill: '#ecfdf5', opacity: 0.95 },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 999,
    };
  }

  return {
    type: 'step',
    animated: false,
    markerEnd: 'url(#cf-sequence-arrow)',
    style: { stroke: '#475569', strokeWidth: 1.8, strokeDasharray: '8 5' },
    label: 'SEQ',
    labelStyle: { fill: '#334155', fontSize: 10, fontWeight: 800 },
    labelBgStyle: { fill: '#f8fafc', opacity: 0.98 },
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 999,
  };
};

const createEdgeId = ({ source, target, sourceHandle, targetHandle, kind }) =>
  `${source}-${sourceHandle || 'auto'}-${target}-${targetHandle || 'auto'}-${kind}`;

const buildStyledEdge = (edgeLike) => {
  const kind = getEdgeKind(edgeLike);
  return {
    ...edgeLike,
    ...getEdgePresentation(kind),
    data: { ...(edgeLike.data || {}), kind },
    kind,
  };
};

const createEdgeFromConnection = (params) => {
  const kind = (params.sourceHandle || '').startsWith('data') ? EDGE_KINDS.data : EDGE_KINDS.sequence;
  return buildStyledEdge({
    ...params,
    id: createEdgeId({ ...params, kind }),
    data: { kind },
  });
};

const getExecutionFlowEdges = (edges = []) => {
  const seen = new Set();
  return (edges || []).filter((edge) => {
    const source = edge?.source;
    const target = edge?.target;
    if (!source || !target) return false;
    const key = `${source}-${target}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizePipelineNode = (node) => {
  const kind = getNodeKind(node);
  const definition = getNodeDefinition(kind);
  if (!definition) return node;
  const baseData = node.data || {};
  const normalizedData = kind === SCRIPT_NODE_KIND
    ? buildScriptNodeData(baseData)
    : baseData;

  return {
    ...node,
    type: 'pipelineNode',
    data: {
      ...normalizedData,
      nodeType: kind,
      label: normalizedData.label || definition.label,
      library: normalizedData.library || definition.library,
    },
  };
};

const normalizePipelineEdges = (edges = [], nodes = []) => {
  const nodeMap = Object.fromEntries(nodes.map((node) => [node.id, normalizePipelineNode(node)]));
  const seen = new Set();

  return (edges || []).flatMap((edge) => {
    const sourceDef = getNodeDefinition(nodeMap[edge.source]);
    const targetDef = getNodeDefinition(nodeMap[edge.target]);

    if (edge?.data?.kind || edge?.sourceHandle || edge?.targetHandle) {
      const normalizedEdge = buildStyledEdge({
        ...edge,
        id: edge.id || createEdgeId({ ...edge, kind: getEdgeKind(edge) }),
      });
      const key = `${normalizedEdge.source}-${normalizedEdge.target}-${getEdgeKind(normalizedEdge)}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [normalizedEdge];
    }

    const legacyEdges = [];

    if (sourceDef?.supportsSequenceOut && targetDef?.supportsSequenceIn) {
      legacyEdges.push(buildStyledEdge({
        ...edge,
        id: createEdgeId({
          source: edge.source,
          target: edge.target,
          sourceHandle: FLOW_HANDLE_IDS.sequenceOut,
          targetHandle: FLOW_HANDLE_IDS.sequenceIn,
          kind: EDGE_KINDS.sequence,
        }),
        sourceHandle: FLOW_HANDLE_IDS.sequenceOut,
        targetHandle: FLOW_HANDLE_IDS.sequenceIn,
        data: { ...(edge.data || {}), kind: EDGE_KINDS.sequence, legacy: true },
      }));
    }

    if (sourceDef?.supportsDataOut && targetDef?.supportsDataIn) {
      legacyEdges.push(buildStyledEdge({
        ...edge,
        id: createEdgeId({
          source: edge.source,
          target: edge.target,
          sourceHandle: FLOW_HANDLE_IDS.dataOut,
          targetHandle: FLOW_HANDLE_IDS.dataIn,
          kind: EDGE_KINDS.data,
        }),
        sourceHandle: FLOW_HANDLE_IDS.dataOut,
        targetHandle: FLOW_HANDLE_IDS.dataIn,
        data: { ...(edge.data || {}), kind: EDGE_KINDS.data, legacy: true },
      }));
    }

    return legacyEdges.filter((legacyEdge) => {
      const key = `${legacyEdge.source}-${legacyEdge.target}-${getEdgeKind(legacyEdge)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
};

const FEATURE_OVERLAY_META = {
  dataset: {
    badge: 'Source',
    description: 'Attach or replace the dataset that initializes this pipeline.',
    icon: Database,
    pillClass: 'border-blue-100 bg-blue-50 text-blue-700',
    iconClass: 'border-blue-100 bg-blue-50 text-blue-600',
  },
  validation: {
    badge: 'Validation',
    description: 'Use the same validation workspace from Data Service and save the rules back into this node.',
    icon: ShieldCheck,
    pillClass: 'border-blue-100 bg-blue-50 text-blue-700',
    iconClass: 'border-blue-100 bg-blue-50 text-blue-600',
  },
  cleaner: {
    badge: 'Cleaning',
    description: 'Configure cleaning operations with the same workspace used in the Data Service tab.',
    icon: Sparkles,
    pillClass: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    iconClass: 'border-emerald-100 bg-emerald-50 text-emerald-600',
  },
  mapper: {
    badge: 'Transformation',
    description: 'Open the schema mapping workspace on top of the builder and save the mapping into this node.',
    icon: GitMerge,
    pillClass: 'border-indigo-100 bg-indigo-50 text-indigo-700',
    iconClass: 'border-indigo-100 bg-indigo-50 text-indigo-600',
  },
  matching: {
    badge: 'Matching',
    description: 'Configure cross-dataset matching rules with the same matching workspace used in Data Service.',
    icon: Shuffle,
    pillClass: 'border-violet-100 bg-violet-50 text-violet-700',
    iconClass: 'border-violet-100 bg-violet-50 text-violet-600',
  },
  transformer: {
    badge: 'Transformation',
    description: 'Build low-code transformation steps against the main input and any connected lookup datasets.',
    icon: ArrowLeftRight,
    pillClass: 'border-violet-100 bg-violet-50 text-violet-700',
    iconClass: 'border-violet-100 bg-violet-50 text-violet-600',
  },
  script: {
    badge: 'Script',
    description: 'Choose SQL or Python, validate syntax, preview the incoming dataset, and save the script back into this node.',
    icon: TerminalSquare,
    pillClass: 'border-blue-100 bg-blue-50 text-blue-700',
    iconClass: 'border-blue-100 bg-blue-50 text-blue-600',
  },
};

// ─── Helper: is a node "configured"? ────────────────────────────────────────
const isNodeConfigured = (node) => {
  const kind = getNodeKind(node);
  if (kind === 'dataset') return hasResolvableSource(node.data);
  if (kind === 'cleaner' || kind === 'validation') {
    return Array.isArray(node.data?.rules) && node.data.rules.length > 0;
  }
  if (kind === 'mapper') {
    return !!node.data?.targetSchema?.trim() || Object.keys(node.data?.mappings || {}).length > 0;
  }
  if (kind === 'matching') {
    return Array.isArray(node.data?.matchRules) && node.data.matchRules.length > 0;
  }
  if (kind === 'transformer') {
    return Array.isArray(node.data?.transformerSteps) && node.data.transformerSteps.length > 0;
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
  if (kind === SCRIPT_NODE_KIND) return isScriptConfigured(node.data);
  if (kind === 'email') return !!node.data?.toEmail;
  if (kind === 'webhook') return !!node.data?.webhookUrl;
  if (kind === 'export') return !!(node.data?.outputFormat || 'xlsx');
  return false;
};

// ─── Custom Node Component ───────────────────────────────────────────────────
const PipelineNode = ({ id: nodeId, data, selected }) => {
  const normalizedNode = { id: nodeId, data };
  const configured = isNodeConfigured(normalizedNode);
  const kind = getNodeKind(normalizedNode);
  const definition = getNodeDefinition(kind) || PIPELINE_NODE_DEFS.dataset;
  const Icon = definition.icon || Workflow;
  const borderColor = selected ? '#1d4ed8' : configured ? definition.accent : '#f59e0b';
  const surfaceColor = selected ? '#ffffff' : definition.bg;
  const statusClass = configured
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-amber-200 bg-amber-50 text-amber-700';

  return (
    <div
      className="relative min-w-[220px] rounded-[18px] border px-4 py-3 shadow-lg transition-all"
      style={{
        borderColor,
        background: surfaceColor,
        boxShadow: selected
          ? '0 0 0 4px rgba(37,99,235,0.12), 0 22px 44px rgba(15,23,42,0.18)'
          : '0 12px 28px rgba(15,23,42,0.08)',
      }}
    >
      {/* Handles — wired per node role */}
      {/* Sources only emit (right handle) */}
      {definition.supportsSequenceIn && (
        <Handle
          id={FLOW_HANDLE_IDS.sequenceIn}
          type="target"
          position={Position.Top}
          style={{
            background: '#475569',
            width: 12,
            height: 12,
            border: '3px solid white',
            boxShadow: '0 0 0 2px rgba(71,85,105,0.28)',
          }}
        />
      )}
      {definition.supportsSequenceOut && (
        <Handle
          id={FLOW_HANDLE_IDS.sequenceOut}
          type="source"
          position={Position.Bottom}
          style={{
            background: '#475569',
            width: 12,
            height: 12,
            border: '3px solid white',
            boxShadow: '0 0 0 2px rgba(71,85,105,0.28)',
          }}
        />
      )}
      {definition.supportsDataIn && (
        <Handle
          id={FLOW_HANDLE_IDS.dataIn}
          type="target"
          position={Position.Left}
          style={{
            background: definition.accent,
            width: 12,
            height: 12,
            border: '3px solid white',
            boxShadow: `0 0 0 2px ${definition.accent}33`,
          }}
        />
      )}
      {definition.supportsDataOut && (
        <Handle
          id={FLOW_HANDLE_IDS.dataOut}
          type="source"
          position={Position.Right}
          style={{
            background: definition.accent,
            width: 12,
            height: 12,
            border: '3px solid white',
            boxShadow: `0 0 0 2px ${definition.accent}33`,
          }}
        />
      )}

      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); data.onDelete(nodeId); }}
        className="absolute -right-2.5 -top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-rose-500 text-white shadow-md transition-colors hover:bg-rose-600"
        title="Delete node"
      >
        <X size={12} />
      </button>

      {/* Content */}
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border"
          style={{ borderColor: `${definition.accent}30`, background: `${definition.accent}16`, color: definition.accent }}
        >
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${definition.libraryBadgeClass}`}>
              {definition.library === 'data' ? 'Data Flow' : 'Sequence'}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusClass}`}>
              {configured ? 'Configured' : 'Needs Setup'}
            </span>
          </div>
          <div className="truncate text-sm font-black text-slate-900">{data.label}</div>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">{definition.description}</p>
        </div>
      </div>

      {/* Status badge */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-200/70 pt-3">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
          {(definition.supportsSequenceIn || definition.supportsSequenceOut) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-500">
              <ArrowDownUp size={11} /> Seq
            </span>
          )}
          {(definition.supportsDataIn || definition.supportsDataOut) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
              <ArrowRightLeft size={11} /> Data
            </span>
          )}
        </div>
        <span className="text-[11px] font-semibold text-slate-400">{definition.sectionLabel}</span>
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
  const [libraryMode, setLibraryMode] = useState('data');
  const [sequenceDataFlowOpen, setSequenceDataFlowOpen] = useState(false);

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

  const activeNodeKind = activeNode ? getNodeKind(activeNode) : null;
  const activeFeatureOverlay = activeNodeKind ? FEATURE_OVERLAY_META[activeNodeKind] || null : null;

  const resetPipelineOutputState = useCallback(() => {
    setOutputSessionId(null);
    setOutputFilename('');
    setOutputRowCount(0);
    setDownloadUrl(null);
    setShowViz(false);
    setShowVisualizerOverlay(false);
  }, []);

  const syncPipelineSourceContext = useCallback((nextNodes = []) => {
    const datasetNode = nextNodes.find((node) => getNodeKind(node) === 'dataset');
    setActiveSessionId(datasetNode?.data?.sessionId || null);
    setPipelineColumns(datasetNode?.data?.columns || []);
  }, []);

  const hydratePipelineState = useCallback((rawNodes = [], rawEdges = []) => {
    const normalizedNodes = (rawNodes || []).map(normalizePipelineNode);
    const normalizedEdges = normalizePipelineEdges(rawEdges, normalizedNodes);
    return { normalizedNodes, normalizedEdges };
  }, []);

  const serializeNodes = useCallback((rawNodes = []) => rawNodes.map((node) => {
    const { onDelete, ...safeData } = node.data || {};
    return {
      ...node,
      type: 'pipelineNode',
      data: safeData,
    };
  }), []);

  const serializeEdges = useCallback((rawEdges = []) => rawEdges.map((edge) => ({
    ...edge,
    ...getEdgePresentation(getEdgeKind(edge)),
    data: { ...(edge.data || {}), kind: getEdgeKind(edge) },
  })), []);

  const updateNodeData = useCallback((nodeId, patch) => {
    setNodes((nds) => nds.map((node) => {
      if (node.id !== nodeId) return node;
      const nextPatch = typeof patch === 'function' ? patch(node) : patch;
      return { ...node, data: { ...node.data, ...nextPatch } };
    }));
  }, [setNodes]);

  const closeNodeConfigurator = useCallback(() => {
    setActiveNode(null);
  }, []);

  const openNodeConfigurator = useCallback((event, node) => {
    event?.preventDefault?.();
    setActiveNode(node);
  }, []);

  const isValidFlowConnection = useCallback((connection) => {
    if (!connection?.source || !connection?.target || connection.source === connection.target) return false;

    const sourceHandle = connection.sourceHandle || '';
    const targetHandle = connection.targetHandle || '';
    const isDataConnection = sourceHandle.startsWith('data') && targetHandle.startsWith('data');
    const isSequenceConnection = sourceHandle.startsWith('sequence') && targetHandle.startsWith('sequence');

    if (!isDataConnection && !isSequenceConnection) return false;

    const kind = isDataConnection ? EDGE_KINDS.data : EDGE_KINDS.sequence;
    return !edges.some((edge) =>
      edge.source === connection.source &&
      edge.target === connection.target &&
      getEdgeKind(edge) === kind
    );
  }, [edges]);

  const onConnect = useCallback((params) => {
    if (!isValidFlowConnection(params)) return;
    setEdges((eds) => addEdge(createEdgeFromConnection(params), eds));
  }, [isValidFlowConnection, setEdges]);

  const deleteNode = useCallback((nodeId) => {
    setNodes((nds) => {
      const nextNodes = nds.filter((n) => n.id !== nodeId);
      syncPipelineSourceContext(nextNodes);
      return nextNodes;
    });
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setActiveNode((prev) => (prev?.id === nodeId ? null : prev));
  }, [setNodes, setEdges, syncPipelineSourceContext]);

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

      const nodeType = event.dataTransfer.getData('application/reactflow');
      if (typeof nodeType === 'undefined' || !nodeType) return;

      const definition = getNodeDefinition(nodeType);
      if (!definition) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: getId(),
        type: 'pipelineNode',
        position,
        data: {
          label: definition.label,
          nodeType,
          library: definition.library,
          rules: [],
          onDelete: deleteNode,
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, deleteNode]
  );

  const onNodeClick = useCallback(() => {
    // React Flow handles selection styling for us; configuration now opens on double click.
  }, []);

  const onNodeDoubleClick = useCallback((event, node) => {
    openNodeConfigurator(event, node);
  }, [openNodeConfigurator]);

  const onPaneClick = useCallback(() => {
    closeNodeConfigurator();
  }, [closeNodeConfigurator]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const dataEdgeCount = edges.filter((edge) => getEdgeKind(edge) === EDGE_KINDS.data).length;
  const executionFlowCount = getExecutionFlowEdges(edges).length;
  const librarySections = Object.values(PIPELINE_NODE_DEFS)
    .filter((definition) => definition.library === libraryMode)
    .reduce((sections, definition) => {
      if (!sections[definition.section]) {
        sections[definition.section] = {
          id: definition.section,
          label: definition.sectionLabel,
          items: [],
        };
      }
      sections[definition.section].items.push(definition);
      return sections;
    }, {});

  const validatePipelineGraph = useCallback(() => {
    const issues = [];
    const hasConfiguredSource = nodes.some((node) => {
      const kind = getNodeKind(node);
      return (kind === 'dataset' || kind === 'scraper') && isNodeConfigured(node);
    });

    if (!hasConfiguredSource) {
      issues.push('Add and configure at least one data source before running the pipeline.');
    }

    if (nodes.length > 1 && executionFlowCount === 0) {
      issues.push('Connect tasks with Data Flow or Sequence Flow so CleanFlow knows the runtime order.');
    }

    const dataRequiredNodes = nodes.filter((node) => {
      const definition = getNodeDefinition(node);
      const kind = getNodeKind(node);
      return definition?.supportsDataIn && kind !== 'dataset' && kind !== 'scraper' && kind !== 'email' && kind !== 'webhook';
    });

    dataRequiredNodes.forEach((node) => {
      const incomingDataEdges = edges.filter((edge) => getEdgeKind(edge) === EDGE_KINDS.data && edge.target === node.id);
      const hasDataInput = incomingDataEdges.length > 0;
      const hasLocalSource = hasResolvableSource(node.data) || !!node.data?.matchingSessionId;
      if (!hasDataInput && !hasLocalSource) {
        issues.push(`${node.data.label} needs a Data Flow input or its own configured dataset.`);
      }

      const kind = getNodeKind(node);
      if (kind === 'join' && incomingDataEdges.length < 2) {
        issues.push('Dataset Join needs two Data Flow inputs before it can run.');
      }
      if (kind === 'matching' && incomingDataEdges.length === 1 && !hasLocalSource) {
        issues.push('Data Matching needs two connected datasets or a saved matching workspace.');
      }
      if (kind === 'transformer') {
        const usesLookupJoin = Array.isArray(node.data?.transformerSteps)
          && node.data.transformerSteps.some((step) => step?.operation === 'lookup_join');
        const availableInputs = incomingDataEdges.length + (hasLocalSource ? 1 : 0);
        if (usesLookupJoin && availableInputs < 2) {
          issues.push('Data Transformation lookup joins need a main input plus at least one additional lookup dataset connection.');
        }
      }
    });

    return issues;
  }, [edges, executionFlowCount, nodes]);

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
          const safeNodes = serializeNodes(nodes);
          const safeEdges = serializeEdges(edges);
          const payload = {
              id: pipelineId,
              name: pipelineName,
              nodes: safeNodes,
              edges: safeEdges
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
          const newEntry = {
            id: res.data.id || pipelineId || Date.now().toString(),
            name: pipelineName,
            nodes: safeNodes,
            edges: safeEdges,
            savedAt: new Date().toISOString()
          };
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

  const resolveExecutionSessionId = useCallback((candidateNodes = nodes) => (
    activeSessionId ||
    candidateNodes.find((node) => node.data?.sessionId)?.data?.sessionId ||
    candidateNodes.find((node) => node.data?.matchingSessionId)?.data?.matchingSessionId ||
    'pipeline-runtime'
  ), [activeSessionId, nodes]);

  const buildScriptPreviewPayload = useCallback((targetNodeId, nextNodeData, options = {}) => {
    const safeNodes = serializeNodes(nodes).map((node) => {
      const nodeData = node.id === targetNodeId
        ? { ...node.data, ...nextNodeData, nodeType: SCRIPT_NODE_KIND, label: SCRIPT_NODE_LABEL }
        : node.data;
      const normalizedNode = { ...node, data: nodeData };
      return {
        id: node.id,
        type: getNodeKind(normalizedNode),
        data: nodeData,
      };
    });

    return {
      pipelineId,
      pipelineName,
      targetNodeId,
      validateOnly: Boolean(options.validateOnly),
      nodeData: nextNodeData,
      nodes: safeNodes,
      edges: serializeEdges(edges),
    };
  }, [edges, nodes, pipelineId, pipelineName, serializeEdges, serializeNodes]);

  const handleRunPipeline = useCallback(async () => {
      const graphIssues = validatePipelineGraph();
      if (graphIssues.length > 0) {
          alert(graphIssues.join('\n'));
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
      
      const safeNodes = serializeNodes(nodes);
      const safeEdges = serializeEdges(edges);
      const hasExportNode = safeNodes.some((node) => getNodeKind(node) === 'export');
      const executionSessionId = resolveExecutionSessionId(safeNodes);
      const payload = {
          pipelineId,
          pipelineName,
          nodes: safeNodes.map((node) => ({
              id: node.id,
              type: getNodeKind(node),
              data: node.data
          })),
          edges: safeEdges
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
        const res = await axios.post(`${API_BASE}/features/pipeline/execute/${executionSessionId}`, payload, { headers });
        
        setExecutionLogs(res.data.logs || []);
        const nextOutputSessionId = res.data.output_session_id || null;
        setOutputSessionId(nextOutputSessionId);
        const nextOutputFilename = res.data.output_file
            ? res.data.output_file.split('/').pop().split('\\').pop()
            : `${(pipelineName || 'pipeline-output').trim() || 'pipeline-output'}.xlsx`;
        setOutputFilename(nextOutputFilename);
        setOutputRowCount(res.data.output_row_count || 0);

        if (hasExportNode && res.data.output_file) {
            const filename = res.data.output_file.split('/').pop().split('\\').pop();
            setDownloadUrl(`${API_BASE}/download/${filename}`);
        } else {
            setDownloadUrl(null);
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
  }, [edges, nodes, pipelineId, pipelineName, resolveExecutionSessionId, serializeEdges, serializeNodes, validatePipelineGraph]);

  const renderFeatureOverlayContent = () => {
    if (!activeNode || !activeFeatureOverlay) return null;

    const nodeId = activeNode.id;
    const sharedSessionId = activeNode.data.sessionId || activeSessionId || null;
    const sharedColumns = Array.isArray(activeNode.data.columns) && activeNode.data.columns.length > 0
      ? activeNode.data.columns
      : pipelineColumns;

    if (activeNodeKind === 'dataset') {
      return (
        <PipelineDatasetWorkspace
          key={`dataset-workspace-${nodeId}`}
          sessionId={activeNode.data.sessionId || activeSessionId || null}
          columns={Array.isArray(activeNode.data.columns) && activeNode.data.columns.length > 0 ? activeNode.data.columns : pipelineColumns}
          sourceConfig={activeNode.data.sourceConfig || activeNode.data.source_config || null}
          onSave={({ sessionId, columns, sourceConfig }) => {
            updateNodeData(nodeId, { sessionId, columns, sourceConfig });
            setActiveSessionId(sessionId || null);
            setPipelineColumns(columns || []);
            resetPipelineOutputState();
            closeNodeConfigurator();
          }}
        />
      );
    }

    if (activeNodeKind === 'validation') {
      return (
        <PipelineValidationWorkspace
          key={`validation-workspace-${nodeId}`}
          sessionId={sharedSessionId}
          columns={sharedColumns}
          initialSourceConfig={activeNode.data.sourceConfig || activeNode.data.source_config || null}
          initialRules={activeNode.data.rules || []}
          onSave={({ sessionId, columns, sourceConfig, rules }) => {
            updateNodeData(nodeId, { sessionId, columns, sourceConfig, rules });
            closeNodeConfigurator();
          }}
        />
      );
    }

    if (activeNodeKind === 'cleaner') {
      return (
        <EnrichmentBuilder
          key={`cleaner-workspace-${nodeId}`}
          sessionId={sharedSessionId}
          columns={sharedColumns}
          initialSourceConfig={activeNode.data.sourceConfig || activeNode.data.source_config || null}
          initialRules={activeNode.data.rules || []}
          embedded={true}
          onSaveConfig={({ sessionId, columns, sourceConfig, rules }) => {
            updateNodeData(nodeId, { sessionId, columns, sourceConfig, rules });
            closeNodeConfigurator();
          }}
        />
      );
    }

    if (activeNodeKind === 'mapper') {
      return (
        <SchemaMapper
          key={`mapper-workspace-${nodeId}`}
          sessionId={sharedSessionId}
          columns={sharedColumns}
          initialSourceConfig={activeNode.data.sourceConfig || activeNode.data.source_config || null}
          initialTargetSchema={activeNode.data.targetSchema || ''}
          initialMappings={activeNode.data.mappings || {}}
          initialTransformations={activeNode.data.columnTransforms || {}}
          embedded={true}
          onSaveConfig={({ sessionId, columns, sourceConfig, targetSchema, mappings, columnTransforms }) => {
            updateNodeData(nodeId, { sessionId, columns, sourceConfig, targetSchema, mappings, columnTransforms });
            closeNodeConfigurator();
          }}
        />
      );
    }

    if (activeNodeKind === 'matching') {
      return (
        <DataMatchingBuilder
          key={`matching-workspace-${nodeId}`}
          embedded={true}
          initialSessionId={activeNode.data.matchingSessionId || null}
          initialDatasets={activeNode.data.datasets || { dataset1: null, dataset2: null }}
          initialDatasetColumns={activeNode.data.datasetColumns || { dataset1: [], dataset2: [] }}
          initialOutputColumns={activeNode.data.outputColumns || { dataset1: [], dataset2: [] }}
          initialMatchRules={activeNode.data.matchRules || []}
          initialDatasetMode={activeNode.data.datasetMode || { dataset1: 'file', dataset2: 'file' }}
          initialDatasetQueries={activeNode.data.datasetQueries || { dataset1: 'SELECT * FROM table1 LIMIT 100', dataset2: 'SELECT * FROM table2 LIMIT 100' }}
          initialDatasetConnections={activeNode.data.datasetConnections || { dataset1: '', dataset2: '' }}
          initialWorkspaceTab={activeNode.data.workspaceTab || 'dataset1'}
          onSaveConfig={(config) => {
            updateNodeData(nodeId, {
              matchingSessionId: config.matchingSessionId,
              datasets: config.datasets,
              datasetColumns: config.datasetColumns,
              outputColumns: config.outputColumns,
              matchRules: config.matchRules,
              datasetMode: config.datasetMode,
              datasetQueries: config.datasetQueries,
              datasetConnections: config.datasetConnections,
              workspaceTab: config.workspaceTab,
            });
            closeNodeConfigurator();
          }}
        />
      );
    }

    if (activeNodeKind === 'transformer') {
      return (
        <DataTransformer
          key={`transformer-workspace-${nodeId}`}
          embedded={true}
          embeddedSessionId={sharedSessionId}
          embeddedColumns={sharedColumns}
          initialSteps={activeNode.data.transformerSteps || []}
          pipelineContext={{
            sessionId: resolveExecutionSessionId(nodes),
            targetNodeId: nodeId,
            pipelineId,
            pipelineName,
            nodes: serializeNodes(nodes),
            edges: serializeEdges(edges),
          }}
          onSaveConfig={({ columns, steps }) => {
            updateNodeData(nodeId, { columns, transformerSteps: steps });
            closeNodeConfigurator();
          }}
        />
      );
    }

    if (activeNodeKind === SCRIPT_NODE_KIND) {
      return (
        <PipelineScriptWorkspace
          key={`script-workspace-${nodeId}`}
          node={activeNode}
          executionSessionId={resolveExecutionSessionId(nodes)}
          buildPreviewPayload={buildScriptPreviewPayload}
          onSave={(nextNodeData) => {
            updateNodeData(nodeId, nextNodeData);
            closeNodeConfigurator();
          }}
        />
      );
    }

    return null;
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
        <aside className="w-[290px] shrink-0 z-10 flex flex-col overflow-hidden bg-white border-r border-slate-100">

          {/* Palette header */}
          <div className="px-4 py-3.5 border-b border-slate-100">
              <div className="flex items-center justify-between gap-3">
                  <div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Node Library</p>
                      <p className="text-xs mt-0.5 text-slate-400">Drag nodes to canvas</p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      {dataEdgeCount}D • {executionFlowCount}S
                  </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
                  {FLOW_LIBRARY_TABS.map((tab) => (
                      <button
                          key={tab.id}
                          type="button"
                          onClick={() => setLibraryMode(tab.id)}
                          className={`rounded-[14px] px-3 py-2.5 text-left transition-all ${
                              libraryMode === tab.id
                                  ? 'bg-white shadow-sm ring-1 ring-slate-200'
                                  : 'text-slate-500 hover:bg-white/70'
                          }`}
                      >
                          <p className="text-sm font-black text-slate-800">{tab.label}</p>
                          <p className="mt-0.5 text-[11px] text-slate-400">{tab.subtitle}</p>
                      </button>
                  ))}
              </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">

            {libraryMode === 'data' && (
              <div>
                <p className="text-xs font-black uppercase tracking-widest mb-2 px-1 text-slate-400">Sources</p>
                <div className="space-y-1.5">
                  {[{ type: 'dataset', label: 'Dataset Input', icon: Database, color: '#10b981', bg: '#10b98115' },
                    { type: 'scraper', label: 'Web Scraping', icon: Globe, color: '#f97316', bg: '#f9731615' }]
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
            )}

            {libraryMode === 'data' && (
              <div>
                <p className="text-xs font-black uppercase tracking-widest mb-2 px-1 text-slate-400">Data Services</p>
                <div className="space-y-1.5">
                  {[{ type: 'cleaner', label: 'Data Cleaning', icon: Sparkles, color: '#10b981', bg: '#10b98115' },
                    { type: 'validation', label: 'Quality Validation', icon: ShieldCheck, color: '#3b82f6', bg: '#3b82f615' },
                    { type: 'mapper', label: 'Schema Mapping', icon: GitMerge, color: '#6366f1', bg: '#6366f115' },
                    { type: 'matching', label: 'Data Matching', icon: Shuffle, color: '#8b5cf6', bg: '#8b5cf615' },
                    { type: 'filter', label: 'Filter Rows', icon: Filter, color: '#f59e0b', bg: '#f59e0b15' },
                    { type: 'aggregate', label: 'Aggregate', icon: Calculator, color: '#ec4899', bg: '#ec489915' },
                    { type: 'join', label: 'Dataset Join', icon: ArrowRightLeft, color: '#14b8a6', bg: '#14b8a615' },
                    { type: 'deduplicate', label: 'Deduplicate', icon: Files, color: '#64748b', bg: '#64748b15' },
                    { type: 'transformer', label: 'Data Transformation', icon: ArrowLeftRight, color: '#7c3aed', bg: '#7c3aed15' }]
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
            )}

            {libraryMode === 'sequence' && (
              <div>
                <button
                  type="button"
                  onClick={() => setSequenceDataFlowOpen((open) => !open)}
                  className="w-full rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-all hover:border-emerald-200 hover:shadow-md"
                >
                  <div className="flex items-start gap-3 px-4 py-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                      <Workflow size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                              Sequence
                            </span>
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                              Data Flow Task
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-black text-slate-800">Data Flow</p>
                          <p className="mt-1 text-[11px] leading-5 text-slate-500">
                            Click to open all data sources and data service tasks, similar to SSIS Data Flow Task.
                          </p>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                          {sequenceDataFlowOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>

                {sequenceDataFlowOpen && (
                  <div className="mt-3 space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3">
                    <div>
                      <div className="mb-2 flex items-center justify-between px-1">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Sources</p>
                        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700 shadow-sm">
                          Input
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {[{ type: 'dataset', label: 'Dataset Input', icon: Database, color: '#10b981', bg: '#10b98115' },
                          { type: 'scraper', label: 'Web Scraping', icon: Globe, color: '#f97316', bg: '#f9731615' }]
                        .map(n => (
                            <div key={n.type}
                                draggable
                                onDragStart={(e) => onDragStart(e, n.type)}
                                className="flex items-center gap-3 rounded-xl border border-white bg-white px-3 py-2.5 shadow-sm transition-all hover:border-emerald-200 hover:bg-emerald-50/50"
                            >
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: n.bg }}>
                                    <n.icon size={14} style={{ color: n.color }} />
                                </div>
                                <span className="text-xs font-bold text-slate-600">{n.label}</span>
                            </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between px-1">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Data Services</p>
                        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700 shadow-sm">
                          Transform
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {[{ type: 'cleaner', label: 'Data Cleaning', icon: Sparkles, color: '#10b981', bg: '#10b98115' },
                          { type: 'validation', label: 'Quality Validation', icon: ShieldCheck, color: '#3b82f6', bg: '#3b82f615' },
                          { type: 'mapper', label: 'Schema Mapping', icon: GitMerge, color: '#6366f1', bg: '#6366f115' },
                          { type: 'matching', label: 'Data Matching', icon: Shuffle, color: '#8b5cf6', bg: '#8b5cf615' },
                          { type: 'filter', label: 'Filter Rows', icon: Filter, color: '#f59e0b', bg: '#f59e0b15' },
                          { type: 'aggregate', label: 'Aggregate', icon: Calculator, color: '#ec4899', bg: '#ec489915' },
                          { type: 'join', label: 'Dataset Join', icon: ArrowRightLeft, color: '#14b8a6', bg: '#14b8a615' },
                          { type: 'deduplicate', label: 'Deduplicate', icon: Files, color: '#64748b', bg: '#64748b15' },
                          { type: 'transformer', label: 'Data Transformation', icon: ArrowLeftRight, color: '#7c3aed', bg: '#7c3aed15' }]
                        .map(n => (
                            <div key={n.type}
                                draggable
                                onDragStart={(e) => onDragStart(e, n.type)}
                                className="flex items-center gap-3 rounded-xl border border-white bg-white px-3 py-2.5 shadow-sm transition-all hover:border-emerald-200 hover:bg-emerald-50/50"
                            >
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: n.bg }}>
                                    <n.icon size={14} style={{ color: n.color }} />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-600">{n.label}</div>
                                  <div className="text-[10px] font-medium text-slate-400">Drag into canvas</div>
                                </div>
                            </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {libraryMode === 'sequence' && (
              <div>
                <p className="text-xs font-black uppercase tracking-widest mb-2 px-1 text-slate-400">Logic</p>
                <div className="space-y-1.5">
                  {[{ type: 'conditional', label: 'Conditional Branch', icon: GitBranch, color: '#06b6d4', bg: '#06b6d415' },
                    { type: 'loop', label: 'For Each Loop', icon: Repeat, color: '#8b5cf6', bg: '#8b5cf615' },
                    { type: SCRIPT_NODE_KIND, label: SCRIPT_NODE_LABEL, icon: TerminalSquare, color: '#2563eb', bg: '#2563eb15' }]
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
            )}

            {libraryMode === 'sequence' && (
              <div>
                <p className="text-xs font-black uppercase tracking-widest mb-2 px-1 text-slate-400">Actions</p>
                <div className="space-y-1.5">
                  {[{ type: 'email', label: 'Email Notification', icon: Mail, color: '#f43f5e', bg: '#f43f5e15' },
                    { type: 'webhook', label: 'Webhook / HTTP Call', icon: Webhook, color: '#3b82f6', bg: '#3b82f615' },
                    { type: 'export', label: 'Export Dataset', icon: Download, color: '#10b981', bg: '#10b98115' }]
                  .map(n => (
                      <div key={n.type}
                          draggable
                          onDragStart={(e) => onDragStart(e, n.type)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-grab select-none transition-all border ${
                              n.type === 'export'
                                  ? 'border-emerald-100 bg-emerald-50 hover:bg-emerald-100'
                                  : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                          }`}
                      >
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: n.bg }}>
                              <n.icon size={14} style={{ color: n.color }} />
                          </div>
                          <span className={`text-xs font-bold ${n.type === 'export' ? 'text-emerald-700' : 'text-slate-600'}`}>{n.label}</span>
                      </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Keyboard hint */}
          <div className="px-4 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-400">Data Flow handles share datasets and define the default runtime path. Use Sequence Flow handles for branches, notifications, and orchestration-only steps. Double-click to configure a node.</p>
          </div>
        </aside>

        {/* Center Canvas */}
        <div className="flex-1 h-full relative" ref={reactFlowWrapper}>

            {/* Hidden SVG — defines a small circle endpoint marker */}
            <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
                <defs>
                    <marker id="cf-sequence-arrow" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto">
                        <path d="M0,0 L12,6 L0,12 z" fill="#475569" />
                    </marker>
                    <marker id="cf-data-arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
                        <path d="M0,0 L12,6 L0,12 z" fill="#10b981" />
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
                onNodeDoubleClick={onNodeDoubleClick}
                onPaneClick={onPaneClick}
                isValidConnection={isValidFlowConnection}
                nodeTypes={nodeTypes}
                deleteKeyCode="Delete"
                connectionLineType={ConnectionLineType.SmoothStep}
                connectionLineStyle={{ stroke: '#94a3b8', strokeWidth: 2 }}
                defaultEdgeOptions={{
                  ...getEdgePresentation(EDGE_KINDS.sequence),
                }}
                fitView
                >
                <Controls style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }} />
                <Background variant="dots" gap={24} size={1.2} color="#94a3b8" style={{ background: '#f8fafc' }} />
                </ReactFlow>
            </ReactFlowProvider>

            {/* Full-Screen Configuration Modal Portal */}
            {activeNode && activeFeatureOverlay && createPortal(
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="fixed inset-0 z-[70] bg-slate-950/45 p-3 backdrop-blur-sm md:p-5"
                    onClick={closeNodeConfigurator}
                >
                    <div className="mx-auto mb-3 flex max-w-[1600px] items-center justify-between gap-3 px-1" onClick={(event) => event.stopPropagation()}>
                        <div className={`inline-flex items-center gap-3 rounded-full border bg-white/95 px-4 py-2 shadow-lg shadow-slate-900/10 backdrop-blur ${activeFeatureOverlay.pillClass}`}>
                            <div className={`flex h-10 w-10 items-center justify-center rounded-full border ${activeFeatureOverlay.iconClass}`}>
                                <activeFeatureOverlay.icon size={18} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] opacity-70">{activeFeatureOverlay.badge}</p>
                                <p className="truncate text-sm font-bold text-slate-800">{activeNode.data.label}</p>
                            </div>
                        </div>
                        <button onClick={closeNodeConfigurator} className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/95 px-4 py-2 text-sm font-semibold text-slate-600 shadow-lg shadow-slate-900/10 transition-all hover:bg-slate-50">
                            <X size={16} /> Close
                        </button>
                    </div>
                    <motion.div
                        key={`feature-overlay-${activeNode.id}`}
                        initial={{ opacity: 0, scale: 0.97, y: 18 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                        className="mx-auto h-[calc(100%-60px)] w-full max-w-[1600px] overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-2xl shadow-slate-900/25"
                        onClick={(event) => event.stopPropagation()}
                    >
                        {renderFeatureOverlayContent()}
                    </motion.div>
                </motion.div>,
                document.body
            )}
            {activeNode && !activeFeatureOverlay && createPortal(
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
                                {activeNodeKind === 'validation' && (
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
                                {activeNodeKind === 'cleaner' && (
                                    <CleanerConfigPanel 
                                        node={activeNode} 
                                        columns={activeNode.data.columns || pipelineColumns}
                                        onSave={(rules) => {
                                            setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, rules } } : n));
                                            setActiveNode(null);
                                        }} 
                                    />
                                )}

                                {activeNodeKind === 'mapper' && (
                                    <MapperConfigPanel
                                        node={activeNode}
                                        columns={activeNode.data.columns || pipelineColumns}
                                        onSave={(config) => {
                                            setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n));
                                            setActiveNode(null);
                                        }}
                                    />
                                )}

                                {activeNodeKind === 'matching' && (
                                    <MatchingConfigPanel
                                        node={activeNode}
                                        columns={activeNode.data.columns || pipelineColumns}
                                        onSave={(config) => {
                                            setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n));
                                            setActiveNode(null);
                                        }}
                                    />
                                )}

                                {activeNodeKind === 'scraper' && (
                                    <ScraperConfigPanel
                                        node={activeNode}
                                        onSave={(config) => {
                                            setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n));
                                            setActiveNode(null);
                                        }}
                                    />
                                )}

                                {activeNodeKind === 'dataset' && (
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
                                                    ? { ...n, data: { ...n.data, sessionId: uploadData.session_id, columns: uploadData.columns || [], sourceConfig: getSourceConfigFromResponse(uploadData) } } 
                                                    : n
                                                  ));
                                                 setActiveNode(null);
                                            }} />
                                         </div>
                                    </div>
                                )}

                                {/* NEW NODES START */}
                                {/* Filter Rows */}
                                {activeNodeKind === 'filter' && (
                                    <FilterConfigPanel node={activeNode} columns={activeNode.data.columns || pipelineColumns} onSave={(config) => { setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n)); setActiveNode(null); }} />
                                )}

                                {/* Aggregate */}
                                {activeNodeKind === 'aggregate' && (
                                    <AggregateConfigPanel node={activeNode} columns={activeNode.data.columns || pipelineColumns} onSave={(config) => { setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n)); setActiveNode(null); }} />
                                )}
                                
                                {/* Join */}
                                {activeNodeKind === 'join' && (
                                    <JoinConfigPanel node={activeNode} columns={activeNode.data.columns || pipelineColumns} onSave={(config) => { setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n)); setActiveNode(null); }} />
                                )}

                                {/* Deduplicate */}
                                {activeNodeKind === 'deduplicate' && (
                                    <DeduplicateConfigPanel node={activeNode} columns={activeNode.data.columns || pipelineColumns} onSave={(config) => { setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n)); setActiveNode(null); }} />
                                )}
                                
                                {/* Loop */}
                                {activeNodeKind === 'loop' && (
                                    <LoopConfigPanel node={activeNode} onSave={(config) => { setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n)); setActiveNode(null); }} />
                                )}

                                {/* Conditional */}
                                {activeNodeKind === 'conditional' && (
                                    <ConditionalConfigPanel node={activeNode} columns={activeNode.data.columns || pipelineColumns} onSave={(config) => { setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n)); setActiveNode(null); }} />
                                )}

                                {/* Email */}
                                {activeNodeKind === 'email' && (
                                    <EmailConfigPanel node={activeNode} onSave={(config) => { setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n)); setActiveNode(null); }} />
                                )}

                                {/* Webhook */}
                                {activeNodeKind === 'webhook' && (
                                    <WebhookConfigPanel node={activeNode} onSave={(config) => { setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n)); setActiveNode(null); }} />
                                )}
                                {/* NEW NODES END */}

                                {activeNodeKind === 'export' && (
                                    <ExportConfigPanel node={activeNode} onSave={(config) => { setNodes(nds => nds.map(n => n.id === activeNode.id ? { ...n, data: { ...n.data, ...config } } : n)); setActiveNode(null); }} />
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
                            const loadedNodes = p.nodes || (p.pipeline_data?.nodes || []);
                            const loadedEdges = p.edges || (p.pipeline_data?.edges || []);
                            const { normalizedNodes, normalizedEdges } = hydratePipelineState(loadedNodes, loadedEdges);
                            setNodes(normalizedNodes);
                            setEdges(normalizedEdges);
                            syncPipelineSourceContext(normalizedNodes);
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
                                      <option value="Asia/Kolkata">India Standard Time</option>
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

const PipelineDatasetWorkspace = ({ sessionId: initialSessionId = null, columns: initialColumns = [], sourceConfig: initialSourceConfig = null, onSave }) => {
  const [sessionId, setSessionId] = useState(initialSessionId || null);
  const [columns, setColumns] = useState(initialColumns || []);
  const [sourceConfig, setSourceConfig] = useState(initialSourceConfig || null);
  const [workspaceTab, setWorkspaceTab] = useState(initialSessionId ? 'preview' : 'source');

  useEffect(() => {
    setSessionId(initialSessionId || null);
    setColumns(initialColumns || []);
    setSourceConfig(initialSourceConfig || null);
    setWorkspaceTab(initialSessionId ? 'preview' : 'source');
  }, [initialSessionId, initialColumns, initialSourceConfig]);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-100 bg-blue-50">
            <Database size={20} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">Dataset Source</h2>
            <p className="mt-0.5 text-sm text-slate-500">Upload or replace the source dataset that powers this pipeline.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSave({ sessionId, columns, sourceConfig })}
          disabled={!sessionId}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          <Save size={16} /> Save Source
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Source Workspace</h3>
            <p className="mt-1 text-sm text-slate-500">Keep the pipeline source visible while replacing or reviewing the active dataset.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
              {sessionId ? 'Source attached' : 'No source attached'}
            </span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm">
              {columns.length} columns
            </span>
          </div>
        </div>

        <WorkspaceTabs
          tone="blue"
          activeTab={workspaceTab}
          onChange={setWorkspaceTab}
          tabs={[
            { id: 'source', label: sessionId ? 'Replace Source' : 'Source' },
            { id: 'preview', label: 'Preview', icon: Database, disabled: !sessionId },
          ]}
        />

        <div className="mt-5">
          {workspaceTab === 'source' ? (
            <DataConnection
              compact={true}
              onUploadSuccess={(data) => {
                setSessionId(data.session_id);
                setColumns(data.columns || []);
                setSourceConfig(getSourceConfigFromResponse(data));
                setWorkspaceTab('preview');
              }}
            />
          ) : (
            <DatasetViewer
              sessionId={sessionId}
              tone="blue"
              title="Pipeline Source Dataset"
              subtitle="Review the active source rows here before saving this dataset back into the pipeline node."
            />
          )}
        </div>
      </div>
    </div>
  );
};

const PipelineValidationWorkspace = ({ sessionId: initialSessionId = null, columns: initialColumns = [], initialSourceConfig = null, initialRules = [], onSave }) => {
  const [sessionId, setSessionId] = useState(initialSessionId || null);
  const [columns, setColumns] = useState(initialColumns || []);
  const [sourceConfig, setSourceConfig] = useState(initialSourceConfig || null);
  const [rules, setRules] = useState(initialRules || []);
  const [workspaceTab, setWorkspaceTab] = useState(initialSessionId ? 'dataset' : 'source');

  useEffect(() => {
    setSessionId(initialSessionId || null);
    setColumns(initialColumns || []);
    setSourceConfig(initialSourceConfig || null);
    setRules(initialRules || []);
    setWorkspaceTab(initialSessionId ? 'dataset' : 'source');
  }, [initialSessionId, initialColumns, initialSourceConfig, initialRules]);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-100 bg-blue-50">
            <ShieldCheck size={20} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">Quality Validation</h2>
            <p className="mt-0.5 text-sm text-slate-500">Use the same validation workspace from Data Service and save the rule set into this node.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
            {columns.length} columns
          </span>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm">
            {rules.length} rule{rules.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-5">
          <h3 className="text-lg font-bold text-slate-800">Validation Workspace</h3>
          <p className="mt-1 text-sm text-slate-500">Switch between source upload, dataset preview, and rule design without leaving the pipeline canvas.</p>
        </div>

        <WorkspaceTabs
          tone="blue"
          activeTab={workspaceTab}
          onChange={setWorkspaceTab}
          tabs={[
            { id: 'source', label: 'Source' },
            { id: 'dataset', label: 'Dataset', icon: Database, disabled: !sessionId },
            { id: 'rules', label: 'Rules', icon: ShieldCheck },
          ]}
        />

        <div className="mt-5">
          {workspaceTab === 'source' && (
            <DataConnection
              compact={true}
              onUploadSuccess={(data) => {
                setSessionId(data.session_id);
                setColumns(data.columns || []);
                setSourceConfig(getSourceConfigFromResponse(data));
                setWorkspaceTab('dataset');
              }}
            />
          )}

          {workspaceTab === 'dataset' && sessionId && (
            <DatasetViewer
              sessionId={sessionId}
              tone="blue"
              title="Validation Dataset"
              subtitle="Inspect the active dataset, then switch back to rules to save the validation logic into the pipeline."
            />
          )}

          {workspaceTab === 'rules' && (
            <RuleBuilder
              key={`pipeline-validation-${sessionId || 'no-session'}-${columns.length}`}
              compact={true}
              isEmbedded={true}
              columns={columns}
              initialRules={rules}
              onRulesChange={setRules}
              onSaveRules={(savedRules) => onSave({ sessionId, columns, sourceConfig, rules: savedRules })}
            />
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

const ExportConfigPanel = ({ node, onSave }) => {
    const [outputFormat, setOutputFormat] = useState(node.data.outputFormat || 'xlsx');
    const [outputName, setOutputName] = useState(node.data.outputName || '');

    useEffect(() => {
        setOutputFormat(node.data.outputFormat || 'xlsx');
        setOutputName(node.data.outputName || '');
    }, [node]);

    return (
        <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl border border-slate-100 py-6 px-4">
            <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2"><Download size={20} className="text-emerald-600" /> Export Dataset</h3>
            <div className="space-y-5 mb-6">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    Downloads appear only when this export step is present in the Sequence Flow and a dataset is connected through Data Flow.
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Output Format</label>
                    <select
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-emerald-500"
                        value={outputFormat}
                        onChange={(e) => setOutputFormat(e.target.value)}
                    >
                        <option value="xlsx">Excel Workbook (.xlsx)</option>
                        <option value="csv">CSV File (.csv)</option>
                        <option value="json">JSON File (.json)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Optional File Name</label>
                    <input
                        type="text"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-emerald-500"
                        value={outputName}
                        onChange={(e) => setOutputName(e.target.value)}
                        placeholder="customer_master_cleaned"
                    />
                </div>
            </div>
            <div className="mt-auto pt-4 border-t border-slate-200 flex justify-end">
                <button onClick={() => onSave({ outputFormat, outputName })} className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-transform hover:-translate-y-0.5">
                    Save Export Step
                </button>
            </div>
        </div>
    );
};
