import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import { Save, Plus, Trash2, Database, ArrowLeft } from 'lucide-react';

// ── Field schema config for each master type ─────────────────────────────────
const MASTER_CONFIG = {
  customer:  {
    label: 'Customer',
    fields: [
      { key: 'name',    label: 'Customer Name',  type: 'text',  required: true },
      { key: 'phone',   label: 'Phone Number',   type: 'tel'  },
      { key: 'email',   label: 'Email Address',  type: 'email' },
      { key: 'address', label: 'Address',        type: 'text'  },
    ],
  },
  supplier:  {
    label: 'Supplier',
    fields: [
      { key: 'name',           label: 'Supplier / Company Name', type: 'text', required: true },
      { key: 'contact_person', label: 'Contact Person',          type: 'text' },
      { key: 'phone',          label: 'Phone Number',            type: 'tel'  },
      { key: 'gst_no',         label: 'GST Number',              type: 'text' },
      { key: 'address',        label: 'Address',                 type: 'text' },
    ],
  },
  tax:       {
    label: 'Tax',
    fields: [
      { key: 'name',         label: 'Tax Name (e.g. GST 5%)', type: 'text',   required: true },
      { key: 'rate_percent', label: 'Rate (%)',                type: 'number' },
      { key: 'description',  label: 'Description',            type: 'text'   },
    ],
  },
  unit:      {
    label: 'Unit',
    fields: [
      { key: 'name',        label: 'Unit Name (e.g. KG)',  type: 'text', required: true },
      { key: 'description', label: 'Description',          type: 'text' },
    ],
  },
  packtype:  {
    label: 'Pack Type',
    fields: [
      { key: 'name',        label: 'Pack Type (e.g. Box)', type: 'text', required: true },
      { key: 'description', label: 'Description',          type: 'text' },
    ],
  },
  category:  {
    label: 'Item Category',
    fields: [
      { key: 'name',        label: 'Category Name', type: 'text', required: true },
      { key: 'description', label: 'Description',   type: 'text' },
    ],
  },
  company:   {
    label: 'Company',
    fields: [
      { key: 'name',    label: 'Company Name', type: 'text', required: true },
      { key: 'address', label: 'Address',      type: 'text' },
      { key: 'phone',   label: 'Phone',        type: 'tel'  },
      { key: 'email',   label: 'Email',        type: 'email' },
      { key: 'gst_no',  label: 'GST Number',   type: 'text' },
    ],
  },
  shop:      {
    label: 'Shop',
    fields: [
      { key: 'name',    label: 'Shop Name', type: 'text', required: true },
      { key: 'address', label: 'Address',   type: 'text' },
      { key: 'phone',   label: 'Phone',     type: 'tel'  },
    ],
  },
  users:     {
    label: 'User',
    fields: [
      { key: 'name',  label: 'Full Name',    type: 'text',  required: true },
      { key: 'email', label: 'Email',        type: 'email' },
      { key: 'role',  label: 'Role',         type: 'text'  },
    ],
  },
  date:      {
    label: 'Date Settings',
    fields: [
      { key: 'name',        label: 'Financial Year (e.g. 2026-27)', type: 'text', required: true },
      { key: 'description', label: 'Notes',                         type: 'text' },
    ],
  },
};

const FALLBACK = {
  label: 'Master',
  fields: [
    { key: 'name',        label: 'Name',        type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'text' },
  ],
};

