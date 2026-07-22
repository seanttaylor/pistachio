import { Pistachio } from './pistachio.js';
import { logger } from './middleware.js';
import { ViewFeedJSON, ViewFeedCSV } from './interfaces/resource.interface.js';
import { MemoryFeedWriter } from './interfaces/feed.interface.js';
import { Feed } from './domain/feed.domain.js';

import Fastify from 'fastify';

(async function main() {
  try {
    const fastify = Fastify({
      logger: true,
      disableRequestLogging: true
    });

    const router = new Pistachio();
    router.resource('/feeds', Feed, {
      writer: new MemoryFeedWriter(),
      use: [logger],
      views: [new ViewFeedJSON(), new ViewFeedCSV()],
    });

    fastify.all('*', async (req, reply) => {
      const request = new Request(
        `http://${req.headers.host}${req.url}`,
        {
          method: req.method,
          headers: req.headers,
          body:req.body == null
      ? undefined
      : JSON.stringify(req.body),
        }
      );

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
