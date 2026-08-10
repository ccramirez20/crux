// Abrir un evento son tres consultas contra una base remota y hasta ahora la
// pantalla se quedaba congelada en la lista mientras tanto: sin respuesta al
// toque, el organizador vuelve a tocar. Next monta esto en el instante en que
// se toca el enlace, y la forma es la de la página que viene, no un spinner:
// así el salto al contenido real no reacomoda nada.
function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-cardborder ${className}`} />;
}

export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col items-center gap-6 px-4 py-12">
      <div className="flex w-full max-w-2xl flex-col gap-3">
        <Bar className="h-3 w-28" />
        <Bar className="h-9 w-3/5" />
        <Bar className="h-3 w-2/5" />
      </div>

      <div className="w-full max-w-2xl rounded-lg border border-cardborder bg-white p-5">
        <Bar className="h-4 w-40" />
        <div className="mt-3 flex flex-col gap-2">
          <Bar className="h-3 w-full" />
          <Bar className="h-3 w-4/5" />
        </div>
      </div>

      <p className="text-sm text-muted" role="status">
        Abriendo el evento…
      </p>

      <div className="flex w-full max-w-2xl flex-col gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-lg border border-cardborder bg-white p-5">
            <Bar className="h-4 w-1/3" />
            <div className="mt-3">
              <Bar className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
