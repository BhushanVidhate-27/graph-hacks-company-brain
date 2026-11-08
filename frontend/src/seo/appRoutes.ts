export interface AppRouteSeo {
  path: string;
  title: string;
  description: string;
  shellHeading: string;
}

/**
 * Client-rendered application routes. They are prerendered only as a small
 * loading shell and are always noindex: there is nothing useful for a crawler
 * until a session exists.
 */
export const APP_ROUTES: AppRouteSeo[] = [
  {
    path: '/agent',
    title: 'Helio Agent: Ask the Company Graph',
    description: 'Ask ownership, blast-radius and decision questions against the Helio graph.',
    shellHeading: 'Opening the Helio agent…',
  },
  {
    path: '/console',
    title: 'Helio Graph Console',
    description: 'Explore services, ownership, on-call rotations and dependency paths.',
    shellHeading: 'Opening the graph console…',
  },
  {
    path: '/auth',
    title: 'Sign in to Helio',
    description: 'Sign in or create a Helio account.',
    shellHeading: 'Opening sign in…',
  },
  {
    path: '/account',
    title: 'Your Helio Account',
    description: 'Manage your Helio plan, usage and API keys.',
    shellHeading: 'Opening your account…',
  },
  {
    path: '/preview',
    title: 'Helio Device Preview',
    description: 'Preview the Helio marketing site at desktop, tablet and mobile widths.',
    shellHeading: 'Opening device preview…',
  },
];

export const APP_ROUTE_BY_PATH = new Map(APP_ROUTES.map((route) => [route.path, route]));
