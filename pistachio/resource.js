/**
 * Managed collection of related resource entities.
 *
 * Resource collections provide ownership semantics and
 * collection-level behavior for groups of entities.
 *
 * Unlike plain arrays, collections maintain identity-based
 * lookup facilities, enforce entity instantiation via the
 * associated resource constructor, and may expose additional
 * domain-specific behaviors and indexes.
 *
 * Collections are considered first-class objects within the
 * framework and may themselves participate in network
 * projection and serialization.
 *
 * Collections are not merely arrays of entities; they are
 * managed relationship objects responsible for materializing,
 * indexing, and coordinating groups of related resources.
 *
 * @template T
 */
export class ResourceCollection {
  /**
   * @see CollectionOwner
   * @type {CollectionOwner}
   */
  #owner;

  /**
   * Internal identity map of entities contained by the collection.
   * @type {Map<string, T>}
   */
  #items = new Map();

  /**
   * Creates a managed collection.
   *
   * Existing collections are returned directly, allowing
   * callers to safely normalize arbitrary collection inputs.
   *
   * @param {Object} owner
   * Object that owns this collection.
   *
   * @param {(T[]|ResourceCollection<T>)} [items=[]]
   * Initial entities or entity representations.
   */
  constructor(owner, items = []) {
    this.#owner = owner;

    if (items instanceof ResourceCollection) {
      return items;
    }

    for (const item of items) {
      this.add(item);
    }
  }

  /**
   * @see EntityConstructor
   * @type {EntityConstructor}
   */
  static entity;

  /**
   * Returns the resource owning this collection.
   *
   * @returns {Object}
   */
  get owner() {
    return this.#owner;
  }

  get size() {
    return this.#items.size;
  }

  /**
   * Returns an iterator over contained entities.
   *
   * @returns {Iterator<T>}
   */
  get items() {
    return this.#items.values();
  }

  has(id) {
    return this.#items.has(id);
  }

  get(id) {
    return this.#items.get(id);
  }

  /**
   * Materializes and inserts an entity into the collection.
   *
   * Objects are converted into fully constituted entity
   * instances via the configured entity constructor before
   * being added.
   *
   * @param {Object} data
   * Entity representation.
   *
   * @returns {T}
   */
  add(data) {
    const Entity = this.constructor.entity;
    const instance = Entity.of(data);
    this.#items.set(instance.id, instance);

    return instance;
  }

  remove(id) {
    const item = this.get(id);
    this.#items.delete(id);
    return item;
  }

  clear() {
    this.#items.clear();
  }

  toArray() {
    return [...this.#items.values()];
  }

  find(fn) {
    return this.toArray().find(fn);
  }

  /**
   * Produces a new collection containing entities matching
   * the supplied predicate.
   *
   * Collection semantics and ownership are preserved.
   *
   * @param {function(T): boolean} fn
   *
   * @returns {this}
   */
  filter(fn) {
    return new this.constructor(this.toArray().filter(fn));
  }

  [Symbol.iterator]() {
    return this.#items.values();
  }

  /**
   * Serializes the collection into an array representation.
   *
   * @returns {Object[]}
   */
  toJSON() {
    return this.toArray();
  }
}
