'use client';

import { useState, useTransition } from 'react';

// Dos pasos y no un `confirm()`: el diálogo del navegador bloquea la pestaña
// entera para preguntar algo que cabe en el propio botón. Y dos botones
// explícitos al confirmar, no un segundo clic sobre el mismo botón — la única
// salida de ese diseño era perder el foco, y en la pantalla no queda nada
// clickeable que diga que no.
export function ConfirmDeleteButton({
  label,
  takesWith = null,
  onConfirm,
  disabled = false,
}: {
  label: string;
  /** Qué más se lleva por delante. Se dice al confirmar, no antes. */
  takesWith?: string | null;
  onConfirm: () => Promise<{ ok: true } | { ok: false; error: string }>;
  disabled?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await onConfirm();
      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={disabled || isPending}
        className="shrink-0 text-xs font-medium text-muted underline decoration-dotted underline-offset-4 hover:text-bark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {label}
      </button>
    );
  }

  return (
    <div
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setConfirming(false);
        }
      }}
      className="flex flex-wrap items-center justify-end gap-2"
    >
      {error && (
        <span role="alert" className="text-xs font-medium text-red-700">
          {error}
        </span>
      )}
      {takesWith && <span className="text-xs text-muted">{takesWith}</span>}
      <button
        type="button"
        onClick={confirm}
        disabled={isPending}
        className="shrink-0 text-xs font-semibold text-red-700 underline decoration-dotted underline-offset-4"
      >
        {isPending ? 'Borrando…' : `Sí, ${label.toLowerCase()}`}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={isPending}
        className="shrink-0 text-xs font-medium text-muted underline decoration-dotted underline-offset-4 hover:text-bark"
      >
        No
      </button>
    </div>
  );
}
