import { ImageResponse } from 'next/og';
import { buildShareCard, type ShareCard } from '@/lib/share-card';

// Sin fuente propia, misma razón que opengraph-image.tsx: la paleta y las
// curvas son lo que se reconoce, no la tipografía. Formato historia —
// Instagram/WhatsApp— no el 1200x630 de un link preview.
// `size`/`contentType` como exports especiales solo existen en la convención
// `opengraph-image.tsx`; en un Route Handler cualquiera el build los rechaza
// (el tipo generado por Next solo admite verbos HTTP y un puñado de exports
// de configuración), así que aquí `size` es un valor normal, no exportado.
const size = { width: 1080, height: 1920 };

const INK = '#241F19';
const PINE = '#2F4A3E';
const GOLD = '#E3A83B';
const GOLD_INK = '#B37D00';
const SILVER = '#8FA3AE';
const SILVER_INK = '#74858E';
const BRONZE = '#7E4F2C';
const SAGE = '#B9C4AC';
const CARD = '#FBF8F0';
const CARDBORDER = '#DAD2BC';
const MUTED = '#7A7266';

const RANK_COLOR: Record<1 | 2 | 3, string> = { 1: GOLD, 2: SILVER, 3: BRONZE };
const RANK_INK: Record<1 | 2 | 3, string> = { 1: GOLD_INK, 2: SILVER_INK, 3: BRONZE };

function Topo() {
  return (
    <svg width={1080} height={130} viewBox="0 0 800 90" style={{ display: 'flex' }}>
      <path d="M0,60 Q100,20 200,55 T400,50 T600,60 T800,45" fill="none" stroke={SAGE} strokeWidth={4} opacity={0.85} />
      <path d="M0,72 Q100,35 200,68 T400,64 T600,74 T800,58" fill="none" stroke={PINE} strokeWidth={4} opacity={0.6} />
      <path d="M0,84 Q100,50 200,80 T400,78 T600,86 T800,72" fill="none" stroke={GOLD} strokeWidth={4} opacity={0.75} />
    </svg>
  );
}

// Los tres estados de la montaña cuentan la historia sin ilustrar a nadie:
// debut es solo contorno con un punto en la base — todavía no la ha subido.
// Progreso está llena, con una marca a media ladera y una flecha — hasta
// dónde llegó, no la cumbre. Podio la llena entera del color del puesto.
function Mountain({ card }: { card: ShareCard }) {
  const w = card.variant === 'podium' ? 810 : 720;
  const h = card.variant === 'podium' ? 634 : 583;
  if (card.variant === 'debut') {
    return (
      <svg width={w} height={h} viewBox="0 0 180 140" style={{ display: 'flex' }}>
        <polygon points="10,130 70,40 110,90 130,60 170,130" fill={SAGE} opacity={0.3} />
        <polygon points="40,130 95,20 150,130" fill="none" stroke={PINE} strokeWidth={3} />
        <circle cx={40} cy={130} r={5} fill={GOLD} />
      </svg>
    );
  }
  if (card.variant === 'podium') {
    const rank = card.rank ?? 1;
    return (
      <svg width={w} height={h} viewBox="0 0 180 140" style={{ display: 'flex' }}>
        <polygon points="10,130 70,40 110,90 130,60 170,130" fill={SAGE} opacity={0.4} />
        <polygon points="40,130 95,20 150,130" fill={RANK_COLOR[rank]} />
        <circle cx={95} cy={20} r={7} fill={PINE} />
      </svg>
    );
  }
  return (
    <svg width={w} height={h} viewBox="0 0 180 140" style={{ display: 'flex' }}>
      <polygon points="10,130 70,40 110,90 130,60 170,130" fill={SAGE} opacity={0.4} />
      <polygon points="40,130 95,20 150,130" fill={PINE} />
      <line x1={60} y1={130} x2={60} y2={62} stroke={GOLD} strokeWidth={3} strokeDasharray="4 5" />
      <circle cx={60} cy={62} r={7} fill={GOLD} />
      <path d="M50 50 L60 38 L70 50" stroke={GOLD} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ athleteId: string }> },
): Promise<Response> {
  const { athleteId } = await params;
  const eventSlug = new URL(request.url).searchParams.get('evento');
  if (!eventSlug) {
    return new Response('Falta ?evento=', { status: 400 });
  }

  const result = await buildShareCard(athleteId, eventSlug);
  if (!result.ok) {
    return new Response('No hay tarjeta para compartir.', { status: 404 });
  }
  const { card } = result;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: CARD,
          color: INK,
        }}
      >
        <Topo />
        <div style={{ display: 'flex', justifyContent: 'center', fontSize: 40, fontWeight: 800, letterSpacing: 6, color: PINE, marginTop: 43 }}>
          CRUX
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
          <Mountain card={card} />
          {/* Sin `width`/`justifyContent` en estos renglones a propósito:
              Satori centra bien un texto que se deja medir por su propio
              contenido (como hace este contenedor, con solo `padding`), pero
              si a un hijo se le fuerza un `width` explícito dentro de una
              columna centrada, dejar de medir por contenido lo saca del
              lienzo — probado a las malas con un fondo de depuración. */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '0 100px',
              gap: card.variant === 'podium' ? 14 : 18,
            }}
          >
            <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center', color: MUTED }}>
              {[card.eventName, card.eventDateLabel].filter(Boolean).join(' · ')}
            </div>
            {card.variant === 'podium' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    display: 'flex',
                    fontSize: 54,
                    fontWeight: 800,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    color: RANK_INK[card.rank ?? 1],
                  }}
                >
                  {card.headline}
                </div>
                <div style={{ display: 'flex', fontSize: 76, fontWeight: 800, color: PINE, textAlign: 'center', marginTop: 6 }}>
                  {card.athleteName}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', fontSize: 94, fontWeight: 800, color: PINE, lineHeight: 1.08, textAlign: 'center' }}>
                {card.headline}
              </div>
            )}
            {card.variant !== 'podium' && (
              <div style={{ display: 'flex', fontSize: 61, fontWeight: 700, color: PINE, textAlign: 'center', marginTop: 20 }}>
                {card.athleteName}
              </div>
            )}
            <div style={{ display: 'flex', fontSize: 41, color: MUTED, textAlign: 'center' }}>
              {card.disciplineLabel} · {card.categoryName}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 58 }}>
          {/* El logo del organizador tiene su propio renglón, arriba del
              link — no compartido y apretado con él. Es lo único que el
              organizador puede mostrar de su marca en la tarjeta. */}
          {card.organizationLogo && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 25, marginBottom: 28 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- next/og renderiza su propio <img>, no pasa por next/image */}
              <img src={card.organizationLogo} width={79} height={79} style={{ borderRadius: 18 }} alt="" />
              <div style={{ display: 'flex', fontSize: 43, fontWeight: 700, color: PINE }}>{card.organizationName}</div>
            </div>
          )}
          <div style={{ display: 'flex', width: '100%', justifyContent: 'center', borderTop: `2px solid ${CARDBORDER}`, paddingTop: 32 }}>
            <div style={{ display: 'flex', fontSize: 32, color: MUTED }}>cruxcompetencias.com</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
