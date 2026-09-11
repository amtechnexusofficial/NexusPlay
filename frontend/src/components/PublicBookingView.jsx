import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import {
  Calendar, Clock, MapPin, Phone, ShieldCheck, ChevronRight,
  Share2, Users, ArrowLeft, CheckCircle, AlertCircle,
  Split, Sparkles, Trophy, Lock, QrCode, Copy, CheckCircle2,
  ExternalLink, RefreshCw, Star
} from 'lucide-react';

export default function PublicBookingView({ slug = 'nexus-central-koramangala', onBack, currentUser }) {
  const [venue, setVenue] = useState(null);
  const [sports, setSports] = useState([]);
  const [selectedSport, setSelectedSport] = useState(null);
  const [selectedCourt, setSelectedCourt] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Booking Flow & Concurrency Lock State
  const [isHolding, setIsHolding] = useState(false);
  const [activeHold, setActiveHold] = useState(null); // { bookingId, holdExpiresAt, paymentOrder }
  const [lockCountdown, setLockCountdown] = useState(0);
  const [checkoutStep, setCheckoutStep] = useState('slots'); // 'slots', 'payment', 'confirmed'

  // Customer Form & Direct UPI - Pre-filled if user is authenticated
  const [customerName, setCustomerName] = useState(() => currentUser?.name || '');
  const [customerPhone, setCustomerPhone] = useState(() => currentUser?.phone || '');
  const [customerEmail, setCustomerEmail] = useState(() => currentUser?.email || '');
  const [upiUtr, setUpiUtr] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [splitCount, setSplitCount] = useState(1);

  // A slot can already have an open pickup game on it (see slot.game from
  // getVenueSlots) — direct instant booking is blocked server-side for
  // those, so this venue page needs its own join/book-full mini flow
  // instead of routing away to Open Games Hub.
  const [joiningGame, setJoiningGame] = useState(false);
  const [joinGameError, setJoinGameError] = useState('');
  const [joinGameSuccess, setJoinGameSuccess] = useState('');
  // Joining a spot pays the venue's UPI QR the same way a direct booking
  // does — previously this skipped straight to marking the spot "paid"
  // with nothing actually collected. 'form' -> 'payment' -> submit.
  const [joinPaymentStep, setJoinPaymentStep] = useState('form');
  const [joinUtr, setJoinUtr] = useState('');
  const [joinCopiedUpi, setJoinCopiedUpi] = useState(false);
  const [requestingFullSlot, setRequestingFullSlot] = useState(false);
  const [fullSlotError, setFullSlotError] = useState('');
  const [fullSlotSuccess, setFullSlotSuccess] = useState('');

  // Guest host open game on an empty open slot (gated by venue.allow_guest_open_games)
  const [slotIntent, setSlotIntent] = useState('book'); // 'book' | 'host'
  const [hostTitle, setHostTitle] = useState('');
  const [hostPlayers, setHostPlayers] = useState(10);
  const [hostCostPerPlayer, setHostCostPerPlayer] = useState(250);
  const [hostSkill, setHostSkill] = useState('All Levels');
  const [hostRules, setHostRules] = useState('');
  const [hostingGame, setHostingGame] = useState(false);
  const [hostError, setHostError] = useState('');
  const [hostSuccess, setHostSuccess] = useState('');

  function handleProceedToJoinPayment() {
    if (!selectedSlot?.game) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      setJoinGameError('Enter your name and phone number to join.');
      return;
    }
    setJoinGameError('');
    setJoinPaymentStep('payment');
  }

  async function handleSubmitJoinPayment() {
    if (!selectedSlot?.game) return;
    if (!joinUtr.trim() || joinUtr.trim().length < 8) {
      setJoinGameError('Enter the UPI transaction reference (UTR) from your payment confirmation.');
      return;
    }
    setJoinGameError('');
    setJoiningGame(true);
    try {
      const res = await api.joinGame(selectedSlot.game.id, {
        playerName: customerName.trim(),
        playerPhone: customerPhone.trim(),
        utr: joinUtr.trim()
      });
      setJoinGameSuccess(`Payment submitted! ${res.newPlayerCount}/${selectedSlot.game.required_players} spots filled. The venue will verify your ₹${selectedSlot.game.cost_per_player} payment shortly.`);
      setJoinPaymentStep('form');
      setJoinUtr('');
      const res2 = await api.getVenueSlots(venue.id, selectedDate, selectedCourt?.id);
      setSlots(res2);
      const refreshed = res2.find(s => s.id === selectedSlot.id);
      if (refreshed) setSelectedSlot(refreshed);
    } catch (err) {
      setJoinGameError(err.message || 'Failed to join this game');
    } finally {
      setJoiningGame(false);
    }
  }

  async function handleRequestFullSlotDirect() {
    if (!selectedSlot?.game) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      setFullSlotError('Enter your name and phone number to request the full slot.');
      return;
    }
    setFullSlotError('');
    setRequestingFullSlot(true);
    try {
      await api.requestFullSlot(selectedSlot.game.id, { clientName: customerName.trim(), clientPhone: customerPhone.trim() });
      setFullSlotSuccess('Request sent to the venue owner. If accepted, everyone currently registered gets refunded and you get the whole slot.');
    } catch (err) {
      setFullSlotError(err.message || 'Failed to submit request');
    } finally {
      setRequestingFullSlot(false);
    }
  }

  // Sync if currentUser changes
  useEffect(() => {
    if (currentUser) {
      if (currentUser.name) setCustomerName(currentUser.name);
      if (currentUser.phone) setCustomerPhone(currentUser.phone);
      if (currentUser.email) setCustomerEmail(currentUser.email);
    }
  }, [currentUser]);

  // Confirmation result
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Reviews — only a customer with a booking at this venue can submit one
  // (enforced server-side); the form is always shown, the error surfaces
  // if that check fails.
  const [reviews, setReviews] = useState([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');

  async function loadReviews(venueSlug) {
    const data = await api.getVenueReviews(venueSlug).catch(() => []);
    setReviews(data);
  }

  async function handleSubmitReview(e) {
    e.preventDefault();
    if (!customerPhone || customerPhone.trim().length < 10) {
      setReviewError('Enter the phone number you booked with.');
      return;
    }
    setReviewError('');
    setReviewSuccess('');
    setSubmittingReview(true);
    try {
      await api.submitReview({
        venueId: venue.id,
        customerPhone: customerPhone.trim(),
        rating: reviewRating,
        comment: reviewComment.trim()
      });
      setReviewSuccess('Thanks for your review!');
      setReviewComment('');
      loadReviews(slug);
    } catch (err) {
      setReviewError(err.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  }

  // Load venue details
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await api.getPublicVenue(slug);
        setVenue(data);
        if (data.sport_ids?.length > 0) {
          setSelectedSport(data.sport_ids[0]);
        }
        if (data.courts?.length > 0) {
          setSelectedCourt(data.courts[0]);
        }
        loadReviews(slug);
        api.getSports().then(setSports).catch(() => setSports([]));
      } catch (err) {
        setErrorMsg('Failed to load venue: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  // Load slots whenever date or court changes
  useEffect(() => {
    if (!venue) return;
    async function loadSlots() {
      try {
        const courtId = selectedCourt ? selectedCourt.id : undefined;
        const res = await api.getVenueSlots(venue.id, selectedDate, courtId);
        // Client-side backstop: hide slots whose start time has passed (IST).
        const now = Date.now();
        setSlots((Array.isArray(res) ? res : []).filter((s) => {
          const day = String(s.date || '').slice(0, 10);
          const hhmm = String(s.start_time || '').slice(0, 5);
          if (!day || !hhmm) return true;
          const ms = Date.parse(`${day}T${hhmm}:00+05:30`);
          return !(Number.isFinite(ms) && ms <= now);
        }));
      } catch (err) {
        console.error('Error fetching slots:', err);
      }
    }
    loadSlots();
  }, [venue, selectedDate, selectedCourt]);

  // Handle Lock Countdown timer
  useEffect(() => {
    if (!activeHold?.holdExpiresAt) return;
    const interval = setInterval(() => {
      const remainingMs = new Date(activeHold.holdExpiresAt).getTime() - Date.now();
      const seconds = Math.max(0, Math.floor(remainingMs / 1000));
      setLockCountdown(seconds);
      if (seconds <= 0) {
        clearInterval(interval);
        setActiveHold(null);
        setErrorMsg('Slot reservation hold expired. Please select a slot again.');
        setCheckoutStep('slots');
        setSelectedSlot(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeHold]);

  // Step 1: Request Temporary Lock for selected slot
  async function handleLockSlot() {
    if (!selectedSlot) return;
    if (!customerPhone) {
      setErrorMsg('Please enter your phone number to reserve the slot');
      return;
    }
    setErrorMsg('');
    setIsHolding(true);
    try {
      const res = await api.holdSlot({
        slotId: selectedSlot.id,
        customerName: customerName || 'Player',
        customerPhone,
        customerEmail,
        sportId: selectedSport
      });
      setActiveHold(res);
      setCheckoutStep('payment');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsHolding(false);
    }
  }

  function prepareHostDefaults(slot) {
    const capacity = selectedCourt?.capacity || 10;
    const players = Math.max(2, Number(capacity) || 10);
    setHostPlayers(players);
    setHostCostPerPlayer(Math.max(1, Math.ceil((slot?.price || 0) / players)));
    setHostTitle('');
    setHostSkill('All Levels');
    setHostRules('');
    setHostError('');
    setHostSuccess('');
  }

  function handleHostPlayersChange(val) {
    const count = Math.max(2, Number(val) || 2);
    setHostPlayers(count);
    if (selectedSlot) {
      setHostCostPerPlayer(Math.max(1, Math.ceil((selectedSlot.price || 0) / count)));
    }
  }

  async function handleHostOpenGame(e) {
    e?.preventDefault?.();
    if (!selectedSlot || !venue) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      setHostError('Enter your name and phone number to host this open game');
      return;
    }
    if (!hostPlayers || !hostCostPerPlayer) {
      setHostError('Set how many players and the cost per spot');
      return;
    }
    setHostError('');
    setHostingGame(true);
    try {
      await api.createGame({
        venueId: venue.id,
        courtId: selectedSlot.court_id || selectedCourt?.id,
        courtSlotId: selectedSlot.id,
        sportId: selectedSlot.sport_id || selectedCourt?.sport_id || selectedSport,
        title: hostTitle.trim() || `Open Match at ${venue.name}`,
        organizerName: customerName.trim(),
        organizerPhone: customerPhone.trim(),
        skillLevel: hostSkill,
        requiredPlayers: Number(hostPlayers),
        costPerPlayer: Number(hostCostPerPlayer),
        date: selectedSlot.date || selectedDate,
        startTime: selectedSlot.start_time,
        endTime: selectedSlot.end_time,
        rules: hostRules.trim() || undefined
      });
      setHostSuccess('Open game posted! Others can join spots on this slot.');
      const refreshed = await api.getVenueSlots(venue.id, selectedDate, selectedCourt?.id);
      setSlots(refreshed);
      const next = refreshed.find((s) => s.id === selectedSlot.id);
      if (next) setSelectedSlot(next);
      setSlotIntent('book');
    } catch (err) {
      setHostError(err.message || 'Failed to host open game');
    } finally {
      setHostingGame(false);
    }
  }

  // Step 2: Confirm Payment & Submit UTR
  async function handleFinalizeBooking() {
    if (!activeHold?.bookingId) return;

    if (!upiUtr.trim()) {
      setErrorMsg('Please enter your 12-digit UPI Reference / UTR Number from your UPI payment app receipt');
      return;
    }
    if (upiUtr.trim().length < 8) {
      setErrorMsg('UPI Reference / UTR must be at least 8 to 12 digits');
      return;
    }

    setIsHolding(true);
    setErrorMsg('');
    try {
      const res = await api.confirmBooking({
        bookingId: activeHold.bookingId,
        paymentProvider: 'upi',
        utr: upiUtr.trim(),
        splitCount,
        participants: Array.from({ length: splitCount }).map((_, i) => ({
          name: i === 0 ? (customerName || 'Organizer') : `Player ${i + 1}`,
          phone: i === 0 ? customerPhone : ''
        }))
      });
      setConfirmedBooking(res);
      setCheckoutStep('confirmed');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsHolding(false);
    }
  }

  async function handleCancelHold() {
    if (activeHold?.bookingId) {
      try {
        await api.releaseHold({ bookingId: activeHold.bookingId, slotId: selectedSlot?.id });
      } catch (e) {}
    }
    setActiveHold(null);
    setSelectedSlot(null);
    setCheckoutStep('slots');
    setUpiUtr('');
    setErrorMsg('');
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: 'var(--text-secondary)' }}>
        <Clock className="animate-spin" size={28} style={{ marginRight: 12, color: 'var(--accent-neon)' }} />
        Loading Venue Experience...
      </div>
    );
  }

  if (!venue) {
    return (
      <div style={{ maxWidth: 420, margin: '80px auto', padding: '36px 28px', textAlign: 'center', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 4px 14px rgba(0,0,0,0.05)' }}>
        <AlertCircle size={32} color="#dc2626" style={{ margin: '0 auto 12px' }} />
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Venue not found</h2>
        <p style={{ fontSize: 13.5, color: '#64748b', marginBottom: 8 }}>This turf may not be published yet, may have been removed, or the link is incorrect.</p>
        {errorMsg && (
          <p style={{ fontSize: 11.5, color: '#94a3b8', fontFamily: 'monospace', marginBottom: 20 }}>{errorMsg}</p>
        )}
        <button className="btn-primary" onClick={onBack}>Return to Marketplace</button>
      </div>
    );
  }

  // Filter available courts by sport
  const filteredCourts = (Array.isArray(venue.courts) ? venue.courts : []).filter(c => !selectedSport || c.sport_id === selectedSport);

  // Owner-configurable deposit — see Business Setup's "Advance Payment %".
  // 100 (the default) means "pay in full to lock the slot", same as
  // before this setting existed.
  const advancePercent = venue.advance_payment_percent ?? 100;
  const guestHostEnabled = venue.allow_guest_open_games !== false;
  const advanceAmount = selectedSlot
    ? (advancePercent >= 100 ? selectedSlot.price : Math.max(1, Math.round((selectedSlot.price * advancePercent) / 100)))
    : 0;
  const balanceAtVenue = selectedSlot ? selectedSlot.price - advanceAmount : 0;

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1120, margin: '0 auto', padding: '16px 20px 80px' }}>
      {/* Navigation Topbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button
          onClick={onBack}
          className="btn-secondary"
          style={{ padding: '6px 14px', fontSize: 13, borderRadius: 8 }}
        >
          <ArrowLeft size={16} /> Back to Venues
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {venue.review_count > 0 && (
            <span className="badge-neon" style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
              ★ {venue.avg_rating} ({venue.review_count} review{venue.review_count === 1 ? '' : 's'})
            </span>
          )}
          <button
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
                alert('Venue shareable link copied to clipboard!');
              }
            }}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: 13 }}
            title="Share Venue Link"
          >
            <Share2 size={15} /> Share
          </button>
        </div>
      </div>

      {/* Hero Photos & Venue Header */}
      <div className="nexus-card" style={{ overflow: 'hidden', marginBottom: 24 }}>
        <div className="venue-gallery-grid">
          <img
            src={venue.photos?.[0] || 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80'}
            alt={venue.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div className="venue-gallery-side" style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 4 }}>
            <img
              src={venue.photos?.[1] || 'https://images.unsplash.com/photo-1529900241452-94f4c281df69?auto=format&fit=crop&w=600&q=80'}
              alt="Turf side"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <img
              src={venue.photos?.[2] || 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=600&q=80'}
              alt="Night floodlights"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 className="font-display" style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                {venue.name}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 14 }}>
                <MapPin size={16} style={{ color: '#059669', flexShrink: 0 }} />
                <span>{venue.address}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Operational Hours
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#059669' }}>
                {venue.open_time} - {venue.close_time}
              </div>
            </div>
          </div>

          <p style={{ color: '#475569', marginTop: 14, fontSize: 14.5, lineHeight: 1.6, maxWidth: 840 }}>
            {venue.description}
          </p>

          {/* Amenities Badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
            {(Array.isArray(venue.amenities) ? venue.amenities : []).map((amenity, idx) => (
              <span
                key={idx}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: 999,
                  padding: '5px 12px',
                  fontSize: 12.5,
                  color: '#334155',
                  fontWeight: 600
                }}
              >
                ✓ {amenity}
              </span>
            ))}
          </div>

          {(venue.cancellation_policy || venue.rules) && (
            <div style={{ display: 'grid', gridTemplateColumns: venue.cancellation_policy && venue.rules ? '1fr 1fr' : '1fr', gap: 12, marginTop: 18 }}>
              {venue.cancellation_policy && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                    Cancellation Policy
                  </div>
                  <div style={{ fontSize: 13.5, color: '#78350f', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                    {venue.cancellation_policy}
                  </div>
                </div>
              )}
              {venue.rules && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                    House Rules
                  </div>
                  <div style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                    {venue.rules}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MAIN BOOKING INTERFACE */}
      {checkoutStep === 'confirmed' && confirmedBooking ? (
        <div className="nexus-card animate-fade-in" style={{ padding: 36, textAlign: 'center', background: '#ffffff', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'inline-flex', padding: 16, borderRadius: '50%', background: confirmedBooking.paymentStatus === 'pending_verification' ? '#fef3c7' : '#d1fae5', color: confirmedBooking.paymentStatus === 'pending_verification' ? '#d97706' : '#059669', marginBottom: 16 }}>
            {confirmedBooking.paymentStatus === 'pending_verification' ? <Clock size={48} /> : <CheckCircle size={48} />}
          </div>
          <h2 className="font-display" style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>
            {confirmedBooking.paymentStatus === 'pending_verification' ? 'Booking Reserved — Pending UPI Credit Verification' : 'Booking Confirmed!'}
          </h2>
          <p style={{ color: '#64748b', marginTop: 8, fontSize: 14 }}>
            Booking Ref: <strong style={{ color: '#0f172a' }}>{confirmedBooking.booking?.id}</strong>
          </p>

          {confirmedBooking.paymentStatus === 'pending_verification' && (
            <div style={{ maxWidth: 520, margin: '16px auto', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 16, textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b45309', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                <ShieldCheck size={18} /> Slot 100% Reserved & Held
              </div>
              <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.5 }}>
                Your 12-digit UTR <strong>{confirmedBooking.utr || confirmedBooking.booking?.upi_utr}</strong> has been submitted directly to {venue.name}. The owner will verify the ₹{confirmedBooking.booking?.amount_paid ?? confirmedBooking.booking?.total_amount} credit in their bank account. You will receive an SMS confirmation once credited.
              </p>
            </div>
          )}

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, maxWidth: 520, margin: '20px auto', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ color: '#64748b' }}>Venue:</span>
              <strong style={{ color: '#0f172a' }}>{venue.name}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ color: '#64748b' }}>Court:</span>
              <strong style={{ color: '#0f172a' }}>{selectedCourt?.name}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ color: '#64748b' }}>Date & Time:</span>
              <strong style={{ color: '#059669' }}>{confirmedBooking.booking?.date} | {confirmedBooking.booking?.start_time} - {confirmedBooking.booking?.end_time}</strong>
            </div>
            {confirmedBooking.utr && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b' }}>UPI Reference (UTR):</span>
                <strong style={{ color: '#0f172a', letterSpacing: '0.05em' }}>{confirmedBooking.utr}</strong>
              </div>
            )}
            {(confirmedBooking.booking?.amount_paid ?? confirmedBooking.booking?.total_amount) < confirmedBooking.booking?.total_amount ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#64748b' }}>Advance Paid:</span>
                  <strong style={{ color: '#0f172a', fontSize: 16 }}>₹{confirmedBooking.booking?.amount_paid}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10 }}>
                  <span style={{ color: '#92400e' }}>Balance Due at Venue:</span>
                  <strong style={{ color: '#92400e', fontSize: 18 }}>₹{confirmedBooking.booking?.total_amount - confirmedBooking.booking?.amount_paid}</strong>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10 }}>
                <span style={{ color: '#64748b' }}>Total Amount:</span>
                <strong style={{ color: '#0f172a', fontSize: 18 }}>₹{confirmedBooking.booking?.total_amount}</strong>
              </div>
            )}
          </div>

          {confirmedBooking.shareLinks?.length > 1 && (
            <div style={{ maxWidth: 520, margin: '0 auto 24px', textAlign: 'left', background: '#fff7ed', border: '1px solid #fed7aa', padding: 18, borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#c2410c', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
                <Split size={18} /> Split Payment Links Generated ({confirmedBooking.shareLinks.length} players)
              </div>
              <p style={{ fontSize: 12.5, color: '#475569', marginBottom: 12 }}>
                Share these individual payment links with your teammates. Each pays ₹{confirmedBooking.shareLinks[0]?.shareAmount}:
              </p>
              {confirmedBooking.shareLinks.map((link, i) => (
                <div key={link.participantId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', border: '1px solid #fed7aa', padding: '8px 12px', borderRadius: 8, marginBottom: 6, fontSize: 12.5 }}>
                  <span style={{ color: '#0f172a' }}>{link.name} ({link.status === 'paid' ? 'Paid by you' : 'Pending'})</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/?pay=${link.token}`);
                      alert(`Shareable payment link for ${link.name} copied!`);
                    }}
                    style={{ background: 'none', border: 'none', color: '#059669', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Copy Link
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: 14 }}>
            <button className="btn-primary" onClick={() => { setCheckoutStep('slots'); setSelectedSlot(null); setConfirmedBooking(null); setActiveHold(null); setUpiUtr(''); }}>
              Book Another Slot
            </button>
            <button className="btn-secondary" onClick={onBack}>
              Explore More Turfs
            </button>
          </div>
        </div>
      ) : (
        <div className="public-booking-layout">
          {/* Left Column: Sport, Court, Date & Slots */}
          <div>
            {/* 1. Sport Selector */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 10 }}>
                1. Select Sport
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {(Array.isArray(venue.sport_ids) ? venue.sport_ids : []).map(sport => {
                  const sportInfo = sports.find(s => s.id === sport);
                  return (
                    <button
                      key={sport}
                      onClick={() => {
                        setSelectedSport(sport);
                        const matchingCourt = (Array.isArray(venue.courts) ? venue.courts : []).find(c => c.sport_id === sport);
                        if (matchingCourt) setSelectedCourt(matchingCourt);
                      }}
                      style={{
                        background: selectedSport === sport ? 'var(--accent-neon)' : 'var(--bg-card)',
                        color: selectedSport === sport ? '#042f1f' : 'var(--text-primary)',
                        border: `1px solid ${selectedSport === sport ? 'var(--accent-neon)' : 'var(--border-card)'}`,
                        borderRadius: 12,
                        padding: '10px 18px',
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                        transition: 'all 0.15s'
                      }}
                    >
                      {sportInfo ? `${sportInfo.icon} ${sportInfo.name}` : 'Sport'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Court Selector */}
            {filteredCourts.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 10 }}>
                  2. Choose Court / Arena
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                  {filteredCourts.map(crt => (
                    <div
                      key={crt.id}
                      onClick={() => { setSelectedCourt(crt); setSelectedSlot(null); }}
                      style={{
                        background: selectedCourt?.id === crt.id ? '#ecfdf5' : '#ffffff',
                        border: `1.5px solid ${selectedCourt?.id === crt.id ? '#059669' : '#e2e8f0'}`,
                        borderRadius: 12,
                        padding: '14px 16px',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 4 }}>
                        {crt.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        Capacity: {crt.capacity} players · {crt.slot_duration_minutes}m slots
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#059669', marginTop: 8 }}>
                        From ₹{crt.base_price}/hr
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Date Picker Horizontal Strip */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: 10 }}>
                3. Choose Date
              </label>
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
                {Array.from({ length: 7 }).map((_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() + i);
                  const dStr = d.toISOString().slice(0, 10);
                  const isSelected = selectedDate === dStr;
                  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                  const dayNum = d.getDate();
                  const monthName = d.toLocaleDateString('en-US', { month: 'short' });

                  return (
                    <button
                      key={dStr}
                      onClick={() => { setSelectedDate(dStr); setSelectedSlot(null); }}
                      style={{
                        minWidth: 78,
                        background: isSelected ? '#059669' : '#ffffff',
                        color: isSelected ? '#ffffff' : '#0f172a',
                        border: `1px solid ${isSelected ? '#059669' : '#cbd5e1'}`,
                        borderRadius: 12,
                        padding: '12px 8px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', opacity: 0.8 }}>
                        {i === 0 ? 'Today' : i === 1 ? 'Tmrw' : dayName}
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 800, margin: '2px 0' }}>
                        {dayNum}
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.8 }}>
                        {monthName}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Slot Matrix */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                  4. Available Time Slots
                </label>
                <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-neon)' }} /> Available
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fb923c' }} /> Held/Locking
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#475569' }} /> Booked
                  </span>
                </div>
              </div>

              {slots.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 12, color: 'var(--text-secondary)' }}>
                  No slots currently configured for this date.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: 10 }}>
                  {slots.map(slot => {
                    const isOpen = slot.status === 'open';
                    const isHeld = slot.status === 'held';
                    const isSelected = selectedSlot?.id === slot.id;
                    const hasOpenGame = isOpen && !!slot.game;

                    return (
                      <button
                        key={slot.id}
                        disabled={!isOpen}
                        onClick={() => {
                          setSelectedSlot(slot);
                          setErrorMsg('');
                          setJoinGameError(''); setJoinGameSuccess('');
                          setFullSlotError(''); setFullSlotSuccess('');
                          setJoinPaymentStep('form'); setJoinUtr('');
                          setSlotIntent('book');
                          setHostError('');
                          setHostSuccess('');
                          prepareHostDefaults(slot);
                        }}
                        style={{
                          background: isSelected
                            ? '#059669'
                            : isOpen
                            ? '#ffffff'
                            : isHeld
                            ? '#fffbeb'
                            : '#f8fafc',
                          color: isSelected
                            ? '#ffffff'
                            : isOpen
                            ? '#0f172a'
                            : isHeld
                            ? '#d97706'
                            : '#94a3b8',
                          border: `1.5px solid ${
                            isSelected
                              ? '#059669'
                              : isOpen
                              ? '#cbd5e1'
                              : isHeld
                              ? '#fde68a'
                              : '#e2e8f0'
                          }`,
                          borderRadius: 10,
                          padding: '10px 8px',
                          textAlign: 'center',
                          cursor: isOpen ? 'pointer' : 'not-allowed',
                          position: 'relative',
                          boxShadow: isOpen ? '0 1px 2px rgba(0,0,0,0.03)' : 'none'
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700 }}>
                          {slot.start_time} - {slot.end_time}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, color: isSelected ? '#ffffff' : isOpen ? '#059669' : undefined }}>
                          {isOpen ? `₹${slot.price}` : isHeld ? 'Temporarily Held' : 'Booked'}
                        </div>
                        {hasOpenGame && (
                          <div
                            style={{
                              fontSize: 10, fontWeight: 700, marginTop: 4, padding: '2px 6px', borderRadius: 999,
                              background: isSelected ? 'rgba(255,255,255,0.25)' : '#fef3c7',
                              color: isSelected ? '#ffffff' : '#92400e',
                              display: 'inline-block'
                            }}
                          >
                            {slot.game.current_players}/{slot.game.required_players} joined
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Checkout Summary & Temporary Lock Widget */}
          <div>
            <div className="nexus-card" style={{ padding: 22, position: 'sticky', top: 20, background: '#ffffff', border: '1px solid #e2e8f0' }}>
              <h3 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>
                Booking Summary
              </h3>

              {selectedSlot?.game ? (
                <div>
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 13, color: '#64748b' }}>{venue.name}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{selectedCourt?.name}</div>
                    <div style={{ fontSize: 13, color: '#059669', marginTop: 4, fontWeight: 600 }}>
                      {selectedDate} · {selectedSlot.start_time} to {selectedSlot.end_time}
                    </div>
                  </div>

                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                      <Users size={15} /> {selectedSlot.game.title || 'Open Pickup Game'}
                    </div>
                    <div style={{ fontSize: 12.5, color: '#78350f' }}>
                      <strong>{selectedSlot.game.current_players}/{selectedSlot.game.required_players}</strong> players have already joined at ₹{selectedSlot.game.cost_per_player}/spot. You can join a spot, or request the whole slot for yourself.
                    </div>
                  </div>

                  {(joinGameError || fullSlotError) && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#b91c1c', padding: 10, borderRadius: 8, fontSize: 12.5, marginBottom: 14 }}>
                      {joinGameError || fullSlotError}
                    </div>
                  )}
                  {(joinGameSuccess || fullSlotSuccess) && (
                    <div style={{ background: 'rgba(5, 150, 105, 0.1)', border: '1px solid rgba(5, 150, 105, 0.3)', color: '#065f46', padding: 10, borderRadius: 8, fontSize: 12.5, marginBottom: 14 }}>
                      {joinGameSuccess || fullSlotSuccess}
                    </div>
                  )}

                  {joinPaymentStep === 'payment' ? (
                    <div>
                      <div style={{ textAlign: 'center', marginBottom: 14 }}>
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=${venue.upi_id || ''}&pn=${encodeURIComponent(venue.name)}&am=${selectedSlot.game.cost_per_player}&cu=INR`)}`}
                          alt="Venue Owner UPI QR Code"
                          style={{ width: 180, height: 180, borderRadius: 10, border: '1px solid #e2e8f0' }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, fontSize: 12.5, color: '#334155' }}>
                          {venue.upi_id || 'UPI ID not set by venue'}
                          <button
                            type="button"
                            onClick={() => {
                              if (!venue.upi_id) return;
                              navigator.clipboard.writeText(venue.upi_id);
                              setJoinCopiedUpi(true);
                              setTimeout(() => setJoinCopiedUpi(false), 2000);
                            }}
                            style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', display: 'flex' }}
                          >
                            {joinCopiedUpi ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 6 }}>
                          ₹{selectedSlot.game.cost_per_player}
                        </div>
                      </div>

                      <div style={{ marginBottom: 12 }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                          UPI TRANSACTION REFERENCE (UTR) *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 402812345678"
                          className="nexus-input"
                          style={{ width: '100%' }}
                          value={joinUtr}
                          onChange={e => setJoinUtr(e.target.value)}
                        />
                        <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>
                          Found in your UPI app's payment confirmation, right after paying the QR above.
                        </div>
                      </div>

                      <button
                        disabled={joiningGame}
                        onClick={handleSubmitJoinPayment}
                        className="btn-primary"
                        style={{ width: '100%', marginBottom: 8 }}
                      >
                        {joiningGame ? 'Submitting...' : 'Submit UTR & Join Spot'}
                      </button>
                      <button
                        type="button"
                        disabled={joiningGame}
                        onClick={() => { setJoinPaymentStep('form'); setJoinUtr(''); setJoinGameError(''); }}
                        style={{ width: '100%', background: 'none', border: 'none', color: '#64748b', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Back
                      </button>
                    </div>
                  ) : (
                    <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                        PHONE NUMBER *
                      </label>
                      <input
                        type="tel"
                        placeholder="+91 98765 43210"
                        className="nexus-input"
                        style={{ width: '100%' }}
                        value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                        YOUR NAME *
                      </label>
                      <input
                        type="text"
                        placeholder="Player Name"
                        className="nexus-input"
                        style={{ width: '100%' }}
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 10px', marginBottom: 12, fontSize: 11, color: '#92400e', lineHeight: 1.4 }}>
                    <strong>Confirmation terms:</strong> this game is confirmed once every spot is filled. If it isn't full by 1 hour before kickoff, it's cancelled and the venue refunds your payment via UPI.
                  </div>

                  <button
                    disabled={joiningGame || !!joinGameSuccess}
                    onClick={handleProceedToJoinPayment}
                    className="btn-primary"
                    style={{ width: '100%', marginBottom: 10 }}
                  >
                    {!!joinGameSuccess ? 'Joined' : `Join a Spot · ₹${selectedSlot.game.cost_per_player}`}
                  </button>
                  <button
                    disabled={requestingFullSlot || !!fullSlotSuccess}
                    onClick={handleRequestFullSlotDirect}
                    className="btn-outline"
                    style={{ width: '100%' }}
                  >
                    {requestingFullSlot ? 'Sending...' : `Book Full Slot Instead · ₹${selectedSlot.price}`}
                  </button>
                    </>
                  )}
                </div>
              ) : selectedSlot ? (
                <div>
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 13, color: '#64748b' }}>{venue.name}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{selectedCourt?.name}</div>
                    <div style={{ fontSize: 13, color: '#059669', marginTop: 4, fontWeight: 600 }}>
                      {selectedDate} · {selectedSlot.start_time} to {selectedSlot.end_time}
                    </div>
                  </div>

                  {guestHostEnabled && !activeHold && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 6,
                        padding: 4,
                        marginBottom: 16,
                        background: '#f1f5f9',
                        borderRadius: 10,
                        border: '1px solid #e2e8f0'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => { setSlotIntent('book'); setHostError(''); }}
                        style={{
                          padding: '10px 8px',
                          borderRadius: 8,
                          border: slotIntent === 'book' ? '1px solid #cbd5e1' : '1px solid transparent',
                          background: slotIntent === 'book' ? '#ffffff' : 'transparent',
                          color: slotIntent === 'book' ? '#0f172a' : '#64748b',
                          fontWeight: 700,
                          fontSize: 12.5,
                          cursor: 'pointer',
                          boxShadow: slotIntent === 'book' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                        }}
                      >
                        Book full slot
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSlotIntent('host'); setErrorMsg(''); prepareHostDefaults(selectedSlot); }}
                        style={{
                          padding: '10px 8px',
                          borderRadius: 8,
                          border: slotIntent === 'host' ? '1px solid #cbd5e1' : '1px solid transparent',
                          background: slotIntent === 'host' ? '#ffffff' : 'transparent',
                          color: slotIntent === 'host' ? '#0f172a' : '#64748b',
                          fontWeight: 700,
                          fontSize: 12.5,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          boxShadow: slotIntent === 'host' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                        }}
                      >
                        <Users size={14} /> Host open game
                      </button>
                    </div>
                  )}

                  {hostSuccess && (
                    <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: 10, borderRadius: 8, fontSize: 12.5, marginBottom: 14 }}>
                      {hostSuccess}
                    </div>
                  )}

                  {slotIntent === 'host' && guestHostEnabled && !activeHold ? (
                    <form onSubmit={handleHostOpenGame}>
                      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 14, lineHeight: 1.45 }}>
                        Post a pickup match on this slot. You take the first spot; others can join for the per-player price.
                      </p>

                      {hostError && (
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: 10, borderRadius: 8, fontSize: 12.5, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <AlertCircle size={16} /> {hostError}
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>YOUR NAME *</label>
                          <input type="text" className="nexus-input" style={{ width: '100%' }} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Organizer name" required />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>PHONE NUMBER *</label>
                          <input type="tel" className="nexus-input" style={{ width: '100%' }} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+91 98765 43210" required />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>MATCH TITLE</label>
                          <input type="text" className="nexus-input" style={{ width: '100%' }} value={hostTitle} onChange={(e) => setHostTitle(e.target.value)} placeholder={`Open Match at ${venue.name}`} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>PLAYERS NEEDED *</label>
                            <input type="number" min={2} max={30} className="nexus-input" style={{ width: '100%' }} value={hostPlayers} onChange={(e) => handleHostPlayersChange(e.target.value)} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>₹ / SPOT *</label>
                            <input type="number" min={1} className="nexus-input" style={{ width: '100%' }} value={hostCostPerPlayer} onChange={(e) => setHostCostPerPlayer(Number(e.target.value) || 0)} />
                          </div>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>SKILL LEVEL</label>
                          <select className="nexus-input" style={{ width: '100%' }} value={hostSkill} onChange={(e) => setHostSkill(e.target.value)}>
                            <option>All Levels</option>
                            <option>Beginner</option>
                            <option>Intermediate</option>
                            <option>Advanced</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>RULES (OPTIONAL)</label>
                          <textarea className="nexus-input" rows={2} style={{ width: '100%', resize: 'vertical' }} value={hostRules} onChange={(e) => setHostRules(e.target.value)} placeholder="Turf shoes only, arrive 10 mins early…" />
                        </div>
                      </div>

                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 12.5, color: '#475569' }}>
                        Slot fee ₹{selectedSlot.price} · suggested ₹{Math.ceil((selectedSlot.price || 0) / Math.max(2, hostPlayers))}/spot for {hostPlayers} players
                      </div>

                      <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px' }} disabled={hostingGame}>
                        {hostingGame ? 'Posting open game…' : `Host Open Game · ₹${hostCostPerPlayer}/spot`}
                      </button>
                    </form>
                  ) : (
                  <>
                  {/* Concurrency Timer if active lock exists */}
                  {activeHold && lockCountdown > 0 && (
                    <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Lock size={20} style={{ color: '#059669' }} />
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--accent-neon)', fontWeight: 700 }}>SLOT LOCKED FOR YOU</div>
                        <div style={{ fontSize: 13, color: '#fff' }}>
                          Lock expires in <strong>{Math.floor(lockCountdown / 60)}m {lockCountdown % 60}s</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {errorMsg && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: 10, borderRadius: 8, fontSize: 12.5, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertCircle size={16} /> {errorMsg}
                    </div>
                  )}

                  {/* Customer Information Form */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                        PHONE NUMBER *
                      </label>
                      <input
                        type="tel"
                        placeholder="+91 98765 43210"
                        className="nexus-input"
                        style={{ width: '100%' }}
                        value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                        YOUR NAME
                      </label>
                      <input
                        type="text"
                        placeholder="Player Name"
                        className="nexus-input"
                        style={{ width: '100%' }}
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Payment Method — UPI direct to the venue owner is the
                      only option. "Pay at Turf" (book instantly with
                      nothing collected) used to be offered here too, but a
                      booking with zero payment secured nothing — removed
                      in favor of the owner's own advance-payment setting
                      below, which already covers "I don't want to collect
                      the full amount up front" without giving up a deposit
                      entirely. */}
                  <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '10px 12px' }}>
                    <QrCode size={16} style={{ color: '#059669', flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, color: '#065f46', fontWeight: 600 }}>
                      Pay via the venue owner's UPI QR to lock this slot
                    </span>
                  </div>

                  {/* Split Bill Feature */}
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Split size={14} /> Split with players
                      </span>
                      <select
                        value={splitCount}
                        onChange={e => setSplitCount(Number(e.target.value))}
                        style={{ background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 6, padding: '3px 8px', fontSize: 12 }}
                      >
                        <option value={1}>1 Player (Full)</option>
                        <option value={2}>2 Players (₹{Math.round(selectedSlot.price / 2)} each)</option>
                        <option value={4}>4 Players (₹{Math.round(selectedSlot.price / 4)} each)</option>
                        <option value={10}>10 Players (₹{Math.round(selectedSlot.price / 10)} each)</option>
                        <option value={14}>14 Players (₹{Math.round(selectedSlot.price / 14)} each)</option>
                      </select>
                    </div>
                  </div>

                  {/* Price Breakdown — advancePercent < 100 means the venue
                      only requires a deposit to lock the slot (owner's
                      Business Setup setting), balance settled in person. */}
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14, marginBottom: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b', marginBottom: 6 }}>
                      <span>Slot Fee</span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>₹{selectedSlot.price}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b', marginBottom: 8 }}>
                      <span>Platform Fee</span>
                      <span style={{ color: '#059669', fontWeight: 600 }}>₹0 (Direct UPI to Venue)</span>
                    </div>
                    {advancePercent < 100 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#92400e', marginBottom: 8 }}>
                        <span>Balance Due at Venue</span>
                        <span style={{ fontWeight: 600 }}>₹{balanceAtVenue}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                      <span>{advancePercent < 100 ? 'Pay Now (Advance)' : 'Total Due'}</span>
                      <span>₹{advanceAmount}</span>
                    </div>
                  </div>

                  {/* Active Hold & Owner UPI QR Payment Screen */}
                  {!activeHold ? (
                    <button
                      className="btn-primary"
                      style={{ width: '100%', padding: '12px' }}
                      disabled={isHolding}
                      onClick={handleLockSlot}
                    >
                      {isHolding ? 'Locking Slot...' : 'Lock Slot & Show UPI QR (10m Hold)'}
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {(() => {
                        const amountDue = activeHold.advanceAmount ?? selectedSlot.price;
                        const holdBalance = (activeHold.totalAmount ?? selectedSlot.price) - amountDue;
                        return (
                        <div style={{ background: '#f8fafc', border: '1px solid #a7f3d0', borderRadius: 12, padding: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: '#059669', textTransform: 'uppercase' }}>
                              STEP 1: SCAN & PAY TO VENUE
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                              ₹{amountDue}
                            </span>
                          </div>
                          {holdBalance > 0 && (
                            <div style={{ fontSize: 11.5, color: '#92400e', marginTop: -6, marginBottom: 10 }}>
                              Advance to lock the slot — ₹{holdBalance} balance due at the venue.
                            </div>
                          )}

                          {/* Dynamic QR Code Container */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 14 }}>
                            <div style={{ background: '#ffffff', padding: 10, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 14px rgba(0,0,0,0.06)', marginBottom: 8 }}>
                              <img
                                src={activeHold.paymentOrder?.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(activeHold.paymentOrder?.upiUri || `upi://pay?pa=${venue.upi_id || ''}&pn=${encodeURIComponent(venue.name)}&am=${amountDue}&cu=INR`)}`}
                                alt="Venue Owner UPI QR Code"
                                style={{ width: 170, height: 170, display: 'block' }}
                              />
                            </div>
                            <div style={{ fontSize: 11.5, color: '#64748b', textAlign: 'center' }}>
                              Scan using GPay, PhonePe, Paytm or BHIM
                            </div>
                          </div>

                          {/* Payee Info & Copy UPI ID */}
                          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 12 }}>
                            <div style={{ color: '#64748b', fontSize: 11 }}>Payee Name</div>
                            <div style={{ color: '#0f172a', fontWeight: 600, marginBottom: 6 }}>
                              {activeHold.paymentOrder?.venueName || venue.upi_name || venue.name}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>UPI ID: </span>
                                <span style={{ color: 'var(--accent-neon)', fontWeight: 700 }}>
                                  {activeHold.paymentOrder?.upiId || venue.upi_id || 'Not set'}
                                </span>
                              </div>
                              <button
                                onClick={() => {
                                  const id = activeHold.paymentOrder?.upiId || venue.upi_id;
                                  if (!id) return;
                                  navigator.clipboard.writeText(id);
                                  setCopiedUpi(true);
                                  setTimeout(() => setCopiedUpi(false), 2000);
                                }}
                                style={{
                                  background: copiedUpi ? '#ecfdf5' : '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: 6,
                                  color: copiedUpi ? '#059669' : '#334155',
                                  padding: '4px 8px',
                                  fontSize: 11,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                {copiedUpi ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                                {copiedUpi ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>

                          {/* Mobile Intent Button */}
                          {activeHold.paymentOrder?.upiUri && (
                            <a
                              href={activeHold.paymentOrder.upiUri}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                color: '#1d4ed8',
                                textDecoration: 'none',
                                padding: '8px 12px',
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: 600,
                                marginBottom: 14
                              }}
                            >
                              <ExternalLink size={13} /> Open in UPI App (Mobile)
                            </a>
                          )}

                          {/* Step 2: UTR Reference Input */}
                          <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: 12 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#059669', marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                              STEP 2: ENTER 12-DIGIT UPI REFERENCE / UTR *
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. 423891029381"
                              className="nexus-input"
                              style={{ width: '100%', letterSpacing: '0.08em', fontWeight: 600 }}
                              value={upiUtr}
                              onChange={e => setUpiUtr(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                            />
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                              Found in your UPI receipt (GPay / PhonePe / Paytm / BHIM)
                            </div>
                          </div>

                          {venue.cancellation_policy && (
                            <div style={{ marginTop: 12, padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e', lineHeight: 1.45 }}>
                              <strong>Cancellation:</strong> {venue.cancellation_policy}
                            </div>
                          )}
                        </div>
                        );
                      })()}

                      <button
                        className="btn-primary"
                        style={{ width: '100%', background: '#059669', padding: '12px' }}
                        disabled={isHolding}
                        onClick={handleFinalizeBooking}
                      >
                        {isHolding ? 'Submitting...' : 'Submit UTR & Confirm Slot'}
                      </button>

                      <button
                        onClick={handleCancelHold}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: 12,
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        Cancel hold & choose different slot
                      </button>
                    </div>
                  )}
                  </>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: 13.5 }}>
                  Select a court and available time slot to view price and reserve.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 28, padding: '22px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>Reviews</h3>
          {venue.review_count > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: '#0f172a', fontWeight: 600 }}>
              <Star size={16} fill="#f59e0b" color="#f59e0b" />
              {venue.avg_rating} <span style={{ color: '#64748b', fontWeight: 500 }}>({venue.review_count} review{venue.review_count === 1 ? '' : 's'})</span>
            </div>
          ) : (
            <span style={{ fontSize: 13, color: '#94a3b8' }}>No reviews yet</span>
          )}
        </div>

        {reviews.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
            {reviews.map((r) => (
              <div key={r.id} style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5, color: '#0f172a' }}>{r.customer_name || 'Player'}</span>
                  <span style={{ fontSize: 11.5, color: '#94a3b8' }}>{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <div style={{ display: 'flex', gap: 2, marginBottom: 6 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={13} fill={n <= r.rating ? '#f59e0b' : 'none'} color={n <= r.rating ? '#f59e0b' : '#cbd5e1'} />
                  ))}
                </div>
                {r.comment && <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{r.comment}</div>}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmitReview} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', marginBottom: 10 }}>Played here? Leave a review</div>

          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setReviewRating(n)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                aria-label={`Rate ${n} star${n === 1 ? '' : 's'}`}
              >
                <Star size={22} fill={n <= reviewRating ? '#f59e0b' : 'none'} color={n <= reviewRating ? '#f59e0b' : '#cbd5e1'} />
              </button>
            ))}
          </div>

          <textarea
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder="Share your experience (optional)"
            rows={3}
            style={{
              width: '100%',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 13.5,
              fontFamily: 'inherit',
              resize: 'vertical',
              marginBottom: 10,
              background: '#fff',
              color: '#0f172a'
            }}
          />

          {!customerPhone && (
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Phone number used for booking"
              style={{
                width: '100%',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 13.5,
                marginBottom: 10,
                background: '#fff',
                color: '#0f172a'
              }}
            />
          )}

          {reviewError && (
            <div style={{ color: '#dc2626', fontSize: 12.5, marginBottom: 10 }}>{reviewError}</div>
          )}
          {reviewSuccess && (
            <div style={{ color: '#059669', fontSize: 12.5, marginBottom: 10 }}>{reviewSuccess}</div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={submittingReview}
            style={{ padding: '9px 18px', fontSize: 13.5 }}
          >
            {submittingReview ? 'Submitting...' : 'Submit Review'}
          </button>
        </form>
      </div>
    </div>
  );
}
