import * as jsonpatch from 'fast-json-patch';
import { computePatch } from './helpers.js';

export class ResourceOperation {
  #relation;
  #instance;
  #rel;
  #root;
  #route;
  #context;
  #target;
  #result;

  /**
   * @param {Object} options
   * @param {RouteDefinition} options.route
   * @param {RequestContext} options.context
   */
  constructor({ route, context }) {
    this.#route = route;
    this.#context = context;
  }

  toJSON() {
    return {
      relation: this.#relation,
      instance: this.#instance,
      root: this.#root,
      route: this.#route,
      context: this.#context,
      target: this.#target,
      result: this.#result,
      rel: this.#rel,
    };
  }

  get hasRelation() {
    return Boolean(this.#route.relation);
  }

  get hasProcedure() {
    return Boolean(this.#route.proc);
  }

  get hasRoot() {
    return Boolean(this.#root);
  }

  get requiresInstance() {
    return Boolean(this.#route.instance);
  }

  get result() {
    return this.#result;
  }

  // get hasError() {}

  // get hasTarget() {}

  #getProcedureTarget() {
    switch (this.#route.on ?? 'self') {
      case 'root':
        return this.#root;

      case 'instance':
        return this.#instance;

      case 'self':
      default:
        return this.#relation;
    }
  }

  #translateRequestContext() {
    let args = {
      ...this.#context.params,
      ...this.#context.query,
      ...(this.#context.body ?? {}),
    };

    if (this.#route.interface) {
      const candidate = {
        params: this.#context.params ?? {},
        body: this.#context.body ?? {},
        query: this.#context.query ?? {},
        headers: Object.fromEntries(this.#context.request.headers.entries()),
      };

      const patch = computePatch(candidate, this.#route.interface);
      args = jsonpatch.applyPatch({}, patch).newDocument;
    }

    return args;
  }

  async #executeProcedure() {
    const args = this.#translateRequestContext();
    const target = this.#getProcedureTarget();

    if (!target) {
      return;
    }

    const myProcedureResult = await target[this.#route.proc](
      args,
      this.#root,
      this.#root.constructor
    );

    this.#result = [myProcedureResult];
  }

  async #resolveRelation() {
    this.#rel = 'relation';
    if (typeof this.#relation === 'function') {
      this.#relation = await this.#relation.call(this.#root);
    }

    if (this.#route.instance) {
      const key = this.#route.relation.id || `${this.#route.relationName}Id`;
      this.#instance = await this.#route.relation.resolve(
        this.#relation,
        this.#context.params[key]
      );
    }
  }

  async #initializeRoot() {
    const id = this.#context.params.id;

    if (!id) {
      return;
    }

    this.#root = await this.#route.resource.findOne({ id });

    if (this.#root && this.#route.relation) {
      this.#relation = this.#root[this.#route.relation.accessor];
    }
  }

  async initialize() {
    await this.#initializeRoot();
    let myResource;

    //
    // Root-backed operation
    //
    if (this.hasRoot) {
      if (this.hasRelation) {
        await this.#resolveRelation();
      }
      return;
    }

    //
    // Collection operation
    //
    switch (this.#route.method) {
      case 'GET':
        myResource = await this.#route.resource.findAll(this.#context.query);
        this.#result = [myResource];
        break;

      case 'POST':
        myResource = await this.#route.resource.of({
          ...this.#context.body,
          storageProvider: this.#route.storageProvider,
        });
        this.#result = [myResource];
        this.#root = myResource;
        break;
    }
  }

  async run() {
    if (this.#result) {
      return;
    }

    if (this.hasProcedure) {
      await this.#executeProcedure();
      return;
    }

    this.#result = this.#instance ?? this.#relation ?? this.#root;
  }
}

/**
 * Invokes the behavior represented by a compiled route.
 *
 * Resolves root resources, relations, relation instances,
 * procedures, and conventional CRUD operations before
 * rendering the result using content negotiation.
 *
 * This method represents the execution boundary between the
 * HTTP resource model and the underlying object model.
 *
 * @param {RouteDefinition} route
 * Compiled route being executed.
 *
 * @param {RequestContext} ctx
 * Request execution context.
 *
 * @returns {Promise<Response>}
 * @see {@link RouteDefinition}
 * @see {@link RequestContext}
 * @see {@link ProcedureDefinition}
 * @see {@link RelationDefinition}
 * @see {@link IResourceView}
 */
export const invoke = async (route, ctx) => {
  try {
    const op = new ResourceOperation({ route, context: ctx });
    await op.initialize();
    await op.run();

    return op;
  } catch (ex) {
    console.error(
      `INTERNAL ERROR (Pistachio): **EXCEPTION ENCOUNTERED** during route invocation. See details -> ${ex.message} `
    );
    return new Response('INTERNAL ERROR', {
      status: 500,
    });
  }
};
