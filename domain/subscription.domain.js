import { ResourceCollection } from '../pistachio/resource.js';

export class Subscription {
  #createdAt = new Date().toISOString();
  #id;
  #topics = [];
  #feedName;
  #feedId;
  #expires_at;
  #publisherSignature;
  #publisherPubKey;
  #mapping;
  #rel = 'subscription';
  #publisher;
  #subscriber;

  /***
   * @param {SubscriptionOptions} options
   */
  constructor({
    feedName,
    feedId,
    publisherSig,
    publisherPubKey,
    topics,
    mapping,
    subscriberName,
    subscriberId,
    id = crypto.randomUUID(),
    createdAt = new Date().toISOString(),
  }) {
    this.#feedName = feedName;
    this.#feedId = feedId;
    this.#publisherPubKey = publisherPubKey;
    this.#publisherSignature = publisherSig;
    this.#topics = [...topics];
    this.#mapping = mapping;
    this.#publisher = {
      name: feedName,
      id: feedId,
    };
    this.#subscriber = {
      name: subscriberName,
      id: subscriberId,
    };

    this.#id = id;
    this.#createdAt = createdAt;
  }

  get publisher() {
    return this.#publisher;
  }

  get publisherPubKey() {
    return this.#publisherPubKey;
  }

  get publsherSignature() {
    return this.#publisherSignature;
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
  #topicMap = {};

  constructor(owner, items) {
    super(owner, items);
  }

  static entity = Subscription;

  /**
   *
   * @param {*} options
   * @returns {Subscription | Error}
   */
  async add(options) {
    try {
      const subscription = super.add({
        ...options,
        feedName: this.owner.name,
        feedId: this.owner.id,
      });

      await this.owner.constructor.updateOne({
        id: this.owner.id,
        instance: this.owner,
      });

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
