import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle, X, RefreshCw, Smartphone, Clock } from 'lucide-react';

const UPI_TIMEOUT_SECONDS = 300; // 5 minute payment window

// App icon images via public brand logos (SVG inline)
const AppBadge = ({ name, color, icon }) => (
  <div title={`Pay via ${name}`} style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', cursor: 'pointer',
  }}>
    <div style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
      <span style={{ color: 'white', fontWeight: 900, fontSize: '1rem' }}>{icon}</span>
    </div>
    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{name}</span>
  </div>
);

const UpiPaymentModal = ({
  upiId,
  payeeName,
  amount,
  onConfirm,   // called when cashier confirms payment received
  onCancel,    // called when dismissed
}) => {
  const [secondsLeft, setSecondsLeft] = useState(UPI_TIMEOUT_SECONDS);
  const [expired, setExpired]         = useState(false);
  const [pulse,   setPulse]           = useState(false);
  const intervalRef = useRef(null);

  // ── Optimized UPI String ──
  // Reverting to the most basic format (only pa, pn, am, cu)
  // This is highly compatible with P2P accounts like yours in Google Pay.
  const cleanUpiId = upiId.toLowerCase().trim();
  const cleanName  = payeeName.replace(/[^a-zA-Z0-9\s]/g, '').slice(0, 20); // Clean name, max 20 chars
  
  const baseParams = `pa=${cleanUpiId}&pn=${encodeURIComponent(cleanName)}&am=${amount.toFixed(2)}&cu=INR`;
  const upiString = `upi://pay?${baseParams}`;

  // Individual app deep links (GPay, PhonePe, Paytm, BHIM)
  const appLinks = {
    gpay:    `gpay://upi/pay?${baseParams}`,
    phonepe: `phonepe://pay?${baseParams}`,
    paytm:   `paytmmp://pay?${baseParams}`,
    bhim:    `upi://pay?${baseParams}`,
  };

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(intervalRef.current);
          setExpired(true);
          return 0;
        }
        return s - 1;
      });
      // QR pulse every 30s to show it's alive
      if (secondsLeft % 30 === 0) setPulse(p => !p);
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const reset = () => {
    setSecondsLeft(UPI_TIMEOUT_SECONDS);
    setExpired(false);
  };

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');
  const progress = (secondsLeft / UPI_TIMEOUT_SECONDS) * 100;
  const timerColor = secondsLeft > 120 ? '#22c55e' : secondsLeft > 30 ? '#f59e0b' : '#ef4444';

  return (
    /* Backdrop */
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(2,8,23,0.82)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '1.5rem',
    }}>
      <div style={{
        width: '100%', maxWidth: 520,
        background: 'white', borderRadius: 24,
        overflow: 'hidden', boxShadow: '0 32px 64px rgba(0,0,0,0.4)',
      }}>
        {/* — Top bar — */}
        <div style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Smartphone size={24} color="#a5f3fc" />
            <div>
              <div style={{ color: 'white', fontWeight: 800, fontSize: '1.2rem' }}>UPI Payment</div>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Zero-fee instant transfer</div>
            </div>
          </div>
          <button onClick={onCancel} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
            <X size={20} />
          </button>
        </div>

        {/* — Amount Hero — */}
        <div style={{ background: '#f8fafc', padding: '1.25rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Amount to Collect</div>
            <div style={{ fontSize: '2.8rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>₹{amount.toFixed(2)}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem' }}>Payee: <b style={{ color: '#334155' }}>{payeeName}</b></div>
          </div>
          {/* Countdown Timer */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', width: 80, height: 80 }}>
              <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="40" cy="40" r="34" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                <circle cx="40" cy="40" r="34" fill="none" stroke={timerColor} strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress / 100)}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: timerColor }}>
                  <Clock size={12} />
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: timerColor, lineHeight: 1 }}>{mins}:{secs}</div>
              </div>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.3rem', fontWeight: 700 }}>TIME LEFT</div>
          </div>
        </div>

        {expired ? (
          /* — Expired State — */
          <div style={{ padding: '3rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontSize: '3rem' }}>⏰</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444' }}>QR Code Expired</div>
            <p style={{ color: '#64748b', margin: 0 }}>The payment window has closed. Generate a new QR code.</p>
            <button onClick={reset} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.85rem 2rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>
              <RefreshCw size={18} /> Generate New QR
            </button>
          </div>
        ) : (
          /* — Active QR State — */
          <div style={{ padding: '1.75rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
            
            {/* QR Code */}
            <div style={{
              padding: '1.25rem', background: 'white', borderRadius: 16,
              border: '3px solid #e2e8f0',
              boxShadow: pulse ? '0 0 0 4px rgba(59,130,246,0.15)' : 'none',
              transition: 'box-shadow 0.5s',
            }}>
              <QRCodeSVG
                value={upiString}
                size={220}
                level="M"
                includeMargin={true}
              />
            </div>

            {/* UPI ID label */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>UPI ID</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', fontFamily: 'monospace', background: '#f1f5f9', padding: '0.4rem 1rem', borderRadius: 8, marginTop: '0.25rem' }}>
                {upiId}
              </div>
            </div>

            {/* App Badges */}
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              <AppBadge name="GPay"    color="#4285f4" icon="G"  />
              <AppBadge name="PhonePe" color="#5f259f" icon="P"  />
              <AppBadge name="Paytm"   color="#002970" icon="P"  />
              <AppBadge name="BHIM"    color="#00a355" icon="B"  />
              <div style={{ height: 40, width: 1, background: '#e2e8f0' }} />
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', maxWidth: 120, textAlign: 'center', lineHeight: 1.4 }}>
                Scan with <b>any UPI app</b>
              </div>
            </div>

            {/* Instructions */}
            <div style={{ width: '100%', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '0.9rem 1.2rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.2rem' }}>📱</span>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#92400e', lineHeight: 1.6 }}>
                Customer scans the QR → selects amount <b>₹{amount.toFixed(2)}</b> → pays. Once you see the payment notification on your phone, tap <b>"Payment Received"</b>.
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
              <button onClick={onCancel} style={{ flex: 1, padding: '1rem', border: '2px solid #e2e8f0', borderRadius: 12, background: 'white', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', color: '#64748b' }}>
                Cancel
              </button>
              <button onClick={onConfirm} style={{
                flex: 2, padding: '1rem',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                border: 'none', borderRadius: 12, color: 'white',
                fontWeight: 800, fontSize: '1.1rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                boxShadow: '0 4px 12px rgba(34,197,94,0.35)',
              }}>
                <CheckCircle size={22} /> Payment Received ✓
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpiPaymentModal;
