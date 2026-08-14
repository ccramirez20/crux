'use client';

import { useState, type FormEvent } from 'react';
import { createEvent } from './actions';
import { fieldClass, primaryButtonClass } from '@/lib/ui';
import { DISCIPLINE_LABEL, labelFor } from '@/lib/labels';
import { generateCode } from '@/lib/codes';
import { slugify } from '@/lib/slug';

const DISCIPLINES = ['boulder', 'lead'] as const;
type Discipline = (typeof DISCIPLINES)[number];
function isDiscipline(value: string): value is Discipline {
  return (DISCIPLINES as readonly string[]).includes(value);
}

const SCORING_FORMATS = {
  boulder: [
    { value: 'ifsc_boulder', label: 'Puntos IFSC de bloque' },
    { value: 'classic_tops_zones', label: 'Conteo clásico de tops y zonas' },
    { value: 'league_points', label: 'Puntos por bloque, estilo liga local' },
  ],
  lead: [{ value: 'max_height', label: 'Altura máxima en dificultad' }],
} as const satisfies Record<Discipline, { value: string; label: string }[]>;

type ScoringFormat = (typeof SCORING_FORMATS)[Discipline][number]['value'];
function isScoringFormat(discipline: Discipline, value: string): value is ScoringFormat {
  return (SCORING_FORMATS[discipline] as readonly { value: string }[]).some(
    (format) => format.value === value,
  );
}

const DEFAULT_SCORING_FORMAT: Record<Discipline, ScoringFormat> = {
  boulder: 'ifsc_boulder',
  lead: 'max_height',
};

