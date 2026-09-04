import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import {
  ShieldCheck, LogOut, Building2, Users, CalendarCheck, IndianRupee,
  QrCode, Copy, CheckCircle2, X, Pause, Play, ExternalLink
} from 'lucide-react';

// Standalone admin surface for amtechnexus platform operators — deliberately
// not part of the player/owner app shell (no shared header, no shared nav)
// and uses its own localStorage keys so an admin session never mixes with
// a player or owner session on the same browser.
export default function AdminView() {
  const [token, setToken] = useState(() => localStorage.getItem('nexus_admin_token'));
  const [adminUser, setAdminUser] = useState(() => {
    try {
      const saved = localStorage.getItem('nexus_admin_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [stats, setStats] = useState(null);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [qrVenue, setQrVenue] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [busyVenueId, setBusyVenueId] = useState(null);

  async function loadDashboard() {
    setLoading(true);
    setLoadError('');
    try {
      const [statsRes, venuesRes] = await Promise.all([api.getAdminStats(), api.getAdminVenues()]);
      setStats(statsRes);
      setVenues(venuesRes);
    } catch (err) {
      if (String(err.message).includes('401') || String(err.message).includes('403')) {
        handleLogout();
      } else {
        setLoadError(err.message || 'Failed to load dashboard');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const res = await api.adminLogin({ email: email.trim(), password });
      localStorage.setItem('nexus_admin_token', res.token);
      localStorage.setItem('nexus_admin_user', JSON.stringify(res.user));
      setAdminUser(res.user);
      setToken(res.token);
    } catch (err) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoggingIn(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('nexus_admin_token');
    localStorage.removeItem('nexus_admin_user');
    setToken(null);
    setAdminUser(null);
    setStats(null);
    setVenues([]);
  }

  function directLinkFor(slug) {
    return `${window.location.origin}/?venue=${slug}`;
  }

  function copyLink(venue) {
    navigator.clipboard.writeText(directLinkFor(venue.slug));
    setCopiedId(venue.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function toggleStatus(venue) {
    const next = venue.status === 'active' ? 'inactive' : 'active';
    setBusyVenueId(venue.id);
    try {
      await api.setAdminVenueStatus(venue.id, next);
      setVenues((prev) => prev.map((v) => (v.id === venue.id ? { ...v, status: next } : v)));
    } catch (err) {
      setLoadError(err.message || 'Failed to update venue');
    } finally {
      setBusyVenueId(null);
    }
  }

  const shell = {
    minHeight: '100vh',
    background: '#0f172a',
    color: '#e2e8f0',
    fontFamily: 'inherit'
  };

  if (!token) {
    return (
      <div style={{ ...shell, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <form
          onSubmit={handleLogin}
          style={{
            width: '100%',
            maxWidth: 380,
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 16,
            padding: 32
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#f8fafc' }}>amtechnexus Admin</div>
              <div style={{ fontSize: 11.5, color: '#94a3b8' }}>Platform operations — internal only</div>
            </div>
          </div>

          <p style={{ fontSize: 12.5, color: '#94a3b8', margin: '16px 0 18px', lineHeight: 1.5 }}>
            This is a separate credential from any player or owner account. Admin accounts are provisioned manually — see <code style={{ color: '#a5b4fc' }}>backend/scripts/create-admin.mjs</code>.
          </p>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>EMAIL</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', color: '#f8fafc', fontSize: 13.5 }}
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>PASSWORD</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', color: '#f8fafc', fontSize: 13.5 }}
            />
          </div>

          {loginError && (
            <div style={{ color: '#fca5a5', fontSize: 12.5, marginBottom: 14 }}>{loginError}</div>
          )}

          <button
            type="submit"
            disabled={loggingIn}
            style={{
              width: '100%',
              background: '#4f46e5',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '11px',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {loggingIn ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={shell}>
      <header style={{ borderBottom: '1px solid #1e293b', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={17} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: '#f8fafc' }}>amtechnexus Admin</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{adminUser?.email}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, cursor: 'pointer' }}
        >
          <LogOut size={14} /> Sign out
        </button>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 60px' }}>
        {loadError && (
          <div style={{ background: '#3f1d1d', border: '1px solid #7f1d1d', color: '#fca5a5', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, marginBottom: 18 }}>
            {loadError}
          </div>
        )}

        {/* Platform stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }}>
          {[
            { label: 'Venues', value: stats?.venues, icon: Building2, color: '#4f46e5' },
            { label: 'Organizations', value: stats?.organizations, icon: Building2, color: '#0891b2' },
            { label: 'Owners', value: stats?.owners, icon: Users, color: '#059669' },
            { label: 'Players', value: stats?.players, icon: Users, color: '#d97706' },
            { label: 'Confirmed Bookings', value: stats?.totalBookings, icon: CalendarCheck, color: '#dc2626' },
            { label: 'Total Revenue', value: stats?.totalRevenue != null ? `₹${stats.totalRevenue.toLocaleString('en-IN')}` : undefined, icon: IndianRupee, color: '#65a30d' }
          ].map((tile) => (
            <div key={tile.label} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <tile.icon size={14} style={{ color: tile.color }} />
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{tile.label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc' }}>
                {loading ? '—' : tile.value ?? 0}
              </div>
            </div>
          ))}
        </div>

        {/* Venues table */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #334155', fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
            All Venues ({venues.length})
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#0f172a' }}>
                  {['Venue', 'Business / Owner', 'City', 'Status', 'UPI', 'Bookings', 'Direct Link', ''].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '9px 14px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {venues.map((v) => (
                  <tr key={v.id} style={{ borderTop: '1px solid #334155' }}>
                    <td style={{ padding: '10px 14px', color: '#f8fafc', fontWeight: 600 }}>{v.name}</td>
                    <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>
                      <div>{v.organization_name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{v.owner_name || '—'} {v.owner_phone ? `· ${v.owner_phone}` : ''}</div>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>{v.city || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999,
                        background: v.status === 'active' ? 'rgba(16,185,129,0.15)' : v.status === 'draft' ? 'rgba(148,163,184,0.15)' : 'rgba(239,68,68,0.15)',
                        color: v.status === 'active' ? '#34d399' : v.status === 'draft' ? '#94a3b8' : '#f87171'
                      }}>
                        {v.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: v.upi_id ? '#34d399' : '#f87171', fontSize: 11.5 }}>
                      {v.upi_id ? 'Set' : 'Not set'}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>{v.booking_count}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => copyLink(v)}
                          title="Copy direct link"
                          style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '5px 7px', cursor: 'pointer', color: copiedId === v.id ? '#34d399' : '#cbd5e1', display: 'flex', alignItems: 'center' }}
                        >
                          {copiedId === v.id ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                        </button>
                        <button
                          onClick={() => setQrVenue(v)}
                          title="Show QR"
                          style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '5px 7px', cursor: 'pointer', color: '#cbd5e1', display: 'flex', alignItems: 'center' }}
                        >
                          <QrCode size={13} />
                        </button>
                        <a
                          href={directLinkFor(v.slug)}
                          target="_blank"
                          rel="noreferrer"
                          title="Open"
                          style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '5px 7px', color: '#cbd5e1', display: 'flex', alignItems: 'center' }}
                        >
                          <ExternalLink size={13} />
                        </a>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <button
                        onClick={() => toggleStatus(v)}
                        disabled={busyVenueId === v.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          background: 'none', border: '1px solid #334155', borderRadius: 6,
                          padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          color: v.status === 'active' ? '#f87171' : '#34d399'
                        }}
                      >
                        {v.status === 'active' ? <Pause size={12} /> : <Play size={12} />}
                        {v.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && venues.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>No venues yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* QR modal — the thing you actually hand the business to print. */}
      {qrVenue && (
        <div
          onClick={() => setQrVenue(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 24, maxWidth: 320, width: '100%', textAlign: 'center' }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setQrVenue(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>{qrVenue.name}</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 16 }}>Scan opens this turf's booking page only</div>
            <div style={{ background: '#fff', borderRadius: 12, padding: 12, display: 'inline-block', marginBottom: 14 }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(directLinkFor(qrVenue.slug))}`}
                alt={`QR code for ${qrVenue.name}`}
                width={200}
                height={200}
              />
            </div>
            <div style={{ fontSize: 11, color: '#cbd5e1', wordBreak: 'break-all', marginBottom: 14 }}>
              {directLinkFor(qrVenue.slug)}
            </div>
            <button
              onClick={() => copyLink(qrVenue)}
              style={{ width: '100%', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, padding: '9px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              {copiedId === qrVenue.id ? <CheckCircle2 size={14} /> : <Copy size={14} />}
              {copiedId === qrVenue.id ? 'Copied' : 'Copy Link'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
