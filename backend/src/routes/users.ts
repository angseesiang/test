import express from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { appendAuditLog, createUser, deleteUser, getAuditLogs, listPublicUsers, updateUser } from '../services/storage';

const router = express.Router();

router.get('/', requireAuth, requireAdmin, async (_req, res) => {
  return res.json({ ok: true, users: listPublicUsers() });
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, email, password, role } = req.body ?? {};

    if (!name || !email || !password) {
      return res.status(400).json({ ok: false, message: 'Name, email, and password are required.' });
    }

    const user = createUser({
      name: String(name),
      email: String(email),
      password: String(password),
      role: role === 'admin' ? 'admin' : 'user'
    });

    appendAuditLog({
      userId: req.user!.id,
      action: 'user.create',
      entityType: 'user',
      entityId: user.id,
      metadata: { email: user.email, role: user.role }
    });

    return res.json({ ok: true, user });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create user.' });
  }
});

router.patch('/:userId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = updateUser(req.params.userId, req.body ?? {});

    appendAuditLog({
      userId: req.user!.id,
      action: 'user.update',
      entityType: 'user',
      entityId: user.id,
      metadata: { updatedFields: Object.keys(req.body ?? {}) }
    });

    return res.json({ ok: true, user });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update user.' });
  }
});

router.patch('/:userId/disable', requireAuth, requireAdmin, async (req, res) => {
  try {
    const status = req.body?.status === 'active' ? 'active' : 'disabled';
    const user = updateUser(req.params.userId, { status });

    appendAuditLog({
      userId: req.user!.id,
      action: status === 'disabled' ? 'user.disable' : 'user.enable',
      entityType: 'user',
      entityId: user.id,
      metadata: { status }
    });

    return res.json({ ok: true, user });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to change user status.' });
  }
});

router.delete('/:userId', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (req.user!.id === req.params.userId) {
      return res.status(400).json({ ok: false, message: 'You cannot delete your own account while logged in.' });
    }

    deleteUser(req.params.userId);

    appendAuditLog({
      userId: req.user!.id,
      action: 'user.delete',
      entityType: 'user',
      entityId: req.params.userId,
      metadata: {}
    });

    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to delete user.' });
  }
});

router.get('/audit-logs', requireAuth, requireAdmin, async (_req, res) => {
  return res.json({ ok: true, auditLogs: getAuditLogs() });
});

export default router;
