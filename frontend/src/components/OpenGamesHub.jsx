import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import {
  Users, Plus, Calendar, Clock, MapPin, CheckCircle,
  AlertCircle, ShieldCheck, Trophy, Sparkles, Filter
} from 'lucide-react';

export default function OpenGamesHub({ onNavigateToVenue }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState('all');
  const [sports, setSports] = useState([]);

  // Modal: Join Game
  const [activeJoinGame, setActiveJoinGame] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [playerPhone, setPlayerPhone] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState('');
  const [joinError, setJoinError] = useState('');

  // Modal: Create Game
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [venues, setVenues] = useState([]);
  const [newGameVenueId, setNewGameVenueId] = useState('');
  const [newGameCourtId, setNewGameCourtId] = useState('');
  const [newGameSportId, setNewGameSportId] = useState('football');
  const [newGameTitle, setNewGameTitle] = useState('');
  const [newGameDate, setNewGameDate] = useState(new Date().toISOString().slice(0, 10));
  const [newGameStartTime, setNewGameStartTime] = useState('19:00');
  const [newGameEndTime, setNewGameEndTime] = useState('20:00');
  const [newGamePlayers, setNewGamePlayers] = useState(10);
  const [newGamePrice, setNewGamePrice] = useState(150);
  const [newGameSkill, setNewGameSkill] = useState('Intermediate');
  const [newGameOrganizerName, setNewGameOrganizerName] = useState('');
  const [newGameOrganizerPhone, setNewGameOrganizerPhone] = useState('');
  const [newGameRules, setNewGameRules] = useState('Turf shoes recommended. Please arrive 10 min early.');

  async function loadData() {
    try {
      setLoading(true);
      const [gData, sData, vData] = await Promise.all([
        api.getGames(),
        api.getSports(),
        api.getMarketplaceVenues()
      ]);
      setGames(gData);
      setSports(sData);
      setVenues(vData);
      if (vData.length > 0) {
        setNewGameVenueId(vData[0].id);
      }
    } catch (err) {
      console.error('Error fetching games data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleJoinSubmit(e) {
    e.preventDefault();
    if (!playerName || !playerPhone) {
      setJoinError('Please enter your name and phone number');
      return;
    }
    setJoinError('');
    setIsJoining(true);
    try {
      const res = await api.joinGame(activeJoinGame.id, {
        playerName,
        playerPhone,
        paymentMode: 'online'
      });
      setJoinSuccess(`You have successfully joined "${activeJoinGame.title}"! Paid: ₹${activeJoinGame.cost_per_player}.`);
      loadData();
      setTimeout(() => {
        setActiveJoinGame(null);
        setJoinSuccess('');
        setPlayerName('');
        setPlayerPhone('');
      }, 2000);
    } catch (err) {
      setJoinError(err.message);
    } finally {
      setIsJoining(false);
    }
  }

  async function handleCreateGame(e) {
    e.preventDefault();
    try {
      const selectedV = venues.find(v => v.id === newGameVenueId);
      await api.createGame({
        venueId: newGameVenueId,
        courtId: newGameCourtId || 'crt_fb_1',
        sportId: newGameSportId,
        title: newGameTitle || `Community ${newGameSportId.toUpperCase()} Match`,
        organizerName: newGameOrganizerName || 'Organizer',
        organizerPhone: newGameOrganizerPhone || '+91 98765 43210',
        skillLevel: newGameSkill,
        requiredPlayers: Number(newGamePlayers),
        costPerPlayer: Number(newGamePrice),
        date: newGameDate,
        startTime: newGameStartTime,
        endTime: newGameEndTime,
        rules: newGameRules
      });
      setShowCreateModal(false);
      loadData();
      alert('Open game posted successfully! Players can now discover and join.');
    } catch (err) {
      alert(err.message);
    }
  }

  const filteredGames = games.filter(g => selectedSport === 'all' || g.sport_id === selectedSport);

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1120, margin: '0 auto', padding: '16px 20px 80px' }}>
      {/* Header Banner */}
      <div className="nexus-card" style={{ padding: '30px 28px', marginBottom: 28, background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)', border: '1px solid #d1fae5', boxShadow: '0 4px 16px rgba(5, 150, 105, 0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#059669', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              <Sparkles size={16} /> Community Pickup Games
            </div>
            <h1 className="font-display" style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', lineHeight: 1.15 }}>
              Open Games Hub
            </h1>
            <p style={{ color: '#475569', marginTop: 8, fontSize: 15, lineHeight: 1.5 }}>
              Short of players for tonight's match? Discover nearby public pickup games, join individual seats, pay your own share, or create your own open lobby.
            </p>
          </div>

          <button
            className="btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{ padding: '12px 24px', fontSize: 14 }}
          >
            <Plus size={18} /> Host Open Game
          </button>
        </div>
      </div>

      {/* Sport Category Filters */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 24 }}>
        <button
          onClick={() => setSelectedSport('all')}
          style={{
            background: selectedSport === 'all' ? '#059669' : '#ffffff',
            color: selectedSport === 'all' ? '#ffffff' : '#334155',
            border: `1px solid ${selectedSport === 'all' ? '#059669' : '#cbd5e1'}`,
            padding: '8px 16px',
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          All Sports ({games.length})
        </button>
        {sports.map(s => {
          const count = games.filter(g => g.sport_id === s.id).length;
          return (
            <button
              key={s.id}
              onClick={() => setSelectedSport(s.id)}
              style={{
                background: selectedSport === s.id ? '#059669' : '#ffffff',
                color: selectedSport === s.id ? '#ffffff' : '#334155',
                border: `1px solid ${selectedSport === s.id ? '#059669' : '#cbd5e1'}`,
                padding: '8px 16px',
                borderRadius: 999,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}
            >
              <span>{s.icon}</span> {s.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Games List Grid */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
          Loading active open games...
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="nexus-card" style={{ padding: 48, textAlign: 'center', background: '#ffffff', border: '1px solid #e2e8f0' }}>
          <Trophy size={42} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>No active games for this sport yet</h3>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Be the pioneer organizer and host tonight's match!</p>
          <button className="btn-primary" onClick={() => setShowCreateModal(true)} style={{ marginTop: 16 }}>
            Create First Game
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
          {filteredGames.map(game => {
            const spotsRemaining = Math.max(0, game.required_players - game.current_players);
            const fillPercent = Math.round((game.current_players / game.required_players) * 100);
            const isFull = spotsRemaining === 0;

            return (
              <div key={game.id} className="nexus-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ position: 'relative', height: 140 }}>
                  <img
                    src={game.venue_photos?.[0] || 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=600&q=80'}
                    alt={game.venue_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6 }}>
                    <span className="badge-neon" style={{ borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, background: '#059669', color: '#ffffff' }}>
                      {game.sport_icon} {game.sport_name}
                    </span>
                    <span style={{ background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', color: '#fff', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>
                      {game.skill_level}
                    </span>
                  </div>
                  <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(15, 23, 42, 0.85)', color: '#34d399', fontWeight: 800, fontSize: 15, padding: '4px 10px', borderRadius: 8 }}>
                    ₹{game.cost_per_player} <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 500 }}>/ player</span>
                  </div>
                </div>

                <div style={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
                    {game.title}
                  </h3>
                  <div style={{ fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 12 }}>
                    <MapPin size={14} style={{ color: '#059669', flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{game.venue_name}</span>
                  </div>

                  <div style={{ display: 'flex', gap: 14, fontSize: 12.5, color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: 8, marginBottom: 14 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Calendar size={13} style={{ color: '#059669' }} /> {game.date}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Clock size={13} style={{ color: '#059669' }} /> {game.start_time} - {game.end_time}
                    </span>
                  </div>

                  {/* Player Capacity Bar */}
                  <div style={{ marginBottom: 16, marginTop: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: '#64748b' }}>Player Capacity</span>
                      <strong style={{ color: isFull ? '#059669' : '#0f172a' }}>
                        {game.current_players}/{game.required_players} Joined ({spotsRemaining} left)
                      </strong>
                    </div>
                    <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${fillPercent}%`, background: isFull ? '#059669' : '#10b981', transition: 'width 0.3s' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      className="btn-primary"
                      disabled={isFull}
                      onClick={() => setActiveJoinGame(game)}
                      style={{ flex: 1, padding: '9px 12px', fontSize: 13 }}
                    >
                      {isFull ? 'Match Full' : `Join Game (₹${game.cost_per_player})`}
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => onNavigateToVenue?.(game.venue_id)}
                      style={{ padding: '9px 12px', fontSize: 13 }}
                      title="View Turf Details"
                    >
                      Turf Info
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Join Game */}
      {activeJoinGame && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div className="nexus-card animate-fade-in" style={{ maxWidth: 480, width: '100%', padding: 26, background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <h2 className="font-display" style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
              Join Open Game
            </h2>
            <p style={{ fontSize: 13.5, color: '#64748b', marginBottom: 18 }}>
              {activeJoinGame.title} · {activeJoinGame.venue_name}
            </p>

            {joinSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <CheckCircle size={44} style={{ color: '#059669', margin: '0 auto 12px' }} />
                <div style={{ color: '#0f172a', fontWeight: 700, fontSize: 16 }}>{joinSuccess}</div>
              </div>
            ) : (
              <form onSubmit={handleJoinSubmit}>
                {joinError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: 10, borderRadius: 8, fontSize: 12.5, marginBottom: 14 }}>
                    {joinError}
                  </div>
                )}

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 5 }}>
                    YOUR FULL NAME *
                  </label>
                  <input
                    type="text"
                    required
                    className="nexus-input"
                    style={{ width: '100%' }}
                    placeholder="e.g. Karan Roy"
                    value={playerName}
                    onChange={e => setPlayerName(e.target.value)}
                  />
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 5 }}>
                    PHONE NUMBER *
                  </label>
                  <input
                    type="tel"
                    required
                    className="nexus-input"
                    style={{ width: '100%' }}
                    placeholder="+91 98765 43210"
                    value={playerPhone}
                    onChange={e => setPlayerPhone(e.target.value)}
                  />
                </div>

                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: '#475569' }}>Individual Player Share</span>
                    <strong style={{ color: '#0f172a' }}>₹{activeJoinGame.cost_per_player}</strong>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#059669', fontWeight: 600 }}>
                    ✓ Instant Confirmation · Direct Venue Routing
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => { setActiveJoinGame(null); setJoinError(''); }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isJoining}
                    style={{ flex: 1.4 }}
                  >
                    {isJoining ? 'Confirming...' : `Pay ₹${activeJoinGame.cost_per_player} & Join`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Create Open Game */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div className="nexus-card animate-fade-in" style={{ maxWidth: 540, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 26, background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <h2 className="font-display" style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
              Host an Open Game
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 18 }}>
              Post an open match for players to discover and join. Each player pays their individual share.
            </p>

            <form onSubmit={handleCreateGame} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                  MATCH TITLE *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 7v7 Friday Night High-Pace Football"
                  className="nexus-input"
                  style={{ width: '100%' }}
                  value={newGameTitle}
                  onChange={e => setNewGameTitle(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                    SPORT *
                  </label>
                  <select
                    value={newGameSportId}
                    onChange={e => setNewGameSportId(e.target.value)}
                    className="nexus-input"
                    style={{ width: '100%' }}
                  >
                    {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                    SKILL LEVEL
                  </label>
                  <select
                    value={newGameSkill}
                    onChange={e => setNewGameSkill(e.target.value)}
                    className="nexus-input"
                    style={{ width: '100%' }}
                  >
                    <option value="All Levels">All Levels (Casual)</option>
                    <option value="Beginner">Beginner Friendly</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced / Competitive</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                    DATE *
                  </label>
                  <input
                    type="date"
                    required
                    className="nexus-input"
                    style={{ width: '100%' }}
                    value={newGameDate}
                    onChange={e => setNewGameDate(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                    START TIME *
                  </label>
                  <input
                    type="time"
                    required
                    className="nexus-input"
                    style={{ width: '100%' }}
                    value={newGameStartTime}
                    onChange={e => setNewGameStartTime(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                    TOTAL PLAYERS NEEDED *
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={30}
                    required
                    className="nexus-input"
                    style={{ width: '100%' }}
                    value={newGamePlayers}
                    onChange={e => setNewGamePlayers(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                    PRICE PER PLAYER (₹) *
                  </label>
                  <input
                    type="number"
                    min={50}
                    required
                    className="nexus-input"
                    style={{ width: '100%' }}
                    value={newGamePrice}
                    onChange={e => setNewGamePrice(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                    ORGANIZER NAME *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Your Name"
                    className="nexus-input"
                    style={{ width: '100%' }}
                    value={newGameOrganizerName}
                    onChange={e => setNewGameOrganizerName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                    ORGANIZER PHONE *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    className="nexus-input"
                    style={{ width: '100%' }}
                    value={newGameOrganizerPhone}
                    onChange={e => setNewGameOrganizerPhone(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1.5 }}
                >
                  Publish Open Game
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
