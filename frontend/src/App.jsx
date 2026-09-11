import React, { useState, useEffect } from 'react';
import PlayerMarketplace from './components/PlayerMarketplace.jsx';
import PublicBookingView from './components/PublicBookingView.jsx';
import OpenGamesHub from './components/OpenGamesHub.jsx';
import OwnerSaaSView from './components/OwnerSaaSView.jsx';
import { AuthModal } from './components/AuthModal.jsx';
import SplitPaymentView from './components/SplitPaymentView.jsx';
import AdminView from './components/AdminView.jsx';
import {
  Trophy,
  Compass,
  Share2,
  Building2,
  LogOut
} from 'lucide-react';
import { api } from './api.js';

export default function App() {
  // Navigation views: 'marketplace', 'opengames', 'venue-page', 'owner'
  // Players browse/book as guests (name+phone at checkout). No player login.
  const [activeView, setActiveView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    let savedUser = null;
    try {
      const saved = localStorage.getItem('nexus_user');
      savedUser = saved ? JSON.parse(saved) : null;
    } catch (e) {}

    if (params.get('venue') || params.get('v')) return 'venue-page';
    if (params.get('view') === 'owner') {
      // Stale player sessions are ignored — only owners keep a session.
      if (savedUser?.role === 'owner') return 'owner';
      return 'marketplace';
    }
    // Old player-dashboard deep links now land on the marketplace.
    if (params.get('view') === 'dashboard') return 'marketplace';
    if (params.get('view') === 'opengames') return 'opengames';
    return 'marketplace';
  });

  const [activeVenueSlug, setActiveVenueSlug] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('venue') || params.get('v') || 'nexus-central-koramangala';
  });

  // Split-payment share link (?pay=<token>) — a standalone view outside
  // the normal app chrome, since whoever opens it may not be signed in
  // or care about the rest of the marketplace.
  const [paymentToken] = useState(() => new URLSearchParams(window.location.search).get('pay'));

  // amtechnexus platform admin (?admin=1) — entirely separate surface,
  // not linked from any nav, own login/session. See AdminView.jsx.
  const [isAdminRoute] = useState(() => new URLSearchParams(window.location.search).get('admin') === '1');

  // Owner-only session (player accounts are no longer used in the UI).
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('nexus_user');
      const user = saved ? JSON.parse(saved) : null;
      if (user?.role === 'owner') return user;
      // Drop leftover player sessions so the shell stays guest-first.
      if (user?.role === 'player') {
        localStorage.removeItem('nexus_token');
        localStorage.removeItem('nexus_user');
      }
      return null;
    } catch (e) {
      return null;
    }
  });

  // Auth Modal State — owner portal only
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Sync owner session on mount
  useEffect(() => {
    const token = localStorage.getItem('nexus_token');
    if (token) {
      api.getAuthMe(token).then((res) => {
        if (res?.user?.role === 'owner') {
          setCurrentUser(res.user);
          localStorage.setItem('nexus_user', JSON.stringify(res.user));
        } else {
          localStorage.removeItem('nexus_token');
          localStorage.removeItem('nexus_user');
          setCurrentUser(null);
        }
      }).catch(() => {});
    }
  }, []);

  function navigateTo(view, venueSlug = activeVenueSlug) {
    if (view === 'player-dashboard') {
      setActiveView('marketplace');
      window.history.pushState({}, '', '/');
      return;
    }
    if (view === 'owner' && currentUser?.role && currentUser.role !== 'owner') {
      setActiveView('marketplace');
      window.history.pushState({}, '', '/');
      return;
    }

    setActiveView(view);
    if (view === 'venue-page') {
      setActiveVenueSlug(venueSlug);
      window.history.pushState({}, '', `/?venue=${venueSlug}`);
    } else if (view === 'owner') {
      window.history.pushState({}, '', '/?view=owner');
    } else if (view === 'opengames') {
      window.history.pushState({}, '', '/?view=opengames');
    } else {
      window.history.pushState({}, '', '/');
    }
  }

  function handleSelectVenue(slugOrId) {
    navigateTo('venue-page', slugOrId);
  }

  function handleAuthSuccess(user, role) {
    if (role !== 'owner' || user?.role !== 'owner') {
      setAuthModalOpen(false);
      navigateTo('marketplace');
      return;
    }
    setCurrentUser(user);
    setActiveView('owner');
    window.history.pushState({}, '', '/?view=owner');
  }

  function handleLogout() {
    localStorage.removeItem('nexus_token');
    localStorage.removeItem('nexus_user');
    localStorage.removeItem('nexus_owner_venue');
    setCurrentUser(null);
    navigateTo('marketplace');
  }

  function openOwnerAuth() {
    if (currentUser?.role === 'owner') {
      navigateTo('owner');
    } else {
      setAuthModalOpen(true);
    }
  }

  // Open Games Hub hosting — guests browse/join without login; hosting
  // stays on the owner hub (or browse turfs for walk-up booking).
  function handleGamesHubLogin(role) {
    if (role === 'owner') openOwnerAuth();
    else navigateTo('marketplace');
  }

  function handleGamesHubNavigateToDashboard(role) {
    if (role === 'owner') navigateTo('owner');
    else navigateTo('marketplace');
  }

  if (paymentToken) {
    return (
      <SplitPaymentView
        token={paymentToken}
        onClose={() => {
          window.history.pushState({}, '', '/');
          window.location.reload();
        }}
      />
    );
  }

  if (isAdminRoute) {
    return <AdminView />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-dark)' }}>
      {/* Global Brand Header - Modern Clean White Layout */}
      <header
        id="nexus-global-header"
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: '12px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12
          }}
        >
          {/* Logo & Tagline */}
          <div
            id="nexus-brand-logo"
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            onClick={() => navigateTo('marketplace')}
          >
            <img
              src="/logo-mark.png"
              alt="NexusPlay"
              style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, objectFit: 'contain' }}
            />
            <div>
              <div className="font-display" style={{ fontSize: 19, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                NEXUS<span style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 60%, #f97316 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>PLAY</span>
              </div>
              <div className="header-tagline" style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Sports Operating System & Arena Network
              </div>
            </div>
          </div>

          {/* Desktop Navigation Switcher — hidden on a venue's own direct
              booking page: that page is meant to read as this business's
              page, not a stop inside the wider marketplace. */}
          {activeView !== 'venue-page' && (
          <nav
            id="desktop-main-navigation"
            className="desktop-nav"
            style={{ background: '#f8fafc', padding: 4, borderRadius: 10, border: '1px solid #e2e8f0', gap: 3 }}
          >
            <button
              id="nav-turfs-btn"
              onClick={() => navigateTo('marketplace')}
              style={{
                background: activeView === 'marketplace' ? '#ffffff' : 'transparent',
                color: activeView === 'marketplace' ? '#4f46e5' : '#475569',
                border: activeView === 'marketplace' ? '1px solid #cbd5e1' : '1px solid transparent',
                borderRadius: 7,
                padding: '7px 15px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: activeView === 'marketplace' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Compass size={14} /> Nearby Turfs
            </button>

            <button
              id="nav-pickup-btn"
              onClick={() => navigateTo('opengames')}
              style={{
                background: activeView === 'opengames' ? '#ffffff' : 'transparent',
                color: activeView === 'opengames' ? '#d97706' : '#475569',
                border: activeView === 'opengames' ? '1px solid #cbd5e1' : '1px solid transparent',
                borderRadius: 7,
                padding: '7px 15px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: activeView === 'opengames' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Trophy size={14} /> Pickup Games
            </button>

            <button
              id="nav-direct-link-btn"
              onClick={() => navigateTo('venue-page')}
              style={{
                background: activeView === 'venue-page' ? '#ffffff' : 'transparent',
                color: activeView === 'venue-page' ? '#4f46e5' : '#475569',
                border: activeView === 'venue-page' ? '1px solid #cbd5e1' : '1px solid transparent',
                borderRadius: 7,
                padding: '7px 15px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: activeView === 'venue-page' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Share2 size={14} /> Turf Direct Link
            </button>

            {/* If owner is logged in, show Owner Hub in nav */}
            {currentUser && currentUser.role === 'owner' && (
              <button
                id="nav-owner-hub-btn"
                onClick={() => navigateTo('owner')}
                style={{
                  background: activeView === 'owner' ? '#ffffff' : 'transparent',
                  color: activeView === 'owner' ? '#4f46e5' : '#475569',
                  border: activeView === 'owner' ? '1px solid #cbd5e1' : '1px solid transparent',
                  borderRadius: 7,
                  padding: '7px 15px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: activeView === 'owner' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <Building2 size={14} /> Owner Hub
              </button>
            )}
          </nav>
          )}

          {/* On a venue's direct page, the only nav action is a quiet way
              back out to the full marketplace — everything else about the
              app shell (sign-in, owner portal, other tabs) stays hidden. */}
          {activeView === 'venue-page' && (
            <button
              onClick={() => navigateTo('marketplace')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '7px 14px',
                fontSize: 12.5,
                fontWeight: 600,
                color: '#64748b',
                cursor: 'pointer'
              }}
            >
              <Compass size={14} />
              <span className="header-label-full">Explore other venues on NexusPlay</span>
              <span className="header-label-short">Explore venues</span>
            </button>
          )}

          {activeView !== 'venue-page' && (
          <div className="header-actions-full" style={{ alignItems: 'center', gap: 10 }}>
            {/* Logged in as Owner */}
            {currentUser && currentUser.role === 'owner' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  id="header-owner-profile-btn"
                  onClick={() => navigateTo('owner')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: activeView === 'owner' ? '#ecfdf5' : '#f8fafc',
                    border: activeView === 'owner' ? '1px solid #a7f3d0' : '1px solid #cbd5e1',
                    borderRadius: 999,
                    padding: '5px 12px 5px 6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="Open Arena Hub"
                >
                  <div style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: '#4f46e5',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 800
                  }}>
                    <Building2 size={13} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                    {currentUser.name || 'Arena Owner'}
                  </span>
                  <span className="badge-indigo" style={{ padding: '1px 6px', fontSize: 10 }}>
                    Owner
                  </span>
                </button>

                <button
                  id="header-owner-hub-btn"
                  onClick={() => navigateTo('owner')}
                  className="btn-primary"
                  style={{ fontSize: 12.5, padding: '7px 12px', minHeight: 34 }}
                >
                  <Building2 size={13} />
                  <span>Arena Hub</span>
                </button>

                <button
                  id="header-logout-owner-btn"
                  onClick={handleLogout}
                  title="Sign Out"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    padding: '7px 9px',
                    cursor: 'pointer',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <LogOut size={14} />
                </button>
              </div>
            )}

            {/* Guests: marketplace-first — only Owner Portal needs sign-in */}
            {!currentUser && (
              <button
                id="header-owner-portal-btn"
                onClick={openOwnerAuth}
                style={{
                  background: activeView === 'owner' ? '#4f46e5' : '#ffffff',
                  color: activeView === 'owner' ? '#ffffff' : '#0f172a',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  padding: '7px 14px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: activeView === 'owner' ? '0 2px 8px rgba(79,70,229,0.25)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <Building2 size={14} color={activeView === 'owner' ? '#ffffff' : '#4f46e5'} />
                <span>Owner Portal</span>
              </button>
            )}
          </div>
          )}

          {activeView !== 'venue-page' && (
          <div className="header-actions-mobile" style={{ alignItems: 'center' }}>
            {currentUser?.role === 'owner' ? (
              <button
                onClick={() => navigateTo('owner')}
                aria-label="Open Owner Hub"
                style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: '#4f46e5',
                  color: '#ffffff', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 800
                }}
              >
                <Building2 size={17} />
              </button>
            ) : (
              <button
                onClick={openOwnerAuth}
                aria-label="Owner portal"
                className="btn-secondary"
                style={{ width: 40, height: 40, minHeight: 40, padding: 0, borderRadius: '50%' }}
              >
                <Building2 size={17} color="#4f46e5" />
              </button>
            )}
          </div>
          )}
        </div>
      </header>

      {/* Main Screen Views — guests browse/book; owners manage */}
      <main className="app-main" style={{ flex: 1, padding: '20px 0 80px' }}>
        {activeView === 'marketplace' && (
          <PlayerMarketplace
            onSelectVenue={handleSelectVenue}
          />
        )}

        {activeView === 'opengames' && (
          <OpenGamesHub
            onNavigateToVenue={handleSelectVenue}
            currentUser={currentUser}
            onNavigateToLogin={handleGamesHubLogin}
            onNavigateToDashboard={handleGamesHubNavigateToDashboard}
          />
        )}

        {activeView === 'venue-page' && (
          <PublicBookingView
            slug={activeVenueSlug}
            onBack={() => navigateTo('marketplace')}
            currentUser={currentUser}
          />
        )}

        {activeView === 'owner' && (
          currentUser?.role === 'owner' ? (
            <OwnerSaaSView
              key={currentUser?.id || 'signed-out'}
            />
          ) : (
            <div style={{ maxWidth: 420, margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
              <div className="nexus-card" style={{ padding: 32 }}>
                <Building2 size={28} style={{ color: '#4f46e5', marginBottom: 12 }} />
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
                  Arena Owner Sign In
                </h2>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 18 }}>
                  Sign in to manage venues, courts, slots, and bookings. Players can book without an account.
                </p>
                <button className="btn-primary" onClick={openOwnerAuth} style={{ padding: '10px 18px' }}>
                  Open Owner Portal
                </button>
              </div>
            </div>
          )
        )}
      </main>

      {/* On a venue's direct page, mobile gets the same quiet "explore
          other venues" exit instead of the full tab bar. */}
      {activeView === 'venue-page' && (
        <div className="mobile-bottom-bar" style={{ justifyContent: 'center' }}>
          <button
            onClick={() => navigateTo('marketplace')}
            className="mobile-bottom-btn"
            style={{ flex: 'none', padding: '0 20px' }}
          >
            <Compass size={20} />
            <span className="header-label-full">Explore other venues</span>
            <span className="header-label-short">Explore venues</span>
          </button>
        </div>
      )}

      {/* Mobile bottom nav — guests browse; owners manage */}
      {activeView !== 'venue-page' && (
      <nav id="mobile-bottom-navigation" className="mobile-bottom-bar">
        <button
          id="mobile-nav-turfs"
          className={`mobile-bottom-btn ${activeView === 'marketplace' ? 'active' : ''}`}
          onClick={() => navigateTo('marketplace')}
        >
          <Compass size={20} />
          <span>Turfs</span>
        </button>

        {currentUser?.role === 'owner' ? (
          <>
            <button
              id="mobile-nav-owner"
              className={`mobile-bottom-btn ${activeView === 'owner' ? 'active' : ''}`}
              onClick={() => navigateTo('owner')}
            >
              <Building2 size={20} />
              <span>Owner Hub</span>
            </button>

            <button
              id="mobile-nav-venue"
              className={`mobile-bottom-btn ${activeView === 'venue-page' ? 'active' : ''}`}
              onClick={() => navigateTo('venue-page')}
            >
              <Share2 size={20} />
              <span>Direct Link</span>
            </button>

            <button
              id="mobile-nav-signout"
              className="mobile-bottom-btn"
              onClick={handleLogout}
            >
              <LogOut size={20} />
              <span>Sign Out</span>
            </button>
          </>
        ) : (
          <>
            <button
              id="mobile-nav-pickup"
              className={`mobile-bottom-btn ${activeView === 'opengames' ? 'active' : ''}`}
              onClick={() => navigateTo('opengames')}
            >
              <Trophy size={20} />
              <span>Pickup</span>
            </button>

            <button
              id="mobile-nav-owner"
              className={`mobile-bottom-btn ${activeView === 'owner' ? 'active' : ''}`}
              onClick={openOwnerAuth}
            >
              <Building2 size={20} />
              <span>Owner Portal</span>
            </button>
          </>
        )}
      </nav>
      )}

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Footer */}
      <footer className="app-footer" style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', textAlign: 'center', fontSize: 13, color: '#64748b' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <img src="/logo-mark.png" alt="NexusPlay" style={{ width: 28, height: 28, borderRadius: 7, objectFit: 'contain', marginBottom: 2 }} />
          <div style={{ fontWeight: 700, color: '#0f172a' }}>
            NexusPlay Sports Operating System & Venue Network
          </div>
          <div>
            Direct 0% fee owner bank settlements via UPI QR · Real-time slot locking engine · Seamless player pickup matches
          </div>
        </div>
      </footer>
    </div>
  );
}
