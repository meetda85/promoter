# Imagen lista para desplegar en cualquier sitio que corra contenedores
# (Render, Railway, Fly.io, un NAS, un VPS…).
FROM node:22-alpine

WORKDIR /app

# Primero sólo los manifiestos: así la capa de dependencias se reaprovecha
# entre despliegues mientras no cambien.
COPY package.json package-lock.json ./
COPY web/package.json web/package.json
COPY server/package.json server/package.json
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server/src/index.js"]
