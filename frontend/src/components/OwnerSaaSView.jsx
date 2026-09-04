import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import {
  LayoutDashboard, Calendar, Users, DollarSign, Clock,
  Plus, CheckCircle, XCircle, AlertTriangle, ChevronRight,
  TrendingUp, Activity, Lock, Unlock, Phone, RefreshCw,
  Building, Settings, QrCode, Copy, ShieldCheck, CheckCircle2,
  FileText, Check, ExternalLink, MapPin, Share2, Flame,
  Tag, AlertCircle, Edit3, Save, Navigation, Sparkles, Trophy
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid
} from 'recharts';

export default function OwnerSaaSView({ onNavigateToPublicPage }) {
  // Tabs: 'dashboard', 'live_slots', 'business_setup', 'upi_verification', 'crm', 'courts'
  const [activeTab, setActiveTab] = useState('live_slots');
  const [context, setContext] = useState(null);
  const [venues, setVenues] = useState([]);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [pendingUpiBookings, setPendingUpiBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Live Slots & Interactive Calendar State
  const [calendarDate, setCalendarDate] = useState(new Date().toISOString().slice(0, 10));
  const [liveSlots, setLiveSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [courtFilter, setCourtFilter] = useState('all');

  // Full-Time Inquiry Modal State
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [inquirySlot, setInquirySlot] = useState(null);
  const [inquiryClientName, setInquiryClientName] = useState('');
  const [inquiryClientPhone, setInquiryClientPhone] = useState('');
  const [inquiryAmount, setInquiryAmount] = useState(1600);
  const [inquiryPaymentMode, setInquiryPaymentMode] = useState('cash');
  const [inquiryNotes, setInquiryNotes] = useState('Corporate private match booking');
  const [submittingInquiry, setSubmittingInquiry] = useState(false);

  // Slot Price Editing Inline Modal
  const [editingPriceSlot, setEditingPriceSlot] = useState(null);
  const [newPriceValue, setNewPriceValue] = useState(1200);

  // Business Setup Form State
  const [bizName, setBizName] = useState('');
  const [bizOrgName, setBizOrgName] = useState('');
  const [bizAddress, setBizAddress] = useState('');
  const [bizCity, setBizCity] = useState('');
  const [bizPincode, setBizPincode] = useState('');
  const [bizPhone, setBizPhone] = useState('');
  const [bizEmail, setBizEmail] = useState('');
  const [bizGstin, setBizGstin] = useState('');
  const [bizType, setBizType] = useState('Private Limited Company');
  const [bizOpenTime, setBizOpenTime] = useState('06:00');
  const [bizCloseTime, setBizCloseTime] = useState('23:30');
  const [bizLat, setBizLat] = useState('12.9352');
  const [bizLng, setBizLng] = useState('77.6245');
  const [bizRules, setBizRules] = useState('');
  const [bizAmenities, setBizAmenities] = useState([]);
  const [bizUpiId, setBizUpiId] = useState('');
  const [bizUpiName, setBizUpiName] = useState('');
  const [savingBiz, setSavingBiz] = useState(false);
  const [bizSuccessMsg, setBizSuccessMsg] = useState('');

  // Walk-in modal
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInCourtId, setWalkInCourtId] = useState('');
  const [walkInDate, setWalkInDate] = useState(new Date().toISOString().slice(0, 10));
  const [walkInStartTime, setWalkInStartTime] = useState('18:00');
  const [walkInCustomerName, setWalkInCustomerName] = useState('');
  const [walkInCustomerPhone, setWalkInCustomerPhone] = useState('');
  const [walkInAmount, setWalkInAmount] = useState(1200);
  const [walkInPaymentMode, setWalkInPaymentMode] = useState('cash');

  // Slot blocking modal
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockCourtId, setBlockCourtId] = useState('');
  const [blockDate, setBlockDate] = useState(new Date().toISOString().slice(0, 10));
  const [blockStartTime, setBlockStartTime] = useState('14:00');
  const [blockReason, setBlockReason] = useState('Turf Maintenance & Brushing');

  // Add Court modal
  const [showCourtModal, setShowCourtModal] = useState(false);
  const [newCourtName, setNewCourtName] = useState('');
  const [newCourtSportId, setNewCourtSportId] = useState('football');
  const [newCourtCapacity, setNewCourtCapacity] = useState(14);
  const [newCourtBasePrice, setNewCourtBasePrice] = useState(1000);
  const [newCourtPeakPrice, setNewCourtPeakPrice] = useState(1500);
  const [newCourtWeekendPrice, setNewCourtWeekendPrice] = useState(1800);

  // Link copy toast
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [slotViewMode, setSlotViewMode] = useState('cards'); // 'cards' or 'table'

  // Reschedule booking modal
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleStartTime, setRescheduleStartTime] = useState('');
  const [rescheduleEndTime, setRescheduleEndTime] = useState('');
  const [submittingReschedule, setSubmittingReschedule] = useState(false);

  // Load Initial Data
  async function loadData(targetVenueId = null) {
    try {
      setLoading(true);
      const ctx = await api.getOwnerContext();
      setContext(ctx);
      setVenues(ctx.venues || []);

      if (ctx.venues?.length > 0) {
        const v = targetVenueId ? ctx.venues.find(item => item.id === targetVenueId) || ctx.venues[0] : ctx.venues[0];
        setSelectedVenue(v);
        populateBizForm(v);

        const vId = v.id;
        const [anData, bData, cData, pendingUpi] = await Promise.all([
          api.getOwnerAnalytics(vId).catch(() => null),
          api.getOwnerBookings({ venueId: vId }).catch(() => []),
          api.getCustomers().catch(() => []),
          api.getPendingUpiBookings(vId).catch(() => [])
        ]);

        setAnalytics(anData);
        setBookings(bData || []);
        setCustomers(cData || []);
        setPendingUpiBookings(pendingUpi || []);

        // Load live slots for default date
        loadLiveSlots(vId, calendarDate);
      }
    } catch (err) {
      console.error('Error fetching owner data:', err);
    } finally {
      setLoading(false);
    }
  }

  function populateBizForm(v) {
    setBizName(v.name || '');
    setBizOrgName(v.organization_name || context?.organization?.name || 'Nexus Arena Sports Pvt Ltd');
    setBizAddress(v.address || '');
    setBizCity(v.city || 'Bangalore');
    setBizPincode(v.pincode || '560034');
    setBizPhone(v.phone || '+91 98765 43210');
    setBizEmail(v.email || 'contact@nexusplay.com');
    setBizGstin(v.gstin || '29AABCN1234F1Z5');
    setBizType(v.business_type || 'Private Limited Company');
    setBizOpenTime(v.open_time || '06:00');
    setBizCloseTime(v.close_time || '23:30');
    setBizLat(String(v.lat || '12.9352'));
    setBizLng(String(v.lng || '77.6245'));
    setBizRules(v.rules || '1. Turf shoes or rubber studs only (No metal spikes).\n2. Arrive 10 minutes prior to slot start.\n3. Zero food or chewing gum on the artificial turf.\n4. Free cancellation up to 4 hours before slot time.');
    setBizAmenities(Array.isArray(v.amenities) ? v.amenities : [
      'FIFA Approved Artificial Turf', 'LED Floodlights (500 Lux)', 'Shower & Locker Rooms',
      'Free Parking (Car & 2-Wheeler)', 'Cafeteria & Energy Drinks', 'Bibs & Match Balls', 'First Aid Kit'
    ]);
    setBizUpiId(v.upi_id || 'koramangala.sports@okaxis');
    setBizUpiName(v.upi_name || v.name);
  }

  async function loadLiveSlots(vId, date) {
    if (!vId) return;
    try {
      setLoadingSlots(true);
      const res = await api.getOwnerLiveSlots(vId, date);
      setLiveSlots(res.slots || []);
    } catch (err) {
      console.error('Error fetching live slots:', err);
    } finally {
      setLoadingSlots(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleVenueChange(vId) {
    const v = venues.find(item => item.id === vId);
    if (v) {
      setSelectedVenue(v);
      populateBizForm(v);
      loadLiveSlots(v.id, calendarDate);
    }
  }

  function handleDateChange(newDate) {
    setCalendarDate(newDate);
    if (selectedVenue) {
      loadLiveSlots(selectedVenue.id, newDate);
    }
  }

  // Save Full Business Details
  async function handleSaveBusinessDetails(e) {
    e.preventDefault();
    if (!selectedVenue) return;
    setSavingBiz(true);
    setBizSuccessMsg('');

    try {
      await api.updateVenueProfile(selectedVenue.id, {
        name: bizName.trim(),
        organization_name: bizOrgName.trim(),
        address: bizAddress.trim(),
        city: bizCity.trim(),
        pincode: bizPincode.trim(),
        phone: bizPhone.trim(),
        email: bizEmail.trim(),
        gstin: bizGstin.trim(),
        business_type: bizType.trim(),
        open_time: bizOpenTime,
        close_time: bizCloseTime,
        lat: parseFloat(bizLat) || 12.9352,
        lng: parseFloat(bizLng) || 77.6245,
        rules: bizRules.trim(),
        amenities: bizAmenities,
        upi_id: bizUpiId.trim(),
        upi_name: bizUpiName.trim()
      });

      setBizSuccessMsg('Business details updated successfully! Changes are live on your public booking page.');
      await loadData(selectedVenue.id);
      setTimeout(() => setBizSuccessMsg(''), 4000);
    } catch (err) {
      alert('Failed to save business details: ' + err.message);
    } finally {
      setSavingBiz(false);
    }
  }

  // Owner Host Open Game Modal State
  const [showOwnerHostModal, setShowOwnerHostModal] = useState(false);
  const [ownerHostSlot, setOwnerHostSlot] = useState(null);
  const [ownerHostTitle, setOwnerHostTitle] = useState('');
  const [ownerHostSportId, setOwnerHostSportId] = useState('football');
  const [ownerHostPlayers, setOwnerHostPlayers] = useState(10);
  const [ownerHostCost, setOwnerHostCost] = useState(150);
  const [ownerHostSkill, setOwnerHostSkill] = useState('All Levels');
  const [ownerHostRules, setOwnerHostRules] = useState('Turf shoes only. Bibs and match ball provided by arena.');
  const [isPublishingOwnerGame, setIsPublishingOwnerGame] = useState(false);

  // Accept Full-Time Inquiry on a Slot (e.g. 6/8 players)
  function handleOpenInquiryModal(slot) {
    setInquirySlot(slot);
    setInquiryClientName(slot.full_inquiry_client || 'Bangalore Tech League / Corporate FC');
    setInquiryClientPhone(slot.full_inquiry_phone || '+91 98800 12345');
    setInquiryAmount(slot.full_inquiry_amount || slot.price || 1600);
    setInquiryPaymentMode('cash');
    setInquiryNotes(slot.full_inquiry_notes || 'Private team reservation inquiry approved by owner');
    setShowInquiryModal(true);
  }

  async function handleDeclineInquiry(slot) {
    if (!window.confirm(`Decline full slot booking request for ${slot.full_inquiry_client || 'client'}? The slot will remain open for individual pickup players.`)) return;
    try {
      await api.declineSlotInquiry(slot.id);
      alert('Full slot request declined.');
      if (selectedVenue) loadLiveSlots(selectedVenue.id, calendarDate);
    } catch (err) {
      alert('Failed to decline inquiry: ' + err.message);
    }
  }

  function handleOpenOwnerHostModal(slot) {
    setOwnerHostSlot(slot);
    setOwnerHostTitle(`Open Pickup Match - ${selectedVenue?.name || 'Arena'}`);
    setOwnerHostSportId(slot.sport_id || 'football');
    setOwnerHostPlayers(10);
    setOwnerHostCost(Math.ceil((slot.price || 1200) / 10));
    setOwnerHostSkill('All Levels');
    setOwnerHostRules('Turf shoes only. Bibs and match ball provided by arena.');
    setShowOwnerHostModal(true);
  }

  async function handleOwnerHostSubmit(e) {
    e.preventDefault();
    if (!ownerHostSlot || !selectedVenue) return;
    try {
      setIsPublishingOwnerGame(true);
      await api.createGame({
        venueId: selectedVenue.id,
        courtId: ownerHostSlot.court_id,
        courtSlotId: ownerHostSlot.id,
        sportId: ownerHostSportId,
        title: ownerHostTitle.trim() || `Community Open Match - ${selectedVenue.name}`,
        organizerName: (selectedVenue.name || 'Arena') + ' Staff',
        organizerPhone: bizPhone || '+91 98765 00000',
        skillLevel: ownerHostSkill,
        requiredPlayers: Number(ownerHostPlayers),
        costPerPlayer: Number(ownerHostCost),
        date: ownerHostSlot.date,
        startTime: ownerHostSlot.start_time,
        endTime: ownerHostSlot.end_time,
        rules: ownerHostRules
      });
      setShowOwnerHostModal(false);
      alert(`🎉 Open game session posted on ${ownerHostSlot.court_name} (${ownerHostSlot.start_time} - ${ownerHostSlot.end_time})! Players can now discover and join.`);
      loadLiveSlots(selectedVenue.id, calendarDate);
    } catch (err) {
      alert('Failed to host open game: ' + err.message);
    } finally {
      setIsPublishingOwnerGame(false);
    }
  }

  async function handleConfirmFullInquiry(e) {
    e.preventDefault();
    if (!inquirySlot) return;

    try {
      setSubmittingInquiry(true);
      const res = await api.convertSlotToFullInquiry(inquirySlot.id, {
        clientName: inquiryClientName.trim(),
        clientPhone: inquiryClientPhone.trim(),
        amount: Number(inquiryAmount),
        paymentMode: inquiryPaymentMode,
        notes: inquiryNotes.trim()
      });

      setShowInquiryModal(false);
      alert(`✅ ${res.message || 'Full-time inquiry accepted!'}`);
      if (selectedVenue) {
        loadLiveSlots(selectedVenue.id, calendarDate);
        api.getOwnerBookings({ venueId: selectedVenue.id }).then(setBookings);
      }
    } catch (err) {
      alert('Error accepting inquiry: ' + err.message);
    } finally {
      setSubmittingInquiry(false);
    }
  }

  // Quick Price adjustment
  async function handleSavePrice(e) {
    e.preventDefault();
    if (!editingPriceSlot) return;
    try {
      await api.updateSlotPrice(editingPriceSlot.id, Number(newPriceValue));
      setEditingPriceSlot(null);
      if (selectedVenue) {
        loadLiveSlots(selectedVenue.id, calendarDate);
      }
    } catch (err) {
      alert('Failed to update price: ' + err.message);
    }
  }

  // Slot block & walkin handlers
  async function handleBlockSlotSubmit(e) {
    e.preventDefault();
    try {
      await api.blockSlot({
        courtId: blockCourtId || selectedVenue.courts?.[0]?.id,
        date: blockDate,
        startTime: blockStartTime,
        reason: blockReason
      });
      setShowBlockModal(false);
      if (selectedVenue) loadLiveSlots(selectedVenue.id, calendarDate);
      alert('Slot blocked for maintenance successfully.');
    } catch (err) {
      alert('Failed to block slot: ' + err.message);
    }
  }

  async function handleWalkInSubmit(e) {
    e.preventDefault();
    try {
      await api.createWalkInBooking({
        courtId: walkInCourtId || selectedVenue.courts?.[0]?.id,
        date: walkInDate,
        startTime: walkInStartTime,
        customerName: walkInCustomerName,
        customerPhone: walkInCustomerPhone,
        totalAmount: Number(walkInAmount),
        paymentMode: walkInPaymentMode
      });
      setShowWalkInModal(false);
      if (selectedVenue) {
        loadLiveSlots(selectedVenue.id, calendarDate);
        api.getOwnerBookings({ venueId: selectedVenue.id }).then(setBookings);
      }
      alert('Walk-in booking confirmed.');
    } catch (err) {
      alert('Failed to create walk-in: ' + err.message);
    }
  }

  async function handleVerifyUpi(bookingId) {
    try {
      await api.verifyUpiPayment(bookingId, { action: 'verify_credit' });
      await loadData(selectedVenue?.id);
      alert('✅ UPI Payment verified as credited! Customer notified and booking confirmed.');
    } catch (err) {
      alert('Verification failed: ' + err.message);
    }
  }

  async function handleRejectUpi(bookingId) {
    const reason = prompt('Reason for rejection:', 'Payment not received in owner UPI bank account');
    if (reason === null) return;
    try {
      await api.verifyUpiPayment(bookingId, { action: 'reject', notes: reason });
      await loadData(selectedVenue?.id);
      alert('❌ Booking rejected and slot released back to open.');
    } catch (err) {
      alert('Rejection failed: ' + err.message);
    }
  }

  async function refreshBookings() {
    if (selectedVenue) {
      const bData = await api.getOwnerBookings({ venueId: selectedVenue.id }).catch(() => null);
      if (bData) setBookings(bData);
    }
  }

  async function handleCancelBooking(booking) {
    if (!window.confirm(`Cancel the booking for ${booking.customer_name || 'this customer'} on ${booking.date} at ${booking.start_time}? The slot will reopen for other players.`)) return;
    try {
      await api.updateBookingAction(booking.id, { action: 'cancel' });
      await refreshBookings();
      if (selectedVenue) loadLiveSlots(selectedVenue.id, calendarDate);
    } catch (err) {
      alert('Failed to cancel booking: ' + err.message);
    }
  }

  async function handleMarkCashPaid(booking) {
    try {
      await api.updateBookingAction(booking.id, { action: 'mark_cash_paid' });
      await refreshBookings();
    } catch (err) {
      alert('Failed to mark cash payment: ' + err.message);
    }
  }

  function handleOpenReschedule(booking) {
    setRescheduleBooking(booking);
    setRescheduleDate(booking.date);
    setRescheduleStartTime(booking.start_time);
    setRescheduleEndTime(booking.end_time);
    setShowRescheduleModal(true);
  }

  async function handleRescheduleSubmit(e) {
    e.preventDefault();
    if (!rescheduleBooking) return;
    setSubmittingReschedule(true);
    try {
      await api.updateBookingAction(rescheduleBooking.id, {
        action: 'reschedule',
        newDate: rescheduleDate,
        newStartTime: rescheduleStartTime,
        newEndTime: rescheduleEndTime
      });
      setShowRescheduleModal(false);
      await refreshBookings();
      if (selectedVenue) loadLiveSlots(selectedVenue.id, calendarDate);
    } catch (err) {
      alert('Failed to reschedule booking: ' + err.message);
    } finally {
      setSubmittingReschedule(false);
    }
  }

  function handleCopyUniqueTurfLink() {
    if (!selectedVenue) return;
    const url = `${window.location.origin}/?venue=${selectedVenue.slug || selectedVenue.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  }

  const uniqueTurfUrl = selectedVenue ? `${window.location.origin}/?venue=${selectedVenue.slug || selectedVenue.id}` : '';

  // Filter live slots by court
  const displaySlots = liveSlots.filter(s => {
    if (courtFilter === 'all') return true;
    return s.court_id === courtFilter;
  });

  if (loading && !selectedVenue) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading Turf Management System...
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1280, margin: '0 auto', padding: '16px 16px 80px' }}>
      
      {/* VENUE UNIQUE LINK & SWITCHER BANNER */}
      {selectedVenue && (
        <div
          className="nexus-card mobile-stack"
          style={{
            padding: '16px 20px',
            marginBottom: 20,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', flexShrink: 0 }}>
              <Building size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="badge-emerald" style={{ fontSize: 10, padding: '2px 8px' }}>
                  ACTIVE ARENA
                </span>
                {venues.length > 1 && (
                  <select
                    value={selectedVenue.id}
                    onChange={e => handleVenueChange(e.target.value)}
                    style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', padding: '3px 8px', borderRadius: 6, fontSize: 12, outline: 'none' }}
                  >
                    {venues.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <h2 className="font-display" style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '3px 0 0 0' }}>
                {selectedVenue.name}
              </h2>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {selectedVenue.address} · UPI: <strong style={{ color: '#0f172a' }}>{selectedVenue.upi_id}</strong>
              </div>
            </div>
          </div>

          {/* Unique Turf Booking Link Controls */}
          <div className="mobile-btn-group" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ background: '#f8fafc', padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 auto', minWidth: 160 }}>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Link:</span>
              <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#2563eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                /?venue={selectedVenue.slug}
              </span>
            </div>

            <button
              onClick={handleCopyUniqueTurfLink}
              className="btn-primary"
              style={{ fontSize: 12, padding: '7px 12px', flex: '1 1 auto' }}
            >
              {copiedLink ? <Check size={14} /> : <Copy size={14} />}
              {copiedLink ? 'Copied' : 'Copy Link'}
            </button>

            <button
              onClick={() => onNavigateToPublicPage(selectedVenue.slug)}
              className="btn-secondary"
              style={{ fontSize: 12, padding: '7px 12px', flex: '1 1 auto' }}
            >
              <ExternalLink size={14} /> View Page
            </button>

            <button
              onClick={() => setShowQrModal(true)}
              className="btn-secondary"
              title="Show QR Code"
              style={{ fontSize: 12, padding: '7px 10px' }}
            >
              <QrCode size={15} />
            </button>
          </div>
        </div>
      )}

      {/* NAVIGATION TABS (TOUCH-FRIENDLY HORIZONTAL SCROLL) */}
      <div className="scroll-pills" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 12, marginBottom: 22, display: 'flex', gap: 8, overflowX: 'auto' }}>
        <button
          onClick={() => setActiveTab('live_slots')}
          style={{
            height: 40,
            background: activeTab === 'live_slots' ? '#059669' : '#ffffff',
            color: activeTab === 'live_slots' ? '#ffffff' : '#334155',
            border: activeTab === 'live_slots' ? '1px solid #059669' : '1px solid #cbd5e1',
            borderRadius: 10,
            padding: '0 16px',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            whiteSpace: 'nowrap',
            boxShadow: activeTab === 'live_slots' ? '0 2px 5px rgba(5,150,105,0.2)' : '0 1px 2px rgba(0,0,0,0.03)',
            transition: 'all 0.15s ease'
          }}
        >
          <Calendar size={15} /> Live Slots & Calendar
        </button>

        <button
          onClick={() => setActiveTab('dashboard')}
          style={{
            height: 40,
            background: activeTab === 'dashboard' ? '#059669' : '#ffffff',
            color: activeTab === 'dashboard' ? '#ffffff' : '#334155',
            border: activeTab === 'dashboard' ? '1px solid #059669' : '1px solid #cbd5e1',
            borderRadius: 10,
            padding: '0 16px',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            whiteSpace: 'nowrap',
            boxShadow: activeTab === 'dashboard' ? '0 2px 5px rgba(5,150,105,0.2)' : '0 1px 2px rgba(0,0,0,0.03)',
            transition: 'all 0.15s ease'
          }}
        >
          <LayoutDashboard size={15} /> Overview & Analytics
        </button>

        <button
          onClick={() => setActiveTab('upi_verification')}
          style={{
            height: 40,
            background: activeTab === 'upi_verification' ? '#059669' : '#ffffff',
            color: activeTab === 'upi_verification' ? '#ffffff' : '#334155',
            border: activeTab === 'upi_verification' ? '1px solid #059669' : '1px solid #cbd5e1',
            borderRadius: 10,
            padding: '0 16px',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            position: 'relative',
            whiteSpace: 'nowrap',
            boxShadow: activeTab === 'upi_verification' ? '0 2px 5px rgba(5,150,105,0.2)' : '0 1px 2px rgba(0,0,0,0.03)',
            transition: 'all 0.15s ease'
          }}
        >
          <ShieldCheck size={15} /> UPI Direct Audit
          {pendingUpiBookings.length > 0 && (
            <span style={{ 
              background: activeTab === 'upi_verification' ? '#ffffff' : '#f59e0b', 
              color: activeTab === 'upi_verification' ? '#059669' : '#000', 
              fontSize: 10, 
              fontWeight: 800, 
              padding: '1px 6px', 
              borderRadius: 999 
            }}>
              {pendingUpiBookings.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('courts')}
          style={{
            height: 40,
            background: activeTab === 'courts' ? '#059669' : '#ffffff',
            color: activeTab === 'courts' ? '#ffffff' : '#334155',
            border: activeTab === 'courts' ? '1px solid #059669' : '1px solid #cbd5e1',
            borderRadius: 10,
            padding: '0 16px',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            whiteSpace: 'nowrap',
            boxShadow: activeTab === 'courts' ? '0 2px 5px rgba(5,150,105,0.2)' : '0 1px 2px rgba(0,0,0,0.03)',
            transition: 'all 0.15s ease'
          }}
        >
          <Settings size={15} /> Courts & Rates
        </button>

        <button
          onClick={() => setActiveTab('crm')}
          style={{
            height: 40,
            background: activeTab === 'crm' ? '#059669' : '#ffffff',
            color: activeTab === 'crm' ? '#ffffff' : '#334155',
            border: activeTab === 'crm' ? '1px solid #059669' : '1px solid #cbd5e1',
            borderRadius: 10,
            padding: '0 16px',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            whiteSpace: 'nowrap',
            boxShadow: activeTab === 'crm' ? '0 2px 5px rgba(5,150,105,0.2)' : '0 1px 2px rgba(0,0,0,0.03)',
            transition: 'all 0.15s ease'
          }}
        >
          <Users size={15} /> Customer CRM
        </button>

        <button
          onClick={() => setActiveTab('business_setup')}
          style={{
            height: 40,
            background: activeTab === 'business_setup' ? '#059669' : '#ffffff',
            color: activeTab === 'business_setup' ? '#ffffff' : '#334155',
            border: activeTab === 'business_setup' ? '1px solid #059669' : '1px solid #cbd5e1',
            borderRadius: 10,
            padding: '0 16px',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            whiteSpace: 'nowrap',
            boxShadow: activeTab === 'business_setup' ? '0 2px 5px rgba(5,150,105,0.2)' : '0 1px 2px rgba(0,0,0,0.03)',
            transition: 'all 0.15s ease'
          }}
        >
          <Building size={15} /> Business Setup
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB: LIVE SLOTS & INTERACTIVE CALENDAR (WITH FULL TIME INQUIRY CONVERSION) */}
      {/* ========================================================================= */}
      {activeTab === 'live_slots' && (
        <div className="animate-fade-in">
          {/* Calendar Controls Header */}
          <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div>
              <h2 className="font-display" style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Live Slot Control & Calendar Grid
              </h2>
              <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0' }}>
                Manage live slot statuses, edit rates set by owner, and accept full-time inquiries on partially registered slots.
              </p>
            </div>

            {/* View Mode Switcher (Cards vs Table) */}
            <div style={{ display: 'flex', background: '#f8fafc', padding: 3, borderRadius: 8, border: '1px solid #e2e8f0', gap: 3 }}>
              <button
                onClick={() => setSlotViewMode('cards')}
                style={{
                  background: slotViewMode === 'cards' ? '#ffffff' : 'transparent',
                  color: slotViewMode === 'cards' ? '#059669' : '#64748b',
                  border: slotViewMode === 'cards' ? '1px solid #cbd5e1' : '1px solid transparent',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5
                }}
              >
                <LayoutDashboard size={13} /> Cards View
              </button>
              <button
                onClick={() => setSlotViewMode('table')}
                style={{
                  background: slotViewMode === 'table' ? '#ffffff' : 'transparent',
                  color: slotViewMode === 'table' ? '#059669' : '#64748b',
                  border: slotViewMode === 'table' ? '1px solid #cbd5e1' : '1px solid transparent',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5
                }}
              >
                <Calendar size={13} /> Table View
              </button>
            </div>
          </div>

          {/* Quick Date Chips (Touch-Friendly Horizontal Scroll) */}
          <div className="scroll-pills" style={{ marginBottom: 16 }}>
            {[0, 1, 2, 3, 4, 5, 6].map(offset => {
              const d = new Date();
              d.setDate(d.getDate() + offset);
              const dateStr = d.toISOString().slice(0, 10);
              const isSelected = calendarDate === dateStr;
              const label = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
              return (
                <button
                  key={dateStr}
                  onClick={() => handleDateChange(dateStr)}
                  style={{
                    background: isSelected ? '#059669' : '#ffffff',
                    color: isSelected ? '#ffffff' : '#334155',
                    border: isSelected ? '1px solid #059669' : '1px solid #cbd5e1',
                    borderRadius: 999,
                    padding: '7px 16px',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Filter & Action Bar */}
          <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: 1 }}>
              <input
                type="date"
                value={calendarDate}
                onChange={e => handleDateChange(e.target.value)}
                className="nexus-input"
                style={{ padding: '7px 12px', fontSize: 13 }}
              />

              <select
                value={courtFilter}
                onChange={e => setCourtFilter(e.target.value)}
                className="nexus-input"
                style={{ padding: '7px 12px', fontSize: 13 }}
              >
                <option value="all">All Courts ({selectedVenue?.courts?.length || 0})</option>
                {selectedVenue?.courts?.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <button
                onClick={() => selectedVenue && loadLiveSlots(selectedVenue.id, calendarDate)}
                className="btn-secondary"
                style={{ fontSize: 12, padding: '7px 12px' }}
                title="Refresh Slots"
              >
                <RefreshCw size={13} />
              </button>
            </div>

            <div className="mobile-btn-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                id="btn-owner-host-open-game"
                onClick={() => {
                  const firstOpen = displaySlots.find(s => s.status === 'open' && !s.game) || displaySlots[0];
                  if (firstOpen) {
                    handleOpenOwnerHostModal(firstOpen);
                  } else {
                    alert('No open slots found on this date. Please pick another date or clear booked slots.');
                  }
                }}
                className="btn-primary"
                style={{ background: '#059669', fontSize: 12.5, padding: '7px 14px', flex: '1 1 auto', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Trophy size={14} /> Host Open Game
              </button>

              <button
                onClick={() => setShowWalkInModal(true)}
                className="btn-primary"
                style={{ fontSize: 12.5, padding: '7px 14px', flex: '1 1 auto' }}
              >
                <Plus size={14} /> Walk-in Booking
              </button>

              <button
                onClick={() => setShowBlockModal(true)}
                className="btn-secondary"
                style={{ fontSize: 12.5, padding: '7px 14px', flex: '1 1 auto' }}
              >
                <Lock size={14} /> Block Slot
              </button>
            </div>
          </div>

          {/* Dedicated Alert Banner for Full Slot Booking Requests */}
          {(() => {
            const pendingInquirySlots = displaySlots.filter(s => s.full_inquiry_status === 'pending' || (s.game && s.game.full_inquiry_status === 'pending'));
            if (pendingInquirySlots.length === 0) return null;
            return (
              <div style={{ background: '#fffbeb', border: '2px solid #f59e0b', borderRadius: 12, padding: '14px 16px', marginBottom: 20, color: '#78350f' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14 }}>
                    <span style={{ fontSize: 18 }}>🚨</span>
                    <span>{pendingInquirySlots.length} Pending Full-Slot Booking Request(s)</span>
                  </div>
                  <span style={{ fontSize: 11.5, background: '#fef3c7', padding: '2px 8px', borderRadius: 6, fontWeight: 700, border: '1px solid #fde68a' }}>
                    Action Required
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pendingInquirySlots.map(pSlot => (
                    <div key={pSlot.id} style={{ background: '#ffffff', border: '1px solid #fde68a', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0f172a' }}>
                          {pSlot.court_name} · {pSlot.start_time} - {pSlot.end_time} ({pSlot.date})
                        </div>
                        <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                          Client: <strong>{pSlot.full_inquiry_client || pSlot.game?.full_inquiry_client || 'Squad Leader'}</strong> ({pSlot.full_inquiry_phone || pSlot.game?.full_inquiry_phone || ''}) · Total: <strong>₹{pSlot.full_inquiry_amount || pSlot.price}</strong>
                        </div>
                        <div style={{ fontSize: 11.5, color: '#15803d', marginTop: 3 }}>
                          💬 Accepting triggers instant automated WhatsApp 100% refund notification to all {pSlot.game?.current_players || 0} registered pickup player(s).
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn-primary"
                          onClick={() => handleOpenInquiryModal(pSlot)}
                          style={{ background: '#059669', fontSize: 12, padding: '7px 14px' }}
                        >
                          ✓ Accept Full Booking
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => handleDeclineInquiry(pSlot)}
                          style={{ fontSize: 12, padding: '7px 12px', color: '#dc2626' }}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Quick Slot Stats Pills (Responsive 2-col on mobile, 4-col on desktop) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div className="nexus-card" style={{ padding: '12px 14px', borderLeft: '3px solid #10b981' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Available Open</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#059669', marginTop: 2 }}>
                {displaySlots.filter(s => s.status === 'open' && !s.game).length}
              </div>
            </div>

            <div className="nexus-card" style={{ padding: '12px 14px', borderLeft: '3px solid #f59e0b' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pickup Games Active</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#fbbf24', marginTop: 2 }}>
                {displaySlots.filter(s => !!s.game).length}
              </div>
            </div>

            <div className="nexus-card" style={{ padding: '12px 14px', borderLeft: '3px solid #6366f1' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Confirmed Bookings</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#4f46e5', marginTop: 2 }}>
                {displaySlots.filter(s => s.status === 'booked').length}
              </div>
            </div>

            <div className="nexus-card" style={{ padding: '12px 14px', borderLeft: '3px solid #64748b' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Maintenance Blocked</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                {displaySlots.filter(s => s.status === 'blocked' || s.status === 'maintenance').length}
              </div>
            </div>
          </div>

          {loadingSlots ? (
            <div className="nexus-card" style={{ padding: 50, textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px', color: '#10b981' }} />
              <div>Loading live slots for {calendarDate}...</div>
            </div>
          ) : displaySlots.length === 0 ? (
            <div className="nexus-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Calendar size={32} style={{ margin: '0 auto 10px', color: '#64748b' }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>No slots scheduled for this date</div>
              <div style={{ fontSize: 12.5, marginTop: 4 }}>Slots are automatically generated according to court operating hours.</div>
            </div>
          ) : slotViewMode === 'cards' ? (
            /* ========================================================================= */
            /* RESPONSIVE MOBILE-FIRST SLOT CARD GRID                                     */
            /* ========================================================================= */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 14 }}>
              {displaySlots.map(slot => {
                const hasGame = !!slot.game;
                const registeredCount = slot.game?.current_players || 0;
                const requiredCount = slot.game?.required_players || slot.court_capacity || 8;
                const isPartiallyFilled = hasGame && registeredCount > 0;
                const isBooked = slot.status === 'booked';
                const isBlocked = slot.status === 'blocked' || slot.status === 'maintenance';
                const spotsRemaining = Math.max(0, requiredCount - registeredCount);

                return (
                  <div
                    key={slot.id}
                    className="nexus-card"
                    style={{
                      padding: 16,
                      background: isPartiallyFilled
                        ? '#fffbeb'
                        : isBooked
                        ? '#eef2ff'
                        : isBlocked
                        ? '#f1f5f9'
                        : '#ffffff',
                      border: isPartiallyFilled
                        ? '1px solid rgba(245, 158, 11, 0.4)'
                        : isBooked
                        ? '1px solid rgba(99, 102, 241, 0.35)'
                        : isBlocked
                        ? '1px solid var(--border-card)'
                        : '1px solid rgba(16, 185, 129, 0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 12,
                      position: 'relative'
                    }}
                  >
                    {/* Card Top: Time & Court Badges */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                            {slot.start_time} - {slot.end_time}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            {slot.court_name} · <span style={{ textTransform: 'capitalize' }}>{slot.sport_id}</span>
                          </div>
                        </div>

                        {/* Price Badge with quick edit */}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: 16, fontWeight: 800, color: '#059669' }}>
                              ₹{slot.price}
                            </span>
                            <button
                              onClick={() => {
                                setEditingPriceSlot(slot);
                                setNewPriceValue(slot.price);
                              }}
                              title="Set Slot Price"
                              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                            >
                              <Edit3 size={13} />
                            </button>
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Set by Owner</div>
                        </div>
                      </div>

                      {/* Status / Player Count Details */}
                      {isPartiallyFilled ? (
                        <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: 10, borderRadius: 8, border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span className="badge-amber" style={{ fontSize: 11 }}>
                              <Users size={12} /> {registeredCount} of {requiredCount} Players Joined
                            </span>
                            <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>
                              {spotsRemaining} spots left
                            </span>
                          </div>

                          {/* Visual Progress Bar */}
                          <div style={{ background: '#fde8c4', borderRadius: 999, height: 6, overflow: 'hidden', marginBottom: 6 }}>
                            <div
                              style={{
                                width: `${Math.min(100, (registeredCount / requiredCount) * 100)}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                                borderRadius: 999
                              }}
                            />
                          </div>

                          <div style={{ fontSize: 11.5, color: '#78350f' }}>
                            {slot.game.title || 'Pickup Match'} · Paid ₹{registeredCount * (slot.game.cost_per_player || 250)}
                          </div>

                          {/* Joined player badges */}
                          {slot.game.participants && slot.game.participants.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                              {slot.game.participants.map((p, idx) => (
                                <span key={idx} style={{ background: '#fff', color: '#92400e', border: '1px solid #fde68a', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>
                                  {p.name.split(' ')[0]}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : isBooked ? (
                        <div style={{ background: 'rgba(99, 102, 241, 0.08)', padding: 10, borderRadius: 8, border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span className="badge-indigo" style={{ fontSize: 11 }}>
                              <CheckCircle size={11} /> {slot.booking?.source === 'full_time_inquiry' ? 'Full Turf Inquiry' : 'Confirmed Booking'}
                            </span>
                          </div>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>
                            {slot.full_inquiry_client || slot.booking?.customer_name || 'Booked Client'}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                            {slot.full_inquiry_phone || slot.booking?.customer_phone || ''}
                          </div>
                        </div>
                      ) : isBlocked ? (
                        <div style={{ background: 'rgba(100, 116, 139, 0.08)', padding: 10, borderRadius: 8, border: '1px solid rgba(100, 116, 139, 0.2)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="badge-slate" style={{ fontSize: 11 }}>
                              <Lock size={11} /> Slot Blocked
                            </span>
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                            {slot.block_reason || 'Maintenance inspection'}
                          </div>
                        </div>
                      ) : (
                        <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: 10, borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="badge-emerald" style={{ fontSize: 11 }}>
                              <Check size={11} /> Open for Booking
                            </span>
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                            Ready for individual registration or full arena reservation.
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card Actions: Full Time Inquiry & Slot Operations */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
                      {/* PENDING FULL SLOT BOOKING INQUIRY ALERT (IF REQUESTED BY PLAYER) */}
                      {(slot.full_inquiry_status === 'pending' || slot.game?.full_inquiry_status === 'pending') && (
                        <div style={{ background: '#fef3c7', border: '1.5px solid #f59e0b', borderRadius: 8, padding: 10, marginBottom: 4, color: '#78350f' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 12 }}>
                            <span>🚨</span> Full Slot Booking Requested!
                          </div>
                          <div style={{ fontSize: 11.5, marginTop: 4, color: '#92400e', lineHeight: 1.4 }}>
                            <strong>{slot.full_inquiry_client || slot.game?.full_inquiry_client || 'Team Organizer'}</strong> wants this full slot for <strong>₹{slot.full_inquiry_amount || slot.price}</strong>.
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            <button
                              onClick={() => handleOpenInquiryModal(slot)}
                              style={{ flex: 1.5, background: '#059669', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 8px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                            >
                              ✓ Accept & Refund
                            </button>
                            <button
                              onClick={() => handleDeclineInquiry(slot)}
                              style={{ flex: 0.8, background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, padding: '7px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      )}

                      {/* USER DIRECT REQUIREMENT: FULL TIME INQUIRY ACCEPTANCE */}
                      {isPartiallyFilled && slot.full_inquiry_status !== 'pending' && !slot.game?.full_inquiry_status && (
                        <button
                          onClick={() => handleOpenInquiryModal(slot)}
                          style={{
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: 8,
                            padding: '10px 14px',
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
                            minHeight: 42
                          }}
                        >
                          <Sparkles size={14} /> Accept Full-Time Inquiry
                        </button>
                      )}

                      {!isBooked && !isPartiallyFilled && !isBlocked && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleOpenOwnerHostModal(slot)}
                            style={{
                              flex: '1 1 45%',
                              background: '#059669',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              padding: '7px 8px',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 4
                            }}
                            title="Host open pickup match on this slot"
                          >
                            <Trophy size={12} /> Host Game
                          </button>

                          <button
                            onClick={() => handleOpenInquiryModal(slot)}
                            style={{
                              flex: '1 1 45%',
                              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              padding: '7px 8px',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 4
                            }}
                          >
                            <Sparkles size={12} /> Full Inquiry
                          </button>

                          <button
                            onClick={() => {
                              setWalkInCourtId(slot.court_id);
                              setWalkInDate(slot.date);
                              setWalkInStartTime(slot.start_time);
                              setWalkInAmount(slot.price);
                              setShowWalkInModal(true);
                            }}
                            className="btn-secondary"
                            style={{ flex: 1, fontSize: 11, padding: '7px 8px', justifyContent: 'center' }}
                          >
                            Walk-in
                          </button>

                          <button
                            onClick={() => {
                              setBlockCourtId(slot.court_id);
                              setBlockDate(slot.date);
                              setBlockStartTime(slot.start_time);
                              setShowBlockModal(true);
                            }}
                            style={{ background: '#f1f5f9', border: '1px solid var(--border-card)', color: '#475569', borderRadius: 6, padding: '7px 10px', fontSize: 11.5, cursor: 'pointer' }}
                          >
                            Block
                          </button>
                        </div>
                      )}

                      {isBlocked && (
                        <button
                          onClick={async () => {
                            await api.unblockSlot({ courtId: slot.court_id, date: slot.date, startTime: slot.start_time });
                            if (selectedVenue) loadLiveSlots(selectedVenue.id, calendarDate);
                          }}
                          className="btn-secondary"
                          style={{ fontSize: 12, padding: '7px 12px', justifyContent: 'center', width: '100%' }}
                        >
                          Unblock Slot
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ========================================================================= */
            /* DESKTOP TABLE VIEW WITH SMOOTH TOUCH SCROLLING                             */
            /* ========================================================================= */
            <div className="nexus-card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-card)', color: 'var(--text-muted)', fontSize: 11.5 }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>TIME & COURT</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>STATUS</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>PLAYER / CLIENT DETAILS</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>OWNER PRICE</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displaySlots.map(slot => {
                      const hasGame = !!slot.game;
                      const registeredCount = slot.game?.current_players || 0;
                      const requiredCount = slot.game?.required_players || slot.court_capacity || 8;
                      const isPartiallyFilled = hasGame && registeredCount > 0;
                      const isBooked = slot.status === 'booked';
                      const isBlocked = slot.status === 'blocked' || slot.status === 'maintenance';

                      return (
                        <tr
                          key={slot.id}
                          style={{
                            borderBottom: '1px solid var(--border-card)',
                            background: isPartiallyFilled ? 'rgba(245, 158, 11, 0.04)' : isBooked ? 'rgba(99, 102, 241, 0.04)' : 'transparent'
                          }}
                        >
                          {/* Time & Court */}
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>
                              {slot.start_time} - {slot.end_time}
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                              {slot.court_name} · <span style={{ textTransform: 'capitalize' }}>{slot.sport_id}</span>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td style={{ padding: '12px 16px' }}>
                            {isPartiallyFilled ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
                                <span className="badge-amber" style={{ fontSize: 11 }}>
                                  <Users size={11} /> {registeredCount}/{requiredCount} Players Joined
                                </span>
                                <span style={{ fontSize: 10.5, color: '#f59e0b' }}>
                                  Pickup Match Active
                                </span>
                              </div>
                            ) : isBooked ? (
                              <span className="badge-indigo" style={{ fontSize: 11 }}>
                                Booked {slot.booking?.source === 'full_time_inquiry' ? '· Full Inquiry' : ''}
                              </span>
                            ) : isBlocked ? (
                              <span className="badge-slate" style={{ fontSize: 11 }}>
                                <Lock size={10} /> Blocked
                              </span>
                            ) : (
                              <span className="badge-emerald" style={{ fontSize: 11 }}>
                                Open for Booking
                              </span>
                            )}
                          </td>

                          {/* Player / Client Details */}
                          <td style={{ padding: '12px 16px' }}>
                            {isPartiallyFilled ? (
                              <div>
                                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 12.5 }}>
                                  {slot.game.title || 'Open Game'}
                                </div>
                                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                                  {registeredCount} players paid ₹{slot.game.cost_per_player}/spot
                                </div>
                              </div>
                            ) : isBooked ? (
                              <div>
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>
                                  {slot.full_inquiry_client || slot.booking?.customer_name || 'Booked Customer'}
                                </div>
                                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                                  {slot.full_inquiry_phone || slot.booking?.customer_phone || ''}
                                </div>
                              </div>
                            ) : isBlocked ? (
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                {slot.block_reason || 'Maintenance & ground inspection'}
                              </div>
                            ) : (
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Open for direct reservations.
                              </div>
                            )}
                          </td>

                          {/* Owner Price */}
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <strong style={{ fontSize: 14, color: '#059669' }}>
                                ₹{slot.price}
                              </strong>
                              <button
                                onClick={() => {
                                  setEditingPriceSlot(slot);
                                  setNewPriceValue(slot.price);
                                }}
                                title="Adjust Slot Price"
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                              >
                                <Edit3 size={12} />
                              </button>
                            </div>
                            <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                              Set by Owner
                            </div>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              {isPartiallyFilled && (
                                <button
                                  onClick={() => handleOpenInquiryModal(slot)}
                                  style={{
                                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '6px 12px',
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
                                  }}
                                >
                                  <Sparkles size={12} /> Accept Full Inquiry
                                </button>
                              )}

                              {!isBooked && !isPartiallyFilled && !isBlocked && (
                                <>
                                  <button
                                    onClick={() => handleOpenInquiryModal(slot)}
                                    style={{
                                      background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: 6,
                                      padding: '5px 10px',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Full Inquiry
                                  </button>
                                  <button
                                    onClick={() => {
                                      setWalkInCourtId(slot.court_id);
                                      setWalkInDate(slot.date);
                                      setWalkInStartTime(slot.start_time);
                                      setWalkInAmount(slot.price);
                                      setShowWalkInModal(true);
                                    }}
                                    className="btn-secondary"
                                    style={{ fontSize: 11, padding: '4px 8px' }}
                                  >
                                    Walk-in
                                  </button>
                                  <button
                                    onClick={() => {
                                      setBlockCourtId(slot.court_id);
                                      setBlockDate(slot.date);
                                      setBlockStartTime(slot.start_time);
                                      setShowBlockModal(true);
                                    }}
                                    style={{ background: '#f1f5f9', border: '1px solid var(--border-card)', color: '#475569', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}
                                  >
                                    Block
                                  </button>
                                </>
                              )}

                              {isBlocked && (
                                <button
                                  onClick={async () => {
                                    await api.unblockSlot({ courtId: slot.court_id, date: slot.date, startTime: slot.start_time });
                                    if (selectedVenue) loadLiveSlots(selectedVenue.id, calendarDate);
                                  }}
                                  className="btn-secondary"
                                  style={{ fontSize: 11, padding: '4px 8px' }}
                                >
                                  Unblock
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: BUSINESS SETUP (BUSINESS DETAILS, GSTIN, LOCATION, RULES, HOURS) */}
      {/* ========================================================================= */}
      {activeTab === 'business_setup' && (
        <div className="animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
            <div>
              <h2 className="font-display" style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Venue & Business Configuration
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Set up all your business registration, contact details, ground coordinates, and operational policies.
              </p>
            </div>
            
            {bizSuccessMsg && (
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#059669', padding: '8px 14px', borderRadius: 8, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={15} /> {bizSuccessMsg}
              </div>
            )}
          </div>

          <form onSubmit={handleSaveBusinessDetails}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
              
              {/* Card 1: Business Identity & Legal Details */}
              <div className="nexus-card" style={{ padding: 22 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Building size={16} style={{ color: '#10b981' }} />
                  Business & Legal Registration
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                      VENUE / ARENA DISPLAY NAME *
                    </label>
                    <input
                      type="text"
                      required
                      className="nexus-input"
                      style={{ width: '100%' }}
                      value={bizName}
                      onChange={e => setBizName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                      ORGANIZATION / LEGAL ENTITY NAME *
                    </label>
                    <input
                      type="text"
                      required
                      className="nexus-input"
                      style={{ width: '100%' }}
                      value={bizOrgName}
                      onChange={e => setBizOrgName(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                        GSTIN / TAX NUMBER
                      </label>
                      <input
                        type="text"
                        className="nexus-input"
                        style={{ width: '100%' }}
                        value={bizGstin}
                        onChange={e => setBizGstin(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                        BUSINESS STRUCTURE
                      </label>
                      <select
                        className="nexus-input"
                        style={{ width: '100%' }}
                        value={bizType}
                        onChange={e => setBizType(e.target.value)}
                      >
                        <option value="Private Limited Company">Private Limited</option>
                        <option value="Limited Liability Partnership (LLP)">LLP</option>
                        <option value="Sole Proprietorship">Proprietorship</option>
                        <option value="Partnership Firm">Partnership</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                        BUSINESS PHONE *
                      </label>
                      <input
                        type="tel"
                        required
                        className="nexus-input"
                        style={{ width: '100%' }}
                        value={bizPhone}
                        onChange={e => setBizPhone(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                        OFFICIAL EMAIL
                      </label>
                      <input
                        type="email"
                        className="nexus-input"
                        style={{ width: '100%' }}
                        value={bizEmail}
                        onChange={e => setBizEmail(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Physical Address & Geolocation Coordinates */}
              <div className="nexus-card" style={{ padding: 22 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin size={16} style={{ color: '#10b981' }} />
                  Address & GPS Geolocation
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                      FULL STREET ADDRESS *
                    </label>
                    <textarea
                      required
                      rows={2}
                      className="nexus-input"
                      style={{ width: '100%', resize: 'none' }}
                      value={bizAddress}
                      onChange={e => setBizAddress(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                        CITY
                      </label>
                      <input
                        type="text"
                        className="nexus-input"
                        style={{ width: '100%' }}
                        value={bizCity}
                        onChange={e => setBizCity(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                        PINCODE
                      </label>
                      <input
                        type="text"
                        className="nexus-input"
                        style={{ width: '100%' }}
                        value={bizPincode}
                        onChange={e => setBizPincode(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                        LATITUDE (FOR NEARBY SEARCH)
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        className="nexus-input"
                        style={{ width: '100%' }}
                        value={bizLat}
                        onChange={e => setBizLat(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                        LONGITUDE
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        className="nexus-input"
                        style={{ width: '100%' }}
                        value={bizLng}
                        onChange={e => setBizLng(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', background: '#f8fafc', padding: 8, borderRadius: 6 }}>
                    Coordinates enable customer proximity calculation when nearby players search for turfs.
                  </div>
                </div>
              </div>

              {/* Card 3: Operating Hours & Direct UPI Details */}
              <div className="nexus-card" style={{ padding: 22 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={16} style={{ color: '#10b981' }} />
                  Operating Hours & Direct UPI Settlement
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                        OPENING TIME
                      </label>
                      <input
                        type="time"
                        className="nexus-input"
                        style={{ width: '100%' }}
                        value={bizOpenTime}
                        onChange={e => setBizOpenTime(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                        CLOSING TIME
                      </label>
                      <input
                        type="time"
                        className="nexus-input"
                        style={{ width: '100%' }}
                        value={bizCloseTime}
                        onChange={e => setBizCloseTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                      REGISTERED OWNER UPI ID (0% COMMISSION) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. yourturf@okaxis"
                      className="nexus-input"
                      style={{ width: '100%' }}
                      value={bizUpiId}
                      onChange={e => setBizUpiId(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                      PAYEE DISPLAY NAME ON QR
                    </label>
                    <input
                      type="text"
                      className="nexus-input"
                      style={{ width: '100%' }}
                      value={bizUpiName}
                      onChange={e => setBizUpiName(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Card 4: Ground Rules & Cancellation Policy */}
              <div className="nexus-card" style={{ padding: 22 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={16} style={{ color: '#10b981' }} />
                  House Rules & Cancellation Policy
                </h3>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                    GROUND POLICIES & FOOTWEAR REQUIREMENTS
                  </label>
                  <textarea
                    rows={5}
                    className="nexus-input"
                    style={{ width: '100%', resize: 'vertical' }}
                    value={bizRules}
                    onChange={e => setBizRules(e.target.value)}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Shown to players during slot selection and in confirmation SMS / WhatsApp alerts.
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Save Action Bar */}
            <div style={{ marginTop: 22, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                type="submit"
                disabled={savingBiz}
                className="btn-primary"
                style={{ padding: '10px 24px', fontSize: 13.5 }}
              >
                <Save size={15} />
                {savingBiz ? 'Saving Details...' : 'Save All Business Details'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: OVERVIEW & ANALYTICS */}
      {/* ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="animate-fade-in">
          {/* Key Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="nexus-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Revenue</div>
              <div className="font-display" style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginTop: 6 }}>
                ₹{analytics?.totalRevenue?.toLocaleString() || '48,500'}
              </div>
              <div style={{ fontSize: 11.5, color: '#059669', marginTop: 4 }}>
                100% Direct-to-bank settlement
              </div>
            </div>

            <div className="nexus-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Slots Booked</div>
              <div className="font-display" style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginTop: 6 }}>
                {analytics?.totalBookings || bookings.length || '38'}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                Across all courts this month
              </div>
            </div>

            <div className="nexus-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Repeat Customer Rate</div>
              <div className="font-display" style={{ fontSize: 26, fontWeight: 800, color: '#059669', marginTop: 6 }}>
                64%
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                High weekly player retention
              </div>
            </div>

            <div className="nexus-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Gateway Fee Saved</div>
              <div className="font-display" style={{ fontSize: 26, fontWeight: 800, color: '#f59e0b', marginTop: 6 }}>
                ₹{Math.round((analytics?.totalRevenue || 48500) * 0.025).toLocaleString()}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                0% fees via Direct UPI
              </div>
            </div>
          </div>

          {/* Recent Bookings Table */}
          <div className="nexus-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', background: '#f8fafc', borderBottom: '1px solid var(--border-card)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Recent Bookings & Slot Reservations
              </h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-card)', color: 'var(--text-muted)', fontSize: 11.5 }}>
                    <th style={{ padding: '12px 16px' }}>DATE / TIME</th>
                    <th style={{ padding: '12px 16px' }}>COURT</th>
                    <th style={{ padding: '12px 16px' }}>CUSTOMER</th>
                    <th style={{ padding: '12px 16px' }}>AMOUNT</th>
                    <th style={{ padding: '12px 16px' }}>STATUS</th>
                    <th style={{ padding: '12px 16px' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.slice(0, 10).map(b => {
                    const isActive = b.status === 'confirmed' || b.status === 'pending_payment';
                    const needsCashCollection = isActive && (b.payment_status === 'pending' || b.payment_status === 'cash') && b.payment_status !== 'paid';
                    return (
                      <tr key={b.id} style={{ borderBottom: '1px solid var(--border-card)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                          {b.date} · {b.start_time} - {b.end_time}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                          {b.court_name || 'Pro Turf'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{b.customer_name || 'Guest'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.customer_phone}</div>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#059669' }}>
                          ₹{b.total_amount}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className={b.status === 'confirmed' ? 'badge-emerald' : 'badge-slate'} style={{ fontSize: 11 }}>
                            {b.status} {b.payment_mode === 'upi' ? '· UPI' : ''}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {isActive ? (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {needsCashCollection && (
                                <button
                                  onClick={() => handleMarkCashPaid(b)}
                                  title="Mark cash payment received"
                                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#059669', borderRadius: 6, padding: '5px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                                >
                                  Mark Paid
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenReschedule(b)}
                                title="Reschedule to a new date/time"
                                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#4f46e5', borderRadius: 6, padding: '5px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                              >
                                Reschedule
                              </button>
                              <button
                                onClick={() => handleCancelBooking(b)}
                                title="Cancel booking and reopen slot"
                                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: 6, padding: '5px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: UPI DIRECT AUDIT */}
      {/* ========================================================================= */}
      {activeTab === 'upi_verification' && (
        <div className="animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 className="font-display" style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Direct UPI Bank Settlement & UTR Audit Queue
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Verify 12-digit bank UTR numbers for player reservations directly paid to your UPI ID (<strong>{selectedVenue?.upi_id}</strong>).
              </p>
            </div>
          </div>

          {pendingUpiBookings.length === 0 ? (
            <div className="nexus-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <CheckCircle size={36} style={{ color: '#10b981', margin: '0 auto 10px' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>All Caught Up!</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>No pending UPI payments awaiting verification.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              {pendingUpiBookings.map(b => (
                <div key={b.id} className="nexus-card" style={{ padding: 18, borderLeft: '3px solid #f59e0b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{b.customer_name || 'Player'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.customer_phone}</div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#059669' }}>
                      ₹{b.total_amount}
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: 6, margin: '12px 0', fontSize: 12 }}>
                    <div>Slot: <strong>{b.date} · {b.start_time} - {b.end_time}</strong></div>
                    <div>Court: <strong>{b.court_name}</strong></div>
                    <div style={{ color: '#2563eb', fontFamily: 'monospace', marginTop: 2 }}>
                      UTR: {b.upi_utr || 'Pending submission'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleVerifyUpi(b.id)}
                      className="btn-primary"
                      style={{ flex: 2, fontSize: 12, padding: '7px 10px' }}
                    >
                      <Check size={13} /> Verify & Credit
                    </button>
                    <button
                      onClick={() => handleRejectUpi(b.id)}
                      style={{ flex: 1, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: COURTS & TIERED PRICING */}
      {/* ========================================================================= */}
      {activeTab === 'courts' && selectedVenue && (
        <div className="animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 className="font-display" style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Court Inventory & Hourly Rates
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Configure base pricing, peak hours surge, and weekend rates set by owner.
              </p>
            </div>
            <button className="btn-primary" onClick={() => setShowCourtModal(true)}>
              <Plus size={15} /> Add Court / Pitch
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
            {selectedVenue.courts?.map(c => (
              <div key={c.id} className="nexus-card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>{c.name}</h3>
                <div style={{ fontSize: 12, color: '#059669', textTransform: 'capitalize', fontWeight: 600, marginTop: 2, marginBottom: 14 }}>
                  Sport: {c.sport_id} · Capacity: {c.capacity} Players
                </div>

                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid var(--border-card)', marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Base Hourly Rate:</span>
                    <strong style={{ color: '#0f172a' }}>₹{c.base_price}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Peak Hours (18:00 - 22:00):</span>
                    <strong style={{ color: '#f59e0b' }}>₹{c.peak_price || c.base_price}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Weekend Rate:</span>
                    <strong style={{ color: '#059669' }}>₹{c.weekend_price || c.base_price}</strong>
                  </div>
                </div>

                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  Slot Duration: {c.slot_duration_minutes} minutes per interval
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: CUSTOMER CRM */}
      {/* ========================================================================= */}
      {activeTab === 'crm' && (
        <div className="animate-fade-in">
          <div style={{ marginBottom: 18 }}>
            <h2 className="font-display" style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Customer Relationship Management (CRM)
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Customer profiles, repeat bookings, contact phones, and lifetime spend history.
            </p>
          </div>

          <div className="nexus-card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-card)', color: 'var(--text-muted)', fontSize: 11.5 }}>
                    <th style={{ padding: '12px 16px' }}>NAME</th>
                    <th style={{ padding: '12px 16px' }}>PHONE</th>
                    <th style={{ padding: '12px 16px' }}>BOOKINGS</th>
                    <th style={{ padding: '12px 16px' }}>LIFETIME SPEND</th>
                    <th style={{ padding: '12px 16px' }}>LAST VISIT</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border-card)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                        {c.name || 'Player'}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                        {c.phone}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#0f172a' }}>
                        {c.booking_count} bookings
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#059669' }}>
                        ₹{c.total_spend?.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
                        {c.last_booking_date ? new Date(c.last_booking_date).toLocaleDateString() : 'Recent'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ACCEPT FULL-TIME INQUIRY (USER EXPLICIT REQUIREMENT) */}
      {/* ========================================================================= */}
      {showInquiryModal && inquirySlot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div className="nexus-card animate-fade-in" style={{ maxWidth: 520, width: '100%', padding: 26, background: '#ffffff', border: '1px solid rgba(99, 102, 241, 0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="font-display" style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Accept Full-Time Inquiry
                </h3>
                <div style={{ fontSize: 12, color: '#4f46e5' }}>
                  Slot: {inquirySlot.date} · {inquirySlot.start_time} - {inquirySlot.end_time} ({inquirySlot.court_name})
                </div>
              </div>
            </div>

            {/* Explanatory summary of the 6/8 player conversion */}
            <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', padding: 12, borderRadius: 8, fontSize: 12, color: '#fbbf24', marginBottom: 16 }}>
              <strong>Automatic Player Credit & Slot Lock:</strong> This slot currently has{' '}
              <strong>{inquirySlot.game?.current_players || 6} of {inquirySlot.game?.required_players || 8} players</strong> registered. Accepting this inquiry converts the slot into an exclusive full-turf reservation. The previously registered players will receive a notification and their fee will be credited back.
            </div>

            <form onSubmit={handleConfirmFullInquiry} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                  INQUIRING CLIENT / TEAM NAME *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bangalore Corporate League / Tech FC"
                  className="nexus-input"
                  style={{ width: '100%' }}
                  value={inquiryClientName}
                  onChange={e => setInquiryClientName(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                    CLIENT PHONE NUMBER *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98800 12345"
                    className="nexus-input"
                    style={{ width: '100%' }}
                    value={inquiryClientPhone}
                    onChange={e => setInquiryClientPhone(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                    FULL TURF PRICE (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    className="nexus-input"
                    style={{ width: '100%' }}
                    value={inquiryAmount}
                    onChange={e => setInquiryAmount(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                  PAYMENT COLLECTION
                </label>
                <select
                  value={inquiryPaymentMode}
                  onChange={e => setInquiryPaymentMode(e.target.value)}
                  className="nexus-input"
                  style={{ width: '100%' }}
                >
                  <option value="cash">Cash Collected at Reception</option>
                  <option value="upi">Direct UPI (Paid to Owner UPI)</option>
                  <option value="pay_at_venue">Pay at Venue upon Arrival</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                  BOOKING NOTES
                </label>
                <input
                  type="text"
                  className="nexus-input"
                  style={{ width: '100%' }}
                  value={inquiryNotes}
                  onChange={e => setInquiryNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowInquiryModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingInquiry}
                  style={{
                    flex: 1.6,
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    color: '#fff',
                    fontWeight: 700,
                    borderRadius: 8,
                    border: 'none',
                    padding: '10px 16px',
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  {submittingInquiry ? 'Confirming...' : 'Accept & Book Full Turf'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT SLOT PRICE */}
      {editingPriceSlot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div className="nexus-card animate-fade-in" style={{ maxWidth: 380, width: '100%', padding: 22, background: '#ffffff' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
              Set Slot Price
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              {editingPriceSlot.court_name} · {editingPriceSlot.start_time} - {editingPriceSlot.end_time}
            </div>

            <form onSubmit={handleSavePrice} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                  SLOT PRICE (₹)
                </label>
                <input
                  type="number"
                  required
                  className="nexus-input"
                  style={{ width: '100%' }}
                  value={newPriceValue}
                  onChange={e => setNewPriceValue(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setEditingPriceSlot(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                  Save Price
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESCHEDULE BOOKING */}
      {showRescheduleModal && rescheduleBooking && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div className="nexus-card animate-fade-in" style={{ maxWidth: 380, width: '100%', padding: 22, background: '#ffffff' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
              Reschedule Booking
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              {rescheduleBooking.customer_name || 'Guest'} · was {rescheduleBooking.date} · {rescheduleBooking.start_time} - {rescheduleBooking.end_time}
            </div>

            <form onSubmit={handleRescheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>NEW DATE</label>
                <input
                  type="date"
                  required
                  className="nexus-input"
                  style={{ width: '100%' }}
                  value={rescheduleDate}
                  onChange={e => setRescheduleDate(e.target.value)}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>START TIME</label>
                  <input
                    type="time"
                    required
                    className="nexus-input"
                    style={{ width: '100%' }}
                    value={rescheduleStartTime}
                    onChange={e => setRescheduleStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>END TIME</label>
                  <input
                    type="time"
                    className="nexus-input"
                    style={{ width: '100%' }}
                    value={rescheduleEndTime}
                    onChange={e => setRescheduleEndTime(e.target.value)}
                  />
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                If the new slot is already booked, this will be rejected — no double-booking.
              </p>

              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowRescheduleModal(false)} disabled={submittingReschedule}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={submittingReschedule}>
                  {submittingReschedule ? 'Saving…' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: WALK-IN BOOKING */}
      {showWalkInModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div className="nexus-card animate-fade-in" style={{ maxWidth: 460, width: '100%', padding: 24, background: '#ffffff' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
              New Walk-in Booking
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Instantly reserve a slot for a guest present at the turf counter.
            </p>

            <form onSubmit={handleWalkInSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>DATE</label>
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
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>START TIME</label>
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
                  placeholder="Player / Guest Name"
                  className="nexus-input"
                  style={{ width: '100%' }}
                  value={walkInCustomerName}
                  onChange={e => setWalkInCustomerName(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>AMOUNT (₹)</label>
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

      {/* MODAL: BLOCK SLOT */}
      {showBlockModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div className="nexus-card animate-fade-in" style={{ maxWidth: 440, width: '100%', padding: 24, background: '#ffffff' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
              Block Slot for Maintenance
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Take slot off the public calendar for grass repair, lighting maintenance, or private events.
            </p>

            <form onSubmit={handleBlockSlotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>REASON</label>
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
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>DATE</label>
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
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>START TIME</label>
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
                <button type="submit" className="btn-primary" style={{ flex: 1.5, background: '#f59e0b', color: '#000' }}>
                  Block Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD COURT */}
      {showCourtModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div className="nexus-card animate-fade-in" style={{ maxWidth: 460, width: '100%', padding: 24, background: '#ffffff' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
              Add Court / Pitch
            </h3>

            <form
              onSubmit={async e => {
                e.preventDefault();
                try {
                  await api.createCourt({
                    venueId: selectedVenue.id,
                    name: newCourtName,
                    sportId: newCourtSportId,
                    capacity: Number(newCourtCapacity),
                    basePrice: Number(newCourtBasePrice),
                    peakPrice: Number(newCourtPeakPrice),
                    weekendPrice: Number(newCourtWeekendPrice)
                  });
                  setShowCourtModal(false);
                  loadData(selectedVenue.id);
                  alert('Court created successfully.');
                } catch (err) {
                  alert('Failed to create court: ' + err.message);
                }
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
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
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>SPORT</label>
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

      {/* MODAL: TURF QR CODE */}
      {showQrModal && selectedVenue && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div className="nexus-card animate-fade-in" style={{ maxWidth: 360, width: '100%', padding: 26, background: '#ffffff', textAlign: 'center' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
              {selectedVenue.name}
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 18 }}>
              Scan to open the unique public booking page for this turf
            </div>

            <div style={{ background: '#fff', padding: 14, borderRadius: 12, display: 'inline-block', marginBottom: 16 }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uniqueTurfUrl)}`}
                alt="Turf QR Code"
                style={{ width: 180, height: 180, display: 'block' }}
              />
            </div>

            <div style={{ fontSize: 11.5, color: '#2563eb', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: 16 }}>
              {uniqueTurfUrl}
            </div>

            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setShowQrModal(false)}>
              Close QR
            </button>
          </div>
        </div>
      )}

      {/* MODAL: OWNER HOST OPEN GAME ON COURT SLOT */}
      {showOwnerHostModal && ownerHostSlot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div className="nexus-card animate-fade-in" style={{ maxWidth: 480, width: '100%', padding: 24, background: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(16, 185, 129, 0.2)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trophy size={18} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Host Open Game on Slot
              </h3>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 14 }}>
              {ownerHostSlot.court_name} · {ownerHostSlot.date} ({ownerHostSlot.start_time} - {ownerHostSlot.end_time})
            </p>

            <form onSubmit={handleOwnerHostSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>MATCH TITLE *</label>
                <input
                  type="text"
                  required
                  className="nexus-input"
                  style={{ width: '100%' }}
                  value={ownerHostTitle}
                  onChange={e => setOwnerHostTitle(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>SPORT</label>
                  <select
                    value={ownerHostSportId}
                    onChange={e => setOwnerHostSportId(e.target.value)}
                    className="nexus-input"
                    style={{ width: '100%' }}
                  >
                    <option value="football">Football</option>
                    <option value="futsal">Futsal</option>
                    <option value="cricket">Box Cricket</option>
                    <option value="badminton">Badminton</option>
                    <option value="padel">Padel</option>
                    <option value="pickleball">Pickleball</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>SKILL LEVEL</label>
                  <select
                    value={ownerHostSkill}
                    onChange={e => setOwnerHostSkill(e.target.value)}
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
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>REQUIRED PLAYERS</label>
                  <input
                    type="number"
                    min={2}
                    max={30}
                    required
                    className="nexus-input"
                    style={{ width: '100%' }}
                    value={ownerHostPlayers}
                    onChange={e => {
                      const count = Number(e.target.value) || 2;
                      setOwnerHostPlayers(count);
                      setOwnerHostCost(Math.ceil((ownerHostSlot.price || 1200) / count));
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>PRICE PER SPOT (₹)</label>
                  <input
                    type="number"
                    min={20}
                    required
                    className="nexus-input"
                    style={{ width: '100%' }}
                    value={ownerHostCost}
                    onChange={e => setOwnerHostCost(Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>RULES & EQUIPMENT</label>
                <input
                  type="text"
                  className="nexus-input"
                  style={{ width: '100%' }}
                  value={ownerHostRules}
                  onChange={e => setOwnerHostRules(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowOwnerHostModal(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={isPublishingOwnerGame} className="btn-primary" style={{ flex: 1.5 }}>
                  {isPublishingOwnerGame ? 'Publishing...' : 'Publish Open Game'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
