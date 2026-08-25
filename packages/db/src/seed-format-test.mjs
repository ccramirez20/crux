// Siembra tres eventos de prueba, uno por formato de puntaje (clásico
// tops/zonas, IFSC de bloque, altura máxima en lead), cada uno con 8
// categorías que cubren 2 tamaños de campo (final de 4-5, clasificatoria de
// 10-15) x 4 estados de captura (sin intentos, un intento, un top, ronda
// completa). Es la única forma de comparar los tres formatos y los dos
// tamaños de campo en las mismas condiciones, sin depender de que una
// competencia real esté justo en el punto que hace falta mirar.
//
// Uso:  node src/seed-format-test.mjs
//       node src/seed-format-test.mjs --reset

import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

process.loadEnvFile(new URL('../.env', import.meta.url).pathname.slice(1));

const RESET = process.argv.includes('--reset');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1 });

function mulberry32(seed) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Un nombre deliberadamente largo en cada campo, para poder verificar de
// verdad la compresión de nombres en la gráfica de posiciones — el resto son
// nombres colombianos normales.
const LONG_NAME = 'María Fernanda Restrepo Villalobos';

const SMALL_NAMES = [LONG_NAME, 'Valentina Ocampo', 'Mariana Restrepo', 'Samuel Villegas', 'Tomás Agudelo'];
const LARGE_NAMES = [
  LONG_NAME, 'Valentina Ocampo', 'Mariana Restrepo', 'Luciana Torres', 'Isabella Guerrero',
  'Camila Betancur', 'Salomé Arango', 'Samuel Villegas', 'Tomás Agudelo', 'Emiliano Ruiz',
  'Martín Salazar', 'Jerónimo Pineda', 'Simón Gallego',
];

const BOULDER_BLOCKS = ['Frailejón', 'Cóndor', 'Chingaza', 'Sumapaz'];
const LEAD_ROUTES = ['Muro Norte', 'Diedro', 'Techo', 'Placa'];

const STAGES = ['sin-intentos', 'un-intento', 'un-top', 'completa'];

const EVENTS = [
  { slug: 'prueba-liga', name: 'Prueba · Liga (clásico tops/zonas)', discipline: 'boulder', scoringFormat: 'classic_tops_zones', judgeCode: 'PRUEBA1', kind: 'boulder' },
  { slug: 'prueba-ifsc', name: 'Prueba · IFSC', discipline: 'boulder', scoringFormat: 'ifsc_boulder', judgeCode: 'PRUEBA2', kind: 'boulder' },
  { slug: 'prueba-lead', name: 'Prueba · Lead (altura máxima)', discipline: 'lead', scoringFormat: 'max_height', judgeCode: 'PRUEBA3', kind: 'lead' },
];

async function reset(slug) {
  const [event] = await sql`select id from events where slug = ${slug}`;
  if (!event) return false;
  await sql`delete from attempts where registration_id in (select id from registrations where event_id = ${event.id})`;
  await sql`delete from registrations where event_id = ${event.id}`;
  await sql`delete from problems where round_id in (select r.id from rounds r join categories c on c.id = r.category_id where c.event_id = ${event.id})`;
  await sql`delete from rounds where category_id in (select id from categories where event_id = ${event.id})`;
  await sql`delete from categories where event_id = ${event.id}`;
  await sql`delete from events where id = ${event.id}`;
  return true;
}

async function insertAttempt({ registrationId, problemId, judgeLabel, top, topAttempts, zone, zoneAttempts, height, capturedAt }) {
  await sql`
    insert into attempts (client_attempt_id, registration_id, problem_id, judge_label, top, top_attempts, zone, zone_attempts, height, captured_at)
    values (${randomUUID()}, ${registrationId}, ${problemId}, ${judgeLabel}, ${top}, ${topAttempts ?? null}, ${zone}, ${zoneAttempts ?? null}, ${height ?? null}, ${capturedAt})`;
}

/** Intentos para el estado "completa": suficientes tops repartidos para que
 * la gráfica de promedio de tops se encienda (2+ competidores con 2+ tops
 * cada uno) y suficientes bloques distintos tocados para que la gráfica de
 * posiciones tenga con qué dibujar más de un punto. */
