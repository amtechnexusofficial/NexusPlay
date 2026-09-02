import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import {
  LayoutDashboard, Calendar, Users, DollarSign, Clock,
  Plus, CheckCircle, XCircle, AlertTriangle, ChevronRight,
  TrendingUp, Activity, Lock, Unlock, Phone, RefreshCw,
  Building, Settings, QrCode, Copy, ShieldCheck, CheckCircle2,
  FileText, Check, ExternalLink
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid
} from 'recharts';

export default function OwnerSaaSView({ onNavigateToPublicPage }) {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'upi_verification', 'calendar', 'crm', 'courts', 'upi_settings'
  const [context, setContext] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [pendingUpiBookings, setPendingUpiBookings] = useState([]);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [calendarDate, setCalendarDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);

  // UPI Settings Form State
  const [upiIdInput, setUpiIdInput] = useState('');
  const [upiNameInput, setUpiNameInput] = useState('');
  const [savingUpiSettings, setSavingUpiSettings] = useState(false);
  const [upiSuccessMsg, setUpiSuccessMsg] = useState('');
  const [copiedUtrId, setCopiedUtrId] = useState(null);

  // Walk-in modal
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInCourtId, setWalkInCourtId] = useState('');
  const [walkInDate, setWalkInDate] = useState(new Date().toISOString().slice(0, 10));
  const [walkInStartTime, setWalkInStartTime] = useState('18:00');
  const [walkInEndTime, setWalkInEndTime] = useState('19:00');
  const [walkInCustomerName, setWalkInCustomerName] = useState('');
  const [walkInCustomerPhone, setWalkInCustomerPhone] = useState('');
  const [walkInAmount, setWalkInAmount] = useState(1200);
  const [walkInPaymentMode, setWalkInPaymentMode] = useState('cash');

  // Slot blocking modal
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockCourtId, setBlockCourtId] = useState('');
  const [blockDate, setBlockDate] = useState(new Date().toISOString().slice(0, 10));
  const [blockStartTime, setBlockStartTime] = useState('14:00');
  const [blockEndTime, setBlockEndTime] = useState('15:00');
  const [blockReason, setBlockReason] = useState('Turf Maintenance & Brushing');

  // Add Court modal
  const [showCourtModal, setShowCourtModal] = useState(false);
  const [newCourtName, setNewCourtName] = useState('');
  const [newCourtSportId, setNewCourtSportId] = useState('football');
  const [newCourtCapacity, setNewCourtCapacity] = useState(14);
  const [newCourtBasePrice, setNewCourtBasePrice] = useState(1000);
  const [newCourtPeakPrice, setNewCourtPeakPrice] = useState(1500);
  const [newCourtWeekendPrice, setNewCourtWeekendPrice] = useState(1800);

  async function loadData() {
    try {
      setLoading(true);
      const ctx = await api.getOwnerContext();
      setContext(ctx);
      if (ctx.venues?.length > 0) {
        const venue = ctx.venues[0];
        setSelectedVenue(venue);
        setUpiIdInput(venue.upi_id || 'koramangala.sports@okaxis');
        setUpiNameInput(venue.upi_name || venue.name);

        const vId = venue.id;
        const [anData, bData, cData, pendingUpi] = await Promise.all([
          api.getOwnerAnalytics(vId),
          api.getOwnerBookings({ venueId: vId }),
          api.getCustomers(),
          api.getPendingUpiBookings(vId).catch(() => [])
        ]);
        setAnalytics(anData);
        setBookings(bData);
        setCustomers(cData);
        setPendingUpiBookings(pendingUpi || []);
      }
    } catch (err) {
      console.error('Error fetching owner data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleVerifyUpi(bookingId) {
    try {
      await api.verifyUpiPayment(bookingId, { action: 'verify_credit' });
      await loadData();
      alert('✅ UPI Payment verified as credited! Customer notified and booking confirmed.');
    } catch (err) {
      alert('Verification failed: ' + err.message);
    }
  }

  async function handleRejectUpi(bookingId) {
    const reason = prompt('Reason for rejection (e.g. Credit not found in bank statement, invalid UTR):', 'Payment not received in owner UPI bank account');
    if (reason === null) return;
    try {
      await api.verifyUpiPayment(bookingId, { action: 'reject', notes: reason });
      await loadData();
      alert('❌ Booking rejected and slot released back to open.');
    } catch (err) {
      alert('Rejection failed: ' + err.message);
    }
  }

  async function handleSaveUpiSettings(e) {
    e.preventDefault();
    if (!upiIdInput || !upiIdInput.includes('@')) {
      alert('Please enter a valid UPI ID (e.g. yourname@okaxis, turf@icici)');
      return;
    }
    setSavingUpiSettings(true);
    setUpiSuccessMsg('');
    try {
      await api.updateVenueUpiSettings(selectedVenue.id, {
        upi_id: upiIdInput.trim(),
        upi_name: upiNameInput.trim()
      });
      setUpiSuccessMsg('Owner UPI details updated successfully!');
      await loadData();
      setTimeout(() => setUpiSuccessMsg(''), 3500);
    } catch (err) {
      alert('Failed to save UPI settings: ' + err.message);
    } finally {
      setSavingUpiSettings(false);
    }
  }

  async function handleWalkInSubmit(e) {
    e.preventDefault();
    try {
      await api.createWalkInBooking({
        venueId: selectedVenue.id,
        courtId: walkInCourtId || 'crt_fb_1',
        date: walkInDate,
        startTime: walkInStartTime,
        endTime: walkInEndTime,
        customerName: walkInCustomerName,
        customerPhone: walkInCustomerPhone,
        amount: Number(walkInAmount),
        paymentMode: walkInPaymentMode
      });
      setShowWalkInModal(false);
      loadData();
      alert('Walk-in booking recorded successfully!');
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleBlockSlotSubmit(e) {
    e.preventDefault();
    try {
      await api.blockSlot({
        venueId: selectedVenue.id,
        courtId: blockCourtId || 'crt_fb_1',
        date: blockDate,
        startTime: blockStartTime,
        endTime: blockEndTime,
        reason: blockReason
      });
      setShowBlockModal(false);
      loadData();
      alert('Slot blocked for maintenance/blackout.');
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleAddCourtSubmit(e) {
    e.preventDefault();
    try {
      await api.createCourt({
        venueId: selectedVenue.id,
        name: newCourtName,
        sportId: newCourtSportId,
        capacity: Number(newCourtCapacity),
        basePrice: Number(newCourtBasePrice),
        peakPrice: Number(newCourtPeakPrice),
        weekendPrice: Number(newCourtWeekendPrice),
        slotDurationMinutes: 60
      });
      setShowCourtModal(false);
      loadData();
      alert('New court added to venue catalog!');
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleBookingAction(bookingId, action) {
    try {
      await api.updateBookingAction(bookingId, { action });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading SaaS Management Suite...
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1240, margin: '0 auto', padding: '16px 24px 80px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="badge-neon" style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
              ORGANIZATION: {context?.org?.name}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Multi-Tenant Isolated</span>
          </div>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginTop: 4 }}>
            {selectedVenue?.name || 'Venue SaaS Management'}
          </h1>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn-secondary"
            onClick={() => onNavigateToPublicPage?.(selectedVenue?.slug || selectedVenue?.id)}
            style={{ fontSize: 13 }}
          >
            View Public Page (URL)
          </button>
          <button
            className="btn-primary"
            onClick={() => setShowWalkInModal(true)}
            style={{ fontSize: 13 }}
          >
            <Plus size={16} /> Fast Walk-in Booking
          </button>
        </div>
      </div>

      {/* SaaS Navigation Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border-card)', paddingBottom: 12, marginBottom: 24, overflowX: 'auto' }}>
        {[
          { id: 'dashboard', label: 'Overview & Analytics', icon: <LayoutDashboard size={16} /> },
          {
            id: 'upi_verification',
            label: 'UPI Verification',
            icon: <ShieldCheck size={16} />,
            badge: pendingUpiBookings.length > 0 ? pendingUpiBookings.length : null
          },
          { id: 'calendar', label: 'Booking Calendar', icon: <Calendar size={16} /> },
          { id: 'crm', label: 'Customer CRM', icon: <Users size={16} /> },
          { id: 'courts', label: 'Court Management & Pricing', icon: <Building size={16} /> },
          { id: 'upi_settings', label: 'UPI QR Settings', icon: <QrCode size={16} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
              color: activeTab === tab.id ? 'var(--accent-neon)' : 'var(--text-secondary)',
              border: `1px solid ${activeTab === tab.id ? 'var(--border-card)' : 'transparent'}`,
              borderRadius: 10,
              padding: '8px 16px',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.icon} {tab.label}
            {tab.badge && (
              <span style={{
                background: '#fb923c',
                color: '#000',
                fontSize: 11,
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: 999,
                lineHeight: 1
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW & ANALYTICS */}
      {activeTab === 'dashboard' && analytics && (
        <div>
          {/* Key Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18, marginBottom: 24 }}>
            <div className="nexus-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                <span>Today's Revenue</span>
                <DollarSign size={16} style={{ color: 'var(--accent-neon)' }} />
              </div>
              <div className="font-display" style={{ fontSize: 32, fontWeight: 800, color: '#fff', marginTop: 8 }}>
                ₹{analytics.todayRevenue.toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: 'var(--accent-neon)', marginTop: 4 }}>
                +18% from last week
              </div>
            </div>

            <div className="nexus-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                <span>Today's Bookings</span>
                <Calendar size={16} style={{ color: 'var(--accent-neon)' }} />
              </div>
              <div className="font-display" style={{ fontSize: 32, fontWeight: 800, color: '#fff', marginTop: 8 }}>
                {analytics.todayBookings} slots
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Occupancy: {analytics.occupancyRate}%
              </div>
            </div>

            <div className="nexus-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                <span>Weekly Revenue</span>
                <TrendingUp size={16} style={{ color: '#fb923c' }} />
              </div>
              <div className="font-display" style={{ fontSize: 32, fontWeight: 800, color: '#fff', marginTop: 8 }}>
                ₹{analytics.weeklyRevenue.toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Peak hours: {analytics.peakHours}
              </div>
            </div>

            <div className="nexus-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                <span>Monthly Gross</span>
                <Activity size={16} style={{ color: 'var(--accent-neon)' }} />
              </div>
              <div className="font-display" style={{ fontSize: 32, fontWeight: 800, color: '#fff', marginTop: 8 }}>
                ₹{analytics.monthlyRevenue.toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Direct Venue Settlement
              </div>
            </div>
          </div>

          {/* Revenue & Occupancy Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: 20, marginBottom: 28 }}>
            <div className="nexus-card" style={{ padding: 22 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
                Weekly Revenue & Slot Trajectory (₹)
              </h3>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.revenueTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#232733" />
                    <XAxis dataKey="period" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip contentStyle={{ background: '#12141a', borderColor: '#232733', borderRadius: 8, color: '#fff' }} />
                    <Bar dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="nexus-card" style={{ padding: 22 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
                Revenue Distribution by Sport
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {analytics.revenueBySport.map((item, idx) => (
                  <div key={idx} style={{ background: '#12141a', padding: 12, borderRadius: 10, border: '1px solid var(--border-card)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
                      <span>{item.sport}</span>
                      <span>₹{item.revenue.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-muted)' }}>
                      <span>{item.count} bookings</span>
                      <span>{Math.round((item.revenue / 196100) * 100)}% of turnover</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BOOKING CALENDAR & MANAGEMENT */}
      {activeTab === 'calendar' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="date"
                value={calendarDate}
                onChange={e => setCalendarDate(e.target.value)}
                className="nexus-input"
              />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Showing schedule & walk-ins for this date
              </span>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-secondary" onClick={() => setShowBlockModal(true)} style={{ fontSize: 13 }}>
                <Lock size={14} /> Block Slot for Maintenance
              </button>
              <button className="btn-primary" onClick={() => setShowWalkInModal(true)} style={{ fontSize: 13 }}>
                <Plus size={14} /> Add Walk-in
              </button>
            </div>
          </div>

          {/* Bookings Table */}
          <div className="nexus-card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: '#12141a', borderBottom: '1px solid var(--border-card)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '14px 18px', fontWeight: 600 }}>TIME</th>
                  <th style={{ padding: '14px 18px', fontWeight: 600 }}>COURT</th>
                  <th style={{ padding: '14px 18px', fontWeight: 600 }}>CUSTOMER</th>
                  <th style={{ padding: '14px 18px', fontWeight: 600 }}>AMOUNT</th>
                  <th style={{ padding: '14px 18px', fontWeight: 600 }}>STATUS</th>
                  <th style={{ padding: '14px 18px', fontWeight: 600 }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--border-card)' }}>
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: '#fff' }}>
                      {b.start_time} - {b.end_time}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{b.date}</div>
                    </td>
                    <td style={{ padding: '14px 18px', color: '#e2e8f0' }}>
                      {b.court_name || 'Pro Turf'}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 600, color: '#fff' }}>{b.customer_name || 'Walk-in Guest'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.customer_phone}</div>
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--accent-neon)' }}>
                      ₹{b.total_amount}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {b.payment_mode === 'upi' ? 'Owner UPI' : b.payment_mode}
                      </div>
                      {b.upi_utr && (
                        <div style={{ fontSize: 10, color: '#93c5fd', fontFamily: 'monospace', marginTop: 2 }}>
                          UTR: {b.upi_utr}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      {b.payment_status === 'pending_verification' ? (
                        <span
                          style={{
                            background: 'rgba(251, 146, 60, 0.15)',
                            border: '1px solid rgba(251, 146, 60, 0.35)',
                            color: '#fb923c',
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <Clock size={11} /> Pending UPI Verification
                        </span>
                      ) : (
                        <span
                          className={b.status === 'confirmed' ? 'badge-neon' : b.status === 'cancelled' ? 'badge-orange' : ''}
                          style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}
                        >
                          {b.status} {b.payment_mode === 'upi' && b.payment_status === 'paid' ? '· UPI Paid' : ''}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {b.payment_status === 'pending_verification' && (
                          <>
                            <button
                              onClick={() => handleVerifyUpi(b.id)}
                              style={{
                                background: '#10b981',
                                border: 'none',
                                color: '#000',
                                padding: '4px 9px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3
                              }}
                            >
                              <Check size={12} /> Verify Credit
                            </button>
                            <button
                              onClick={() => handleRejectUpi(b.id)}
                              style={{
                                background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.3)',
                                color: '#f87171',
                                padding: '4px 7px',
                                borderRadius: 6,
                                fontSize: 11,
                                cursor: 'pointer'
                              }}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {b.payment_mode === 'cash' && b.payment_status !== 'paid' && (
                          <button
                            className="btn-secondary"
                            onClick={() => handleBookingAction(b.id, 'mark_cash_paid')}
                            style={{ padding: '4px 8px', fontSize: 11 }}
                          >
                            Collect Cash
                          </button>
                        )}
                        {b.status !== 'cancelled' && b.payment_status !== 'pending_verification' && (
                          <button
                            onClick={() => handleBookingAction(b.id, 'cancel')}
                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: UPI VERIFICATION QUEUE */}
      {activeTab === 'upi_verification' && (
        <div className="animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge-neon" style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                  DIRECT-TO-BANK AUDIT
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>0% Gateway Commission</span>
              </div>
              <h2 className="font-display" style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginTop: 4 }}>
                UPI Payments Verification & Credit Queue
              </h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
                Audit incoming player UPI payments. Check the 12-digit UTR against your bank statement or merchant app (PhonePe/GPay/Paytm Business) and click <strong>Verify & Credit</strong> to confirm the booking.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-secondary" onClick={loadData} style={{ fontSize: 13 }}>
                <RefreshCw size={14} /> Refresh Queue
              </button>
              <button className="btn-primary" onClick={() => setActiveTab('upi_settings')} style={{ fontSize: 13 }}>
                <QrCode size={14} /> QR Code Settings
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="nexus-card" style={{ padding: 18, borderLeft: '3px solid #fb923c' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fb923c', textTransform: 'uppercase' }}>
                Pending Verifications
              </div>
              <div className="font-display" style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginTop: 6 }}>
                {pendingUpiBookings.length} bookings
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Awaiting bank credit confirmation
              </div>
            </div>

            <div className="nexus-card" style={{ padding: 18, borderLeft: '3px solid var(--accent-neon)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-neon)', textTransform: 'uppercase' }}>
                Total Pending Value
              </div>
              <div className="font-display" style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginTop: 6 }}>
                ₹{pendingUpiBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0).toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Direct to owner bank account
              </div>
            </div>

            <div className="nexus-card" style={{ padding: 18, borderLeft: '3px solid #3b82f6' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase' }}>
                Active Owner UPI ID
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginTop: 8, wordBreak: 'break-all' }}>
                {selectedVenue?.upi_id || 'koramangala.sports@okaxis'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Payee: {selectedVenue?.upi_name || selectedVenue?.name}
              </div>
            </div>
          </div>

          {/* Pending Verifications Queue */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={16} style={{ color: '#fb923c' }} />
              Awaiting Your Verification ({pendingUpiBookings.length})
            </h3>

            {pendingUpiBookings.length === 0 ? (
              <div className="nexus-card" style={{ padding: 40, textAlign: 'center' }}>
                <CheckCircle2 size={42} style={{ color: 'var(--accent-neon)', margin: '0 auto 12px' }} />
                <h4 style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                  All UPI Payments Are Verified!
                </h4>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto' }}>
                  No pending UPI credit audits in the queue. When customers scan your venue QR code and enter their 12-digit UTR, they will appear here for verification.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
                {pendingUpiBookings.map(b => (
                  <div key={b.id} className="nexus-card" style={{ padding: 20, border: '1px solid rgba(251, 146, 60, 0.4)', background: '#161922' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
                          ₹{b.total_amount}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {b.court_name} · {b.date} ({b.start_time} - {b.end_time})
                        </div>
                      </div>
                      <span style={{ background: 'rgba(251, 146, 60, 0.15)', border: '1px solid rgba(251, 146, 60, 0.4)', color: '#fb923c', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                        Pending Audit
                      </span>
                    </div>

                    {/* Customer info */}
                    <div style={{ background: '#101217', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{b.customer_name || 'Player'}</span>
                        <a
                          href={`tel:${b.customer_phone}`}
                          style={{ fontSize: 12, color: '#93c5fd', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Phone size={11} /> {b.customer_phone}
                        </a>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Submitted: {b.created_at ? new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                      </div>
                    </div>

                    {/* 12-Digit UTR Box with 1-click copy */}
                    <div style={{ background: '#1a1d25', border: '1px dashed #3b82f6', borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>
                            CUSTOMER SUBMITTED 12-DIGIT UTR / UPI REF
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#93c5fd', fontFamily: 'monospace', letterSpacing: '0.08em', marginTop: 2 }}>
                            {b.upi_utr || 'Not provided'}
                          </div>
                        </div>
                        {b.upi_utr && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(b.upi_utr);
                              setCopiedUtrId(b.id);
                              setTimeout(() => setCopiedUtrId(null), 2000);
                            }}
                            style={{
                              background: copiedUtrId === b.id ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                              border: 'none',
                              color: copiedUtrId === b.id ? 'var(--accent-neon)' : '#fff',
                              borderRadius: 6,
                              padding: '5px 9px',
                              fontSize: 11,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            {copiedUtrId === b.id ? <Check size={12} /> : <Copy size={12} />}
                            {copiedUtrId === b.id ? 'Copied' : 'Copy UTR'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={() => handleVerifyUpi(b.id)}
                        className="btn-primary"
                        style={{ flex: 2, fontSize: 12.5, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      >
                        <CheckCircle size={15} /> Verify & Credit
                      </button>
                      <button
                        onClick={() => handleRejectUpi(b.id)}
                        style={{
                          flex: 1,
                          background: 'rgba(239, 68, 68, 0.12)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#f87171',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historical Verified UPI Bookings */}
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={16} style={{ color: 'var(--accent-neon)' }} />
              Recently Verified UPI Payments Audit Log
            </h3>
            <div className="nexus-card" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#12141a', borderBottom: '1px solid var(--border-card)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>BOOKING / TIME</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>CUSTOMER</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>AMOUNT</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>VERIFIED UTR</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>VERIFIED AT</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>AUDIT STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.filter(b => b.payment_mode === 'upi' && b.payment_status === 'paid').length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                        No verified UPI transactions yet. Verified payments will be logged here.
                      </td>
                    </tr>
                  ) : (
                    bookings.filter(b => b.payment_mode === 'upi' && b.payment_status === 'paid').slice(0, 10).map(b => (
                      <tr key={b.id} style={{ borderBottom: '1px solid var(--border-card)' }}>
                        <td style={{ padding: '12px 16px', color: '#fff', fontWeight: 600 }}>
                          {b.court_name}
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{b.date} · {b.start_time} - {b.end_time}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ color: '#fff', fontWeight: 600 }}>{b.customer_name || 'Player'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.customer_phone}</div>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--accent-neon)' }}>
                          ₹{b.total_amount}
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#93c5fd', fontSize: 12 }}>
                          {b.upi_utr || 'Manual Verified'}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: 11.5 }}>
                          {b.upi_verified_at ? new Date(b.upi_verified_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Earlier'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className="badge-neon" style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 700 }}>
                            CREDITED
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: OWNER UPI QR SETTINGS */}
      {activeTab === 'upi_settings' && selectedVenue && (
        <div className="animate-fade-in">
          <div style={{ marginBottom: 20 }}>
            <h2 className="font-display" style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>
              Owner Direct UPI & QR Configuration
            </h2>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
              Set up your personal or business UPI ID. Players will scan this exact QR code and pay directly to your bank account with <strong>0% platform commission</strong>.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
            {/* Settings Form */}
            <div className="nexus-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
                UPI Bank Account Details
              </h3>

              {upiSuccessMsg && (
                <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--accent-neon)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={16} /> {upiSuccessMsg}
                </div>
              )}

              <form onSubmit={handleSaveUpiSettings} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                    VENUE / OWNER UPI ID (VPA) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. yourturf@okaxis, 9876543210@paytm"
                    className="nexus-input"
                    style={{ width: '100%', fontSize: 14 }}
                    value={upiIdInput}
                    onChange={e => setUpiIdInput(e.target.value)}
                  />
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                    Supported: Google Pay, PhonePe, Paytm, BHIM, HDFC, ICICI, SBI VPAs.
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                    PAYEE DISPLAY NAME (Business / Owner Name)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Nexus Sports Koramangala Arena"
                    className="nexus-input"
                    style={{ width: '100%', fontSize: 14 }}
                    value={upiNameInput}
                    onChange={e => setUpiNameInput(e.target.value)}
                  />
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                    Name shown on the customer's UPI payment screen.
                  </div>
                </div>

                <div style={{ background: '#12141a', padding: 14, borderRadius: 10, border: '1px solid var(--border-card)', fontSize: 12.5 }}>
                  <div style={{ fontWeight: 700, color: '#fff', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={15} style={{ color: 'var(--accent-neon)' }} />
                    Zero Gateway Commission Model
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <li>100% of player payments land directly in your registered bank account.</li>
                    <li>No payment gateway intermediary cuts 2-3% of your revenue.</li>
                    <li>Instant settlements: no T+2 settlement waiting periods.</li>
                  </ul>
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={savingUpiSettings}
                  style={{ width: '100%', padding: '12px', fontSize: 13.5 }}
                >
                  {savingUpiSettings ? 'Saving Settings...' : 'Save UPI Payment Settings'}
                </button>
              </form>
            </div>

            {/* Live QR Preview */}
            <div className="nexus-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
                Live Player Booking QR Preview
              </div>

              <div style={{ background: '#fff', padding: 16, borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', marginBottom: 16 }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(`upi://pay?pa=${upiIdInput || 'koramangala.sports@okaxis'}&pn=${encodeURIComponent(upiNameInput || selectedVenue.name)}&cu=INR`)}`}
                  alt="Live UPI QR Code"
                  style={{ width: 190, height: 190, display: 'block' }}
                />
              </div>

              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
                {upiNameInput || selectedVenue.name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--accent-neon)', fontWeight: 700, marginBottom: 14 }}>
                {upiIdInput || 'koramangala.sports@okaxis'}
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: '#12141a', padding: 12, borderRadius: 8, width: '100%', textAlign: 'left' }}>
                <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4 }}>
                  How customers book:
                </div>
                1. Player selects court & time slot.<br />
                2. Player scans this QR with GPay / PhonePe / Paytm.<br />
                3. Player enters 12-digit UTR on checkout.<br />
                4. You verify the UTR in your Verification tab to credit slot!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CUSTOMER CRM */}
      {activeTab === 'crm' && (
        <div>
          <div style={{ marginBottom: 18 }}>
            <h2 className="font-display" style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
              Customer Relationship Management (CRM)
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              Automatically compiled customer directory with spend histories, repeat booking ratios, and phone contacts.
            </p>
          </div>

          <div className="nexus-card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: '#12141a', borderBottom: '1px solid var(--border-card)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '14px 18px', fontWeight: 600 }}>CUSTOMER NAME</th>
                  <th style={{ padding: '14px 18px', fontWeight: 600 }}>PHONE NUMBER</th>
                  <th style={{ padding: '14px 18px', fontWeight: 600 }}>BOOKINGS</th>
                  <th style={{ padding: '14px 18px', fontWeight: 600 }}>LIFETIME SPEND</th>
                  <th style={{ padding: '14px 18px', fontWeight: 600 }}>LAST VISIT</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border-card)' }}>
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: '#fff' }}>
                      {c.name || 'Anonymous Customer'}
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                      {c.phone}
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: 600, color: '#e2e8f0' }}>
                      {c.booking_count} times
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--accent-neon)' }}>
                      ₹{c.total_spend.toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: 12 }}>
                      {c.last_booking_date ? new Date(c.last_booking_date).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: COURT MANAGEMENT & PRICING */}
      {activeTab === 'courts' && selectedVenue && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 className="font-display" style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>
                Court & Tiered Pricing Configuration
              </h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
                Configure base pricing, peak hours surge, and weekend rates.
              </p>
            </div>
            <button className="btn-primary" onClick={() => setShowCourtModal(true)}>
              <Plus size={16} /> Add New Court
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {selectedVenue.courts?.map(c => (
              <div key={c.id} className="nexus-card" style={{ padding: 22 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{c.name}</h3>
                <div style={{ fontSize: 13, color: 'var(--accent-neon)', textTransform: 'capitalize', fontWeight: 600, marginBottom: 16 }}>
                  Sport: {c.sport_id} · Max Capacity: {c.capacity}
                </div>

                <div style={{ background: '#12141a', padding: 14, borderRadius: 10, border: '1px solid var(--border-card)', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Base Hourly Price:</span>
                    <strong style={{ color: '#fff' }}>₹{c.base_price}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Peak Hours (18:00 - 22:00):</span>
                    <strong style={{ color: '#fb923c' }}>₹{c.peak_price || c.base_price}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Weekend (Sat - Sun):</span>
                    <strong style={{ color: 'var(--accent-neon)' }}>₹{c.weekend_price || c.base_price}</strong>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Slot Duration: {c.slot_duration_minutes} minutes
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: Walk-in Booking */}
      {showWalkInModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div className="nexus-card animate-fade-in" style={{ maxWidth: 480, width: '100%', padding: 26, background: '#181b22' }}>
            <h2 className="font-display" style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
              Create Walk-in Booking
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>
              Quickly record reception desk walk-ins and collect cash.
            </p>

            <form onSubmit={handleWalkInSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>CUSTOMER PHONE *</label>
                <input
                  type="tel"
                  required
                  placeholder="+91 98765 43210"
                  className="nexus-input"
                  style={{ width: '100%' }}
                  value={walkInCustomerPhone}
                  onChange={e => setWalkInCustomerPhone(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>CUSTOMER NAME</label>
                <input
                  type="text"
                  placeholder="Player Name"
                  className="nexus-input"
                  style={{ width: '100%' }}
                  value={walkInCustomerName}
                  onChange={e => setWalkInCustomerName(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>DATE *</label>
                  <input
                    type="date"
                    required
                    className="nexus-input"
                    style={{ width: '100%' }}
                    value={walkInDate}
                    onChange={e => setWalkInDate(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>START TIME *</label>
                  <input
                    type="time"
                    required
                    className="nexus-input"
                    style={{ width: '100%' }}
                    value={walkInStartTime}
                    onChange={e => setWalkInStartTime(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>AMOUNT (₹) *</label>
                  <input
                    type="number"
                    required
                    className="nexus-input"
                    style={{ width: '100%' }}
                    value={walkInAmount}
                    onChange={e => setWalkInAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>PAYMENT</label>
                  <select
                    value={walkInPaymentMode}
                    onChange={e => setWalkInPaymentMode(e.target.value)}
                    className="nexus-input"
                    style={{ width: '100%' }}
                  >
                    <option value="cash">Cash Collected</option>
                    <option value="upi">Direct UPI QR</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowWalkInModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1.5 }}>
                  Confirm Walk-in
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Block Slot for Maintenance */}
      {showBlockModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div className="nexus-card animate-fade-in" style={{ maxWidth: 460, width: '100%', padding: 26, background: '#181b22' }}>
            <h2 className="font-display" style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
              Block Slot / Blackout
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>
              Take slot off the public booking schedule for maintenance, tournament booking, or holidays.
            </p>

            <form onSubmit={handleBlockSlotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>REASON *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grass aeration, Tournament block"
                  className="nexus-input"
                  style={{ width: '100%' }}
                  value={blockReason}
                  onChange={e => setBlockReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>DATE *</label>
                  <input
                    type="date"
                    required
                    className="nexus-input"
                    style={{ width: '100%' }}
                    value={blockDate}
                    onChange={e => setBlockDate(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>START TIME *</label>
                  <input
                    type="time"
                    required
                    className="nexus-input"
                    style={{ width: '100%' }}
                    value={blockStartTime}
                    onChange={e => setBlockStartTime(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowBlockModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1.5, background: '#fb923c', color: '#000' }}>
                  Block Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Court */}
      {showCourtModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div className="nexus-card animate-fade-in" style={{ maxWidth: 480, width: '100%', padding: 26, background: '#181b22' }}>
            <h2 className="font-display" style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
              Add Court / Pitch
            </h2>

            <form onSubmit={handleAddCourtSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>COURT NAME *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pitch 3 - 5v5 Futsal Cage"
                  className="nexus-input"
                  style={{ width: '100%' }}
                  value={newCourtName}
                  onChange={e => setNewCourtName(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>SPORT *</label>
                  <select
                    value={newCourtSportId}
                    onChange={e => setNewCourtSportId(e.target.value)}
                    className="nexus-input"
                    style={{ width: '100%' }}
                  >
                    <option value="football">Football</option>
                    <option value="futsal">Futsal</option>
                    <option value="cricket">Cricket Box</option>
                    <option value="badminton">Badminton</option>
                    <option value="padel">Padel</option>
                    <option value="pickleball">Pickleball</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>CAPACITY</label>
                  <input
                    type="number"
                    className="nexus-input"
                    style={{ width: '100%' }}
                    value={newCourtCapacity}
                    onChange={e => setNewCourtCapacity(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>BASE (₹)</label>
                  <input
                    type="number"
                    required
                    className="nexus-input"
                    style={{ width: '100%' }}
                    value={newCourtBasePrice}
                    onChange={e => setNewCourtBasePrice(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>PEAK (₹)</label>
                  <input
                    type="number"
                    required
                    className="nexus-input"
                    style={{ width: '100%' }}
                    value={newCourtPeakPrice}
                    onChange={e => setNewCourtPeakPrice(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>WEEKEND (₹)</label>
                  <input
                    type="number"
                    required
                    className="nexus-input"
                    style={{ width: '100%' }}
                    value={newCourtWeekendPrice}
                    onChange={e => setNewCourtWeekendPrice(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowCourtModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1.5 }}>
                  Save Court
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
