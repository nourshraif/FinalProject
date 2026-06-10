# Pre-built frontend image.
# Run `npm run build` locally first, then `docker compose build frontend`.
# node:20-alpine is used — it was already pulled in the previous build attempt.

FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy the standalone Next.js output (produced by `npm run build` with output:"standalone")
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public

EXPOSE 3000

CMD ["node", "server.js"]
