import type { Attempt } from '@crux/core';

export function resolveCurrentAttempts(attempts: Attempt[], problemIds: Set<string>): Attempt[] {
  const currentByKey = new Map<string, Attempt>();
  for (const attempt of attempts) {
    if (!problemIds.has(attempt.problemId)) continue;
    const key = `${attempt.registrationId}:${attempt.problemId}`;
    const existing = currentByKey.get(key);
    if (!existing || attempt.sequence > existing.sequence) {
      currentByKey.set(key, attempt);
    }
  }
  return [...currentByKey.values()];
}
