import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { CheckCircle2, Split, QrCode, ArrowLeft, AlertCircle } from 'lucide-react';

export default function SplitPaymentView({ token, onClose }) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [share, setShare] = useState(null);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [utr, setUtr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [paidJustNow, setPaidJustNow] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await api.getSplitShare(token);
        setShare(res.share);
        setPaymentOrder(res.paymentOrder);
      } catch (err) {
        setErrorMsg(err.message || 'This payment link is invalid or has expired.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (utr.trim().length < 8) {
      setErrorMsg('Please enter a valid UPI reference / UTR number (at least 8 characters).');
      return;
    }
    setErrorMsg('');
    setSubmitting(true);
    try {
      const res = await api.paySplitShare(token, { utr: utr.trim() });
      setShare(res.share);
      setPaidJustNow(true);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit payment');
    } finally {
      setSubmitting(false);
    }
  }

  const wrapStyle = { maxWidth: 460, margin: '0 auto', padding: '48px 20px' };
  const cardStyle = { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, boxShadow: '0 4px 14px rgba(0,0,0,0.05)' };

  if (loading) {
    return (
      <div style={wrapStyle}>
        <div style={{ ...cardStyle, textAlign: 'center', color: '#64748b' }}>Loading payment details…</div>
      </div>
    );
  }

  if (!share) {
    return (
      <div style={wrapStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <AlertCircle size={32} color="#dc2626" style={{ margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Payment link not found</h2>
          <p style={{ fontSize: 13.5, color: '#64748b', marginBottom: 18 }}>{errorMsg}</p>
          <button className="btn-secondary" onClick={onClose}><ArrowLeft size={14} /> Back to NexusPlay</button>
        </div>
      </div>
    );
  }

  const isPaid = share.payment_status === 'paid';

  return (
    <div style={wrapStyle}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#059669', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
          <Split size={16} /> Split Payment Request
        </div>
        <h2 style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', margin: '0 0 16px' }}>
          {share.venue_name} · {share.court_name}
        </h2>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', marginBottom: 18, fontSize: 13, color: '#334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span style={{ color: '#64748b' }}>Slot</span>
            <strong>{share.date} · {share.start_time} - {share.end_time}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span style={{ color: '#64748b' }}>Requested for</span>
            <strong>{share.name}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span style={{ color: '#64748b' }}>Your share</span>
            <strong style={{ color: '#059669', fontSize: 16 }}>₹{share.share_amount}</strong>
          </div>
        </div>

        {errorMsg && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#b91c1c' }}>
            {errorMsg}
          </div>
        )}

        {isPaid ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircle2 size={40} color="#059669" style={{ margin: '0 auto 10px' }} />
            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 15 }}>
              {paidJustNow ? 'Payment recorded — thanks!' : 'This share has already been paid'}
            </div>
            <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>The organizer can see this in their booking confirmation.</p>
          </div>
        ) : (
          <>
            {paymentOrder && (
              <div style={{ textAlign: 'center', marginBottom: 18 }}>
                <img
                  src={paymentOrder.qrCodeUrl}
                  alt="UPI QR code"
                  style={{ width: 180, height: 180, borderRadius: 10, border: '1px solid #e2e8f0' }}
                />
                <p style={{ fontSize: 11.5, color: '#64748b', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <QrCode size={13} /> Scan with any UPI app, or pay to <strong>{paymentOrder.upiId}</strong>
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>
                UPI Reference / UTR Number
              </label>
              <input
                type="text"
                className="nexus-input"
                style={{ width: '100%', marginBottom: 12 }}
                placeholder="e.g. 302516789432"
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
              />
              <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Confirm My Payment'}
              </button>
            </form>
          </>
        )}

        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 12.5, marginTop: 16, cursor: 'pointer', display: 'block', width: '100%', textAlign: 'center' }}>
          ← Back to NexusPlay
        </button>
      </div>
    </div>
  );
}
