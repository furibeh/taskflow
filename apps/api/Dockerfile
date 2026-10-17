FROM node:24-alpine
WORKDIR /app
# Todo el árbol pertenece al usuario sin privilegios que ejecuta el contenedor.
RUN chown node:node /app
USER node
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node packages/domain/package.json packages/domain/
COPY --chown=node:node packages/contracts/package.json packages/contracts/
COPY --chown=node:node apps/api/package.json apps/api/
RUN npm ci --workspace apps/api --include-workspace-root=false
COPY --chown=node:node tsconfig.base.json ./
COPY --chown=node:node packages/domain packages/domain
COPY --chown=node:node packages/contracts packages/contracts
COPY --chown=node:node apps/api apps/api
CMD ["npm", "run", "start", "-w", "apps/api"]
