FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node server ./server
COPY --chown=node:node public ./public
COPY --chown=node:node private ./private
COPY --chown=node:node source ./source
COPY --chown=node:node build.cjs api-transform.cjs province-transform.cjs dashboard-transform.cjs recommendation-transform.cjs map-transform.cjs ./
RUN node build.cjs && mkdir -p /app/data && chown node:node /app/data
USER node
ENV HOST=0.0.0.0 PORT=8080 DATA_DIR=/app/data NODE_ENV=production
EXPOSE 8080
CMD ["node", "server/index.mjs"]
