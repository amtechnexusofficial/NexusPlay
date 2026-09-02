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
  const [activeView, setActiveView] = useState('marketplace');
  const [activeVenueSlug, setActiveVenueSlug] = useState('nexus-central-koramangala');

  function handleSelectVenue(slugOrId) {
    setActiveVenueSlug(slugOrId);
    setActiveView('venue-page');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Global Brand Header */}
      <header
        style={{
          background: '#12141a',
          borderBottom: '1px solid var(--border-card)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(8px)'
        }}
      >
        <div
          style={{
            maxWidth: 1240,
            margin: '0 auto',
            padding: '14px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          {/* Logo & Tagline */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            onClick={() => setActiveView('marketplace')}
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
                color: '#042f1f',
                fontWeight: 900,
                fontSize: 18,
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)'
              }}
            >
              NP
            </div>
            <div>
              <div className="font-display" style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}>
                NEXUS<span style={{ color: 'var(--accent-neon)' }}>PLAY</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Turf SaaS & Player Hub
              </div>
            </div>
          </div>

          {/* Center Navigation Switcher */}
          <nav style={{ display: 'flex', background: '#0e1117', padding: 4, borderRadius: 12, border: '1px solid var(--border-card)' }}>
            <button
              onClick={() => setActiveView('marketplace')}
              style={{
                background: activeView === 'marketplace' ? 'var(--bg-card)' : 'transparent',
                color: activeView === 'marketplace' ? 'var(--accent-neon)' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Compass size={15} /> Venues
            </button>

            <button
              onClick={() => setActiveView('opengames')}
              style={{
                background: activeView === 'opengames' ? 'var(--bg-card)' : 'transparent',
                color: activeView === 'opengames' ? 'var(--accent-neon)' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                position: 'relative'
              }}
            >
              <Trophy size={15} /> Open Games
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fb923c' }} />
            </button>

            <button
              onClick={() => setActiveView('venue-page')}
              style={{
                background: activeView === 'venue-page' ? 'var(--bg-card)' : 'transparent',
                color: activeView === 'venue-page' ? 'var(--accent-neon)' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Share2 size={15} /> Public Turf URL
            </button>

            <button
              onClick={() => setActiveView('owner')}
              style={{
                background: activeView === 'owner' ? '#10b981' : 'transparent',
                color: activeView === 'owner' ? '#042f1f' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <LayoutDashboard size={15} /> Venue Owner SaaS
            </button>
          </nav>

          {/* User / Direct Route Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <ShieldCheck size={14} style={{ color: 'var(--accent-neon)' }} /> Direct-to-Venue Routing
            </div>
          </div>
        </div>
      </header>

      {/* Main Screen Views */}
      <main style={{ flex: 1, padding: '24px 0' }}>
        {activeView === 'marketplace' && (
          <PlayerMarketplace onSelectVenue={handleSelectVenue} />
        )}

        {activeView === 'opengames' && (
          <OpenGamesHub onNavigateToVenue={handleSelectVenue} />
        )}

        {activeView === 'venue-page' && (
          <PublicBookingView
            slug={activeVenueSlug}
            onBack={() => setActiveView('marketplace')}
          />
        )}

        {activeView === 'owner' && (
          <OwnerSaaSView
            onNavigateToPublicPage={(slug) => {
              setActiveVenueSlug(slug);
              setActiveView('venue-page');
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer style={{ background: '#0b0d11', borderTop: '1px solid var(--border-card)', padding: '24px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
        NexusPlay Multi-Tenant Sports Operating System · Real-time concurrency slot locks & direct merchant settlement
      </footer>
    </div>
  );
}
