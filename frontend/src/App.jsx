import React, { useState, useEffect } from 'react';
import PlayerMarketplace from './components/PlayerMarketplace.jsx';
import PublicBookingView from './components/PublicBookingView.jsx';
import OpenGamesHub from './components/OpenGamesHub.jsx';
import OwnerSaaSView from './components/OwnerSaaSView.jsx';
import { PlayerDashboard } from './components/PlayerDashboard.jsx';
import { AuthModal } from './components/AuthModal.jsx';
import {
  Trophy, 
  Compass, 
  LayoutDashboard, 
  Sparkles, 
  MapPin,
  Share2, 
  ShieldCheck, 
  User, 
  Building2, 
  CalendarCheck,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { api } from './api.js';

export default function App() {
  // Navigation views: 'marketplace', 'opengames', 'venue-page', 'player-dashboard', 'owner'
  const [activeView, setActiveView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    let savedUser = null;
    try {
      const saved = localStorage.getItem('nexus_user');
      savedUser = saved ? JSON.parse(saved) : null;
    } catch (e) {}

    if (params.get('venue') || params.get('v')) return 'venue-page';
    if (params.get('view') === 'owner') {
      if (savedUser?.role === 'player') return 'player-dashboard';
      return 'owner';
    }
    if (params.get('view') === 'dashboard') {
      if (savedUser?.role === 'owner') return 'owner';
      return 'player-dashboard';
    }
    if (params.get('view') === 'opengames') return 'opengames';
    return 'marketplace';
  });

  const [activeVenueSlug, setActiveVenueSlug] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('venue') || params.get('v') || 'nexus-central-koramangala';
  });

  // User Auth Session State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('nexus_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // Auth Modal State
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalRole, setAuthModalRole] = useState('player'); // 'player' | 'owner'

  // Sync session on mount
  useEffect(() => {
    const token = localStorage.getItem('nexus_token');
    if (token) {
      api.getAuthMe(token).then((res) => {
        if (res && res.user) {
          setCurrentUser(res.user);
          localStorage.setItem('nexus_user', JSON.stringify(res.user));
        }
      }).catch(() => {});
    }
  }, []);

  function navigateTo(view, venueSlug = activeVenueSlug) {
    // Strict Role Separation: When logged in as player, owner view is blocked
    if (view === 'owner' && currentUser?.role === 'player') {
      setActiveView('player-dashboard');
      window.history.pushState({}, '', '/?view=dashboard');
      return;
    }
    // Strict Role Separation: When logged in as owner, player dashboard is blocked
    if (view === 'player-dashboard' && currentUser?.role === 'owner') {
      setActiveView('owner');
      window.history.pushState({}, '', '/?view=owner');
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
    } else if (view === 'player-dashboard') {
      window.history.pushState({}, '', '/?view=dashboard');
    } else {
      window.history.pushState({}, '', '/');
    }
  }

  function handleSelectVenue(slugOrId) {
    navigateTo('venue-page', slugOrId);
  }

  function handleAuthSuccess(user, role, venue) {
    setCurrentUser(user);
    if (role === 'owner') {
      setActiveView('owner');
      window.history.pushState({}, '', '/?view=owner');
    } else {
      setActiveView('player-dashboard');
      window.history.pushState({}, '', '/?view=dashboard');
    }
  }

  function handleLogout() {
    localStorage.removeItem('nexus_token');
    localStorage.removeItem('nexus_user');
    localStorage.removeItem('nexus_owner_venue');
    setCurrentUser(null);
    navigateTo('marketplace');
  }

  function openPlayerAuth() {
    setAuthModalRole('player');
    setAuthModalOpen(true);
  }

  function openOwnerAuth() {
    if (currentUser?.role === 'owner') {
      navigateTo('owner');
    } else {
      setAuthModalRole('owner');
      setAuthModalOpen(true);
    }
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
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: 18,
                boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)'
              }}
            >
              NP
            </div>
            <div>
              <div className="font-display" style={{ fontSize: 19, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                NEXUS<span style={{ color: '#059669' }}>PLAY</span>
              </div>
              <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Sports Operating System & Arena Network
              </div>
            </div>
          </div>

          {/* Desktop Navigation Switcher */}
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
                color: activeView === 'marketplace' ? '#059669' : '#475569',
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
                color: activeView === 'venue-page' ? '#059669' : '#475569',
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

            {/* If player is logged in, show My Dashboard in nav */}
            {currentUser && currentUser.role === 'player' && (
              <button
                id="nav-player-dashboard-btn"
                onClick={() => navigateTo('player-dashboard')}
                style={{
                  background: activeView === 'player-dashboard' ? '#ffffff' : 'transparent',
                  color: activeView === 'player-dashboard' ? '#059669' : '#475569',
                  border: activeView === 'player-dashboard' ? '1px solid #cbd5e1' : '1px solid transparent',
                  borderRadius: 7,
                  padding: '7px 15px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: activeView === 'player-dashboard' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <CalendarCheck size={14} /> My Dashboard
              </button>
            )}

            {/* If owner is logged in, show Owner Hub in nav */}
            {currentUser && currentUser.role === 'owner' && (
              <button
                id="nav-owner-hub-btn"
                onClick={() => navigateTo('owner')}
                style={{
                  background: activeView === 'owner' ? '#ffffff' : 'transparent',
                  color: activeView === 'owner' ? '#059669' : '#475569',
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

          {/* Right Action Controls: Separate Player & Owner Access */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Logged in as Player */}
            {currentUser && currentUser.role === 'player' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  id="header-player-profile-btn"
                  onClick={() => navigateTo('player-dashboard')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 999,
                    padding: '5px 12px 5px 6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="Open Player Dashboard"
                >
                  <div style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: '#059669',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 800
                  }}>
                    {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'P'}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                    {currentUser.name.split(' ')[0]}
                  </span>
                  <span className="badge-emerald" style={{ padding: '1px 6px', fontSize: 10 }}>
                    Player
                  </span>
                </button>

                <button
                  id="header-logout-player-btn"
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

            {/* Not logged in: Show both Player and Owner entry points */}
            {!currentUser && (
              <>
                <button
                  id="header-player-signin-btn"
                  onClick={openPlayerAuth}
                  className="btn-secondary"
                  style={{ fontSize: 12.5, padding: '7px 14px' }}
                >
                  <User size={14} color="#059669" />
                  <span>Player Sign In</span>
                </button>

                <button
                  id="header-owner-portal-btn"
                  onClick={openOwnerAuth}
                  style={{
                    background: activeView === 'owner' ? '#059669' : '#ffffff',
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
                    boxShadow: activeView === 'owner' ? '0 2px 8px rgba(5,150,105,0.25)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Building2 size={14} color={activeView === 'owner' ? '#ffffff' : '#059669'} />
                  <span>Owner Portal</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Screen Views with Strict Role Separation */}
      <main style={{ flex: 1, padding: '20px 0 80px' }}>
        {activeView === 'marketplace' && (
          <PlayerMarketplace 
            onSelectVenue={handleSelectVenue} 
            currentUser={currentUser}
            onOpenAuth={openPlayerAuth}
          />
        )}

        {activeView === 'opengames' && (
          <OpenGamesHub 
            onNavigateToVenue={handleSelectVenue}
            currentUser={currentUser}
            onOpenAuth={openPlayerAuth}
          />
        )}

        {activeView === 'venue-page' && (
          <PublicBookingView
            slug={activeVenueSlug}
            onBack={() => navigateTo('marketplace')}
            currentUser={currentUser}
          />
        )}

        {/* PLAYER PROFILE / DASHBOARD: GUARANTEED HIDDEN FOR OWNERS */}
        {activeView === 'player-dashboard' && (
          currentUser && currentUser.role === 'owner' ? (
            <div style={{ maxWidth: 540, margin: '60px auto', padding: '36px 24px', background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.05)' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Building2 size={28} />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Owner Account Active</h2>
              <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                You are currently signed in as an <strong>Arena Owner ({currentUser.name})</strong>. Player Profile is strictly separated and reserved for player accounts.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  id="btn-return-owner-hub"
                  onClick={() => navigateTo('owner')}
                  className="btn-primary"
                  style={{ padding: '10px 20px', fontSize: 13 }}
                >
                  Return to Owner Hub
                </button>
                <button
                  id="btn-switch-to-player"
                  onClick={() => {
                    handleLogout();
                    openPlayerAuth();
                  }}
                  className="btn-secondary"
                  style={{ padding: '10px 16px', fontSize: 13 }}
                >
                  Switch to Player Account
                </button>
              </div>
            </div>
          ) : (
            <PlayerDashboard
              user={currentUser}
              onBookVenue={() => navigateTo('marketplace')}
              onBrowseGames={() => navigateTo('opengames')}
              onLogout={handleLogout}
            />
          )
        )}

        {/* OWNER HUB / DASHBOARD: GUARANTEED HIDDEN FOR PLAYERS */}
        {activeView === 'owner' && (
          currentUser && currentUser.role === 'player' ? (
            <div style={{ maxWidth: 540, margin: '60px auto', padding: '36px 24px', background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.05)' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <User size={28} />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Player Profile Active</h2>
              <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                You are currently signed in as a <strong>Player ({currentUser.name})</strong>. The Owner Dashboard is strictly separated and accessible only to arena managers.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  id="btn-return-player-dashboard"
                  onClick={() => navigateTo('player-dashboard')}
                  className="btn-primary"
                  style={{ padding: '10px 20px', fontSize: 13 }}
                >
                  Return to Player Profile
                </button>
                <button
                  id="btn-switch-to-owner"
                  onClick={() => {
                    handleLogout();
                    openOwnerAuth();
                  }}
                  className="btn-secondary"
                  style={{ padding: '10px 16px', fontSize: 13 }}
                >
                  Switch to Owner Account
                </button>
              </div>
            </div>
          ) : (
            <OwnerSaaSView
              onNavigateToPublicPage={(slug) => {
                navigateTo('venue-page', slug);
              }}
            />
          )
        )}
      </main>

      {/* Role-Tailored Mobile Bottom Navigation: Mutually Exclusive */}
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
            {/* Owner Mobile Navigation: NO Player Profile visible */}
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
        ) : currentUser?.role === 'player' ? (
          <>
            {/* Player Mobile Navigation: NO Owner Dashboard visible */}
            <button
              id="mobile-nav-pickup"
              className={`mobile-bottom-btn ${activeView === 'opengames' ? 'active' : ''}`}
              onClick={() => navigateTo('opengames')}
            >
              <Trophy size={20} />
              <span>Pickup</span>
            </button>

            <button
              id="mobile-nav-player-profile"
              className={`mobile-bottom-btn ${activeView === 'player-dashboard' ? 'active' : ''}`}
              onClick={() => navigateTo('player-dashboard')}
            >
              <CalendarCheck size={20} />
              <span>My Profile</span>
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
            {/* Guest / Unauthenticated Mobile Navigation */}
            <button
              id="mobile-nav-pickup"
              className={`mobile-bottom-btn ${activeView === 'opengames' ? 'active' : ''}`}
              onClick={() => navigateTo('opengames')}
            >
              <Trophy size={20} />
              <span>Pickup</span>
            </button>

            <button
              id="mobile-nav-dashboard"
              className="mobile-bottom-btn"
              onClick={openPlayerAuth}
            >
              <CalendarCheck size={20} />
              <span>Player Login</span>
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

      {/* Authentication Modal with Dedicated Player & Owner Screens */}
      <AuthModal
        isOpen={authModalOpen}
        initialRole={authModalRole}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Footer */}
      <footer style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', padding: '24px 20px', textAlign: 'center', fontSize: 13, color: '#64748b' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
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
