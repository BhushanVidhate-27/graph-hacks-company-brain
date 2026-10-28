/**
 * Build-time prerender for the Helio marketing site.
 *
 * The client bundle is still a normal Vite SPA, but every marketing route is
 * rendered to static HTML here so a plain HTTP fetch (or a crawler that does
 * not execute JavaScript) sees the real headings, copy, links and prices.
 *
 * Run after both builds:
 *   vite build
 *   vite build --ssr src/entry-server.tsx --outDir dist-ssr
 *   node scripts/prerender.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const dist = path.join(root, 'dist');
const ssrEntry = path.join(root, 'dist-ssr', 'entry-server.js');

const { renderMarketingPage, renderHead, MARKETING_ROUTES, APP_ROUTES } = await import(
  pathToFileURL(ssrEntry).href
);

const template = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
const HEAD_PATTERN = /<!--seo-head-start-->[\s\S]*?<!--seo-head-end-->/;
const ROOT_PATTERN = '<div id="root"></div>';

if (!HEAD_PATTERN.test(template)) {
  throw new Error('index.html is missing the seo-head markers');
}
if (!template.includes(ROOT_PATTERN)) {
  throw new Error('index.html is missing <div id="root"></div>');
}

const escapeHtml = (value) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const writePage = async (filePath, head, body) => {
  const html = template
    .replace(HEAD_PATTERN, head)
    .replace(ROOT_PATTERN, `<div id="root">${body}</div>`);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, html, 'utf8');
};

const pages = [];
for (const route of MARKETING_ROUTES) {
  const body = renderMarketingPage(route.path);
  const head = renderHead(route.path);
  const filePath =
    route.path === '/'
      ? path.join(dist, 'index.html')
      : path.join(dist, `${route.path.replace(/^\//, '')}.html`);
  await writePage(filePath, head, body);
  pages.push({ path: route.path, body });
}

for (const appRoute of APP_ROUTES) {
  const loading = `<div style="min-height:70vh;display:flex;align-items:center;justify-content:center;font-family:'Space Mono',monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5c5c56;">${escapeHtml(
    appRoute.shellHeading,
  )}</div>`;
  const filePath = path.join(dist, `${appRoute.path.replace(/^\//, '')}.html`);
  await writePage(filePath, renderHead(appRoute.path), loading);
}

const notFoundBody = renderMarketingPage('/__not_found__');
await writePage(path.join(dist, '404.html'), renderHead('/__not_found__'), notFoundBody);

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${MARKETING_ROUTES.map(
  (route) => `  <url>
    <loc>${route.path === '/' ? 'https://helio-brain.onrender.com/' : `https://helio-brain.onrender.com${route.path}`}</loc>
    <lastmod>${route.lastmod}</lastmod>
    <changefreq>${route.changeFrequency ?? 'monthly'}</changefreq>
    <priority>${route.priority ?? 0.5}</priority>
  </url>`,
).join('\n')}
</urlset>
`;
await fs.writeFile(path.join(dist, 'sitemap.xml'), sitemap, 'utf8');

// A tiny machine-readable index for debugging the build without crawling.
const manifest = {
  generatedAt: new Date().toISOString(),
  marketingRoutes: MARKETING_ROUTES.map((route) => ({
    path: route.path,
    title: route.title,
    descriptionLength: route.description.length,
    titleLength: route.title.length,
  })),
  appRoutes: APP_ROUTES.map((route) => route.path),
};
await fs.writeFile(path.join(dist, 'seo-manifest.json'), JSON.stringify(manifest, null, 2));

console.log(
  `prerendered ${MARKETING_ROUTES.length} marketing routes, ${APP_ROUTES.length} app shells, sitemap.xml and 404.html`,
);
for (const route of MARKETING_ROUTES) {
  if (route.title.length < 50 || route.title.length > 60) {
    console.warn(`  title length ${route.title.length}: ${route.path} — ${route.title}`);
  }
  if (route.description.length < 140 || route.description.length > 160) {
    console.warn(
      `  description length ${route.description.length}: ${route.path} — ${route.description}`,
    );
  }
}
