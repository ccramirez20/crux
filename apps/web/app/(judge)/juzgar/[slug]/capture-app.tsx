'use client';

import { useEffect, useState } from 'react';
import { cardClass, fieldClass, primaryButtonClass } from '@/lib/ui';
import { AttemptCapture } from './attempt-capture';
import { BlockPicker } from './block-picker';

export type JudgeProblem = { id: string; number: number; name: string | null };
export type JudgeRound = { id: string; type: string; order: number; problems: JudgeProblem[] };
export type JudgeCategory = { id: string; name: string; rounds: JudgeRound[] };
export type JudgeRegistration = {
  id: string;
  bibNumber: string | null;
  categoryId: string;
  athleteFullName: string;
};
export type JudgeEvent = { id: string; slug: string; discipline: string };

const JUDGE_NAME_KEY = 'crux-judge-name';

function findProblem(
  categories: JudgeCategory[],
  problemId: string,
): { problem: JudgeProblem; categoryId: string } | null {
  for (const category of categories) {
    for (const round of category.rounds) {
      const problem = round.problems.find((p) => p.id === problemId);
      if (problem) {
        return { problem, categoryId: category.id };
      }
    }
  }
  return null;
}

export function CaptureApp({
  event,
  categories,
  registrations,
  lockedProblemId,
}: {
  event: JudgeEvent;
  categories: JudgeCategory[];
  registrations: JudgeRegistration[];
  lockedProblemId: string | null;
}) {
  const [judgeName, setJudgeName] = useState<string | null>(null);
  const [nameLoaded, setNameLoaded] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [activeProblemId, setActiveProblemId] = useState<string | null>(lockedProblemId);
  const [isLocked, setIsLocked] = useState(lockedProblemId !== null);

  // localStorage is client-only, so the stored name can't be read during the
  // server render. `nameLoaded` keeps the name prompt from flashing on every
  // page load for a judge who already set it.
  useEffect(() => {
    setJudgeName(localStorage.getItem(JUDGE_NAME_KEY));
    setNameLoaded(true);
  }, []);

  function storeJudgeName(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    localStorage.setItem(JUDGE_NAME_KEY, trimmed);
    setJudgeName(trimmed);
  }

  if (!nameLoaded) {
    return null;
  }

  if (judgeName === null) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-3">
        <p className="text-sm text-muted">Tu nombre queda en cada intento que registres.</p>
        <input
          type="text"
          placeholder="Tu nombre"
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          className={fieldClass}
        />
        <button type="button" onClick={() => storeJudgeName(nameDraft)} className={primaryButtonClass}>
          Empezar a juzgar
        </button>
      </div>
    );
  }

  const active = activeProblemId ? findProblem(categories, activeProblemId) : null;

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <p className="text-sm text-muted">
        Juez: {judgeName}{' '}
        <button
          type="button"
          className="text-pine underline"
          onClick={() => {
            const next = prompt('Nuevo nombre', judgeName);
            if (next !== null) {
              storeJudgeName(next);
            }
          }}
        >
          cambiar
        </button>
      </p>

      {active && isLocked ? (
        <div className={`${cardClass} flex items-center justify-between gap-2 py-3`}>
          <span className="font-display font-semibold">
            Bloque #{active.problem.number} {active.problem.name ?? ''}
          </span>
          <button
            type="button"
            className="shrink-0 text-sm text-pine underline"
            onClick={() => setIsLocked(false)}
          >
            cambiar
          </button>
        </div>
      ) : (
        <BlockPicker
          categories={categories}
          onSelect={(problemId) => {
            setActiveProblemId(problemId);
            setIsLocked(true);
          }}
        />
      )}

      {active && isLocked && (
        <AttemptCapture
          discipline={event.discipline}
          problemId={active.problem.id}
          judgeName={judgeName}
          registrations={registrations.filter((r) => r.categoryId === active.categoryId)}
        />
      )}
    </div>
  );
}
