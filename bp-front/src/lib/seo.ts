import { SITE_URL } from '../components/Head';

export const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: 'Helio',
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/icons/icon-512.png`,
  email: 'support@helio.runs-on.dev',
  description:
    'Helio connects repositories, on-call rotations and decision records into one knowledge graph, so every answer about ownership, blast radius and history shows the path behind it.',
};

export const softwareJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Helio',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: `${SITE_URL}/`,
  description:
    'A knowledge graph for engineering organisations: ownership, blast radius and decisions with provenance on every answer.',
  offers: [
    { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'INR', url: `${SITE_URL}/pricing` },
    {
      '@type': 'Offer',
      name: 'Starter',
      price: '1299',
      priceCurrency: 'INR',
      url: `${SITE_URL}/pricing`,
    },
    {
      '@type': 'Offer',
      name: 'Professional',
      price: '4299',
      priceCurrency: 'INR',
      url: `${SITE_URL}/pricing`,
    },
  ],
};
