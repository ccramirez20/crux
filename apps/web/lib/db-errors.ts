function hasPostgresUniqueCode(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

// Drizzle wraps the driver error in a query-failure Error whose `.cause` holds
// the real postgres.js PostgresError (where `.code` actually lives) — checking
// only the top-level error lets a duplicate-key insert crash as a 500 instead
// of being handled as the expected condition it is.
export function isUniqueViolation(error: unknown): boolean {
  return (
    hasPostgresUniqueCode(error) ||
    (typeof error === 'object' && error !== null && 'cause' in error && hasPostgresUniqueCode(error.cause))
  );
}
