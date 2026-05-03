import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { Database, FolderOpen, Loader2, Plus, Server, ShieldCheck, X } from 'lucide-react';
import { API_BASE } from '../lib/runtimeConfig';
import { DB_DEFAULTS, EMPTY_CONNECTION_FORM } from '../lib/databaseConnections';

function buildPayload(form) {
  if (form.db_type === 'sqlite') {
    return {
      name: form.name.trim(),
      db_type: 'sqlite',
      host: form.host || 'localhost',
      port: 0,
      database: form.database.trim(),
      username: '',
      password: '',
      driver_mode: 'native',
      odbc_driver: '',
      dsn: '',
    };
  }

  return {
    ...form,
    name: form.name.trim(),
    host: String(form.host || '').trim(),
    database: String(form.database || '').trim(),
    username: String(form.username || '').trim(),
    password: String(form.password || ''),
    driver_mode: form.driver_mode || 'native',
    odbc_driver: String(form.odbc_driver || '').trim(),
    dsn: String(form.dsn || '').trim(),
    port: Number(form.port || 0),
  };
}

export default function DatabaseConnectionManager({
  onConnectionSaved,
  title = 'Add Connection',
  compact = false,
  initialOpen = false,
  className = '',
  buttonClassName = '',
  showInlineButton = true,
  helperText = 'Save a local or server database once, then reuse it across modules.',
}) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(EMPTY_CONNECTION_FORM);

  const token = localStorage.getItem('token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const isSQLite = form.db_type === 'sqlite';
  const isOdbc = form.driver_mode === 'odbc';

  const panelPad = compact ? 'p-4' : 'p-5';
  const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10 focus:outline-none';

  const canSubmit = useMemo(() => {
    if (!form.name.trim()) return false;
    if (isSQLite) return Boolean(form.database.trim());
    return Boolean(form.host.trim() && form.username.trim() && String(form.password || '').length > 0);
  }, [form, isSQLite]);

  const resetForm = () => {
    setForm(EMPTY_CONNECTION_FORM);
    setError('');
    setSuccess('');
  };

  const setDbType = (dbType) => {
    const defaults = DB_DEFAULTS[dbType] || DB_DEFAULTS.sqlite;
    setForm((current) => ({
      ...current,
      db_type: dbType,
      host: defaults.host,
      port: defaults.port,
      username: defaults.username,
      password: defaults.password,
      driver_mode: defaults.driver_mode,
      odbc_driver: defaults.odbc_driver,
      dsn: defaults.dsn,
      database: dbType === current.db_type ? current.database : '',
    }));
    setError('');
    setSuccess('');
  };

  const browseForSQLiteFile = async () => {
    try {
      const result = await window.cleanflowDesktop?.pickDatabaseFile?.();
      if (result?.canceled) return;
      if (result?.filePath) {
        setForm((current) => ({
          ...current,
          db_type: 'sqlite',
          host: 'localhost',
          port: 0,
          database: result.filePath,
          name: current.name || result.filePath.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || 'Local SQLite',
        }));
        setError('');
      }
    } catch (err) {
      setError(err?.message || 'Unable to open the local database picker.');
    }
  };

  const handleTest = async () => {
    if (!canSubmit) return;
    setIsTesting(true);
    setError('');
    setSuccess('');
    try {
      const payload = buildPayload(form);
      const res = await axios.post(`${API_BASE}/connections/test`, payload, { headers });
      if (res.data.status === 'success') {
        setSuccess('Connection test succeeded.');
      } else {
        setError(res.data.error || 'Connection test failed.');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || err.message || 'Connection test failed.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!canSubmit) return;
    setIsSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = buildPayload(form);
      const res = await axios.post(`${API_BASE}/connections`, payload, { headers });
      setSuccess('Connection saved successfully.');
      onConnectionSaved?.(res.data?.connection_id || null);
      resetForm();
      setIsOpen(false);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to save the connection.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={className}>
      {showInlineButton && !isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={buttonClassName || 'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-brand-blue/40 hover:text-brand-blue'}
        >
          <Plus size={15} />
          {title}
        </button>
      ) : null}

      {isOpen ? (
        <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${panelPad}`}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Database size={16} className="text-brand-blue" />
                <h4 className="text-sm font-black text-slate-800">{title}</h4>
              </div>
              <p className="mt-1 text-xs text-slate-500">{helperText}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                resetForm();
              }}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close connection form"
            >
              <X size={15} />
            </button>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Connection name"
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
            />

            <select
              className={inputClass}
              value={form.db_type}
              onChange={(e) => setDbType(e.target.value)}
            >
              <option value="sqlite">SQLite / Local DB File</option>
              <option value="postgresql">PostgreSQL</option>
              <option value="mysql">MySQL</option>
              <option value="mssql">MS SQL Server</option>
              <option value="oracle">Oracle</option>
            </select>

            {isSQLite ? (
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Local Database File
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="C:\\data\\warehouse.sqlite"
                    className={inputClass}
                    value={form.database}
                    onChange={(e) => setForm((current) => ({ ...current, database: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={browseForSQLiteFile}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-blue/30 hover:text-brand-blue"
                  >
                    <FolderOpen size={15} />
                    Browse
                  </button>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <ShieldCheck size={12} className="text-emerald-500" />
                  Use `.db`, `.sqlite`, `.sqlite3`, or similar local database files.
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_120px]">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Server / Host</label>
                    <div className="relative">
                      <Server size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="localhost"
                        className={`${inputClass} pl-9`}
                        value={form.host}
                        onChange={(e) => setForm((current) => ({ ...current, host: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Port</label>
                    <input
                      type="number"
                      placeholder="Optional"
                      className={inputClass}
                      value={form.port}
                      onChange={(e) => setForm((current) => ({ ...current, port: Number(e.target.value || 0) }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Connection Mode</label>
                    <select
                      className={inputClass}
                      value={form.driver_mode}
                      onChange={(e) => setForm((current) => ({ ...current, driver_mode: e.target.value }))}
                    >
                      <option value="native">Native Driver</option>
                      <option value="odbc">ODBC</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Database / Catalog</label>
                    <input
                      type="text"
                      placeholder="Optional"
                      className={inputClass}
                      value={form.database}
                      onChange={(e) => setForm((current) => ({ ...current, database: e.target.value }))}
                    />
                  </div>
                </div>

                {isOdbc ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <input
                      type="text"
                      placeholder="ODBC driver name (optional)"
                      className={inputClass}
                      value={form.odbc_driver}
                      onChange={(e) => setForm((current) => ({ ...current, odbc_driver: e.target.value }))}
                    />
                    <input
                      type="text"
                      placeholder="DSN (optional)"
                      className={inputClass}
                      value={form.dsn}
                      onChange={(e) => setForm((current) => ({ ...current, dsn: e.target.value }))}
                    />
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input
                    type="text"
                    placeholder="User ID"
                    className={inputClass}
                    value={form.username}
                    onChange={(e) => setForm((current) => ({ ...current, username: e.target.value }))}
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    className={inputClass}
                    value={form.password}
                    onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <ShieldCheck size={12} className="text-emerald-500" />
                  Server, user ID, and password are enough for many local/default-database connections. Database and ODBC driver are optional.
                </div>
              </>
            )}

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {success}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={handleTest}
                disabled={!canSubmit || isTesting || isSaving}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isTesting ? <Loader2 size={15} className="animate-spin" /> : null}
                Test Connection
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSubmit || isSaving || isTesting}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={15} className="animate-spin" /> : null}
                Save Connection
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
