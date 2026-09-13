-- Payment screenshot proof for mobile UPI bookings (alongside optional UTR).
alter table bookings
  add column if not exists payment_proof_url text;
