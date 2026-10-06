export const mockDb = {
  get: vi.fn(),
  set: vi.fn(),
};

vi.mock('$lib/services/DbService.js', () => ({
  db: mockDb,
}));

vi.stubGlobal('localStorage', {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
});
