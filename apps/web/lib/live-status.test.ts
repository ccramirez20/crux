import { describe, expect, it } from 'vitest';
import { isLive } from './live-status';

const NOW = new Date('2026-08-18T12:00:00.000Z');

describe('isLive', () => {
  it('is not live when nothing has ever been captured', () => {
    expect(isLive(null, NOW)).toBe(false);
  });

  it('is live right after a capture', () => {
    expect(isLive('2026-08-18T11:59:00.000Z', NOW)).toBe(true);
  });

  it('is live at exactly the window edge, not past it', () => {
    expect(isLive('2026-08-18T06:00:00.000Z', NOW)).toBe(true); // exactly 6h ago
    expect(isLive('2026-08-18T05:59:59.000Z', NOW)).toBe(false); // 6h and 1s ago
  });

  it('is not live for an event finished long ago', () => {
    expect(isLive('2026-06-13T10:00:00.000Z', NOW)).toBe(false);
  });
});
