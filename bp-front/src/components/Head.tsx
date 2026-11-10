import React from 'react';

export const SITE_URL = 'https://helio.runs-on.dev';

interface HeadProps {
  title: string;
  description: string;
  /** Path on the site, used for the canonical URL. */
  path: string;
  noindex?: boolean;
  /** Optional JSON-LD graph injected as a script tag. */
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
}

function upsertMeta(attribute: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
}

/**
 * Per-route document head. The site is a SPA, so every route has to write its
 * own title, description, canonical and social cards — otherwise every page
 * shares the home page's metadata.
 */
export const Head: React.FC<HeadProps> = ({ title, description, path, noindex, jsonLd }) => {
  React.useEffect(() => {
    const url = `${SITE_URL}${path}`;
    document.title = title;

    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', 'Helio');
    upsertMeta('property', 'og:image', `${SITE_URL}/og/helio-home.png`);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', `${SITE_URL}/og/helio-home.png`);
    upsertLink('canonical', url);

    const script = document.getElementById('helio-jsonld') as HTMLScriptElement | null;
    if (jsonLd) {
      const payload = JSON.stringify(jsonLd);
      if (script) {
        script.textContent = payload;
      } else {
        const created = document.createElement('script');
        created.type = 'application/ld+json';
        created.id = 'helio-jsonld';
        created.textContent = payload;
        document.head.appendChild(created);
      }
    } else if (script) {
      script.remove();
    }
  }, [title, description, path, noindex, jsonLd]);

  return null;
};
