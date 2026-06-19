import { json2csv } from 'json-2-csv';

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
