import React, { useState } from 'react';
import PlayerMarketplace from './components/PlayerMarketplace.jsx';
import PublicBookingView from './components/PublicBookingView.jsx';
import OpenGamesHub from './components/OpenGamesHub.jsx';
import OwnerSaaSView from './components/OwnerSaaSView.jsx';
import {
  Trophy, Compass, LayoutDashboard, Sparkles, MapPin,
  Share2, ShieldCheck, User
} from 'lucide-react';

export default function App() {
  // Navigation tabs: 'marketplace', 'opengames', 'owner', 'venue-page'
  const [activeView, setActiveView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('venue') || params.get('v')) return 'venue-page';
    if (params.get('view') === 'owner') return 'owner';
    if (params.get('view') === 'opengames') return 'opengames';
    return 'marketplace';
  });

  const [activeVenueSlug, setActiveVenueSlug] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('venue') || params.get('v') || 'nexus-central-koramangala';
  });

  // Keep URL updated for bookmarking and unique links
  function navigateTo(view, venueSlug = activeVenueSlug) {
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-dark)' }}>
      {/* Global Brand Header */}
      <header
        style={{
          background: 'rgba(10, 15, 29, 0.94)',
          borderBottom: '1px solid var(--border-card)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(12px)'
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
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            onClick={() => navigateTo('marketplace')}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#022c22',
                fontWeight: 900,
                fontSize: 18,
                boxShadow: '0 0 16px rgba(16, 185, 129, 0.35)'
              }}
            >
              NP
            </div>
            <div>
              <div className="font-display" style={{ fontSize: 19, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                NEXUS<span style={{ color: '#10b981' }}>PLAY</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Sports Operating System & Arena Network
              </div>
            </div>
          </div>

          {/* Desktop Navigation Switcher */}
          <nav className="desktop-nav" style={{ background: '#070b14', padding: 4, borderRadius: 10, border: '1px solid var(--border-card)', gap: 3 }}>
            <button
              onClick={() => navigateTo('marketplace')}
              style={{
                background: activeView === 'marketplace' ? '#141e34' : 'transparent',
                color: activeView === 'marketplace' ? '#34d399' : 'var(--text-secondary)',
                border: activeView === 'marketplace' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent',
                borderRadius: 7,
                padding: '7px 15px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              <Compass size={14} /> Nearby Turfs
            </button>

            <button
              onClick={() => navigateTo('opengames')}
              style={{
                background: activeView === 'opengames' ? '#141e34' : 'transparent',
                color: activeView === 'opengames' ? '#fbbf24' : 'var(--text-secondary)',
                border: activeView === 'opengames' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent',
                borderRadius: 7,
                padding: '7px 15px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              <Trophy size={14} /> Pickup Games
            </button>

            <button
              onClick={() => navigateTo('venue-page')}
              style={{
                background: activeView === 'venue-page' ? '#141e34' : 'transparent',
                color: activeView === 'venue-page' ? '#34d399' : 'var(--text-secondary)',
                border: activeView === 'venue-page' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent',
                borderRadius: 7,
                padding: '7px 15px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              <Share2 size={14} /> Unique Turf URL
            </button>

            <button
              onClick={() => navigateTo('owner')}
              style={{
                background: activeView === 'owner' ? '#10b981' : 'transparent',
                color: activeView === 'owner' ? '#022c22' : 'var(--text-secondary)',
                border: '1px solid transparent',
                borderRadius: 7,
                padding: '7px 15px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: activeView === 'owner' ? '0 0 12px rgba(16, 185, 129, 0.4)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <LayoutDashboard size={14} /> Owner Dashboard
            </button>
          </nav>

          {/* Direct Settlement Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge-emerald" style={{ fontSize: 11, padding: '4px 10px' }}>
              <ShieldCheck size={13} /> Direct Settlement
            </span>
          </div>
        </div>
      </header>

      {/* Main Screen Views */}
      <main style={{ flex: 1, padding: '20px 0 80px' }}>
        {activeView === 'marketplace' && (
          <PlayerMarketplace onSelectVenue={handleSelectVenue} />
        )}

        {activeView === 'opengames' && (
          <OpenGamesHub onNavigateToVenue={handleSelectVenue} />
        )}

        {activeView === 'venue-page' && (
          <PublicBookingView
            slug={activeVenueSlug}
            onBack={() => navigateTo('marketplace')}
          />
        )}

        {activeView === 'owner' && (
          <OwnerSaaSView
            onNavigateToPublicPage={(slug) => {
              navigateTo('venue-page', slug);
            }}
          />
        )}
      </main>

      {/* Native Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-bar">
        <button
          className={`mobile-bottom-btn ${activeView === 'marketplace' ? 'active' : ''}`}
          onClick={() => navigateTo('marketplace')}
        >
          <Compass size={20} />
          <span>Turfs</span>
        </button>

        <button
          className={`mobile-bottom-btn ${activeView === 'opengames' ? 'active' : ''}`}
          onClick={() => navigateTo('opengames')}
        >
          <Trophy size={20} />
          <span>Pickup</span>
        </button>

        <button
          className={`mobile-bottom-btn ${activeView === 'venue-page' ? 'active' : ''}`}
          onClick={() => navigateTo('venue-page')}
        >
          <Share2 size={20} />
          <span>Turf Link</span>
        </button>

        <button
          className={`mobile-bottom-btn ${activeView === 'owner' ? 'active' : ''}`}
          onClick={() => navigateTo('owner')}
        >
          <LayoutDashboard size={20} />
          <span>Owner Hub</span>
        </button>
      </nav>

      {/* Footer */}
      <footer style={{ background: '#070b14', borderTop: '1px solid var(--border-card)', padding: '20px 20px', textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>
        NexusPlay Sports Operating System · Location-based discovery, live slot management, and direct owner bank settlement
      </footer>
    </div>
  );
}
