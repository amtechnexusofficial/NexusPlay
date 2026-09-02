// Abstract Payment Provider Architecture for Direct-to-Venue Routing
// NexusPlay does NOT pool or hold funds; transactions route directly to venue owner UPI QR code

export class PaymentProvider {
  /**
   * Create an order or payment request
   * @param {Object} params - { amount, currency, bookingId, venue, customer }
   */
  async createOrder(params) {
    throw new Error('createOrder must be implemented by payment provider');
  }

  /**
   * Verify transaction
   * @param {Object} params - { bookingId, utr, verifiedBy }
   */
  async verifyPayment(params) {
    throw new Error('verifyPayment must be implemented by payment provider');
  }

  /**
   * Process refund or payment rejection
   * @param {Object} params - { bookingId, amount }
   */
  async refundPayment(params) {
    throw new Error('refundPayment must be implemented by payment provider');
  }
}

// 1. Direct Venue Owner UPI QR Adapter (0% Commission, Direct to Owner Bank)
export class OwnerUpiAdapter extends PaymentProvider {
  constructor(config = {}) {
    super();
    this.defaultUpiId = config.defaultUpiId || process.env.DEFAULT_VENUE_UPI_ID || 'koramangala.sports@okaxis';
    this.defaultUpiName = config.defaultUpiName || process.env.DEFAULT_VENUE_UPI_NAME || 'Nexus Central Arena';
  }

  async createOrder({ amount, currency = 'INR', bookingId, customer, venue }) {
    const upiId = venue?.upi_id || this.defaultUpiId;
    const payeeName = venue?.upi_name || venue?.name || this.defaultUpiName;
    const transactionNote = `NexusPlay Booking ${bookingId}`;

    // Standard NPCI UPI URI Specification (universal across GPay, PhonePe, Paytm, BHIM, Cred)
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&tr=${bookingId}&tn=${encodeURIComponent(transactionNote)}&cu=INR`;

    // Dynamic QR generation URL for display on screen
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&data=${encodeURIComponent(upiUri)}`;

    return {
      success: true,
      provider: 'owner_upi',
      upiId,
      payeeName,
      amount,
      currency,
      bookingId,
      upiUri,
      qrCodeUrl,
      customQrImage: venue?.upi_qr_image || null,
      instructions: 'Scan QR with GPay / PhonePe / Paytm or tap the UPI button on mobile. After paying, submit the 12-digit UPI Reference (UTR) number.'
    };
  }

  async verifyPayment({ bookingId, utr, verifiedBy = 'owner' }) {
    if (!utr || utr.trim().length < 8) {
      throw new Error('A valid 12-digit UPI Reference / UTR number is required');
    }
    return {
      verified: true,
      provider: 'owner_upi',
      utr: utr.trim(),
      verifiedBy,
      creditedAt: new Date().toISOString()
    };
  }

  async refundPayment({ bookingId, amount }) {
    return {
      success: true,
      message: 'Direct UPI refund must be initiated directly by the venue owner to customer UPI ID.',
      amount
    };
  }
}

// 2. Cash / Pay-at-Venue Adapter
export class CashAdapter extends PaymentProvider {
  async createOrder({ amount, currency = 'INR', bookingId }) {
    return {
      success: true,
      provider: 'cash',
      orderId: `cash_${bookingId}`,
      amount,
      currency,
      instructions: 'Pay at venue reception desk via cash or owner counter scanner.'
    };
  }

  async verifyPayment() {
    return { verified: true, paymentId: `cash_ver_${Date.now()}` };
  }

  async refundPayment({ amount }) {
    return { success: true, refundId: `cash_refund_${Date.now()}`, amount };
  }
}

// Factory (No third-party aggregator lock-in)
export function getPaymentProvider(providerName = 'upi') {
  switch (providerName.toLowerCase()) {
    case 'upi':
    case 'owner_upi':
    case 'qr':
      return new OwnerUpiAdapter();
    case 'cash':
      return new CashAdapter();
    default:
      return new OwnerUpiAdapter();
  }
}

