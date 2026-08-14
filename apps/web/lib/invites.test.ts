import { describe, expect, it } from 'vitest';
import { createDb } from '@crux/db';
import { claimInvite, deleteUnusedInvite, recordInviteUser } from './invites';

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

describe('deleteUnusedInvite', () => {
  it('no puede borrar una invitación ya canjeada', () => {
    const { sql, params } = deleteUnusedInvite(db, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee').toSQL();
    // Sin el `used_at is null` en el WHERE, descartar un código se llevaría por
    // delante el rastro de quién entró con él — que es justo para lo que existe
    // la tabla.
    expect(sql).toMatch(/delete.*where.*"id" = \$\d.*and.*"used_at" is null/is);
    expect(params).toContain('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });
});

describe('recordInviteUser', () => {
  it('no pisa el usuario de una invitación ya anotada', () => {
    const { sql } = recordInviteUser(db, 'ABCD2345', 'user-1').toSQL();
    expect(sql).toMatch(/where.*"code" = \$\d.*and.*"used_by" is null/is);
  });
});
