import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { Search, MapPin, Sparkles, ChevronRight, Navigation, Check, Copy } from 'lucide-react';

// Haversine distance calculation in kilometers
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export default function PlayerMarketplace({ onSelectVenue }) {
  const [venues, setVenues] = useState([]);
  const [sports, setSports] = useState([]);
  const [selectedSport, setSelectedSport] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Geolocation state
  const [userCoords, setUserCoords] = useState(null);
  const [locatingUser, setLocatingUser] = useState(false);
  const [locationStatusText, setLocationStatusText] = useState('Allow location to sort turfs by distance to you');
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [sortBy, setSortBy] = useState('distance'); // 'distance', 'price_asc', 'slots_desc', 'rating'
  const [copiedSlug, setCopiedSlug] = useState(null);

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

  function handleRequestLocation() {
    if (!navigator.geolocation) {
      setLocationStatusText('Geolocation is not supported by your browser. You can use Bangalore presets below.');
      return;
    }
    setLocatingUser(true);
    setLocationStatusText('Acquiring your GPS position...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        setLocationPermissionGranted(true);
        setLocatingUser(false);
        setLocationStatusText(`Location active! Showing nearest turfs to you.`);
        setSortBy('distance');
      },
      (err) => {
        setLocatingUser(false);
        console.warn('Geolocation denied or error:', err.message);
        setLocationStatusText('Location access was denied or timed out. Click any quick area preset below.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  function handlePresetLocation(area) {
    if (area === 'koramangala') {
      setUserCoords({ lat: 12.9352, lng: 77.6245 });
      setLocationPermissionGranted(true);
      setLocationStatusText('Using Koramangala GPS reference point (12.9352° N, 77.6245° E)');
    } else if (area === 'indiranagar') {
      setUserCoords({ lat: 12.9784, lng: 77.6408 });
      setLocationPermissionGranted(true);
      setLocationStatusText('Using Indiranagar GPS reference point (12.9784° N, 77.6408° E)');
    } else if (area === 'hsr') {
      setUserCoords({ lat: 12.9116, lng: 77.6534 });
      setLocationPermissionGranted(true);
      setLocationStatusText('Using HSR Layout GPS reference point (12.9116° N, 77.6534° E)');
    } else {
      setUserCoords(null);
      setLocationPermissionGranted(false);
      setLocationStatusText('Showing all turfs across Bengaluru');
    }
  }

  function handleCopyUniqueLink(e, venue) {
    e.stopPropagation();
    const url = `${window.location.origin}/?venue=${venue.slug || venue.id}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(venue.slug || venue.id);
    setTimeout(() => setCopiedSlug(null), 2500);
  }

  // Filter & calculate distances
  const enrichedVenues = venues.map(v => {
    let distance = null;
    if (userCoords && v.lat && v.lng) {
      distance = calculateDistanceKm(userCoords.lat, userCoords.lng, v.lat, v.lng);
    }
    return {
      ...v,
      distanceKm: distance
    };
  });

  const filteredVenues = enrichedVenues.filter(v => {
    const matchesSport = selectedSport === 'all' || v.sport_ids?.includes(selectedSport);
    const matchesSearch = !searchQuery ||
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.city && v.city.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSport && matchesSearch;
  });

  // Sort venues
  filteredVenues.sort((a, b) => {
    if (sortBy === 'distance') {
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      if (a.distanceKm !== null) return -1;
      if (b.distanceKm !== null) return 1;
      return 0;
    }
    if (sortBy === 'price_asc') {
      return (a.min_price || 0) - (b.min_price || 0);
    }
    if (sortBy === 'slots_desc') {
      return (b.today_available_slots_count || 0) - (a.today_available_slots_count || 0);
    }
    return 0;
  });

  return (
    <div className="animate-fade-in marketplace-container" style={{ maxWidth: 1200, margin: '0 auto' }}>
      
      {/* Search & Location Hero Header */}
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
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#059669', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
              <Sparkles size={13} /> LIVE TURF DISCOVERY & LOCAL SLOTS
            </div>
            <h1 className="font-display marketplace-hero-title" style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1.25, margin: 0 }}>
              Find Sports Arenas Near You
            </h1>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 4, marginBottom: 0 }}>
              Allow location to calculate real-time distance, view live slot availability, registered player counts, and prices set by owners.
            </p>
          </div>

          {/* Location Request Button & Quick Presets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start', flex: '0 0 auto' }}>
            <button
              id="btn-request-location"
              onClick={handleRequestLocation}
              disabled={locatingUser}
              className={locationPermissionGranted ? "btn-secondary" : "btn-primary"}
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
              <Navigation size={14} style={{ transform: locatingUser ? 'rotate(45deg)' : 'none', transition: 'transform 0.3s' }} />
              {locatingUser ? 'Locating...' : locationPermissionGranted ? '📍 Location Active' : 'Use My Current Location'}
            </button>
            <div style={{ fontSize: 11, color: locationPermissionGranted ? '#059669' : '#64748b' }}>
              {locationStatusText}
            </div>
          </div>
        </div>

        {/* Location Presets if browser geolocation unavailable */}
        <div className="location-preset-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid #e2e8f0', fontSize: 12 }}>
          <span style={{ color: '#64748b', fontWeight: 600, fontSize: 11.5 }}>Bangalore Presets:</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => handlePresetLocation('koramangala')}
              style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', padding: '4px 10px', borderRadius: 6, fontSize: 11.5, cursor: 'pointer', fontWeight: 600 }}
            >
              Koramangala
            </button>
            <button
              onClick={() => handlePresetLocation('indiranagar')}
              style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', padding: '4px 10px', borderRadius: 6, fontSize: 11.5, cursor: 'pointer', fontWeight: 600 }}
            >
              Indiranagar
            </button>
            <button
              onClick={() => handlePresetLocation('hsr')}
              style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', padding: '4px 10px', borderRadius: 6, fontSize: 11.5, cursor: 'pointer', fontWeight: 600 }}
            >
              HSR Layout
            </button>
            {locationPermissionGranted && (
              <button
                onClick={() => handlePresetLocation('reset')}
                style={{ background: 'transparent', border: 'none', color: '#64748b', textDecoration: 'underline', fontSize: 11, cursor: 'pointer' }}
              >
                Reset GPS
              </button>
            )}
          </div>
        </div>

        {/* Search Bar & Sort Dropdown */}
        <div className="mobile-stack" style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#ffffff', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', flex: 1, minHeight: 42 }}>
            <Search size={15} style={{ color: '#94a3b8' }} />
            <input
              id="marketplace-search-input"
              type="text"
              placeholder="Search by arena name or area (Koramangala, Indiranagar)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: '#0f172a', outline: 'none', width: '100%', fontSize: 13 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
            <select
              id="marketplace-sort-select"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="nexus-input"
              style={{ padding: '8px 12px', fontSize: 13, width: '100%', background: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1' }}
            >
              <option value="distance">Sort: Nearest to Me</option>
              <option value="slots_desc">Sort: Most Live Slots Today</option>
              <option value="price_asc">Sort: Price (Lowest First)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sport Category Filter Pills */}
      <div className="scroll-pills" style={{ marginBottom: 20 }}>
        <button
          onClick={() => setSelectedSport('all')}
          style={{
            background: selectedSport === 'all' ? '#059669' : '#ffffff',
            color: selectedSport === 'all' ? '#ffffff' : '#334155',
            border: `1px solid ${selectedSport === 'all' ? '#059669' : '#cbd5e1'}`,
            padding: '7px 16px',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 12.5,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
          }}
        >
          All Sports ({venues.length})
        </button>
        {sports.map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedSport(s.id)}
            style={{
              background: selectedSport === s.id ? '#059669' : '#ffffff',
              color: selectedSport === s.id ? '#ffffff' : '#334155',
              border: `1px solid ${selectedSport === s.id ? '#059669' : '#cbd5e1'}`,
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

      {/* Venues Grid */}
      <div className="marketplace-grid">
        {filteredVenues.map(venue => {
          const uniqueLink = `${window.location.origin}/?venue=${venue.slug || venue.id}`;
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
              {/* Image & Badges */}
              <div style={{ position: 'relative', height: 185 }}>
                <img
                  src={venue.photos?.[0] || 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=600&q=80'}
                  alt={venue.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                
                {/* Distance / area badge */}
                <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6 }}>
                  {venue.distanceKm !== null ? (
                    <span
                      style={{
                        background: '#047857',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: 11.5,
                        padding: '4px 10px',
                        borderRadius: 6,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <MapPin size={12} /> {venue.distanceKm} km away
                    </span>
                  ) : (
                    <span
                      style={{
                        background: 'rgba(15, 23, 42, 0.75)',
                        backdropFilter: 'blur(4px)',
                        color: '#e2e8f0',
                        fontWeight: 600,
                        fontSize: 11.5,
                        padding: '4px 8px',
                        borderRadius: 6
                      }}
                    >
                      {venue.city || 'Bangalore'}
                    </span>
                  )}
                </div>

                {/* Available slots today — real count, not a preview list */}
                <div style={{ position: 'absolute', bottom: 10, right: 10 }}>
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

              {/* Content Details */}
              <div style={{ padding: '18px 20px', flex: 1, display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <h3 style={{ fontSize: 17.5, fontWeight: 800, color: '#0f172a', lineHeight: 1.3, margin: 0 }}>
                    {venue.name}
                  </h3>
                  {/* Share / Copy Unique Link button */}
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

                <div style={{ fontSize: 12.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, marginBottom: 12 }}>
                  <MapPin size={13} style={{ color: '#059669', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{venue.address}</span>
                </div>

                {/* Amenities pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
                  {venue.amenities?.slice(0, 3).map((am, i) => (
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

                {/* Footer: Owner Price & Booking Action */}
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
    </div>
  );
}
