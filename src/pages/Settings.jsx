import React, { useState, useEffect } from 'react';
import { Save, Building, Phone, Mail, MapPin, Receipt, Smartphone, CheckCircle, Printer, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../config/supabaseClient';
import serialHelper from '../utils/serialHelper';
import SearchableSelect from '../components/SearchableSelect';

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
    thermal_printer_name: '',
  });
  const [isConnected, setIsConnected] = useState(false);
  const [connectionType, setConnectionType] = useState(null);
  const [settingsId, setSettingsId] = useState(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const connectSerial = async () => {
    try {
      await serialHelper.requestPort();
      setIsConnected(true);
      setConnectionType('Serial');
      alert('Serial Printer Connected Successfully!');
    } catch (err) {
      alert('Serial Connection Failed: ' + err.message);
    }
  };

  const connectUsb = async () => {
    try {
      await serialHelper.requestUsbPort();
      setIsConnected(true);
      setConnectionType('USB');
      alert('USB Printer Connected Successfully!');
    } catch (err) {
      alert('USB Connection Failed: ' + err.message);
    }
  };

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
        thermal_printer_name: data.thermal_printer_name || '',
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
    <div className="settings-container" style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <style>{`
        @media (max-width: 768px) {
          .settings-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 1.5rem !important;
          }
          .settings-header button {
            width: 100% !important;
          }
          .settings-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="settings-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
        <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <Field label="Company Name" icon={Building} value={form.company_name} onChange={v => handleChange('company_name', v)} />
          <Field label="Shop / Brand Name" icon={Building} value={form.shop_name} onChange={v => handleChange('shop_name', v)} />
        </div>
        <Field label="Address" icon={MapPin} value={form.address} onChange={v => handleChange('address', v)} />
        <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <Field label="Phone Number" icon={Phone} value={form.phone} onChange={v => handleChange('phone', v)} />
          <Field label="Email Address" icon={Mail} value={form.email} onChange={v => handleChange('email', v)} type="email" />
        </div>
      </div>

      {/* Tax & Payment */}
      <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, borderBottom: '2px solid var(--c-border)', paddingBottom: '0.75rem' }}>
          Tax & Payment Details
        </h2>
        <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <Field label="GST Registration Number" icon={Receipt} value={form.gst_no} onChange={v => handleChange('gst_no', v)} />
          <Field label="UPI Payment ID" icon={Smartphone} value={form.upi_id} onChange={v => handleChange('upi_id', v)} />
        </div>
      </div>

      {/* Hardware / Printer Settings */}
      <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--c-border)', paddingBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>
            Hardware & Printing
          </h2>
          <div style={{ padding: '4px 12px', background: 'var(--c-success)', color: 'white', borderRadius: 20, fontSize: '0.75rem', fontWeight: 800 }}>
            FREE DRIVER ACTIVE
          </div>
        </div>

        <div style={{ padding: '1.5rem', background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: 12, textAlign: 'center' }}>
          <Printer size={32} style={{ color: 'var(--c-text-secondary)', marginBottom: '0.5rem' }} />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Direct Hardware Connection</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--c-text-secondary)', margin: '0.5rem 0 1rem 0' }}>
            Connect directly to your USB/Serial printer from the browser. 
            {isConnected ? <span style={{ color: 'var(--c-success)', fontWeight: 700 }}> (Connected via {connectionType})</span> : ' (Not Connected)'}
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={connectSerial} className="btn-primary" style={{ padding: '0.5rem 1.5rem' }}>
              Connect via Serial (VCOM)
            </button>
            <button onClick={connectUsb} className="btn-primary" style={{ padding: '0.5rem 1.5rem', backgroundColor: '#8b5cf6' }}>
              Connect via USB (Raw)
            </button>
          </div>
        </div>

        <button 
          onClick={async () => {
            try {
              const demoTx = { total_amount: 0, items_json: [], id: 'TEST', date: new Date().toLocaleString() };
              await serialHelper.write('\x1B\x40\x1B\x61\x01TEST PRINT\x0A\x1B\x64\x06\x1D\x56\x00');
            } catch (e) { alert('Test failed: ' + e.message); }
          }}
          className="btn-secondary" style={{ width: '100%' }} disabled={!isConnected}
        >Test Print</button>

        <p style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)', marginTop: '0.5rem' }}>
          Direct printing uses ESC/POS commands for faster, cleaner receipts without a print dialog.
        </p>
      </div>


      {/* Receipt Preview */}
      <div className="card" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 1.5rem 0' }}>Receipt Preview</h2>
        <div style={{ background: 'white', border: '3px solid #000', borderRadius: 8, padding: '2rem', fontFamily: 'monospace', fontSize: '1.1rem', maxWidth: 380, color: '#000', fontWeight: 600 }}>

          {/* Header */}
          <div style={{ textAlign: 'center', borderBottom: '2.5px dashed #000', paddingBottom: '1rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img src="/logo.jpg" alt="Logo" style={{ width: '300px', height: '120px', objectFit: 'contain', marginBottom: '10px' }} onError={(e) => e.target.style.display = 'none'} />
            {form.address && <div style={{ fontSize: '14px', fontWeight: 700, margin: '4px 0' }}>{form.address}</div>}
            <div style={{ fontSize: '14px', fontWeight: 700 }}>
              {form.phone && `Tel: ${form.phone}`}
              {form.phone && form.gst_no && ' | '}
              {form.gst_no && `GSTIN: ${form.gst_no}`}
            </div>
          </div>

          {/* Meta */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', marginBottom: '4px' }}><span>Date:</span><span style={{fontWeight: 900}}>{new Date().toLocaleDateString()}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', marginBottom: '4px' }}><span>Invoice:</span><span style={{fontWeight: 900}}>INV-12345</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', marginBottom: '4px' }}><span>Customer:</span><span style={{fontWeight: 900}}>Walk-in</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px' }}><span>Payment:</span><span style={{fontWeight: 900}}>CASH</span></div>

          {/* Items sample */}
          <div style={{ borderTop: '2px dashed #000', marginTop: '1rem', paddingTop: '0.5rem', display: 'grid', gridTemplateColumns: '1fr 60px 60px', fontWeight: 800, marginBottom: '0.5rem' }}>
            <span>Item</span><span style={{ textAlign: 'center' }}>Qty</span><span style={{ textAlign: 'right' }}>Amt</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px', marginBottom: '4px', fontSize: '15px' }}>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Sample Item</span><span style={{ textAlign: 'center' }}>2 nos</span><span style={{ textAlign: 'right' }}>200.00</span>
          </div>

          {/* Totals */}
          <div style={{ borderTop: '2.5px dashed #000', marginTop: '1rem', paddingTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', color: '#000', marginBottom: '3px' }}><span>Gross Total</span><span style={{fontWeight: 900}}>₹200.00</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', color: '#000', marginBottom: '3px' }}><span>Discount</span><span style={{fontWeight: 900}}>-₹0.00</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', color: '#000', marginBottom: '3px' }}><span>Tax (18%)</span><span style={{fontWeight: 900}}>+₹36.00</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, borderTop: '3px solid #000', marginTop: '8px', paddingTop: '8px', fontSize: '1.25rem' }}><span>NET AMOUNT DUE</span><span>₹236.00</span></div>
          </div>

          {/* Instagram QR */}
          <div style={{
            marginTop: '0.75rem',
            borderRadius: '10px',
            border: '1px solid #000',
            padding: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.4rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="6" ry="6"/>
                <circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="1.2" fill="#000"/>
              </svg>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#000', letterSpacing: '0.02em' }}>Follow us on Instagram</span>
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
              color: '#000'
            }}>
              @{INSTAGRAM_HANDLE.toUpperCase()}
            </div>
          </div>

          {/* Thank you */}
          <div style={{ borderTop: '2.5px dashed #000', marginTop: '1rem', paddingTop: '1rem', textAlign: 'center', fontWeight: 900, letterSpacing: '0.02em', color: '#000', fontSize: '16px' }}>
            *** THANK YOU — VISIT AGAIN ***
          </div>

        </div>
      </div>

    </div>
  );
};

export default Settings;
