# Helio company brain — production image.
#
# The frontend is frontend (Vite + React). It is built here and copied into
# the Python runtime so the site and the API share ONE origin: no CORS, and no
# proxy between the browser and the SSE stream.

# --------------------------------------------------------------------------- #
# Stage 1: build the Helio frontend (TanStack Start in `final front saas`).
# --------------------------------------------------------------------------- #
FROM oven/bun:1.4-slim AS site

WORKDIR /site

# Lockfile first so source edits do not re-run the install layer.
COPY ["final front saas/package.json", "final front saas/bun.lock", "./"]
RUN bun install --frozen-lockfile

COPY ["final front saas/", "./"]
# SPA mode emits `_shell.html` and hashed client assets. FastAPI serves them on
# the same origin as the API, so the browser never crosses an origin boundary.
RUN bun run build

# --------------------------------------------------------------------------- #
# Stage 2: the runtime image.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /srv

# deps first so code edits do not invalidate the pip layer
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app/ ./app/
COPY mock/ ./mock/
COPY data/ ./data/
# scripts/ is needed at runtime: the compose `seed` service runs generate.py and
# load.py inside this image to populate the graph. Omitting it made seed exit 2
# with "can't open file '/srv/scripts/generate.py'".
COPY scripts/ ./scripts/

# The exported site (TanStack Start SPA build), mounted at / by app.serve.
COPY --from=site /site/.output/public ./site/

EXPOSE 8080

# app.serve mounts the frontend on the SAME origin as the API. Two consequences:
#   - CORS disappears. The API's allow_origins lists only localhost:5173, so a
#     cross-origin production page fails with a bare "Failed to fetch".
#   - Nothing sits in front of the SSE stream to buffer it. A buffering proxy
#     turns a stream that works locally into one that silently dies in production.
# --------------------------------------------------------------------------- #
# Keep-alive pinger: Render free tier sleeps after 15 min idle. Run a
# background process that pings /health every 5 min to keep the service awake.
# --------------------------------------------------------------------------- #
# Replace the CMD below.
CMD ["sh", "-c", "mkdir -p /tmp\nnohup bash /srv/scripts/ping-render.sh >/dev/null 2>&1 &\nexec uvicorn app.serve:app --host 0.0.0.0 --port 8080 --timeout-keep-alive 120 --no-access-log"]
# --timeout-keep-alive is long because a streamed answer holds the connection open.
