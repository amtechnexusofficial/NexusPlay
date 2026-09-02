import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import {
  Search, MapPin, Calendar, Clock, Star,
  Shield, Compass, Sparkles, Filter, ChevronRight
} from 'lucide-react';

export default function PlayerMarketplace({ onSelectVenue }) {
  const [venues, setVenues] = useState([]);
  const [sports, setSports] = useState([]);
  const [selectedSport, setSelectedSport] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState(2500);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [vData, sData] = await Promise.all([
          api.getMarketplaceVenues(),
          api.getSports()
        ]);
        setVenues(vData);
        setSports(sData);
      } catch (err) {
        console.error('Error fetching marketplace:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredVenues = venues.filter(v => {
    const matchesSport = selectedSport === 'all' || v.sport_ids?.includes(selectedSport);
    const matchesSearch = !searchQuery ||
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.city.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSport && matchesSearch;
  });

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1120, margin: '0 auto', padding: '16px 20px 80px' }}>
      {/* Search Hero Banner */}
      <div className="nexus-card" style={{ padding: '36px 32px', marginBottom: 28, background: 'linear-gradient(135deg, #10141d 0%, #17212f 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 680 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-neon)', padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
            <Sparkles size={14} /> Direct Venue Reservation & Open Pickups
          </div>
          <h1 className="font-display" style={{ fontSize: 36, fontWeight: 800, color: '#fff', lineHeight: 1.15, marginBottom: 10 }}>
            Find and Book Premium Sports Arenas
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.5, marginBottom: 24 }}>
            Zero convenience fees. Direct payments to turf owners. Guaranteed slot locks with no double-booking race conditions.
          </p>

          {/* Search Bar */}
          <div style={{ display: 'flex', gap: 10, background: '#0e1117', padding: 8, borderRadius: 12, border: '1px solid var(--border-card)', maxWidth: 600 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, paddingLeft: 8 }}>
              <Search size={18} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search venue name, area (e.g. Koramangala, Indiranagar)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', width: '100%', fontSize: 14 }}
              />
            </div>
            <button className="btn-primary" style={{ padding: '8px 20px' }}>
              Explore
            </button>
          </div>
        </div>
      </div>

      {/* Sport Category Pills */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 24 }}>
        <button
          onClick={() => setSelectedSport('all')}
          style={{
            background: selectedSport === 'all' ? 'var(--accent-neon)' : 'var(--bg-card)',
            color: selectedSport === 'all' ? '#042f1f' : '#fff',
            border: `1px solid ${selectedSport === 'all' ? 'var(--accent-neon)' : 'var(--border-card)'}`,
            padding: '8px 18px',
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          All Arenas ({venues.length})
        </button>
        {sports.map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedSport(s.id)}
            style={{
              background: selectedSport === s.id ? 'var(--accent-neon)' : 'var(--bg-card)',
              color: selectedSport === s.id ? '#042f1f' : '#fff',
              border: `1px solid ${selectedSport === s.id ? 'var(--accent-neon)' : 'var(--border-card)'}`,
              padding: '8px 16px',
              borderRadius: 999,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap'
            }}
          >
            <span>{s.icon}</span> {s.name}
          </button>
        ))}
      </div>

      {/* Venue List Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 24 }}>
        {filteredVenues.map(venue => (
          <div
            key={venue.id}
            className="nexus-card"
            style={{ overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
            onClick={() => onSelectVenue(venue.slug || venue.id)}
          >
            <div style={{ position: 'relative', height: 180 }}>
              <img
                src={venue.photos?.[0] || 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=600&q=80'}
                alt={venue.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6 }}>
                <span className="badge-neon" style={{ borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>
                  ★ {venue.rating || 4.9}
                </span>
                <span style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', color: '#fff', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>
                  {venue.city || 'Bangalore'}
                </span>
              </div>
              <div style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,0.8)', color: 'var(--accent-neon)', fontWeight: 800, fontSize: 14, padding: '4px 10px', borderRadius: 8 }}>
                Live Slots Available
              </div>
            </div>

            <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
                {venue.name}
              </h3>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <MapPin size={14} style={{ color: 'var(--accent-neon)', flexShrink: 0 }} />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{venue.address}</span>
              </div>

              {/* Sports Offered Tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
                {venue.sport_ids?.slice(0, 4).map(sp => (
                  <span
                    key={sp}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: 6,
                      padding: '3px 8px',
                      fontSize: 11.5,
                      color: 'var(--text-secondary)',
                      textTransform: 'capitalize'
                    }}
                  >
                    {sp}
                  </span>
                ))}
                {venue.sport_ids?.length > 4 && (
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', alignSelf: 'center' }}>
                    +{venue.sport_ids.length - 4} more
                  </span>
                )}
              </div>

              <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid var(--border-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>HOURS</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{venue.open_time} - {venue.close_time}</div>
                </div>
                <span className="btn-primary" style={{ padding: '7px 16px', fontSize: 13 }}>
                  Book Slot <ChevronRight size={15} />
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
