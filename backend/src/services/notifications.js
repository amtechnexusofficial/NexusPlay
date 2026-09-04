// STUB: logs instead of actually sending a WhatsApp/SMS message — same
// pattern as auth.js's sendOtpSms(). Swap this for a real provider
// (WhatsApp Business API, Twilio, Gupshup, etc.) before launch; every
// caller and the notifications table row stay the same either way, and
// the player dashboard's WhatsApp-alerts tab already reads real rows
// from this table.
async function dispatch(channel, phone, message) {
  console.log(`[notify:${channel}] to ${phone}: ${message}`);
}

// For call sites already inside withTransaction() (pg Client, $1/$2
// placeholders).
export async function notifyInTx(client, { organizationId, recipientPhone, type, message, channel = "whatsapp" }) {
  if (!recipientPhone) return;
  await client.query(
    `insert into notifications (organization_id, type, channel, status, recipient_phone, message, sent_at)
     values ($1, $2, $3, 'sent', $4, $5, now())`,
    [organizationId, type, channel, recipientPhone, message]
  );
  await dispatch(channel, recipientPhone, message);
}

// For call sites using the plain tagged-template sql client (no open
// transaction).
export async function notify(sql, { organizationId, recipientPhone, type, message, channel = "whatsapp" }) {
  if (!recipientPhone) return;
  await sql`
    insert into notifications (organization_id, type, channel, status, recipient_phone, message, sent_at)
    values (${organizationId}, ${type}, ${channel}, 'sent', ${recipientPhone}, ${message}, now())
  `;
  await dispatch(channel, recipientPhone, message);
}
