import type { ViewMode } from '../types';

/** URL for each application view. Marketing pages live on their own paths. */
export const PATH_FOR_MODE: Record<ViewMode, string> = {
  website: '/',
  'chat-widget': '/agent',
  dashboard: '/console',
  viewport: '/preview',
  auth: '/auth',
  account: '/account',
};

export const MODE_FOR_PATH: Record<string, ViewMode> = {
  '/': 'website',
  '/agent': 'chat-widget',
  '/console': 'dashboard',
  '/preview': 'viewport',
  '/auth': 'auth',
  '/account': 'account',
};

export const TITLE_FOR_MODE: Record<ViewMode, string> = {
  website: 'Helio: Service Ownership & Blast Radius Knowledge Graph',
  'chat-widget': 'Helio Agent: Ask the Company Graph',
  dashboard: 'Helio Graph Console',
  viewport: 'Helio Device Preview',
  auth: 'Sign in to Helio',
  account: 'Your Helio Account',
};

export const isAppPath = (path: string) => path in MODE_FOR_PATH;
