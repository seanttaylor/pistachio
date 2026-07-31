import { ResourceCollection } from '../pistachio/resource.js';
import { Events } from '../system-event.js';
import { Feed } from './feed.domain.js';

export class Subscription {
  #createdAt = new Date().toISOString();
  #id;
  #topics = [];
  #feedName;
  #feedId;
  #expires_at;
  #mapping;
  #rel = 'subscription';
  #publisher;
  #subscriber;
  #policy;

  /***
   * @param {SubscriptionOptions} options
   */
  constructor({
    publisher,
    topics,
    mapping,
    policy,
    subscriber,
    id = crypto.randomUUID(),
    createdAt = new Date().toISOString(),
  }) {
    try {
      this.#feedName = publisher.name;
      this.#feedId = publisher.id;
      this.#topics = [...topics];
      this.#mapping = mapping;
      this.#publisher = publisher;
      this.#subscriber = subscriber;
      this.#policy = policy;
      this.#id = id;
      this.#createdAt = createdAt;
    } catch (ex) {
      console.error(
        `INTERNAL ERROR (Subscription): **EXCEPTION ENCOUNTERED** while creating Subscription instance. See details -> ${ex.message} `
      );
      return new Error();
    }
  }

  get publisher() {
    return this.#publisher;
  }

  get publisherPubKey() {
    return this.#publisher.publicKey;
  }

  get publsherSignature() {
    return this.#publisher.signature;
  }

  get id() {
    return this.#id;
  }

  get feedName() {
    return this.#feedName;
  }

  get feedId() {
    return this.#feedId;
  }

  get topics() {
    return this.#topics;
  }

  get mapping() {
    return this.#mapping;
  }

  get subscriber() {
    return this.#subscriber;
  }

  static of(options) {
    return new Subscription(options);
  }

  static Request = class {
    #publisher;
    #subscriber;
    #topics;
    #mapping;
    #policy;

    constructor(item, publisherName, publisherId) {
      this.#publisher = {
        name: publisherName,
        id: publisherId,
      };

      this.#subscriber = {
        name: item.subscriberName,
        id: item.subscriberId,
      };

      this.#topics = item.topics;
      this.#mapping = item.mapping;
      this.#policy = item.policy;
    }

    get publisher() {
      return this.#publisher;
    }

    get subscriber() {
      return this.#subscriber;
    }

    get mapping() {
      return this.#mapping;
    }

    get topics() {
      return this.#topics;
    }

    get policy() {
      return this.#policy;
    }

    toJSON() {
      return {
        publisher: this.#publisher,
        subscriber: this.#subscriber,
        mapping: this.#mapping,
        topics: this.#topics,
        policy: this.#policy,
      };
    }
  };

  toJSON() {
    return {
      createdAt: this.#createdAt,
      id: this.#id,
      topics: this.#topics,
      publisher: this.#publisher,
      expires_at: this.#expires_at,
      rel: this.#rel,
      mapping: this.#mapping,
      subscriber: this.#subscriber,
    };
  }
}

export class SubscriptionCollection extends ResourceCollection {
  /**
   * Topic-to-subscriber routing map used during publication fanout.
   * @type {Object<string, Object[{ feed: Feed, subscription: Subscription }]>}
   */
  #topicMap = {};

  constructor(items) {
    super(items);
  }

  static entity = Subscription;

  /**
   *
   * @param {*} item
   * @returns {Subscription | Error}
   */
  async add(item) {
    let subscription;

    if (!(item instanceof Subscription)) {
      subscription = super.add(
        new Subscription.Request(item, this.owner.name, this.owner.id)
      );

      this.owner.notify({
        of: Events.SUBSCRIPTIONS_UPDATE,
        rel: 'instance.create',
        payload: subscription,
      });
    } else {
      subscription = super.add(item);
    }

    try {
      for (const topic of subscription.topics) {
        if (!this.#topicMap[topic]) {
          this.#topicMap[topic] = [];
        }

        this.#topicMap[topic].push({
          feed: this.owner,
          subscription,
        });
      }

      return subscription;
    } catch (ex) {
      console.error(
        `INTERNAL ERROR (SubscriptionCollection): **EXCEPTION ENCOUNTERED** while adding subscription to feed (${this.owner.name}). See details -> ${ex.message}`
      );
      return new Error();
    }
  }

  /**
   *
   * @param {Object} options
   * @param {string} options.subId - the id of the subscription being removed
   */
  async remove({ subId }) {
    super.remove(subId);
    this.owner.notify({
      of: Events.SUBSCRIPTIONS_UPDATE,
      rel: 'instance.delete',
      payload: subId,
    });
  }

  to(topic) {
    return this.#topicMap[topic] ?? [];
  }
}

/**
 * Options used to create a {@link Subscription}.
 *
 * Represents the relationship between a publisher feed and
 * a subscribing feed, including any topic filters and
 * event transformation mappings.
 *
 * @typedef {Object} SubscriptionOptions
 *
 * @property {string} feedName
 * Human-readable name of the subscribing feed.
 *
 * @property {string} feedId
 * Unique identifier of the subscribing feed.
 *
 * @property {string} publisherSig
 * Signature identifying the publishing feed.
 *
 * @property {string} publisherPubKey
 * Public key associated with the publisher.
 *
 * @property {Object[]} [mapping=[]]
 * Optional JSON Patch mapping instructions describing how
 * incoming events should be transformed before delivery.
 *
 * @property {string[]} [topics=[]]
 * Event topics the subscriber wishes to receive.
 */
