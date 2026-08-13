// No I/O/0/1: these get read off a printed sheet and typed on a phone at the
// wall. 8 characters from a 32-symbol alphabet is ~10^12 combinations, which
// is what stands between the code and someone guessing it — there is no rate
// limiting on the sync endpoint yet.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateJudgeCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}
