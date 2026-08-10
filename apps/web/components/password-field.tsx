'use client';

import { useState } from 'react';
import { fieldClass } from '@/lib/ui';

// Two call sites today (iniciar sesión, crear cuenta) and a third coming with
// password recovery. Kept as one component rather than duplicated because the
// show/hide is stateful: two copies means two places to get the a11y wiring
// wrong.
export function PasswordField({
  id = 'password',
  label = 'Contraseña',
  hint,
  value,
  onChange,
  minLength,
  autoComplete,
}: {
  id?: string;
  label?: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  minLength?: number;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-bark">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
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
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
