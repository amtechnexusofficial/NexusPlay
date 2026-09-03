import React, { useState } from 'react';
import { 
  User, 
  Building2, 
  Phone, 
  Mail, 
  Lock, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Sparkles, 
  X, 
  Trophy, 
  ChevronRight,
  Zap,
  CalendarCheck
} from 'lucide-react';
import { api } from '../api';

export function AuthModal({ isOpen, onClose, initialRole = 'player', onAuthSuccess }) {
  const [activeRole, setActiveRole] = useState(initialRole); // 'player' | 'owner'
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  
  // Player Form State
  const [playerPhone, setPlayerPhone] = useState('9876500001');
  const [playerName, setPlayerName] = useState('Rohan Sen');
  const [playerEmail, setPlayerEmail] = useState('');
  const [playerSport, setPlayerSport] = useState('football');

  // Owner Form State
  const [ownerEmail, setOwnerEmail] = useState('owner@nexusplay.com');
  const [ownerPassword, setOwnerPassword] = useState('••••••••');
  const [ownerVenueId, setOwnerVenueId] = useState('ven_koramangala');
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  // Handle Player Quick Login
  const handleQuickPlayer = async (name, phone) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await api.loginPlayer({ name, phone });
      localStorage.setItem('nexus_token', res.token);
      localStorage.setItem('nexus_user', JSON.stringify(res.user));
      setSuccessMsg(`Welcome back, ${res.user.name}!`);
      setTimeout(() => {
        onAuthSuccess && onAuthSuccess(res.user, 'player');
        onClose();
      }, 500);
    } catch (err) {
      setErrorMsg(err.message || 'Player login failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Owner Quick Login
  const handleQuickOwner = async (email, venueId) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await api.loginOwner({ email, venueId });
      localStorage.setItem('nexus_token', res.token);
      localStorage.setItem('nexus_user', JSON.stringify(res.user));
      if (res.venue) {
        localStorage.setItem('nexus_owner_venue', JSON.stringify(res.venue));
      }
      setSuccessMsg(`Authenticated as Arena Owner (${res.user.name})`);
      setTimeout(() => {
        onAuthSuccess && onAuthSuccess(res.user, 'owner', res.venue);
        onClose();
      }, 500);
    } catch (err) {
      setErrorMsg(err.message || 'Owner login failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Player Form Submit
  const handlePlayerSubmit = async (e) => {
    e.preventDefault();
    if (!playerPhone || playerPhone.trim().length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await api.loginPlayer({
        phone: playerPhone.trim(),
        name: playerName.trim(),
        email: playerEmail.trim() || undefined
      });
      localStorage.setItem('nexus_token', res.token);
      localStorage.setItem('nexus_user', JSON.stringify(res.user));
      setSuccessMsg(`Welcome ${res.user.name}!`);
      setTimeout(() => {
        onAuthSuccess && onAuthSuccess(res.user, 'player');
        onClose();
      }, 500);
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Owner Form Submit
  const handleOwnerSubmit = async (e) => {
    e.preventDefault();
    if (!ownerEmail || !ownerEmail.includes('@')) {
      setErrorMsg('Please enter a valid business email address');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await api.loginOwner({
        email: ownerEmail.trim(),
        venueId: ownerVenueId
      });
      localStorage.setItem('nexus_token', res.token);
      localStorage.setItem('nexus_user', JSON.stringify(res.user));
      if (res.venue) {
        localStorage.setItem('nexus_owner_venue', JSON.stringify(res.venue));
      }
      setSuccessMsg(`Logged into Arena Dashboard`);
      setTimeout(() => {
        onAuthSuccess && onAuthSuccess(res.user, 'owner', res.venue);
        onClose();
      }, 500);
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="auth-modal-overlay" className="modal-overlay animate-fade-in" onClick={onClose}>
      <div 
        id="auth-modal-content"
        className="modal-content"
        style={{ maxWidth: '520px', borderRadius: '16px', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Role Switcher */}
        <div style={{ background: '#f8fafc', padding: '20px 24px 16px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Trophy size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                  {activeRole === 'player' ? 'Player Portal' : 'Arena Owner Portal'}
                </h3>
                <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>
                  {activeRole === 'player' ? 'Court bookings & pickup matches' : 'Venue SaaS management & slots'}
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

          {/* Distinct Segmented Control Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#e2e8f0', padding: '4px', borderRadius: '10px' }}>
            <button
              id="auth-role-player-tab"
              onClick={() => { setActiveRole('player'); setErrorMsg(''); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeRole === 'player' ? '#ffffff' : 'transparent',
                color: activeRole === 'player' ? '#059669' : '#64748b',
                fontWeight: activeRole === 'player' ? '700' : '600',
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: activeRole === 'player' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <User size={16} />
              <span>Player Login</span>
            </button>

            <button
              id="auth-role-owner-tab"
              onClick={() => { setActiveRole('owner'); setErrorMsg(''); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeRole === 'owner' ? '#ffffff' : 'transparent',
                color: activeRole === 'owner' ? '#059669' : '#64748b',
                fontWeight: activeRole === 'owner' ? '700' : '600',
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: activeRole === 'owner' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Building2 size={16} />
              <span>Arena Owner Portal</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px' }}>
          {errorMsg && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#b91c1c' }}>
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#065f46', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ================================================================= */}
          {/* PLAYER VIEW */}
          {/* ================================================================= */}
          {activeRole === 'player' && (
            <div>
              {/* Quick 1-Click Demo Player Logins */}
              <div style={{ marginBottom: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontSize: '12px', fontWeight: '700', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <Zap size={14} color="#059669" />
                  <span>Instant Demo Player Login</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    id="quick-login-rohan"
                    type="button"
                    onClick={() => handleQuickPlayer('Rohan Sen', '9876500001')}
                    disabled={isLoading}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#059669'; e.currentTarget.style.background = '#f0fdf4'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#ffffff'; }}
                  >
                    <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#0f172a' }}>Rohan Sen</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Football · 98765 00001</div>
                  </button>

                  <button
                    id="quick-login-kunal"
                    type="button"
                    onClick={() => handleQuickPlayer('Kunal Singhal', '9876500002')}
                    disabled={isLoading}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#059669'; e.currentTarget.style.background = '#f0fdf4'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#ffffff'; }}
                  >
                    <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#0f172a' }}>Kunal Singhal</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Badminton · 98765 00002</div>
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0', color: '#94a3b8', fontSize: '12px' }}>
                <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                <span>OR SIGN IN WITH MOBILE</span>
                <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
              </div>

              <form onSubmit={handlePlayerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Full Name
                  </label>
                  <div style={{ position: 'relative' }}>
                    <User size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                    <input
                      id="player-name-input"
                      type="text"
                      className="nexus-input"
                      placeholder="e.g. Arjun Sharma"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      style={{ width: '100%', paddingLeft: '38px' }}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    10-digit Mobile Number (for booking confirmation & OTP)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                    <input
                      id="player-phone-input"
                      type="tel"
                      className="nexus-input"
                      placeholder="e.g. 9876543210"
                      value={playerPhone}
                      onChange={(e) => setPlayerPhone(e.target.value)}
                      style={{ width: '100%', paddingLeft: '38px' }}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Email Address (Optional for e-receipts)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                    <input
                      id="player-email-input"
                      type="email"
                      className="nexus-input"
                      placeholder="arjun@example.com"
                      value={playerEmail}
                      onChange={(e) => setPlayerEmail(e.target.value)}
                      style={{ width: '100%', paddingLeft: '38px' }}
                    />
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={16} color="#059669" />
                  <span>Instant access to digital receipts, booking history & game chats.</span>
                </div>

                <button
                  id="player-submit-btn"
                  type="submit"
                  className="btn-primary"
                  disabled={isLoading}
                  style={{ width: '100%', height: '44px', marginTop: '6px', fontSize: '14px' }}
                >
                  {isLoading ? 'Signing in...' : 'Sign In as Player →'}
                </button>
              </form>

              <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '12.5px', color: '#64748b' }}>
                Are you a sports turf or arena owner?{' '}
                <button
                  id="switch-to-owner-btn"
                  type="button"
                  onClick={() => { setActiveRole('owner'); setErrorMsg(''); }}
                  style={{ background: 'none', border: 'none', color: '#059669', fontWeight: '700', cursor: 'pointer', padding: 0 }}
                >
                  Go to Arena Owner Portal →
                </button>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* OWNER VIEW */}
          {/* ================================================================= */}
          {activeRole === 'owner' && (
            <div>
              {/* Quick 1-Click Demo Owner Logins */}
              <div style={{ marginBottom: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontSize: '12px', fontWeight: '700', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <Building2 size={14} color="#059669" />
                  <span>Instant Arena Owner Access</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                  <button
                    id="quick-login-owner-nexus"
                    type="button"
                    onClick={() => handleQuickOwner('owner@nexusplay.com', 'ven_koramangala')}
                    disabled={isLoading}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#059669'; e.currentTarget.style.background = '#f0fdf4'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#ffffff'; }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>Nexus Central Arena Koramangala</div>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>Owner: Vikramaditya Rao · 4 Courts · UPI Configured</div>
                    </div>
                    <ChevronRight size={16} color="#059669" />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0', color: '#94a3b8', fontSize: '12px' }}>
                <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                <span>OR SIGN IN WITH BUSINESS ACCOUNT</span>
                <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
              </div>

              <form onSubmit={handleOwnerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Business Email / Arena Login
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                    <input
                      id="owner-email-input"
                      type="email"
                      className="nexus-input"
                      placeholder="owner@nexusplay.com"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      style={{ width: '100%', paddingLeft: '38px' }}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Select Managed Venue
                  </label>
                  <select
                    id="owner-venue-select"
                    className="nexus-input"
                    value={ownerVenueId}
                    onChange={(e) => setOwnerVenueId(e.target.value)}
                    style={{ width: '100%', cursor: 'pointer' }}
                  >
                    <option value="ven_koramangala">Nexus Central Arena Koramangala (Active)</option>
                    <option value="ven_indiranagar">Indiranagar Elite Sports Hub</option>
                    <option value="ven_whitefield">Whitefield Smash & Turf Arena</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Password / Access Key
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                    <input
                      id="owner-password-input"
                      type="password"
                      className="nexus-input"
                      placeholder="••••••••"
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      style={{ width: '100%', paddingLeft: '38px' }}
                      required
                    />
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={16} color="#059669" />
                  <span>SaaS Management: 0% gateway commission, direct UPI settlements, slot lock engine.</span>
                </div>

                <button
                  id="owner-submit-btn"
                  type="submit"
                  className="btn-primary"
                  disabled={isLoading}
                  style={{ width: '100%', height: '44px', marginTop: '6px', fontSize: '14px' }}
                >
                  {isLoading ? 'Authenticating...' : 'Enter Arena Management SaaS →'}
                </button>
              </form>

              <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '12.5px', color: '#64748b' }}>
                Looking to book a court or join a match?{' '}
                <button
                  id="switch-to-player-btn"
                  type="button"
                  onClick={() => { setActiveRole('player'); setErrorMsg(''); }}
                  style={{ background: 'none', border: 'none', color: '#059669', fontWeight: '700', cursor: 'pointer', padding: 0 }}
                >
                  Switch to Player Sign In →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
