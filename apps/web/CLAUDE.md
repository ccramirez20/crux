# apps/web — reglas de la interfaz

## Jerga en pantalla (es-CO)

Decidido el 2026-08-10. Vive en `apps/web/lib/labels.ts`; ninguna pantalla
escribe estas palabras a mano.

- **Modalidad: las dos palabras juntas.** `boulder` → **"Boulder / Bloque"**,
  `lead` → **"Lead / Dificultad"**. Cuando exista, `speed` → "Speed /
  Velocidad". En el gimnasio se dice boulder y lead; en la inscripción de una
  liga se lee bloque y dificultad. Quien conoce solo una de las dos igual se
  ubica. **Nunca "búlder" castellanizado.**
- **Unidad puntuable: una sola palabra, según la modalidad.** En boulder es
  **bloque**; en todo lo que se escala con cuerda es **ruta**. Se usa
  `problemUnit(discipline)`. Aquí no van las dos palabras: el nombre aparece
  decenas de veces por pantalla y "bloque / ruta" en cada una sería ruido.
- En el código todo sigue siendo `Problem` y `Discipline`. La jerga es de la
  interfaz, no del modelo.
