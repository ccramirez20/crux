'use client';

import { useState } from 'react';
import { upload } from '@vercel/blob/client';
import { fieldClass, labelClass } from '@/lib/ui';
import { updateOrganizationLogo } from './actions';

export function OrganizationLogoForm({
  organizationId,
  logo,
}: {
  organizationId: string;
  logo: string | null;
}) {
  const [preview, setPreview] = useState(logo);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setIsUploading(true);
    try {
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/organization-logo',
        clientPayload: organizationId,
      });
      const result = await updateOrganizationLogo({ organizationId, logoUrl: blob.url });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreview(blob.url);
    } catch {
      setError('No se pudo subir el logo. Inténtalo de nuevo.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element -- logo remoto de Vercel Blob, no un asset local que next/image pueda optimizar
        <img
          src={preview}
          alt="Logo del gimnasio"
          width={96}
          height={96}
          className="rounded-lg border border-cardborder bg-card object-contain p-2"
        />
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="logo-file" className={labelClass}>
          Logo del gimnasio
        </label>
        <input
          id="logo-file"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={isUploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
          className={fieldClass}
        />
        <p className="text-xs text-muted">
          Aparece junto al nombre del gimnasio en las tarjetas compartibles de resultado. PNG, JPG
          o WebP, hasta 2 MB.
        </p>
      </div>
      {isUploading && <p className="text-sm text-muted">Subiendo…</p>}
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
