// Borra una cuenta de prueba y lo que cuelga de ella. Pensado para después de
// un smoke test en producción, que es cuando queda un usuario inventado y su
// invitación quemada ensuciando la lista.
//
// **No carga ningún .env a propósito.** El resto de comandos del repo leen
// `packages/db/.env`, que apunta a desarrollo, y esa comodidad ya provocó una
// migración aplicada a la base equivocada sin un solo mensaje de error. Aquí se
// borra, no se crea: si `DATABASE_URL` no está puesta en la sesión, el script
// se niega a correr en vez de escoger una base por su cuenta.
//
// Uso:
//   $env:DATABASE_URL = "postgres://...-pooler.../..."
//   pnpm limpiar:prueba correo@de-prueba              <- solo muestra
//   pnpm limpiar:prueba correo@de-prueba --confirmar
//
// Sin --confirmar no toca nada: imprime qué borraría y sale.

import postgres from 'postgres';

const email = process.argv[2];
const confirmado = process.argv.includes('--confirmar');

if (!email || email.startsWith('--')) {
  console.error('Falta el correo.\n  pnpm limpiar:prueba correo@de-prueba [--confirmar]');
  process.exit(2);
}

if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL no está puesta en esta sesión.\n' +
      'Ponla primero, para que quede explícito contra qué base borras:\n' +
      '  $env:DATABASE_URL = "postgres://...-pooler.../..."',
  );
  process.exit(2);
}

// El host, nunca la contraseña: sirve para confirmar de un vistazo que apunta a
// donde uno cree, sin escupir la credencial en la terminal ni en un log.
const host = new URL(process.env.DATABASE_URL).host;
const sql = postgres(process.env.DATABASE_URL);

try {
  const [cuenta] = await sql`select id, email, name from "user" where email = ${email}`;
  if (!cuenta) {
    console.log(`No hay ninguna cuenta con el correo ${email} en ${host}. Nada que borrar.`);
    process.exit(0);
  }

  const [{ count: organizaciones }] = await sql`
    select count(*)::int from organizations where owner_id = ${cuenta.id}`;
  const [{ count: eventos }] = await sql`select count(*)::int from events where owner_id = ${cuenta.id}`;
  const invitaciones = await sql`select code from invite_codes where used_by = ${cuenta.id}`;

  console.log(`Base:       ${host}`);
  console.log(`Cuenta:     ${cuenta.name} <${cuenta.email}>`);
  console.log(`Invitación: ${invitaciones.map((i) => i.code).join(', ') || 'ninguna'}`);
  console.log(`Organizaciones: ${organizaciones}   Eventos: ${eventos}`);

  // Una cuenta que ya organizó algo no es de prueba, y borrarla dejaría eventos
  // y tabla pública apuntando a un dueño que no existe. Se para aquí.
  if (organizaciones > 0 || eventos > 0) {
    console.error(
      '\nEsta cuenta tiene organizaciones o eventos: no es una cuenta de prueba.\n' +
        'No se borra nada. Revísala a mano antes de insistir.',
    );
    process.exit(1);
  }

  if (!confirmado) {
    console.log('\nEsto es solo la vista previa; no se borró nada.');
    console.log('Para borrarlo de verdad, repite el comando con --confirmar al final.');
    process.exit(0);
  }

  // Todo en una transacción y en este orden: invite_codes.used_by, session y
  // account referencian a "user", así que borrar el usuario primero falla por
  // llave foránea.
  await sql.begin(async (tx) => {
    await tx`delete from invite_codes where used_by = ${cuenta.id}`;
    await tx`delete from session where user_id = ${cuenta.id}`;
    await tx`delete from account where user_id = ${cuenta.id}`;
    await tx`delete from "user" where id = ${cuenta.id}`;
  });

  console.log(`\nBorrada la cuenta ${cuenta.email} y su invitación en ${host}.`);
} finally {
  await sql.end();
}
