'use client';

import { useTransition } from 'react';
import { selectOrganization } from './actions';

/**
 * Solo aparece cuando la cuenta tiene más de una organización, que hoy es
 * únicamente la cuenta que administra la plataforma: la de producción y la de
 * pruebas. Una cuenta de gimnasio tiene una y ve su nombre, no este selector.
 *
 * Botones y no un `<select>`: el desplegable nativo se abre encima de la
 * lista de eventos justo debajo, y en escritorio tapaba la mitad de arriba.
 * Con dos organizaciones —el único caso real hoy— un par de botones no tiene
 * ese problema porque nunca abre nada por encima del resto de la pantalla.
 */
export function OrganizationPicker({
  organizations,
  selectedId,
}: {
  organizations: { id: string; name: string; location: string }[];
  selectedId: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-bark">Organización</span>
      <div className="flex flex-wrap gap-2">
        {/* Con la ciudad, no solo el nombre: es la misma información que ve
            quien tiene una sola organización, y es lo que distingue dos sedes
            de la misma marca. */}
        {organizations.map((organization) => {
          const active = organization.id === selectedId;
          return (
            <button
              key={organization.id}
              type="button"
              disabled={isPending}
              onClick={() => {
                if (active) return;
                startTransition(async () => {
                  await selectOrganization(organization.id);
                });
              }}
              className={`rounded-lg border-[1.5px] px-3 py-2 text-left text-sm font-medium transition disabled:opacity-60 ${
                active
                  ? 'border-pine bg-pine text-white'
                  : 'border-cardborder text-ink hover:border-pine'
              }`}
            >
              {organization.name} · {organization.location}
            </button>
          );
        })}
      </div>
    </div>
  );
}
