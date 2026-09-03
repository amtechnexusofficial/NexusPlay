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
  ShieldCheck
} from 'lucide-react';
import { api } from '../api';

export function PlayerDashboard({ user, onBookVenue, onBrowseGames, onLogout }) {
  const [activeTab, setActiveTab] = useState('bookings'); // 'bookings' | 'games' | 'profile'
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

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

  useEffect(() => {
    fetchDashboard();
  }, [user]);

  const profile = dashboardData?.profile || {
    phone: user?.phone || '9876500001',
    email: user?.email || 'player@nexusplay.com',
    totalSpent: 1200,
    totalBookings: 2,
    gamesJoined: 2,
    loyaltyTier: 'Active Player'
  };

  const bookings = dashboardData?.bookings || [];
  const games = dashboardData?.games || [];

  return (
    <div id="player-dashboard-container" style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px 80px' }}>
      
      {/* Top Profile Banner - Crisp White Modern Card */}
      <div 
        id="player-profile-card"
        className="nexus-card"
        style={{ padding: '24px', marginBottom: '24px', background: '#ffffff', border: '1px solid #e2e8f0' }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontWeight: '800'
            }}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'P'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                  {user?.name || 'Nexus Player'}
                </h2>
                <span className="badge-emerald">
                  <ShieldCheck size={12} />
                  Verified Player
                </span>
                <span className="badge-slate" style={{ fontSize: '11px' }}>
                  {profile.loyaltyTier}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', fontSize: '12.5px', color: '#64748b' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Phone size={13} color="#059669" />
                  +91 {user?.phone || profile.phone}
                </span>
                {user?.email && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Mail size={13} color="#059669" />
                    {user.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              id="player-book-court-btn"
              onClick={onBookVenue}
              className="btn-primary"
              style={{ fontSize: '13px', padding: '8px 16px' }}
            >
              <Calendar size={15} />
              <span>Book a Turf</span>
            </button>
            <button
              id="player-join-pickup-btn"
              onClick={onBrowseGames}
              className="btn-secondary"
              style={{ fontSize: '13px', padding: '8px 16px' }}
            >
              <Users size={15} />
              <span>Join Pickup</span>
            </button>
            <button
              id="player-logout-btn"
              onClick={onLogout}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#64748b',
                fontSize: '12.5px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Logout"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
          gap: '12px', 
          marginTop: '20px', 
          paddingTop: '20px', 
          borderTop: '1px solid #f1f5f9' 
        }}>
          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Court Reservations
            </div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
              {profile.totalBookings} Completed
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pickup Games Joined
            </div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669', marginTop: '2px' }}>
              {profile.gamesJoined} Matches
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Direct UPI Spent
            </div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
              ₹{profile.totalSpent.toLocaleString('en-IN')}
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Preferred Sport
            </div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#4f46e5', marginTop: '4px' }}>
              Football & Badminton
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            id="tab-my-bookings"
            onClick={() => setActiveTab('bookings')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'bookings' ? '#059669' : '#ffffff',
              color: activeTab === 'bookings' ? '#ffffff' : '#475569',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: activeTab === 'bookings' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <Calendar size={15} />
            <span>My Bookings ({bookings.length})</span>
          </button>

          <button
            id="tab-my-games"
            onClick={() => setActiveTab('games')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'games' ? '#059669' : '#ffffff',
              color: activeTab === 'games' ? '#ffffff' : '#475569',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: activeTab === 'games' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <Users size={15} />
            <span>Joined Pickups ({games.length})</span>
          </button>
        </div>

        <button
          onClick={fetchDashboard}
          disabled={isLoading}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* MY BOOKINGS TAB */}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {bookings.map((booking) => {
                const isPaid = booking.payment_status === 'paid' || booking.payment_status === 'pending_verification';
                const isCash = booking.payment_status === 'cash';

                return (
                  <div
                    key={booking.id}
                    id={`booking-card-${booking.id}`}
                    className="nexus-card"
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      padding: '18px 20px',
                      borderRadius: '12px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '16px'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '10px',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        color: '#059669',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Trophy size={20} />
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
                          {booking.venue_address && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <MapPin size={13} color="#059669" />
                              {booking.venue_address.split(',')[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: 'auto' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                          ₹{booking.total_amount}
                        </div>
                        <div style={{ marginTop: '2px' }}>
                          {booking.payment_status === 'paid' && (
                            <span className="badge-emerald" style={{ fontSize: '10.5px' }}>
                              <CheckCircle2 size={11} />
                              Confirmed & Paid
                            </span>
                          )}
                          {booking.payment_status === 'pending_verification' && (
                            <span className="badge-amber" style={{ fontSize: '10.5px' }}>
                              <Clock size={11} />
                              Awaiting UTR Verification
                            </span>
                          )}
                          {isCash && (
                            <span className="badge-slate" style={{ fontSize: '10.5px' }}>
                              Pay Cash at Reception
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          id={`view-receipt-btn-${booking.id}`}
                          onClick={() => setSelectedReceipt(booking)}
                          className="btn-secondary"
                          style={{ fontSize: '12px', padding: '6px 12px' }}
                        >
                          <Receipt size={14} />
                          <span>Receipt</span>
                        </button>
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
      {/* MY GAMES TAB */}
      {/* =================================================================== */}
      {activeTab === 'games' && (
        <div>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#059669' }} />
              <div>Fetching community match rosters...</div>
            </div>
          ) : games.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <Users size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>
                No Pickup Games Joined Yet
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '420px', margin: '0 auto 16px' }}>
                Join open football, badminton, or cricket matches organized by fellow athletes in your area. Split turf costs effortlessly.
              </p>
              <button onClick={onBrowseGames} className="btn-primary">
                Browse Live Pickup Games
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {games.map((game) => (
                <div
                  key={game.id}
                  className="nexus-card"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    padding: '18px 20px',
                    borderRadius: '12px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '16px'
                  }}
                >
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      background: '#eef2ff',
                      border: '1px solid #c7d2fe',
                      color: '#4f46e5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Users size={20} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                          {game.title}
                        </span>
                        <span className="badge-emerald" style={{ fontSize: '11px' }}>
                          Joined Slot
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
                        Paid via UPI
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
                <CheckCircle2 size={24} color="#ffffff" />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>
                NexusPlay Court Pass
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
