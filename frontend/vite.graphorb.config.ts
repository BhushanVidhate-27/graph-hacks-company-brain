import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

/**
 * Standalone build for GraphOrb.
 *
 * The marketing pages are prerendered HTML with no application bundle, and that
 * is worth keeping: a reader on /learn should not download the agent console.
 * GraphOrb still has to be there for every visitor, so it gets its own tiny
 * dependency-free entry that the prerender step adds to each page.
 *
 * Output: dist/graphorb.js (a single ES module, no shared React chunks).
 */
export default defineConfig({
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/graphorb/entry.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'graphorb.js',
    },
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false,
  },
});
