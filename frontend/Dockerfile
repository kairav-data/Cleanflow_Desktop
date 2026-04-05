FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# ── Build-time Vite env vars ──────────────────────────────────────────────
# VITE_ variables are baked into the JS bundle at build time.
# Pass them as Docker build args:  --build-arg VITE_API_BASE_URL=...
# Or set them in docker-compose build.args (see docker-compose.yml).
#
# Inside Docker Compose the frontend container reaches the backend
# via the service name "backend", NOT localhost.
ARG VITE_API_BASE_URL=http://backend:8000
ARG VITE_HF_API_KEY=""

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_HF_API_KEY=$VITE_HF_API_KEY

# Ensure the host is set so Docker can route traffic
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]