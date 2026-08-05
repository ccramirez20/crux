'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

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
      setError(signInError.message ?? 'No se pudo iniciar sesión.');
      return;
    }
    router.push('/');
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="rounded border px-3 py-2"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          className="rounded border px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
