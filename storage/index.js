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
    try {
      const client = new MongoClient(uri);
      await client.connect();

      return new MongoDBProvider(client, client.db(instance));
    } catch (ex) {
      console.log(
        `INTERNAL ERROR (MongoDBProvider): **EXCEPTION ENCOUNTERED** while establishing database connection. See details -> ${ex.message}`
      );
    }
  }

  /**
   * Creates a MongoDB document.
   *
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
   * Reads a MongoDB document.
   *
   * @param {Object} options
   * @param {string} options.rel
   * @param {string} options.id
   * @returns {Promise<?Object>}
   */
  async read({ id, rel }) {
    const collectionName = `${rel}s`;
    const record = await this.#db.collection(collectionName).findOne({
      _id: id,
    });

    if (!record) {
      return null;
    }

    const { _id, ...data } = record;

    return [
      {
        id: _id,
        ...data,
      },
    ];
  }

  /**
   * Updates a MongoDB document.
   *  @param {string} id
   * @param {Object} record
   * @returns {Promise<?Object>}
   */
  async update(id, record) {
    const { rel, id: _, ...updates } = record;
    const collectionName = `${rel}s`;

    await this.#db.collection(collectionName).updateOne(
      {
        _id: id,
      },
      {
        $set: updates,
      }
    );

    return {
      id,
      rel,
      ...updates,
    };
  }

  /**
   * Deletes a MongoDB document.
   *
   * @param {Object} options
   * @param {string} options.id
   * @returns {Promise<boolean>}
   */
  async delete({ id, rel }) {
    const collectionName = `${rel}s`;
    const result = await this.#db.collection(collectionName).deleteOne({
      _id: id,
    });

    return result.deletedCount === 1;
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
