/**
 * @see {@link StorageProvider}
 */
export class IStorageProvider {
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
  async read(id) {
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
 * @implements {StorageProvider}
 * @see {@link StorageProvider}
 */
export class MemoryStorageProvider extends IStorageProvider {
  /**
   * @type {Map<string, Object>}
   */
  #store = new Map();

  constructor() {
    super();
  }

  /**
   * Creates a resource.
   *
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    const record = {
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
  async read({ id }={}) {
    if (!id) {
      return Array.from(this.#store.values());
    }
    return [this.#store.get(id)] ?? null;
  }

  /**
   * Updates a record.
   *
   * @param {string} id
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async update(id, data) {
    const record = this.#store.get(id);

    if (!record) {
      throw new Error(`Record not found: ${id}`);
    }
    const updatedRecord = Object.assign(record, data);
    this.#store.set(id, updatedRecord);

    return record;
  }

  /**
   * Deletes a record.
   *
   * @param {string} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    this.#store.delete(id);
  }
}