export const records = {
  "D-19": {
    title: "Dual payment providers",
    date: "2026-05-06",
    dateLabel: "6 May 2026",
    owner: "Elena Vasquez",
    status: "Current",
    replaces: "D-14",
    summary: "Adyen is the primary provider. Stripe is the fallback.",
    evidence: ["payments-provider-eval-v4.md", "#inc-payments:2026-05-06"],
  },
  "D-14": {
    title: "A single payment provider",
    date: "2026-03-18",
    dateLabel: "18 March 2026",
    owner: "Elena Vasquez",
    status: "Superseded",
    replaces: null,
    summary: "The original decision moved payments to a single provider, Stripe.",
    evidence: ["payments-provider-eval-v3.md", "#inc-payments:2026-03-18"],
  },
  "D-21": {
    title: "Payments ownership handoff",
    date: "2026-04-15",
    dateLabel: "15 April 2026",
    owner: "Elena Vasquez",
    status: "Current",
    replaces: null,
    summary: "Ravi Menon took over ownership of payments-gateway from Priya Sharma.",
    evidence: ["payments-ownership-handoff.md"],
  },
} as const;

export type RecordId = keyof typeof records;
export const recordIds = Object.keys(records) as RecordId[];

export function recordSearch(search: Record<string, unknown>): { record?: RecordId } {
  const value = search["record"];
  return typeof value === "string" && Object.hasOwn(records, value)
    ? { record: value as RecordId }
    : {};
}

export const examples = {
  decisions: {
    question: "Why do we use two payment providers?",
    answer: records["D-19"].summary,
    record: "D-19",
  },
  ownership: {
    question: "Who should I ask about payments?",
    answer: "Ask Ravi Menon on the Platform team. He owns payments-gateway.",
    record: "D-21",
  },
} as const;
