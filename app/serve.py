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

`site/` is the TanStack Start build of `final front saas`, produced by the `site`
stage of the Dockerfile. The app is built in SPA mode: the build emits
`_shell.html` plus hashed client assets, and every route renders in the browser.
There is no Node runtime behind it, so this process is still the only thing that
has to stay alive.

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

# Overridable so a local `bun run build` in `final front saas` can be served
# without rebuilding the image.
SITE_DIR = Path(os.getenv("HELIO_SITE_DIR", "site"))


class SiteFiles(StaticFiles):
    """
    StaticFiles with a single-page-app fallback.

    A real file always wins, so /assets/*, /favicon.png and /helio-logo.png keep
    their immutable caching and correct content types. Anything else that looks
    like a client route (no file extension in the last segment) gets
    `_shell.html`; TanStack Router then matches the path in the browser.

    Requests that look like files (`/assets/missing.js`, `/favicon.ico`) still
    404 instead of returning HTML, so a missing asset never masks itself as a
    working page.
    """

    async def get_response(self, path: str, scope):
        _, stat_result = await anyio.to_thread.run_sync(self.lookup_path, path)

        if stat_result and stat.S_ISREG(stat_result.st_mode):
            return await super().get_response(path, scope)

        last_segment = path.rsplit("/", 1)[-1]
        is_client_route = last_segment in ("", ".") or "." not in last_segment
        if is_client_route:
            shell_full, shell_stat = await anyio.to_thread.run_sync(
                self.lookup_path, "_shell.html"
            )
            if shell_stat and stat.S_ISREG(shell_stat.st_mode):
                return self.file_response(shell_full, shell_stat, scope)

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
    "font-src 'self' https://fonts.gstatic.com; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    # TanStack Start's SPA shell embeds its hydration bootstrap inline. There is
    # no user-controlled data in that script, and every other source stays
    # restricted to this origin.
    "script-src 'self' 'unsafe-inline'; "
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
    elif path == "/graphorb.js":
        # Not content-hashed, so it must be revalidated. That keeps a returning
        # visitor's orb in step with the rest of a new build.
        response.headers["Cache-Control"] = "no-cache"

    return response


# mock/ is mounted SEPARATELY and at the root. The frontend loads its fixture at
# "../mock/trail.json", which resolves to /mock/trail.json — not under /site/.
# Mounting only site/ made that a silent 404 with a blank trail, which reads as a
# broken renderer rather than a missing mount. It is mounted before "/" because
# StaticFiles matches in registration order and the catch-all would swallow it.
app.mount("/mock", StaticFiles(directory="mock"), name="mock")

app.mount("/", SiteFiles(directory=SITE_DIR, html=True), name="site")