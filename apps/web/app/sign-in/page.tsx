'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { translateAuthError } from '@/lib/auth-error-messages';
import { TopographicMotif } from '@/components/topographic-motif';
import { PasswordField } from '@/components/password-field';
import { fieldClass, primaryButtonClass } from '@/lib/ui';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const { error: signInError } = await authClient.signIn.email({ email, password });
    setIsSubmitting(false);
    if (signInError) {
      setError(translateAuthError(signInError.code, signInError.message ?? 'No se pudo iniciar sesión.'));
      return;
    }
    router.push('/panel');
  }

  // py-12 y no solo px-4: con `justify-center`, en cuanto el contenido no cabe
  // —un mensaje de error, un teléfono corto— el último enlace queda contra el
  // borde inferior y cuesta tocarlo. Es el mismo relleno que usan las demás
  // pantallas de alto completo.
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
          <h1 className="font-display text-2xl font-bold">Entrar</h1>
          <p className="mt-1 text-sm text-muted">Para organizar eventos y ver tus competencias.</p>
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
        <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="text-sm text-muted">
          ¿Todavía no tienes cuenta?{' '}
          <Link href="/sign-up" className="font-medium text-pine underline">
            Crear cuenta de organizador
          </Link>
        </p>
      </form>
    </main>
  );
}