async function seedBoulderAttempts(registrations, problems, seedNumber, start) {
  const random = mulberry32(seedNumber);
  let clock = 0;
  for (let heat = 0; heat < problems.length; heat++) {
    for (const [index, reg] of registrations.entries()) {
      const problemId = problems[(index + heat) % problems.length];
      const skill = reg.skill;
      const roll = random();
      const topped = roll < skill;
      const zoned = !topped && roll < skill + 0.3;
      const tries = 1 + Math.floor(random() * 4);
      clock += 25 + Math.floor(random() * 60);
      await insertAttempt({
        registrationId: reg.id,
        problemId,
        judgeLabel: `Juez ${1 + (heat % 3)}`,
        top: topped,
        topAttempts: topped ? tries : null,
        zone: topped || zoned,
        zoneAttempts: topped || zoned ? Math.max(1, tries - Math.floor(random() * 2)) : null,
        capturedAt: new Date(start.getTime() + clock * 1000).toISOString(),
      });
    }
  }
}

async function seedLeadAttempts(registrations, problems, seedNumber, start) {
  const random = mulberry32(seedNumber);
  let clock = 0;
  // Cada competidor sube cada ruta una sola vez, como en dificultad de verdad:
  // no hay reintentos dentro de la misma vía.
  for (const problemId of problems) {
    for (const reg of registrations) {
      const topped = random() < reg.skill * 0.5;
      const height = topped ? 100 : Math.round(30 + random() * 65);
      clock += 40 + Math.floor(random() * 80);
      await insertAttempt({
        registrationId: reg.id,
        problemId,
        judgeLabel: 'Juez 1',
        top: topped,
        topAttempts: null,
        zone: false,
        zoneAttempts: null,
        height,
        capturedAt: new Date(start.getTime() + clock * 1000).toISOString(),
      });
    }
  }
}

async function seedCategory({ event, kind, fieldLabel, names, roundType, blocks, stage, seedNumber }) {
  const [category] = await sql`
    insert into categories (event_id, name, gender, min_age, level)
    values (${event.id}, ${`${fieldLabel} · ${stage}`}, 'mixed', 10, 'open')
    returning id`;

  const registrations = [];
  const random = mulberry32(seedNumber);
  for (const [i, fullName] of names.entries()) {
    // El identificador incluye el estado, no solo el campo: `registrations`
    // solo permite una inscripción por atleta y evento (sin importar la
    // categoría), así que reusar el mismo atleta en las 4 categorías de
    // "Final 5" del mismo evento violaría esa restricción desde la segunda.
    const documentId = `TEST-${event.slug}-${fieldLabel}-${stage}-${i}`.replace(/\s+/g, '-');
    let [athlete] = await sql`select id from athletes where document_id = ${documentId}`;
    if (!athlete) {
      [athlete] = await sql`
        insert into athletes (full_name, document_id, birth_date, gender)
        values (${fullName}, ${documentId}, '2000-01-01', 'mixed')
        returning id`;
    }
    const [registration] = await sql`
      insert into registrations (athlete_id, event_id, category_id, bib_number)
      values (${athlete.id}, ${event.id}, ${category.id}, ${String(i + 1)})
      returning id`;
    registrations.push({ id: registration.id, skill: 0.35 + random() * 0.55 });
  }

  const [round] = await sql`
    insert into rounds (category_id, type, "order", advances)
    values (${category.id}, ${roundType}, 1, null)
    returning id`;

  const problems = [];
  for (const [i, name] of blocks.entries()) {
    const [problem] = await sql`
      insert into problems (round_id, number, name, top_points, zone_points)
      values (${round.id}, ${i + 1}, ${name}, null, null)
      returning id`;
    problems.push(problem.id);
  }

  const start = new Date('2026-08-24T18:00:00Z');
  if (stage === 'sin-intentos') {
    // Nada que insertar: la ronda existe, cero intentos.
  } else if (stage === 'un-intento') {
    // Un intento que no es top: el primero de la lista se queda en la zona
    // (o simplemente sube sin llegar, en lead).
    await insertAttempt({
      registrationId: registrations[0].id,
      problemId: problems[0],
      judgeLabel: 'Juez 1',
      top: false,
      zone: kind === 'boulder',
      zoneAttempts: kind === 'boulder' ? 2 : null,
      height: kind === 'lead' ? 55 : null,
      capturedAt: start.toISOString(),
    });
  } else if (stage === 'un-top') {
    await insertAttempt({
      registrationId: registrations[0].id,
      problemId: problems[0],
      judgeLabel: 'Juez 1',
      top: true,
      topAttempts: kind === 'boulder' ? 2 : null,
      zone: kind === 'boulder',
      zoneAttempts: kind === 'boulder' ? 2 : null,
      height: kind === 'lead' ? 100 : null,
      capturedAt: start.toISOString(),
    });
  } else {
    if (kind === 'boulder') {
      await seedBoulderAttempts(registrations, problems, seedNumber, start);
    } else {
      await seedLeadAttempts(registrations, problems, seedNumber, start);
    }
  }

  return { category, round, registrations, problems };
}

