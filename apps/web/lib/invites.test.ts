import { describe, expect, it } from 'vitest';
import { createDb } from '@crux/db';
import { claimInvite, recordInviteUser } from './invites';

// postgres.js conecta perezosamente: construir el query y pedirle el SQL nunca
// abre un socket, así que esto corre sin base de datos.
const db = createDb('postgresql://user:pass@localhost:5432/test');

describe('claimInvite', () => {
  it('solo actualiza la fila si sigue sin usar', () => {
    const { sql, params } = claimInvite(db, 'ABCD2345').toSQL();
    // Sin este `used_at is null` el mismo código sirve infinitas veces, que es
    // exactamente el agujero que la tabla vino a cerrar.
    expect(sql).toMatch(/where.*"code" = \$\d.*and.*"used_at" is null/is);
    expect(params).toContain('ABCD2345');
  });

  it('devuelve el id para poder distinguir consumido de ya usado', () => {
    // Cero filas devueltas es la señal de "código inválido o ya usado"; sin el
    // returning no hay forma de saberlo.
    expect(claimInvite(db, 'ABCD2345').toSQL().sql).toMatch(/returning/i);
  });
});

describe('recordInviteUser', () => {
  it('no pisa el usuario de una invitación ya anotada', () => {
    const { sql } = recordInviteUser(db, 'ABCD2345', 'user-1').toSQL();
    expect(sql).toMatch(/where.*"code" = \$\d.*and.*"used_by" is null/is);
  });
});
