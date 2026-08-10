'use client';

import { useEffect, useState } from 'react';
import { cardClass } from '@/lib/ui';

// navigator.clipboard is secure-context only — undefined over plain http on a
// LAN IP, which is exactly how the panel gets opened to generate QR codes the
// phone can reach. The textarea + execCommand path is deprecated but has no
// such restriction, and if both fail the link is still on screen to copy by
// hand. What is not acceptable is the button doing nothing and saying nothing.
async function copyToClipboard(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or blocked; fall through to the manual path.
    }
  }

  try {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.top = '0';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(field);
    return copied;
  } catch {
    return false;
  }
}

type CopyState = 'idle' | 'copied' | 'failed';

export function ShareLink({
  path,
  title,
  description,
}: {
  path: string;
  title: string;
  description: string;
}) {
  const [state, setState] = useState<CopyState>('idle');
  const [url, setUrl] = useState('');

  // The address that works for whoever receives it is the one this browser is
  // already using: localhost in dev, the LAN IP at the gym, the real domain
  // later. Read after mount so the server render and the client agree.
  useEffect(() => {
    setUrl(`${window.location.origin}${path}`);
  }, [path]);

  useEffect(() => {
    if (state === 'idle') {
      return;
    }
    const timer = setTimeout(() => setState('idle'), 4000);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <div className={`${cardClass} flex flex-col gap-2`}>
      <span className="font-display font-semibold">{title}</span>
      <p className="text-sm text-muted">{description}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-stone px-3 py-2 text-sm" title={url}>
          {url || path}
        </code>
        <button
          type="button"
          onClick={async () => setState((await copyToClipboard(url)) ? 'copied' : 'failed')}
          disabled={!url}
          className="rounded-lg border-[1.5px] border-pine px-4 py-2 text-sm font-semibold text-pine transition hover:bg-pine hover:text-white disabled:opacity-50"
        >
          {state === 'copied' ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      {state === 'copied' && (
        <p role="status" className="text-sm font-medium text-pine">
          Enlace copiado. Ya lo puedes pegar donde quieras.
        </p>
      )}
      {state === 'failed' && (
        <p role="status" className="text-sm font-medium text-bark">
          El navegador no dejó copiarlo automáticamente. Selecciona el enlace de arriba y cópialo a
          mano.
        </p>
      )}
    </div>
  );
}
