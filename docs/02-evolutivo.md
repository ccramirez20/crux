# Crux — Tarjetas compartibles de evento (brief definitivo de implementación)

> Documento de producto/diseño para implementar en Claude Code. Describe comportamiento, contenido, estética y reglas, no la implementación. Los colores de marca, el logo, la tipografía y los tokens estéticos de Crux ya están en el repo/conocidos por Claude Code; este brief se apoya en ellos y no los redefine.

---

## 1. Qué es y para qué

Después de una competencia, cada competidor puede obtener una **tarjeta imagen lista para compartir** en Instagram/WhatsApp que celebra su logro personal, con un **link de vuelta al perfil público del atleta** en Crux.

**Objetivo único:** que la gente *quiera* compartir. La tarjeta es el canal de distribución orgánico de Crux — cada tarjeta compartida es un competidor mostrando su resultado y, de paso, la plataforma. No es una feature de vanidad.

**Principio rector:** cubrir al *mid-pack*, no solo al podio. Si solo quien gana tiene algo que postear, se desperdicia el 90% de los competidores. Cada competidor debe poder salir con al menos una tarjeta que lo haga ver bien.

---

## 2. Público y tono

Comunidad amateur de escalada en Colombia: gimnasios, clubes, competidores jóvenes y adultos, muchas categorías juveniles. Comparten logros personales y debuts, no solo victorias. Tono cercano, orgulloso, de comunidad — no corporativo. La tarjeta se siente como logro propio, no como anuncio de Crux.

---

## 3. Modelo de entrega — **pull, sin push**

- **No hay notificación push automática.** Nada de spam. La tarjeta *existe* en la página de resultado y en el perfil del atleta, con un botón de compartir.
- El competidor la encuentra porque igual vuelve a ver su resultado en el scoreboard.
- **Opt-in opcional, apagado por defecto:** casilla en inscripción ("avísenme cuando esté mi resultado"). Solo quien la marca recibe aviso. No es spam si lo pidieron.

---

## 4. Variantes de tarjeta (v1: dos)

### 4.1 Logro / progreso personal (aplica a todos)
Una sola tarjeta con **contenido condicional** según el histórico. Nadie se queda sin tarjeta:

- **Histórico previo en la misma modalidad + mejoró:** "Subí N puestos" o "Récord personal".
- **Histórico pero no mejoró:** hito neutro y positivo ("Completé la Copa Páramo", "N bloques encadenados").
- **Sin histórico (debut):** "Mi primera competencia", "Mi primera Copa Páramo", "Primer top en competencia".

Regla obligatoria: la tarjeta de progreso **siempre** resuelve a algo compartible. El fallback a debut/hito es la ruta por defecto cuando no hay comparación posible.

### 4.2 Podio
Solo si `puesto ∈ {1,2,3}` en la categoría. "1er lugar — Copa Páramo — Categoría X".

---

## 5. Estética y pixel art

- Pixel art = **motivo decorativo pequeño en estilo de marca Crux**, dentro de la tarjeta. **No hay fotos del atleta**; se descarta cualquier pipeline de fotos en v1.
- **El pixel art se relaciona con el logro compartido**, no es genérico. Motivos guía (Claude Code afina según assets):
  - *Podio / 1er lugar:* escalador alcanzando el tope / último agarre.
  - *Debut:* escalador iniciando la vía desde el suelo / primer movimiento.
  - *Progreso / récord:* escalador ascendiendo, traza/flecha de progreso.
  - *Por modalidad (si es barato):* boulder (bloque bajo), dificultad (pared alta), velocidad (cronómetro).
- **Recoloreable por evento:** cada evento tiene una **paleta temática** (`paleta_tema`; ej. Copa Páramo → colores Páramo). El mismo asset se recolorea con la paleta del evento manteniendo el estilo Crux de base.
- Estilo: sencillo, legible a tamaño pequeño, coherente con identidad Crux (paleta base, tipografía, logo ya en repo).

---

## 6. Logo del organizador (gimnasio)

- **Opcional.** El organizador puede subir el logo de su gimnasio.
- Si existe, se muestra en:
  - El **dashboard** del evento (vista del organizador).
  - Las **tarjetas compartidas** del evento (co-branding).
  - La página pública de resultados del evento.
- **Jerarquía de marca en la tarjeta:** logro del atleta (protagonista) → logo del organizador visible → Crux discreto en el footer con la URL. Demasiada marca Crux parece ad y baja la compartición; muy poca y no se captura nada.

---

## 7. Cómo se comparte y cómo engancha

- **Formato:** imagen vertical 1080×1920 (Stories / estado WhatsApp). Un solo formato en v1.
- **Generación server-side** de la imagen, para que sea archivo compartible real y para incluir **OG tags** en el link del perfil (que la previsualización se vea bien al pegar en WhatsApp/IG es parte de por qué se comparte).
- **Compartir one-tap**, sin edición ni personalización en v1. Fricción cero.
- **Link de vuelta al perfil público del atleta** (historial, resultados del evento). Ese link convierte el sharing en tráfico.
- **El gancho** es el encuadre del logro personal (progreso, debut, récord), no el ranking. Aplica a todos, se ve bien, se comparte sin haber ganado.

---

