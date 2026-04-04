import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* ── inline styles scoped to Login only ── */
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

  /* layered mountain background using CSS gradients */
  bg: {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    background: `
      linear-gradient(180deg, #b8d4e8 0%, #90bcd6 30%, #6aacc8 55%, #4a8fa8 75%, #2d7a8a 100%)
    `,
  },

  /* decorative mountain silhouette layers */
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

  /* pine trees overlay */
  treesOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    zIndex: 4,
    pointerEvents: 'none',
  },

  /* sky gradient overlay */
  skyTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    background: 'linear-gradient(180deg, rgba(220, 235, 248, 0.6) 0%, transparent 100%)',
    zIndex: 1,
  },

  /* birds */
  birds: {
    position: 'absolute',
    top: '12%',
    left: '10%',
    zIndex: 5,
    display: 'flex',
    gap: '1rem',
    opacity: 0.8,
  },
  bird: {
    width: '20px',
    height: '10px',
    borderTop: '3px solid #111',
    borderRadius: '50% 50% 0 0',
    transform: 'rotate(-5deg)',
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

  /* frosted glass card */
  card: {
    position: 'relative',
    zIndex: 10,
    width: '100%',
    maxWidth: '360px',
    background: 'rgba(180, 210, 230, 0.35)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    border: '1px solid rgba(255,255,255,0.4)',
    borderRadius: '1.25rem',
    padding: '2.5rem 2rem',
    boxShadow: '0 8px 32px rgba(0,0,50,0.18)',
  },

  title: {
    textAlign: 'center',
    fontSize: '1.4rem',
    fontWeight: 700,
    letterSpacing: '0.15em',
    color: '#0f2d3d',
    marginBottom: '2rem',
  },

  fieldGroup: {
    marginBottom: '1.25rem',
  },

  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },

  input: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: '1.5px solid rgba(30,80,100,0.5)',
    borderRadius: 0,
    padding: '0.55rem 2rem 0.55rem 0',
    fontSize: '0.95rem',
    color: '#0f2d3d',
    fontWeight: 500,
    outline: 'none',
    boxShadow: 'none',
  },

  inputIcon: {
    position: 'absolute',
    right: 0,
    color: '#336677',
    fontSize: '1rem',
    pointerEvents: 'none',
  },

  forgotRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '0.25rem',
  },

  forgotLink: {
    fontSize: '0.75rem',
    color: '#1e4f6e',
    cursor: 'pointer',
    fontWeight: 600,
    textDecoration: 'none',
  },

  rememberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '2rem',
    marginTop: '0.5rem',
  },

  checkbox: {
    width: '15px',
    height: '15px',
    cursor: 'pointer',
    accentColor: '#2563eb',
  },

  rememberLabel: {
    fontSize: '0.85rem',
    color: '#0f2d3d',
    fontWeight: 500,
    cursor: 'pointer',
  },

  btn: {
    width: '100%',
    padding: '0.7rem',
    background: 'rgba(120,170,200,0.5)',
    border: '1px solid rgba(255,255,255,0.5)',
    borderRadius: '0.5rem',
    color: '#0f2d3d',
    fontWeight: 700,
    fontSize: '0.95rem',
    letterSpacing: '0.08em',
    cursor: 'pointer',
    transition: 'background 0.2s ease, transform 0.15s ease',
  },

  errorBox: {
    background: 'rgba(220,50,50,0.2)',
    border: '1px solid rgba(220,50,50,0.4)',
    borderRadius: '0.5rem',
    padding: '0.6rem 0.8rem',
    fontSize: '0.85rem',
    color: '#7f0000',
    marginBottom: '1.25rem',
    textAlign: 'center',
  },
};

const BirdSVG = () => (
  <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
    <path d="M0 6 Q7 0 14 6 Q21 0 28 6" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round"/>
  </svg>
);

