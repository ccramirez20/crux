'use client';

import { useState } from 'react';
import QRCode from 'qrcode';
import { eyebrowClass } from '@/lib/ui';

// La ficha del bloque y su QR son la misma cosa: la única acción que tiene un
// bloque en esta pantalla es generar el código que se pega en la pared. Antes el
// QR colgaba pegado al borde derecho de la fila, medio recortado contra el
// margen; ahora se abre centrado y ocupando la ficha entera, que es como se
// mira algo que uno va a imprimir.
export function ProblemCard({
  slug,
  problemId,
  number,
  name,
  unit,
}: {
  slug: string;
  problemId: string;
  number: number;
  name: string | null;
  unit: { singular: string; plural: string };
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [url, setUrl] = useState('');

  async function toggle() {
    if (dataUrl) {
      setDataUrl(null);
      return;
    }
    // Se construye al tocar, no al renderizar: el origen tiene que ser la
    // dirección que el teléfono sí alcanza (la IP de la LAN si el organizador
    // abrió el panel así), y leer `window` durante el render desalinearía el
    // HTML del servidor con el del cliente.
    const judgeUrl = `${window.location.origin}/juzgar/${slug}/${problemId}`;
    setUrl(judgeUrl);
    setDataUrl(await QRCode.toDataURL(judgeUrl, { margin: 1, width: 240 }));
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-cardborder bg-white px-3 py-2.5">
      <div className="flex items-center gap-3">
        {/* El número no es decoración: es el mismo que va impreso junto al
            bloque en la pared. */}
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold font-display text-base font-bold text-ink">
          {number}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`${eyebrowClass} block`}>{unit.singular}</span>
          <span className="block truncate text-sm font-medium">{name ?? 'Sin nombre'}</span>
        </span>
        <button
          type="button"
          onClick={() => void toggle()}
          aria-expanded={dataUrl !== null}
          className="shrink-0 rounded border-[1.5px] border-pine px-3 py-1.5 text-xs font-semibold text-pine transition hover:bg-pine hover:text-white"
        >
          {dataUrl ? 'Ocultar QR' : 'QR para juzgar'}
        </button>
      </div>

      {dataUrl && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-cardborder bg-stone/60 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- un data: URL no puede pasar por el optimizador de next/image */}
          <img
            src={dataUrl}
            alt={`Código QR que abre la pantalla del juez para ${unit.singular} ${number}`}
            width={240}
            height={240}
            className="rounded bg-white p-2"
          />
          <p className="max-w-[280px] text-center text-xs text-muted">
            Imprímelo y pégalo junto {unit.singular === 'ruta' ? 'a la ruta' : 'al bloque'}. El juez
            lo escanea, escribe el código del evento y entra directo a puntuar.
          </p>
          <span className="max-w-full break-all text-center text-[10px] text-muted">{url}</span>
        </div>
      )}
    </div>
  );
}
