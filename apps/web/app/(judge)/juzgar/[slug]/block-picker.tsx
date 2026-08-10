'use client';

import { useState } from 'react';
import { fieldClass } from '@/lib/ui';
import type { JudgeCategory } from './capture-app';

export function BlockPicker({
  categories,
  onSelect,
}: {
  categories: JudgeCategory[];
  onSelect: (problemId: string) => void;
}) {
  const [categoryId, setCategoryId] = useState('');
  const [roundId, setRoundId] = useState('');

  const category = categories.find((c) => c.id === categoryId);
  const round = category?.rounds.find((r) => r.id === roundId);

  return (
    <div className="flex w-full flex-col gap-3">
      <select
        value={categoryId}
        onChange={(event) => {
          setCategoryId(event.target.value);
          setRoundId('');
        }}
        className={fieldClass}
      >
        <option value="">Elige categoría</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {category && (
        <select value={roundId} onChange={(event) => setRoundId(event.target.value)} className={fieldClass}>
          <option value="">Elige ronda</option>
          {category.rounds.map((r) => (
            <option key={r.id} value={r.id}>
              {r.type}
            </option>
          ))}
        </select>
      )}

      {round && (
        <select
          defaultValue=""
          onChange={(event) => event.target.value && onSelect(event.target.value)}
          className={fieldClass}
        >
          <option value="">Elige bloque</option>
          {round.problems.map((p) => (
            <option key={p.id} value={p.id}>
              #{p.number} {p.name ?? ''}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
