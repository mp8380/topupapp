const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: 'topup-secret-key',
    resave: false,
    saveUninitialized: false
  })
);

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

const requireAuth = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/login');
  next();
};

app.get('/', (_req, res) => {
  res.render('home');
});

app.get('/register', (_req, res) => {
  res.render('register', { error: null });
});

app.post('/register', (req, res) => {
  const { fullName, email, phone, password } = req.body;

  if (!fullName || !email || !phone || !password) {
    return res.status(400).render('register', { error: 'Please fill all fields.' });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existingUser) {
    return res.status(400).render('register', { error: 'Email already exists.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO users (full_name, email, phone, password_hash) VALUES (?, ?, ?, ?)')
    .run(fullName, email, phone, passwordHash);

  req.session.user = { id: result.lastInsertRowid, fullName, email, role: 'user' };
  res.redirect('/dashboard');
});

app.get('/login', (_req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).render('login', { error: 'Invalid email or password.' });
  }

  req.session.user = {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role
  };

  if (user.role === 'admin') {
    return res.redirect('/admin/orders');
  }

  res.redirect('/dashboard');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.get('/dashboard', requireAuth, (req, res) => {
  if (req.session.user.role === 'admin') return res.redirect('/admin/orders');

  const orders = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.session.user.id);

  res.render('dashboard', { orders });
});

app.post('/orders', requireAuth, (req, res) => {
  if (req.session.user.role === 'admin') return res.redirect('/admin/orders');

  const { customerName, mobile, game, currencyType, amount, playerId, notes } = req.body;

  if (!customerName || !mobile || !game || !currencyType || !amount || !playerId) {
    return res.status(400).send('Missing required fields.');
  }

  db.prepare(`
      INSERT INTO orders (
        user_id, customer_name, mobile, game, currency_type, amount, player_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
    req.session.user.id,
    customerName,
    mobile,
    game,
    currencyType,
    Number(amount),
    playerId,
    notes || ''
  );

  res.redirect('/dashboard');
});

app.post('/orders/:id/cancel', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);

  if (!order) return res.status(404).send('Order not found');

  if (req.session.user.role !== 'admin' && order.user_id !== req.session.user.id) {
    return res.status(403).send('Forbidden');
  }

  if (order.status === 'completed') {
    return res.status(400).send('Completed orders cannot be cancelled.');
  }

  db.prepare("UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
    req.params.id
  );
  res.redirect(req.session.user.role === 'admin' ? '/admin/orders' : '/dashboard');
});

app.get('/admin/orders', requireAdmin, (_req, res) => {
  const orders = db
    .prepare(`
      SELECT o.*, u.full_name as user_name, u.email as user_email
      FROM orders o
      JOIN users u ON u.id = o.user_id
      ORDER BY o.created_at DESC
    `)
    .all();

  res.render('admin-orders', { orders });
});

app.post('/admin/orders/:id/status', requireAdmin, (req, res) => {
  const allowedStatuses = ['pending', 'processing', 'completed', 'cancelled'];
  const { status } = req.body;

  if (!allowedStatuses.includes(status)) {
    return res.status(400).send('Invalid status');
  }

  db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
    status,
    req.params.id
  );

  res.redirect('/admin/orders');
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://localhost:${PORT}`);
});
