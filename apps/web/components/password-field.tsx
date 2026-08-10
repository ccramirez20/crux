'use client';

import { useState } from 'react';
import { fieldClass } from '@/lib/ui';

// Two call sites today (iniciar sesión, crear cuenta) and a third coming with
// password recovery. Kept as one component rather than duplicated because the
// show/hide is stateful: two copies means two places to get the a11y wiring
// wrong.
export function PasswordField({
  value,
  onChange,
  placeholder = 'Contraseña',
  minLength,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minLength?: number;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        className={`${fieldClass} w-full pr-20`}
      />
      <button
        type="button"
        onClick={() => setVisible((previous) => !previous)}
        aria-pressed={visible}
        aria-label={visible ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-pine underline"
      >
        {visible ? 'Ocultar' : 'Ver'}
      </button>
    </div>
  );
}