/* One pine tree shape — trunk at bottom, three tiered triangles stacked */
const PineTree = ({ x, height = 120, color = '#0b2a2a' }) => {
  const w = height * 0.45;
  const cx = x;
  return (
    <g>
      {/* trunk */}
      <rect x={cx - w * 0.07} y={height * 0.88} width={w * 0.14} height={height * 0.12} fill={color} />
      {/* bottom tier */}
      <polygon points={`${cx},${height * 0.52} ${cx - w * 0.5},${height * 0.9} ${cx + w * 0.5},${height * 0.9}`} fill={color} />
      {/* middle tier */}
      <polygon points={`${cx},${height * 0.28} ${cx - w * 0.38},${height * 0.65} ${cx + w * 0.38},${height * 0.65}`} fill={color} />
      {/* top tier */}
      <polygon points={`${cx},0 ${cx - w * 0.24},${height * 0.38} ${cx + w * 0.24},${height * 0.38}`} fill={color} />
    </g>
  );
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const success = await login(email, password);
    if (success) {
      navigate('/');
    } else {
      setError('Invalid email or password');
    }
  };

  return (
    <div style={S.root}>
      {/* Background layers */}
      <div style={S.bg} />
      <div style={S.skyTint} />
      <div style={S.mountain1} />
      <div style={S.mountain2} />
      <div style={S.mountain3} />

      {/* Clouds */}
      <svg style={{ position:'absolute', top:'6%', left:0, right:0, width:'100%', height:'20%', zIndex:2, pointerEvents:'none' }} preserveAspectRatio="none">
        <ellipse cx="15%" cy="55%" rx="8%" ry="35%" fill="rgba(255,255,255,0.55)" />
        <ellipse cx="20%" cy="70%" rx="10%" ry="45%" fill="rgba(255,255,255,0.45)" />
        <ellipse cx="25%" cy="50%" rx="7%" ry="30%" fill="rgba(255,255,255,0.5)" />
        <ellipse cx="72%" cy="60%" rx="9%" ry="40%" fill="rgba(255,255,255,0.45)" />
        <ellipse cx="80%" cy="45%" rx="8%" ry="35%" fill="rgba(255,255,255,0.5)" />
        <ellipse cx="87%" cy="65%" rx="7%" ry="30%" fill="rgba(255,255,255,0.4)" />
      </svg>

      {/* Pine trees SVG overlay */}
      <div style={S.treesOverlay}>
        <svg width="100%" height="100%" viewBox="0 0 1200 500" preserveAspectRatio="xMidYMax meet" style={{ position:'absolute', bottom:0 }}>
          {/* Left side trees */}
          <PineTree x={30}  height={320} color="#071a1a" />
          <PineTree x={90}  height={380} color="#0a2222" />
          <PineTree x={155} height={290} color="#071a1a" />
          <PineTree x={210} height={340} color="#0d2828" />
          {/* Right side trees */}
          <PineTree x={990}  height={290} color="#0d2828" />
          <PineTree x={1050} height={360} color="#0a2222" />
          <PineTree x={1115} height={310} color="#071a1a" />
          <PineTree x={1170} height={400} color="#071a1a" />
        </svg>
      </div>

      {/* Birds left */}
      <div style={S.birds}>
        <BirdSVG />
        <div style={{ marginTop: '6px', marginLeft: '6px' }}><BirdSVG /></div>
      </div>
      {/* Birds right */}
      <div style={S.birdsRight}>
        <BirdSVG />
        <div style={{ marginTop: '4px' }}><BirdSVG /></div>
      </div>

      {/* Login Card */}
      <div style={S.card}>

        <h2 style={S.title}>LOGIN</h2>

        <form onSubmit={handleLogin}>
          {error && <div style={S.errorBox}>{error}</div>}

          {/* Email */}
          <div style={S.fieldGroup}>
            <div style={S.inputWrapper}>
              <input
                id="login-email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={S.input}
              />
              <span style={S.inputIcon}>✉</span>
            </div>
          </div>

          {/* Password */}
          <div style={S.fieldGroup}>
            <div style={S.inputWrapper}>
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                placeholder="Password"
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
                {showPw ? '🙈' : '🔑'}
              </span>
            </div>
            <div style={S.forgotRow}>
              <span style={S.forgotLink}>Forgot <strong>Password?</strong></span>
            </div>
          </div>

          {/* Remember me */}
          <div style={S.rememberRow}>
            <input
              id="remember-me"
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              style={S.checkbox}
            />
            <label htmlFor="remember-me" style={S.rememberLabel}>Remember Me</label>
          </div>

          <button
            id="login-btn"
            type="submit"
            style={S.btn}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(80,140,180,0.65)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(120,170,200,0.5)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
