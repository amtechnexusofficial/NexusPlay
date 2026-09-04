// Abstract payment provider architecture for direct-to-venue routing.
// NexusPlay does not pool or hold customer money — transactions route
// directly to the venue owner's own UPI ID (India) today; Razorpay/Stripe
// adapters can be added later behind this same interface without touching
// booking logic.

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

export function getPaymentProvider(providerName = "upi") {
  switch ((providerName || "upi").toLowerCase()) {
    case "cash":
      return new CashAdapter();
    case "upi":
    default:
      return new OwnerUpiAdapter();
  }
}
