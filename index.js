import { Pistachio } from './pistachio/index.js';
import { logger } from './middleware.js';
import { ViewFeedJSON, ViewFeedCSV } from './interfaces/resource.interface.js';

import { MemoryStorageProvider } from './interfaces/storage.interface.js';
import { MongoDBProvider } from './storage/index.js';
import { Feed } from './domain/feed.domain.js';

import Fastify from 'fastify';
import figlet from 'figlet';

(async function main() {
  const APP_NAME = process.env.APP_NAME || 'pistachio';
  const APP_VERSION = process.env.APP_VERSION || '1.0.1';
  const PORT = process.env.PORT || 8000;
  const envToLogger = {
    development: {
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
    production: true,
    test: false,
  };
  
  const fastify = Fastify({
    logger: envToLogger[process.env.environment || 'development'],
  });
  
  try {
    const banner = await figlet(`${APP_NAME} v${APP_VERSION}`);
    const router = new Pistachio();
    router.resource('/feeds', Feed, {
      storageProvider: await MongoDBProvider.from({
        instance: 'pistachio',
        uri: `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@cluster0.2pudji8.mongodb.net/?appName=Cluster0`
      }),
      use: [logger],
      views: [new ViewFeedJSON(), new ViewFeedCSV()],
    });

    fastify.all('*', async (req, reply) => {
      const request = new Request(`http://${req.headers.host}${req.url}`, {
        method: req.method,
        headers: req.headers,
        body: req.body == null ? undefined : JSON.stringify(req.body),
      });

      const response = await router.resolve(request);

      reply.status(response.status);

      for (const [k, v] of response.headers) {
        reply.header(k, v);
      }

      reply.send(response);
    });

    fastify.listen({ port: PORT }, (err) => {
      if (err) {
        console.error(`INTERNAL_ERROR (Main): ***EXCEPTION ENCOUNTERED*** while starting server. See details -> ${err.message} `);
        process.exit(1);
      }
      console.log(`Application listening on port ${PORT}`);
      console.log(banner);
    });
  } catch (ex) {
    console.error(
      `INTERNAL_ERROR (Main): ***EXCEPTION ENCOUNTERED***. See details -> ${ex.message}`
    );
    fastify.log.error(ex);
    process.exit(1);
  }
})();
