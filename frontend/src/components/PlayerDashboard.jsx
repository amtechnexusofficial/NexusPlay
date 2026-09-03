import React, { useState, useEffect } from 'react';
import { 
  User, 
  Calendar, 
  Clock, 
  MapPin, 
  Trophy, 
  Receipt, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Phone, 
  Mail, 
  QrCode, 
  Sparkles, 
  CreditCard,
  ChevronRight,
  LogOut,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Plus,
  Bell,
  Check,
  MessageSquare,
  Building2
} from 'lucide-react';
import { api } from '../api';

export function PlayerDashboard({ user, initialTab = 'bookings', onBookVenue, onBrowseGames, onLogout }) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'bookings' | 'games' | 'host_game' | 'whatsapp_alerts'
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // Host Open Game Wizard State
  const [venues, setVenues] = useState([]);
  const [selectedVenueId, setSelectedVenueId] = useState('');
  const [hostDate, setHostDate] = useState(new Date().toISOString().slice(0, 10));
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Host Game Form Fields
  const [hostTitle, setHostTitle] = useState('');
  const [hostSportId, setHostSportId] = useState('football');
  const [hostPlayers, setHostPlayers] = useState(10);
  const [hostCostPerPlayer, setHostCostPerPlayer] = useState(150);
  const [hostSkill, setHostSkill] = useState('All Levels');
  const [hostRules, setHostRules] = useState('Turf shoes only. Bibs provided. Please arrive 10 min early.');
  const [isPublishingGame, setIsPublishingGame] = useState(false);
  const [hostSuccessMsg, setHostSuccessMsg] = useState('');
  const [hostErrorMsg, setHostErrorMsg] = useState('');

  // WhatsApp Notifications
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const fetchDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('nexus_token');
      const data = await api.getPlayerDashboard(user?.phone || '9876500001', token);
      setDashboardData(data);
    } catch (err) {
      console.error(err);
      setError('Could not load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNotifications = async () => {
    setLoadingNotifications(true);
    try {
      const notifs = await api.getPlayerNotifications(user?.phone || '9876500001');
      setNotifications(notifs || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const fetchMarketplaceVenues = async () => {
    try {
      const vList = await api.getMarketplaceVenues();
      setVenues(vList || []);
      if (vList && vList.length > 0 && !selectedVenueId) {
        setSelectedVenueId(vList[0].id);
      }
    } catch (err) {
      console.error('Error loading venues for game hosting:', err);
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchNotifications();
    fetchMarketplaceVenues();
  }, [user]);

  // When initialTab changes from parent
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Load available live slots when venue or date changes in host wizard
  useEffect(() => {
    if (!selectedVenueId) return;
    async function loadSlots() {
      setLoadingSlots(true);
      setSelectedSlot(null);
      try {
        const slots = await api.getVenueSlots(selectedVenueId, hostDate);
        // Only show open slots (or unreserved)
        const openOnes = (slots || []).filter(s => s.status === 'open' && !s.is_game);
        setAvailableSlots(openOnes);
        if (openOnes.length > 0) {
          setSelectedSlot(openOnes[0]);
          const calculatedPerPlayer = Math.ceil((openOnes[0].price || 1200) / hostPlayers);
          setHostCostPerPlayer(calculatedPerPlayer);
        }
      } catch (err) {
        console.error('Error fetching slots for hosting:', err);
      } finally {
        setLoadingSlots(false);
      }
    }
    loadSlots();
  }, [selectedVenueId, hostDate]);

  // Update cost per player when slot or required players change
  function handlePlayerCountChange(val) {
    const count = Number(val) || 2;
    setHostPlayers(count);
    if (selectedSlot) {
      const calculated = Math.ceil((selectedSlot.price || 1200) / count);
      setHostCostPerPlayer(calculated);
    }
  }

  function handleSelectSlot(slot) {
    setSelectedSlot(slot);
    const calculated = Math.ceil((slot.price || 1200) / hostPlayers);
    setHostCostPerPlayer(calculated);
  }

  async function handleHostGameSubmit(e) {
    e.preventDefault();
    if (!selectedVenueId || !selectedSlot) {
      setHostErrorMsg('Please select a registered turf and an available time slot.');
      return;
    }

    setHostErrorMsg('');
    setIsPublishingGame(true);

    try {
      const currentVenue = venues.find(v => v.id === selectedVenueId);
      const res = await api.createGame({
        venueId: selectedVenueId,
        courtId: selectedSlot.court_id,
        courtSlotId: selectedSlot.id,
        sportId: selectedSlot.sport_id || hostSportId,
        title: hostTitle.trim() || `Community Match at ${currentVenue?.name || 'Arena'}`,
        organizerName: user?.name || profile.name || 'Team Captain',
        organizerPhone: user?.phone || profile.phone || '9876500001',
        skillLevel: hostSkill,
        requiredPlayers: Number(hostPlayers),
        costPerPlayer: Number(hostCostPerPlayer),
        date: hostDate,
        startTime: selectedSlot.start_time,
        endTime: selectedSlot.end_time,
        rules: hostRules.trim()
      });

      setHostSuccessMsg(`🎉 Open game session created on ${currentVenue?.name} (${selectedSlot.start_time} - ${selectedSlot.end_time})! Other players can now join spots or book the entire slot.`);
      fetchDashboard();
      fetchNotifications();
      setTimeout(() => {
        setHostSuccessMsg('');
        setActiveTab('games');
      }, 2500);
    } catch (err) {
      setHostErrorMsg(err.message || 'Failed to host open game.');
    } finally {
      setIsPublishingGame(false);
    }
  }

  const profile = dashboardData?.profile || {
    name: user?.name || 'Nexus Player',
    phone: user?.phone || '9876500001',
    email: user?.email || 'player@nexusplay.com',
    totalSpent: 1200,
    totalBookings: 2,
    gamesJoined: 2,
    loyaltyTier: 'Active Player'
  };

  const bookings = dashboardData?.bookings || [];
  const games = dashboardData?.games || [];
  const unreadRefundsCount = notifications.filter(n => n.type === 'full_inquiry_refund').length;

  return (
    <div id="player-dashboard-container" style={{ maxWidth: '1100px', margin: '0 auto', padding: '16px 16px 80px' }}>
      
      {/* Top Profile Banner - Crisp White Modern Card */}
      <div 
        id="player-profile-card"
        className="nexus-card"
        style={{ padding: '20px 24px', marginBottom: '20px', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: '800'
            }}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'P'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                  {user?.name || 'Nexus Player'}
                </h2>
                <span className="badge-emerald" style={{ fontSize: '11px' }}>
                  <ShieldCheck size={12} />
                  Verified Player
                </span>
                <span className="badge-slate" style={{ fontSize: '11px' }}>
                  {profile.loyaltyTier}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px', fontSize: '12px', color: '#64748b' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Phone size={12} color="#059669" />
                  +91 {user?.phone || profile.phone}
                </span>
                {user?.email && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Mail size={12} color="#059669" />
                    {user.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Button to Host Game directly from header */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              id="btn-quick-host-game"
              onClick={() => setActiveTab('host_game')}
              className="btn-primary"
              style={{ fontSize: '12.5px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={15} />
              Host Open Game
            </button>
            <button
              onClick={onLogout}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                color: '#64748b',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <LogOut size={13} />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Perfectly Aligned Responsive Tabs Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
        <div className="scroll-pills" style={{ display: 'flex', gap: '8px', overflowX: 'auto', flex: 1, minWidth: '280px', paddingBottom: '2px' }}>
          <button
            id="tab-my-bookings"
            onClick={() => setActiveTab('bookings')}
            style={{
              height: '40px',
              padding: '0 16px',
              borderRadius: '10px',
              border: activeTab === 'bookings' ? '1px solid #059669' : '1px solid #cbd5e1',
              background: activeTab === 'bookings' ? '#059669' : '#ffffff',
              color: activeTab === 'bookings' ? '#ffffff' : '#334155',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap',
              boxShadow: activeTab === 'bookings' ? '0 2px 5px rgba(5,150,105,0.2)' : '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.15s ease'
            }}
          >
            <Calendar size={15} />
            <span>My Bookings</span>
            <span style={{
              background: activeTab === 'bookings' ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
              color: activeTab === 'bookings' ? '#ffffff' : '#475569',
              fontSize: '11px',
              fontWeight: '800',
              padding: '2px 7px',
              borderRadius: '999px'
            }}>
              {bookings.length}
            </span>
          </button>

          <button
            id="tab-my-games"
            onClick={() => setActiveTab('games')}
            style={{
              height: '40px',
              padding: '0 16px',
              borderRadius: '10px',
              border: activeTab === 'games' ? '1px solid #059669' : '1px solid #cbd5e1',
              background: activeTab === 'games' ? '#059669' : '#ffffff',
              color: activeTab === 'games' ? '#ffffff' : '#334155',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap',
              boxShadow: activeTab === 'games' ? '0 2px 5px rgba(5,150,105,0.2)' : '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.15s ease'
            }}
          >
            <Users size={15} />
            <span>Joined Pickups</span>
            <span style={{
              background: activeTab === 'games' ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
              color: activeTab === 'games' ? '#ffffff' : '#475569',
              fontSize: '11px',
              fontWeight: '800',
              padding: '2px 7px',
              borderRadius: '999px'
            }}>
              {games.length}
            </span>
          </button>

          {/* Direct Requirement: Open Game Hosting inside Player Dashboard */}
          <button
            id="tab-host-game"
            onClick={() => setActiveTab('host_game')}
            style={{
              height: '40px',
              padding: '0 16px',
              borderRadius: '10px',
              border: activeTab === 'host_game' ? '1px solid #059669' : '1px solid #a7f3d0',
              background: activeTab === 'host_game' ? '#059669' : '#ecfdf5',
              color: activeTab === 'host_game' ? '#ffffff' : '#047857',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap',
              boxShadow: activeTab === 'host_game' ? '0 2px 5px rgba(5,150,105,0.2)' : '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.15s ease'
            }}
          >
            <Plus size={15} />
            <span>Host Open Game</span>
          </button>

          {/* WhatsApp Alerts & Receipts Tab */}
          <button
            id="tab-whatsapp-alerts"
            onClick={() => {
              setActiveTab('whatsapp_alerts');
              fetchNotifications();
            }}
            style={{
              height: '40px',
              padding: '0 16px',
              borderRadius: '10px',
              border: activeTab === 'whatsapp_alerts' ? '1px solid #059669' : '1px solid #cbd5e1',
              background: activeTab === 'whatsapp_alerts' ? '#059669' : '#ffffff',
              color: activeTab === 'whatsapp_alerts' ? '#ffffff' : '#334155',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap',
              position: 'relative',
              boxShadow: activeTab === 'whatsapp_alerts' ? '0 2px 5px rgba(5,150,105,0.2)' : '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.15s ease'
            }}
          >
            <MessageSquare size={15} />
            <span>WhatsApp Alerts & Refunds</span>
            {unreadRefundsCount > 0 && (
              <span style={{
                background: '#22c55e',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: '800',
                padding: '2px 7px',
                borderRadius: '999px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}>
                {unreadRefundsCount} new
              </span>
            )}
          </button>
        </div>

        <button
          onClick={fetchDashboard}
          disabled={isLoading}
          style={{
            height: '36px',
            padding: '0 12px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            color: '#64748b',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#0f172a'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#64748b'; }}
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: MY BOOKINGS */}
      {/* =================================================================== */}
      {activeTab === 'bookings' && (
        <div>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#059669' }} />
              <div>Fetching verified court bookings...</div>
            </div>
          ) : bookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <Calendar size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>
                No Court Bookings Yet
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '400px', margin: '0 auto 16px' }}>
                Explore premier turf arenas in Bangalore, choose your preferred slot, and lock your court with 0% fee direct UPI.
              </p>
              <button onClick={onBookVenue} className="btn-primary">
                Browse Turfs & Book a Slot
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {bookings.map((booking) => {
                const isPaid = booking.payment_status === 'paid' || booking.payment_status === 'pending_verification';

                return (
                  <div
                    key={booking.id}
                    id={`booking-card-${booking.id}`}
                    className="nexus-card"
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      padding: '16px 20px',
                      borderRadius: '12px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '14px'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        color: '#059669',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Trophy size={18} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                          <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                            {booking.venue_name || 'Nexus Arena'}
                          </span>
                          <span className="badge-slate" style={{ textTransform: 'capitalize', fontSize: '11px' }}>
                            {booking.sport_id || 'turf'}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                          {booking.court_name || 'Main Court'}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#64748b' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={13} color="#059669" />
                            {booking.date}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={13} color="#059669" />
                            {booking.start_time} - {booking.end_time}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: 'auto' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                          ₹{booking.total_amount}
                        </div>
                        <div style={{ fontSize: '11px', color: isPaid ? '#059669' : '#d97706', fontWeight: '700' }}>
                          {isPaid ? '✓ Paid & Confirmed' : 'Pending Verification'}
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedReceipt(booking)}
                        className="btn-secondary"
                        style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Receipt size={13} />
                        Voucher
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: JOINED PICKUPS & OPEN GAMES */}
      {/* =================================================================== */}
      {activeTab === 'games' && (
        <div>
          {games.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <Users size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>
                No Active Pickup Matches
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '400px', margin: '0 auto 16px' }}>
                Looking for players tonight? Join an open community match or host a new session on your favorite registered turf right here.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button onClick={() => setActiveTab('host_game')} className="btn-primary">
                  <Plus size={15} /> Host Open Game
                </button>
                <button onClick={onBrowseGames} className="btn-secondary">
                  Browse Open Hub
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {games.map((game) => (
                <div
                  key={game.id}
                  id={`game-item-${game.id}`}
                  className="nexus-card"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '14px'
                  }}
                >
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: '#eef2ff',
                      border: '1px solid #c7d2fe',
                      color: '#4f46e5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Users size={18} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                          {game.title}
                        </span>
                        <span className="badge-emerald" style={{ fontSize: '11px' }}>
                          Joined Spot
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                        {game.venue_name} · {game.court_name}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#64748b' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={13} color="#059669" />
                          {game.date}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={13} color="#059669" />
                          {game.start_time} - {game.end_time}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Users size={13} color="#059669" />
                          {game.current_players}/{game.required_players} Players Roster
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: 'auto' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                        ₹{game.cost_per_player || game.share_amount}
                      </div>
                      <div style={{ fontSize: '11px', color: '#059669', fontWeight: '700' }}>
                        Confirmed Spot
                      </div>
                    </div>

                    <button
                      onClick={onBrowseGames}
                      className="btn-primary"
                      style={{ fontSize: '12px', padding: '6px 14px' }}
                    >
                      Match Hub →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: HOST OPEN GAME (GUIDED WIZARD WITH REGISTERED TURFS & SLOTS) */}
      {/* =================================================================== */}
      {activeTab === 'host_game' && (
        <div className="nexus-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '24px', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#d1fae5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={18} />
            </div>
            <h2 className="font-display" style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              Host an Open Game Session
            </h2>
          </div>
          <p style={{ color: '#64748b', fontSize: '13.5px', marginBottom: '20px' }}>
            Select any registered sports arena on our site, pick an available slot, and establish an open pickup match. Other players can join spots, or another private team can reserve the full slot.
          </p>

          {hostSuccessMsg && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', padding: '14px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', marginBottom: '18px' }}>
              {hostSuccessMsg}
            </div>
          )}

          {hostErrorMsg && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px', borderRadius: '10px', fontSize: '13px', marginBottom: '18px' }}>
              {hostErrorMsg}
            </div>
          )}

          <form onSubmit={handleHostGameSubmit}>
            {/* STEP 1: Select Registered Turf */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                Step 1: Choose a Registered Turf Arena *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                {venues.map((venue) => {
                  const isSelected = selectedVenueId === venue.id;
                  return (
                    <div
                      key={venue.id}
                      onClick={() => setSelectedVenueId(venue.id)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        background: isSelected ? '#f0fdf4' : '#ffffff',
                        border: isSelected ? '2px solid #059669' : '1px solid #cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <img
                        src={venue.photos?.[0] || 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=150&q=80'}
                        alt={venue.name}
                        style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {venue.name}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={11} color="#059669" />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{venue.address}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#059669', fontWeight: '600', marginTop: '2px' }}>
                          ★ {venue.rating || 4.8} · {venue.courts?.length || 2} Courts Available
                        </div>
                      </div>
                      {isSelected && (
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check size={12} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* STEP 2: Date & Available Slot Selection */}
            <div style={{ marginBottom: '20px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                  Step 2: Pick Date & Available Slot on Selected Turf *
                </label>
                <input
                  type="date"
                  value={hostDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={e => setHostDate(e.target.value)}
                  className="nexus-input"
                  style={{ padding: '6px 12px', fontSize: '12.5px', width: 'auto' }}
                />
              </div>

              {loadingSlots ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '13px' }}>
                  <RefreshCw size={18} className="animate-spin" style={{ margin: '0 auto 6px', color: '#059669' }} />
                  Checking real-time turf slot availability...
                </div>
              ) : availableSlots.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '13px' }}>
                  No open slots found on this date. Please pick another date or select another registered arena above.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '10px' }}>
                  {availableSlots.map((slot) => {
                    const isSlotSelected = selectedSlot?.id === slot.id;
                    return (
                      <div
                        key={slot.id}
                        onClick={() => handleSelectSlot(slot)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: isSlotSelected ? '#059669' : '#ffffff',
                          color: isSlotSelected ? '#ffffff' : '#0f172a',
                          border: isSlotSelected ? '1px solid #059669' : '1px solid #cbd5e1',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ fontSize: '11px', opacity: isSlotSelected ? 0.9 : 0.7, fontWeight: '600' }}>
                          {slot.court_name || 'Court'}
                        </div>
                        <div style={{ fontSize: '13.5px', fontWeight: '800' }}>
                          {slot.start_time} - {slot.end_time}
                        </div>
                        <div style={{ fontSize: '11.5px', fontWeight: '700', color: isSlotSelected ? '#d1fae5' : '#059669' }}>
                          Turf Rate: ₹{slot.price}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* STEP 3: Game Configuration */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px' }}>
                Step 3: Match Details & Player Split
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                    MATCH TITLE *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 5v5 Friday Night Futsal"
                    className="nexus-input"
                    style={{ width: '100%' }}
                    value={hostTitle}
                    onChange={e => setHostTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                    SKILL LEVEL
                  </label>
                  <select
                    value={hostSkill}
                    onChange={e => setHostSkill(e.target.value)}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                    PLAYERS NEEDED (ROSTER SIZE) *
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={24}
                    required
                    className="nexus-input"
                    style={{ width: '100%' }}
                    value={hostPlayers}
                    onChange={e => handlePlayerCountChange(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                    PRICE PER PLAYER SHARE (₹) *
                  </label>
                  <input
                    type="number"
                    min={20}
                    required
                    className="nexus-input"
                    style={{ width: '100%' }}
                    value={hostCostPerPlayer}
                    onChange={e => setHostCostPerPlayer(Number(e.target.value))}
                  />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                    Auto-split based on arena slot rate (₹{selectedSlot?.price || 1200})
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                  MATCH RULES & GEAR NOTES
                </label>
                <input
                  type="text"
                  className="nexus-input"
                  style={{ width: '100%' }}
                  value={hostRules}
                  onChange={e => setHostRules(e.target.value)}
                  placeholder="e.g. Turf boots recommended. Bibs provided by organizer."
                />
              </div>
            </div>

            {/* Submit Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActiveTab('games')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isPublishingGame || !selectedSlot}
                style={{ padding: '10px 24px', fontSize: '13.5px' }}
              >
                {isPublishingGame ? 'Publishing Game...' : 'Publish Open Game Session'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: WHATSAPP ALERTS & 100% REFUND RECEIPTS */}
      {/* =================================================================== */}
      {activeTab === 'whatsapp_alerts' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px' }}>
              WhatsApp Notification Hub
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              Official real-time match dispatches, booking receipts, and automatic 100% WhatsApp refund alerts when a full slot reservation is accepted by a turf owner.
            </p>
          </div>

          {loadingNotifications ? (
            <div style={{ textAlign: 'center', padding: '40px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
              <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px', color: '#059669' }} />
              Loading WhatsApp message receipts...
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <MessageSquare size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>
                No WhatsApp Alerts Yet
              </h4>
              <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '420px', margin: '0 auto' }}>
                If you join an open pickup game and an exclusive team reserves the full slot, you will receive an automatic 100% UPI refund notification message here and on your registered WhatsApp.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {notifications.map((notif) => {
                const isRefund = notif.type === 'full_inquiry_refund';

                return (
                  <div
                    key={notif.id}
                    id={`notif-${notif.id}`}
                    style={{
                      background: '#ffffff',
                      border: isRefund ? '1px solid #86efac' : '1px solid #e2e8f0',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                    }}
                  >
                    {/* Simulated WhatsApp Header */}
                    <div style={{
                      background: '#075e54',
                      padding: '10px 16px',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      fontWeight: '700'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <MessageSquare size={12} color="#ffffff" />
                        </div>
                        <span>NexusPlay Official WhatsApp Business · Verified Account</span>
                      </div>
                      <span style={{ fontSize: '11px', opacity: 0.85 }}>
                        {new Date(notif.created_at).toLocaleDateString()} {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* WhatsApp Chat Bubble Body */}
                    <div style={{ padding: '16px 20px', background: '#efeae2' }}>
                      <div style={{
                        background: '#ffffff',
                        borderRadius: '10px',
                        padding: '14px 16px',
                        maxWidth: '560px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        borderLeft: isRefund ? '4px solid #16a34a' : '4px solid #059669'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                          <span style={{
                            background: isRefund ? '#dcfce7' : '#f0fdf4',
                            color: isRefund ? '#166534' : '#059669',
                            fontSize: '11px',
                            fontWeight: '800',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            textTransform: 'uppercase'
                          }}>
                            {isRefund ? '100% UPI REFUND CONFIRMED' : 'MATCH NOTICE'}
                          </span>
                        </div>

                        <div style={{ fontSize: '13.5px', color: '#0f172a', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
                          {notif.message}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', fontSize: '11px', color: '#64748b' }}>
                          <span>Delivered to +91 {notif.recipient_phone}</span>
                          <span style={{ color: '#3b82f6', fontWeight: '700' }}>✓✓ Read</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* DIGITAL RECEIPT MODAL */}
      {/* =================================================================== */}
      {selectedReceipt && (
        <div className="modal-overlay animate-fade-in" onClick={() => setSelectedReceipt(null)}>
          <div 
            className="modal-content"
            style={{ maxWidth: '460px', padding: '0', borderRadius: '16px', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ background: '#059669', padding: '20px 24px', color: '#ffffff', textAlign: 'center' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Receipt size={20} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>
                Booking Receipt & Pass
              </h3>
              <p style={{ fontSize: '12px', opacity: 0.9, margin: '2px 0 0' }}>
                Official Arena Entry Voucher
              </p>
            </div>

            <div style={{ padding: '24px', background: '#ffffff' }}>
              <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>Booking ID:</span>
                  <span style={{ fontWeight: '700', color: '#0f172a', fontFamily: 'monospace' }}>{selectedReceipt.id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>Venue:</span>
                  <span style={{ fontWeight: '700', color: '#0f172a' }}>{selectedReceipt.venue_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>Court:</span>
                  <span style={{ fontWeight: '700', color: '#0f172a' }}>{selectedReceipt.court_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>Date & Time:</span>
                  <span style={{ fontWeight: '700', color: '#0f172a' }}>{selectedReceipt.date} ({selectedReceipt.start_time} - {selectedReceipt.end_time})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #e2e8f0', fontSize: '13px' }}>
                  <span style={{ fontWeight: '700', color: '#0f172a' }}>Total Paid:</span>
                  <span style={{ fontWeight: '800', color: '#059669', fontSize: '15px' }}>₹{selectedReceipt.total_amount}</span>
                </div>
                {selectedReceipt.upi_utr && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
                    <span>UPI Reference (UTR):</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: '700' }}>{selectedReceipt.upi_utr}</span>
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'inline-block', padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                  <QrCode size={110} color="#0f172a" />
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>Scan at arena reception</div>
                </div>
              </div>

              <div style={{ fontSize: '11.5px', color: '#64748b', textAlign: 'center', marginBottom: '16px', lineHeight: 1.4 }}>
                Show this digital voucher to the venue manager upon arrival. Please wear non-marking shoes or standard turf studs.
              </div>

              <button
                onClick={() => setSelectedReceipt(null)}
                className="btn-primary"
                style={{ width: '100%', height: '40px' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