// ── Component ─────────────────────────────────────────────────────────────────
const GenericMaster = () => {
  const { type } = useParams();
  const navigate = useNavigate();
  const config = MASTER_CONFIG[type] || FALLBACK;
  const fields  = config.fields;

  const [data,         setData]         = useState([]);
  const [activeRecord, setActiveRecord] = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [saved,        setSaved]        = useState(false);
  const [error,        setError]        = useState(null);
  const [search,       setSearch]       = useState('');

  useEffect(() => { fetchData(); }, [type]);

  const fetchData = async () => {
    setLoading(true); setError(null);
    const { data: rows, error: err } = await supabase.from(type).select('*').order('name');
    if (err) {
      setError(err.message);
      setData([]);
      setActiveRecord(null);
    } else {
      setData(rows || []);
      setActiveRecord(rows?.length ? rows[0] : makeEmpty());
    }
    setLoading(false);
  };

  const makeEmpty = () => {
    const r = {};
    fields.forEach(f => r[f.key] = '');
    return r;
  };

  const handleNew = () => setActiveRecord(makeEmpty());

  const handleChange = (key, val) => setActiveRecord(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    const reqField = fields.find(f => f.required);
    if (reqField && !activeRecord[reqField.key]) return alert(`${reqField.label} is required`);

    const payload = {};
    fields.forEach(f => payload[f.key] = activeRecord[f.key] || '');

    let err;
    if (activeRecord.id) {
      ({ error: err } = await supabase.from(type).update(payload).eq('id', activeRecord.id));
    } else {
      ({ error: err } = await supabase.from(type).insert([payload]));
    }
    if (err) return alert('Error: ' + err.message);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    fetchData();
  };

  const handleDelete = async () => {
    if (!activeRecord?.id) return;
    if (!confirm(`Delete "${activeRecord.name}"? This cannot be undone.`)) return;
    const { error: err } = await supabase.from(type).delete().eq('id', activeRecord.id);
    if (err) return alert('Error: ' + err.message);
    fetchData();
  };

  const filtered = data.filter(d => d.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate('/')} style={{ color: 'var(--c-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
            <ArrowLeft size={18} /> Back
          </button>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0, color: 'var(--c-wave)' }}>
            {config.label} Master
          </h1>
          <span style={{ padding: '0.25rem 0.75rem', background: '#dbeafe', color: '#1e40af', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700 }}>
            {data.length} records
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={handleNew} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} /> New
          </button>
          {activeRecord?.id && (
            <button onClick={handleDelete} className="btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Trash2 size={18} /> Delete
            </button>
          )}
          <button onClick={handleSave} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: saved ? 'var(--c-success)' : 'var(--c-wave)', transition: 'background 0.3s' }}>
            <Save size={18} /> {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="card" style={{ padding: '1.25rem', background: '#fee2e2', borderColor: '#f87171', color: '#991b1b' }}>
          <b>Database Error:</b> {error}
          <br /><small>Please run <code>supabase_masters.sql</code> in your Supabase SQL Editor to create all Master tables.</small>
        </div>
      )}

      {!error && (
        <div style={{ flex: 1, display: 'flex', gap: '1.5rem', minHeight: 0 }}>

          {/* LEFT: Record List */}
          <div className="card" style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column', padding: '1.25rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Database size={18} color="var(--c-wave)" />
              <span style={{ fontWeight: 800, fontSize: '1rem' }}>All {config.label}s</span>
            </div>
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ marginBottom: '0.75rem', fontSize: '0.9rem', padding: '0.6rem 0.8rem' }}
            />
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {loading && <p style={{ color: 'var(--c-text-secondary)', textAlign: 'center', paddingTop: '2rem' }}>Loading...</p>}
              {!loading && filtered.length === 0 && <p style={{ color: 'var(--c-text-secondary)', fontSize: '0.9rem' }}>No records yet. Click "New" to add one.</p>}
              {filtered.map(item => (
                <div
                  key={item.id}
                  onClick={() => setActiveRecord(item)}
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: 8,
                    border: '2px solid',
                    borderColor: activeRecord?.id === item.id ? 'var(--c-wave)' : 'var(--c-border)',
                    backgroundColor: activeRecord?.id === item.id ? '#eff6ff' : 'white',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    transition: 'all 0.1s',
                  }}
                >
                  {item.name}
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Edit Form */}
          <div className="card" style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 1.75rem 0', color: 'var(--c-text-primary)', borderBottom: '2px solid var(--c-border)', paddingBottom: '0.75rem' }}>
              {activeRecord?.id ? `Editing: ${activeRecord.name}` : `New ${config.label}`}
            </h3>
            {activeRecord ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {fields.map(f => (
                  <div key={f.key} style={{ gridColumn: ['address', 'description'].includes(f.key) ? 'span 2' : 'span 1' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--c-text-secondary)', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {f.label}{f.required && <span style={{ color: 'var(--c-danger)' }}> *</span>}
                    </label>
                    <input
                      type={f.type || 'text'}
                      value={activeRecord[f.key] || ''}
                      onChange={e => handleChange(f.key, e.target.value)}
                      placeholder={`Enter ${f.label}`}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--c-text-secondary)' }}>Select a record from the left or click "New" to create one.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GenericMaster;
