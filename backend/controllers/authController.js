const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { JWT_SECRET } = require('../middleware/auth');

// In-memory fallback user store when MongoDB is offline
const inMemoryUsers = new Map();

function generateToken(user) {
  return jwt.sign(
    { id: user._id, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

async function findUserByEmail(email) {
  const normEmail = email.toLowerCase();
  if (mongoose.connection.readyState === 1) {
    try {
      const dbUser = await User.findOne({ email: normEmail });
      if (dbUser) return dbUser;
    } catch (err) {
      console.warn('[authController] DB findOne warning:', err.message);
    }
  }
  return inMemoryUsers.get(normEmail) || null;
}

async function createUser({ name, email, password }) {
  const normEmail = email.toLowerCase();
  if (mongoose.connection.readyState === 1) {
    try {
      const dbUser = await User.create({ name, email: normEmail, password });
      return dbUser;
    } catch (err) {
      console.warn('[authController] DB create warning:', err.message);
    }
  }
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const memUser = {
    _id: 'usr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    name,
    email: normEmail,
    password: hashedPassword,
    comparePassword: async function(cand) {
      return await bcrypt.compare(cand, this.password);
    }
  };
  inMemoryUsers.set(normEmail, memUser);
  return memUser;
}

// POST /api/auth/register
async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please provide name, email, and password.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const user = await createUser({ name, email, password });
    const token = generateToken(user);

    return res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });

  } catch (err) {
    console.error('[register error]:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to register user.' });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password.' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    let isMatch = false;
    if (typeof user.comparePassword === 'function') {
      isMatch = await user.comparePassword(password);
    } else {
      isMatch = await bcrypt.compare(password, user.password);
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken(user);

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });

  } catch (err) {
    console.error('[login error]:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to authenticate user.' });
  }
}

// GET /api/auth/me
async function getMe(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    let userObj = null;
    if (mongoose.connection.readyState === 1) {
      try {
        const u = await User.findById(req.user.id).select('-password');
        if (u) userObj = u;
      } catch (err) {}
    }

    if (!userObj) {
      for (const memUser of inMemoryUsers.values()) {
        if (String(memUser._id) === String(req.user.id)) {
          userObj = memUser;
          break;
        }
      }
    }

    if (!userObj) {
      userObj = { _id: req.user.id, name: req.user.name, email: req.user.email };
    }

    return res.json({
      user: {
        id: userObj._id,
        name: userObj.name,
        email: userObj.email,
      },
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { register, login, getMe };
