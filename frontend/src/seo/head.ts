import {
  SITE_URL,
  SITE_NAME,
  SITE_TAGLINE,
  CONTACT_EMAIL,
  GITHUB_URL,
  LOGO_URL,
} from './site';
import { ROUTES_BY_PATH, ogImageUrl } from './routes';
import { APP_ROUTE_BY_PATH } from './appRoutes';
import { FAQ_ITEMS } from '../content/faq';
import { ARTICLES } from '../content/articles';

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

const organization = {
  '@type': 'Organization',
  '@id': ORG_ID,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  logo: LOGO_URL,
  email: CONTACT_EMAIL,
  sameAs: [GITHUB_URL],
};

const website = {
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  description:
    'Helio connects services, teams, on-call rotations and decision records into one graph, with a verifiable path behind every answer.',
  publisher: { '@id': ORG_ID },
};

const softwareApplication = {
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Engineering knowledge graph',
  operatingSystem: 'Web',
  url: `${SITE_URL}/`,
  description:
    'An organizational knowledge graph for engineering teams: service ownership, blast radius and decision history with a verifiable path behind every answer.',
  publisher: { '@id': ORG_ID },
  offers: [
    {
      '@type': 'Offer',
      name: 'Free',
      price: '0',
      priceCurrency: 'USD',
      url: `${SITE_URL}/pricing`,
      availability: 'https://schema.org/InStock',
    },
    {
      '@type': 'Offer',
      name: 'Starter',
      price: '15',
      priceCurrency: 'USD',
      url: `${SITE_URL}/pricing`,
      availability: 'https://schema.org/InStock',
    },
    {
      '@type': 'Offer',
      name: 'Professional',
      price: '49',
      priceCurrency: 'USD',
      url: `${SITE_URL}/pricing`,
      availability: 'https://schema.org/InStock',
    },
    {
      '@type': 'Offer',
      name: 'Enterprise',
      priceCurrency: 'USD',
      description: 'Custom pricing with a dedicated graph instance.',
      url: `${SITE_URL}/pricing`,
      availability: 'https://schema.org/InStock',
    },
  ],
};

const faqPage = {
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
};

const breadcrumbFor = (path: string, name: string) => {
  const trail = [{ name: 'Home', path: '/' }];
  if (path.startsWith('/learn/')) trail.push({ name: 'Learn', path: '/learn' });
  if (path !== '/') trail.push({ name, path });
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path === '/' ? '/' : item.path}`,
    })),
  };
};

const structuredDataFor = (path: string): object[] => {
  const route = ROUTES_BY_PATH.get(path);
  const base: object[] = [organization, website];
  if (path === '/' || path === '/pricing') base.push(softwareApplication);
  if (path === '/faq') base.push(faqPage);

  if (route && path !== '/') {
    base.push(breadcrumbFor(path, route.title.split(':')[0]));
  }

  const article = ARTICLES.find((item) => item.path === path);
  if (article && route) {
    base.push({
      '@type': 'TechArticle',
      headline: article.h1,
      description: route.description,
      datePublished: '2026-10-28',
      dateModified: route.lastmod,
      author: { '@id': ORG_ID },
      publisher: { '@id': ORG_ID },
      mainEntityOfPage: `${SITE_URL}${path}`,
      about: article.eyebrow,
    });
    if (article.faqs.length) {
      base.push({
        '@type': 'FAQPage',
        mainEntity: article.faqs.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      });
    }
  }

  return base;
};

const escapeJson = (value: unknown) =>
  JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

const metaTag = (attribute: 'name' | 'property', key: string, content: string) =>
  `<meta ${attribute}="${key}" content="${content.replace(/"/g, '&quot;')}" />`;

const preloads = `
    <link rel="preload" href="/fonts/space-mono-400.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="/fonts/space-mono-700.woff2" as="font" type="font/woff2" crossorigin />`;

const icons = `
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />`;

const noScriptStyle = `
    <noscript><style>[data-reveal]{opacity:1!important;transform:none!important;filter:none!important}[data-reveal] *{opacity:1!important;transform:none!important;filter:none!important}.faq-answer{display:block!important}</style></noscript>`;

export const renderHead = (path: string): string => {
  const route = ROUTES_BY_PATH.get(path);
  if (!route) {
    const appRoute = APP_ROUTE_BY_PATH.get(path);
    if (!appRoute) {
      return `<meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Page not found | Helio</title>
    <meta name="robots" content="noindex, follow" />
    ${icons}${preloads}${noScriptStyle}`;
    }
    return `<meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${appRoute.title}</title>
    <meta name="description" content="${appRoute.description}" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="theme-color" content="#ecece4" />
    ${icons}${preloads}${noScriptStyle}`;
  }

  const canonical = path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`;
  const image = ogImageUrl(route.ogImage);
  const type = ARTICLES.some((item) => item.path === path) ? 'article' : 'website';
  const robots = route.robots ?? 'index, follow, max-image-preview:large, max-snippet:-1';

  return `<meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${route.title}</title>
    <meta name="description" content="${route.description}" />
    <link rel="canonical" href="${canonical}" />
    <meta name="robots" content="${robots}" />
    <meta name="theme-color" content="#ecece4" />
    ${icons}${preloads}
    <meta property="og:type" content="${type}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:title" content="${route.title}" />
    <meta property="og:description" content="${route.description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${route.eyebrow} — ${SITE_TAGLINE}" />
    <meta property="og:locale" content="en_US" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${route.title}" />
    <meta name="twitter:description" content="${route.description}" />
    <meta name="twitter:image" content="${image}" />
    <script type="application/ld+json">${escapeJson(structuredDataFor(path))}</script>${noScriptStyle}`;
};
