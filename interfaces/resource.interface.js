import { json2csv } from 'json-2-csv';

/**
 * Abstract base class representing a renderable resource
 * representation.
 *
 * Resource views are responsible for transforming domain
 * objects into concrete HTTP representations such as JSON,
 * CSV, XML, or HTML.
 *
 * Implementations must provide a concrete {@link IResourceView#render}
 * method.
 *  
 * @abstract
 * 
 * @see {@link ResourceRepresentation}
 */
class IResourceView {
  #contentType;
  #name;
  #payload;
  #version;

  /**
   * Creates a new resource view.
   *
   * @param {ResourceRepresentation} options
   */
  constructor(options) {
    this.#contentType = options.contentType;
    this.#name = options.name;
    this.#payload;
    this.#version = options.version;
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
   * Renders a resource representation.
   * 
   * Implementations should transform the supplied payload
   * into an HTTP {@link Response}.
   *
   * @abstract
   *
   * @param {*} payload
   * Resource payload to render.
   *
   * @returns {Response}
   */
  render(payload) {
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
        'x-pistachio-resource-name': this.name,
        'x-pistachio-resource-version': this.version
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
        'x-pistachio-resource-name': this.name,
        'x-pistachio-resource-version': this.version,
      },
    });
  }
}
