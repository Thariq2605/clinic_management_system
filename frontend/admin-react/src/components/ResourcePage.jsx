import { useEffect, useMemo, useState } from 'react';
import { adminApi, getErrorMessage } from '../services/api.js';
import { DataTable } from './DataTable.jsx';
import { ConfirmDialog, ErrorState, Loading } from './Feedback.jsx';
import { buildResourcePayload } from '../services/resourcePayload.js';
import { normalizeResourceValues, validateResource, validateResourceField } from '../services/resourceValidation.js';

const EMPTY_PARAMS = {};
function initialValues(fields, row = {}) { return Object.fromEntries(fields.map((f) => [f.name, row[f.name] ?? f.defaultValue ?? ''])); }
function Field({ field, value, onChange, error }) {
  const common = { id: field.name, name: field.name, value: value ?? '', required: field.required, disabled: field.disabled, onBlur: () => onChange(field.name, value, true), onChange: (e) => onChange(field.name, field.type === 'checkbox' ? e.target.checked : e.target.value), 'aria-invalid': !!error, 'aria-describedby': error ? `${field.name}-error` : undefined };
  return <label className={`form-field ${field.wide ? 'wide' : ''}`} htmlFor={field.name}><span>{field.label}{field.required && <i aria-hidden="true"> *</i>}</span>
    {field.type === 'select' ? <select {...common}><option value="">Select…</option>{(field.options || []).map((o) => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      : field.type === 'checkbox' ? <input {...common} type="checkbox" checked={!!value} />
        : field.type === 'textarea' ? <textarea {...common} rows="3" />
          : <input {...common} type={field.type || 'text'} min={field.min} max={field.max} step={field.step} maxLength={field.maxLength} autoComplete={field.autoComplete || 'off'} />}
    {error && <small id={`${field.name}-error`} className="field-error" role="alert">{error}</small>}</label>;
}

export default function ResourcePage({ title, description, endpoint, idKey, columns, fields, filters = [], searchHint = 'Search…', rowActions = true, detailRenderer, loadDependencies, baseParams = EMPTY_PARAMS }) {
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(null);
  const [search, setSearch] = useState(''), [filterValues, setFilterValues] = useState({}), [refresh, setRefresh] = useState(0);
  const [dialog, setDialog] = useState(null), [values, setValues] = useState({}), [fieldErrors, setFieldErrors] = useState({}), [touched, setTouched] = useState({}), [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null), [toast, setToast] = useState(null), [dependencies, setDependencies] = useState({});

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const [data, deps] = await Promise.all([adminApi.get(endpoint, { ...baseParams, search: search || undefined, ...filterValues }), loadDependencies ? loadDependencies() : {}]);
        if (!alive) return;
        setRows(Array.isArray(data) ? data : data?.results || []);
        setDependencies(deps || {});
      } catch (e) { if (alive) setError(e); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [endpoint, search, filterValues, refresh, loadDependencies, baseParams]);

  const configuredFields = useMemo(() => fields.map((f) => f.optionsFrom ? { ...f, options: dependencies[f.optionsFrom] || [] } : f), [fields, dependencies]);
  const configuredFilters = useMemo(() => filters.map((f) => f.optionsFrom ? { ...f, options: dependencies[f.optionsFrom] || [] } : f), [filters, dependencies]);
  const edit = (row) => { setDialog(row ? { mode: 'edit', row } : { mode: 'create' }); setValues(initialValues(fields, row)); setFieldErrors({}); setTouched({}); };
  const setField = (name, value, blur = false) => {
    setValues((previous) => {
      const next = { ...previous, [name]: value };
      if (blur || touched[name] || Object.keys(fieldErrors).length) {
        const field = configuredFields.filter((item) => item.name === name && !(dialog?.mode === 'edit' && item.createOnly) && !(dialog?.mode === 'create' && item.editOnly)).at(-1);
        const message = field ? validateResourceField(field, value, next) : '';
        setFieldErrors((errors) => {
          const updated = { ...errors };
          if (message) updated[name] = message; else delete updated[name];
          if (name === 'start_time' && updated.end_time) {
            const endField = configuredFields.find((item) => item.name === 'end_time');
            const endError = endField ? validateResourceField(endField, next.end_time, next) : '';
            if (endError) updated.end_time = endError; else delete updated.end_time;
          }
          return updated;
        });
      }
      return next;
    });
    if (blur) setTouched((previous) => ({ ...previous, [name]: true }));
  };
  const save = async (e) => {
    e.preventDefault();
    const formFields = configuredFields.filter((f) => !(dialog.mode === 'edit' && f.createOnly) && !(dialog.mode === 'create' && f.editOnly));
    const errors = validateResource(formFields, values);
    setFieldErrors(errors); setTouched(Object.fromEntries(formFields.map((field) => [field.name, true])));
    if (Object.keys(errors).length) return;
    setSaving(true);
    const payload = buildResourcePayload(fields, normalizeResourceValues(fields, values), dialog?.mode);
    try {
      const result = dialog.mode === 'edit' ? await adminApi.patch(`${endpoint}${dialog.row[idKey]}/`, payload) : await adminApi.post(endpoint, payload);
      setDialog(null); setRefresh((v) => v + 1); setToast({ type: 'success', message: dialog.mode === 'edit' ? 'Changes saved.' : 'Record created.' });
      if (result && typeof result === 'object' && result.detail) setToast({ type: 'success', message: String(result.detail) });
    } catch (err) { if (err.data && typeof err.data === 'object') setFieldErrors(err.data); else setFieldErrors({ _form: getErrorMessage(err) }); }
    finally { setSaving(false); }
  };
  const toggleStatus = async (row) => {
    try { await adminApi.patch(`${endpoint}${row[idKey]}/`, { is_active: !row.is_active }); setRefresh((v) => v + 1); setToast({ type: 'success', message: `Record ${row.is_active ? 'deactivated' : 'activated'}.` }); }
    catch (e) { setToast({ type: 'error', message: getErrorMessage(e) }); }
  };
  const remove = async () => {
    const row = confirm; setConfirm(null);
    try { await adminApi.delete(`${endpoint}${row[idKey]}/`); setRefresh((v) => v + 1); setToast({ type: 'success', message: 'Record deleted.' }); }
    catch (e) { setToast({ type: 'error', message: getErrorMessage(e) }); }
  };
  return <section className="page">
    <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{rowActions && <button className="button primary" onClick={() => edit(null)}>＋ Add {title.replace(/s$/, '')}</button>}</div>
    <div className="toolbar"><label className="search-box"><span>⌕</span><input aria-label={`Search ${title}`} placeholder={searchHint} value={search} onChange={(e) => setSearch(e.target.value)} /></label>{configuredFilters.map((f) => <label className="filter-label" key={f.name}><span className="sr-only">{f.label}</span>{f.type === 'date' ? <input type="date" aria-label={f.label} value={filterValues[f.name] || ''} onChange={(e) => setFilterValues((v) => ({ ...v, [f.name]: e.target.value }))} /> : <select aria-label={f.label} value={filterValues[f.name] || ''} onChange={(e) => setFilterValues((v) => ({ ...v, [f.name]: e.target.value }))}><option value="">All {f.label.toLowerCase()}</option>{(f.options || []).map((o) => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}</select>}</label>)}</div>
    <div className="panel">{loading ? <Loading /> : error ? <ErrorState error={error} onRetry={() => setRefresh((v) => v + 1)} /> : <DataTable columns={columns} rows={rows} rowKey={(r) => r[idKey]} actions={rowActions ? (row) => <>{detailRenderer && <button className="text-button" onClick={(e) => { e.stopPropagation(); setDialog({ mode: 'detail', row }); }}>View profile</button>}<button className="text-button" onClick={(e) => { e.stopPropagation(); edit(row); }}>Edit</button>{typeof row.is_active === 'boolean' && <button className="text-button" onClick={(e) => { e.stopPropagation(); toggleStatus(row); }}>{row.is_active ? 'Deactivate' : 'Activate'}</button>}<button className="text-button danger-text" onClick={(e) => { e.stopPropagation(); setConfirm(row); }}>Delete</button></> : undefined} />}</div>
    {dialog && <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setDialog(null)}><section className="dialog large" role="dialog" aria-modal="true" aria-labelledby="resource-dialog-title"><div className="dialog-head"><div><h2 id="resource-dialog-title">{dialog.mode === 'detail' ? `${title} details` : `${dialog.mode === 'edit' ? 'Edit' : 'Add'} ${title.replace(/s$/, '')}`}</h2><p>{dialog.mode === 'detail' ? `Record #${dialog.row[idKey]}` : 'Fields marked * are required.'}</p></div><button className="icon-button" aria-label="Close dialog" onClick={() => setDialog(null)}>×</button></div>
      {dialog.mode === 'detail' ? detailRenderer(dialog.row) : <form onSubmit={save} noValidate><div className="form-grid">{configuredFields.filter((f) => !(dialog.mode === 'edit' && f.createOnly) && !(dialog.mode === 'create' && f.editOnly)).map((f, i) => <Field key={`${f.name}-${i}`} field={f} value={values[f.name]} onChange={setField} error={fieldErrors[f.name]?.join?.(' ') || fieldErrors[f.name]} />)}</div>{(fieldErrors._form || fieldErrors.non_field_errors) && <div className="alert error" role="alert">{fieldErrors._form || fieldErrors.non_field_errors?.join?.(' ') || fieldErrors.non_field_errors}</div>}<div className="dialog-actions"><button type="button" className="button" onClick={() => setDialog(null)} disabled={saving}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div></form>}</section></div>}
    <ConfirmDialog open={!!confirm} title="Delete this record?" onCancel={() => setConfirm(null)} onConfirm={remove}><p>This action may be rejected when related clinic records depend on it.</p></ConfirmDialog>
    {toast && <div className={`toast ${toast.type}`} role="status">{toast.message}<button onClick={() => setToast(null)} aria-label="Dismiss">×</button></div>}
  </section>;
}
