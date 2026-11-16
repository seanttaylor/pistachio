import { IAggregateRoot } from "../../interfaces/root.interface.js";
import { BookCollection } from "./book-collection.domain.js";

export class Publisher extends IAggregateRoot {
  #id;
  #name;
  #books;

  constructor({
    id = crypto.randomUUID(),
    name,
    books = [],
  }) {
    super();

    this.#id = id;
    this.#name = name;
    this.#books = new BookCollection({
      owner: this,
      items: books,
    });
  }

  static HTTP = {
    allowedMethods: ['GET', 'POST', 'DELETE'],

    rel: {
      books: {
        accessor: 'books',
        hasInstances: true,
        id: 'bookId',

        resolve(books, id) {
          return books.find((book) => book.id === id);
        },

        proc: {
          add: { method: 'PUT' },
          remove: { method: 'DELETE' },
        },
      },
    },
  };

  get id() {
    return this.#id;
  }

  get name() {
    return this.#name;
  }

  get books() {
    return this.#books;
  }

  toJSON() {
    return {
      id: this.#id,
      name: this.#name,
      books: this.#books.toJSON(),
    };
  }

  async archive() {
    // Deliberately simple test operation.
    return { archived: true };
  }

  static async of(options) {
    const publisher = new Publisher(options);
    await Publisher.storageProvider.create(publisher.toJSON());
    return publisher;
  }

  static from(record) {
    return new Publisher(record);
  }

  static async findOne({ id }) {
    const [record] = await Publisher.storageProvider.read({ id });
    return record ? Publisher.from(record) : undefined;
  }

  static async findAll(options) {
    return Publisher.storageProvider.read(options);
  }

  static async updateOne({ id, instance }) {
    return Publisher.storageProvider.update(id, instance.toJSON());
  }

  static async deleteOne({ id }) {
    return Publisher.storageProvider.delete({ id });
  }
}