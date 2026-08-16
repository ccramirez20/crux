'use client';

import { useTransition } from 'react';
import { fieldClass } from '@/lib/ui';
import { selectOrganization } from './actions';

/**
 * Solo aparece cuando la cuenta tiene más de una organización, que hoy es
 * únicamente la cuenta que administra la plataforma: la de producción y la de
 * pruebas. Una cuenta de gimnasio tiene una y ve su nombre, no este selector.
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
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-bark">Organización</span>
      <select
        value={selectedId}
        disabled={isPending}
        onChange={(event) => {
          const { value } = event.target;
          startTransition(async () => {
            await selectOrganization(value);
          });
        }}
        className={`${fieldClass} disabled:opacity-60`}
      >
        {/* Con la ciudad, no solo el nombre: es la misma información que ve
            quien tiene una sola organización, y es lo que distingue dos sedes
            de la misma marca. */}
        {organizations.map((organization) => (
          <option key={organization.id} value={organization.id}>
            {organization.name} · {organization.location}
          </option>
        ))}
      </select>
    </label>
  );
}
