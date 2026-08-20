// Lista curada en vez de las ~400 zonas de `Intl.supportedValuesOf('timeZone')`:
// para el mercado actual (Latinoamérica, con el resto del mundo cubierto pero
// no exhaustivo) una lista corta y reconocible por país sirve más que una
// técnica y completa. El valor guardado sigue siendo un identificador IANA
// real, así que nada más en el repo necesita cambiar.
const TIMEZONE_PLACES: { value: string; place: string }[] = [
  { value: 'Pacific/Honolulu', place: 'Hawái' },
  { value: 'America/Anchorage', place: 'Alaska' },
  { value: 'America/Los_Angeles', place: 'Estados Unidos (Pacífico)' },
  { value: 'America/Tijuana', place: 'México (Tijuana)' },
  { value: 'America/Denver', place: 'Estados Unidos (Montaña)' },
  { value: 'America/Chicago', place: 'Estados Unidos (Centro)' },
  { value: 'America/Mexico_City', place: 'México' },
  { value: 'America/Guatemala', place: 'Guatemala' },
  { value: 'America/Costa_Rica', place: 'Costa Rica' },
  { value: 'America/El_Salvador', place: 'El Salvador' },
  { value: 'America/Managua', place: 'Nicaragua' },
  { value: 'America/Tegucigalpa', place: 'Honduras' },
  { value: 'America/Bogota', place: 'Colombia' },
  { value: 'America/Lima', place: 'Perú' },
  { value: 'America/Guayaquil', place: 'Ecuador' },
  { value: 'America/Panama', place: 'Panamá' },
  { value: 'America/Havana', place: 'Cuba' },
  { value: 'America/New_York', place: 'Estados Unidos (Este)' },
  { value: 'America/Toronto', place: 'Canadá (Este)' },
  { value: 'America/Santo_Domingo', place: 'República Dominicana' },
  { value: 'America/Puerto_Rico', place: 'Puerto Rico' },
  { value: 'America/Caracas', place: 'Venezuela' },
  { value: 'America/La_Paz', place: 'Bolivia' },
  { value: 'America/Santiago', place: 'Chile' },
  { value: 'America/Asuncion', place: 'Paraguay' },
  { value: 'America/Argentina/Buenos_Aires', place: 'Argentina' },
  { value: 'America/Montevideo', place: 'Uruguay' },
  { value: 'America/Sao_Paulo', place: 'Brasil' },
  { value: 'Atlantic/Azores', place: 'Azores' },
  { value: 'UTC', place: 'UTC' },
  { value: 'Europe/London', place: 'Reino Unido' },
  { value: 'Europe/Madrid', place: 'España' },
  { value: 'Europe/Paris', place: 'Francia' },
  { value: 'Europe/Berlin', place: 'Alemania' },
  { value: 'Europe/Rome', place: 'Italia' },
  { value: 'Europe/Athens', place: 'Grecia' },
  { value: 'Africa/Johannesburg', place: 'Sudáfrica' },
  { value: 'Europe/Moscow', place: 'Rusia (Moscú)' },
  { value: 'Asia/Dubai', place: 'Emiratos Árabes Unidos' },
  { value: 'Asia/Kolkata', place: 'India' },
  { value: 'Asia/Shanghai', place: 'China' },
  { value: 'Asia/Tokyo', place: 'Japón' },
  { value: 'Australia/Sydney', place: 'Australia (Sídney)' },
  { value: 'Pacific/Auckland', place: 'Nueva Zelanda' },
];

export interface TimezoneOption {
  value: string;
  place: string;
  offset: string;
  label: string;
}

/** "GMT-5" del navegador, en el formato que se usa en la UI: "UTC-5". */
export function offsetFor(timeZone: string, at: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  }).formatToParts(at);
  const raw = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  return raw.replace('GMT', 'UTC');
}

function offsetMinutes(offset: string): number {
  const match = /^UTC([+-])(\d{1,2})(?::(\d{2}))?$/.exec(offset);
  if (!match) {
    return 0;
  }
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

/**
 * El offset se calcula al vuelo (no se guarda a mano) porque varía con el
 * horario de verano — un valor fijo por zona quedaría mal la mitad del año
 * en los países que lo observan. Ordenar por ese offset agrupa visualmente
 * las zonas cercanas en vez de la mezcla alfabética por continente que traía
 * la lista completa de IANA.
 */
export function buildTimezoneOptions(at: Date = new Date()): TimezoneOption[] {
  return TIMEZONE_PLACES.map(({ value, place }) => {
    const offset = offsetFor(value, at);
    return { value, place, offset, label: `${offset} · ${place}` };
  }).sort((a, b) => offsetMinutes(a.offset) - offsetMinutes(b.offset));
}
