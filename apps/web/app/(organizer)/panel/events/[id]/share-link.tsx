'use client';

import { useState } from 'react';
import { cardClass } from '@/lib/ui';

// The organizer's most repeated job on this page is handing this link to
// people, so it is shown in full and copies in one tap. The path is built on
// the client because the address that works for whoever is being sent it is
// the one this browser is already using — localhost in dev, the real domain
// later.
export function ShareLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/inscripcion/${slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked without https on some browsers; the link is
      // visible right there, so selecting it by hand still works.
      setCopied(false);
    }
  }

  return (
    <div className={`${cardClass} flex flex-col gap-2`}>
      <span className="font-display font-semibold">Enlace de inscripción</span>
      <p className="text-sm text-muted">
        Compártelo por WhatsApp o redes. Quien lo abra se inscribe sin crear cuenta.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-stone px-3 py-2 text-sm">{path}</code>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg border-[1.5px] border-pine px-4 py-2 text-sm font-semibold text-pine transition hover:bg-pine hover:text-white"
        >
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}
