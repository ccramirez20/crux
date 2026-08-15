# Despliegue

Crux corre en Vercel. No hay `vercel.json`: todo lo que hace falta se
configura una vez en el panel de Vercel, y un archivo de configuración que
repite lo que ya dice el panel es una cosa más que se desincroniza.

## Lo que hay que hacer una sola vez

1. **Importar el repositorio.** En Vercel, *Add New → Project*, y escoger este
   repositorio de GitHub.
2. **Root Directory: `apps/web`.** Es un monorepo de pnpm; sin esto Vercel
   busca el `next.config.ts` en la raíz y no lo encuentra. Vercel detecta
   `pnpm-workspace.yaml` e instala desde la raíz por su cuenta.
3. **Framework: Next.js.** Lo detecta solo. No hay que tocar los comandos de
   build ni de instalación.
4. **Variables de entorno** (las cuatro, antes del primer despliegue — ver
   abajo).
5. **Aplicar migraciones** contra la base de producción antes del primer
   tráfico: `pnpm db:migrate` con `DATABASE_URL` apuntando allá. Nada en el
   despliegue las aplica solo, y CI únicamente verifica que el SQL generado
   esté al día, no lo corre.

   El comando carga `packages/db/.env` por defecto (ahí vive la cadena de
   desarrollo) — `dotenv` no sobreescribe una variable que ya esté puesta en
   la sesión, así que hay que fijar `DATABASE_URL` a mano *antes* de correrlo
   o migra calladamente contra la base equivocada, sin error visible:

   ```powershell
   $env:DATABASE_URL = "postgres://...-pooler.../..."
   pnpm db:migrate
   ```

   Cerrar esa terminal (o borrar la variable) después, para no dejarla puesta
   en una sesión que luego se use para desarrollo normal.
6. **Comprobar**: abrir `/api/health`. Devuelve `{"ok":true}` solo si la
   aplicación levantó **y** la base responde. Si da 503, es la base.
7. **Smoke test.** `/api/health` en verde no prueba el flujo real. Antes de
   compartir el enlace con un gimnasio: crear un evento de prueba desde el
   panel de producción, inscribirse por el enlace público, capturar un
   intento desde `/juzgar/...` con el código del evento, y confirmar que
   `/resultados/...` lo refleja. Es el mismo recorrido que se probó en local
   el 2026-08-13 — repetirlo contra producción es lo que confirma que las
   variables de entorno y la migración quedaron bien, no solo que el proceso
   arrancó. Borrar el evento de prueba al terminar.

   Si el smoke test incluyó crear una cuenta con una invitación, la cuenta y
   el código quemado se limpian con:

   ```powershell
   $env:DATABASE_URL = "postgres://...-pooler.../..."
   pnpm limpiar:prueba correo@de-prueba              # solo muestra qué borraría
   pnpm limpiar:prueba correo@de-prueba --confirmar
   ```

   El script **no** lee `packages/db/.env` a propósito: si `DATABASE_URL` no
   está puesta en la sesión se niega a correr, en vez de escoger una base por
   su cuenta como hacen los demás comandos. Y se detiene si la cuenta tiene
   organizaciones o eventos, porque entonces no es de prueba.

## Variables de entorno

| Variable | Para qué | Si falta |
|---|---|---|
| `DATABASE_URL` | Postgres (Neon) | La aplicación levanta y todo falla contra la base; `/api/health` da 503 |
| `BETTER_AUTH_SECRET` | Firma de sesiones | **Better Auth lanza excepción y no arranca.** En producción rechaza el secreto por defecto a propósito |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Orígenes válidos para autenticación | **Nadie puede entrar.** En producción `trustedOrigins()` devuelve *solo* esta lista, así que vacía significa que todo intento de sign-in es "Invalid origin" |
| `ADMIN_EMAIL` | Correo de la cuenta que emite invitaciones | Nadie ve `/panel/invites` (devuelve 404), así que nadie puede emitir códigos y nadie nuevo puede registrarse. Falla cerrado a propósito (`apps/web/lib/admin.ts`) |

## Invitaciones de organizador

El registro está cerrado: para crear una cuenta hace falta un código de un solo
uso. `ADMIN_EMAIL` es también el correo con el que se entra al panel, así que
**no se escribe en el repositorio**: se consulta en las variables de entorno de
Vercel. El que aparece publicado en la portada y en el manual es otro,
`contacto@cruxcompetencias.com`. Los emite quien tenga ese correo, desde `/panel/invites`
(la ruta devuelve 404 para cualquier otra cuenta). Un código sirve una vez: al
consumirse queda marcado con quién lo usó, y reintentarlo da "Código de acceso
inválido."

