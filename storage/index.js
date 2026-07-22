import { IStorageProvider } from '../interfaces/storage.interface.js';

export class RestDBProvider extends IStorageProvider {
  #apiKey;
  #dbInstance;

  /**
   *
   * @param {object} options
   * @param {string} options.apiKey
   * @param {string} options.instance
   */
  constructor(options) {
    super();
    this.#apiKey = options.apiKey;
    this.#dbInstance = options.instance;
  }

  /**
   * @param {Object} record
   * @returns {Promise<Object>}
   */
  async create(record) {
    const collection = `${record.rel}s`;
    const url = `https://${this.#dbInstance}.restdb.io/rest/${collection}`;
    const response = await fetch(url, {
      headers: {
        'x-apikey': this.#apiKey,
        'content-type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify(record),
    });

    return response;
  }
}

import { MongoClient } from 'mongodb';

/**
 * MongoDB-backed storage provider.
 */
export class MongoDBProvider {
  #client;
  #db;

  constructor(client, db) {
    this.#client = client;
    this.#db = db;
  }

  /**
   * Establishes a MongoDB connection and returns
   * a configured provider instance.
   *
   * @param {Object} options
   * @param {string} options.uri - mongodb database connection uri
   * @param {string} options.instance - the mongodb database instance name
   *
   * @returns {Promise<MongoDBProvider>}
   */
  static async from({ uri, instance }) {
    const client = new MongoClient(uri);

    await client.connect();

    return new MongoDBProvider(client, client.db(instance));
  }

  /**
   * Creates a MongoDB document.
   * The incoming record is expected to contain
   * a `rel` property which determines the target
   * Mongo collection.
   * @param {Object} record
   * @returns {Promise<Object>}
   */
  async create(record) {
    const { id, ...insertRecord } = record;
    const collectionName = `${record.rel}s`;
    const collection = this.#db.collection(collectionName);

    await collection.insertOne({
      _id: record.id,
      ...insertRecord,
    });

    return {
      id,
      ...insertRecord,
    };
  }

  /**
   * Gracefully closes the underlying connection.
   *
   * @returns {Promise<void>}
   */
  async close() {
    await this.#client.close();
  }
}
