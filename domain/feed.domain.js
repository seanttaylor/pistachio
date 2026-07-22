import { Subscription, SubscriptionCollection } from './subscription.domain.js';
import { SystemEvent } from '../system-event.js';
import { Integrations } from '../integrations.js';

import jsonLogic from 'json-logic-js';
import * as jsonpatch from 'fast-json-patch';

/**
 * Pushes derived events to feed topic subscribers
 * @param {IEvent} originalEvent
 * @param {IEvent} derivedEvent
 * @returns {function(): void}
 */
const defaultPublisher = (originalEvent, derivedEvent) => {
  /**
   * @param {object} ts - topic subscriber
   */
  return function (ts) {
    ts.push(derivedEvent);
  };
};

/**
 * @callback IntegrationHandler
 * @param {{ type: string, [key: string]: * }} requestBody
 * @returns {Object}
 */

/**
 * A map of integration event types to their handlers.
 *
 * @typedef {Object.<string, IntegrationHandler>} IntegrationMap
 */

/**
 * Houses mapping of external event types to functions that can
 * generate a digest of resource data associated with such events
 * @type {IntegrationMap}
 */
const integrationMap = {
  /**
   * @param {Object} requestBody - body of an incoming HTTP request announcing
   * an external event
   * @returns {Object}
   */
  [Integrations.GOOGLE_DRIVE](requestBody) {
    const { id, type, subject } = requestBody;
    const match = {
      and: [
        {
          '==': [{ var: 'rel' }, 'file'],
        },
        {
          '==': [{ var: 'id' }, id],
        },
      ],
    };
    return { id, type, subject, match };
  },
};

/**
 * See https://stackblitz.com/edit/js-duh7w4h2?file=index.js from public/private key generation in browser.
 */
export class Feed {
  /**
   * Determines whether events are automatically published after being pushed.
   * @type {boolean}
   */
  #autoPublish;

  /**
   * Publication transport implementation used to distribute events.
   * @type {function}
   */
  #publisher;

  /**
   * ISO timestamp indicating when the feed was created.
   * @type {string}
   */
  #createdAt;

  /**
   * Globally unique identifier for the feed instance.
   * @type {string}
   */
  #id;

  /**
   * Internal append-only collection of events belonging to the feed.
   * @type {Array<IEvent>}
   */
  #items = [];

  /**
   * Public cryptographic identity used to verify feed authenticity.
   * @type {string}
   */
  #publicKey;

  /**
   * Private cryptographic key used to sign feed publications.
   * @type {string}
   */
  #privateKey;

  /**
   * Cryptographic signature associated with the feed publisher.
   * @type {string}
   */
  #signature;

  /**
   * Registered subscriber feeds keyed by feed identifier.
   * @type {Object<string, Feed>}
   */
  #subscribers = {};

  /**
   * Collection of subscription contracts associated with the feed.
   *
   */
  #subscriptions;

