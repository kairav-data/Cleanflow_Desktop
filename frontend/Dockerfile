# Change from node:18-alpine to node:22-alpine
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Ensure the host is set so Docker can route traffic
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]