import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { Search, MapPin, Sparkles, ChevronRight, Check, Copy } from 'lucide-react';

const CITY_STORAGE_KEY = 'nexus_selected_city';

function normalizeCity(city) {
  return (city || '').trim().toLowerCase();
}

function readSavedCity() {
  try {
    return localStorage.getItem(CITY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function saveCity(city) {
  try {
    if (city) localStorage.setItem(CITY_STORAGE_KEY, city);
    else localStorage.removeItem(CITY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export default function PlayerMarketplace({ onSelectVenue }) {
  const [venues, setVenues] = useState([]);
  const [sports, setSports] = useState([]);
  const [selectedSport, setSelectedSport] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('slots_desc');
  const [copiedSlug, setCopiedSlug] = useState(null);
  const [loadError, setLoadError] = useState('');

  const [selectedCity, setSelectedCity] = useState(() => readSavedCity());
  const [choosingCity, setChoosingCity] = useState(() => !readSavedCity());

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setLoadError('');
        const [vData, sData] = await Promise.all([
          api.getMarketplaceVenues(),
          api.getSports()
        ]);
        setVenues(vData);
        setSports(sData);
      } catch (err) {
        console.error('Error fetching marketplace:', err);
        setLoadError(err.message || 'Could not reach the server.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // If a saved city no longer has any published turfs, force re-pick.
  useEffect(() => {
    if (loading || choosingCity || !selectedCity || venues.length === 0) return;
    const stillAvailable = venues.some(
      (v) => normalizeCity(v.city) === normalizeCity(selectedCity)
    );
    if (!stillAvailable) {
      setChoosingCity(true);
    }
  }, [loading, choosingCity, selectedCity, venues]);

  const availableCities = Array.from(
    new Set(
      venues
        .map((v) => (v.city || '').trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  function confirmCity(cityName) {
    const trimmed = (cityName || '').trim();
    if (!trimmed) return;
    setSelectedCity(trimmed);
    saveCity(trimmed);
    setChoosingCity(false);
    setSearchQuery('');
  }

  function handleChangeCity() {
    setChoosingCity(true);
  }

  function handleCopyUniqueLink(e, venue) {
    e.stopPropagation();
    const url = `${window.location.origin}/?venue=${venue.slug || venue.id}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(venue.slug || venue.id);
    setTimeout(() => setCopiedSlug(null), 2500);
  }

  const cityVenues = venues.filter(
    (v) => selectedCity && normalizeCity(v.city) === normalizeCity(selectedCity)
  );

  const filteredVenues = cityVenues.filter((v) => {
    const matchesSport = selectedSport === 'all' || v.sport_ids?.includes(selectedSport);
    const matchesSearch = !searchQuery ||
      (v.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.address || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSport && matchesSearch;
  });

  filteredVenues.sort((a, b) => {
    if (sortBy === 'slots_desc') {
      return (b.today_available_slots_count || 0) - (a.today_available_slots_count || 0);
    }
    if (sortBy === 'price_asc') {
      return (a.min_price || 0) - (b.min_price || 0);
    }
    return (a.name || '').localeCompare(b.name || '');
  });

  if (choosingCity) {
    return (
      <div className="animate-fade-in marketplace-container" style={{ maxWidth: 520, margin: '0 auto', paddingTop: 24 }}>
        <div
          className="nexus-card"
          style={{
            padding: '28px 24px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#4f46e5', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
            <MapPin size={13} /> Choose your city
          </div>
          <h1 className="font-display" style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1.25, margin: 0 }}>
            Where do you want to play?
          </h1>
          <p style={{ color: '#64748b', fontSize: 13.5, marginTop: 8, marginBottom: 20, lineHeight: 1.5 }}>
            Tap a city to see turfs available there. You can change this anytime.
          </p>

          {loading ? (
            <div style={{ fontSize: 13, color: '#64748b', padding: '12px 0' }}>Loading cities with turfs…</div>
          ) : loadError ? (
            <div style={{ fontSize: 13, color: '#b91c1c' }}>{loadError}</div>
          ) : availableCities.length === 0 ? (
            <div style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.5 }}>
              No cities have published turfs yet. Check back once an owner goes live.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {availableCities.map((city) => {
                const count = venues.filter((v) => normalizeCity(v.city) === normalizeCity(city)).length;
                const isActive = normalizeCity(city) === normalizeCity(selectedCity);
                return (
                  <button
                    key={city}
                    type="button"
                    id={`city-option-${normalizeCity(city).replace(/\s+/g, '-')}`}
                    onClick={() => confirmCity(city)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      width: '100%',
                      textAlign: 'left',
                      background: isActive ? '#4f46e5' : '#ffffff',
                      color: isActive ? '#ffffff' : '#0f172a',
                      border: `1px solid ${isActive ? '#4f46e5' : '#cbd5e1'}`,
                      padding: '14px 16px',
                      borderRadius: 10,
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <MapPin size={16} style={{ color: isActive ? '#c7d2fe' : '#4f46e5', flexShrink: 0 }} />
                      {city}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: isActive ? '#e0e7ff' : '#64748b' }}>
                      {count} turf{count === 1 ? '' : 's'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in marketplace-container" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div
        id="marketplace-hero"
        className="nexus-card marketplace-hero-card"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
          <div style={{ flex: '1 1 280px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#4f46e5', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
              <Sparkles size={13} /> LIVE TURF DISCOVERY & LOCAL SLOTS
            </div>
            <h1 className="font-display marketplace-hero-title" style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1.25, margin: 0 }}>
              Turfs in {selectedCity}
            </h1>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 4, marginBottom: 0 }}>
              Showing arenas in your city. Browse live slots and book as a guest — no account needed.
            </p>
          </div>

          <button
            type="button"
            id="btn-change-city"
            onClick={handleChangeCity}
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 16px',
              fontSize: 12.5,
              fontWeight: 700,
              width: 'auto'
            }}
          >
            <MapPin size={14} /> Change city
          </button>
        </div>

        <div className="mobile-stack" style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#ffffff', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', flex: 1, minHeight: 42 }}>
            <Search size={15} style={{ color: '#94a3b8' }} />
            <input
              id="marketplace-search-input"
              type="text"
              placeholder="Search by arena name or area..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: '#0f172a', outline: 'none', width: '100%', fontSize: 13 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
            <select
              id="marketplace-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="nexus-input"
              style={{ padding: '8px 12px', fontSize: 13, width: '100%', background: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1' }}
            >
              <option value="slots_desc">Sort: Most Live Slots Today</option>
              <option value="price_asc">Sort: Price (Lowest First)</option>
              <option value="name">Sort: Name (A–Z)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="scroll-pills" style={{ marginBottom: 20 }}>
        <button
          onClick={() => setSelectedSport('all')}
          style={{
            background: selectedSport === 'all' ? '#4f46e5' : '#ffffff',
            color: selectedSport === 'all' ? '#ffffff' : '#334155',
            border: `1px solid ${selectedSport === 'all' ? '#4f46e5' : '#cbd5e1'}`,
            padding: '7px 16px',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 12.5,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
          }}
        >
          All Sports ({cityVenues.length})
        </button>
        {sports.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedSport(s.id)}
            style={{
              background: selectedSport === s.id ? '#4f46e5' : '#ffffff',
              color: selectedSport === s.id ? '#ffffff' : '#334155',
              border: `1px solid ${selectedSport === s.id ? '#4f46e5' : '#cbd5e1'}`,
              padding: '7px 14px',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 12.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
          >
            <span>{s.icon}</span> {s.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="nexus-card" style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
          Loading turfs...
        </div>
      ) : loadError ? (
        <div className="nexus-card" style={{ padding: 32, textAlign: 'center', border: '1px solid #fecaca', background: '#fef2f2' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#b91c1c', marginBottom: 6 }}>
            Couldn&apos;t load turfs
          </div>
          <div style={{ fontSize: 12.5, color: '#7f1d1d' }}>{loadError}</div>
        </div>
      ) : filteredVenues.length === 0 ? (
        <div className="nexus-card" style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
          {cityVenues.length === 0 ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                No turfs in {selectedCity} yet
              </div>
              <p style={{ fontSize: 13.5, margin: '0 0 16px' }}>
                Try another city, or check back once an owner publishes a venue here.
              </p>
              <button type="button" className="btn-primary" onClick={handleChangeCity} style={{ padding: '10px 18px' }}>
                Change city
              </button>
            </>
          ) : (
            'No turfs match your current search/filter.'
          )}
        </div>
      ) : (
        <div className="marketplace-grid">
          {filteredVenues.map((venue) => {
            const isCopied = copiedSlug === (venue.slug || venue.id);

            return (
              <div
                key={venue.id}
                className="nexus-card"
                style={{
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}
                onClick={() => onSelectVenue(venue.slug || venue.id)}
              >
                <div style={{ position: 'relative', height: 185 }}>
                  <img
                    src={venue.photos?.[0] || 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=600&q=80'}
                    alt={venue.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />

                  <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6 }}>
                    {venue.city && (
                      <span
                        style={{
                          background: 'rgba(15, 23, 42, 0.75)',
                          backdropFilter: 'blur(4px)',
                          color: '#e2e8f0',
                          fontWeight: 600,
                          fontSize: 11.5,
                          padding: '4px 8px',
                          borderRadius: 6,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <MapPin size={12} /> {venue.city}
                      </span>
                    )}

                    {venue.review_count > 0 && (
                      <span
                        style={{
                          background: 'rgba(15, 23, 42, 0.75)',
                          backdropFilter: 'blur(4px)',
                          color: '#fbbf24',
                          fontWeight: 700,
                          fontSize: 11.5,
                          padding: '4px 8px',
                          borderRadius: 6,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3
                        }}
                      >
                        ★ {venue.avg_rating} <span style={{ color: '#cbd5e1', fontWeight: 500 }}>({venue.review_count})</span>
                      </span>
                    )}
                  </div>

                  <div style={{ position: 'absolute', bottom: 10, right: 10, display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
                    {venue.open_games_today_count > 0 && (
                      <span
                        style={{
                          background: '#f59e0b',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: 11.5,
                          padding: '4px 9px',
                          borderRadius: 6,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.35)'
                        }}
                      >
                        🔥 {venue.open_games_today_count} open game{venue.open_games_today_count === 1 ? '' : 's'} — join now
                      </span>
                    )}
                    <span
                      style={{
                        background: 'rgba(15, 23, 42, 0.88)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        color: venue.today_available_slots_count > 0 ? '#34d399' : '#94a3b8',
                        fontWeight: 700,
                        fontSize: 11.5,
                        padding: '4px 9px',
                        borderRadius: 6
                      }}
                    >
                      {venue.today_available_slots_count > 0
                        ? `${venue.today_available_slots_count} slots open today`
                        : 'Check availability'}
                    </span>
                  </div>
                </div>

                <div style={{ padding: '18px 20px', flex: 1, display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <h3 style={{ fontSize: 17.5, fontWeight: 800, color: '#0f172a', lineHeight: 1.3, margin: 0 }}>
                      {venue.name}
                    </h3>
                    <button
                      onClick={(e) => handleCopyUniqueLink(e, venue)}
                      title="Copy Unique Turf Booking URL"
                      style={{
                        background: isCopied ? '#059669' : '#f1f5f9',
                        color: isCopied ? '#ffffff' : '#334155',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        padding: '5px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        flexShrink: 0
                      }}
                    >
                      {isCopied ? <Check size={12} /> : <Copy size={12} />}
                      {isCopied ? 'Copied' : 'Turf Link'}
                    </button>
                  </div>

                  <div style={{ fontSize: 12.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                    <MapPin size={13} style={{ color: '#4f46e5', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{venue.address}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 3, marginBottom: 12 }}>
                    {venue.open_time && venue.close_time ? `Open ${venue.open_time} – ${venue.close_time}` : ' '}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
                    {(Array.isArray(venue.amenities) ? venue.amenities : []).slice(0, 3).map((am, i) => (
                      <span
                        key={i}
                        style={{
                          background: '#f1f5f9',
                          borderRadius: 4,
                          padding: '2px 7px',
                          fontSize: 11,
                          color: '#475569',
                          border: '1px solid #e2e8f0'
                        }}
                      >
                        {am}
                      </span>
                    ))}
                    {venue.amenities?.length > 3 && (
                      <span style={{ fontSize: 11, color: '#64748b', alignSelf: 'center' }}>
                        +{venue.amenities.length - 3} more
                      </span>
                    )}
                  </div>

                  <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 10.5, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                        Starting From
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                        ₹{venue.min_price || 800}
                        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>/hr</span>
                      </div>
                    </div>

                    <span className="btn-primary" style={{ padding: '8px 16px', fontSize: 12.5 }}>
                      Select Slot <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
