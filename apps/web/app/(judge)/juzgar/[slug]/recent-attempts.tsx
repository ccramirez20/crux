import type { PendingAttempt } from './attempt-queue';

export type AttemptStatus = 'pending' | 'rejected' | 'synced';

const STATUS_LABEL: Record<AttemptStatus, string | null> = {
  pending: 'por enviar',
  rejected: 'no se pudo enviar',
  synced: 'enviado',
};

const STATUS_TONE: Record<AttemptStatus, string> = {
  pending: 'text-muted',
  rejected: 'text-red-700',
  synced: 'text-pine',
};

function summarize(attempt: PendingAttempt): string {
  if (attempt.height != null) {
    return `${attempt.height} m`;
  }
  if (attempt.top) {
    return `Top en ${attempt.topAttempts ?? '?'}`;
  }
  if (attempt.zone) {
    return `Zona en ${attempt.zoneAttempts ?? '?'}`;
  }
  return 'Sin logro';
}

export function RecentAttempts({
  attempts,
  bibFor,
  statusFor,
  onSelect,
}: {
  attempts: PendingAttempt[];
  bibFor: (registrationId: string) => string;
  statusFor: (clientAttemptId: string) => AttemptStatus;
  onSelect: (attempt: PendingAttempt) => void;
}) {
  if (attempts.length === 0) {
    return null;
  }

  const sorted = [...attempts].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-bark">Lo que llevas registrado en este bloque</p>
      <p className="text-xs text-muted">
        ¿Te equivocaste? Toca el intento y vuelve a guardarlo con el dato correcto.
      </p>
      <ul className="flex flex-col gap-1 text-sm">
        {sorted.map((attempt) => {
          const status = statusFor(attempt.clientAttemptId);
          const label = STATUS_LABEL[status];
          return (
            <li key={attempt.clientAttemptId}>
              <button
                type="button"
                onClick={() => onSelect(attempt)}
                className="flex w-full items-center justify-between gap-2 rounded border border-cardborder bg-white px-3 py-2 text-left"
              >
                <span>
                  <span className="font-display font-semibold">{bibFor(attempt.registrationId)}</span>{' '}
                  {summarize(attempt)}
                </span>
                {label && (
                  <span className={`shrink-0 text-xs ${STATUS_TONE[status]}`}>{label}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
