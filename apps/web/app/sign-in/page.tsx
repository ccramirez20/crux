'use client';

import { useState, type FormEvent } from 'react';
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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="w-full max-w-sm">
        <TopographicMotif />
      </div>
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <div className="font-display text-lg font-bold tracking-wide text-pine">CRUX</div>
        <h1 className="font-display text-2xl font-bold">Iniciar sesión</h1>
        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className={fieldClass}
        />
        <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          Entrar
        </button>
      </form>
    </main>
  );
}
