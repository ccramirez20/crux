'use client';

import { useEffect, useState } from 'react';
import { cardClass, fieldClass, primaryButtonClass } from '@/lib/ui';
import { AttemptCapture } from './attempt-capture';
import { BlockPicker } from './block-picker';
import { JudgeCodeGate } from './judge-code-gate';

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

// Per event: a judge working two events on the same phone shouldn't have one
// code silently shadow the other.
function judgeCodeKey(slug: string): string {
  return `crux-judge-code:${slug}`;
}

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
  requiresJudgeCode,
}: {
  event: JudgeEvent;
  categories: JudgeCategory[];
  registrations: JudgeRegistration[];
  lockedProblemId: string | null;
  requiresJudgeCode: boolean;
}) {
  const [judgeName, setJudgeName] = useState<string | null>(null);
  const [judgeCode, setJudgeCode] = useState<string | null>(null);
  const [nameLoaded, setNameLoaded] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [activeProblemId, setActiveProblemId] = useState<string | null>(lockedProblemId);
  const [isLocked, setIsLocked] = useState(lockedProblemId !== null);

  // localStorage is client-only, so the stored name can't be read during the
  // server render. `nameLoaded` keeps the name prompt from flashing on every
  // page load for a judge who already set it.
  useEffect(() => {
    setJudgeName(localStorage.getItem(JUDGE_NAME_KEY));
    setJudgeCode(localStorage.getItem(judgeCodeKey(event.slug)));
    setNameLoaded(true);
  }, [event.slug]);

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

  // Access first, identity second: asking someone to introduce themselves and
  // only then telling them they can't come in is the wrong order.
  if (requiresJudgeCode && judgeCode === null) {
    return (
      <JudgeCodeGate
        slug={event.slug}
        onUnlocked={(code) => {
          localStorage.setItem(judgeCodeKey(event.slug), code);
          setJudgeCode(code);
        }}
      />
    );
  }

  if (judgeName === null) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-3">
        <h2 className="font-display text-xl font-bold">¿Quién va a juzgar?</h2>
        <p className="text-sm text-muted">
          Tu nombre queda guardado en cada intento que registres, para poder resolver dudas
          después.
        </p>
        <input
          type="text"
          placeholder="Tu nombre"
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          className={fieldClass}
        />
        <button type="button" onClick={() => storeJudgeName(nameDraft)} className={primaryButtonClass}>
          Continuar
        </button>
      </div>
    );
  }

  const active = activeProblemId ? findProblem(categories, activeProblemId) : null;

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      {isEditingName ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="judge-name" className="text-sm font-medium text-bark">
            ¿Quién está juzgando?
          </label>
          <input
            id="judge-name"
            type="text"
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            className={fieldClass}
          />
          <button
            type="button"
            onClick={() => {
              storeJudgeName(nameDraft);
              setIsEditingName(false);
            }}
            className={primaryButtonClass}
          >
            Guardar nombre
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted">
          Juzga {judgeName}.{' '}
          <button
            type="button"
            className="font-medium text-pine underline"
            onClick={() => {
              setNameDraft(judgeName);
              setIsEditingName(true);
            }}
          >
            No soy yo
          </button>
        </p>
      )}

      {active && isLocked ? (
        <div className={`${cardClass} flex items-center justify-between gap-3 py-3`}>
          <span>
            <span className="block text-xs uppercase tracking-wide text-muted">Estás juzgando</span>
            <span className="font-display text-lg font-semibold">
              Bloque {active.problem.number}
              {active.problem.name ? ` · ${active.problem.name}` : ''}
            </span>
          </span>
          <button
            type="button"
            className="shrink-0 font-medium text-sm text-pine underline"
            onClick={() => setIsLocked(false)}
          >
            Cambiar
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
          judgeCode={judgeCode}
          registrations={registrations.filter((r) => r.categoryId === active.categoryId)}
          onCodeRejected={() => {
            localStorage.removeItem(judgeCodeKey(event.slug));
            setJudgeCode(null);
          }}
        />
      )}
    </div>
  );
}
