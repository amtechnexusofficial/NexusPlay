import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path resolution (Supports SQLite file path or local SQLite engine)
const defaultDbPath = join(__dirname, '../nexusplay.sqlite');
let dbPath = defaultDbPath;

if (process.env.DATABASE_URL) {
  let customUrl = process.env.DATABASE_URL.trim();
  if (customUrl.startsWith('sqlite://') || customUrl.startsWith('file://')) {
    customUrl = customUrl.replace(/^sqlite:\/\/|^file:\/\//, '');
    if (customUrl) dbPath = customUrl;
  } else if (!customUrl.includes('://')) {
    // Relative or absolute file path
    dbPath = customUrl;
  } else {
    // External protocol like postgresql://, mysql://
    console.warn(`[NexusPlay Database] Notice: External protocol detected in DATABASE_URL (${customUrl.split('://')[0]}://). The NexusPlay engine runs on embedded high-concurrency SQLite (WAL mode). Defaulting safely to: ${defaultDbPath}`);
    dbPath = defaultDbPath;
  }
}

try {
  const dbDir = dirname(dbPath);
  if (dbDir && !fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
} catch (e) {
  console.warn('[NexusPlay Database] Directory check warning:', e.message);
}

console.log(`[NexusPlay Database] Initializing SQLite connection at: ${dbPath}`);

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema initialization
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT UNIQUE,
      email TEXT UNIQUE,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'player', -- 'admin', 'owner', 'staff', 'player'
      password_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      owner_user_id TEXT REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS organization_members (
      organization_id TEXT REFERENCES organizations(id),
      user_id TEXT REFERENCES users(id),
      role TEXT NOT NULL DEFAULT 'manager',
      PRIMARY KEY (organization_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS sports (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT,
      min_players INTEGER DEFAULT 2,
      max_players INTEGER DEFAULT 22
    );

    CREATE TABLE IF NOT EXISTS venues (
      id TEXT PRIMARY KEY,
      organization_id TEXT REFERENCES organizations(id),
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      address TEXT NOT NULL,
      city TEXT DEFAULT 'Bangalore',
      lat REAL,
      lng REAL,
      phone TEXT,
      email TEXT,
      photos TEXT, -- JSON array
      amenities TEXT, -- JSON array
      sport_ids TEXT, -- JSON array
      open_time TEXT DEFAULT '06:00',
      close_time TEXT DEFAULT '23:30',
      rating REAL DEFAULT 4.8,
      status TEXT DEFAULT 'active',
      upi_id TEXT DEFAULT 'koramangala.sports@okaxis',
      upi_name TEXT DEFAULT 'Nexus Central Arena Koramangala',
      upi_qr_image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS courts (
      id TEXT PRIMARY KEY,
      organization_id TEXT REFERENCES organizations(id),
      venue_id TEXT REFERENCES venues(id),
      name TEXT NOT NULL,
      sport_id TEXT REFERENCES sports(id),
      capacity INTEGER DEFAULT 10,
      slot_duration_minutes INTEGER DEFAULT 60,
      base_price INTEGER NOT NULL DEFAULT 800,
      peak_price INTEGER DEFAULT 1200,
      weekend_price INTEGER DEFAULT 1400,
      peak_hours TEXT, -- JSON array e.g. ["18:00", "19:00", "20:00", "21:00"]
      open_time TEXT,
      close_time TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS court_slots (
      id TEXT PRIMARY KEY,
      court_id TEXT REFERENCES courts(id),
      venue_id TEXT REFERENCES venues(id),
      organization_id TEXT REFERENCES organizations(id),
      date TEXT NOT NULL, -- YYYY-MM-DD
      start_time TEXT NOT NULL, -- HH:MM
      end_time TEXT NOT NULL, -- HH:MM
      price INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open', -- 'open', 'held', 'booked', 'blocked', 'maintenance'
      held_until DATETIME,
      held_by_booking_id TEXT,
      block_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS blackout_dates (
      id TEXT PRIMARY KEY,
      venue_id TEXT REFERENCES venues(id),
      court_id TEXT REFERENCES courts(id),
      date TEXT NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      organization_id TEXT REFERENCES organizations(id),
      phone TEXT NOT NULL,
      name TEXT,
      email TEXT,
      total_spend INTEGER DEFAULT 0,
      booking_count INTEGER DEFAULT 0,
      last_booking_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(organization_id, phone)
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      organization_id TEXT REFERENCES organizations(id),
      venue_id TEXT REFERENCES venues(id),
      court_id TEXT REFERENCES courts(id),
      court_slot_id TEXT REFERENCES court_slots(id),
      customer_id TEXT REFERENCES customers(id),
      user_id TEXT REFERENCES users(id),
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      total_amount INTEGER NOT NULL,
      paid_amount INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending_payment', -- 'pending_payment', 'confirmed', 'cancelled', 'rescheduled', 'completed'
      payment_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'pending_verification', 'paid', 'failed', 'cash', 'partially_paid', 'refunded', 'cancelled'
      payment_mode TEXT DEFAULT 'upi', -- 'upi', 'cash', 'split'
      source TEXT DEFAULT 'online', -- 'online', 'walk_in', 'marketplace', 'game'
      hold_expires_at DATETIME,
      upi_utr TEXT,
      upi_verified_at DATETIME,
      upi_verified_by TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS booking_participants (
      id TEXT PRIMARY KEY,
      booking_id TEXT REFERENCES bookings(id),
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      share_amount INTEGER NOT NULL,
      status TEXT DEFAULT 'pending', -- 'pending', 'paid'
      payment_link_token TEXT UNIQUE,
      paid_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      organization_id TEXT REFERENCES organizations(id),
      booking_id TEXT REFERENCES bookings(id),
      amount INTEGER NOT NULL,
      provider TEXT NOT NULL, -- 'razorpay', 'stripe', 'cash', 'simulator'
      provider_payment_id TEXT,
      provider_order_id TEXT,
      status TEXT NOT NULL, -- 'pending', 'succeeded', 'failed', 'refunded'
      raw_payload TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS staff_members (
      id TEXT PRIMARY KEY,
      organization_id TEXT REFERENCES organizations(id),
      venue_id TEXT REFERENCES venues(id),
      user_id TEXT REFERENCES users(id),
      role TEXT DEFAULT 'staff',
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      permissions TEXT, -- JSON
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      organization_id TEXT REFERENCES organizations(id),
      user_id TEXT,
      phone TEXT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      type TEXT NOT NULL, -- 'confirmation', 'reminder', 'cancellation', 'reschedule', 'payment'
      status TEXT DEFAULT 'sent',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      venue_id TEXT REFERENCES venues(id),
      user_id TEXT REFERENCES users(id),
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      organization_id TEXT REFERENCES organizations(id),
      venue_id TEXT REFERENCES venues(id),
      court_id TEXT REFERENCES courts(id),
      sport_id TEXT REFERENCES sports(id),
      court_slot_id TEXT REFERENCES court_slots(id),
      organizer_user_id TEXT REFERENCES users(id),
      organizer_name TEXT NOT NULL,
      organizer_phone TEXT NOT NULL,
      title TEXT NOT NULL,
      skill_level TEXT DEFAULT 'All Levels', -- 'Beginner', 'Intermediate', 'Advanced', 'All Levels'
      required_players INTEGER NOT NULL,
      current_players INTEGER NOT NULL DEFAULT 1,
      cost_per_player INTEGER NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT DEFAULT 'open', -- 'open', 'confirmed', 'cancelled', 'completed'
      rules TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS game_participants (
      id TEXT PRIMARY KEY,
      game_id TEXT REFERENCES games(id),
      user_id TEXT REFERENCES users(id),
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      payment_status TEXT DEFAULT 'paid', -- 'pending', 'paid', 'refunded'
      share_amount INTEGER NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      verified INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Non-destructive migrations for existing databases
  try { db.exec("ALTER TABLE venues ADD COLUMN upi_id TEXT DEFAULT 'koramangala.sports@okaxis'"); } catch(e) {}
  try { db.exec("ALTER TABLE venues ADD COLUMN upi_name TEXT DEFAULT 'Nexus Central Arena Koramangala'"); } catch(e) {}
  try { db.exec("ALTER TABLE venues ADD COLUMN upi_qr_image TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE bookings ADD COLUMN upi_utr TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE bookings ADD COLUMN upi_verified_at DATETIME"); } catch(e) {}
  try { db.exec("ALTER TABLE bookings ADD COLUMN upi_verified_by TEXT"); } catch(e) {}
  // Ensure default venue has UPI set if null
  try {
    db.prepare("UPDATE venues SET upi_id = 'koramangala.sports@okaxis' WHERE upi_id IS NULL").run();
    db.prepare("UPDATE venues SET upi_name = 'Nexus Central Arena Koramangala' WHERE upi_name IS NULL").run();
  } catch(e) {}

  // Seed default sports if empty
  const sportsCount = db.prepare('SELECT count(*) as count FROM sports').get();
  if (sportsCount.count === 0) {
    const insertSport = db.prepare('INSERT INTO sports (id, name, icon, min_players, max_players) VALUES (?, ?, ?, ?, ?)');
    insertSport.run('football', 'Football', '⚽', 10, 22);
    insertSport.run('futsal', 'Futsal', '👟', 8, 12);
    insertSport.run('cricket', 'Cricket Turf', '🏏', 10, 22);
    insertSport.run('badminton', 'Badminton', '🏸', 2, 4);
    insertSport.run('padel', 'Padel', '🎾', 4, 4);
    insertSport.run('pickleball', 'Pickleball', '🏓', 2, 4);
    insertSport.run('tennis', 'Tennis', '🎾', 2, 4);
    insertSport.run('basketball', 'Basketball', '🏀', 6, 12);
  }

  // Seed default Demo Organization, Venue & Courts if empty
  const orgsCount = db.prepare('SELECT count(*) as count FROM organizations').get();
  if (orgsCount.count === 0) {
    const orgId = 'org_nexus_central';
    const ownerId = 'usr_owner_demo';
    const venueId = 'ven_koramangala';
    
    db.prepare('INSERT INTO users (id, phone, email, name, role) VALUES (?, ?, ?, ?, ?)').run(
      ownerId, '9876543210', 'owner@nexusplay.com', 'Vikramaditya Rao', 'owner'
    );
    
    db.prepare('INSERT INTO organizations (id, name, slug, owner_user_id) VALUES (?, ?, ?, ?)').run(
      orgId, 'Nexus Arena Sports Pvt Ltd', 'nexus-arena-koramangala', ownerId
    );

    db.prepare('INSERT INTO organization_members (organization_id, user_id, role) VALUES (?, ?, ?)').run(
      orgId, ownerId, 'owner'
    );

    const photos = JSON.stringify([
      'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1529900241452-94f4c281df69?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=80'
    ]);
    const amenities = JSON.stringify([
      'FIFA Approved Artificial Turf', 'LED Floodlights (500 Lux)', 'Shower & Locker Rooms',
      'Free Parking (Car & 2-Wheeler)', 'Cafeteria & Energy Drinks', 'Bibs & Match Footballs', 'First Aid'
    ]);
    const sportIds = JSON.stringify(['football', 'futsal', 'cricket', 'badminton', 'pickleball']);

    db.prepare(`
      INSERT INTO venues (id, organization_id, name, slug, description, address, city, lat, lng, phone, email, photos, amenities, sport_ids, open_time, close_time, rating)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      venueId, orgId, 'Nexus Central Arena Koramangala', 'nexus-central-koramangala',
      'Bengaluru’s premier multi-sport hub featuring high-density shock-pad artificial turf, tournament-grade floodlights, premium changing facilities and open community games.',
      '80 Feet Road, 4th Block, Koramangala, Bengaluru, Karnataka 560034', 'Bengaluru',
      12.9352, 77.6245, '+91 98765 43210', 'play@nexusarena.com', photos, amenities, sportIds, '06:00', '23:30', 4.9
    );

    // Courts
    const peakHours = JSON.stringify(['18:00', '19:00', '20:00', '21:00', '22:00']);
    db.prepare(`
      INSERT INTO courts (id, organization_id, venue_id, name, sport_id, capacity, slot_duration_minutes, base_price, peak_price, weekend_price, peak_hours, open_time, close_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'crt_fb_1', orgId, venueId, 'Pitch 1 - FIFA 7v7 Pro Turf', 'football', 14, 60, 1200, 1800, 2000, peakHours, '06:00', '23:30'
    );

    db.prepare(`
      INSERT INTO courts (id, organization_id, venue_id, name, sport_id, capacity, slot_duration_minutes, base_price, peak_price, weekend_price, peak_hours, open_time, close_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'crt_fb_2', orgId, venueId, 'Pitch 2 - Futsal Fastcage', 'futsal', 10, 60, 1000, 1400, 1600, peakHours, '06:00', '23:30'
    );

    db.prepare(`
      INSERT INTO courts (id, organization_id, venue_id, name, sport_id, capacity, slot_duration_minutes, base_price, peak_price, weekend_price, peak_hours, open_time, close_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'crt_crk_1', orgId, venueId, 'Cricket Box Arena (Netted)', 'cricket', 14, 60, 1100, 1600, 1800, peakHours, '06:00', '23:30'
    );

    db.prepare(`
      INSERT INTO courts (id, organization_id, venue_id, name, sport_id, capacity, slot_duration_minutes, base_price, peak_price, weekend_price, peak_hours, open_time, close_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'crt_badm_1', orgId, venueId, 'Badminton Court A (BWF Teakwood)', 'badminton', 4, 60, 450, 650, 750, peakHours, '06:00', '23:00'
    );

    db.prepare(`
      INSERT INTO courts (id, organization_id, venue_id, name, sport_id, capacity, slot_duration_minutes, base_price, peak_price, weekend_price, peak_hours, open_time, close_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'crt_pckl_1', orgId, venueId, 'Pickleball Pro Court 1', 'pickleball', 4, 60, 500, 750, 850, peakHours, '06:00', '23:00'
    );

    // Pre-populate some customers for the CRM
    const cust1 = 'cust_1';
    const cust2 = 'cust_2';
    const cust3 = 'cust_3';
    db.prepare('INSERT INTO customers (id, organization_id, phone, name, email, total_spend, booking_count, last_booking_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      cust1, orgId, '+91 99887 76655', 'Rahul Sharma', 'rahul.s@gmail.com', 7600, 5, '2026-09-01 19:30:00'
    );
    db.prepare('INSERT INTO customers (id, organization_id, phone, name, email, total_spend, booking_count, last_booking_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      cust2, orgId, '+91 98450 11223', 'Ananya Deshmukh', 'ananya.d@techcorp.in', 4200, 3, '2026-08-30 08:00:00'
    );
    db.prepare('INSERT INTO customers (id, organization_id, phone, name, email, total_spend, booking_count, last_booking_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      cust3, orgId, '+91 91234 56789', 'Karthik Raja', 'karthik.raja@outlook.com', 9800, 6, '2026-09-02 07:00:00'
    );

    // Pre-populate a lively Open Game
    const gameId = 'gm_football_koramangala';
    db.prepare(`
      INSERT INTO games (id, organization_id, venue_id, court_id, sport_id, organizer_user_id, organizer_name, organizer_phone, title, skill_level, required_players, current_players, cost_per_player, date, start_time, end_time, status, rules)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      gameId, orgId, venueId, 'crt_fb_1', 'football', ownerId, 'Vikram Rao (Nexus Host)', '+91 98765 43210',
      'Evening 7v7 High-Pace Open Football Match', 'Intermediate', 14, 10, 180,
      new Date().toISOString().slice(0, 10), '20:00', '21:00', 'open',
      'Please wear turf shoes or non-marking cleats. Bibs and match balls will be provided at the venue. Arrive 15 min early for warmups!'
    );

    const partNames = [
      ['Rohan Sen', '+91 98765 00001'],
      ['Kunal Singhal', '+91 98765 00002'],
      ['Aditya Pillai', '+91 98765 00003'],
      ['Deepak Nair', '+91 98765 00004'],
      ['Siddharth Verma', '+91 98765 00005'],
      ['Aman Joshi', '+91 98765 00006'],
      ['Farhan Akhtar', '+91 98765 00007'],
      ['Gaurav Gill', '+91 98765 00008'],
      ['Harish Reddy', '+91 98765 00009'],
      ['Irfan Khan', '+91 98765 00010']
    ];

    const insertPart = db.prepare('INSERT INTO game_participants (id, game_id, name, phone, payment_status, share_amount) VALUES (?, ?, ?, ?, ?, ?)');
    partNames.forEach(([name, phone], i) => {
      insertPart.run(`gpart_${i + 1}`, gameId, name, phone, 'paid', 180);
    });

    // Generate upcoming 7 days of materialized slots
    generateSlotsForNextDays(venueId, 7);
  }
}

// Slot generator engine
export function generateSlotsForNextDays(venueId, daysCount = 7) {
  const venue = db.prepare('SELECT * FROM venues WHERE id = ?').get(venueId);
  if (!venue) return;
  const courts = db.prepare("SELECT * FROM courts WHERE venue_id = ? AND status = 'active'").all(venueId);

  const today = new Date();
  const insertSlot = db.prepare(`
    INSERT OR IGNORE INTO court_slots (id, court_id, venue_id, organization_id, date, start_time, end_time, price, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (let d = 0; d < daysCount; d++) {
    const curDate = new Date(today);
    curDate.setDate(today.getDate() + d);
    const dateStr = curDate.toISOString().slice(0, 10);
    const dayOfWeek = curDate.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

    for (const court of courts) {
      const openHour = parseInt(court.open_time?.slice(0, 2) || venue.open_time?.slice(0, 2) || '06', 10);
      const closeHour = parseInt(court.close_time?.slice(0, 2) || venue.close_time?.slice(0, 2) || '23', 10);
      const slotDuration = court.slot_duration_minutes || 60;
      const peakHours = court.peak_hours ? JSON.parse(court.peak_hours) : ['18:00', '19:00', '20:00', '21:00'];

      for (let h = openHour; h < closeHour; h++) {
        const startStr = `${String(h).padStart(2, '0')}:00`;
        const nextH = h + Math.floor(slotDuration / 60);
        const endStr = `${String(nextH).padStart(2, '0')}:00`;
        const slotId = `slot_${court.id}_${dateStr}_${startStr.replace(':', '')}`;

        // Price calculation: Weekend > Peak > Base
        let calculatedPrice = court.base_price;
        if (isWeekend && court.weekend_price) {
          calculatedPrice = court.weekend_price;
        } else if (peakHours.includes(startStr) && court.peak_price) {
          calculatedPrice = court.peak_price;
        }

        insertSlot.run(slotId, court.id, venueId, venue.organization_id, dateStr, startStr, endStr, calculatedPrice, 'open');
      }
    }
  }
}
