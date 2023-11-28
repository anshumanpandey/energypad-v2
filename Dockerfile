# STAGE 1
FROM node:16-alpine as builder
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
WORKDIR /home/node/app
COPY package*.json ./
COPY yarn.lock ./
USER node
RUN yarn install
COPY --chown=node:node . .
RUN yarn run build

ARG PROD_DB_HOSTNAME
ARG DB_USERNAME
ARG DB_PASSWORD
ARG DB_NAME
ARG DB_DIALECT

# STAGE 2
FROM node:16-alpine
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
WORKDIR /home/node/app
COPY package*.json ./
COPY yarn.lock ./
USER node
RUN yarn install --production
COPY --from=builder /home/node/app/dist ./dist
COPY --from=builder /home/node/app/dist/lib/db ./src/lib/db
COPY ./assets ./assets
ARG PROD_DB_HOSTNAME
ARG DB_USERNAME
ARG DB_PASSWORD
ARG DB_NAME
ARG DB_DIALECT
ARG PORT
ARG NODE_ENV
ARG JWT_SECRET

ENV PROD_DB_HOSTNAME=$PROD_DB_HOSTNAME
ENV DB_USERNAME=$DB_USERNAME
ENV DB_PASSWORD=$DB_PASSWORD
ENV DB_NAME=$DB_NAME
ENV DB_DIALECT=$DB_DIALECT
ENV PORT=$PORT
ENV NODE_ENV=$NODE_ENV
ENV JWT_SECRET=$JWT_SECRET

EXPOSE 2700
CMD [ "node", "dist/index.js" ]
