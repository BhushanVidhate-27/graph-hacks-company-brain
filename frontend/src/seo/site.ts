/**
 * Single source of truth for the public site identity.
 *
 * Custom domain helio.runs-on.dev is attached on Render; the onrender.com
 * URL remains a fallback. The sitemap is generated from this module.
 */
export const SITE_URL = 'https://helio.runs-on.dev';
export const SITE_NAME = 'Helio';
export const SITE_TAGLINE = 'The company brain for engineering teams';
export const CONTACT_EMAIL = 'contact.helio.brain@gmail.com';
export const GITHUB_URL = 'https://github.com/BhushanVidhate-27/graph-hacks-company-brain';
export const LOGO_URL = `${SITE_URL}/icons/icon-512.png`;
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og/helio-home.png`;

export type ChangeFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RouteSeo {
  path: string;
  title: string;
  description: string;
  /** Short label used on social cards. */
  eyebrow: string;
  ogImage: string;
  robots?: string;
  priority?: number;
  changeFrequency?: ChangeFrequency;
  lastmod: string;
}

export const absoluteUrl = (path: string) =>
  path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`;
