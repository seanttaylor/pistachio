import { Subscription, SubscriptionCollection } from './subscription.domain.js';
import { SystemEvent } from '../system-event.js';

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
   * Indicates what an domain entity _is_ for consumers
   * @type {string}
   */
  #rel = 'feed'

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
   * @returns {string}
   */
  get rel() {
    return this.#rel;
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
      rel: this.rel
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
    const subscribingFeed = await Feed.storageProvider.read({ id });
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

    await Feed.storageProvider.create(f.toJSON());
    return f;
  }

  static backend(storageProvider) {
    if (!Feed.storageProvider) {
      Feed.storageProvider = storageProvider;
    }
  }

  static from(record) {
    if (!record) {
      throw new Error(`Could not create Feed instance on record of type (${typeof record})`)
    }
    return new Feed(record);
  }

  static async findOne({ id }) {
    try { 
      const [record] = await Feed.storageProvider.read({id});
      const f = Feed.from(record);
      return f;
    } catch(ex) {
      console.error(
        `INTERNAL_ERROR (Feed): **EXCEPTION ENCOUNTERED** Could not find Feed record (${id}). See details -> ${ex.message}`
      );
    }
  }
  static async findAll(options) {
    try {
      const recordList = await Feed.storageProvider.read();
      return recordList;
    } catch(ex) {
      console.error(
        `INTERNAL_ERROR (Feed): **EXCEPTION ENCOUNTERED** Could not find Feed records. See details -> ${ex.message}`
      );
    }
  }

  static async updateOne({ id, instance }) {
    try {
      await Feed.storageProvider.update(id, instance.toJSON());
    } catch (ex) {
      console.error(
        `INTERNAL_ERROR (Feed): **EXCEPTION ENCOUNTERED** Could not update Feed record (${id}) See details -> ${ex.message}`
      );
    }
  }
  static deleteOne(id) {}
}
