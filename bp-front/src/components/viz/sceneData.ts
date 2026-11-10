/**
 * The graph the scene draws. Plain data, no Three.js import, so the marketing
 * bundle does not pull the 3D engine in until the scene is actually on screen.
 */

export interface SceneNode {
  id: string;
  label: string;
  kind: 'service' | 'person' | 'decision';
  position: [number, number, number];
  radius: number;
}

export interface SceneEdge {
  from: string;
  to: string;
  kind: string;
}

export const SCENE_NODES: SceneNode[] = [
  { id: 'payments', label: 'payments-gateway', kind: 'service', position: [-1.5, 0.5, 0], radius: 0.13 },
  { id: 'ledger', label: 'ledger-service', kind: 'service', position: [0.2, 1.0, -0.35], radius: 0.09 },
  { id: 'settlement', label: 'settlement-batch', kind: 'service', position: [0.5, 0.1, 0.45], radius: 0.08 },
  { id: 'fraud', label: 'fraud-scoring', kind: 'service', position: [1.7, 0.8, -0.25], radius: 0.08 },
  { id: 'admin', label: 'admin-bff', kind: 'service', position: [2.1, -0.3, 0.5], radius: 0.07 },
  { id: 'webhook', label: 'webhook-router', kind: 'service', position: [-0.7, -0.5, 0.6], radius: 0.07 },
  { id: 'notify', label: 'notification-service', kind: 'service', position: [1.1, -1.0, -0.45], radius: 0.07 },
  { id: 'search', label: 'search-indexer', kind: 'service', position: [-1.9, -0.8, -0.5], radius: 0.07 },
  { id: 'ravi', label: 'Ravi Menon', kind: 'person', position: [-2.5, 1.2, 0.3], radius: 0.12 },
  { id: 'priya', label: 'Priya Sharma', kind: 'person', position: [-2.7, 0.1, -0.5], radius: 0.09 },
  { id: 'd21', label: 'D-21', kind: 'decision', position: [-0.7, 1.6, 0.25], radius: 0.09 },
  { id: 'd19', label: 'D-19', kind: 'decision', position: [1.0, 1.7, -0.6], radius: 0.08 },
];

export const SCENE_EDGES: SceneEdge[] = [
  { from: 'ravi', to: 'payments', kind: 'OWNED_BY' },
  { from: 'priya', to: 'payments', kind: 'CONTRIBUTED_TO' },
  { from: 'payments', to: 'ledger', kind: 'DEPENDS_ON' },
  { from: 'payments', to: 'settlement', kind: 'DEPENDS_ON' },
  { from: 'payments', to: 'webhook', kind: 'DEPENDS_ON' },
  { from: 'ledger', to: 'fraud', kind: 'DEPENDS_ON' },
  { from: 'ledger', to: 'notify', kind: 'DEPENDS_ON' },
  { from: 'settlement', to: 'admin', kind: 'DEPENDS_ON' },
  { from: 'fraud', to: 'search', kind: 'DEPENDS_ON' },
  { from: 'd21', to: 'payments', kind: 'DECIDED' },
  { from: 'd19', to: 'd21', kind: 'SUPERSEDES' },
];

export const SCENE_STEPS: Array<{
  ids: string[];
  question: string;
  answer: string;
}> = [
  {
    ids: ['ravi', 'payments', 'd21'],
    question: 'Who owns payments-gateway?',
    answer: 'Ravi Menon, Platform rotation. Ownership moved on 15 Apr 2026, decided in D-21.',
  },
  {
    ids: ['payments', 'ledger', 'settlement', 'webhook', 'fraud', 'notify', 'admin'],
    question: 'What breaks if it goes down?',
    answer: 'Eight services break across three hops: ledger, settlement and webhook first.',
  },
  {
    ids: ['d19', 'd21', 'payments', 'priya'],
    question: 'Where was that decided?',
    answer: 'D-19 on 6 May 2026 supersedes D-14. The evaluation doc still says Stripe-only.',
  },
];
