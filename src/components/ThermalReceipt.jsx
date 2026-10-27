import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import logoUrl from '../assets/logo.jpg';

const INSTAGRAM_HANDLE = 'monsoonmeridian';
const INSTAGRAM_URL    = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;

const formatItemName = (name) => {
  if (!name) return 'Item';
  const max = 22; // matches print server limit for single line
  if (name.length <= max) return name;
  return name.substring(0, max - 10) + "..." + name.slice(-7);
};

const ThermalReceipt = ({ tx, settings }) => {
  if (!tx) return null;
  const netAmount     = tx.total_amount || 0;
  const taxPercent    = tx.tax_percent ?? 0;
  const discountAmt   = tx.discount_amount || 0;
  const grossTotal    = tx.gross_total || netAmount; // raw cart total before discount
  const afterDiscount = grossTotal - discountAmt;
  const taxAmt        = afterDiscount * (taxPercent / 100);
  const beforeRound   = afterDiscount + taxAmt;
  const roundOff      = netAmount - beforeRound; // stored netAmount is already rounded

  const invoiceId = tx.id ? String(tx.id).substring(0, 8) : 'NA';
  const dateStr = tx.date 
    ? (tx.date.includes(',') ? tx.date.split(',')[0] : tx.date) 
    : (tx.created_at ? new Date(tx.created_at).toLocaleDateString() : new Date().toLocaleDateString());

  return (
    <div id="thermal-receipt" style={{ backgroundColor: 'white', padding: '5px', width: '100%', boxSizing: 'border-box', fontFamily: "'Inter', sans-serif", fontSize: '13px', color: '#000', fontWeight: 500, lineHeight: 1.3 }}>
      {/* ── Header ── */}
      <div style={{ textAlign: 'center', borderBottom: '1.5px solid #000', paddingBottom: '0.5rem', marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img src={logoUrl} alt="Logo" style={{ width: '300px', height: '120px', objectFit: 'contain', marginBottom: '8px' }} onError={(e) => e.target.style.display = 'none'} />
        {settings?.address && <p style={{ margin: '4px 0', fontSize: '13px', color: '#000', fontWeight: 700 }}>{settings.address}</p>}
        <div style={{ margin: '0', fontSize: '12px', color: '#000', fontWeight: 700 }}>
          {settings?.phone && <div>Tel: {settings.phone}</div>}
          {settings?.gst_no && <div>GSTIN: {settings.gst_no}</div>}
        </div>
      </div>

      {/* ── Meta ── */}
      <div style={{ marginBottom: '0.75rem', color: '#000', fontSize: '13px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', color: '#000' }}><b>Invoice:</b><span style={{fontWeight: 950}}>{invoiceId}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', color: '#000' }}><b>Date:</b><span style={{fontWeight: 950}}>{dateStr}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', color: '#000' }}><b>Customer:</b><span style={{fontWeight: 950}}>{tx.customer_name || 'Walk-in'}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000' }}><b>Payment:</b><span style={{fontWeight: 950}}>{tx.payment_method || 'CASH'}</span></div>
      </div>

      {/* ── Items ── */}
      <div style={{ borderBottom: '1.5px solid #000', paddingBottom: '2px', marginBottom: '3px', display: 'grid', gridTemplateColumns: '1fr 45px 65px 75px', fontWeight: 800, fontSize: '11px', color: '#000', textTransform: 'uppercase' }}>
        <span>Item</span><span style={{ textAlign: 'right' }}>Qty</span><span style={{ textAlign: 'right' }}>Rate</span><span style={{ textAlign: 'right' }}>Amt</span>
      </div>
      {(tx.items_json || []).map((it, i) => {
        const rate = it.price || 0;
        const qNum = it.qty || 1;
        
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 45px 65px 75px', margin: '2px 0', fontSize: '12px', color: '#000', fontWeight: 800 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatItemName(it.name)}</span>
            <span style={{ textAlign: 'right' }}>{qNum}</span>
            <span style={{ textAlign: 'right' }}>{rate.toFixed(2)}</span>
            <span style={{ textAlign: 'right' }}>{(rate * qNum).toFixed(2)}</span>
          </div>
        );
      })}

      {/* ── Totals ── */}
      <div style={{ borderTop: '2.5px dashed #000', marginTop: '8px', paddingTop: '8px', color: '#000', fontSize: '13px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', color: '#000' }}><span>Gross Total</span><span style={{fontWeight: 950}}>₹{grossTotal.toFixed(2)}</span></div>
        {discountAmt > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', color: '#000' }}><span>Discount</span><span style={{fontWeight: 950}}>-₹{discountAmt.toFixed(2)}</span></div>
        )}
        
        {taxPercent > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '3px', color: '#000' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>CGST ({(taxPercent/2).toFixed(1)}%)</span>
              <span style={{fontWeight: 950}}>₹{(taxAmt/2).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>SGST ({(taxPercent/2).toFixed(1)}%)</span>
              <span style={{fontWeight: 950}}>₹{(taxAmt/2).toFixed(2)}</span>
            </div>
          </div>
        )}

        {Math.abs(roundOff) > 0.001 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#000', fontWeight: 700 }}><span>Round Off</span><span>{roundOff >= 0 ? '+' : ''}{roundOff.toFixed(2)}</span></div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.25rem', borderTop: '2px solid #000', marginTop: '6px', paddingTop: '6px', color: '#000' }}>
          <span>NET AMOUNT</span><span>₹{netAmount.toFixed(2)}</span>
        </div>
      </div>

      <div style={{
        marginTop: '0.75rem',
        borderRadius: '8px',
        border: '1.5px solid #000',
        padding: '0.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.4rem',
      }}>
        {/* Mini Instagram wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="20" height="20" rx="6" ry="6"/>
            <circle cx="12" cy="12" r="4"/>
            <circle cx="17.5" cy="6.5" r="1.2" fill="#000"/>
          </svg>
          <span style={{ fontSize: '12px', fontWeight: 900, color: '#000', fontFamily: 'monospace', letterSpacing: '0.02em' }}>Follow us on Instagram</span>
        </div>

        {/* QR Code */}
        <QRCodeSVG
          value={INSTAGRAM_URL}
          size={110}
          level="M"
          includeMargin={false}
          fgColor="#000000"
        />

        {/* Handle */}
        <div style={{
          fontSize: '13px',
          fontWeight: 900,
          letterSpacing: '0.05em',
          color: '#000',
          fontFamily: "'Inter', sans-serif",
          borderTop: '1px solid #000',
          paddingTop: '2px',
          marginTop: '2px'
        }}>
          @{INSTAGRAM_HANDLE.toUpperCase()}
        </div>
      </div>

      {/* ── Thank You ── */}
      <div style={{ textAlign: 'center', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1.2px dashed #000' }}>
        <p style={{ margin: 0, fontWeight: 900, letterSpacing: '0.02em', fontSize: '13px', color: '#000' }}>*** THANK YOU — VISIT AGAIN ***</p>
      </div>
    </div>
  );
};

export default ThermalReceipt;
