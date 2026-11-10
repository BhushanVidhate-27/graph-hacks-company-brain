import React from 'react';
import { Link } from 'react-router-dom';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import { Button, Card, Eyebrow } from '../components/ui';
import { useAuth } from '../lib/auth';
import {
  ApiError,
  askQuestion,
  isMockAnswer,
  type AskResult,
  type TrailItem,
} from '../lib/api';
import { cn } from '../lib/utils';

const EXAMPLES = [
  'Who owns payments-gateway?',
  'What breaks if the ledger service goes down?',
  'Where was the payments provider decided?',
];

interface Message {
  id: number;
  role: 'user' | 'assistant';
  result?: AskResult;
  error?: string;
  streaming?: boolean;
}

const TrailRow: React.FC<{ item: TrailItem }> = ({ item }) => (
  <div className="flex items-start justify-between gap-3 rounded-xl border border-line/70 bg-ink/60 px-3.5 py-3">
    <div className="min-w-0">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">{item.type}</p>
      <p className="mt-1 text-sm font-medium text-paper">{item.name}</p>
      {item.detail && <p className="mt-0.5 text-xs leading-relaxed text-fog">{item.detail}</p>}
    </div>
    {item.via_edge && (
      <span className="shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-fog">
        {item.via_edge}
      </span>
    )}
  </div>
);

export const AgentPage: React.FC = () => {
  const { me } = useAuth();
  const [question, setQuestion] = React.useState('');
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [busy, setBusy] = React.useState(false);
  const controller = React.useRef<AbortController | null>(null);
  const nextId = React.useRef(1);
  const bottom = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setQuestion('');

    const userMessage: Message = { id: nextId.current++, role: 'user', result: { answer: trimmed, trail: [], stale: [], latencyMs: 0 } };
    const assistantId = nextId.current++;
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: 'assistant', streaming: true },
    ]);

    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;

    try {
      await askQuestion(
        trimmed,
        (partial) => {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId ? { ...message, result: partial, streaming: true } : message,
            ),
          );
        },
        abort.signal,
      );
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId ? { ...message, streaming: false } : message,
        ),
      );
    } catch (cause) {
      const text =
        cause instanceof ApiError
          ? cause.status === 401
            ? 'Sign in to ask the graph.'
            : cause.status === 429
              ? 'You have hit your plan limit. Upgrade to keep asking.'
              : cause.message
          : 'Could not reach the graph service.';
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId ? { ...message, error: text, streaming: false } : message,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Nav />
      <main className="mx-auto flex min-h-svh w-full max-w-4xl flex-col px-5 pb-16 pt-28 md:px-8 md:pt-36">
        <Eyebrow>Ask the graph</Eyebrow>
        <h1 className="mt-4 text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.02em] md:text-5xl">
          Who owns it? What breaks?
        </h1>
        <p className="mt-3 text-fog">
          Every answer carries the trail it came from. Ask about ownership, dependents or
          decisions.
        </p>

        <Card className="mt-8 p-3 md:p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void ask(question);
            }}
            className="flex items-center gap-2"
          >
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask in plain language…"
              aria-label="Ask the graph"
              className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-[15px] text-paper placeholder:text-fog/70 focus:outline-none"
            />
            <Button type="submit" disabled={busy || !question.trim()}>
              {busy ? 'Asking…' : 'Ask'}
            </Button>
          </form>
        </Card>

        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => void ask(example)}
              disabled={busy}
              className="rounded-full border border-line px-3.5 py-1.5 text-sm text-fog transition-colors hover:border-fog hover:text-paper disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>

        <div className="mt-8 space-y-6">
          {messages.length === 0 && (
            <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-fog">
              Try one of the examples above, or ask about any service you own.
            </p>
          )}

          {messages.map((message) =>
            message.role === 'user' ? (
              <div key={message.id} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl bg-paper px-4 py-2.5 text-[15px] text-ink">
                  {message.result?.answer}
                </p>
              </div>
            ) : (
              <div key={message.id} className="space-y-3">
                {message.error ? (
                  <div className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3">
                    <p className="text-sm text-paper">{message.error}</p>
                    {message.error.includes('Sign in') && (
                      <Link to="/auth" className="mt-1 inline-block text-sm text-accent underline underline-offset-4">
                        Sign in or create a free account
                      </Link>
                    )}
                  </div>
                ) : (
                  <Card className="p-5">
                    {message.result?.answer ? (
                      <>
                        <p className="text-[17px] leading-relaxed text-paper">
                          {message.result.answer}
                        </p>
                        {isMockAnswer(message.result.answer) && (
                          <p className="mt-3 rounded-lg border border-line bg-ink px-3 py-2.5 text-xs leading-relaxed text-fog">
                            The live graph backend is offline, so this answer came from the demo
                            fixture. Connect FalkorDB to see real answers.
                          </p>
                        )}
                        {message.result.trail.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <p className="font-mono text-xs uppercase tracking-[0.16em] text-fog">
                              Trail
                            </p>
                            {message.result.trail.map((item, index) => (
                              <TrailRow key={`${item.name}-${index}`} item={item} />
                            ))}
                          </div>
                        )}
                        {message.result.stale.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="font-mono text-xs uppercase tracking-[0.16em] text-fog">
                              Stale — not the current answer
                            </p>
                            {message.result.stale.map((item, index) => (
                              <TrailRow key={`stale-${item.name}-${index}`} item={item} />
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-[15px] text-fog">
                        {message.streaming ? 'Reading the graph…' : 'No answer.'}
                      </p>
                    )}
                    {message.result && !message.streaming && message.result.latencyMs > 0 && (
                      <p className="mt-3 font-mono text-[11px] text-fog">
                        {message.result.latencyMs} ms
                      </p>
                    )}
                  </Card>
                )}
              </div>
            ),
          )}
        </div>

        <div ref={bottom} />

        <p className={cn('mt-6 text-center font-mono text-xs text-fog')}>
          {me?.authenticated
            ? `Signed in as ${me.user?.email}`
            : 'Anonymous visitors get a daily allowance. Sign in for your plan limit.'}
        </p>
      </main>
      <Footer />
    </>
  );
};

export default AgentPage;
