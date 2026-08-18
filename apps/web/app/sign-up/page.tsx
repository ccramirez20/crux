'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { translateAuthError } from '@/lib/auth-error-messages';
import { TopographicMotif } from '@/components/topographic-motif';
import { PasswordField } from '@/components/password-field';
import { PrivacyNotice } from '@/components/privacy-notice';
import { fieldClass, primaryButtonClass } from '@/lib/ui';

const errorBodySchema = z.object({ code: z.string(), message: z.string() }).partial();

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [organizationLocation, setOrganizationLocation] = useState('');
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
      body: JSON.stringify({
        name,
        email,
        password,
        accessCode,
        organizationName,
        organizationLocation,
      }),
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
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="w-full max-w-sm">
        <TopographicMotif />
      </div>
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <Link href="/" className="font-display text-lg font-bold tracking-wide text-pine">
          CRUX
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold">Crear cuenta de organizador</h1>
          <p className="mt-1 text-sm text-muted">
            Solo la necesitas si vas a organizar eventos. Para competir no hace falta cuenta.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-medium text-bark">
            Tu nombre
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium text-bark">
            Correo
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className={fieldClass}
          />
        </div>
        <PasswordField
          value={password}
          onChange={setPassword}
          minLength={8}
          autoComplete="new-password"
          hint="Mínimo 8 caracteres."
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="organization-name" className="text-sm font-medium text-bark">
            Tu organización
          </label>
          <input
            id="organization-name"
            type="text"
            autoComplete="organization"
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            required
            className={fieldClass}
          />
          <p className="text-xs text-muted">
            El gimnasio, club o liga que organiza. Es el nombre que ve la gente en la tabla
            pública, y tu cuenta tiene una sola.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="organization-location" className="text-sm font-medium text-bark">
            Ciudad o sede
          </label>
          <input
            id="organization-location"
            type="text"
            autoComplete="address-level2"
            value={organizationLocation}
            onChange={(event) => setOrganizationLocation(event.target.value)}
            required
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="access-code" className="text-sm font-medium text-bark">
            Código de acceso
          </label>
          <input
            id="access-code"
            type="text"
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            required
            className={fieldClass}
          />
          <p className="text-xs text-muted">
            Te lo comparte quien administra la plataforma. Sirve una sola vez: si ya lo usaste,
            pide otro.
          </p>
        </div>
        <PrivacyNotice variant="organizador" />
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
        <p className="text-sm text-muted">
          ¿Ya tienes cuenta?{' '}
          <Link href="/sign-in" className="font-medium text-pine underline">
            Entrar
          </Link>
        </p>
      </form>
    </main>
  );
}
