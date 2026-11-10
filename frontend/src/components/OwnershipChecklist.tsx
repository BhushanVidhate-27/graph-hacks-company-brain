import React from 'react';

/**
 * Interactive companion to /learn/service-ownership-checklist.
 *
 * The article states four non-negotiables; this turns them into a checklist an
 * engineer can actually run against one service. State is local-only
 * (localStorage) because the guide is public and should not create accounts or
 * send data anywhere.
 */

const STORAGE_KEY = 'helio.ownership-checklist.v1';

const ITEMS: { id: string; label: string; detail: string }[] = [
  {
    id: 'owner',
    label: 'A current team is named as accountable',
    detail: 'Not a person who might have moved teams, and not a team alias nobody monitors.',
  },
  {
    id: 'start',
    label: 'The ownership edge has a start date',
    detail: 'The date the current team became accountable, so history is a record rather than a guess.',
  },
  {
    id: 'escalation',
    label: 'An escalation path can be paged today',
    detail: 'A person or rotation that answers outside business hours, if the service needs it.',
  },
  {
    id: 'handover',
    label: 'The last handover is a dated decision',
    detail: 'A linked decision or change record, not a silent edit to a table cell.',
  },
  {
    id: 'verified',
    label: 'The record has a last-verified date',
    detail: 'Someone confirmed the owner recently; the date is visible next to the name.',
  },
  {
    id: 'cadence',
    label: 'A review cadence is set',
    detail: 'A named interval (for example 90 days) and a person responsible for the review.',
  },
  {
    id: 'oncall',
    label: 'On-call points at the accountable team',
    detail: 'The rotation and the owner agree. A rotation pointing elsewhere is a silent conflict.',
  },
  {
    id: 'dependencies',
    label: 'Impact dependencies are recorded',
    detail: 'The services that break when this one fails, and the ones it depends on.',
  },
];

function readState(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function statusFor(done: number, total: number): { label: string; tone: string } {
  if (done === total) return { label: 'Auditable', tone: 'bg-[#282828] text-white' };
  if (done >= 6) return { label: 'Nearly there', tone: 'bg-[#e15c46] text-white' };
  if (done >= 3) return { label: 'Partial', tone: 'bg-[#f4f4ec] text-[#282828] cad-border' };
  return { label: 'Not ready', tone: 'bg-[#f4f4ec] text-[#8a8a80] cad-border' };
}

export const OwnershipChecklist: React.FC = () => {
  const [checked, setChecked] = React.useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    setChecked(readState());
    setLoaded(true);
  }, []);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Private browsing or storage disabled — the checklist still works.
      }
      return next;
    });
  };

  const reset = () => {
    setChecked({});
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const done = ITEMS.filter((item) => checked[item.id]).length;
  const total = ITEMS.length;
  const status = statusFor(done, total);
  const percent = Math.round((done / total) * 100);

  return (
    <section className="max-w-3xl pt-10" aria-labelledby="ownership-checklist">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2
          id="ownership-checklist"
          className="font-mono text-xl md:text-2xl font-bold uppercase tracking-tight text-[#282828]"
        >
          Run the checklist
        </h2>
        <span
          className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest font-bold ${status.tone}`}
        >
          {loaded ? `${status.label} · ${done}/${total}` : `${total} checks`}
        </span>
      </div>
      <p className="mt-2 font-mono text-xs text-[#5c5c56] leading-relaxed">
        Pick one service and check what is actually true today. Everything stays in this browser.
      </p>

      <div
        className="mt-4 h-2 w-full cad-border bg-[#f4f4ec]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label="Ownership record completeness"
      >
        <div className="h-full bg-[#e15c46] transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>

      <ul className="mt-4 cad-border divide-y divide-[#282828]/10 bg-[#f4f4ec]">
        {ITEMS.map((item) => {
          const isChecked = Boolean(checked[item.id]);
          return (
            <li key={item.id}>
              <label className="flex cursor-pointer gap-3 p-4 hover:bg-[#282828] hover:text-white group">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#e15c46]"
                  checked={isChecked}
                  onChange={() => toggle(item.id)}
                />
                <span>
                  <span className="block font-mono text-sm font-bold leading-snug">{item.label}</span>
                  <span className="mt-1 block font-mono text-[11px] text-[#5c5c56] group-hover:text-white/70 leading-relaxed">
                    {item.detail}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[#8a8a80]">
          {done === total
            ? 'Ready to answer “who owns this” with evidence.'
            : 'Anything unchecked is a dead end for the next engineer.'}
        </p>
        <button
          type="button"
          onClick={reset}
          className="font-mono text-[10px] uppercase tracking-widest text-[#e15c46] hover:underline"
        >
          Reset
        </button>
      </div>
    </section>
  );
};
