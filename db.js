const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const db = new Database('topup.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    game TEXT NOT NULL,
    currency_type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    player_id TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

const adminEmail = 'admin@yourname.com';
const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);

if (!adminExists) {
  const passwordHash = bcrypt.hashSync('admin123', 10);
  db.prepare(`
    INSERT INTO users (full_name, email, phone, password_hash, role)
    VALUES (?, ?, ?, ?, 'admin')
  `).run('Admin', adminEmail, '0000000000', passwordHash);
}

module.exports = db;