  /**
   * Topic-to-subscriber routing map used during publication fanout.
   * @type {Object<string, Feed[]>}
   */
  #topicMap = {
    rel: `topic_map:${this.#id}`,
  };

  /**
   * Human-readable name assigned to the feed.
   * @type {string}
   */
  #name;

  /**
   * Primary topic namespace associated with the feed.
   * @type {?string}
   */
  #topic;

  /**
   * ISO timestamp indicating the most recent feed mutation.
   * @type {?string}
   */
  #updated_at;

  /**
   * Optional schema describing the structure of feed events.
   * @type {?Object}
   */
  #schema;

  /**
   * Indicates whether the feed is authorized to define canonical
   * ingress event relationships.
   * @type {boolean}
   */
  #canonical;

  /**
   * Houses semantic relationships between resource-oriented events on
   * a specified integration provider and operationally meaninful events in Cerebro
   * @type {Object}
   */
  #eventBindings = {};

  constructor({
    id = crypto.randomUUID(),
    createdAt = new Date().toISOString(),
    name,
    autoPublish,
    canonical,
    publisher,
    topic,
    schema,
    subscriptions = [],
  }) {
    this.#id = id;
    this.#createdAt = createdAt;
    this.#autoPublish = autoPublish;
    this.#name = name;
    this.#topic = topic;
    this.#schema = schema;
    this.#publisher = publisher;
    this.#publicKey = 'a hexademical represenation of the public key';
    this.#privateKey = 'a hexademical represenation of the private key';
    this.#signature = 'a signature';
    this.#canonical = canonical;
    this.#subscriptions = subscriptions instanceof SubscriptionCollection ?
    subscriptions : new SubscriptionCollection(this, subscriptions);
    
    
  }

  static HTTP = {
    allowedMethods: ['GET', 'POST'],
    rel: {
      subscriptions: {
        accessor: 'subscriptions',
        hasInstances: true,
        id: 'subId',
        resolve(subscriptions, id) {
          console.log('inside resolver', { subscriptions, id });
          return subscriptions.find((s) => s.id === id);
        },
        proc: {
          remove: {
            method: 'DELETE',
            instance: true,
          },
          add: {
            method: 'PUT',
          },
        },
      },
    },
  };

  /**
   * Returns the globally unique identifier of the feed.
   *
   * @returns {string}
   */
  get id() {
    return this.#id;
  }

  /**
   * Returns the feed topic namespace.
   *
   * @returns {?string}
   */
  get topic() {
    return this.#topic;
  }

  /**
   * Returns the human-readable feed name.
   *
   * @returns {string}
   */
  get name() {
    return this.#name;
  }

  /**
   * Returns the schema associated with feed events.
   *
   * @returns {?Object}
   */
  get schema() {
    return this.#schema;
  }

  /**
   * Returns the total number of subscribed feeds.
   *
   * @returns {number}
   */
  get size() {
    return Object.values(this.#subscribers).length;
  }

  /**
   * Returns all registered subscriber feeds.
   *
   * @returns {Feed[]}
   */
  get subscribers() {
    return Object.values(this.#subscribers);
  }

  /**
   * @returns {SubscriptionCollection}
   */
  get subscriptions() {
    return this.#subscriptions;
  }

  /**
   * Serializes feed metadata into a plain JSON object.
   *
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.#id,
      name: this.#name,
      schema: this.#schema,
      topic: this.#topic,
      createdAt: this.#createdAt,
      size: this.size,
      subscriptions: this.subscriptions,
    };
  }

  /**
   * Returns an iterator over feed events.
   *
   * @param {Object} params
   * @param {number} params.limit - Maximum number of events to retrieve.
   * @param {number} params.offset - Event offset used for pagination.
   * @returns {Iterator<IEvent>}
   */
  get({ limit, offset }) {
    return Iterator.from(this.#items);
  }

  /**
   * Registers a subscribing feed for one or more event topics.
   *
   * @param {SubscriptionOptions}
   * @returns {Subscription}
   */
  async subscribe(options) {
    const subscribingFeed = await Feed.writer.read({ id });
    try {
      const sub = this.#subscriptions.add(options, subscribingFeed);

      if (options.policy?.replay.head) {
        setTimeout(() => {
          this.#items.forEach((item) => {
            this.publish(item, this.#publisher);
          });
        }, 0);
      }

      return sub;
    } catch (ex) {
      console.error(
        `INTERNAL ERROR (Feed): ***EXCEPTION ENCOUNTERED*** while creating a subscription. See details -> ${ex.message}`
      );
    }
  }

  /**
   * Appends an event to the feed and optionally publishes it.
   *
   * @param {IEvent} event Event payload being inserted into the feed.
   * @returns {void}
   */
  push(event) {
    this.#items.push(event);
    this.#updated_at = new Date().toISOString();

    if (this.#autoPublish) {
      this.publish(event, this.#publisher);
    }
  }

  /**
   * Publishes an event and its derived counterpart to subscribed feeds.
   *
   * @param {IEvent} event - Source event being published.
   * @param {function(): void} [callbackFn=defaultPubliser] - Publication transport callback.
   * @returns {void}
   */
  publish(event, callbackFn = defaultPublisher) {
    try {
      const name = event.header.name;
      const topicSubscribers = this.#subscriptions.to(name);

      const { derived, ...originalEventMetadata } = event.header.meta;

      const { detail: derivedEvent } = new SystemEvent(
        event.header.name,
        event.payload,
        {
          originId: event.header.id,
          derived: true,
          ...originalEventMetadata,
        }
      );

      if (topicSubscribers) {
        for (const ts of topicSubscribers) {
          const subscription = this.#subscriptions.get(ts.id);
          callbackFn(event, derivedEvent, subscription)(ts);
        }
        return;
      }

      setTimeout(() => {
        // We call the publisher with an empty interface `topicSubscriber` so that
        // publishers have a guarantee that the topicSubscriber interface will remain stable
        // The `rel` property is an adivsory flag that this topicSubscriber doesn't do anything
        callbackFn(event, derivedEvent)({ push() {}, rel: 'noop' });
      }, 1000);
    } catch (ex) {
      console.error(
        `INTERNAL_ERROR (Feed): Exception encountered while publishing event (${event.header.name}) See details -> ${ex.message}`
      );
    }
  }

  /**
   * @param {Object} req - an incoming HTTP request
   */
  ingest(req) {
    try {
      // Non-canonical feeds cannot define ingress semantics.
      if (!this.#canonical) {
        return null;
      }

      const integrationType = req.headers['x-cerebro-integration'];
      const resourceDigest = integrationMap[integrationType](req.body);
      const bindings = this.#eventBindings[resourceDigest.type];
      const matchedBindings = bindings.reduce((res, b) => {
        if (jsonLogic.apply(resourceDigest.match, b.resource)) {
          res.push(b);
          return res;
        }
        return res;
      }, []);

      matchedBindings.forEach((b) => {
        const mappedEventData = jsonpatch.applyPatch(
          Object.assign({}, req.body),
          b.mapping
        ).newDocument;
        const { meta, payload } = mappedEventData;
        const { detail: event } = new SystemEvent(b.is, payload, {
          tags: ['mapped'],
          ...meta,
        });

        this.publish(event);
      });
    } catch (ex) {
      console.error(
        `INTERNAL_ERROR (Feed): Exception encountered while ingesting event. See details -> ${ex.message}`
      );
    }
  }

  /**
   * Defines a semantic relationship between an external integration event
   * and a canonical Cerebro event.
   *
   * Only canonical feeds may register ingress definitions.
   *
   * @param {object} options
   * @param {string} options.integration
   * @param {string} options.externalEvent
   * @param {string} options.is
   * @param {string} options.resource.id
   * @param {object[]} [options.resource.mapping]
   * @param {object} [options.resource.rel]
   * @param {string} [options.resource.id]
   * @param {boolean} [options.resource.includeAttachment=false]
   *
   * @returns {?Object}
   */
  define({ integration, externalEvent, is, resource = {}, mapping = [] }) {
    // Non-canonical feeds cannot define ingress semantics.
    if (!this.#canonical) {
      return null;
    }

    // Minimal validation.
    if (!integration) {
      throw new Error('define() requires an integration');
    }

    if (!externalEvent) {
      throw new Error('define() requires an externalEvent');
    }

    if (!is) {
      throw new Error('define() requires an internal event via `is`');
    }

    const binding = {
      id: crypto.randomUUID(),
      integration,
      externalEvent,
      is,
      resource: {
        rel: resource.rel ?? false,
        id: resource.id,
        includeAttachment: resource.includeAttachment ?? false,
      },
      mapping,
      createdAt: new Date().toISOString(),
    };

    if (!this.#eventBindings[externalEvent]) {
      this.#eventBindings[externalEvent] = [binding];
    } else {
      this.#eventBindings[binding.id].push(binding);
    }

    return binding;
  }

  /**
   * Removes a subscriber feed from the feed registry.
   *
   * @param {string} feedId - Unique identifier of the subscriber feed.
   * @returns {void}
   */
  unsubscribe(feedId) {
    delete this.#subscribers[feedId];
  }

  /**
   * Archives the feed and transitions it into a non-active state.
   *
   * @returns {void}
   */
  archive() {}

  /**
   * Creates a new Feed instance.
   *
   * @param {Object} [options]
   * @param {string} options.name - Human-readable feed name.
   * @param {boolean} [options.autoPublish=false] - Automatically publish events after insertion.
   * @param {function} [options.publisher=defaultPublisher] - Publication transport implementation.
   * @param {?string} [options.topic=null] - Primary topic namespace for the feed.
   * @param {?Object} [options.schema=null] - Event schema definition associated with the feed.
   */
  static async of({
    name,
    autoPublish = false,
    canonical = false,
    publisher = defaultPublisher,
    topic = null,
    schema = null,
  } = {}) {
    const f = new Feed({
      name,
      autoPublish,
      canonical,
      publisher,
      topic,
      schema,
    });

    await Feed.writer.create(f.toJSON());
    return f;
  }

  static backend(writer) {
    if (!Feed.writer) {
      Feed.writer = writer;
    }
  }

  static from(record) {
    if (!record) {
      throw new Error(`Could not create Feed instance on record of type (${typeof record})`)
    }
    return new Feed(record);
  }

  static async findOne({ id }) {
    const [record] = await Feed.writer.read({id});

    const f = Feed.from(record);
    return f;
  }
  static async findAll(options) {
    const recordList = await Feed.writer.read();
    return recordList;
  }

  static async updateOne({ id, instance }) {
    try {
      const r = await Feed.writer.update(id, instance.toJSON());

      console.log('updatedRecord', r);
    } catch (ex) {
      console.error(
        `INTERNAL_ERROR (Feed): **EXCEPTION ENCOUNTERED** Could not update record (${id}) See details -> ${ex.message}`
      );
    }
  }
  static deleteOne(id) {}
}
