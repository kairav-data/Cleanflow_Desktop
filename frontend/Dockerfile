FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# ── How VITE_ env vars work in Docker ─────────────────────────────────────
#
# In Vite DEV mode (npm run dev), VITE_ vars are read from the Node.js
# process environment at RUNTIME — they do NOT need to be baked at build time.
# Setting them via ARG → ENV here makes them available when Vite starts.
#
# VITE_API_BASE_URL must be resolvable by the BROWSER (running on the host
# machine), NOT by the container. The browser cannot reach Docker-internal
# hostnames like "backend". It reaches the backend via the host port mapping:
#   host:8000  →  backend container:8000
#
# So the correct value is: http://localhost:8000   (or whatever BACKEND_PORT is)
# This is injected by docker-compose build.args and overrides this default.
#
ARG VITE_API_BASE_URL=http://localhost:8000
ARG VITE_HF_API_KEY=""

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_HF_API_KEY=$VITE_HF_API_KEY

# Run Vite dev server bound to all interfaces so Docker can forward traffic
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]