"""
app/serve.py — production entrypoint. Bhushan owns this file; app/main.py is Soham's
and is imported unmodified.

Two jobs, one process:

1. Serve the API from app.main (POST /ask, GET /health) unchanged.
2. Serve the frontend from site/ on the SAME origin.

Why same-origin matters, twice:
  - It removes CORS entirely. The API's allow_origins only lists
    http://localhost:5173, so opening the page via 127.0.0.1 fails with a bare
    "Failed to fetch" and no hint it is an origin mismatch. Same-origin makes that
    class of bug impossible in production.
  - No reverse proxy sits between the browser and the stream, so nothing buffers
    the SSE response. A proxy that buffers turns a working local stream into a
    dead production one.

`site/` is the Vite build of angy-fronted, produced by the `site` stage of the
Dockerfile. It is plain HTML/CSS/JS with no Node runtime behind it, so this
process is still the only thing that has to stay alive.

The StaticFiles mount is registered LAST so it cannot shadow the API routes:
Starlette matches routes in registration order, and /ask and /health are already
registered by app.main.
"""

import os
import stat
from pathlib import Path

import anyio.to_thread
from app.main import app
from fastapi import Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.gzip import GZipMiddleware

# Overridable so a local `npm run build` in angy-fronted can be served without
# rebuilding the image.
SITE_DIR = Path(os.getenv("HELIO_SITE_DIR", "site"))


class SiteFiles(StaticFiles):
    """
    StaticFiles that understands a Next.js static export's layout.

    `next build` with output: "export" writes each route as BOTH `<route>.html`
    and a `<route>/` directory of client-navigation segment files. For /demo that
    means `demo.html` next to `demo/__next.demo.__PAGE__.txt`.

    Plain StaticFiles(html=True) cannot serve that. Asked for /demo it stats the
    path, finds the `demo` DIRECTORY, looks for `demo/index.html`, does not find
    it, and 404s — even though demo.html is sitting right there. The symptom is a
    styled landing page whose own nav link to /demo is a dead end.

    get_response is overridden rather than the route table because the set of
    exported routes is decided at build time. Listing them here would mean every
    new page needs a matching line in the backend, and a forgotten line fails
    silently as a 404 rather than as a build error.

    Two rules, in order:
      1. If the path does not resolve to a file, try `<path>.html`. This is what
         rescues /demo.
      2. Otherwise defer to StaticFiles, which already serves 404.html with a 404
         status when html=True.

    Only the fallback is added. Everything that already worked — /, /favicon.ico,
    /_next/*, /images/*, /demo/*.txt — is served by the original lookup, so this
    cannot change the behaviour of an existing URL.
    """

    async def get_response(self, path: str, scope):
        _, stat_result = await anyio.to_thread.run_sync(self.lookup_path, path)

        # Rule 1: not a regular file on disk. Try the sibling `<path>.html`.
        # This is how /pricing is served from pricing.html without a redirect.
        if not (stat_result and stat.S_ISREG(stat_result.st_mode)):
            html_full, html_stat = await anyio.to_thread.run_sync(
                self.lookup_path, f"{path}.html"
            )
            if html_stat and stat.S_ISREG(html_stat.st_mode):
                return self.file_response(html_full, html_stat, scope)

        # Rule 2: hand back to StaticFiles. With html=True it serves 404.html
        # with a real 404 status. There is deliberately no SPA fallback to
        # index.html: that turned every typo into a 200 and let crawlers index
        # an infinite set of empty URLs.
        return await super().get_response(path, scope)


# Compression at the app boundary. Render's edge also compresses, but local
# runs and any future host get the same behaviour without a proxy setting.
app.add_middleware(GZipMiddleware, minimum_size=500)

ASSET_PREFIXES = ("/assets/", "/fonts/", "/icons/", "/og/", "/images/")

CSP = (
    "default-src 'self'; "
    "base-uri 'self'; "
    "object-src 'none'; "
    "frame-ancestors 'none'; "
    "form-action 'self' mailto:; "
    "img-src 'self' data:; "
    "font-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "script-src 'self'; "
    "connect-src 'self'"
)


@app.middleware("http")
async def canonical_urls_and_headers(request: Request, call_next):
    """
    One canonical URL per page, a real 404, and the headers a public site needs.

    Redirects are 301 so a crawler consolidates the old form instead of indexing
    both. `index.html` and `pricing.html` are aliases of `/` and `/pricing`; the
    clean form is the only one that returns 200.
    """
    path = request.url.path
    query = f"?{request.url.query}" if request.url.query else ""

    if path == "/index.html":
        return RedirectResponse(url=f"/{query}", status_code=301)
    if path.endswith(".html"):
        # /pricing.html -> /pricing. The one exception is /404.html, which
        # lands on /404 and keeps the 404 status instead of becoming a 200.
        return RedirectResponse(url=f"{path[:-5] or '/'}{query}", status_code=301)
    if path != "/" and path.endswith("/") and not path.startswith(("/api/", "/mock/")):
        # Relative redirects avoid leaking an internal Render host or http://
        # scheme through the proxy. The query string is preserved.
        return RedirectResponse(url=f"{path.rstrip('/')}{query}", status_code=301)

    response = await call_next(request)

    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    response.headers.setdefault("Content-Security-Policy", CSP)

    if request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https":
        response.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
        )

    content_type = response.headers.get("content-type", "")
    if path.startswith(ASSET_PREFIXES) and "text/html" not in content_type:
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif "text/html" in content_type:
        response.headers["Cache-Control"] = "no-cache"
    elif path in ("/sitemap.xml", "/robots.txt", "/site.webmanifest"):
        response.headers["Cache-Control"] = "public, max-age=3600"

    return response


# mock/ is mounted SEPARATELY and at the root. The frontend loads its fixture at
# "../mock/trail.json", which resolves to /mock/trail.json — not under /site/.
# Mounting only site/ made that a silent 404 with a blank trail, which reads as a
# broken renderer rather than a missing mount. It is mounted before "/" because
# StaticFiles matches in registration order and the catch-all would swallow it.
app.mount("/mock", StaticFiles(directory="mock"), name="mock")

app.mount("/", SiteFiles(directory=SITE_DIR, html=True), name="site")