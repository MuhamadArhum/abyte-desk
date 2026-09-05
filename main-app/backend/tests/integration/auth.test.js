// Integration tests for /api/auth routes
// Phase 4: single-tenant — no company_code, no tenant lookup, query() for all DB ops

jest.mock('../../config/database');
jest.mock('../../services/tokenBlacklist');
jest.mock('../../services/auditService', () => ({ logAction: jest.fn() }));
jest.mock('../../config/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), http: jest.fn() }));

process.env.JWT_SECRET = 'test-integration-secret-abc123';

const request  = require('supertest');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { query } = require('../../config/database');
const { isBlacklisted, blacklistToken } = require('../../services/tokenBlacklist');
const { logAction } = require('../../services/auditService');
const { buildTestApp } = require('../helpers/testApp');

let app;

beforeAll(() => {
  app = buildTestApp();
});

beforeEach(() => {
  isBlacklisted.mockResolvedValue(false);
  blacklistToken.mockResolvedValue(true);
  // authController calls logAction(...).catch(...) — must return a Promise
  logAction.mockResolvedValue(undefined);
});

// ─── POST /api/auth/login ─────────────────────────────────────────

describe('POST /api/auth/login', () => {
  const endpoint = '/api/auth/login';

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post(endpoint).send({ password: 'pass' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app).post(endpoint).send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('returns 401 when user not found', async () => {
    query.mockResolvedValueOnce([]); // user lookup returns empty
    const res = await request(app).post(endpoint).send({ email: 'notfound@x.com', password: 'pass' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid/i);
  });

  it('returns 401 for wrong password', async () => {
    const hash = await bcrypt.hash('correct', 10);
    query.mockResolvedValueOnce([{
      user_id: 1, email: 'a@b.com', password_hash: hash,
      is_active: 1, role_name: 'Cashier', username: 'cashier', name: 'Test',
    }]);
    const res = await request(app).post(endpoint).send({ email: 'a@b.com', password: 'wrong_password' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for deactivated user account', async () => {
    const hash = await bcrypt.hash('pass', 10);
    query.mockResolvedValueOnce([{
      user_id: 1, email: 'a@b.com', password_hash: hash,
      is_active: 0, role_name: 'Cashier', username: 'cashier', name: 'Test',
    }]);
    const res = await request(app).post(endpoint).send({ email: 'a@b.com', password: 'pass' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/deactivated/i);
  });

  it('returns 200 with valid JWT on successful Admin login', async () => {
    const hash = await bcrypt.hash('pass123', 10);
    // Admin: 1 query (user by email). No permissions query.
    query.mockResolvedValueOnce([{
      user_id: 1, name: 'Admin User', email: 'admin@test.com', username: 'admin',
      role_name: 'Admin', password_hash: hash, is_active: 1,
    }]);
    const res = await request(app).post(endpoint).send({ email: 'admin@test.com', password: 'pass123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe('admin@test.com');
    expect(res.body.permissions).toBeNull();
    expect(res.body.modules).toEqual([]);
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.user_id).toBe(1);
    expect(decoded.role_name).toBe('Admin');
  });

  it('returns 200 with permissions array for non-Admin (Cashier) login', async () => {
    const hash = await bcrypt.hash('pass', 10);
    // Cashier: user lookup + permissions query
    query
      .mockResolvedValueOnce([{
        user_id: 7, name: 'Cashier User', email: 'c@c.com', username: 'cashier',
        role_name: 'Cashier', password_hash: hash, is_active: 1,
      }])
      .mockResolvedValueOnce([
        { module_key: 'sales.pos' },
        { module_key: 'sales' },
      ]);
    const res = await request(app).post(endpoint).send({ email: 'c@c.com', password: 'pass' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.permissions)).toBe(true);
    expect(res.body.permissions).toContain('sales.pos');
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.user_id).toBe(7);
    expect(decoded.role_name).toBe('Cashier');
  });
});

// ─── GET /api/auth/verify ─────────────────────────────────────────

describe('GET /api/auth/verify', () => {
  it('returns 401 with no Authorization header', async () => {
    const res = await request(app).get('/api/auth/verify');
    expect(res.status).toBe(401);
  });

  it('returns 401 with blacklisted token', async () => {
    isBlacklisted.mockResolvedValue(true);
    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', 'Bearer some-blacklisted-token');
    expect(res.status).toBe(401);
  });

  it('returns 200 with user data for valid Admin token', async () => {
    const fakeUser = {
      user_id: 1, name: 'Test', email: 'a@b.com',
      role_name: 'Admin', username: 'admin', is_active: 1,
    };
    const token = jwt.sign({ user_id: 1, role_name: 'Admin' }, process.env.JWT_SECRET);
    // authenticate: user lookup by user_id
    query.mockResolvedValueOnce([fakeUser]);
    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe('a@b.com');
    expect(res.body.permissions).toBeNull(); // Admin = full access
    expect(res.body.modules).toEqual([]);
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });

  it('returns 200 and blacklists the token on valid logout', async () => {
    const fakeUser = {
      user_id: 1, name: 'Test', email: 'a@b.com',
      role_name: 'Admin', username: 'admin', is_active: 1,
    };
    const token = jwt.sign({ user_id: 1, role_name: 'Admin' }, process.env.JWT_SECRET);
    // authenticate: user lookup
    query.mockResolvedValueOnce([fakeUser]);
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(blacklistToken).toHaveBeenCalledWith(token);
  });
});

// ─── GET /api/ping ────────────────────────────────────────────────

describe('GET /api/ping', () => {
  it('returns 200 without auth (public endpoint)', async () => {
    const res = await request(app).get('/api/ping');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
