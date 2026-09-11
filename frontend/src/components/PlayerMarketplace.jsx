import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { Search, MapPin, ChevronRight, Check, Copy, ArrowUpDown } from 'lucide-react';

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

  useEffect(() => {
    if (loading || choosingCity || !selectedCity || venues.length === 0) return;
    const stillAvailable = venues.some(
      (v) => normalizeCity(v.city) === normalizeCity(selectedCity)
    );
    if (!stillAvailable) setChoosingCity(true);
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
    setSelectedSport('all');
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

  const citySportIds = new Set(
    cityVenues.flatMap((v) => (Array.isArray(v.sport_ids) ? v.sport_ids : []))
  );
  const visibleSports = sports.filter((s) => citySportIds.has(s.id));

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
      <div className="animate-fade-in marketplace-container marketplace-city-gate">
        <div className="marketplace-city-panel">
          <div className="marketplace-city-panel-glow" aria-hidden="true" />
          <div className="marketplace-city-panel-body">
            <p className="marketplace-kicker">
              <MapPin size={13} /> Choose your city
            </p>
            <h1 className="font-display marketplace-city-title">
              Where do you want to play?
            </h1>
            <p className="marketplace-city-copy">
              Pick a city with live turfs. You can switch anytime.
            </p>

            {loading ? (
              <div className="marketplace-muted">Loading cities…</div>
            ) : loadError ? (
              <div className="marketplace-error">{loadError}</div>
            ) : availableCities.length === 0 ? (
              <div className="marketplace-muted">
                No cities have published turfs yet. Check back once an owner goes live.
              </div>
            ) : (
              <div className="marketplace-city-list">
                {availableCities.map((city) => {
                  const count = venues.filter((v) => normalizeCity(v.city) === normalizeCity(city)).length;
                  const isActive = normalizeCity(city) === normalizeCity(selectedCity);
                  return (
                    <button
                      key={city}
                      type="button"
                      id={`city-option-${normalizeCity(city).replace(/\s+/g, '-')}`}
                      className={`marketplace-city-option${isActive ? ' is-active' : ''}`}
                      onClick={() => confirmCity(city)}
                    >
                      <span className="marketplace-city-option-main">
                        <span className="marketplace-city-option-icon">
                          <MapPin size={18} />
                        </span>
                        <span className="marketplace-city-option-name">{city}</span>
                      </span>
                      <span className="marketplace-city-option-meta">
                        {count} turf{count === 1 ? '' : 's'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in marketplace-container">
      <header id="marketplace-hero" className="marketplace-hero">
        <div className="marketplace-hero-top">
          <div className="marketplace-hero-heading">
            <p className="marketplace-kicker">Find & book today</p>
            <h1 className="font-display marketplace-hero-title">
              <span className="marketplace-hero-city">
                <MapPin size={22} className="marketplace-hero-pin" />
                {selectedCity}
              </span>
            </h1>
            <p className="marketplace-hero-meta">
              {cityVenues.length} turf{cityVenues.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            id="btn-change-city"
            className="marketplace-change-city"
            onClick={handleChangeCity}
          >
            <MapPin size={14} />
            Change city
          </button>
        </div>

        <div className="marketplace-toolbar">
          <label className="marketplace-search" htmlFor="marketplace-search-input">
            <Search size={16} />
            <input
              id="marketplace-search-input"
              type="text"
              placeholder="Search arenas…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
          <label className="marketplace-sort" htmlFor="marketplace-sort-select">
            <ArrowUpDown size={14} className="marketplace-sort-icon" aria-hidden="true" />
            <span className="marketplace-sort-label">Sort</span>
            <select
              id="marketplace-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort turfs"
            >
              <option value="slots_desc">Most slots today</option>
              <option value="price_asc">Lowest price</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
        </div>

        {visibleSports.length > 0 && (
          <div className="marketplace-sports scroll-pills" role="tablist" aria-label="Filter by sport">
            <button
              type="button"
              role="tab"
              aria-selected={selectedSport === 'all'}
              className={`marketplace-sport-chip${selectedSport === 'all' ? ' is-active' : ''}`}
              onClick={() => setSelectedSport('all')}
            >
              All ({cityVenues.length})
            </button>
            {visibleSports.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={selectedSport === s.id}
                className={`marketplace-sport-chip${selectedSport === s.id ? ' is-active' : ''}`}
                onClick={() => setSelectedSport(s.id)}
              >
                <span aria-hidden="true">{s.icon}</span>
                {s.name}
              </button>
            ))}
          </div>
        )}
      </header>

      {loading ? (
        <div className="nexus-card marketplace-empty">Loading turfs…</div>
      ) : loadError ? (
        <div className="nexus-card marketplace-empty marketplace-empty-error">
          <div className="marketplace-empty-title">Couldn&apos;t load turfs</div>
          <div className="marketplace-error">{loadError}</div>
        </div>
      ) : filteredVenues.length === 0 ? (
        <div className="nexus-card marketplace-empty">
          {cityVenues.length === 0 ? (
            <>
              <div className="marketplace-empty-title">No turfs in {selectedCity} yet</div>
              <p className="marketplace-muted" style={{ marginBottom: 16 }}>
                Try another city, or check back once an owner publishes a venue here.
              </p>
              <button type="button" className="btn-primary" onClick={handleChangeCity} style={{ padding: '10px 18px' }}>
                Change city
              </button>
            </>
          ) : (
            <span className="marketplace-muted">No turfs match your current search/filter.</span>
          )}
        </div>
      ) : (
        <div className="marketplace-grid">
          {filteredVenues.map((venue) => {
            const isCopied = copiedSlug === (venue.slug || venue.id);

            return (
              <div
                key={venue.id}
                className="nexus-card marketplace-venue-card"
                onClick={() => onSelectVenue(venue.slug || venue.id)}
              >
                <div className="marketplace-venue-media">
                  <img
                    src={venue.photos?.[0] || 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=600&q=80'}
                    alt={venue.name}
                  />

                  <div className="marketplace-venue-badges marketplace-venue-badges-top">
                    {venue.city && (
                      <span className="marketplace-badge">
                        <MapPin size={12} /> {venue.city}
                      </span>
                    )}
                    {venue.review_count > 0 && (
                      <span className="marketplace-badge marketplace-badge-rating">
                        ★ {venue.avg_rating} <span>({venue.review_count})</span>
                      </span>
                    )}
                  </div>

                  <div className="marketplace-venue-badges marketplace-venue-badges-bottom">
                    {venue.open_games_today_count > 0 && (
                      <span className="marketplace-badge marketplace-badge-games">
                        {venue.open_games_today_count} open game{venue.open_games_today_count === 1 ? '' : 's'}
                      </span>
                    )}
                    <span className={`marketplace-badge marketplace-badge-slots${venue.today_available_slots_count > 0 ? ' is-open' : ''}`}>
                      {venue.today_available_slots_count > 0
                        ? `${venue.today_available_slots_count} slots open today`
                        : 'Check availability'}
                    </span>
                  </div>
                </div>

                <div className="marketplace-venue-body">
                  <div className="marketplace-venue-title-row">
                    <h3>{venue.name}</h3>
                    <button
                      type="button"
                      onClick={(e) => handleCopyUniqueLink(e, venue)}
                      title="Copy turf booking link"
                      className={`marketplace-link-btn${isCopied ? ' is-copied' : ''}`}
                    >
                      {isCopied ? <Check size={12} /> : <Copy size={12} />}
                      {isCopied ? 'Copied' : 'Link'}
                    </button>
                  </div>

                  <div className="marketplace-venue-address">
                    <MapPin size={13} />
                    <span>{venue.address}</span>
                  </div>
                  <div className="marketplace-venue-hours">
                    {venue.open_time && venue.close_time ? `Open ${venue.open_time} – ${venue.close_time}` : '\u00a0'}
                  </div>

                  {(Array.isArray(venue.amenities) ? venue.amenities : []).length > 0 && (
                    <div className="marketplace-amenities">
                      {(Array.isArray(venue.amenities) ? venue.amenities : []).slice(0, 3).map((am, i) => (
                        <span key={i}>{am}</span>
                      ))}
                      {venue.amenities?.length > 3 && (
                        <span className="marketplace-amenities-more">+{venue.amenities.length - 3}</span>
                      )}
                    </div>
                  )}

                  <div className="marketplace-venue-footer">
                    <div>
                      <div className="marketplace-price-label">From</div>
                      <div className="marketplace-price">
                        ₹{venue.min_price || 800}
                        <span>/hr</span>
                      </div>
                    </div>
                    <span className="btn-primary marketplace-book-cta">
                      Book <ChevronRight size={14} />
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
