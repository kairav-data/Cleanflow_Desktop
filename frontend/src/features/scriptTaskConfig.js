export const SCRIPT_NODE_KIND = 'script';
export const SCRIPT_NODE_LABEL = 'Execute Script';

export const DEFAULT_SQL_SCRIPT = `SELECT *
FROM input_df
LIMIT 100`;

export const DEFAULT_PYTHON_SCRIPT = `# df is the incoming Polars DataFrame
# Assign the next dataset to result
result = df`;

export const SCRIPT_LANGUAGE_META = {
  sql: {
    id: 'sql',
    label: 'SQL',
    tone: 'blue',
    accent: '#2563eb',
    pillClass: 'border-blue-200 bg-blue-50 text-blue-700',
    mutedPillClass: 'border-blue-100 bg-blue-50/60 text-blue-700',
    editorWrapClass: 'border-blue-200 bg-slate-950',
    editorTextClass: 'text-sky-100',
    editorHintClass: 'text-sky-200/75',
    helperText: 'Use input_df or df as the incoming table. CleanFlow runs DuckDB-compatible SQL and expects a SELECT result set.',
    syntaxButtonLabel: 'Check SQL Syntax',
    previewButtonLabel: 'Run SQL Preview',
    saveButtonLabel: 'Submit Script',
  },
  python: {
    id: 'python',
    label: 'Python',
    tone: 'emerald',
    accent: '#ca8a04',
    pillClass: 'border-amber-200 bg-amber-50 text-amber-700',
    mutedPillClass: 'border-amber-100 bg-amber-50/60 text-amber-700',
    editorWrapClass: 'border-amber-200 bg-slate-950',
    editorTextClass: 'text-amber-100',
    editorHintClass: 'text-amber-200/75',
    helperText: 'CleanFlow passes the incoming Polars DataFrame in as df. Assign your transformed dataset to result.',
    syntaxButtonLabel: 'Check Python Syntax',
    previewButtonLabel: 'Run Python Preview',
    saveButtonLabel: 'Submit Script',
  },
};

export const resolveScriptLanguage = (data = {}) => {
  const explicitLanguage = String(data?.scriptLanguage || data?.language || '')
    .trim()
    .toLowerCase();
  if (explicitLanguage === 'python') return 'python';
  if (explicitLanguage === 'sql') return 'sql';
  if (String(data?.pythonCode || '').trim() && !String(data?.sqlQuery || '').trim()) return 'python';
  return 'sql';
};

export const getScriptDrafts = (data = {}) => {
  const activeLanguage = resolveScriptLanguage(data);
  const unifiedCode = String(data?.scriptCode || '');

  return {
    sql:
      String(data?.sqlQuery || '').trim() ||
      (activeLanguage === 'sql' ? unifiedCode.trim() : '') ||
      DEFAULT_SQL_SCRIPT,
    python:
      String(data?.pythonCode || '').trim() ||
      (activeLanguage === 'python' ? unifiedCode.trim() : '') ||
      DEFAULT_PYTHON_SCRIPT,
  };
};

export const resolveScriptCode = (data = {}, language = resolveScriptLanguage(data)) => {
  const drafts = getScriptDrafts(data);
  return language === 'python' ? drafts.python : drafts.sql;
};

export const buildScriptNodeData = (
  currentData = {},
  language = resolveScriptLanguage(currentData),
  draftOverrides = {},
) => {
  const nextLanguage = language === 'python' ? 'python' : 'sql';
  const drafts = {
    ...getScriptDrafts(currentData),
    ...draftOverrides,
  };
  const activeCode = nextLanguage === 'python' ? drafts.python : drafts.sql;

  return {
    ...currentData,
    nodeType: SCRIPT_NODE_KIND,
    label: SCRIPT_NODE_LABEL,
    library: currentData?.library || 'sequence',
    scriptLanguage: nextLanguage,
    scriptCode: activeCode,
    sqlQuery: drafts.sql,
    pythonCode: drafts.python,
  };
};

export const isScriptConfigured = (data = {}) => Boolean(resolveScriptCode(data).trim());
