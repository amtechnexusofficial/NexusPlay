import React, { useState, useEffect } from 'react';
import {
  User,
  Building2,
  Phone,
  Mail,
  Lock,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  X,
  Trophy,
  KeyRound
} from 'lucide-react';
import { api } from '../api';

const inputStyle = {
  width: '100%',
  padding: '11px 14px 11px 40px',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
  fontSize: '14px',
  color: '#0f172a',
  outline: 'none',
  boxSizing: 'border-box'
};

const fieldWrapStyle = { position: 'relative', marginBottom: '12px' };

const iconStyle = { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' };

const primaryBtnStyle = {
  width: '100%',
  padding: '12px',
  borderRadius: '10px',
  border: 'none',
  background: '#059669',
  color: '#fff',
  fontWeight: '700',
  fontSize: '14px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px'
};

const linkBtnStyle = {
  background: 'none',
  border: 'none',
  color: '#059669',
  fontWeight: '700',
  fontSize: '12.5px',
  cursor: 'pointer',
  padding: 0
};

function Field({ icon: Icon, ...props }) {
  return (
    <div style={fieldWrapStyle}>
      <Icon size={16} style={iconStyle} />
      <input style={inputStyle} {...props} />
    </div>
  );
}

export function AuthModal({ isOpen, onClose, initialRole = 'player', onAuthSuccess }) {
  const [activeRole, setActiveRole] = useState(initialRole); // 'player' | 'owner'
  const [ownerMode, setOwnerMode] = useState('login'); // 'login' | 'register'

  // Player OTP flow state
  const [playerStep, setPlayerStep] = useState('phone'); // 'phone' | 'code'
  const [playerPhone, setPlayerPhone] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [devCode, setDevCode] = useState(null);

  // Owner form state
  const [ownerName, setOwnerName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveRole(initialRole || 'player');
      setPlayerStep('phone');
      setOtpCode('');
      setDevCode(null);
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, initialRole]);

  if (!isOpen) return null;

  function finishAuth(res, role, venue) {
    localStorage.setItem('nexus_token', res.token);
    localStorage.setItem('nexus_user', JSON.stringify(res.user));
    if (venue) localStorage.setItem('nexus_owner_venue', JSON.stringify(venue));
    setSuccessMsg(`Welcome, ${res.user.name}!`);
    setTimeout(() => {
      onAuthSuccess && onAuthSuccess(res.user, role, venue);
      onClose();
    }, 400);
  }

  // --- Player: phone + OTP -------------------------------------------------

  async function handleSendCode(e) {
    e.preventDefault();
    const phone = playerPhone.trim();
    if (phone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await api.requestOtp({ phone, role: 'player' });
      setDevCode(res.devCode || null);
      setPlayerStep('code');
      setSuccessMsg(`Code sent to ${phone}`);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to send code');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault();
    if (otpCode.trim().length !== 4) {
      setErrorMsg('Enter the 4-digit code');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await api.verifyOtp({
        phone: playerPhone.trim(),
        code: otpCode.trim(),
        role: 'player',
        name: playerName.trim() || undefined
      });
      finishAuth(res, 'player');
    } catch (err) {
      setErrorMsg(err.message || 'Invalid or expired code');
    } finally {
      setIsLoading(false);
    }
  }

  // --- Owner: email + password ----------------------------------------------

  async function handleOwnerLogin(e) {
    e.preventDefault();
    if (!ownerEmail.includes('@') || !ownerPassword) {
      setErrorMsg('Please enter your business email and password');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await api.loginOwner({ email: ownerEmail.trim(), password: ownerPassword });
      finishAuth(res, 'owner');
    } catch (err) {
      setErrorMsg(err.message || 'Owner login failed');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOwnerRegister(e) {
    e.preventDefault();
    if (!ownerName.trim() || !ownerEmail.includes('@') || ownerPassword.length < 8) {
      setErrorMsg('Name, a valid email and a password of at least 8 characters are required');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await api.registerOwner({
        name: ownerName.trim(),
        email: ownerEmail.trim(),
        password: ownerPassword,
        organizationName: orgName.trim() || undefined
      });
      finishAuth(res, 'owner');
    } catch (err) {
      setErrorMsg(err.message || 'Owner registration failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div id="auth-modal-overlay" className="modal-overlay animate-fade-in" onClick={onClose}>
      <div
        id="auth-modal-content"
        className="modal-content"
        style={{ maxWidth: '460px', borderRadius: '16px', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with role switcher */}
        <div style={{ background: '#f8fafc', padding: '20px 24px 16px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Trophy size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                  {activeRole === 'player' ? 'Player Sign In' : 'Arena Owner Portal'}
                </h3>
                <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>
                  {activeRole === 'player' ? 'Verify your phone to book & join games' : 'Venue SaaS management & slots'}
                </p>
              </div>
            </div>
            <button
              id="auth-close-btn"
              onClick={onClose}
              style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#f1f5f9', padding: '4px', borderRadius: '12px', border: '1px solid #e2e8f0', gap: '4px' }}>
            <button
              id="auth-role-player-tab"
              type="button"
              onClick={() => { setActiveRole('player'); setErrorMsg(''); setSuccessMsg(''); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '42px', padding: '0 12px',
                borderRadius: '9px', border: activeRole === 'player' ? '1px solid #cbd5e1' : '1px solid transparent',
                background: activeRole === 'player' ? '#ffffff' : 'transparent', color: activeRole === 'player' ? '#059669' : '#64748b',
                fontWeight: activeRole === 'player' ? '800' : '600', fontSize: '13px', cursor: 'pointer'
              }}
            >
              <User size={16} /><span>Player</span>
            </button>
            <button
              id="auth-role-owner-tab"
              type="button"
              onClick={() => { setActiveRole('owner'); setErrorMsg(''); setSuccessMsg(''); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '42px', padding: '0 12px',
                borderRadius: '9px', border: activeRole === 'owner' ? '1px solid #cbd5e1' : '1px solid transparent',
                background: activeRole === 'owner' ? '#ffffff' : 'transparent', color: activeRole === 'owner' ? '#059669' : '#64748b',
                fontWeight: activeRole === 'owner' ? '800' : '600', fontSize: '13px', cursor: 'pointer'
              }}
            >
              <Building2 size={16} /><span>Arena Owner</span>
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {errorMsg && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#b91c1c' }}>
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#065f46', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} /><span>{successMsg}</span>
            </div>
          )}

          {/* ============================ PLAYER ============================ */}
          {activeRole === 'player' && playerStep === 'phone' && (
            <form onSubmit={handleSendCode}>
              <Field icon={User} type="text" placeholder="Your name" value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
              <Field icon={Phone} type="tel" placeholder="10-digit mobile number" value={playerPhone} onChange={(e) => setPlayerPhone(e.target.value)} maxLength={10} />
              <button type="submit" style={primaryBtnStyle} disabled={isLoading}>
                {isLoading ? 'Sending…' : 'Send verification code'} <ArrowRight size={16} />
              </button>
              <p style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '10px', textAlign: 'center' }}>
                We'll text you a 4-digit code. New here? Your name creates your player profile automatically.
              </p>
            </form>
          )}

          {activeRole === 'player' && playerStep === 'code' && (
            <form onSubmit={handleVerifyCode}>
              <p style={{ fontSize: '13px', color: '#475569', marginBottom: '12px' }}>
                Enter the 4-digit code sent to <strong>{playerPhone}</strong>.
              </p>
              <Field
                icon={KeyRound}
                type="text"
                inputMode="numeric"
                placeholder="4-digit code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
                autoFocus
              />
              {devCode && (
                <p style={{ fontSize: '11.5px', color: '#b45309', marginBottom: '10px' }}>
                  Dev mode code: <strong>{devCode}</strong>
                </p>
              )}
              <button type="submit" style={primaryBtnStyle} disabled={isLoading}>
                {isLoading ? 'Verifying…' : 'Verify & continue'} <ShieldCheck size={16} />
              </button>
              <button type="button" onClick={() => setPlayerStep('phone')} style={{ ...linkBtnStyle, marginTop: '12px', display: 'block', width: '100%', textAlign: 'center' }}>
                Change number / resend code
              </button>
            </form>
          )}

          {/* ============================ OWNER ============================ */}
          {activeRole === 'owner' && (
            <div>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => { setOwnerMode('login'); setErrorMsg(''); }}
                  style={{ background: 'none', border: 'none', padding: '0 0 10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', borderBottom: ownerMode === 'login' ? '2px solid #059669' : '2px solid transparent', color: ownerMode === 'login' ? '#059669' : '#64748b' }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setOwnerMode('register'); setErrorMsg(''); }}
                  style={{ background: 'none', border: 'none', padding: '0 0 10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', borderBottom: ownerMode === 'register' ? '2px solid #059669' : '2px solid transparent', color: ownerMode === 'register' ? '#059669' : '#64748b' }}
                >
                  Create Arena Account
                </button>
              </div>

              {ownerMode === 'login' && (
                <form onSubmit={handleOwnerLogin}>
                  <Field icon={Mail} type="email" placeholder="Business email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
                  <Field icon={Lock} type="password" placeholder="Password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} />
                  <button type="submit" style={primaryBtnStyle} disabled={isLoading}>
                    {isLoading ? 'Signing in…' : 'Sign in to dashboard'} <ArrowRight size={16} />
                  </button>
                </form>
              )}

              {ownerMode === 'register' && (
                <form onSubmit={handleOwnerRegister}>
                  <Field icon={User} type="text" placeholder="Your name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
                  <Field icon={Building2} type="text" placeholder="Business / arena name (optional)" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                  <Field icon={Mail} type="email" placeholder="Business email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
                  <Field icon={Lock} type="password" placeholder="Password (min 8 characters)" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} />
                  <button type="submit" style={primaryBtnStyle} disabled={isLoading}>
                    {isLoading ? 'Creating account…' : 'Create arena account'} <ArrowRight size={16} />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
