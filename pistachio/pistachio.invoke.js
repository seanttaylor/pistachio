import * as jsonpatch from 'fast-json-patch';
import { computePatch } from './helpers.js';

/**
 * Represents a single HTTP resource operation executing within the
 * Pistachio routing pipeline.
 *
 * A `ResourceOperation` encapsulates all state associated with processing
 * an incoming request, including the compiled route, request context,
 * resolved resource graph, invocation target, and operation result.
 *
 * During initialization the operation locates the root resource, resolves
 * any requested relations or relation instances, and prepares the object
 * graph required to execute the route. It then dispatches either a
 * procedure or a conventional CRUD operation and captures the resulting
 * representation for rendering.
 *
 * By centralizing execution state and behavior, `ResourceOperation`
 * isolates route execution from the router itself, allowing the router to
 * remain a thin coordinator concerned only with request dispatch,
 * response negotiation, and error handling.
 *
 * @see {@link RouteDefinition}
 * @see {@link RequestContext}
 */
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

  /**
   * Indicates whether the current operation targets a resource relation.
   *
   * Relation-backed operations include nested resources such as
   * `/feeds/:id/subscriptions` and
   * `/feeds/:id/subscriptions/:subId`.
   *
   * @returns {boolean}
   * `true` when the compiled route references a relation.
   */
  get hasRelation() {
    return Boolean(this.#route.relation);
  }

  /**
   * Indicates whether the current operation invokes a procedure
   * rather than performing conventional CRUD.
   *
   * @returns {boolean}
   * `true` when the compiled route defines a procedure.
   */
  get hasProcedure() {
    return Boolean(this.#route.proc);
  }

  /**
   * Indicates whether the operation has successfully attached
   * to a root resource instance.
   *
   * A missing root typically means the requested resource could
   * not be found or the operation targets a collection rather
   * than a specific instance.
   *
   * @returns {boolean}
   * `true` when a root resource has been initialized.
   */
  get hasRoot() {
    return Boolean(this.#root);
  }

  /**
   * Indicates whether the operation requires resolution of a
   * relation instance.
   *
   * Instance-backed routes include paths such as
   * `/feeds/:id/subscriptions/:subId`.
   *
   * @returns {boolean}
   * `true` when the compiled route targets a relation instance.
   */
  get requiresInstance() {
    return Boolean(this.#route.instance);
  }

  /**
   * Returns the current result produced by the operation.
   *
   * The result is populated during initialization, procedure
   * execution, or resource resolution and is ultimately rendered
   * as the HTTP response.
   *
   * @returns {*}
   * The current operation result.
   */
  get result() {
    return this.#result;
  }

  // get hasError() {}

  // get hasTarget() {}

  /**
   * Selects the object that will receive the procedure invocation.
   *
   * Procedure receivers are determined by the route's `on` directive,
   * allowing behavior to execute against the root resource, a resolved
   * relation instance, or the relation itself. When no receiver is
   * explicitly specified, the relation is used by default.
   *
   * @returns {*}
   * The object that should receive the procedure invocation, or
   * `undefined` if the selected target has not been resolved.
   */
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

  /**
   * Translates the current request context into the argument object
   * supplied to a procedure invocation.
   *
   * By default, procedure arguments are composed from the request's
   * path parameters, query parameters, and body. When the route
   * defines an interface mapping, the request context is transformed
   * into the procedure's expected shape using a JSON Patch mapping
   * before invocation.
   *
   * @returns {Object}
   * Procedure arguments derived from the current request context.
   *
   * @see {@link RequestContext}
   * @see {@link ProcedureDefinition}
   */
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

  /**
   * Executes the procedure represented by the current operation.
   *
   * Translates the request context into procedure arguments, resolves
   * the appropriate invocation target, invokes the procedure, and
   * captures its result for subsequent response rendering.
   *
   * If the configured procedure target cannot be resolved, no
   * invocation is performed.
   *
   * @returns {Promise<void>}
   * Resolves once the procedure has completed and the operation
   * result has been recorded.
   *
   * @see {@link ProcedureDefinition}
   */
  async #executeProcedure() {
    const args = this.#translateRequestContext();
    const target = this.#getProcedureTarget();

    if (!target) {
      return;
    }

    const result = await target[this.#route.proc](
      args,
      this.#root,
      this.#root.constructor
    );

    this.#result = [result];
  }

  /**
   * Resolves the relation associated with the current operation.
   *
   * Evaluates deferred relation accessors, if necessary, and resolves
   * a specific relation instance when the compiled route targets an
   * instance resource. Resolved relation state is retained by the
   * operation for subsequent procedure execution or resource retrieval.
   *
   * @returns {Promise<void>}
   * Resolves once the relation and, when applicable, its corresponding
   * instance have been initialized.
   *
   * @see {@link RelationDefinition}
   */
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

  /**
   * Initializes the root resource associated with the current operation.
   *
   * If the request targets a resource instance, the root object is
   * retrieved from the underlying resource and, when applicable, its
   * requested relation is attached to the operation for subsequent
   * relation resolution.
   *
   * Collection operations, which do not identify a root resource,
   * leave the operation uninitialized.
   *
   * @returns {Promise<void>}
   * Resolves once the root resource and its relation, if present,
   * have been initialized.
   */
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

  /**
   * Initializes the execution state for the current resource operation.
   *
   * Establishes the operation's execution context by resolving the
   * root resource and any requested relation. When the operation
   * targets a collection rather than an existing resource instance,
   * performs the required collection-level initialization (such as
   * collection retrieval or resource creation) and records the
   * resulting operation state.
   *
   * Upon completion, the operation is fully initialized and ready
   * for execution via {@link ResourceOperation#run}.
   *
   * @returns {Promise<void>}
   * Resolves once the operation has been initialized.
   *
   * @see {@link ResourceOperation#run}
   */
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

  /**
   * Executes the initialized resource operation.
   *
   * Performs the behavior represented by the operation after
   * initialization has completed. Depending on the operation
   * metadata, this may invoke a resource procedure or return
   * the resolved resource, relation, or relation instance.
   *
   * Operations whose result was established during
   * initialization (such as collection retrieval or resource
   * creation) complete without further execution.
   *
   * @returns {Promise<void>}
   * Resolves once the operation has completed and a result,
   * if any, has been recorded.
   *
   * @see {@link ResourceOperation#initialize}
   */
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
  const op = new ResourceOperation({ route, context: ctx });
  await op.initialize();
  await op.run();

  return op;
};
