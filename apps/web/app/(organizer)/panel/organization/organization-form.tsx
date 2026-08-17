'use client';

import { useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { labelClass } from '@/lib/ui';
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
  const inputRef = useRef<HTMLInputElement>(null);
  // El blob local se revoca al reemplazarlo o desmontar — si no, cada
  // selección de archivo deja una URL colgada en memoria del navegador.
  const localPreviewRef = useRef<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setIsUploading(true);
    // Vista previa inmediata con el archivo local: no hay que esperar la
    // subida para ver que sí se escogió el logo correcto.
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    const localUrl = URL.createObjectURL(file);
    localPreviewRef.current = localUrl;
    setPreview(localUrl);
    try {
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/organization-logo',
        clientPayload: organizationId,
      });
      const result = await updateOrganizationLogo({ organizationId, logoUrl: blob.url });
      if (!result.ok) {
        setError(result.error);
        setPreview(logo);
        return;
      }
      setPreview(blob.url);
    } catch {
      setError('No se pudo subir el logo. Inténtalo de nuevo.');
      setPreview(logo);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <span className={labelClass}>Logo del gimnasio</span>
      <div className="flex items-center gap-4">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-cardborder bg-card">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo remoto de Vercel Blob (o un blob local de vista previa), no un asset que next/image pueda optimizar
            <img src={preview} alt="Logo del gimnasio" className="h-full w-full rounded-lg object-contain p-2" />
          ) : (
            <span className="px-2 text-center text-xs text-muted">Sin logo</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          {/* Botón propio en vez del `<input type="file">` a la vista: ese
              control no tiene estado `:active` visible en ningún navegador,
              así que un clic no se sentía como que hizo algo. El input real
              sigue existiendo, solo que oculto y disparado por este botón —
              la ventana del selector de archivos la abre el sistema
              operativo, no la página, así que su tamaño no se puede fijar
              desde aquí. */}
          <button
            type="button"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
            className="w-fit rounded-lg border-[1.5px] border-pine px-4 py-2 text-sm font-semibold text-pine transition active:scale-95 active:bg-pine active:text-white hover:bg-pine hover:text-white disabled:opacity-50"
          >
            {isUploading ? 'Subiendo…' : preview ? 'Cambiar logo' : 'Subir logo'}
          </button>
          <input
            ref={inputRef}
            id="logo-file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={isUploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
            className="hidden"
          />
          <p className="text-xs text-muted">
            Aparece junto al nombre del gimnasio en las tarjetas compartibles de resultado. PNG,
            JPG o WebP, hasta 2 MB.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
