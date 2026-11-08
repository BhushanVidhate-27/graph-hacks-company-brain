/**
 * Single source of truth for the public site identity.
 *
 * The canonical host is the Render URL until a custom domain is attached. When
 * that happens, change SITE_URL here and in public/robots.txt (the sitemap is
 * generated from this module).
 */
export const SITE_URL = 'https://helio-brain.onrender.com';
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
