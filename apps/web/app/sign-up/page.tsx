'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { translateAuthError } from '@/lib/auth-error-messages';
import { TopographicMotif } from '@/components/topographic-motif';
import { fieldClass, primaryButtonClass } from '@/lib/ui';

const errorBodySchema = z.object({ code: z.string(), message: z.string() }).partial();

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const response = await fetch('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, accessCode }),
    });
    setIsSubmitting(false);
    if (!response.ok) {
      const rawBody: unknown = await response.json().catch(() => null);
      const parsed = errorBodySchema.safeParse(rawBody);
      setError(
        translateAuthError(
          parsed.success ? parsed.data.code : undefined,
          (parsed.success && parsed.data.message) || 'No se pudo crear la cuenta.',
        ),
      );
      return;
    }
    router.push('/panel');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="w-full max-w-sm">
        <TopographicMotif />
      </div>
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <div className="font-display text-lg font-bold tracking-wide text-pine">CRUX</div>
        <h1 className="font-display text-2xl font-bold">Crear cuenta de organizador</h1>
        <input
          type="text"
          placeholder="Nombre"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className={fieldClass}
        />
        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className={fieldClass}
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
          className={fieldClass}
        />
        <div className="flex flex-col gap-1">
          <input
            type="text"
            placeholder="Código de acceso"
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            required
            className={fieldClass}
          />
          <p className="text-xs text-muted">
            Te lo comparte quien administra la plataforma — por ahora el registro es solo para organizadores invitados.
          </p>
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          Crear cuenta
        </button>
      </form>
    </main>
  );
}
