jest.mock('jsonwebtoken');
jest.mock('../../../config/database');
jest.mock('../../../services/tokenBlacklist');
jest.mock('../../../config/logger', () => ({ error: jest.fn(), info: jest.fn(), http: jest.fn(), warn: jest.fn() }));
jest.mock('../../../services/cacheService', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  TTL: { PERMISSION: 300, SETTINGS: 600, DASHBOARD: 120, LOOKUP: 900 },
  invalidatePermissions: jest.fn().mockResolvedValue(undefined),
  invalidateTenantPermissions: jest.fn().mockResolvedValue(undefined),
  invalidateSettings: jest.fn().mockResolvedValue(undefined),
}));

const jwt = require('jsonwebtoken');
// Phase 4: single-tenant — auth middleware uses query(), not queryDb()
const { query } = require('../../../config/database');
const { isBlacklisted } = require('../../../services/tokenBlacklist');
const { authenticate, authorize, requirePermission } = require('../../../middleware/auth');

// ─── Helper ──────────────────────────────────────────────────────

const mockReq = (overrides = {}) => ({
  headers: { authorization: 'Bearer valid-token' },
  ...overrides,
});
const mockRes = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json   = jest.fn().mockReturnValue(r);
  return r;
};

// ─── authenticate ────────────────────────────────────────────────

describe('authenticate middleware', () => {
  const next = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  it('rejects missing Authorization header', async () => {
    const req = { headers: {} };
    const res = mockRes();
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects header that does not start with Bearer', async () => {
    const req = { headers: { authorization: 'Basic abc123' } };
    const res = mockRes();
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects blacklisted tokens', async () => {
    isBlacklisted.mockResolvedValue(true);
    const res = mockRes();
    await authenticate(mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('revoked') }));
  });

  it('rejects expired JWT', async () => {
    isBlacklisted.mockResolvedValue(false);
    const err = new Error('expired'); err.name = 'TokenExpiredError';
    jwt.verify.mockImplementation(() => { throw err; });
    const res = mockRes();
    await authenticate(mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Token expired' }));
  });

  it('rejects invalid JWT', async () => {
    isBlacklisted.mockResolvedValue(false);
    jwt.verify.mockImplementation(() => { throw new Error('invalid'); });
    const res = mockRes();
    await authenticate(mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid token' }));
  });

  it('rejects when user not found in DB', async () => {
    isBlacklisted.mockResolvedValue(false);
    jwt.verify.mockReturnValue({ user_id: 99 });
    query.mockResolvedValue([]);
    const res = mockRes();
    await authenticate(mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'User not found' }));
  });

  it('rejects deactivated user', async () => {
    isBlacklisted.mockResolvedValue(false);
    jwt.verify.mockReturnValue({ user_id: 5 });
    query.mockResolvedValue([{ user_id: 5, role_name: 'Cashier', is_active: 0 }]);
    const res = mockRes();
    await authenticate(mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('deactivated') }));
  });

  it('calls next and sets req.user on valid token', async () => {
    const fakeUser = { user_id: 1, role_name: 'Admin', is_active: 1 };
    isBlacklisted.mockResolvedValue(false);
    jwt.verify.mockReturnValue({ user_id: 1 });
    query.mockResolvedValue([fakeUser]);
    const res = mockRes();
    const req = mockReq();
    await authenticate(req, res, next);
    expect(req.user).toEqual(fakeUser);
    expect(req.modules).toEqual([]); // single-tenant: always empty = all enabled
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sets req.modules to [] regardless of JWT payload (single-tenant)', async () => {
    const fakeUser = { user_id: 2, role_name: 'Cashier', is_active: 1 };
    isBlacklisted.mockResolvedValue(false);
    jwt.verify.mockReturnValue({ user_id: 2 });
    query.mockResolvedValue([fakeUser]);
    const req = mockReq();
    await authenticate(req, mockRes(), next);
    expect(req.modules).toEqual([]);
  });
});

// ─── authorize ───────────────────────────────────────────────────

describe('authorize middleware', () => {
  const next = jest.fn();
  beforeEach(() => jest.clearAllMocks());

  it('allows user with matching role', () => {
    const req = { user: { role_name: 'Admin' } };
    const res = mockRes();
    authorize('Admin', 'Manager')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('blocks user with non-matching role', () => {
    const req = { user: { role_name: 'Cashier' } };
    const res = mockRes();
    authorize('Admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

// ─── requirePermission ───────────────────────────────────────────
// Phase 4: single-tenant — requirePermission uses query() not queryDb()

describe('requirePermission middleware', () => {
  const next = jest.fn();
  const cache = require('../../../services/cacheService');
  beforeEach(() => {
    jest.clearAllMocks();
    cache.get.mockResolvedValue(null);
    cache.set.mockResolvedValue(undefined);
  });

  it('always allows Admin role without DB query', async () => {
    const req = { user: { role_name: 'Admin' }, method: 'POST' };
    await requirePermission('sales.pos')(req, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(query).not.toHaveBeenCalled();
  });

  it('allows non-admin when permission exists for GET (2-part key)', async () => {
    query.mockResolvedValue([{ 1: 1 }]);
    const req = { user: { role_name: 'Cashier' }, method: 'GET' };
    await requirePermission('sales.pos')(req, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('checks .create sub-key on POST with 2-part key', async () => {
    query.mockResolvedValue([{ 1: 1 }]);
    const req = { user: { role_name: 'Cashier' }, method: 'POST' };
    await requirePermission('inventory.products')(req, mockRes(), next);
    expect(query).toHaveBeenCalledWith(
      expect.any(String),
      ['Cashier', 'inventory.products.create']
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('checks .delete sub-key on DELETE', async () => {
    query.mockResolvedValue([{ 1: 1 }]);
    const req = { user: { role_name: 'Manager' }, method: 'DELETE' };
    await requirePermission('inventory.products')(req, mockRes(), next);
    expect(query).toHaveBeenCalledWith(
      expect.any(String),
      ['Manager', 'inventory.products.delete']
    );
  });

  it('blocks when permission not found', async () => {
    query.mockResolvedValue([]);
    const req = { user: { role_name: 'Cashier' }, method: 'DELETE' };
    const res = mockRes();
    await requirePermission('inventory.products')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('uses LIKE query for 1-part parent key', async () => {
    query.mockResolvedValue([{ 1: 1 }]);
    const req = { user: { role_name: 'Cashier' }, method: 'GET' };
    await requirePermission('sales')(req, mockRes(), next);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('LIKE'),
      expect.arrayContaining(['sales.%'])
    );
  });

  it('uses exact match for 3-part explicit key', async () => {
    query.mockResolvedValue([{ 1: 1 }]);
    const req = { user: { role_name: 'Cashier' }, method: 'POST' };
    await requirePermission('sales.pos.create')(req, mockRes(), next);
    expect(query).toHaveBeenCalledWith(
      expect.any(String),
      ['Cashier', 'sales.pos.create']
    );
  });

  it('returns 500 on DB error', async () => {
    query.mockRejectedValue(new Error('DB down'));
    const req = { user: { role_name: 'Cashier' }, method: 'GET' };
    const res = mockRes();
    await requirePermission('sales.pos')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns cached result without hitting DB', async () => {
    cache.get.mockResolvedValue(true);
    const req = { user: { role_name: 'Cashier' }, method: 'GET' };
    await requirePermission('sales.pos')(req, mockRes(), next);
    expect(query).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
