// Siembra una competencia completa para poder mirar la tabla pública con un
// campo de verdad: sin 20+ inscritos y una sesión entera de intentos, las
// gráficas no tienen nada que decir y el diseño no se puede juzgar.
//
// Plano .mjs con SQL directo a propósito: el paquete se consume como TypeScript
// fuente desde el bundler de Next, así que no hay build que un `node` suelto
// pueda importar. Un seed que escribe columnas explícitas también falla ruidoso
// el día que el esquema cambie, que es justo lo que uno quiere de un seed.
//
// Uso:  pnpm seed:event            crea los tres eventos demo
//       pnpm seed:event --reset    los borra y los vuelve a crear

import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

process.loadEnvFile(new URL('../.env', import.meta.url).pathname.slice(1));

// Tres eventos, no uno. El perfil del competidor no se puede mirar con un solo
// evento: sin un segundo, "historial entre eventos" se ve idéntico a no tener
// historial. Los atletas se reutilizan solos porque el documento
// (`DEMO-<dorsal>`) es el mismo en los tres y el script ya busca por ahí antes
// de insertar.
//
// La Fecha 2 no se toca: mismo slug, misma fecha y misma semilla que antes de
// que existiera la Fecha 1. Es el evento contra el que se cerró el diseño de la
// tabla pública, y si la semilla se corre, se corren las gráficas.
//
// El tercer evento no es una fecha de la liga: es otra copa, con otro formato
// de puntaje. `league_points` era la única de las cuatro estrategias que no se
// había visto nunca en pantalla, y no se puede juzgar un formato leyendo sus
// tests. Reutiliza los mismos documentos `DEMO-1xx`, así que además pone al
// perfil del competidor a cruzar dos formatos distintos, que es lo que hace de
// verdad cuando alguien compite en dos gimnasios.
const FECHAS = [
  {
    slug: 'liga-paramo-f1',
    name: 'Liga Páramo · Fecha 1',
    date: '2026-06-13',
    judgeCode: 'LIGA26F1',
    seed: 20260613,
    // Dos competidoras de cada categoría no corrieron esta fecha: así hay
    // perfiles de un solo evento al lado de perfiles de dos, que es la
    // diferencia que hay que poder ver en pantalla.
    skipLast: 2,
  },
  {
    slug: 'copa-suesca',
    name: 'Copa Suesca',
    // Entre las dos fechas a propósito: el historial del competidor se lee en
    // orden cronológico y con la copa en medio se ve que la línea de tiempo es
    // una línea de tiempo, no la lista de la liga con algo pegado al final.
    date: '2026-07-18',
    judgeCode: 'SUESCA26',
    seed: 20260718,
    skipLast: 3,
    scoringFormat: 'league_points',
    // Los cinco bloques valiendo lo mismo haría de este formato una forma cara
    // de contar tops. El escalón es la razón de ser de la liga local: el crux
    // de la sala paga seis veces lo que paga el de calentamiento.
    //
    // El Nevado va sin puntos de zona (`null`). Es el interruptor "sin crédito
    // parcial" que el esquema documenta y que hasta ahora no ejercitaba nadie:
    // en ese bloque, o se topa o no cuenta.
    problemPoints: [
      { top: 100, zone: 40 },
      { top: 200, zone: 80 },
      { top: 300, zone: 120 },
      { top: 400, zone: 160 },
      { top: 600, zone: null },
    ],
  },
  {
    slug: 'liga-paramo',
    name: 'Liga Páramo · Fecha 2',
    date: '2026-08-22',
    judgeCode: 'LIGA26',
    seed: 20260822,
    skipLast: 0,
  },
];

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

async function reset(slug) {
  const [event] = await sql`select id from events where slug = ${slug}`;
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

async function seedFecha(fecha, org, owner) {
  const [event] = await sql`
    insert into events (organization_id, owner_id, name, discipline, scoring_format, slug, judge_code, timezone, date)
    values (${org.id}, ${owner.id}, ${fecha.name}, 'boulder', ${fecha.scoringFormat ?? 'classic_tops_zones'},
            ${fecha.slug}, ${fecha.judgeCode}, 'America/Bogota', ${fecha.date})
    returning id`;

  // Un generador por fecha. Compartir uno solo entre las dos correría la
  // secuencia de la Fecha 2 y cambiaría la tabla ya diseñada.
  const random = mulberry32(fecha.seed);
  const start = new Date(`${fecha.date}T14:00:00Z`);
  // El dorsal reinicia en 100 en cada fecha: así DEMO-101 es Valentina en las
  // dos y el historial se acumula sobre el mismo atleta.
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
      // Sin `problemPoints` los dos quedan en NULL, que es exactamente lo que
      // tenían las dos fechas de la liga antes de que existiera la copa: para
      // ellas la fila insertada no cambia.
      const points = fecha.problemPoints?.[number - 1] ?? { top: null, zone: null };
      const [problem] = await sql`
        insert into problems (round_id, number, name, top_points, zone_points)
        values (${round.id}, ${number}, ${blockNames[number - 1]}, ${points.top}, ${points.zone})
        returning id`;
      problems.push(problem.id);
    }

    // Cada atleta tiene un nivel real; de ahí sale si topa, si llega a zona y
    // en cuántos intentos. Sin esto todo el mundo hace lo mismo y la tabla no
    // tiene historia que contar.
    const registrations = [];
    for (const [position, fullName] of group.names.entries()) {
      bib += 1;
      // El dorsal corre aunque la competidora no haya venido a esta fecha: es
      // lo que mantiene DEMO-101 apuntando a la misma persona en las dos, y sin
      // eso el historial se mezclaría entre atletas distintos.
      if (position >= group.names.length - fecha.skipLast) {
        continue;
      }
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

    console.log(`  ${group.name}: ${registrations.length} inscritos, 5 bloques.`);
  }

  console.log(`  ${totalAttempts} intentos.`);
  console.log(`  Tabla:  /resultados/${fecha.slug}`);
  console.log(`  Jueces: /juzgar/${fecha.slug}  (código ${fecha.judgeCode})`);
}

async function main() {
  const existing = await sql`select slug from events where slug in ${sql(FECHAS.map((f) => f.slug))}`;
  if (existing.length > 0) {
    if (!RESET) {
      console.error(`Ya existe: ${existing.map((e) => e.slug).join(', ')}.`);
      console.error('Corre con --reset para borrarlo y volver a sembrarlo.');
      process.exit(1);
    }
    for (const fecha of FECHAS) {
      await reset(fecha.slug);
    }
    console.log('Eventos anteriores borrados.');
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

  // En orden cronológico: la Fecha 1 crea los atletas y los dos eventos que
  // siguen los reutilizan por documento, que es de donde sale el historial.
  for (const fecha of FECHAS) {
    console.log(`\n${fecha.name} (${fecha.date})`);
    await seedFecha(fecha, org, owner);
  }

  console.log('\nListo. Perfil de un competidor: abre una fila en la tabla y sigue "Ver historial".');
  await sql.end();
}

main().catch(async (error) => {
  console.error(error);
  await sql.end();
  process.exit(1);
});
