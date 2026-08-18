import { describe, expect, it } from 'vitest';
import { liveState } from './live-status';

const NOW = new Date('2026-08-18T12:00:00.000Z');

describe('liveState', () => {
  it('is not-started when nothing has ever been captured', () => {
    expect(liveState(null, NOW)).toBe('not-started');
  });

  it('is live right after a capture', () => {
    expect(liveState('2026-08-18T11:59:00.000Z', NOW)).toBe('live');
  });

  it('is live at exactly the window edge, settled past it', () => {
    expect(liveState('2026-08-18T06:00:00.000Z', NOW)).toBe('live'); // exactly 6h ago
    expect(liveState('2026-08-18T05:59:59.000Z', NOW)).toBe('settled'); // 6h and 1s ago
  });

  it('is settled for an event finished long ago', () => {
    expect(liveState('2026-06-13T10:00:00.000Z', NOW)).toBe('settled');
  });
});
