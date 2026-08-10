// Siembra una competencia completa para poder mirar la tabla pública con un
// campo de verdad: sin 20+ inscritos y una sesión entera de intentos, las
// gráficas no tienen nada que decir y el diseño no se puede juzgar.
//
// Plano .mjs con SQL directo a propósito: el paquete se consume como TypeScript
// fuente desde el bundler de Next, así que no hay build que un `node` suelto
// pueda importar. Un seed que escribe columnas explícitas también falla ruidoso
// el día que el esquema cambie, que es justo lo que uno quiere de un seed.
//
// Uso:  pnpm seed:event            crea la competencia demo
//       pnpm seed:event --reset    borra la anterior y la vuelve a crear

import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

process.loadEnvFile(new URL('../.env', import.meta.url).pathname.slice(1));

const SLUG = 'liga-paramo';
const JUDGE_CODE = 'LIGA26';
const RESET = process.argv.includes('--reset');

/** PRNG con semilla: la misma competencia en cada corrida, para poder comparar diseños. */
function mulberry32(seed) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FEMALE = [
  'Valentina Ocampo', 'Mariana Restrepo', 'Luciana Torres', 'Isabella Guerrero',
  'Camila Betancur', 'Salomé Arango', 'Antonia Vélez', 'Manuela Cifuentes',
  'Emilia Zapata', 'Juliana Mesa', 'Sofía Cardona', 'Gabriela Hoyos',
  'Daniela Quintero', 'Paulina Escobar',
];
const MALE = [
  'Samuel Villegas', 'Tomás Agudelo', 'Emiliano Ruiz', 'Martín Salazar',
  'Jerónimo Pineda', 'Simón Gallego', 'Nicolás Bedoya', 'Alejandro Ramírez',
  'Andrés Montoya', 'Felipe Cárdenas', 'Sebastián Ríos', 'Mateo Londoño',
];

const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1 });

async function reset() {
  const [event] = await sql`select id from events where slug = ${SLUG}`;
  if (!event) return false;
  // De la hoja a la raíz: cada tabla referencia a la anterior.
  await sql`delete from attempts where registration_id in (select id from registrations where event_id = ${event.id})`;
  await sql`delete from registrations where event_id = ${event.id}`;
  await sql`delete from problems where round_id in (select r.id from rounds r join categories c on c.id = r.category_id where c.event_id = ${event.id})`;
  await sql`delete from rounds where category_id in (select id from categories where event_id = ${event.id})`;
  await sql`delete from categories where event_id = ${event.id}`;
  await sql`delete from events where id = ${event.id}`;
  return true;
}

async function main() {
  const existing = await sql`select id from events where slug = ${SLUG}`;
  if (existing.length > 0) {
    if (!RESET) {
      console.error(`Ya existe un evento con slug "${SLUG}".`);
      console.error('Corre con --reset para borrarlo y volver a sembrarlo.');
      process.exit(1);
    }
    await reset();
    console.log('Evento anterior borrado.');
  }

  const [owner] = await sql`select id from "user" order by created_at limit 1`;
  if (!owner) {
    console.error('No hay ninguna cuenta todavía. Regístrate en /sign-up y vuelve a correr esto.');
    process.exit(1);
  }

  let [org] = await sql`select id from organizations where owner_id = ${owner.id} limit 1`;
  if (!org) {
    [org] = await sql`
      insert into organizations (owner_id, name, location)
      values (${owner.id}, 'Gimnasio Páramo', 'Medellín')
      returning id`;
  }

  const [event] = await sql`
    insert into events (organization_id, owner_id, name, discipline, scoring_format, slug, judge_code, timezone, date)
    values (${org.id}, ${owner.id}, 'Liga Páramo · Fecha 2', 'boulder', 'classic_tops_zones',
            ${SLUG}, ${JUDGE_CODE}, 'America/Bogota', '2026-08-22')
    returning id`;

  const random = mulberry32(20260822);
  const start = new Date('2026-08-22T14:00:00Z');
  let bib = 100;
  let clock = 0;
  let totalAttempts = 0;

  for (const group of [
    { name: 'Open Femenina', gender: 'female', names: FEMALE },
    { name: 'Open Masculina', gender: 'male', names: MALE },
  ]) {
    const [category] = await sql`
      insert into categories (event_id, name, gender, min_age, level)
      values (${event.id}, ${group.name}, ${group.gender}, 16, 'open')
      returning id`;

    const [round] = await sql`
      insert into rounds (category_id, type, "order") values (${category.id}, 'qualification', 1) returning id`;

    const problems = [];
    const blockNames = ['Frailejón', 'Cóndor', 'Chingaza', 'Sumapaz', 'Nevado'];
    for (let number = 1; number <= 5; number++) {
      const [problem] = await sql`
        insert into problems (round_id, number, name) values (${round.id}, ${number}, ${blockNames[number - 1]}) returning id`;
      problems.push(problem.id);
    }

    // Cada atleta tiene un nivel real; de ahí sale si topa, si llega a zona y
    // en cuántos intentos. Sin esto todo el mundo hace lo mismo y la tabla no
    // tiene historia que contar.
    const registrations = [];
    for (const fullName of group.names) {
      bib += 1;
      const documentId = `DEMO-${bib}`;
      let [athlete] = await sql`select id from athletes where document_id = ${documentId}`;
      if (!athlete) {
        [athlete] = await sql`
          insert into athletes (full_name, document_id, birth_date, gender)
          values (${fullName}, ${documentId}, '2002-05-14', ${group.gender})
          returning id`;
      }
      const [registration] = await sql`
        insert into registrations (athlete_id, event_id, category_id, bib_number)
        values (${athlete.id}, ${event.id}, ${category.id}, ${String(bib)})
        returning id`;
      registrations.push({ id: registration.id, skill: 0.25 + random() * 0.7 });
    }

    // Rotación real de gimnasio: cada tanda, cada competidor pasa a otro
    // bloque. Por eso los puestos se mueven durante la sesión en vez de quedar
    // definidos desde el primer bloque.
    for (let heat = 0; heat < problems.length; heat++) {
      for (const [index, registration] of registrations.entries()) {
        const problemId = problems[(index + heat) % problems.length];
        const roll = random();
        const topped = roll < registration.skill;
        const zoned = !topped && roll < registration.skill + 0.3;
        const tries = 1 + Math.floor(random() * 4);
        clock += 30 + Math.floor(random() * 90);

        await sql`
          insert into attempts (client_attempt_id, registration_id, problem_id, judge_label, top, top_attempts, zone, zone_attempts, captured_at)
          values (${randomUUID()}, ${registration.id}, ${problemId}, ${'Juez ' + (1 + (heat % 3))},
                  ${topped}, ${topped ? tries : null}, ${topped || zoned},
                  ${topped || zoned ? Math.max(1, tries - Math.floor(random() * 2)) : null},
                  ${new Date(start.getTime() + clock * 1000).toISOString()})`;
        totalAttempts += 1;
      }
    }

    console.log(`${group.name}: ${registrations.length} inscritos, 5 bloques.`);
  }

  console.log(`\nListo. ${totalAttempts} intentos sembrados.`);
  console.log(`  Tabla:  /resultados/${SLUG}`);
  console.log(`  Jueces: /juzgar/${SLUG}  (código ${JUDGE_CODE})`);
  await sql.end();
}

main().catch(async (error) => {
  console.error(error);
  await sql.end();
  process.exit(1);
});
