import { Pistachio } from './pistachio.js';
import { logger } from './middleware.js';
import { ViewFeedJSON, ViewFeedCSV } from './interfaces/resource.js';
import { Feed } from './domain/feed.js';

import Fastify from 'fastify';

(async function main() {
  try {
    const fastify = Fastify({
      logger: true
    });

    /**
     * Defines the persistence contract required by Feed.
     */
    class IFeedWriter {
      /**
       * Creates a resource.
       *
       * @param {Object} data
       * @returns {Promise<Object>}
       */
      async create(data) {
        throw new Error('Method not implemented');
      }

      /**
       * Reads a resource.
       *
       * @param {string} id
       * @returns {Promise<Object|null>}
       */
      async find(id) {
        throw new Error('Method not implemented');
      }

      /**
       * Updates a resource.
       *
       * @param {string} id
       * @param {Object} data
       * @returns {Promise<Object>}
       */
      async update(id, data) {
        throw new Error('Method not implemented');
      }

      /**
       * Deletes a resource.
       *
       * @param {string} id
       * @returns {Promise<void>}
       */
      async delete(id) {
        throw new Error('Method not implemented');
      }
    }

    /**
     * In-memory persistence implementation.
     */
    class MemoryFeedWriter extends IFeedWriter {
      /**
       * @type {Map<string, Object>}
       */
      #store = new Map();

      /**
       * Creates a resource.
       *
       * @param {Object} data
       * @returns {Promise<Object>}
       */
      async create(data) {
        const record = {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          ...data,
        };

        this.#store.set(record.id, record);

        return record;
      }

      /**
       * Reads a resource.
       *
       * @param {object} options
       * @param {string} options.id
       * @returns {Promise<Object|null>}
       */
      async find({ id }) {
        if (!id) {
          return Array.from(this.#store.values());
        }
        return this.#store.get(id) ?? null;
      }

      /**
       * Updates a resource.
       *
       * @param {string} id
       * @param {Object} data
       * @returns {Promise<Object>}
       */
      async update(id, data) {
        const record = this.#store.get(id);

        if (!record) {
          throw new Error(`Resource not found: ${id}`);
        }

        Object.assign(record, data);

        return record;
      }

      /**
       * Deletes a resource.
       *
       * @param {string} id
       * @returns {Promise<void>}
       */
      async delete(id) {
        this.#store.delete(id);
      }
    }

    const router = new Pistachio();
    router.resource('/feeds', new Feed(new MemoryFeedWriter()), {
      collection: true,
      allowedMethods: ['GET', 'POST'],
      use: [logger],
      views: [new ViewFeedJSON(), new ViewFeedCSV()],
    });
    /*
    const req1 = new Request('http://localhost:8080/feeds', {
      method: 'POST',
      body: '{"foo": "bar"}',
    });

    const res1 = await router.resolve(req1);
    const { id } = await res1.json();

    const req2 = new Request(`http://localhost:8080/feeds/${id}`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    });

    const res2 = await router.resolve(req2);

    const req3 = new Request(
      `http://localhost:8080/feeds/${id}/subscriptions`,
      {
        method: 'POST',
        body: '{"topics": ["bar"]}',
      }
    );

    const res3 = await router.resolve(req3);

    const req4 = new Request(`http://localhost:8080/feeds/${id}`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
      },
    });
    */

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
    fastify.log.error(err);
    process.exit(1);
  }
})();
