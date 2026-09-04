// Abstract payment provider architecture. Two live models: OwnerUpiAdapter
// routes money directly to the venue owner's own UPI ID (0% platform fee,
// no gateway involved), while RazorpayAdapter below is a real gateway that
// collects into NexusPlay's own Razorpay account and confirms instantly via
// signature verification — both implement the same interface so booking
// logic never needs to know which one it's talking to.

class PaymentProvider {
  async createOrder(_params) {
    throw new Error("createOrder must be implemented by payment provider");
  }
  async verifyPayment(_params) {
    throw new Error("verifyPayment must be implemented by payment provider");
  }
  async refundPayment(_params) {
    throw new Error("refundPayment must be implemented by payment provider");
  }
}

// Direct venue owner UPI QR adapter (0% commission, direct to owner bank).
class OwnerUpiAdapter extends PaymentProvider {
  async createOrder({ amount, currency = "INR", bookingId, venue }) {
    const upiId = venue?.upi_id;
    if (!upiId) {
      throw Object.assign(new Error("This venue has not set up a UPI ID for payments yet"), { status: 422 });
    }
    const payeeName = venue?.upi_name || venue?.name || "NexusPlay Venue";
    const transactionNote = `NexusPlay Booking ${bookingId}`;

    // Standard NPCI UPI URI spec — works with GPay, PhonePe, Paytm, BHIM, Cred.
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&tr=${bookingId}&tn=${encodeURIComponent(transactionNote)}&cu=INR`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&data=${encodeURIComponent(upiUri)}`;

    return {
      provider: "upi",
      upiId,
      payeeName,
      amount,
      currency,
      bookingId,
      upiUri,
      qrCodeUrl,
      customQrImage: venue?.upi_qr_image || null,
      instructions: "Scan the QR with GPay / PhonePe / Paytm or tap the UPI link on mobile. After paying, submit the UPI reference (UTR) number.",
    };
  }

  async verifyPayment({ utr }) {
    if (!utr || utr.trim().length < 8) {
      throw Object.assign(new Error("A valid UPI reference / UTR number is required"), { status: 400 });
    }
    return { verified: true, utr: utr.trim(), verifiedAt: new Date().toISOString() };
  }

  async refundPayment({ amount }) {
    return { initiated: true, note: "Direct UPI refunds are issued by the venue owner to the customer's UPI ID.", amount };
  }
}

// Pay-at-venue / cash adapter.
class CashAdapter extends PaymentProvider {
  async createOrder({ amount, currency = "INR", bookingId }) {
    return {
      provider: "cash",
      orderId: `cash_${bookingId}`,
      amount,
      currency,
      instructions: "Pay at the venue reception desk on arrival.",
    };
  }
  async verifyPayment() {
    return { verified: true };
  }
  async refundPayment({ amount }) {
    return { initiated: true, amount };
  }
}

async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Real online payment gateway (cards/UPI/netbanking/wallets) — unlike the
// direct-owner-UPI adapter above, this one actually collects the money
// (into NexusPlay's Razorpay account) and confirms instantly via a
// cryptographic signature instead of an owner manually checking their
// bank statement. Requires RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET secrets;
// see wrangler.toml for how to set them.
class RazorpayAdapter extends PaymentProvider {
  constructor(env) {
    super();
    this.keyId = env?.RAZORPAY_KEY_ID;
    this.keySecret = env?.RAZORPAY_KEY_SECRET;
  }

  _assertConfigured() {
    if (!this.keyId || !this.keySecret) {
      throw Object.assign(new Error("Online payment gateway is not configured for this venue yet. Please use UPI or pay at the venue."), { status: 422 });
    }
  }

  async createOrder({ amount, currency = "INR", bookingId }) {
    this._assertConfigured();
    const auth = btoa(`${this.keyId}:${this.keySecret}`);
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // paise
        currency,
        receipt: String(bookingId),
        notes: { bookingId: String(bookingId) },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw Object.assign(new Error(data?.error?.description || "Failed to create Razorpay order"), { status: 502 });
    }
    return {
      provider: "razorpay",
      keyId: this.keyId,
      orderId: data.id,
      amount,
      amountPaise: data.amount,
      currency: data.currency,
      bookingId,
      instructions: "Pay securely via card, UPI, netbanking or wallet.",
    };
  }

  async verifyPayment({ orderId, paymentId, signature }) {
    this._assertConfigured();
    if (!orderId || !paymentId || !signature) {
      throw Object.assign(new Error("Missing Razorpay payment details"), { status: 400 });
    }
    const expected = await hmacSha256Hex(this.keySecret, `${orderId}|${paymentId}`);
    if (expected !== signature) {
      throw Object.assign(new Error("Payment verification failed — signature mismatch"), { status: 400 });
    }
    return { verified: true, orderId, paymentId, verifiedAt: new Date().toISOString() };
  }

  async refundPayment({ paymentId, amount }) {
    this._assertConfigured();
    const auth = btoa(`${this.keyId}:${this.keySecret}`);
    const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify(amount ? { amount: Math.round(amount * 100) } : {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw Object.assign(new Error(data?.error?.description || "Refund failed"), { status: 502 });
    }
    return { initiated: true, refundId: data.id, amount };
  }
}

export function getPaymentProvider(providerName = "upi", env = null) {
  switch ((providerName || "upi").toLowerCase()) {
    case "cash":
      return new CashAdapter();
    case "razorpay":
      return new RazorpayAdapter(env);
    case "upi":
    default:
      return new OwnerUpiAdapter();
  }
}
