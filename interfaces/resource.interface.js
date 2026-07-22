import { json2csv } from 'json-2-csv';

/**
 *
 */
export class IResource {
  #writer;

  constructor(writer) {
    this.#writer = writer;
  }

  /**
   * @param {object} params
   */
  create(params) {
    return this.#writer.create(params);
  }

  /**
   * @param {object} params
   */
  find(params) {
    return this.#writer.find(params);
  }

  /**
   * @param {object} params
   */
  update(params) {
    return this.#writer.update(params);
  }

  /**
   * @param {object} params
   */
  delete(params) {
    return this.#writer.delete(params);
  }
}


class IResourceView {
  #contentType;
  #name;
  #payload;
  #renderFn;
  #version;

  /**
   * @param {Object} options
   */
  constructor(options) {
    this.#contentType = options.contentType;
    this.#name = options.name;
    this.#payload;
    this.#version = options.version;
    this.#renderFn = options.renderFn;
  }

  get name() {
    return this.#name;
  }

  get contentType() {
    return this.#contentType;
  }

  get version() {
    return this.#version;
  }

  get payload() {
    return this.#payload;
  }

  /**
   * @return {Response}
   */
  render() {
    throw new Error('Method **MUST** be implemented');
  }
}

export class ViewFeedJSON extends IResourceView {
  constructor() {
    super({
      contentType: 'application/json',
      name: 'ViewFeedJSON',
      version: 1,
    });
  }

  /**
   * @param {Object} payload;
   */
  render(payload = {}) {
  
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'content-type': this.contentType,
        'x-pistachio-resource-version': this.version,
        'x-pistachio-resource-name': this.name
      }
    });
  }
}

export class ViewFeedCSV extends IResourceView {
  constructor() {
    super({
      contentType: 'text/csv',
      name: 'ViewFeedCSV',
      version: 1,
    });
  }

  /**
   * @param {Object} payload;
   */
  render(payload = {}) {
    const csv = json2csv(Object.values(payload));
    return new Response(csv, {
      status: 200,
      headers: {
        'content-type': this.contentType,
        version: this.version,
      },
    });
  }
}
