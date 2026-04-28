import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeftRight,
  BarChart2,
  BarChart3,
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  ChevronsLeft,
  Clock3,
  FolderClock,
  FolderCog,
  Globe,
  GripVertical,
  Home,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Logs,
  Moon,
  Play,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Shuffle,
  Sparkles,
  SunMedium,
  TrendingUp,
  UserCircle2,
  Wand2,
  X,
  GitMerge,
  Trash2,
} from 'lucide-react';

import { DataConnection, DatasetViewer, ResultsDashboard, RuleBuilder } from './components';
import { AuthModal } from './components/modals';
import { UsagePage, UserProfilePage } from './components/pages';
import ChatBot from './components/ChatBot';
import {
  DataMatchingBuilder,
  DataTransformer,
  DataVisualizer,
  EnrichmentBuilder,
  GlobalRepositoryBuilder,
  PipelineBuilder,
  PipelineRuns,
  PricingIntelligenceBuilder,
  SchedulerBuilder,
  SchemaMapper,
  ScraperBuilder,
} from './features';
import { formatDateTimeInIST } from './lib/utils';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';
const IS_DESKTOP_APP = import.meta.env.VITE_DESKTOP_APP === 'true' || Boolean(window.cleanflowDesktop);

const sectionItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tasks', label: 'Tasks', icon: Sparkles },
  { id: 'configuration', label: 'Configuration', icon: FolderCog },
  { id: 'logs', label: 'Logs', icon: Logs },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const featureGroups = {
  dashboard: [
    { id: 'dashboard', label: 'Overview', icon: Home, description: 'Workspace summary and shortcuts' },
  ],
  tasks: [
    { id: 'validate', label: 'Validation', icon: ShieldCheck, description: 'Rule-based data quality checks' },
    { id: 'enrichment', label: 'Data Cleaning', icon: Sparkles, description: 'Smart enrichment and cleanup' },
    { id: 'transformer', label: 'Data Transformation', icon: ArrowLeftRight, description: 'Guided data transformation' },
    { id: 'mapper', label: 'Schema Mapper', icon: GitMerge, description: 'Schema mapping and remapping' },
    { id: 'scraper', label: 'Web Scraper', icon: Globe, description: 'Web data extraction' },
    { id: 'matching', label: 'Data Matching', icon: Shuffle, description: 'Record matching and comparisons' },
    { id: 'pricing-intelligence', label: 'Pricing Intelligence', icon: TrendingUp, description: 'Pricing intelligence flows' },
    { id: 'visualizer', label: 'Data Visualizer', icon: BarChart3, description: 'AI charts and insights' },
    { id: 'pipeline', label: 'Pipeline Builder', icon: GripVertical, description: 'Workflow builder and orchestration' },
    { id: 'scheduler', label: 'Scheduler', icon: Clock3, description: 'Scheduled workflow execution' },
    { id: 'pipeline-runs', label: 'Pipeline Runs', icon: FolderClock, description: 'Execution history and runs' },
  ],
  configuration: [
    { id: 'repository', label: 'Repository', icon: BookOpen, description: 'Global reusable assets' },
    { id: 'usage', label: 'Usage', icon: BarChart2, description: 'Workspace usage and resources' },
  ],
  logs: [
    { id: 'logs', label: 'Execution Logs', icon: Logs, description: 'Recent jobs and outcomes' },
  ],
  settings: [
    { id: 'workspace-settings', label: 'Workspace', icon: Settings, description: 'Appearance and behavior' },
    { id: 'profile', label: 'Profile', icon: UserCircle2, description: 'Account details' },
  ],
};

const featureCards = [
  { id: 'validate', title: 'Quality Validation', subtitle: 'Upload, configure, preview, and validate with no code.', icon: ShieldCheck },
  { id: 'enrichment', title: 'Data Cleaning', subtitle: 'Clean and enrich records with guided inputs.', icon: Sparkles },
  { id: 'transformer', title: 'Data Transformation', subtitle: 'Apply structured transformations safely.', icon: ArrowLeftRight },
  { id: 'mapper', title: 'Schema Mapping', subtitle: 'Map source and target columns visually.', icon: GitMerge },
  { id: 'scraper', title: 'Web Scraping', subtitle: 'Capture structured web data with workflows.', icon: Globe },
  { id: 'matching', title: 'Data Matching', subtitle: 'Compare and resolve entity matches.', icon: Shuffle },
  { id: 'pricing-intelligence', title: 'Pricing Intelligence', subtitle: 'Run pricing-specific analysis and flows.', icon: TrendingUp },
  { id: 'visualizer', title: 'AI Visualizer', subtitle: 'Turn data into charts and summaries.', icon: BarChart3 },
  { id: 'pipeline', title: 'Pipeline Builder', subtitle: 'Build orchestrated workflows across modules.', icon: GripVertical },
  { id: 'scheduler', title: 'Scheduler', subtitle: 'Plan recurring pipeline execution.', icon: Clock3 },
  { id: 'pipeline-runs', title: 'Pipeline Runs', subtitle: 'Inspect completed and active runs.', icon: FolderClock },
  { id: 'repository', title: 'Global Repository', subtitle: 'Store shared logic and reusable building blocks.', icon: BookOpen },
];

