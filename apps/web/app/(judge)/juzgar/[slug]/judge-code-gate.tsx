'use client';

import { useState, type FormEvent } from 'react';
import { fieldClass, primaryButtonClass } from '@/lib/ui';

export function JudgeCodeGate({
  slug,
  onUnlocked,
}: {
  slug: string;
  onUnlocked: (code: string) => void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsChecking(true);
    setError(null);
    try {
      const response = await fetch('/api/judge-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, code }),
      });
      if (response.ok) {
        onUnlocked(code.trim().toUpperCase());
        return;
      }
      setError('Ese código no corresponde a este evento. Pídeselo a quien organiza.');
    } catch {
      // No signal to check against. Let them through rather than block capture
      // at the wall: every attempt carries the code, so the server still
      // refuses it on sync if it turns out to be wrong.
      onUnlocked(code.trim().toUpperCase());
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-3">
      <div>
        <h2 className="font-display text-xl font-bold">Código del evento</h2>
        <p className="mt-1 text-sm text-muted">
          Para registrar intentos necesitas el código que da quien organiza. Se pide una sola vez en
          este teléfono.
        </p>
      </div>
      <input
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        required
        aria-label="Código del evento"
        className={`${fieldClass} text-center font-display text-2xl font-bold uppercase tracking-widest`}
      />
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={isChecking} className={primaryButtonClass}>
        {isChecking ? 'Comprobando…' : 'Empezar a juzgar'}
      </button>
    </form>
  );
}
