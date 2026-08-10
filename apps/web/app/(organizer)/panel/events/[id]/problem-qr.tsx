'use client';

import { useState } from 'react';
import QRCode from 'qrcode';

export function ProblemQr({ slug, problemId }: { slug: string; problemId: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [url, setUrl] = useState('');

  async function toggle() {
    if (dataUrl) {
      setDataUrl(null);
      return;
    }
    // Built on click, not at render: the origin has to be the address the
    // phone can actually reach (the LAN IP when the organizer opened the
    // panel that way), and reading `window` during render would diverge the
    // server-rendered HTML from the client's.
    const judgeUrl = `${window.location.origin}/juzgar/${slug}/${problemId}`;
    setUrl(judgeUrl);
    setDataUrl(await QRCode.toDataURL(judgeUrl, { margin: 1, width: 240 }));
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button type="button" onClick={toggle} className="text-xs text-pine underline">
        {dataUrl ? 'Ocultar QR' : 'Ver QR'}
      </button>
      {dataUrl && (
        <div className="flex flex-col items-end gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL can't go through next/image's optimizer */}
          <img src={dataUrl} alt={`QR para juzgar este bloque (${url})`} width={240} height={240} />
          <span className="max-w-[240px] break-all text-right text-[10px] text-muted">{url}</span>
        </div>
      )}
    </div>
  );
}