const moduleSectionMap = Object.entries(featureGroups).reduce((acc, [section, items]) => {
  items.forEach((item) => {
    acc[item.id] = section;
  });
  return acc;
}, {});

const fullDesktopTabs = new Set([
  'validate',
  'enrichment',
  'transformer',
  'mapper',
  'scraper',
  'matching',
  'pricing-intelligence',
  'visualizer',
  'pipeline',
  'scheduler',
  'pipeline-runs',
  'repository',
  'usage',
]);

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [moduleRailState, setModuleRailState] = useState('expanded');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [theme, setTheme] = useState('light');

  const [step, setStep] = useState(1);
  const [sessionId, setSessionId] = useState(null);
  const [columns, setColumns] = useState([]);
  const [filename, setFilename] = useState('');
  const [validationResults, setValidationResults] = useState(null);
  const [validationView, setValidationView] = useState('dataset');
  const [validationRules, setValidationRules] = useState([]);

  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [intendedTab, setIntendedTab] = useState(null);
  const [authDefaultMode, setAuthDefaultMode] = useState('login');
  const [recentJobs, setRecentJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [historyModuleTab, setHistoryModuleTab] = useState('validation');
  const [searchText, setSearchText] = useState('');
  const [backendStatus, setBackendStatus] = useState({ state: 'checking', message: 'Connecting to the local CleanFlow service...' });
  const [desktopRuntime, setDesktopRuntime] = useState(null);

  useEffect(() => {
    let isActive = true;

    const loadDesktopRuntime = async () => {
      if (!IS_DESKTOP_APP || !window.cleanflowDesktop?.getRuntimeInfo) return;
      try {
        const runtimeInfo = await window.cleanflowDesktop.getRuntimeInfo();
        if (isActive) {
          setDesktopRuntime(runtimeInfo);
        }
      } catch (error) {
        console.error('Failed to load desktop runtime info:', error);
      }
    };

    const checkBackendHealth = async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/health`);
        if (!isActive) return;
        if (data?.status === 'ok') {
          setBackendStatus({ state: 'online', message: 'Local desktop service is connected and ready.' });
          return;
        }
        if (data?.status === 'degraded') {
          setBackendStatus({ state: 'degraded', message: 'Desktop service is running, but its database connection is unavailable.' });
          return;
        }
        setBackendStatus({ state: 'offline', message: 'Unable to verify the desktop service status.' });
      } catch (error) {
        if (!isActive) return;
        setBackendStatus({ state: 'offline', message: 'CleanFlow Desktop cannot reach its local backend service.' });
      }
    };

    loadDesktopRuntime();
    checkBackendHealth();

    const intervalId = window.setInterval(checkBackendHealth, user ? 60000 : 15000);
    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [user]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.get(`${API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          setUser(res.data);
          setActiveTab('dashboard');
        })
        .catch(() => {
          localStorage.removeItem('token');
          setUser(null);
        });
    }
  }, []);

  const fetchRecentJobs = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setJobsLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/history/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const sorted = (res.data || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setRecentJobs(sorted);
    } catch (error) {
      console.error('Failed to fetch user history:', error);
    } finally {
      setJobsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setRecentJobs([]);
      return;
    }
    fetchRecentJobs();
  }, [user, activeTab]);

  const currentSection = moduleSectionMap[activeTab] || 'dashboard';
  const currentModules = featureGroups[currentSection] || featureGroups.dashboard;
  const activeSection = sectionItems.find((item) => item.id === currentSection);
  const activeModule = currentModules.find((item) => item.id === activeTab) || currentModules[0];
  const isDark = theme === 'dark';
  const isFullDesktopModule = fullDesktopTabs.has(activeTab);
  const moduleRailVisible = currentModules.length > 1 && moduleRailState !== 'hidden';
  const moduleRailCompact = moduleRailState === 'icons';

  const cycleModuleRail = () => {
    setModuleRailState((current) => {
      if (current === 'expanded') return 'icons';
      if (current === 'icons') return 'hidden';
      return 'expanded';
    });
  };

  const visibleJobs = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return recentJobs.filter((job) => {
      const jobModule = job.module || 'validation';
      const matchesModule = historyModuleTab === 'all' ? true : jobModule === historyModuleTab;
      if (!matchesModule) return false;
      if (!query) return true;
      return [job.file_name, job.filename, job.module, job.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [recentJobs, historyModuleTab, searchText]);

  const moduleCounts = useMemo(() => ({
    validation: recentJobs.filter((job) => (job.module || 'validation') === 'validation').length,
    enrichment: recentJobs.filter((job) => job.module === 'enrichment').length,
    mapper: recentJobs.filter((job) => job.module === 'mapper').length,
    scraper: recentJobs.filter((job) => job.module === 'scraper').length,
    matching: recentJobs.filter((job) => job.module === 'matching').length,
    pricing: recentJobs.filter((job) => job.module === 'pricing').length,
    pipeline: recentJobs.filter((job) => job.module === 'pipeline').length,
  }), [recentJobs]);

  const setModule = (tab) => {
    setActiveTab(tab);
    setIsMobileSidebarOpen(false);
  };

  const goToSection = (sectionId) => {
    const firstModule = featureGroups[sectionId]?.[0]?.id || 'dashboard';
    setModule(firstModule);
  };

  const handleFeatureAccess = (tabName) => {
    if (!user) {
      setIntendedTab(tabName);
      setAuthDefaultMode(tabName === 'validate' ? 'signup' : 'login');
      setIsAuthOpen(true);
      return;
    }

    if (tabName === 'validate') {
      setStep(1);
    }
    setModule(tabName);
  };

  const handleLogout = () => {
    const shouldLogout = window.confirm('Are you sure you want to log out?');
    if (!shouldLogout) return;

    localStorage.removeItem('token');
    setUser(null);
    setStep(1);
    setActiveTab('dashboard');
    setIsAuthOpen(false);
    setAuthDefaultMode('login');
  };

  const formatJobDate = (iso) => {
    try {
      return formatDateTimeInIST(iso);
    } catch {
      return iso;
    }
  };

  const getTabFromModule = (moduleName) => {
    if (moduleName === 'mapper') return 'mapper';
    if (moduleName === 'enrichment') return 'enrichment';
    if (moduleName === 'scraper') return 'scraper';
    if (moduleName === 'matching') return 'matching';
    if (moduleName === 'pricing') return 'pricing-intelligence';
    if (moduleName === 'pipeline') return 'pipeline-runs';
    return 'validate';
  };

  const resumeJob = (job) => {
    const targetTab = getTabFromModule(job.module);
    if (targetTab === 'validate') {
      setFilename(job.file_name || job.filename || '');
      setValidationRules(job.rules || []);
      const allColumns = job.column_stats ? Object.keys(job.column_stats) : [];
      const uniqueColumns = Array.from(new Set([...allColumns, ...(job.rules || []).map((rule) => rule.column).filter(Boolean)]));
      if (uniqueColumns.length > 0) {
        setColumns(uniqueColumns);
      }
      setValidationResults({
        total_rows: job.total_rows || 0,
        valid_rows: job.valid_rows || 0,
        invalid_rows: job.invalid_rows || 0,
        column_stats: job.column_stats || {},
        rules: job.rules || [],
      });
      setStep(3);
    }
    setModule(targetTab);
  };

  const deleteHistoryItem = async (jobId) => {
    if (!window.confirm('Delete this history item?')) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      await axios.delete(`${API_BASE}/history/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchRecentJobs();
    } catch (error) {
      console.error('Failed to delete history item:', error);
      alert('Failed to delete history item.');
    }
  };

  const clearHistory = async (moduleName) => {
    const title = moduleName === 'all' ? 'all history' : `${moduleName} history`;
    if (!window.confirm(`Clear ${title}? This cannot be undone.`)) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const url = moduleName === 'all'
        ? `${API_BASE}/history/jobs`
        : `${API_BASE}/history/jobs?module=${moduleName}`;
      await axios.delete(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchRecentJobs();
    } catch (error) {
      console.error('Failed to clear history:', error);
      alert('Failed to clear history.');
    }
  };

  const handleRunValidation = async (rules) => {
    if (!sessionId) {
      alert('This validation session is no longer active. Please upload the dataset again to run validation.');
      return;
    }

    try {
      const res = await axios.post(`${API_BASE}/validate/${sessionId}`, { rules });
      const nextResults = { ...res.data, rules };

      setValidationResults(nextResults);
      setStep(3);

      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        await axios.post(`${API_BASE}/history/jobs`, {
          session_id: sessionId,
          file_name: filename || 'Validation Job',
          rules,
          total_rows: nextResults.total_rows || 0,
          valid_rows: nextResults.valid_rows || 0,
          invalid_rows: nextResults.invalid_rows || 0,
          column_stats: nextResults.column_stats || {},
          module: 'validation',
        }, { headers });

        fetchRecentJobs();
      } catch (historyError) {
        console.error('Failed to save validation history:', historyError);
      }
    } catch (error) {
      alert(`Validation failed: ${error.response?.data?.detail || error.message}`);
    }
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
        <Surface className="overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.14),transparent_24%)]" />
          <div className="relative z-10">
            <Badge label="All original features restored" />
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight">
              Modern desktop workspace, with every major CleanFlow module still available.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-[var(--text-secondary)]">
              Use guided inputs for validation, cleaning, mapping, scraping, matching, orchestration, repository assets,
              usage insights, and execution history without dropping back to a cluttered interface.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryButton icon={Play} label="Open Validation" onClick={() => handleFeatureAccess('validate')} />
              <SecondaryButton icon={Wand2} label="Open Pipeline Builder" onClick={() => handleFeatureAccess('pipeline')} />
            </div>
            <div className="mt-10 grid gap-3 md:grid-cols-3">
              <StatTile title="Available modules" value="12" detail="Validation to orchestration" />
              <StatTile title="Recent jobs" value={String(recentJobs.length)} detail="Resume from logs anytime" />
              <StatTile title="Rows processed" value={recentJobs.reduce((acc, job) => acc + (job.total_rows || 0), 0).toLocaleString()} detail="Across tracked runs" />
            </div>
          </div>
        </Surface>

        <Surface>
          <SectionTitle eyebrow="Workspace Health" title="Desktop status" />
          <div className="mt-5 space-y-3">
            <InfoRow title="Backend" value={backendStatus.state} detail={backendStatus.message} />
            <InfoRow title="Theme" value={isDark ? 'Dark' : 'Light'} detail="Switch any time from the header." />
            <InfoRow title="Runtime" value={IS_DESKTOP_APP ? 'Desktop app' : 'Browser mode'} detail={desktopRuntime?.apiBaseUrl || 'Using current frontend runtime'} />
          </div>
        </Surface>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {featureCards.map(({ id, title, subtitle, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => handleFeatureAccess(id)}
            className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--panel)] p-6 text-left shadow-[var(--shadow-soft)] transition hover:-translate-y-1 hover:border-[var(--border-strong)]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              <Icon className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{subtitle}</p>
          </button>
        ))}
      </section>
    </div>
  );

  const renderValidation = () => (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-4 py-4 md:px-5">
      <div className="flex flex-col gap-4 rounded-[28px] border border-[var(--border-soft)] bg-[var(--panel)] px-5 py-4 shadow-[var(--shadow-soft)] lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3 className="text-[30px] font-semibold tracking-tight text-[var(--text-primary)]">Validation</h3>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">
            Upload your dataset, configure quality rules, and review the final validation results in one guided flow.
          </p>
        </div>

        <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
          <StepPill stepNumber={1} label="Connect Data" active={step === 1} completed={step > 1} />
          <StepPill stepNumber={2} label="Configure Rules" active={step === 2} completed={step > 2} />
          <StepPill stepNumber={3} label="Review Results" active={step === 3} completed={false} />
        </div>
      </div>

      {step === 1 && (
        <Surface className="p-5 md:p-6">
          <DataConnection
            compact={true}
            onUploadSuccess={(data) => {
              setSessionId(data.session_id);
              setColumns(data.columns || []);
              setFilename(data.filename || data.file_name || '');
              setValidationResults(null);
              setValidationRules([]);
              setValidationView('dataset');
              setStep(2);
            }}
          />
        </Surface>
      )}

      {step === 2 && (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Surface>
            <div className="flex items-center justify-between gap-3">
              <SectionTitle eyebrow="Preview" title={filename || 'Uploaded dataset'} />
              <div className="flex gap-2 rounded-2xl bg-[var(--panel-muted)] p-1">
                <button
                  type="button"
                  onClick={() => setValidationView('dataset')}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${validationView === 'dataset' ? 'bg-[var(--panel)] shadow-[var(--shadow-soft)]' : 'text-[var(--text-secondary)]'}`}
                >
                  Data
                </button>
                <button
                  type="button"
                  onClick={() => setValidationView('rules')}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${validationView === 'rules' ? 'bg-[var(--panel)] shadow-[var(--shadow-soft)]' : 'text-[var(--text-secondary)]'}`}
                >
                  Rules
                </button>
              </div>
            </div>

            <div className="mt-5">
              {validationView === 'dataset' && sessionId ? (
                <DatasetViewer
                  sessionId={sessionId}
                  tone="blue"
                  title="Validation Dataset"
                  subtitle="Review inserted rows before switching back to rules or running validation."
                />
              ) : (
                <div className="rounded-[24px] border border-dashed border-[var(--border-strong)] bg-[var(--panel-muted)] p-8 text-sm text-[var(--text-secondary)]">
                  Choose the rules tab to configure guided validation logic with inline help.
                </div>
              )}
            </div>
          </Surface>

          <Surface>
            <SectionTitle eyebrow="Smart Form" title="Validation rules" />
            <div className="mt-5">
              <RuleBuilder
                compact={true}
                columns={columns}
                initialRules={validationRules}
                onRulesChange={setValidationRules}
                onRunValidation={handleRunValidation}
                showRepoLibrary={true}
                user={user}
              />
            </div>
          </Surface>
        </div>
      )}

      {step === 3 && validationResults && (
        <ResultsDashboard
          results={validationResults}
          onReset={() => {
            setValidationResults(null);
            setColumns([]);
            setFilename('');
            setSessionId(null);
            setValidationView('dataset');
            setStep(1);
          }}
          onEditRules={() => {
            setValidationRules(validationResults?.rules || []);
            setValidationView('rules');
            setStep(2);
          }}
        />
      )}
    </div>
  );

  const renderLogs = () => (
    <div className="space-y-6">
      <Surface>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <SectionTitle eyebrow="Traceability" title="Recent execution logs" />
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Resume past runs, review module-specific history, and remove outdated records.
            </p>
          </div>
          <div className="flex gap-2">
            <SecondaryButton icon={RefreshCw} label="Refresh" onClick={fetchRecentJobs} />
            <button
              type="button"
              onClick={() => clearHistory(historyModuleTab)}
              className="inline-flex items-center gap-2 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-500/15 dark:text-rose-200"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            { id: 'validation', label: 'Validation', count: moduleCounts.validation },
            { id: 'enrichment', label: 'Cleaning', count: moduleCounts.enrichment },
            { id: 'mapper', label: 'Mapper', count: moduleCounts.mapper },
            { id: 'scraper', label: 'Scraper', count: moduleCounts.scraper },
            { id: 'matching', label: 'Matching', count: moduleCounts.matching },
            { id: 'pricing', label: 'Pricing', count: moduleCounts.pricing },
            { id: 'pipeline', label: 'Pipelines', count: moduleCounts.pipeline },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setHistoryModuleTab(tab.id)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${historyModuleTab === tab.id ? 'bg-[var(--accent-strong)] text-white' : 'bg-[var(--panel-muted)] text-[var(--text-secondary)]'}`}
            >
              {tab.label} <span className="ml-2 opacity-80">{tab.count}</span>
            </button>
          ))}
        </div>
      </Surface>

      <Surface>
        {jobsLoading ? (
          <div className="flex items-center gap-3 py-12 text-[var(--text-secondary)]">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            Loading execution history...
          </div>
        ) : visibleJobs.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[var(--border-strong)] bg-[var(--panel-muted)] p-10 text-center">
            <Logs className="mx-auto h-10 w-10 text-[var(--text-muted)]" />
            <p className="mt-4 text-lg font-semibold">No execution history in this module yet</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Run a workflow and it will appear here with resume and cleanup actions.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-[var(--border-soft)]">
            <table className="min-w-full divide-y divide-[var(--border-soft)] text-left text-sm">
              <thead className="bg-[var(--panel-muted)]">
                <tr>
                  {['Job', 'Module', 'Rows', 'Date', 'Actions'].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-semibold text-[var(--text-secondary)]">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)] bg-[var(--panel)]">
                {visibleJobs.map((job) => (
                  <tr key={job.id} className="transition hover:bg-[var(--panel-muted)]">
                    <td className="px-4 py-4">
                      <div className="font-semibold">{job.file_name || job.filename || 'Untitled Job'}</div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">{job.status || 'Completed'}</div>
                    </td>
                    <td className="px-4 py-4 capitalize text-[var(--text-secondary)]">{job.module || 'validation'}</td>
                    <td className="px-4 py-4">{(job.total_rows || 0).toLocaleString()}</td>
                    <td className="px-4 py-4 text-[var(--text-secondary)]">{formatJobDate(job.created_at)}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => resumeJob(job)}
                          className="rounded-xl border border-[var(--border-soft)] px-3 py-2 font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteHistoryItem(job.id)}
                          className="rounded-xl border border-rose-200 px-3 py-2 font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-500/20 dark:text-rose-200 dark:hover:bg-rose-500/10"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
    </div>
  );

  const renderWorkspaceSettings = () => (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Surface>
        <SectionTitle eyebrow="Appearance" title="Workspace settings" />
        <div className="mt-5 space-y-4">
          <SettingsRow
            title="Color mode"
            description="Switch between light and dark themes while keeping the same feature access."
            actionLabel={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            onAction={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
          />
          <SettingsRow
            title="Backend connection"
            description={backendStatus.message}
            actionLabel="Open logs"
            onAction={() => setModule('logs')}
          />
          <SettingsRow
            title="Feature access"
            description="All previous builders remain available through grouped module chips."
            actionLabel="Open tasks"
            onAction={() => setModule('validate')}
          />
        </div>
      </Surface>

      <Surface>
        <SectionTitle eyebrow="System" title="Reusable UI structure" />
        <div className="mt-5 space-y-3">
          <InfoRow title="Sidebar" value="Grouped navigation" detail="Dashboard, Tasks, Configuration, Logs, Settings." />
          <InfoRow title="Header" value="Module context" detail="Search, notifications, theme toggle, and active module chips." />
          <InfoRow title="Main area" value="Dynamic module content" detail="Existing feature screens render inside the new shell." />
          <InfoRow title="Scalability" value="Future modules ready" detail="Add new builders to a group without redesigning the frame." />
        </div>
      </Surface>
    </div>
  );

  const renderActiveModule = () => {
    if (activeTab === 'dashboard') return renderDashboard();
    if (activeTab === 'validate') return renderValidation();
    if (activeTab === 'repository') return <GlobalRepositoryBuilder user={user} />;
    if (activeTab === 'enrichment') return <EnrichmentBuilder user={user} onComplete={() => setModule('dashboard')} />;
    if (activeTab === 'scraper') return <ScraperBuilder onComplete={() => setModule('dashboard')} />;
    if (activeTab === 'mapper') return <SchemaMapper onComplete={() => setModule('dashboard')} />;
    if (activeTab === 'matching') return <DataMatchingBuilder />;
    if (activeTab === 'pricing-intelligence') return <PricingIntelligenceBuilder />;
    if (activeTab === 'visualizer') return <DataVisualizer />;
    if (activeTab === 'pipeline') return <PipelineBuilder onComplete={() => setModule('dashboard')} />;
    if (activeTab === 'scheduler') return <SchedulerBuilder />;
    if (activeTab === 'pipeline-runs') return <PipelineRuns />;
    if (activeTab === 'transformer') return <DataTransformer />;
    if (activeTab === 'usage') return <UsagePage user={user} />;
    if (activeTab === 'profile' && user) return <UserProfilePage user={user} onClose={() => setModule('dashboard')} onLogout={handleLogout} />;
    if (activeTab === 'logs') return renderLogs();
    if (activeTab === 'workspace-settings') return renderWorkspaceSettings();
    return renderDashboard();
  };

  if (!user) {
    return (
      <div className={isDark ? 'dark' : ''}>
        <div className="h-screen w-screen overflow-hidden bg-[var(--app-bg)]">
          <AuthModal
            isOpen={true}
            defaultMode={authDefaultMode}
            allowClose={false}
            connectionStatus={backendStatus.state}
            connectionMessage={backendStatus.message}
            isDesktop={IS_DESKTOP_APP}
            runtimeInfo={desktopRuntime}
            onClose={() => setIsAuthOpen(false)}
            onLoginSuccess={(loggedInUser) => {
              setUser(loggedInUser);
              fetchRecentJobs();
              if (intendedTab) {
                setActiveTab(intendedTab);
                if (intendedTab === 'validate') setStep(1);
                setIntendedTab(null);
              } else {
                setActiveTab('dashboard');
              }
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="cf-workspace h-screen w-screen overflow-hidden bg-[var(--app-bg)] text-[var(--text-primary)] transition-colors duration-300">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.1),transparent_24%),linear-gradient(180deg,var(--app-bg)_0%,var(--app-bg-elevated)_100%)]" />

        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen((current) => !current)}
            className="fixed left-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--panel)] shadow-[var(--shadow-soft)]"
          >
            {isMobileSidebarOpen ? <X className="h-5 w-5" /> : <ChevronDown className="h-5 w-5 rotate-[-90deg]" />}
          </button>
        </div>

        <div className="flex h-full">
          <aside className={`group fixed inset-y-0 left-0 z-30 border-r border-[var(--border-soft)] bg-[var(--panel)]/95 backdrop-blur-xl transition-all duration-300 lg:relative ${sidebarCollapsed ? 'w-[72px]' : 'w-[240px]'} ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((current) => !current)}
              className="absolute -right-3 top-6 z-40 hidden h-6 w-6 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--panel)] text-[var(--text-secondary)] shadow-sm opacity-0 transition-all hover:scale-110 hover:text-[var(--text-primary)] group-hover:opacity-100 lg:flex"
            >
              <ChevronsLeft className={`h-3 w-3 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
            </button>
            <div className="flex h-full flex-col px-3 py-3">
              <div className="flex items-center pb-3">
                <div className="overflow-hidden">
                  <p className={`text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] transition-opacity ${sidebarCollapsed ? 'opacity-0' : 'opacity-100'}`}>
                    CleanFlow
                  </p>
                  <h1 className={`mt-0.5 text-base font-semibold tracking-tight transition-opacity ${sidebarCollapsed ? 'opacity-0' : 'opacity-100'}`}>
                    Desktop Studio
                  </h1>
                </div>
              </div>

              <nav className="space-y-1">
                {sectionItems.map((item) => {
                  const Icon = item.icon;
                  const active = currentSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => goToSection(item.id)}
                      className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left transition ${active ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[var(--shadow-soft)]' : 'text-[var(--text-secondary)] hover:bg-[var(--panel-muted)] hover:text-[var(--text-primary)]'}`}
                    >
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-white/80 text-[var(--accent-strong)] dark:bg-white/10' : 'bg-[var(--panel)] text-[var(--text-muted)]'}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      {!sidebarCollapsed && (
                        <span className="flex-1 min-w-0">
                          <span className="block truncate text-xs font-medium">{item.label}</span>
                          <span className="block truncate text-[10px] leading-tight opacity-80 text-[var(--text-muted)]">
                            {item.id === 'tasks' ? 'All builders and workflows' : item.id === 'configuration' ? 'Repository and usage' : item.id === 'logs' ? 'Recent execution history' : item.id === 'settings' ? 'Profile and preferences' : 'Workspace overview'}
                          </span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              {!sidebarCollapsed && (
                <div className="mt-3 rounded-[20px] border border-[var(--border-soft)] bg-[var(--panel-muted)] p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Live Summary</p>
                  <div className="mt-2.5 space-y-1.5">
                    <MiniMetric label="Connected modules" value="12" />
                    <MiniMetric label="Recent jobs" value={String(recentJobs.length)} />
                    <MiniMetric label="Backend status" value={backendStatus.state} />
                  </div>
                </div>
              )}

              <div className="mt-auto rounded-[20px] border border-[var(--border-soft)] bg-[var(--panel)] p-2 shadow-[var(--shadow-soft)]">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                    <UserCircle2 className="h-4 w-4" />
                  </div>
                  {!sidebarCollapsed && (
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{user.full_name || 'My Account'}</p>
                      <p className="truncate text-[10px] text-[var(--text-muted)]">{user.email}</p>
                    </div>
                  )}
                  {!sidebarCollapsed && (
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-rose-500/10 hover:text-rose-500"
                      title="Log out"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </aside>

          {isMobileSidebarOpen && (
            <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />
          )}

          <div className="relative flex min-w-0 flex-1 min-h-0">
            {moduleRailVisible && (
              <aside className={`group hidden min-h-0 border-r border-[var(--border-soft)] bg-[var(--panel)]/88 backdrop-blur-xl lg:relative lg:flex lg:flex-col lg:z-10 ${moduleRailCompact ? 'w-[64px]' : 'w-[240px]'}`}>
                <button
                  type="button"
                  onClick={cycleModuleRail}
                  className="absolute -right-3 top-6 z-40 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--panel)] text-[var(--text-secondary)] shadow-sm opacity-0 transition-all hover:scale-110 hover:text-[var(--text-primary)] group-hover:opacity-100"
                >
                  <ChevronsLeft className={`h-3 w-3 transition-transform ${moduleRailCompact ? 'rotate-180' : ''}`} />
                </button>
                <div className="flex min-h-[46px] items-center border-b border-[var(--border-soft)] px-3 py-3">
                  {!moduleRailCompact && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">{activeSection?.label}</p>
                      <p className="mt-0.5 text-xs font-medium text-[var(--text-primary)]">Features</p>
                    </div>
                  )}
                </div>

                <div className="glass-scrollbar flex-1 overflow-y-auto px-3 py-3">
                  <div className="space-y-1">
                    {currentModules.map((item) => {
                      const Icon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setModule(item.id)}
                          className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${active ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[var(--shadow-soft)]' : 'text-[var(--text-secondary)] hover:bg-[var(--panel-muted)] hover:text-[var(--text-primary)]'}`}
                        >
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-white/80 text-[var(--accent-strong)] dark:bg-white/10' : 'bg-[var(--panel)] text-[var(--text-muted)]'}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          {!moduleRailCompact && (
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-medium">{item.label}</span>
                              <span className="block truncate text-[10px] leading-tight opacity-80 text-[var(--text-muted)]">{item.description}</span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </aside>
            )}

            {currentModules.length > 1 && moduleRailState === 'hidden' && (
              <button
                type="button"
                onClick={cycleModuleRail}
                className="absolute left-3 top-3 z-20 hidden h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--panel)]/95 text-[var(--text-secondary)] shadow-[var(--shadow-soft)] backdrop-blur-xl transition hover:text-[var(--text-primary)] lg:flex"
                title="Show feature rail"
              >
                <ChevronsLeft className="h-4 w-4 rotate-180" />
              </button>
            )}

            <div className="flex min-w-0 flex-1 flex-col min-h-0">
            <header className="shrink-0 border-b border-[var(--border-soft)] bg-[var(--panel)]/85 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-4 px-6 py-3">
                <div className="min-w-0">
                  <h2 className="truncate text-[28px] font-semibold tracking-tight">
                    {activeModule?.label || 'Overview'}
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden items-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-muted)] px-4 py-3 md:flex">
                    <Search className="h-4 w-4 text-[var(--text-muted)]" />
                    <input
                      value={searchText}
                      onChange={(event) => setSearchText(event.target.value)}
                      className="w-56 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
                      placeholder="Search jobs, modules, datasets"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-muted)] text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                  >
                    {isDark ? <SunMedium className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                  </button>
                  <button
                    type="button"
                    className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-muted)] text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                  >
                    <Bell className="h-5 w-5" />
                    <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[var(--accent-strong)]" />
                  </button>
                </div>
              </div>

            </header>

            <main className={`flex-1 min-h-0 ${isFullDesktopModule ? 'overflow-hidden px-0 py-0' : 'overflow-y-auto px-4 py-4 md:px-6 md:py-6'}`}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className={isFullDesktopModule ? 'h-full min-h-0' : ''}
                >
                  {renderActiveModule()}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
          </div>
        </div>

        <ChatBot />

        <AuthModal
          isOpen={isAuthOpen}
          defaultMode={authDefaultMode}
          connectionStatus={backendStatus.state}
          connectionMessage={backendStatus.message}
          isDesktop={IS_DESKTOP_APP}
          runtimeInfo={desktopRuntime}
          onClose={() => {
            setIsAuthOpen(false);
            setIntendedTab(null);
          }}
          onLoginSuccess={(loggedInUser) => {
            setUser(loggedInUser);
            fetchRecentJobs();
            if (intendedTab) {
              setActiveTab(intendedTab);
              if (intendedTab === 'validate') setStep(1);
              setIntendedTab(null);
            } else {
              setActiveTab('dashboard');
            }
            setIsAuthOpen(false);
          }}
        />
      </div>
    </div>
  );
}

function Surface({ children, className = '' }) {
  return (
    <section className={`relative rounded-[32px] border border-[var(--border-soft)] bg-[var(--panel)] p-6 shadow-[var(--shadow-soft)] ${className}`}>
      {children}
    </section>
  );
}

function SectionTitle({ eyebrow, title }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">{eyebrow}</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h3>
    </div>
  );
}

function Badge({ label }) {
  return <span className="rounded-full bg-[var(--accent-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">{label}</span>;
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-lg bg-[var(--panel)] p-2">
      <p className="text-[10px] text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

function StatTile({ title, value, detail }) {
  return (
    <div className="rounded-[24px] border border-[var(--border-soft)] bg-white/70 p-4 backdrop-blur dark:bg-white/5">
      <p className="text-sm text-[var(--text-secondary)]">{title}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{detail}</p>
    </div>
  );
}

function InfoRow({ title, value, detail }) {
  return (
    <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--panel-muted)] p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="font-semibold">{title}</p>
        <span className="rounded-full bg-[var(--panel)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
          {value}
        </span>
      </div>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">{detail}</p>
    </div>
  );
}

function StepPill({ stepNumber, active, completed, label }) {
  return (
    <span
      className={`inline-flex min-w-[160px] items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 transition ${
        active
          ? 'border-[var(--accent-strong)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
          : completed
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-[var(--border-soft)] bg-[var(--panel-muted)] text-[var(--text-secondary)]'
      }`}
    >
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">Step {stepNumber}</span>
        <span className="mt-1 text-sm font-semibold">{label}</span>
      </span>

      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
          active
            ? 'border-[var(--accent-strong)] bg-[var(--accent-strong)] text-white'
            : completed
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-[var(--border-strong)] text-[var(--text-muted)]'
        }`}
      >
        {completed ? <Check className="h-3.5 w-3.5" /> : <span className="text-[11px] font-bold">{stepNumber}</span>}
      </span>
    </span>
  );
}

function SettingsRow({ title, description, actionLabel, onAction }) {
  return (
    <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--panel-muted)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-lg">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
        </div>
        <button
          type="button"
          onClick={onAction}
          className="rounded-2xl bg-[var(--accent-strong)] px-4 py-2.5 text-sm font-semibold text-white"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

function PrimaryButton({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent-strong)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-strong)]"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function SecondaryButton({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--panel)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

export default App;
