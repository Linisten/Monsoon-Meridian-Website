import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import symbolUrl from '../assets/symbol.png';

const S = {
  root: {
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Inter', sans-serif",
  },
  bg: {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    background: 'linear-gradient(180deg, #b8d4e8 0%, #90bcd6 30%, #6aacc8 55%, #4a8fa8 75%, #2d7a8a 100%)',
  },
  mountain1: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
    background: 'linear-gradient(180deg, #2a6b7c 0%, #1e4f5e 100%)',
    clipPath: 'polygon(0 60%, 8% 30%, 18% 50%, 28% 15%, 40% 45%, 52% 5%, 65% 40%, 78% 20%, 90% 45%, 100% 25%, 100% 100%, 0 100%)',
    zIndex: 1,
  },
  mountain2: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '45%',
    background: 'linear-gradient(180deg, #3a8a8a 0%, #267070 100%)',
    clipPath: 'polygon(0 50%, 12% 25%, 25% 45%, 38% 10%, 50% 40%, 62% 18%, 75% 42%, 85% 22%, 95% 38%, 100% 28%, 100% 100%, 0 100%)',
    zIndex: 2,
  },
  mountain3: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '35%',
    background: 'linear-gradient(180deg, #1a5a5a 0%, #0f3f3f 100%)',
    clipPath: 'polygon(0 55%, 15% 20%, 30% 48%, 45% 8%, 58% 38%, 70% 15%, 82% 40%, 92% 22%, 100% 35%, 100% 100%, 0 100%)',
    zIndex: 3,
  },
  treesOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    zIndex: 4,
    pointerEvents: 'none',
  },
  skyTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    background: 'linear-gradient(180deg, rgba(220, 235, 248, 0.6) 0%, transparent 100%)',
    zIndex: 1,
  },
  birds: {
    position: 'absolute',
    top: '12%',
    left: '10%',
    zIndex: 5,
    display: 'flex',
    gap: '1rem',
    opacity: 0.8,
  },
  birdsRight: {
    position: 'absolute',
    top: '15%',
    right: '10%',
    zIndex: 5,
    display: 'flex',
    gap: '0.8rem',
    opacity: 0.8,
  },
  card: {
    position: 'relative',
    zIndex: 10,
    width: '100%',
    maxWidth: '420px',
    background: 'rgba(215, 235, 248, 0.52)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1.5px solid rgba(255,255,255,0.7)',
    borderRadius: '1.75rem',
    padding: '2.5rem 2.2rem',
    boxShadow: '0 25px 50px -12px rgba(15, 45, 60, 0.35), inset 0 1px 1px rgba(255,255,255,0.7)',
    transition: 'all 0.3s ease',
  },
  title: {
    textAlign: 'center',
    color: '#0f2d3d',
    fontWeight: 900,
    fontSize: '1.65rem',
    letterSpacing: '0.06em',
    marginBottom: '0.25rem',
  },
  subtitle: {
    textAlign: 'center',
    color: '#2d5a6d',
    fontSize: '0.86rem',
    fontWeight: 600,
    marginBottom: '1.75rem',
  },
  fieldGroup: {
    marginBottom: '1.15rem',
  },
  label: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 800,
    color: '#0f2d3d',
    marginBottom: '0.4rem',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  input: {
    width: '100%',
    padding: '0.85rem 2.75rem 0.85rem 1rem',
    background: 'rgba(255,255,255,0.9)',
    border: '1.5px solid rgba(255,255,255,0.9)',
    borderRadius: '0.75rem',
    color: '#0f2d3d',
    fontSize: '0.92rem',
    fontWeight: 600,
    outline: 'none',
    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)',
    transition: 'border-color 0.2s, background 0.2s',
  },
  inputIcon: {
    position: 'absolute',
    right: '12px',
    color: '#3b7082',
    display: 'flex',
    alignItems: 'center',
  },
  btn: {
    width: '100%',
    padding: '0.9rem',
    background: 'linear-gradient(135deg, #1e4f5e 0%, #133c48 100%)',
    border: '1px solid rgba(255,255,255,0.5)',
    borderRadius: '0.75rem',
    color: 'white',
    fontWeight: 800,
    fontSize: '0.95rem',
    letterSpacing: '0.04em',
    cursor: 'pointer',
    boxShadow: '0 6px 18px rgba(15, 45, 60, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  errorBox: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1.5px solid #f87171',
    borderRadius: '0.75rem',
    padding: '0.75rem 1rem',
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#991b1b',
    marginBottom: '1.25rem',
    textAlign: 'center',
  },
};

const BirdSVG = () => (
  <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
    <path d="M0 6 Q7 0 14 6 Q21 0 28 6" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round"/>
  </svg>
);