// The full IANA list is ~400 entries and turns a one-second decision into
// scrolling. Colombia has a single zone and is the only market in stage 1;
// the rest of the list stays reachable behind "Otra zona horaria".
const COMMON_TIMEZONES = [
  { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
  { value: 'America/Mexico_City', label: 'México (Ciudad de México)' },
  { value: 'America/Lima', label: 'Perú (Lima)' },
  { value: 'America/Santiago', label: 'Chile (Santiago)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
  { value: 'Europe/Madrid', label: 'España (Madrid)' },
];
const ALL_TIMEZONES = Intl.supportedValuesOf('timeZone');

export function CreateEventForm({
  organizations,
}: {
  organizations: { id: string; name: string }[];
}) {
  const [organizationMode, setOrganizationMode] = useState<'existing' | 'new'>(
    organizations.length > 0 ? 'existing' : 'new',
  );
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? '');
  const [orgName, setOrgName] = useState('');
  const [orgLocation, setOrgLocation] = useState('');

  const [name, setName] = useState('');
  const [discipline, setDiscipline] = useState<Discipline>('boulder');
  const [scoringFormat, setScoringFormat] = useState<ScoringFormat>(
    DEFAULT_SCORING_FORMAT.boulder,
  );
  const [judgeCode, setJudgeCode] = useState(generateCode);
  const [timezone, setTimezone] = useState('America/Bogota');
  const [showAllTimezones, setShowAllTimezones] = useState(false);
  const [date, setDate] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // La misma función que usa el servidor al guardar, para que lo que se ve
  // escribiendo el nombre sea exactamente el enlace que va a quedar.
  const slug = slugify(name);

  function handleDisciplineChange(value: Discipline) {
    setDiscipline(value);
    setScoringFormat(DEFAULT_SCORING_FORMAT[value]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await createEvent({
      organization:
        organizationMode === 'existing'
          ? { mode: 'existing', organizationId }
          : { mode: 'new', name: orgName, location: orgLocation },
      name,
      discipline,
      scoringFormat,
      judgeCode,
      timezone,
      date: date || undefined,
    });
    setIsSubmitting(false);
    if (result && !result.ok) {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Crear evento</h1>
        <p className="mt-1 text-sm text-muted">
          Después de crearlo podrás agregar categorías, rondas y bloques, y compartir el enlace de
          inscripción.
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-bark">Organización</legend>
        {organizations.length > 0 && (
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={organizationMode === 'existing'}
                onChange={() => setOrganizationMode('existing')}
                className="accent-pine"
              />
              Usar una existente
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={organizationMode === 'new'}
                onChange={() => setOrganizationMode('new')}
                className="accent-pine"
              />
              Crear nueva
            </label>
          </div>
        )}
        {organizationMode === 'existing' ? (
          <select
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
            required
            className={fieldClass}
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        ) : (
          <>
            <input
              type="text"
              placeholder="Nombre de la organización"
              value={orgName}
              onChange={(event) => setOrgName(event.target.value)}
              required
              className={fieldClass}
            />
            <input
              type="text"
              placeholder="Ubicación"
              value={orgLocation}
              onChange={(event) => setOrgLocation(event.target.value)}
              required
              className={fieldClass}
            />
          </>
        )}
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor="event-name" className="text-sm font-medium text-bark">
          Nombre del evento
        </label>
        <input
          id="event-name"
          type="text"
          placeholder="Copa Páramo 2026"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className={fieldClass}
        />
      </div>

      {/* Vista previa, no campo. Antes se podía escribir y eso dejaba armar
          enlaces rotos o que no tenían nada que ver con el evento; y como el
          enlace termina impreso en los QR de la pared, un error ahí no se
          arregla el día del evento. Ahora sale del nombre y no se toca. */}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-bark">Enlace público</span>
        <p className="rounded-lg border border-cardborder bg-stone/60 px-4 py-3 text-sm text-muted">
          /inscripcion/
          {slug ? (
            <span className="font-display font-semibold text-ink">{slug}</span>
          ) : (
            <span className="italic">se arma con el nombre</span>
          )}
        </p>
        <p className="text-xs text-muted">
          Sale del nombre del evento y no se edita: va impreso en los QR, así que tiene que
          quedar fijo. Si quieres otro enlace, cambia el nombre.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="event-date" className="text-sm font-medium text-bark">
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
          Con esta fecha se calcula la edad de cada competidor para saber en qué categoría entra.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="event-discipline" className="text-sm font-medium text-bark">
          Modalidad
        </label>
        <select
          id="event-discipline"
          value={discipline}
          onChange={(event) => {
            if (isDiscipline(event.target.value)) {
              handleDisciplineChange(event.target.value);
            }
          }}
          className={fieldClass}
        >
          {DISCIPLINES.map((value) => (
            <option key={value} value={value}>
              {labelFor(DISCIPLINE_LABEL, value)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="event-scoring" className="text-sm font-medium text-bark">
          Cómo se puntúa
        </label>
        <select
          id="event-scoring"
          value={scoringFormat}
          onChange={(event) => {
            if (isScoringFormat(discipline, event.target.value)) {
              setScoringFormat(event.target.value);
            }
          }}
          className={fieldClass}
        >
          {SCORING_FORMATS[discipline].map((format) => (
            <option key={format.value} value={format.value}>
              {format.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted">
          Define cómo se ordena la tabla de resultados y cómo se resuelven los empates.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="judge-code" className="text-sm font-medium text-bark">
          Código para los jueces
        </label>
        <div className="flex items-center gap-2">
          <input
            id="judge-code"
            type="text"
            value={judgeCode}
            onChange={(event) => setJudgeCode(event.target.value.toUpperCase())}
            required
            minLength={4}
            maxLength={32}
            className={`${fieldClass} min-w-0 flex-1 font-display font-bold tracking-widest`}
          />
          <button
            type="button"
            onClick={() => setJudgeCode(generateCode())}
            className="shrink-0 rounded-lg border-[1.5px] border-pine px-3 py-2 text-sm font-semibold text-pine transition hover:bg-pine hover:text-white"
          >
            Otro
          </button>
        </div>
        <p className="text-xs text-muted">
          Quien escanee el QR de un bloque tendrá que escribirlo antes de poder registrar intentos.
          Dáselo solo a tus jueces.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="event-timezone" className="text-sm font-medium text-bark">
          Zona horaria
        </label>
        <select
          id="event-timezone"
          value={timezone}
          onChange={(event) => {
            if (event.target.value === '__all__') {
              setShowAllTimezones(true);
              return;
            }
            setTimezone(event.target.value);
          }}
          required
          className={fieldClass}
        >
          {showAllTimezones ? (
            ALL_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))
          ) : (
            <>
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
              <option value="__all__">Otra zona horaria…</option>
            </>
          )}
        </select>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
        Crear evento
      </button>
    </form>
  );
}
