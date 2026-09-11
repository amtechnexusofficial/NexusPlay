-- Owner WhatsApp number used to share booking confirmations with players.
alter table venues
  add column if not exists whatsapp_number text;
