import { branchFilter } from '../../utils/api';

// ─── branchFilter ─────────────────────────────────────────────

describe('branchFilter', () => {
  afterEach(() => {
    branchFilter.id = null;
  });

  it('starts as null', () => {
    expect(branchFilter.id).toBeNull();
  });

  it('can be set to a branch id', () => {
    branchFilter.id = 3;
    expect(branchFilter.id).toBe(3);
  });

  it('can be reset to null', () => {
    branchFilter.id = 5;
    branchFilter.id = null;
    expect(branchFilter.id).toBeNull();
  });
});
