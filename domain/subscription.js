export class Subscription {
  #created_at = new Date().toISOString();
  #id = crypto.randomUUID();
  #topics = [];
  #feedName;
  #feedId;
  #expires_at;
  #publisherSignature;
  #publisherPubKey;
  #mapping;
  #rel = 'subscription';

  /***
   * @param {string} feedName
   * @param {string} feedId
   * @param {string} publisherSig
   * @param {string} publisherPubKey
   * @param {object[]} mapping
   * @param {string[]} topics
   */
  constructor({
    feedName,
    feedId,
    publisherSig,
    publisherPubKey,
    topics,
    mapping,
  }) {
    this.#feedName = feedName;
    this.#feedId = feedId;
    this.#publisherPubKey = publisherPubKey;
    this.#publisherSignature = publisherSig;
    this.#topics = [...topics];
    this.#mapping = mapping;
  }

  get publisher() {
    return this.#feedName;
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

  get feedId() {
    return this.#feedId;
  }

  get topics() {
    return this.#topics;
  }

  get mapping() {
    return this.#mapping;
  }

  toJSON() {
    return {
      created_at: this.#created_at,
      id: this.#id,
      topics: this.#topics,
      feedName: this.#feedName,
      expires_at: this.#expires_at,
      rel: this.#rel,
      mapping: this.#mapping,
    };
  }
}
