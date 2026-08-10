'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

export function SignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState(false);

  // Signing out is a network round trip. Without a busy state the button looks
  // broken for the second or so it takes, and an impatient second click fires
  // a second request.
  async function signOut() {
    setIsSigningOut(true);
    setError(false);
    try {
      await authClient.signOut();
    } catch {
      setIsSigningOut(false);
      setError(true);
      return;
    }
    router.push('/sign-in');
    router.refresh();
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={signOut}
        disabled={isSigningOut}
        aria-busy={isSigningOut}
        className="text-sm font-medium text-pine underline disabled:opacity-60"
      >
        {isSigningOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-700">
          No se pudo cerrar la sesión. Revisa la conexión e inténtalo otra vez.
        </span>
      )}
    </span>
  );
}