## 8. Analítica interna — **agregada, no identificable** (SÍ se construye en v1)

Objetivo: saber **a qué páginas/tarjetas va más el tráfico**, para enfocar el desarrollo. Es analítica **interna, invisible al usuario**. No confundir con métricas de vanidad (sección 9), que NO existen.

**Reglas de build obligatorias (para no activar el régimen pesado de datos personales en Colombia):**

- **First-party y del lado del servidor.** Prohibido Google Analytics u otros SDK de terceros (activan cookies, consentimiento y transferencia internacional).
- **Cookieless / sin identificador por usuario.** No se coloca cookie persistente ni ID de dispositivo para analítica. No hay tracking cross-sesión ni perfilamiento individual.
- **Solo contadores agregados.** Se cuentan eventos, no personas:
  - Vistas por ruta/página (qué páginas se visitan más).
  - Origen de referencia en categorías agregadas (whatsapp / instagram / búsqueda / directo).
  - Clics del botón compartir, segmentados por **tipo de tarjeta** (progreso vs. podio) y por evento.
  - Rollups por evento.
- **Sin IP cruda ligada a eventos.** No almacenar IP asociada a la vista. Si se requiere deduplicar, usar conteo agregado o hash efímero de corta vida; preferible no guardar IP.
- **Nunca ligar analítica a la identidad de un competidor. Jamás a un menor.** Ningún registro analítico se asocia a un `competitor_id`.

Con esto se obtiene "dónde enfocar desarrollo" sin banner de cookies ni consentimiento adicional cansón.

**Política de datos:** incluir/actualizar una **Política de Tratamiento de Datos** (necesaria de todos modos por el registro de inscripciones) que mencione la recolección de **estadísticas de uso agregadas y anónimas**. Costo marginal, cubre el flanco.

> Nota legal: marco Ley 1581/2012 + Decreto 1377/2013 + Resolución SIC 32.126/2022. El disparador de consentimiento es la **identificabilidad**; analítica agregada no identificable no lo activa. No es asesoría legal; dada la fiscalización activa de la SIC, conviene una revisión legal express antes de publicar.

---

## 9. Lo que **NO** se construye en v1 (explícito)

- **Sin métricas visibles para el atleta.** Nada de "N personas vieron tu perfil", contadores públicos de vistas o shares, ni comparativas públicas. Se omite a propósito para no generar presión ni ansiedad de rendimiento. (Distinto de la analítica interna agregada de la sección 8, que es invisible al usuario.)
- **Sin push notifications** (sección 3).
- **Sin pipeline de fotos** del atleta.
- **Sin editor/personalización** de la tarjeta.
- **Sin analítica identificable ni por-usuario** (sección 8 fija los límites).

---

## 10. Menores y consentimiento (bloqueante — resolver antes de publicar)

Categorías juveniles son grandes en escalada. Requisitos:

- **Perfiles de menores no indexables por defecto** (noindex), para no exponer nombre/resultado de un menor en buscadores.
- **Tarjeta compartible de un menor solo detrás de `consentimiento_publicacion`** capturado explícitamente en inscripción (consentimiento parental).
- **La analítica agregada nunca identifica ni perfila a menores** (sección 8).
- El modelo *pull* ayuda (el atleta/acompañante decide compartir), pero el perfil público indexable es la exposición a controlar.
- Cumplir Habeas Data / protección de datos de menores (Colombia).

Restricción recomendada si el chequeo legal lo exige: bloquear por completo indexación y compartición de menores hasta tener consentimiento verificado; degradar la tarjeta del menor a una versión sin nombre/no pública mientras tanto.

---

## 11. Modelo de datos mínimo

**Event**
- `id`, `nombre`, `slug`, `fecha`, `modalidad`
- `paleta_tema` (recolorea el pixel art)
- `organizador` (nombre + `logo` opcional)
- `es_publico`

**Competitor**
- `id`, `nombre`, `categoria`
- `es_menor`
- `consentimiento_publicacion`

**Result**
- `competitor_id`, `event_id`, `categoria`
- `puesto`
- `puntaje` / `bloques` / `marca` (tiempo, para velocidad)

**Derivados para la tarjeta de progreso** (desde results previos del competitor en la misma modalidad):
- `delta_puesto` (vs. última competencia comparable)
- `es_PR` (récord personal en puntaje/marca)
- `es_debut` (sin histórico → fallback a hito)

**Podio:** flag directo desde `puesto`.

**Analítica (agregada, sin FK a competitor):**
- contador por `ruta`
- contador por `origen_referencia` (categoría)
- contador de `share_click` por `tipo_tarjeta` y `event_id`

---

## 12. Alcance

- **v1:** tarjeta de logro/progreso personal (con fallback a debut/hito) + tarjeta de podio. Pixel art por logro, recoloreable por `paleta_tema`. Logo de organizador opcional en dashboard, tarjetas y página del evento. Compartir pull, one-tap, vertical, con OG y link al perfil. Analítica interna agregada no identificable. Consentimiento de menores resuelto.
- **Futuro (no ahora):** más variantes (velocidad/tiempos, comparativas entre amigos), formatos adicionales, y —si se decide— métricas visibles al usuario (bajo diseño cuidadoso para no generar presión).
