'use client';

import { useState, type FormEvent } from 'react';
import { createEvent } from './actions';
import { fieldClass, primaryButtonClass } from '@/lib/ui';

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

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const TIMEZONES = Intl.supportedValuesOf('timeZone');

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
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [discipline, setDiscipline] = useState<Discipline>('boulder');
  const [scoringFormat, setScoringFormat] = useState<ScoringFormat>(
    DEFAULT_SCORING_FORMAT.boulder,
  );
  const [timezone, setTimezone] = useState('America/Bogota');
  const [date, setDate] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  }

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
      slug,
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
      <h1 className="font-display text-2xl font-bold">Crear evento</h1>

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

      <input
        type="text"
        placeholder="Nombre del evento"
        value={name}
        onChange={(event) => handleNameChange(event.target.value)}
        required
        className={fieldClass}
      />
      <div className="flex flex-col gap-1">
        <input
          type="text"
          placeholder="slug"
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
          required
          pattern="[a-z0-9-]+"
          className={fieldClass}
        />
        <p className="text-xs text-muted">Así se verá en el enlace público del evento.</p>
      </div>
      <div className="flex flex-col gap-1">
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className={fieldClass}
        />
        <p className="text-xs text-muted">
          Cuándo es el evento — se usa para calcular las categorías por edad.
        </p>
      </div>
      <select
        value={discipline}
        onChange={(event) => {
          if (isDiscipline(event.target.value)) {
            handleDisciplineChange(event.target.value);
          }
        }}
        className={fieldClass}
      >
        <option value="boulder">Boulder</option>
        <option value="lead">Lead</option>
      </select>
      <select
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
      <select
        value={timezone}
        onChange={(event) => setTimezone(event.target.value)}
        required
        className={fieldClass}
      >
        {TIMEZONES.map((tz) => (
          <option key={tz} value={tz}>
            {tz}
          </option>
        ))}
      </select>

      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
        Crear evento
      </button>
    </form>
  );
}
