# Change from node:18-alpine to node:22-alpine
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Set environment variable for Vite
ENV VITE_API_BASE_URL=http://localhost:8000

# Ensure the host is set so Docker can route traffic
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]