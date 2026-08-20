'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { fieldClass, labelClass, secondaryButtonClass } from '@/lib/ui';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';
import { deleteEvent, updateEvent } from './actions';
import { generateCode } from '@/lib/codes';

const COMMON_TIMEZONES = [
  { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
  { value: 'America/Mexico_City', label: 'México (Ciudad de México)' },
  { value: 'America/Lima', label: 'Perú (Lima)' },
  { value: 'America/Santiago', label: 'Chile (Santiago)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
  { value: 'Europe/Madrid', label: 'España (Madrid)' },
];

export function EventForm({
  eventId,
  name: initialName,
  date: initialDate,
  registrationDeadline: initialDeadline,
  timezone: initialTimezone,
  judgeCode: initialJudgeCode,
  hasAttempts,
  registrationCount,
}: {
  eventId: string;
  name: string;
  date: string | null;
  registrationDeadline: string | null;
  timezone: string;
  judgeCode: string | null;
  hasAttempts: boolean;
  registrationCount: number;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [date, setDate] = useState(initialDate ?? '');
  const [deadline, setDeadline] = useState(initialDeadline ?? '');
  const [timezone, setTimezone] = useState(initialTimezone);
  const [judgeCode, setJudgeCode] = useState(initialJudgeCode ?? generateCode());
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Una zona horaria que no está entre las comunes (un evento fuera de la
  // región) no puede desaparecer del select solo por no estar en la lista.
  const timezones = COMMON_TIMEZONES.some((tz) => tz.value === initialTimezone)
    ? COMMON_TIMEZONES
    : [...COMMON_TIMEZONES, { value: initialTimezone, label: initialTimezone }];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await updateEvent({
      eventId,
      name,
      date: date === '' ? null : date,
      registrationDeadline: deadline === '' ? null : deadline,
      timezone,
      judgeCode,
    });
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-fit rounded border-[1.5px] border-pine px-3 py-1.5 text-xs font-semibold text-pine transition hover:bg-pine hover:text-white"
      >
        Editar el evento
      </button>
    );
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-3 rounded-lg border border-pine bg-card p-5"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="event-name" className={labelClass}>
          Nombre del evento
        </label>
        <input
          id="event-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="event-date" className={labelClass}>
          Fecha del evento
        </label>
        <input
          id="event-date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className={fieldClass}
        />
        <p className="text-xs text-muted">
          Esta fecha define las categorías de los competidores. Si la cambias después, no afecta a
          quienes ya se inscribieron: su categoría se definió con la fecha que estaba vigente al
          momento de la inscripción.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="event-deadline" className={labelClass}>
          Inscripciones hasta
        </label>
        <input
          id="event-deadline"
          type="date"
          value={deadline}
          onChange={(event) => setDeadline(event.target.value)}
          className={fieldClass}
        />
        <p className="text-xs text-muted">
          Último día en que el enlace acepta inscripciones, según la zona horaria del evento.
          Déjalo vacío para que las inscripciones no se cierren. Si alguien llega tarde y quieres
          dejarlo entrar, cambia la fecha y el enlace volverá a aceptar inscripciones.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="event-timezone" className={labelClass}>
          Zona horaria
        </label>
        <select
          id="event-timezone"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          className={fieldClass}
        >
          {timezones.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="event-judge-code" className={labelClass}>
          Código para los jueces
        </label>
        <div className="flex gap-2">
          <input
            id="event-judge-code"
            value={judgeCode}
            onChange={(event) => setJudgeCode(event.target.value.toUpperCase())}
            required
            minLength={4}
            maxLength={32}
            className={`${fieldClass} font-display font-bold tracking-widest`}
          />
          <button
            type="button"
            onClick={() => setJudgeCode(generateCode())}
            className="shrink-0 rounded border-[1.5px] border-pine px-3 text-xs font-semibold text-pine transition hover:bg-pine hover:text-white"
          >
            Otro
          </button>
        </div>
        <p className="text-xs text-muted">
          Cámbialo si se filtró. Los jueces que ya estaban registrando intentos tendrán que
          ingresar el nuevo código, y los intentos pendientes se quedan guardados en el teléfono
          hasta que lo hagan: no se pierde ninguno.
        </p>
      </div>

      {/* Lo que no se puede editar, dicho donde se busca. Callar esto manda al
          organizador a buscar un campo que no existe. */}
      <p className="rounded border-l-4 border-bark bg-stone/60 px-3 py-2 text-xs text-muted">
        El enlace público, la modalidad y la forma de puntuar no se pueden cambiar. El enlace ya
        está en los QR impresos y en lo que hayas compartido, y cambiar la modalidad o el puntaje
        afectaría los intentos ya registrados. Si algo quedó mal y todavía no has registrado
        ningún intento, borra el evento y créalo de nuevo.
      </p>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <button type="submit" disabled={isSubmitting} className={secondaryButtonClass}>
            {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded px-3 py-1.5 text-sm font-medium text-muted underline"
          >
            Cancelar
          </button>
        </div>

        {hasAttempts ? (
          <span className="flex max-w-[240px] items-center gap-2 text-right text-xs text-muted">
            <button
              type="button"
              disabled
              className="shrink-0 text-xs font-medium text-muted underline decoration-dotted underline-offset-4 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Borrar evento
            </button>
            Ya tiene intentos registrados, no se puede borrar.
          </span>
        ) : (
          <ConfirmDeleteButton
            label="Borrar evento"
            takesWith={
              registrationCount > 0
                ? `Se borran también ${registrationCount} inscrito${registrationCount === 1 ? '' : 's'}.`
                : null
            }
            onConfirm={async () => {
              const result = await deleteEvent({ eventId });
              if (result.ok) {
                router.push('/panel');
              }
              return result;
            }}
          />
        )}
      </div>
    </form>
  );
}