const PineTree = ({ x, height = 120, color = '#0b2a2a' }) => {
  const w = height * 0.45;
  const cx = x;
  return (
    <g>
      <rect x={cx - w * 0.07} y={height * 0.88} width={w * 0.14} height={height * 0.12} fill={color} />
      <polygon points={`${cx},${height * 0.52} ${cx - w * 0.5},${height * 0.9} ${cx + w * 0.5},${height * 0.9}`} fill={color} />
      <polygon points={`${cx},${height * 0.28} ${cx - w * 0.38},${height * 0.65} ${cx + w * 0.38},${height * 0.65}`} fill={color} />
      <polygon points={`${cx},0 ${cx - w * 0.24},${height * 0.38} ${cx + w * 0.24},${height * 0.38}`} fill={color} />
    </g>
  );
};

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      return setError('Please enter both username/email and password.');
    }
    setError('');
    setIsSubmitting(true);

    try {
      const success = await login(identifier.trim(), password.trim());
      if (success) {
        navigate('/');
      } else {
        setError('Invalid username/email or password. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={S.root}>
      <div style={S.bg} />
      <div style={S.skyTint} />
      <div style={S.mountain1} />
      <div style={S.mountain2} />
      <div style={S.mountain3} />

      <svg style={{ position: 'absolute', top: '6%', left: 0, right: 0, width: '100%', height: '20%', zIndex: 2, pointerEvents: 'none' }} preserveAspectRatio="none">
        <ellipse cx="15%" cy="55%" rx="8%" ry="35%" fill="rgba(255,255,255,0.55)" />
        <ellipse cx="20%" cy="70%" rx="10%" ry="45%" fill="rgba(255,255,255,0.45)" />
        <ellipse cx="25%" cy="50%" rx="7%" ry="30%" fill="rgba(255,255,255,0.5)" />
        <ellipse cx="72%" cy="60%" rx="9%" ry="40%" fill="rgba(255,255,255,0.45)" />
        <ellipse cx="80%" cy="45%" rx="8%" ry="35%" fill="rgba(255,255,255,0.5)" />
        <ellipse cx="87%" cy="65%" rx="7%" ry="30%" fill="rgba(255,255,255,0.4)" />
      </svg>

      <div style={S.treesOverlay}>
        <svg width="100%" height="100%" viewBox="0 0 1200 500" preserveAspectRatio="xMidYMax meet" style={{ position: 'absolute', bottom: 0 }}>
          <PineTree x={30} height={320} color="#071a1a" />
          <PineTree x={90} height={380} color="#0a2222" />
          <PineTree x={155} height={290} color="#071a1a" />
          <PineTree x={210} height={340} color="#0d2828" />
          <PineTree x={990} height={290} color="#0d2828" />
          <PineTree x={1050} height={360} color="#0a2222" />
          <PineTree x={1115} height={310} color="#071a1a" />
          <PineTree x={1170} height={400} color="#071a1a" />
        </svg>
      </div>

      <div style={S.birds}>
        <BirdSVG />
        <div style={{ marginTop: '6px', marginLeft: '6px' }}><BirdSVG /></div>
      </div>
      <div style={S.birdsRight}>
        <BirdSVG />
        <div style={{ marginTop: '4px' }}><BirdSVG /></div>
      </div>

      <div style={S.card}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: 68,
            height: 68,
            borderRadius: '18px',
            background: 'rgba(255, 255, 255, 0.88)',
            border: '1.5px solid rgba(255, 255, 255, 0.95)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(15, 45, 60, 0.16)',
            marginBottom: '0.85rem',
            padding: '6px'
          }}>
            <img 
              src={symbolUrl} 
              alt="Monsoon Meridian Symbol" 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }} 
            />
          </div>
          <h1 style={S.title}>MONSOON MERIDIAN</h1>
          <p style={S.subtitle}>Sign in with your credentials to access dashboard</p>
        </div>

        <form onSubmit={handleLogin}>
          {error && <div style={S.errorBox}>{error}</div>}

          <div style={S.fieldGroup}>
            <label style={S.label}>Username or Email</label>
            <div style={S.inputWrapper}>
              <input
                id="login-identifier"
                type="text"
                autoFocus
                placeholder="Enter username or email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                style={S.input}
              />
              <span style={S.inputIcon}>
                <User size={18} />
              </span>
            </div>
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label}>Password</label>
            <div style={S.inputWrapper}>
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={S.input}
              />
              <span
                style={{ ...S.inputIcon, cursor: 'pointer', pointerEvents: 'auto' }}
                onClick={() => setShowPw(!showPw)}
                title={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <Lock size={18} color="#0284c7" /> : <KeyRound size={18} />}
              </span>
            </div>
          </div>

          <button
            id="submit-login-btn"
            type="submit"
            disabled={isSubmitting}
            style={S.btn}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <span>{isSubmitting ? 'Signing in...' : 'Sign In'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
