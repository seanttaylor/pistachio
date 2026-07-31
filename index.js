import { Pistachio } from './pistachio/index.js';
import { logger } from './middleware.js';
import { ViewFeedJSON, ViewFeedCSV } from './interfaces/resource.interface.js';

import { MemoryStorageProvider } from './interfaces/storage.interface.js';
import { MongoDBProvider } from './storage/index.js';
import { Feed } from './domain/feed.domain.js';

import Fastify from 'fastify';

(async function main() {
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

    await fastify.listen({ port: 8000 });
  } catch (ex) {
    console.error(
      `INTERNAL_ERROR (Main): Exception encountered. See details -> ${ex.message}`
    );
    fastify.log.error(ex);
    process.exit(1);
  }
})();
