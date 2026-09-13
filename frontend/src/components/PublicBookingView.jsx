import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api.js';
import {
  Calendar, Clock, MapPin, Phone, ShieldCheck, ChevronRight,
  Share2, Users, ArrowLeft, CheckCircle, AlertCircle,
  Split, Sparkles, Trophy, Lock, QrCode, Copy, CheckCircle2,
  ExternalLink, RefreshCw, X
} from 'lucide-react';

export default function PublicBookingView({ slug = 'nexus-central-koramangala', onBack, currentUser }) {
  const [venue, setVenue] = useState(null);
  const [sports, setSports] = useState([]);
  const [selectedSport, setSelectedSport] = useState(null);
  const [selectedCourt, setSelectedCourt] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(true);
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
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);

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
  const [showVenueDetails, setShowVenueDetails] = useState(false);
  const [showBookingSheet, setShowBookingSheet] = useState(false);
  const [isMobileBooking, setIsMobileBooking] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 960px)').matches : false
  );

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
      const res2 = await api.getVenueSlots(venue.id, selectedDate);
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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(max-width: 960px)');
    const apply = () => setIsMobileBooking(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    mq.addListener?.(apply);
    return () => {
      mq.removeEventListener?.('change', apply);
      mq.removeListener?.(apply);
    };
  }, []);

  useEffect(() => {
    if (!isMobileBooking || !showBookingSheet || !selectedSlot) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobileBooking, showBookingSheet, selectedSlot]);

  // Venue + sports (independent of slots so both can start immediately)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setErrorMsg('');
        const [data, sportsList] = await Promise.all([
          api.getPublicVenue(slug),
          api.getSports().catch(() => []),
        ]);
        if (cancelled) return;
        setVenue(data);
        if (data.sport_ids?.length > 0) {
          setSelectedSport(data.sport_ids[0]);
        }
        if (data.courts?.length > 0) {
          setSelectedCourt(data.courts[0]);
        }
        setSports(sportsList);
      } catch (err) {
        if (!cancelled) setErrorMsg('Failed to load venue: ' + err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [slug]);

  // Slots by slug — starts on mount in parallel with venue (no wait for venue.id)
  useEffect(() => {
    let cancelled = false;
    async function loadSlots() {
      try {
        setSlotsLoading(true);
        const res = await api.getVenueSlots(slug, selectedDate);
        if (cancelled) return;
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
        if (!cancelled) setSlots([]);
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    }
    loadSlots();
    return () => { cancelled = true; };
  }, [slug, selectedDate]);

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
      const refreshed = await api.getVenueSlots(venue.id, selectedDate);
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

  // Step 2: Confirm Payment — desktop uses UTR; mobile uses screenshot + WhatsApp
  async function handleFinalizeBooking() {
    if (!activeHold?.bookingId) return;

    if (isMobileBooking) {
      if (!paymentProofFile) {
        setErrorMsg('Please upload a screenshot of your UPI payment');
        return;
      }
    } else {
      if (!upiUtr.trim()) {
        setErrorMsg('Please enter your 12-digit UPI Reference / UTR Number from your UPI payment app receipt');
        return;
      }
      if (upiUtr.trim().length < 8) {
        setErrorMsg('UPI Reference / UTR must be at least 8 to 12 digits');
        return;
      }
    }

    setIsHolding(true);
    setErrorMsg('');
    try {
      let paymentProofUrl = '';
      if (isMobileBooking && paymentProofFile) {
        const uploaded = await api.uploadPaymentProof(activeHold.bookingId, paymentProofFile);
        paymentProofUrl = uploaded.url;
      }

      const res = await api.confirmBooking({
        bookingId: activeHold.bookingId,
        paymentProvider: 'upi',
        utr: isMobileBooking ? '' : upiUtr.trim(),
        paymentProofUrl: paymentProofUrl || undefined,
        splitCount: 1,
        participants: [{
          name: customerName || 'Organizer',
          phone: customerPhone || ''
        }]
      });
      setConfirmedBooking({ ...res, paymentProofUrl });
      setCheckoutStep('confirmed');

      if (isMobileBooking && paymentProofUrl) {
        openOwnerWhatsAppWithProof(paymentProofUrl);
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsHolding(false);
    }
  }

  function normalizeWhatsAppDigits(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 10) return `91${digits}`;
    return digits;
  }

  function openOwnerWhatsAppWithProof(proofUrl) {
    const wa = normalizeWhatsAppDigits(venue?.whatsapp_number);
    if (!wa) {
      setErrorMsg('Booking confirmed, but this turf has no WhatsApp number set. The owner will verify your screenshot in Owner Hub.');
      return;
    }
    const sportInfo = sports.find((s) => {
      const sel = String(selectedSport || selectedSlot?.sport_id || '');
      return String(s.id) === sel || s.slug === sel;
    });
    const sportLabel = sportInfo?.name || selectedSlot?.sport_slug || 'Sport';
    const courtLabel = selectedSlot?.court_name || selectedCourt?.name || 'Court';
    const dateLabel = String(selectedSlot?.date || selectedDate || '').slice(0, 10);
    const timeLabel = `${String(selectedSlot?.start_time || '').slice(0, 5)}–${String(selectedSlot?.end_time || '').slice(0, 5)}`;
    const amountDue = activeHold?.advanceAmount ?? selectedSlot?.price;
    const text = [
      `Hi, I booked ${venue.name}.`,
      `Date: ${dateLabel}`,
      `Time: ${timeLabel}`,
      `Turf/Court: ${courtLabel}`,
      `Sport: ${sportLabel}`,
      `Amount paid: ₹${amountDue}`,
      `Player: ${customerName || 'Player'} (${customerPhone || 'n/a'})`,
      `Payment screenshot: ${proofUrl}`,
      '',
      'Please verify and confirm my booking.'
    ].join('\n');
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }

  function buildUpiPayLinks({ upiId, payeeName, amount, bookingId }) {
    const pa = String(upiId || '').trim();
    if (!pa) return null;
    const params = new URLSearchParams({
      pa,
      pn: String(payeeName || venue?.name || 'Venue').slice(0, 50),
      am: String(amount ?? ''),
      cu: 'INR'
    });
    if (bookingId) {
      params.set('tr', String(bookingId).replace(/-/g, '').slice(0, 35));
      params.set('tn', `NexusPlay ${String(bookingId).slice(0, 8)}`);
    }
    const qs = params.toString();
    // App-specific schemes so Android doesn't default to WhatsApp Pay for upi://
    return {
      gpay: `tez://upi/pay?${qs}`,
      phonepe: `phonepe://pay?${qs}`,
      paytm: `paytmmp://pay?${qs}`,
      generic: `upi://pay?${qs}`
    };
  }

  function openUpiPayLink(uri) {
    if (!uri) return;
    // Prefer navigating the top window — more reliable for custom schemes
    // than target=_blank, which some mobile browsers block or mis-route.
    window.location.href = uri;
  }

  function handlePaymentProofPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
      setErrorMsg('Please upload a PNG, JPG or WEBP screenshot');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Screenshot must be under 5MB');
      return;
    }
    setErrorMsg('');
    setPaymentProofFile(file);
    setPaymentProofPreview(URL.createObjectURL(file));
  }

  async function handleCancelHold() {
    if (activeHold?.bookingId) {
      try {
        await api.releaseHold({ bookingId: activeHold.bookingId, slotId: selectedSlot?.id });
      } catch (e) {}
    }
    setActiveHold(null);
    setSelectedSlot(null);
    setShowBookingSheet(false);
    setCheckoutStep('slots');
    setUpiUtr('');
    setPaymentProofFile(null);
    setPaymentProofPreview('');
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

  // Filter courts by selected sport (UUID or slug). Also merge in any court
  // that still has slots for that sport so inactive/unpublished courts aren't
  // silently dropped while the owner live calendar still shows them.
  function sportMatches(entity) {
    if (!selectedSport) return true;
    const sel = String(selectedSport);
    const id = String(entity?.sport_id || '');
    const slug = String(entity?.sport_slug || '');
    if (id === sel || slug === sel) return true;
    const sport = sports.find((s) => String(s.id) === sel || s.slug === sel);
    if (!sport) return false;
    return id === String(sport.id) || slug === sport.slug || id === sport.slug;
  }

  const filteredCourts = (() => {
    const map = new Map();
    for (const c of Array.isArray(venue.courts) ? venue.courts : []) {
      if (sportMatches(c)) map.set(c.id, c);
    }
    for (const s of slots) {
      if (!sportMatches(s)) continue;
      if (!map.has(s.court_id)) {
        map.set(s.court_id, {
          id: s.court_id,
          name: s.court_name || 'Court',
          sport_id: s.sport_id,
          capacity: null,
          slot_duration_minutes: null,
          base_price: s.price
        });
      }
    }
    return [...map.values()];
  })();

  // Owner-configurable deposit — see Business Setup's "Advance Payment %".
  // 100 (the default) means "pay in full to lock the slot", same as
  // before this setting existed.
  const advancePercent = venue.advance_payment_percent ?? 100;
  const guestHostEnabled = venue.allow_guest_open_games !== false;
  const advanceAmount = selectedSlot
    ? (advancePercent >= 100 ? selectedSlot.price : Math.max(1, Math.round((selectedSlot.price * advancePercent) / 100)))
    : 0;
  const balanceAtVenue = selectedSlot ? selectedSlot.price - advanceAmount : 0;

  function selectSlot(slot) {
    const court = (venue.courts || []).find((c) => c.id === slot.court_id)
      || filteredCourts.find((c) => c.id === slot.court_id);
    if (court) setSelectedCourt(court);
    // Prefer UUID from venue.sport_ids / courts so the sport chip stays selected
    const sportUuid = sports.find(
      (s) => s.id === slot.sport_id || s.slug === slot.sport_id || s.slug === slot.sport_slug
    )?.id || slot.sport_id;
    if (sportUuid) setSelectedSport(sportUuid);
    setSelectedSlot(slot);
    setErrorMsg('');
    setJoinGameError(''); setJoinGameSuccess('');
    setFullSlotError(''); setFullSlotSuccess('');
    setJoinPaymentStep('form'); setJoinUtr('');
    setSlotIntent('book');
    setHostError('');
    setHostSuccess('');
    prepareHostDefaults(slot);
    setShowBookingSheet(true);
  }

  async function closeBookingSheet() {
    if (activeHold?.bookingId) {
      await handleCancelHold();
    } else {
      setSelectedSlot(null);
      setSlotIntent('book');
      setErrorMsg('');
    }
    setShowBookingSheet(false);
  }

  function formatSlotTime(t) {
    return String(t || '').slice(0, 5);
  }

  function localDateStr(base = new Date(), offsetDays = 0) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  return (
    <div className="turf-booking-page">
      {/* Compact turf header — slots come next, not after a gallery */}
      <div className="turf-booking-topbar">
        <button
          type="button"
          onClick={onBack}
          className="btn-secondary turf-back-btn"
        >
          <ArrowLeft size={16} />
          <span className="header-label-full">Back to Venues</span>
          <span className="header-label-short">Back</span>
        </button>
        <div className="turf-booking-title-block">
          <h1 className="font-display turf-booking-title">{venue.name}</h1>
          <div className="turf-booking-subtitle">
            <MapPin size={13} />
            <span>{venue.address}</span>
            {venue.open_time && venue.close_time && (
              <span className="turf-booking-hours">· {venue.open_time}–{venue.close_time}</span>
            )}
          </div>
        </div>
        <div className="turf-booking-top-actions">
          <button
            type="button"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
                alert('Venue shareable link copied to clipboard!');
              }
            }}
            className="btn-secondary turf-share-btn"
            title="Share Venue Link"
          >
            <Share2 size={15} />
            <span className="header-label-full">Share</span>
          </button>
        </div>
      </div>

      {/* MAIN BOOKING INTERFACE */}
      {checkoutStep === 'confirmed' && confirmedBooking ? (
        <div className="nexus-card animate-fade-in" style={{ padding: 36, textAlign: 'center', background: '#ffffff', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'inline-flex', padding: 16, borderRadius: '50%', background: '#d1fae5', color: '#059669', marginBottom: 16 }}>
            <CheckCircle size={48} />
          </div>
          <h2 className="font-display" style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>
            Booking Confirmed!
          </h2>
          <p style={{ color: '#64748b', marginTop: 8, fontSize: 14 }}>
            Booking Ref: <strong style={{ color: '#0f172a' }}>{confirmedBooking.booking?.id}</strong>
          </p>

          <div style={{ maxWidth: 520, margin: '16px auto', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: 16, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#059669', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
              <ShieldCheck size={18} /> Slot booked
            </div>
            <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.5 }}>
              Your payment proof has been submitted to {venue.name}. Amount recorded: ₹{confirmedBooking.booking?.amount_paid ?? confirmedBooking.booking?.total_amount}.
              {confirmedBooking.utr || confirmedBooking.booking?.upi_utr ? (
                <> UTR <strong>{confirmedBooking.utr || confirmedBooking.booking?.upi_utr}</strong> is on file.</>
              ) : null}
              {confirmedBooking.paymentProofUrl || confirmedBooking.booking?.payment_proof_url ? (
                <> If WhatsApp opened, tap Send to share the booking details and screenshot with the turf.</>
              ) : null}
            </p>
          </div>

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

          <div className="booking-cta-row">
            <button className="btn-primary" onClick={() => { setCheckoutStep('slots'); setSelectedSlot(null); setConfirmedBooking(null); setActiveHold(null); setUpiUtr(''); }}>
              Book Another Slot
            </button>
            <button className="btn-secondary" onClick={onBack}>
              Explore More Turfs
            </button>
          </div>
        </div>
      ) : (
        <>
        <div className="turf-booking-chrome">
          <div className="turf-date-strip scroll-pills" role="tablist" aria-label="Choose date">
            {Array.from({ length: 7 }).map((_, i) => {
              const d = new Date();
              d.setHours(12, 0, 0, 0);
              d.setDate(d.getDate() + i);
              const dStr = localDateStr(new Date(), i);
              const isSelected = selectedDate === dStr;
              const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
              const dayNum = d.getDate();
              const monthName = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
              return (
                <button
                  key={dStr}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`turf-date-chip${isSelected ? ' is-selected' : ''}`}
                  onClick={() => { setSelectedDate(dStr); setSelectedSlot(null); }}
                >
                  <span className="turf-date-dow">{i === 0 ? 'TODAY' : dayName}</span>
                  <span className="turf-date-num">{dayNum}</span>
                  <span className="turf-date-mon">{monthName}</span>
                </button>
              );
            })}
          </div>

          {(Array.isArray(venue.sport_ids) ? venue.sport_ids : []).length > 0 && (
            <div className="turf-filter-row scroll-pills" role="tablist" aria-label="Select sport">
              {(Array.isArray(venue.sport_ids) ? venue.sport_ids : []).map((sport) => {
                const sportInfo = sports.find((s) => s.id === sport || s.slug === sport);
                return (
                  <button
                    key={sport}
                    type="button"
                    role="tab"
                    aria-selected={selectedSport === sport}
                    className={`turf-filter-chip${selectedSport === sport ? ' is-active' : ''}`}
                    onClick={() => {
                      setSelectedSport(sport);
                      setSelectedSlot(null);
                      const matchingCourt = (Array.isArray(venue.courts) ? venue.courts : []).find((c) => {
                        const sid = String(c.sport_id || '');
                        return sid === String(sport) || sid === sportInfo?.slug || sid === String(sportInfo?.id || '');
                      });
                      if (matchingCourt) setSelectedCourt(matchingCourt);
                    }}
                  >
                    {sportInfo ? `${sportInfo.icon} ${sportInfo.name}` : sport}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="public-booking-layout">
          {/* Left: court cards with open slots (BookMyShow-style) */}
          <div className="turf-courts-column">
            {filteredCourts.length === 0 ? (
              <div className="turf-empty-slots">No courts available for this sport.</div>
            ) : (
              filteredCourts.map((crt) => {
                const courtSlots = slots
                  .filter(
                    (s) =>
                      s.court_id === crt.id &&
                      (s.status === 'open' || s.status === 'held' || s.status === 'booked')
                  )
                  .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
                return (
                  <div key={crt.id} className="turf-court-card">
                    <div className="turf-court-card-head">
                      <div>
                        <div className="turf-court-name">{crt.name}</div>
                        <div className="turf-court-meta">
                          {[
                            crt.capacity ? `${crt.capacity} players` : null,
                            crt.slot_duration_minutes ? `${crt.slot_duration_minutes}m` : null,
                            crt.base_price != null ? `from ₹${crt.base_price}/hr` : null
                          ].filter(Boolean).join(' · ') || 'Slots for this court'}
                        </div>
                      </div>
                    </div>
                    {slotsLoading ? (
                      <div className="turf-slot-row turf-slot-row-skeleton" aria-busy="true" aria-label="Loading slots">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <span key={i} className="turf-slot-skeleton" />
                        ))}
                      </div>
                    ) : courtSlots.length === 0 ? (
                      <div className="turf-court-no-slots">No slots on this date</div>
                    ) : (
                      <div className="turf-slot-row">
                        {courtSlots.map((slot) => {
                          const isOpen = slot.status === 'open';
                          const isHeld = slot.status === 'held';
                          const isBooked = slot.status === 'booked';
                          const isSelected = selectedSlot?.id === slot.id;
                          const hasOpenGame = !!slot.game && (isOpen || isHeld);
                          const canTap = isOpen || (isHeld && !!slot.game);
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              disabled={!canTap}
                              className={`turf-slot-btn${isSelected ? ' is-selected' : ''}${isHeld ? ' is-held' : ''}${isBooked || (!isOpen && !hasOpenGame) ? ' is-locked' : ''}`}
                              onClick={() => selectSlot(slot)}
                            >
                              <span className="turf-slot-time">{formatSlotTime(slot.start_time)}</span>
                              <span className="turf-slot-sub">
                                {isBooked
                                  ? 'Booked'
                                  : isOpen
                                  ? `₹${slot.price}`
                                  : hasOpenGame
                                  ? `${slot.game.current_players}/${slot.game.required_players} joined`
                                  : 'Held'}
                              </span>
                              {hasOpenGame && isOpen && (
                                <span className="turf-slot-game">
                                  {slot.game.current_players}/{slot.game.required_players}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Checkout Summary — in-grid on desktop; portaled viewport sheet on phone */}
          {(() => {
            const summaryCard = (
            <div
              className="nexus-card turf-booking-summary"
              style={{
                padding: 22,
                position: isMobileBooking ? 'relative' : 'sticky',
                top: isMobileBooking ? undefined : 20,
                background: '#ffffff',
                border: '1px solid #e2e8f0'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="turf-summary-header">
                <h3 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  {isMobileBooking && activeHold ? 'Pay now' : 'Booking Summary'}
                </h3>
                <button
                  type="button"
                  className="turf-summary-close"
                  onClick={closeBookingSheet}
                  aria-label="Close booking summary"
                >
                  <X size={18} />
                </button>
              </div>

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
                  {!(isMobileBooking && activeHold) && (
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 13, color: '#64748b' }}>{venue.name}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{selectedCourt?.name}</div>
                    <div style={{ fontSize: 13, color: '#059669', marginTop: 4, fontWeight: 600 }}>
                      {selectedDate} · {selectedSlot.start_time} to {selectedSlot.end_time}
                    </div>
                  </div>
                  )}

                  {guestHostEnabled && !activeHold && (
                    <div
                      className="mobile-grid-1"
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
                        <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
                  {!(isMobileBooking && activeHold) && activeHold && lockCountdown > 0 && (
                    <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Lock size={20} style={{ color: '#059669' }} />
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--accent-neon)', fontWeight: 700 }}>SLOT LOCKED FOR YOU</div>
                        <div style={{ fontSize: 13, color: '#065f46' }}>
                          Lock expires in <strong>{Math.floor(lockCountdown / 60)}m {lockCountdown % 60}s</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {errorMsg && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#b91c1c', padding: 10, borderRadius: 8, fontSize: 12.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertCircle size={16} /> {errorMsg}
                    </div>
                  )}

                  {/* Pre-lock: contact + fee. Post-lock on mobile: jump straight to pay. */}
                  {!(isMobileBooking && activeHold) && (
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

                      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '10px 12px' }}>
                        <QrCode size={16} style={{ color: '#059669', flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5, color: '#065f46', fontWeight: 600 }}>
                          Pay via the venue owner's UPI QR to lock this slot
                        </span>
                      </div>

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
                    </>
                  )}

                  {!activeHold ? (
                    <button
                      className="btn-primary"
                      style={{ width: '100%', padding: '12px' }}
                      disabled={isHolding}
                      onClick={handleLockSlot}
                    >
                      {isHolding ? 'Locking Slot...' : (isMobileBooking ? 'Lock Slot & Pay (10m Hold)' : 'Lock Slot & Show UPI QR (10m Hold)')}
                    </button>
                  ) : isMobileBooking ? (
                    (() => {
                      const amountDue = activeHold.advanceAmount ?? selectedSlot.price;
                      const holdBalance = (activeHold.totalAmount ?? selectedSlot.price) - amountDue;
                      const links = buildUpiPayLinks({
                        upiId: activeHold.paymentOrder?.upiId || venue.upi_id,
                        payeeName: activeHold.paymentOrder?.payeeName || venue.upi_name || venue.name,
                        amount: amountDue,
                        bookingId: activeHold.bookingId
                      });
                      const upiId = activeHold.paymentOrder?.upiId || venue.upi_id;
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                            <div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>
                                {selectedCourt?.name} · {selectedSlot.start_time}–{selectedSlot.end_time}
                              </div>
                              <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1.15 }}>
                                Pay ₹{amountDue}
                              </div>
                              {holdBalance > 0 && (
                                <div style={{ fontSize: 11, color: '#92400e', marginTop: 2 }}>
                                  ₹{holdBalance} balance at venue
                                </div>
                              )}
                            </div>
                            {lockCountdown > 0 && (
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', whiteSpace: 'nowrap' }}>
                                {Math.floor(lockCountdown / 60)}:{String(lockCountdown % 60).padStart(2, '0')} left
                              </div>
                            )}
                          </div>

                          {!links ? (
                            <div style={{ fontSize: 12.5, color: '#dc2626' }}>
                              This turf has not set a UPI ID yet. Payment cannot start.
                            </div>
                          ) : (
                            <div className="turf-pay-grid">
                              <button type="button" onClick={() => openUpiPayLink(links.gpay)} style={{ border: 'none', color: '#fff', background: '#1a73e8', fontWeight: 700, cursor: 'pointer' }}>
                                GPay
                              </button>
                              <button type="button" onClick={() => openUpiPayLink(links.phonepe)} style={{ border: 'none', color: '#fff', background: '#5f259f', fontWeight: 700, cursor: 'pointer' }}>
                                PhonePe
                              </button>
                              <button type="button" onClick={() => openUpiPayLink(links.paytm)} style={{ border: 'none', color: '#fff', background: '#00baf2', fontWeight: 700, cursor: 'pointer' }}>
                                Paytm
                              </button>
                              <button type="button" onClick={() => openUpiPayLink(links.generic)} style={{ border: '1px solid #cbd5e1', color: '#0f172a', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                                Other UPI
                              </button>
                            </div>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 10, color: '#64748b' }}>UPI ID</div>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {upiId || 'Not set'}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (!upiId) return;
                                navigator.clipboard.writeText(upiId);
                                setCopiedUpi(true);
                                setTimeout(() => setCopiedUpi(false), 2000);
                              }}
                              style={{
                                flexShrink: 0,
                                background: copiedUpi ? '#ecfdf5' : '#fff',
                                border: '1px solid #cbd5e1',
                                borderRadius: 6,
                                color: copiedUpi ? '#059669' : '#334155',
                                padding: '5px 8px',
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

                          <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#059669', marginBottom: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                              Payment screenshot *
                            </label>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/*"
                              onChange={handlePaymentProofPick}
                              style={{ width: '100%', fontSize: 12 }}
                            />
                            {paymentProofPreview && (
                              <img
                                src={paymentProofPreview}
                                alt="Payment screenshot preview"
                                style={{ width: '100%', maxHeight: 96, objectFit: 'contain', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', marginTop: 6 }}
                              />
                            )}
                          </div>

                          <button
                            className="btn-primary"
                            style={{ width: '100%', background: '#059669', padding: '11px' }}
                            disabled={isHolding}
                            onClick={handleFinalizeBooking}
                          >
                            {isHolding ? 'Submitting...' : 'Confirm and send to turf'}
                          </button>

                          <button
                            type="button"
                            onClick={handleCancelHold}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#64748b',
                              fontSize: 12,
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              padding: 0
                            }}
                          >
                            Cancel hold
                          </button>
                        </div>
                      );
                    })()
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
                                type="button"
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
                  Select an available time slot to view price and reserve.
                </div>
              )}
            </div>
            );

            if (isMobileBooking) {
              if (!showBookingSheet || !selectedSlot) return null;
              return createPortal(
                <div
                  className="turf-booking-sheet-overlay"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Booking summary"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) closeBookingSheet();
                  }}
                >
                  {summaryCard}
                </div>,
                document.body
              );
            }

            return (
              <div className="turf-booking-summary-col">
                {summaryCard}
              </div>
            );
          })()}
        </div>

        <div className="turf-about-section">
          <button
            type="button"
            className="turf-about-toggle"
            onClick={() => setShowVenueDetails((v) => !v)}
            aria-expanded={showVenueDetails}
          >
            {showVenueDetails ? 'Hide venue details' : 'Photos & policies'}
            <ChevronRight size={16} style={{ transform: showVenueDetails ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>
          {showVenueDetails && (
            <div className="nexus-card turf-about-body" style={{ overflow: 'hidden', marginTop: 10 }}>
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
              <div style={{ padding: 18 }}>
                {venue.description && (
                  <p style={{ color: '#475569', margin: '0 0 14px', fontSize: 14, lineHeight: 1.55 }}>
                    {venue.description}
                  </p>
                )}
                {(venue.cancellation_policy || venue.rules) && (
                  <div
                    className="mobile-grid-1"
                    style={{ display: 'grid', gridTemplateColumns: venue.cancellation_policy && venue.rules ? '1fr 1fr' : '1fr', gap: 12 }}
                  >
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
          )}
        </div>
        </>
      )}
    </div>
  );
}
