import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import {
  Users, Plus, Calendar, Clock, MapPin, CheckCircle,
  AlertCircle, ShieldCheck, Trophy, Sparkles, Filter, Shield
} from 'lucide-react';

export default function OpenGamesHub({ onNavigateToVenue, onNavigateToDashboard, onNavigateToLogin, currentUser }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState('all');
  const [sports, setSports] = useState([]);

  // Modal: Join 1 Spot in Game
  const [activeJoinGame, setActiveJoinGame] = useState(null);
  const [playerName, setPlayerName] = useState(currentUser?.name || '');
  const [playerPhone, setPlayerPhone] = useState(currentUser?.phone || '');
  const [isJoining, setIsJoining] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState('');
  const [joinError, setJoinError] = useState('');

  // Modal: Book Full Slot (Exclusive Pitch Reservation)
  const [activeFullSlotGame, setActiveFullSlotGame] = useState(null);
  const [fullSlotClientName, setFullSlotClientName] = useState(currentUser?.name || '');
  const [fullSlotClientPhone, setFullSlotClientPhone] = useState(currentUser?.phone || '');
  const [fullSlotNotes, setFullSlotNotes] = useState('');
  const [fullSlotPaymentMode, setFullSlotPaymentMode] = useState('upi');
  const [isSubmittingFullSlot, setIsSubmittingFullSlot] = useState(false);
  const [fullSlotSuccess, setFullSlotSuccess] = useState('');
  const [fullSlotError, setFullSlotError] = useState('');

  async function loadData() {
    try {
      setLoading(true);
      const [gData, sData] = await Promise.all([
        api.getGames(),
        api.getSports()
      ]);
      setGames(gData);
      setSports(sData);
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
      await api.joinGame(activeJoinGame.id, {
        playerName,
        playerPhone,
        paymentMode: 'online'
      });
      setJoinSuccess(`You have successfully joined "${activeJoinGame.title}"! Paid: ₹${activeJoinGame.cost_per_player}.`);
      loadData();
      setTimeout(() => {
        setActiveJoinGame(null);
        setJoinSuccess('');
        setPlayerName(currentUser?.name || '');
        setPlayerPhone(currentUser?.phone || '');
      }, 2000);
    } catch (err) {
      setJoinError(err.message);
    } finally {
      setIsJoining(false);
    }
  }

  async function handleFullSlotSubmit(e) {
    e.preventDefault();
    if (!fullSlotClientName || !fullSlotClientPhone) {
      setFullSlotError('Please enter your name and phone number');
      return;
    }
    setFullSlotError('');
    setIsSubmittingFullSlot(true);
    try {
      const slotPrice = activeFullSlotGame.slot_price || (activeFullSlotGame.cost_per_player * activeFullSlotGame.required_players);
      await api.requestFullSlot(activeFullSlotGame.id, {
        clientName: fullSlotClientName.trim(),
        clientPhone: fullSlotClientPhone.trim(),
        amount: slotPrice,
        notes: fullSlotNotes.trim() || 'Private group match reservation',
        paymentMode: fullSlotPaymentMode
      });
      setFullSlotSuccess(`Full slot booking request submitted to the turf owner! Current registered players will receive 100% WhatsApp refund alerts upon owner acceptance.`);
      loadData();
      setTimeout(() => {
        setActiveFullSlotGame(null);
        setFullSlotSuccess('');
        setFullSlotNotes('');
      }, 2800);
    } catch (err) {
      setFullSlotError(err.message);
    } finally {
      setIsSubmittingFullSlot(false);
    }
  }

  const filteredGames = games.filter(g => selectedSport === 'all' || g.sport_id === selectedSport);

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1120, margin: '0 auto', padding: '16px 20px 80px' }}>
      {/* Header Banner */}
      <div
        className="nexus-card"
        style={{
          padding: '24px 24px',
          marginBottom: 24,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              <Sparkles size={14} /> Community Open Pickups & Full Turf Booking
            </div>
            <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', lineHeight: 1.2, margin: 0 }}>
              Open Games Hub
            </h1>
            <p style={{ color: '#64748b', marginTop: 6, fontSize: 14, lineHeight: 1.5, margin: 0 }}>
              Short of players for tonight's match? Join individual spots or reserve the entire slot for your private squad. Hosting open games is integrated inside your verified Player and Owner dashboards.
            </p>
          </div>

          {/* Hosting inside profile CTA button */}
          <div>
            {currentUser?.role === 'owner' ? (
              <button
                id="btn-hub-host-owner"
                className="btn-primary"
                onClick={() => onNavigateToDashboard?.('owner')}
                style={{ padding: '10px 18px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 7 }}
              >
                <Plus size={15} /> Host Open Game in Owner Hub
              </button>
            ) : currentUser?.role === 'player' ? (
              <button
                id="btn-hub-host-player"
                className="btn-primary"
                onClick={() => onNavigateToDashboard?.('player', 'host_game')}
                style={{ padding: '10px 18px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 7 }}
              >
                <Plus size={15} /> Host Open Game in My Profile
              </button>
            ) : (
              <button
                id="btn-hub-host-guest"
                className="btn-secondary"
                onClick={() => onNavigateToLogin?.('player')}
                style={{ padding: '10px 18px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 7 }}
              >
                <Users size={15} /> Sign In to Host Open Game
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sport Category Filters */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 20 }}>
        <button
          onClick={() => setSelectedSport('all')}
          style={{
            background: selectedSport === 'all' ? '#059669' : '#ffffff',
            color: selectedSport === 'all' ? '#ffffff' : '#334155',
            border: `1px solid ${selectedSport === 'all' ? '#059669' : '#cbd5e1'}`,
            padding: '7px 15px',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 12.5,
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          All Sports ({games.length})
        </button>
        {sports.map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedSport(s.id)}
            style={{
              background: selectedSport === s.id ? '#059669' : '#ffffff',
              color: selectedSport === s.id ? '#ffffff' : '#334155',
              border: `1px solid ${selectedSport === s.id ? '#059669' : '#cbd5e1'}`,
              padding: '7px 15px',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 12.5,
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

      {/* Games List Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          Loading open pickup games and registered slots...
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="nexus-card" style={{ padding: 40, textAlign: 'center', background: '#ffffff', border: '1px solid #e2e8f0' }}>
          <Trophy size={40} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>No active pickup games for this sport yet</h3>
          <p style={{ color: '#64748b', fontSize: 13.5, marginTop: 4 }}>
            You can start an open match from registered turfs inside your Player or Owner dashboard!
          </p>
          <button
            className="btn-primary"
            onClick={() => {
              if (currentUser?.role === 'owner') onNavigateToDashboard?.('owner');
              else if (currentUser?.role === 'player') onNavigateToDashboard?.('player', 'host_game');
              else onNavigateToLogin?.('player');
            }}
            style={{ marginTop: 14 }}
          >
            Host Match via Profile
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 18 }}>
          {filteredGames.map(game => {
            const spotsRemaining = Math.max(0, game.required_players - game.current_players);
            const fillPercent = Math.round((game.current_players / game.required_players) * 100);
            const isFull = spotsRemaining === 0;
            const fullSlotPrice = game.slot_price || (game.cost_per_player * game.required_players);
            const hasPendingFullInquiry = game.full_inquiry_status === 'pending';

            return (
              <div
                key={game.id}
                id={`game-card-${game.id}`}
                className="nexus-card"
                style={{
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  background: '#ffffff',
                  border: hasPendingFullInquiry ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                }}
              >
                {/* Image Header */}
                <div style={{ position: 'relative', height: 140 }}>
                  <img
                    src={game.venue_photos?.[0] || 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=600&q=80'}
                    alt={game.venue_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6 }}>
                    <span style={{ borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, background: '#059669', color: '#ffffff' }}>
                      {game.sport_icon} {game.sport_name}
                    </span>
                    <span style={{ background: 'rgba(15, 23, 42, 0.8)', color: '#fff', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>
                      {game.skill_level}
                    </span>
                  </div>

                  <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(15, 23, 42, 0.85)', color: '#34d399', fontWeight: 800, fontSize: 14, padding: '4px 9px', borderRadius: 8 }}>
                    ₹{game.cost_per_player} <span style={{ fontSize: 10.5, color: '#cbd5e1', fontWeight: 500 }}>/ spot</span>
                  </div>
                </div>

                {/* Card Content */}
                <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      {game.title}
                    </h3>
                  </div>

                  <div style={{ fontSize: 12.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
                    <MapPin size={13} style={{ color: '#059669', flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{game.venue_name}</span>
                  </div>

                  {/* Slot Date & Time */}
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 10px', borderRadius: 8, marginBottom: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={13} style={{ color: '#059669' }} /> {game.date}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={13} style={{ color: '#059669' }} /> {game.start_time} - {game.end_time}
                    </span>
                  </div>

                  {/* Registered Players List */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Registered Players</span>
                      <strong style={{ color: isFull ? '#059669' : '#0f172a' }}>
                        {game.current_players}/{game.required_players} ({spotsRemaining} spots left)
                      </strong>
                    </div>

                    {/* Visual Player Capacity Bar */}
                    <div style={{ height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ height: '100%', width: `${fillPercent}%`, background: isFull ? '#059669' : '#10b981', transition: 'width 0.3s' }} />
                    </div>

                    {/* Player badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {game.participants && game.participants.length > 0 ? (
                        game.participants.map((p, idx) => (
                          <span
                            key={idx}
                            style={{
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              color: '#334155',
                              padding: '2px 7px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669' }} />
                            {p.name}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>Organizer joined</span>
                      )}
                    </div>
                  </div>

                  {/* Pending full inquiry alert if any */}
                  {hasPendingFullInquiry && (
                    <div style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', padding: '6px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, marginBottom: 12 }}>
                      ⚠️ Full turf booking requested by {game.full_inquiry_client || 'team'}. Owner reviewing.
                    </div>
                  )}

                  {/* Dual Action Buttons: Join Spot OR Book Full Slot */}
                  <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        id={`btn-join-game-${game.id}`}
                        className="btn-primary"
                        disabled={isFull || hasPendingFullInquiry}
                        onClick={() => setActiveJoinGame(game)}
                        style={{ flex: 1, padding: '9px 10px', fontSize: 12.5 }}
                      >
                        {isFull ? 'Match Full' : `Join Spot (₹${game.cost_per_player})`}
                      </button>

                      <button
                        className="btn-secondary"
                        onClick={() => onNavigateToVenue?.(game.venue_id)}
                        style={{ padding: '9px 12px', fontSize: 12 }}
                        title="View Arena & Facilities"
                      >
                        Turf Info
                      </button>
                    </div>

                    {/* Book Entire Slot Button */}
                    <button
                      id={`btn-full-slot-${game.id}`}
                      onClick={() => setActiveFullSlotGame(game)}
                      disabled={hasPendingFullInquiry}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        color: '#0f172a',
                        borderRadius: 8,
                        padding: '8px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Shield size={13} style={{ color: '#059669' }} />
                      Book Full Slot (Reserve Entire Pitch · ₹{fullSlotPrice})
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Join Individual Spot */}
      {activeJoinGame && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div className="nexus-card animate-fade-in" style={{ maxWidth: 460, width: '100%', padding: 24, background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h2 className="font-display" style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
              Join Pickup Spot
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              {activeJoinGame.title} · {activeJoinGame.venue_name}
            </p>

            {joinSuccess ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <CheckCircle size={40} style={{ color: '#059669', margin: '0 auto 10px' }} />
                <div style={{ color: '#0f172a', fontWeight: 700, fontSize: 15 }}>{joinSuccess}</div>
              </div>
            ) : (
              <form onSubmit={handleJoinSubmit}>
                {joinError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
                    {joinError}
                  </div>
                )}

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
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

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                    PHONE NUMBER (FOR WHATSAPP MATCH UPDATES) *
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

                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: '#475569' }}>Individual Spot Share</span>
                    <strong style={{ color: '#0f172a' }}>₹{activeJoinGame.cost_per_player}</strong>
                  </div>
                  <div style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>
                    ✓ Instant Confirmation · Direct Pitch Access
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

      {/* MODAL 2: Book Full Slot (Exclusive Group Booking) */}
      {activeFullSlotGame && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div className="nexus-card animate-fade-in" style={{ maxWidth: 500, width: '100%', padding: 24, background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#d1fae5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={18} />
              </div>
              <h2 className="font-display" style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Book Full Slot (Exclusive Pitch)
              </h2>
            </div>

            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
              Reserve the entire turf for your private team/group at <strong>{activeFullSlotGame.venue_name}</strong>.
            </p>

            {fullSlotSuccess ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <CheckCircle size={44} style={{ color: '#059669', margin: '0 auto 10px' }} />
                <div style={{ color: '#0f172a', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Request Sent Successfully!</div>
                <div style={{ color: '#64748b', fontSize: 13 }}>{fullSlotSuccess}</div>
              </div>
            ) : (
              <form onSubmit={handleFullSlotSubmit}>
                {fullSlotError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
                    {fullSlotError}
                  </div>
                )}

                {/* Important Auto-Refund Policy Notice */}
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#15803d', marginBottom: 4 }}>
                    🔄 WhatsApp Auto-Refund Guarantee
                  </div>
                  <div style={{ fontSize: 11.5, color: '#166534', lineHeight: 1.4 }}>
                    Currently <strong>{activeFullSlotGame.current_players} player(s)</strong> have registered in this pickup match. Upon owner acceptance of your full booking, all existing registered players will immediately receive an automated <strong>100% refund notification via WhatsApp</strong>.
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                      ORGANIZER / CAPTAIN NAME *
                    </label>
                    <input
                      type="text"
                      required
                      className="nexus-input"
                      style={{ width: '100%' }}
                      placeholder="e.g. Vikram Sharma"
                      value={fullSlotClientName}
                      onChange={e => setFullSlotClientName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                      CONTACT PHONE *
                    </label>
                    <input
                      type="tel"
                      required
                      className="nexus-input"
                      style={{ width: '100%' }}
                      placeholder="+91 98800 12345"
                      value={fullSlotClientPhone}
                      onChange={e => setFullSlotClientPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                    TEAM NAME OR BOOKING NOTES
                  </label>
                  <input
                    type="text"
                    className="nexus-input"
                    style={{ width: '100%' }}
                    placeholder="e.g. Bangalore IT Cup 5v5 Friendly Match"
                    value={fullSlotNotes}
                    onChange={e => setFullSlotNotes(e.target.value)}
                  />
                </div>

                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: '#475569' }}>Total Full Slot Turf Rate</span>
                    <strong style={{ color: '#0f172a', fontSize: 15 }}>
                      ₹{activeFullSlotGame.slot_price || (activeFullSlotGame.cost_per_player * activeFullSlotGame.required_players)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#64748b' }}>
                    <span>Slot Timing</span>
                    <span>{activeFullSlotGame.date} ({activeFullSlotGame.start_time} - {activeFullSlotGame.end_time})</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => { setActiveFullSlotGame(null); setFullSlotError(''); }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isSubmittingFullSlot}
                    style={{ flex: 1.6 }}
                  >
                    {isSubmittingFullSlot ? 'Submitting...' : 'Request Full Slot Booking'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
