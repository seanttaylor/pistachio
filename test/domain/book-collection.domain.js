import { Book } from "./book.domain.js";

export class BookCollection {
  #owner;
  #items;

  constructor({ owner, items = [] }) {
    this.#owner = owner;
    this.#items = items.map((item) => new Book(item));
  }

  findAll() {
    return this.#items;
  }

  find(id) {
    return this.#items.find((book) => book.id === id);
  }

  add(options) {
    const book = new Book(options);
    this.#items.push(book);
    return book;
  }

  remove(id) {
    const index = this.#items.findIndex((book) => book.id === id);
    if (index === -1) return undefined;

    return this.#items.splice(index, 1)[0];
  }

  toJSON() {
    return this.#items.map((book) => book.toJSON());
  }
}