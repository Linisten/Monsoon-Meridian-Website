import React, { useState, useEffect } from 'react';
import { Save, Building, Phone, Mail, MapPin, Receipt, Smartphone, CheckCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../config/supabaseClient';

const INSTAGRAM_HANDLE = 'monsoonmeridian';
const INSTAGRAM_URL    = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;

const Field = ({ label, icon: Icon, value, onChange, type = 'text' }) => (
  <div>
    <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--c-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
      <Icon size={15} /> {label}
    </label>
    <input 
      type={type} 
      value={value || ''} 
      onChange={e => onChange(e.target.value)} 
      placeholder={label} 
    />
  </div>
);

const Settings = () => {
  const [form, setForm] = useState({
    company_name: 'Monsoon Meridian',
    shop_name: 'Monsoon Meridian',
    address: '123 Premium Arcade, Business Bay',
    phone: '+91 9876543210',
    email: 'info@monsoonmeridian.com',
    gst_no: '32AABCU9603R1ZX',
    upi_id: '9846137892@rapl',
  });
  const [settingsId, setSettingsId] = useState(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data, error } = await supabase.from('settings').select('*').limit(1).single();
    if (!error && data) {
      setForm({
        company_name: data.company_name || '',
        shop_name: data.shop_name || '',
        address: data.address || '',
        phone: data.phone || '',
        email: data.email || '',
        gst_no: data.gst_no || '',
        upi_id: data.upi_id || '',
      });
      setSettingsId(data.id);
    }
    setLoading(false);
  };

  const handleChange = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const saveSettings = async () => {
    let error;
    if (settingsId) {
      ({ error } = await supabase.from('settings').update(form).eq('id', settingsId));
    } else {
      const res = await supabase.from('settings').insert([form]).select();
      error = res.error;
      if (!error && res.data?.[0]) setSettingsId(res.data[0].id);
    }
    if (error) return alert('Error saving settings: ' + error.message);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--c-text-secondary)', fontSize: '1.2rem' }}>Loading settings...</div>;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: 0 }}>Shop Settings</h1>
          <p style={{ color: 'var(--c-text-secondary)', margin: '4px 0 0 0' }}>This information appears on your receipts and reports.</p>
        </div>
        <button onClick={saveSettings} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: saved ? 'var(--c-success)' : 'var(--c-wave)', transition: 'background-color 0.3s' }}>
          {saved ? <CheckCircle size={22} /> : <Save size={22} />}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Business Info */}
      <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, borderBottom: '2px solid var(--c-border)', paddingBottom: '0.75rem' }}>
          Business Information
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <Field label="Company Name" icon={Building} value={form.company_name} onChange={v => handleChange('company_name', v)} />
          <Field label="Shop / Brand Name" icon={Building} value={form.shop_name} onChange={v => handleChange('shop_name', v)} />
        </div>
        <Field label="Address" icon={MapPin} value={form.address} onChange={v => handleChange('address', v)} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <Field label="Phone Number" icon={Phone} value={form.phone} onChange={v => handleChange('phone', v)} />
          <Field label="Email Address" icon={Mail} value={form.email} onChange={v => handleChange('email', v)} type="email" />
        </div>
      </div>

      {/* Tax & Payment */}
      <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, borderBottom: '2px solid var(--c-border)', paddingBottom: '0.75rem' }}>
          Tax & Payment Details
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <Field label="GST Registration Number" icon={Receipt} value={form.gst_no} onChange={v => handleChange('gst_no', v)} />
          <Field label="UPI Payment ID" icon={Smartphone} value={form.upi_id} onChange={v => handleChange('upi_id', v)} />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', padding: '1rem', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', alignItems: 'flex-start' }}>
          <Smartphone size={18} color="#2563eb" style={{ marginTop: 2 }} />
          <p style={{ margin: 0, color: '#1e40af', fontSize: '0.9rem' }}>
            Your UPI ID is used to generate live payment QR codes at checkout. Ensure it is active and linked to your business bank account.
          </p>
        </div>
      </div>


      {/* Receipt Preview */}
      <div className="card" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 1.5rem 0' }}>Receipt Preview</h2>
        <div style={{ background: '#f8fafc', border: '1px dashed var(--c-border)', borderRadius: 8, padding: '2rem', fontFamily: 'monospace', fontSize: '0.85rem', maxWidth: 340, color: '#0f172a' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', borderBottom: '1px dashed #94a3b8', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ fontWeight: 900, fontSize: '1.2rem' }}>{form.company_name}</div>
            <div>{form.address}</div>
            <div>Tel: {form.phone}</div>
            <div style={{ fontWeight: 700 }}>GSTIN: {form.gst_no}</div>
          </div>

          {/* Meta */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Date:</span><span>{new Date().toLocaleDateString()}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Invoice:</span><span>INV-12345</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Customer:</span><span>Walk-in</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Payment:</span><span>CASH</span></div>

          {/* Items sample */}
          <div style={{ borderTop: '1px dashed #94a3b8', marginTop: '0.75rem', paddingTop: '0.5rem', display: 'grid', gridTemplateColumns: '1fr 40px 60px', fontWeight: 700, marginBottom: '0.25rem' }}>
            <span>Item</span><span style={{ textAlign: 'center' }}>Qty</span><span style={{ textAlign: 'right' }}>Amt</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 60px', marginBottom: '2px' }}>
            <span>Sample Item</span><span style={{ textAlign: 'center' }}>2</span><span style={{ textAlign: 'right' }}>200.00</span>
          </div>

          {/* Totals */}
          <div style={{ borderTop: '1px dashed #94a3b8', marginTop: '0.75rem', paddingTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Gross Total</span><span>₹200.00</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, borderTop: '1px solid #94a3b8', marginTop: '4px', paddingTop: '4px' }}><span>NET TOTAL</span><span>₹200.00</span></div>
          </div>

          {/* Instagram QR */}
          <div style={{
            marginTop: '0.75rem',
            borderRadius: '10px',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
            padding: '1px',
          }}>
            <div style={{
              background: 'white',
              borderRadius: '9px',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.4rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <defs>
                    <linearGradient id="ig-prev" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#f09433"/>
                      <stop offset="50%" stopColor="#dc2743"/>
                      <stop offset="100%" stopColor="#bc1888"/>
                    </linearGradient>
                  </defs>
                  <rect x="2" y="2" width="20" height="20" rx="6" ry="6" stroke="url(#ig-prev)" strokeWidth="2" fill="none"/>
                  <circle cx="12" cy="12" r="4" stroke="url(#ig-prev)" strokeWidth="2" fill="none"/>
                  <circle cx="17.5" cy="6.5" r="1.2" fill="url(#ig-prev)"/>
                </svg>
                <span style={{ fontSize: '9px', fontWeight: 700, color: '#444', letterSpacing: '0.02em' }}>Follow us on Instagram</span>
              </div>
              <QRCodeSVG
                value={INSTAGRAM_URL}
                size={110}
                level="M"
                includeMargin={false}
                fgColor="#000000"
              />
              <div style={{
                fontSize: '11px',
                fontWeight: 900,
                letterSpacing: '0.08em',
                background: 'linear-gradient(90deg, #f09433, #dc2743, #bc1888)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                @{INSTAGRAM_HANDLE.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Thank you */}
          <div style={{ borderTop: '1px dashed #94a3b8', marginTop: '0.75rem', paddingTop: '0.5rem', textAlign: 'center', fontWeight: 700, letterSpacing: '0.05em' }}>
            *** THANK YOU — VISIT AGAIN ***
          </div>

        </div>
      </div>

    </div>
  );
};

export default Settings;