async function seedEvent(cfg, org, owner, seedBase) {
  const [event] = await sql`
    insert into events (organization_id, owner_id, name, discipline, scoring_format, slug, judge_code, timezone, date)
    values (${org.id}, ${owner.id}, ${cfg.name}, ${cfg.discipline}, ${cfg.scoringFormat},
            ${cfg.slug}, ${cfg.judgeCode}, 'America/Bogota', '2026-08-24')
    returning id`;
  event.slug = cfg.slug;

  const blocks = cfg.kind === 'boulder' ? BOULDER_BLOCKS : LEAD_ROUTES;

  let seedNumber = seedBase;
  for (const stage of STAGES) {
    await seedCategory({
      event, kind: cfg.kind, fieldLabel: 'Final 5', names: SMALL_NAMES,
      roundType: 'final', blocks, stage, seedNumber: seedNumber++,
    });
    await seedCategory({
      event, kind: cfg.kind, fieldLabel: 'Clasificatoria 13', names: LARGE_NAMES,
      roundType: 'qualification', blocks, stage, seedNumber: seedNumber++,
    });
  }

  console.log(`  ${cfg.name}`);
  console.log(`    /resultados/${cfg.slug}`);
  console.log(`    /resultados/${cfg.slug}/proyectar`);
  console.log(`    /juzgar/${cfg.slug}  (código ${cfg.judgeCode})`);
}

// Una categoría aparte, solo en el evento de liga, con las tres rondas
// (clasificatoria, semifinal, final) para poder ver el selector de ronda de
// /juzgar mostrando las tres etiquetas a la vez.
async function seedRoundPickerCheck(event, org, owner) {
  const [category] = await sql`
    insert into categories (event_id, name, gender, min_age, level)
    values (${event.id}, 'Verificar selector de ronda', 'mixed', 10, 'open')
    returning id`;

  const random = mulberry32(999);
  const registrations = [];
  for (const [i, fullName] of ['Ana Ríos', 'Beto Cano', 'Carla Duque', 'Dani Ospina'].entries()) {
    const documentId = `TEST-round-picker-${i}`;
    let [athlete] = await sql`select id from athletes where document_id = ${documentId}`;
    if (!athlete) {
      [athlete] = await sql`
        insert into athletes (full_name, document_id, birth_date, gender)
        values (${fullName}, ${documentId}, '2000-01-01', 'mixed')
        returning id`;
    }
    const [registration] = await sql`
      insert into registrations (athlete_id, event_id, category_id, bib_number)
      values (${athlete.id}, ${event.id}, ${category.id}, ${String(i + 1)})
      returning id`;
    registrations.push({ id: registration.id, skill: 0.5 + random() * 0.3 });
  }

  for (const [roundIndex, type] of ['qualification', 'semifinal', 'final'].entries()) {
    const [round] = await sql`
      insert into rounds (category_id, type, "order", advances)
      values (${category.id}, ${type}, ${roundIndex + 1}, ${type === 'final' ? null : 4})
      returning id`;
    const [problem] = await sql`
      insert into problems (round_id, number, name, top_points, zone_points)
      values (${round.id}, 1, 'Bloque 1', null, null)
      returning id`;
    await insertAttempt({
      registrationId: registrations[0].id,
      problemId: problem.id,
      judgeLabel: 'Juez 1',
      top: true,
      topAttempts: 1,
      zone: true,
      zoneAttempts: 1,
      capturedAt: new Date('2026-08-24T18:00:00Z').toISOString(),
    });
  }
}

async function main() {
  const slugs = EVENTS.map((e) => e.slug);
  const existing = await sql`select slug from events where slug in ${sql(slugs)}`;
  if (existing.length > 0) {
    if (!RESET) {
      console.error(`Ya existe: ${existing.map((e) => e.slug).join(', ')}.`);
      console.error('Corre con --reset para borrarlo y volver a sembrarlo.');
      process.exit(1);
    }
    for (const slug of slugs) {
      await reset(slug);
    }
    console.log('Eventos de prueba anteriores borrados.');
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

  let seedBase = 1000;
  for (const cfg of EVENTS) {
    console.log(`\n${cfg.name}`);
    await seedEvent(cfg, org, owner, seedBase);
    seedBase += 100;
  }

  const [ligaEvent] = await sql`select id from events where slug = 'prueba-liga'`;
  await seedRoundPickerCheck(ligaEvent, org, owner);
  console.log('\nSelector de ronda: /juzgar/prueba-liga (código PRUEBA1), categoría "Verificar selector de ronda".');

  console.log('\nListo.');
  await sql.end();
}

main().catch(async (error) => {
  console.error(error);
  await sql.end();
  process.exit(1);
});
