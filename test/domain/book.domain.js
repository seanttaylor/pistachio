import crypto  from "node:crypto";

export class Book {
    #id;
    #name;

    constructor({
        id = crypto.randomUUID(),
        name
    }) {
        this.#id = id;
        this.#name = name;
    }

    get id() {
        return this.#id;
    }

    get name() {
        return this.#name;
    }
}