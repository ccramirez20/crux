import type { LeaderboardPayload } from './leaderboard';
import { ROUND_TYPE_LABEL, labelFor } from './labels';

// Una fila por (categoría, ronda, competidor, bloque): es el nivel más crudo
// que sigue teniendo sentido en una hoja de cálculo — el organizador puede
// filtrar o dinamizar desde ahí. Las columnas de puntaje van a ancho fijo con
// las que no aplican al formato de esa ronda vacías, en vez de un esquema
// distinto por evento.
const HEADER = [
  'Categoría',
  'Ronda',
  'Puesto',
  'Empate',
  'Dorsal',
  'Competidor',
  'Bloque',
  'Top',
  'Intentos a top',
  'Zona',
  'Intentos a zona',
  'Altura (bloque)',
  'Tops (total)',
  'Intentos a top (total)',
  'Zonas (total)',
  'Intentos a zona (total)',
  'Puntaje',
  'Altura máxima',
  'Ruta completada',
] as const;

// Excel/LibreOffice necesitan comillas dobles alrededor de cualquier valor
// con coma, comilla o salto de línea; las comillas internas se escapan
// duplicándolas. No vale una dependencia nueva por esto.
function csvCell(value: string | number | boolean | null): string {
  if (value === null) return '';
  const text = typeof value === 'boolean' ? (value ? 'Sí' : 'No') : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRow(values: (string | number | boolean | null)[]): string {
  return values.map(csvCell).join(',');
}

export function buildLeaderboardCsv(payload: LeaderboardPayload): string {
  const rows: string[] = [HEADER.join(',')];

  for (const category of payload.categories) {
    for (const round of category.rounds) {
      const roundLabel = labelFor(ROUND_TYPE_LABEL, round.type);

      for (const row of round.rows) {
        const result = row.result;
        const tops = result.format === 'classic_tops_zones' ? result.tops : null;
        const topAttemptsTotal = result.format === 'classic_tops_zones' ? result.topAttempts : null;
        const zones = result.format === 'classic_tops_zones' ? result.zones : null;
        const zoneAttemptsTotal = result.format === 'classic_tops_zones' ? result.zoneAttempts : null;
        const score = result.format === 'ifsc_boulder' || result.format === 'league_points' ? result.score : null;
        const maxHeight = result.format === 'max_height' ? result.height : null;
        const routeTop = result.format === 'max_height' ? result.top : null;

        const blocks = round.problems.length > 0 ? round.problems : [null];
        for (const problem of blocks) {
          const cell = problem ? row.cells.find((c) => c.problemId === problem.id) : undefined;
          rows.push(
            csvRow([
              category.name,
              roundLabel,
              result.rank,
              result.tied,
              row.bibNumber,
              row.athleteName,
              problem ? problem.number : null,
              cell ? cell.top : null,
              cell ? cell.topAttempts : null,
              cell ? cell.zone : null,
              cell ? cell.zoneAttempts : null,
              cell ? cell.height : null,
              tops,
              topAttemptsTotal,
              zones,
              zoneAttemptsTotal,
              score,
              maxHeight,
              routeTop,
            ]),
          );
        }
      }
    }
  }

  return rows.join('\r\n') + '\r\n';
}
