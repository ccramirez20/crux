'use client';

import { useState } from 'react';
import QRCode from 'qrcode';
import { eyebrowClass, fieldClass, labelClass, secondaryButtonClass } from '@/lib/ui';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';
import { removeProblem, updateProblem } from './actions';

// La ficha del bloque tiene dos acciones y ninguna cabe en otra pantalla: sacar
// el QR que se pega en la pared, y corregir lo que quedó mal escrito. Editar
// aquí y no en una vista aparte porque el error se ve aquí — el organizador
// está mirando la lista cuando nota que el bloque 3 dice 300 y debía decir 30.
export function ProblemCard({
  slug,
  eventId,
  problemId,
  number,
  name,
  topPoints,
  zonePoints,
  isLeaguePoints,
  unit,
}: {
  slug: string;
  eventId: string;
  problemId: string;
  number: number;
  name: string | null;
  topPoints: number | null;
  zonePoints: number | null;
  isLeaguePoints: boolean;
  unit: { singular: string; plural: string };
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const [numberValue, setNumberValue] = useState(String(number));
  const [nameValue, setNameValue] = useState(name ?? '');
  const [topValue, setTopValue] = useState(topPoints === null ? '' : String(topPoints));
  const [zoneValue, setZoneValue] = useState(zonePoints === null ? '' : String(zonePoints));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function printQr() {
    if (!dataUrl) return;
    const title = `${unit.singular} ${number}${name ? ` · ${name}` : ''}`;
    const win = window.open('', '_blank', 'width=400,height=520');
    if (!win) return;
    win.document.title = title;
    const style = win.document.createElement('style');
    style.textContent = `
      body { display:flex; flex-direction:column; align-items:center; justify-content:center;
             gap:12px; font-family:sans-serif; margin:0; padding:24px; }
      img { width:280px; height:280px; }
    `;
    win.document.head.appendChild(style);
    const heading = win.document.createElement('h1');
    heading.style.fontSize = '18px';
    heading.style.margin = '0';
    heading.textContent = title;
    const img = win.document.createElement('img');
    img.alt = 'QR';
    img.onload = () => win.print();
    img.src = dataUrl;
    win.document.body.append(heading, img);
  }

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

  async function save() {
    setError(null);
    setIsSubmitting(true);
    const result = await updateProblem({
      eventId,
      problemId,
      number: Number(numberValue),
      name: nameValue.trim() === '' ? null : nameValue.trim(),
      topPoints: isLeaguePoints && topValue !== '' ? Number(topValue) : null,
      zonePoints: isLeaguePoints && zoneValue !== '' ? Number(zoneValue) : null,
    });
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setIsEditing(false);
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
          {isLeaguePoints && (
            <span className="block text-xs text-bark">
              {topPoints === null ? 'Sin puntos' : `${topPoints} · ${zonePoints ?? '—'}`}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={() => setIsEditing((prev) => !prev)}
          aria-expanded={isEditing}
          className="shrink-0 rounded px-2 py-1.5 text-xs font-semibold text-muted underline transition hover:text-pine"
        >
          {isEditing ? 'Cancelar' : 'Editar'}
        </button>
        <button
          type="button"
          onClick={() => void toggle()}
          aria-expanded={dataUrl !== null}
          className="shrink-0 rounded border-[1.5px] border-pine px-3 py-1.5 text-xs font-semibold text-pine transition hover:bg-pine hover:text-white"
        >
          {dataUrl ? 'Ocultar QR' : 'QR para juzgar'}
        </button>
      </div>

      {isEditing && (
        <div className="flex flex-col gap-3 rounded-lg border border-pine bg-stone/40 p-3">
          <div className="flex gap-3">
            <div className="flex w-20 shrink-0 flex-col gap-1.5">
              <label htmlFor={`edit-number-${problemId}`} className={labelClass}>
                Número
              </label>
              <input
                id={`edit-number-${problemId}`}
                type="number"
                min={1}
                value={numberValue}
                onChange={(event) => setNumberValue(event.target.value)}
                className={`${fieldClass} text-center font-display font-bold`}
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <label htmlFor={`edit-name-${problemId}`} className={labelClass}>
                Nombre
              </label>
              <input
                id={`edit-name-${problemId}`}
                placeholder="Opcional"
                value={nameValue}
                onChange={(event) => setNameValue(event.target.value)}
                className={fieldClass}
              />
            </div>
          </div>

          {isLeaguePoints && (
            <>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <label htmlFor={`edit-top-${problemId}`} className={labelClass}>
                    Puntos por top
                  </label>
                  <input
                    id={`edit-top-${problemId}`}
                    type="number"
                    min={1}
                    value={topValue}
                    onChange={(event) => setTopValue(event.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <label htmlFor={`edit-zone-${problemId}`} className={labelClass}>
                    Puntos por zona
                  </label>
                  <input
                    id={`edit-zone-${problemId}`}
                    type="number"
                    min={0}
                    placeholder="Sin zona"
                    value={zoneValue}
                    onChange={(event) => setZoneValue(event.target.value)}
                    className={fieldClass}
                  />
                </div>
              </div>
              <p className="text-xs text-muted">
                Cambiar los puntos no modifica los intentos registrados: la tabla se recalcula
                sola. Si el evento ya empezó, las posiciones pueden cambiar al guardar.
              </p>
            </>
          )}

          {error && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => void save()}
              disabled={isSubmitting}
              className={secondaryButtonClass}
            >
              {isSubmitting ? 'Guardando…' : 'Guardar'}
            </button>
            <ConfirmDeleteButton
              label={`Borrar ${unit.singular}`}
              disabled={isSubmitting}
              onConfirm={() => removeProblem({ eventId, problemId })}
            />
          </div>
        </div>
      )}

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
          <button
            type="button"
            onClick={printQr}
            className="shrink-0 rounded border-[1.5px] border-pine px-3 py-1.5 text-xs font-semibold text-pine transition hover:bg-pine hover:text-white"
          >
            Imprimir
          </button>
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
