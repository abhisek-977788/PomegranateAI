const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const JWT_SECRET = process.env.JWT_SECRET || ']oz2L*|IkL5*yZ-&A*G.2cLVAYcM;5H0uWwE%d$jE!o';
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://abhisekpatel8917_db_user:Abhi1234@cluster0.epxf3si.mongodb.net/pomegranate_db?retryWrites=true&w=majority&appName=Cluster0';

// In-memory fallback user store when MongoDB Atlas connection is connecting
const inMemoryUsers = new Map();
const inMemoryInspections = [];

// Mongoose Connection Helper
let isConnected = false;
async function connectDB() {
  if (isConnected || mongoose.connection.readyState === 1) return;
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    isConnected = true;
  } catch (err) {
    console.warn('[Vercel DB Warning]', err.message);
  }
}

// Models
let User;
try {
  User = mongoose.model('User');
} catch (e) {
  const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
  }, { timestamps: true });
  User = mongoose.model('User', UserSchema);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    await connectDB();
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please provide name, email, and password.' });
    }
    const normEmail = String(email).trim().toLowerCase();

    let existingUser = null;
    if (mongoose.connection.readyState === 1) {
      try { existingUser = await User.findOne({ email: normEmail }); } catch (e) {}
    }
    if (!existingUser) existingUser = inMemoryUsers.get(normEmail);

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    let userId = 'usr-' + Date.now();

    if (mongoose.connection.readyState === 1) {
      try {
        const newUser = await User.create({ name, email: normEmail, password: hashedPassword });
        userId = String(newUser._id);
      } catch (e) {
        inMemoryUsers.set(normEmail, { _id: userId, name, email: normEmail, password: hashedPassword });
      }
    } else {
      inMemoryUsers.set(normEmail, { _id: userId, name, email: normEmail, password: hashedPassword });
    }

    const token = jwt.sign({ id: userId, name, email: normEmail }, JWT_SECRET, { expiresIn: '30d' });
    return res.status(201).json({ token, user: { id: userId, name, email: normEmail } });
  } catch (err) {
    console.error('[Register Error]', err);
    return res.status(500).json({ error: err.message || 'Registration failed.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    await connectDB();
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password.' });
    }
    const normEmail = String(email).trim().toLowerCase();

    let user = null;
    if (mongoose.connection.readyState === 1) {
      try { user = await User.findOne({ email: normEmail }); } catch (e) {}
    }
    if (!user) user = inMemoryUsers.get(normEmail);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const userId = String(user._id);
    const token = jwt.sign({ id: userId, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ token, user: { id: userId, name: user.name, email: user.email } });
  } catch (err) {
    console.error('[Login Error]', err);
    return res.status(500).json({ error: err.message || 'Login failed.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({ user: { id: decoded.id, name: decoded.name, email: decoded.email } });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/inspections/stats
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/inspections/stats', (req, res) => {
  return res.json({
    summary: {
      totalProcessed: inMemoryInspections.length,
      exportViabilityPct: 0,
      defectRatePct: 0,
      holdRatePct: 0,
      avgProcessingMs: 325,
    },
    maturityDistribution: [],
    qualityDistribution: [],
    healthDistribution: [],
    routingDistribution: [],
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/inspections/history
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/inspections/history', (req, res) => {
  return res.json({
    data: inMemoryInspections,
    pagination: { page: 1, limit: 20, total: inMemoryInspections.length, pages: 1, hasNext: false, hasPrev: false }
  });
});

app.all('*', (req, res) => {
  return res.json({ status: 'ok', message: 'Vercel API Gateway Active' });
});

module.exports = app;
