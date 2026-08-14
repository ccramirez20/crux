import { and, eq, inviteCodes, isNull, type Db } from '@crux/db';

/**
 * Consume una invitación, si sigue sin usar.
 *
 * El `AND used_at IS NULL` dentro del `UPDATE` es lo que hace esto atómico: con
 * dos registros simultáneos que envían el mismo código, Postgres serializa las
 * dos actualizaciones y la segunda no encuentra fila que actualizar. Leer
 * primero y actualizar después dejaría pasar a los dos.
 *
 * Devuelve el query de drizzle, no una promesa ya lanzada: `await` lo ejecuta,
 * y el test puede pedirle `.toSQL()` sin tocar la base.
 */
export function claimInvite(db: Db, code: string) {
  return db
    .update(inviteCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(inviteCodes.code, code), isNull(inviteCodes.usedAt)))
    .returning({ id: inviteCodes.id });
}

/**
 * Descarta una invitación que nadie usó.
 *
 * El `used_at IS NULL` es parte del borrado, no una comprobación aparte: entre
 * leer y borrar cabe un canje, y sin la condición en el WHERE ese borrado se
 * llevaría por delante el rastro de un organizador que sí entró.
 */
export function deleteUnusedInvite(db: Db, id: string) {
  return db.delete(inviteCodes).where(and(eq(inviteCodes.id, id), isNull(inviteCodes.usedAt)));
}

/**
 * Anota quién usó la invitación. Va aparte de `claimInvite` porque el id del
 * usuario solo existe después de que Better Auth crea la cuenta, y el consumo
 * tiene que ocurrir antes de crearla.
 */
export function recordInviteUser(db: Db, code: string, userId: string) {
  return db
    .update(inviteCodes)
    .set({ usedBy: userId })
    .where(and(eq(inviteCodes.code, code), isNull(inviteCodes.usedBy)));
}
