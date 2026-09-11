import React, { useState, useEffect } from 'react';
import {
  User,
  Building2,
  Mail,
  Lock,
  ArrowRight,
  CheckCircle2,
  X
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
  background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 55%, #ec4899 100%)',
  color: '#fff',
  fontWeight: '700',
  fontSize: '14px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px'
};

function Field({ icon: Icon, ...props }) {
  return (
    <div style={fieldWrapStyle}>
      <Icon size={16} style={iconStyle} />
      <input style={inputStyle} {...props} />
    </div>
  );
}

/** Owner portal sign-in / register. Players book as guests (no login). */
export function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [ownerMode, setOwnerMode] = useState('login'); // 'login' | 'register'
  const [ownerName, setOwnerName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [pendingAuth, setPendingAuth] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setOwnerMode('login');
      setErrorMsg('');
      setSuccessMsg('');
      setPendingAuth(null);
    }
  }, [isOpen]);

  function handleContinue() {
    if (!pendingAuth) return;
    const { user, role, venue } = pendingAuth;
    onAuthSuccess && onAuthSuccess(user, role, venue);
    onClose();
  }

  if (!isOpen) return null;

  function finishAuth(res, role, venue) {
    if (!res?.token) {
      setErrorMsg('Sign-in succeeded but the server did not return a session token. Check that the Worker is deployed and JWT_SECRET is set.');
      return;
    }
    localStorage.setItem('nexus_token', res.token);
    localStorage.setItem('nexus_user', JSON.stringify(res.user));
    if (venue) localStorage.setItem('nexus_owner_venue', JSON.stringify(venue));
    setSuccessMsg(`Welcome, ${res.user.name}!`);
    setPendingAuth({ user: res.user, role, venue });
  }

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
        <div style={{ background: '#f8fafc', padding: '20px 24px 16px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src="/logo-mark.png" alt="NexusPlay" style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'contain' }} />
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                  Arena Owner Portal
                </h3>
                <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>
                  Venue SaaS management & slots
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

          {pendingAuth && (
            <button type="button" onClick={handleContinue} style={primaryBtnStyle}>
              Continue to Owner Hub <ArrowRight size={16} />
            </button>
          )}

          {!pendingAuth && (
            <div>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => { setOwnerMode('login'); setErrorMsg(''); }}
                  style={{ background: 'none', border: 'none', padding: '0 0 10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', borderBottom: ownerMode === 'login' ? '2px solid #4f46e5' : '2px solid transparent', color: ownerMode === 'login' ? '#4f46e5' : '#64748b' }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setOwnerMode('register'); setErrorMsg(''); }}
                  style={{ background: 'none', border: 'none', padding: '0 0 10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', borderBottom: ownerMode === 'register' ? '2px solid #4f46e5' : '2px solid transparent', color: ownerMode === 'register' ? '#4f46e5' : '#64748b' }}
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
