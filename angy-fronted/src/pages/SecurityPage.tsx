import React from 'react';
import {
  CtaBand,
  CtaLink,
  FaqBlock,
  MarketingShell,
  PageHero,
  Prose,
  Section,
} from './MarketingChrome';
import { CONTACT_EMAIL } from '../seo/site';

const FAQS = [
  {
    question: 'Does Helio train models on our data?',
    answer:
      'No. Helio does not train models on customer data. The graph stores the relationships; the language model interprets the question and phrases the answer. If you need the data to stay in your network, the Docker deployment can run there.',
  },
  {
    question: 'What access does the GitHub connection need?',
    answer:
      'The repository integration is read-only: issues, pull requests and commit metadata. Helio does not write to your repository. The connection is scoped to the owner and repository named in the deployment settings.',
  },
  {
    question: 'Where is the graph stored?',
    answer:
      'On the managed deployment, the graph runs alongside the API in the hosting environment. On a self-hosted deployment, it runs wherever you put the container and its volume. The public demo uses a synthetic graph and contains no customer records.',
  },
  {
    question: 'Are you SOC 2 or ISO 27001 certified?',
    answer:
      'Not yet. Helio has not completed a SOC 2 or ISO 27001 audit. We will answer a security questionnaire, describe the deployment model, and support a self-hosted evaluation rather than claim a certification we do not hold.',
  },
  {
    question: 'How do I report a security issue?',
    answer: `Email ${CONTACT_EMAIL} with the subject "Security". Include the affected URL or component and reproduction steps. Please do not open a public issue for a vulnerability.`,
  },
];

export const SecurityPage: React.FC = () => (
  <MarketingShell>
    <PageHero
      eyebrow="Security"
      title="Read-only access. Answers bounded by the graph."
      lede="Helio is built around a narrow idea: read the records you already keep, answer from the graph, and show the evidence. This page describes what the product does today, including the parts that are not finished."
    >
      <CtaLink href={`mailto:${CONTACT_EMAIL}?subject=Helio%20security%20question`}>
        Ask a security question
      </CtaLink>
      <CtaLink href="/how-it-works" variant="outline">How it works</CtaLink>
    </PageHero>

    <Section eyebrow="Access" title="What Helio reads">
      <Prose>
        <p>
          The GitHub integration reads issues, pull requests and commit metadata for one owner and
          repository. It does not write to the repository, merge pull requests, or change issues.
          The token is supplied by the deployment, not by a visitor.
        </p>
        <p>
          The graph itself holds service names, team names, people, dependency edges, on-call
          rotations and decision records. The public demo uses a synthetic company of 185 nodes and
          is labelled as sample data in the product.
        </p>
      </Prose>
    </Section>

    <Section eyebrow="Model boundary" title="The model does not get the final word">
      <Prose>
        <p>
          A language model interprets the question and writes the response. The facts come from a
          graph query. If a traversal returns no OWNED_BY edge for config-service, the agent reports
          that the graph has no owner rather than choosing a plausible team.
        </p>
        <p>
          This is also why every answer carries a trail. The trail is not a decorative citation; it
          is the set of edges the answer used, with the dates attached to them.
        </p>
      </Prose>
    </Section>

    <Section eyebrow="Deployment" title="Managed or inside your network">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl">
        <div className="cad-border bg-[#f4f4ec] p-6">
          <h3 className="font-mono text-sm font-bold uppercase text-[#282828]">Managed</h3>
          <p className="mt-3 font-mono text-xs text-[#5c5c56] leading-relaxed">
            The marketing site and API share one HTTPS origin. Sessions use an HTTP-only cookie.
            The graph runs in the same hosting environment as the API. The public demo is reachable
            without an account.
          </p>
        </div>
        <div className="cad-border bg-[#f4f4ec] p-6">
          <h3 className="font-mono text-sm font-bold uppercase text-[#282828]">Self-hosted</h3>
          <p className="mt-3 font-mono text-xs text-[#5c5c56] leading-relaxed">
            The repository includes a Docker setup for the graph, API and frontend. Running it
            inside your network keeps the graph and its storage under your controls. Enterprise
            onboarding covers the deployment review.
          </p>
        </div>
      </div>
    </Section>

    <Section eyebrow="Status" title="What is not claimed">
      <Prose>
        <ul className="list-disc pl-5 space-y-2">
          <li>No SOC 2 or ISO 27001 certification is claimed.</li>
          <li>No compliance certification is implied by the word &ldquo;secure&rdquo;. Ask for the deployment details.</li>
          <li>No customer data is used to train a model.</li>
          <li>Storage encryption depends on the environment you choose; self-hosting leaves that decision with you.</li>
        </ul>
        <p>
          For a questionnaire, a data-flow diagram or a self-hosted evaluation, email{' '}
          <a href={`mailto:${CONTACT_EMAIL}?subject=Helio%20security`} className="text-[#e15c46] underline">
            {CONTACT_EMAIL}
          </a>.
        </p>
      </Prose>
    </Section>

    <FaqBlock items={FAQS} title="Security questions" id="security-faq" />

    <CtaBand
      title="Need the details before a trial?"
      body="Send the questionnaire. We will answer it against the current deployment rather than a marketing checklist."
    />
  </MarketingShell>
);
