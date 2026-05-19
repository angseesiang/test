import express from 'express';
import bcrypt from 'bcryptjs';
import { appendAuditLog, createUser, getUserByEmail, publicUser } from '../services/storage';
import { requireAuth, signToken } from '../middleware/auth';

const router = express.Router();

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body ?? {};

    if (!name || !email || !password) {
      return res.status(400).json({ ok: false, message: 'Name, email, and password are required.' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ ok: false, message: 'Password must be at least 6 characters.' });
    }

    const user = createUser({ name: String(name), email: String(email), password: String(password), role: 'user' });
    const token = signToken(user.id);

    appendAuditLog({
      userId: user.id,
      action: 'auth.signup',
      entityType: 'user',
      entityId: user.id,
      metadata: { email: user.email }
    });

    return res.json({ ok: true, user, token });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error instanceof Error ? error.message : 'Signup failed.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    const user = getUserByEmail(String(email ?? ''));

    if (!user || !bcrypt.compareSync(String(password ?? ''), user.passwordHash)) {
      return res.status(401).json({ ok: false, message: 'Invalid email or password.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ ok: false, message: 'This account is disabled.' });
    }

    const token = signToken(user.id);
    const safeUser = publicUser(user);

    appendAuditLog({
      userId: user.id,
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      metadata: { email: user.email }
    });

    return res.json({ ok: true, user: safeUser, token });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Login failed.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  return res.json({ ok: true, user: req.user });
});

export default router;
