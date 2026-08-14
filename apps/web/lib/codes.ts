// No I/O/0/1: these get read off a printed sheet and typed on a phone at the
// wall, or pasted into a chat. 8 characters from a 32-symbol alphabet is ~10^12
// combinations, which is what stands between the code and someone guessing it —
// there is no rate limiting on the sync endpoint yet.
//
// 256 is a multiple of 32, so the modulo below is unbiased. Shared by the judge
// code of an event and the single-use organizer invite: same threat, same shape,
// one generator.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}