Esto reemplazó a `ORGANIZER_ACCESS_CODE`, que era un único secreto reutilizable:
quien lo consiguiera podía abrir cuentas indefinidamente. **Al desplegar este
cambio hay que borrar `ORGANIZER_ACCESS_CODE` de Vercel, agregar `ADMIN_EMAIL`
con el correo de la cuenta ya creada, y correr la migración `0005` contra la
base de producción** — sin la tabla `invite_codes` el registro falla entero.

`BETTER_AUTH_SECRET` se genera con `openssl rand -base64 32`. Better Auth
advierte por debajo de 32 caracteres y por baja entropía; no lo escribas a mano.

`BETTER_AUTH_TRUSTED_ORIGINS` va con la URL completa y con esquema, separadas
por coma si son varias: `https://crux.vercel.app`. En desarrollo no hace falta
— las direcciones de red privada se confían solas para que el teléfono del juez
alcance el servidor por IP de LAN.

`BETTER_AUTH_URL` no es obligatoria: Better Auth deduce la URL base de
`VERCEL_URL`. Vale la pena ponerla igual, apuntando al dominio de producción,
porque `VERCEL_URL` cambia en cada *preview* y así producción queda fija.

## Dominio y correo

`cruxcompetencias.com`, registrado en Cloudflare y servido por Vercel. Se
descartaron los cortos —`crux.co`, `crux.com.co`, `crux.gg`— porque están todos
aparcados en revendedores, o sea precio de negociación y no de registro. El
nombre largo además dice **competencias** y no *escalada*, que es lo que hay que
poder decir el día que el motor sirva a otro deporte.

**Los registros DNS van en gris, «DNS only», no en naranja.** Cloudflare insiste
con un aviso en que hay que activar el proxy para sus funciones de seguridad y
caché; aquí no. Vercel ya es el CDN y ya absorbe el pico de la tabla pública, y
el proxy de Cloudflare por delante mete una **tercera** ventana de caché encima
de las dos que ya se midieron en `app/api/resultados/[slug]/route.ts` — el atraso
de la pantalla proyectada es exactamente la suma de esas ventanas. Además
complica la emisión del certificado, que Vercel valida por HTTP.

`contacto@cruxcompetencias.com` es la dirección de cara al cliente, y la sirve
**Cloudflare Email Routing**: solo recibe y reenvía a un buzón que ya existe,
gratis, sin servidor de correo y sin registros MX que mantener a mano. Para
*enviar* desde ella haría falta un proveedor con SMTP (Zoho gratis, Google
Workspace pago), y hoy no hace falta: la aplicación no manda un solo correo.

**El administrador se queda en un buzón fuera de este dominio, a propósito.**
`ADMIN_EMAIL` no es solo una etiqueta: es también el usuario con el que se entra
al panel, así que es media credencial. Estando en otro dominio, quien lea la
portada, el manual o el repositorio no tiene por dónde empezar a adivinarlo — ni
siquiera `admin@` del dominio obvio existe. Por lo mismo la dirección no se
escribe aquí: se mira en Vercel.

Si algún día conviene moverlo, no cuesta nada: el `account` de Better Auth
guarda en `account_id` el **id** del usuario y no su correo (comprobado contra
la base) y `requireEmailVerification` está en `false`, así que un `update` sobre
`user.email` deja intactas la contraseña, la sesión y los eventos que ya posee.
Cambiar `ADMIN_EMAIL` en Vercel va **después** del `update`: entre los dos pasos
nadie es administrador y `/panel/invites` responde 404, que es como debe fallar.

## Cosas que muerden

**Usa la cadena de conexión *pooled* de Neon** (la que lleva `-pooler` en el
host). Cada función serverless abre su propia conexión y Neon corta al llegar
al límite; la cadena directa se agota con poco tráfico. En un evento la tabla
pública la abre toda la sala al tiempo, que es justo el momento equivocado.

**El plan Hobby de Vercel es para uso no comercial.** Para un piloto sin cobrar
está bien. El día que se le facture a un gimnasio, sus términos piden Pro.

**El freno de fuerza bruta del código de juez vive en memoria del proceso**
(`apps/web/lib/rate-limit.ts`). Con varias instancias, cada una lleva su propio
conteo, así que el límite real es N × 5 fallos. Es el techo que ese archivo ya
declara; el día que estorbe, el contador se muda a una tabla de Postgres.

**Los QR guardan la dirección con la que se generaron.** Los que se hayan
impreso apuntando a `localhost` o a una IP de LAN no sirven en producción. Se
vuelven a generar desde el panel abierto en la URL de producción.

## Lo que no está montado

Recuperación de contraseña. Ya no la bloquea el dominio —eso se resolvió— sino
que Email Routing solo recibe: mandar un enlace de restablecimiento pide un
proveedor con SMTP. Mientras tanto, una cuenta sin acceso se recupera a mano en
la base, y el manual dice exactamente eso y a qué dirección escribir.
