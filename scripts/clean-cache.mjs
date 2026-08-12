// Borra la cache de turbo. Turbo no tiene evicción propia: `.turbo/cache` crece
// hasta que alguien la borra a mano, y los logs por paquete quedan colgando
// cuando una tarea deja de existir. Todo esto está en .gitignore, así que
// borrarlo no puede perder trabajo — a lo sumo la próxima corrida es más lenta.
//
// En Node y no `rm -rf` porque en Windows pnpm corre los scripts en cmd.exe,
// donde `rm` no existe. Las rutas están fijas aquí y no se pasan por argumento:
// esto solo puede borrar la cache.

import { existsSync, readdirSync, rmdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';

// readdirSync y no globSync: en Node 22 glob es experimental y avisa por
// consola en cada corrida.
const workspaces = ['apps', 'packages'].flatMap((root) =>
  readdirSync(root).map((name) => `${root}/${name}/.turbo`),
);
const targets = ['.turbo/cache', ...workspaces];

let removed = 0;
for (const target of targets) {
  // Saltar lo que no existe, y no solo confiar en el `force` de rmSync: sin
  // esto el script dice "borrado" de rutas que nunca estuvieron, y la limpieza
  // del padre de más abajo revienta al correrlo dos veces seguidas.
  if (!existsSync(target)) {
    continue;
  }
  rmSync(target, { recursive: true, force: true });
  console.log(`borrado ${target}`);
  removed += 1;

  // Un paquete que ya no existe deja su carpeta vacía al quitarle el .turbo.
  // rmdirSync falla si no está vacía, que es justo la garantía que se quiere.
  const parent = dirname(target);
  if (parent !== '.' && readdirSync(parent).length === 0) {
    rmdirSync(parent);
    console.log(`borrado ${parent}, que quedó vacío`);
  }
}

console.log(removed === 0 ? 'no había caché que borrar' : `${removed} rutas borradas`);
