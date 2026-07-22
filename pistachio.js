/**
 * Hypermedia resource router and runtime for exposing
 * domain objects as navigable HTTP resource topologies.
 *
 * Pistachio compiles resource metadata into executable
 * {@link RouteDefinition Routes}, resolves incoming
 * requests, executes middleware and domain behavior,
 * and renders negotiated representations through
 * {@link IResourceView Views}.
 *
 * The framework intentionally separates:
 *
 * - the HTTP resource model,
 * - the underlying object model, and
 * - the persistence model.
 *
 * Resources may expose conventional CRUD operations,
 * executable {@link ProcedureDefinition Procedures},
 * and recursively nested {@link RelationDefinition Relations}
 * without requiring direct correspondence to in-memory
 * object structure.
 *
 * @example
 * router.resource('/feeds', Feed, {
 *   writer: new MemoryFeedWriter(),
 *   views: [new ViewFeedJSON()]
 * });
 *
 * @see {@link RouteDefinition}
 * @see {@link RequestContext}
 * @see {@link RelationDefinition}
 * @see {@link ProcedureDefinition}
 * @see {@link ResourceTopology}
 * @see {@link IResourceView}
 */
export class Pistachio {
  #routes = [];

  /**
   * Registers a resource and compiles its HTTP topology
   * @param {string} path
   * @param {typeof Object} resource
   * @param {Object} [options]
   * @param {*} [options.writer]
   * @param {Function[]} [options.use=[]]
   * @param {IResourceView[]} [options.views=[]]
   * @returns {RouteDefinition[]}
   * @see {@link RouteDefinition}
   */
  resource(path, resource, { writer, use = [], views = [] } = {}) {
    const routes = this.#compileResource(path, resource, {
      writer,
      use,
      views,
    });

    this.#routes.push(...routes);

    return routes;
  }

  /**
   * Compiles a resource definition into an executable route graph.
   *
   * Generates CRUD routes, domain procedures, and recursively
   * defined relationship routes from a resource's HTTP metadata.
   * @param {string} root
   * Root collection path (e.g. `"/feeds"`).
   * 
   * @param {typeof Object} resource
   * Resource constructor being registered.
   *
   * @param {Object} [options]
   * @param {*} [options.writer]
   * Persistence backend attached to the resource.
   *
   * @param {Function[]} [options.use=[]]
   * Middleware applied to all compiled routes.
   *
   * @param {IResourceView[]} [options.views=[]]
   * Resource representations available during content negotiation.
   *
   * @returns {RouteDefinition[]}
   * Compiled routes for the resource topology.
   * @see {@link RouteDefinition}
   * @see {@link ProcedureDefinition}
   * @see {@link RelationDefinition}
   * @see {@link ResourceTopology}
   */
  #compileResource(root, resource, { writer, use = [], views = [] } = {}) {
    const routes = [];
    const http = resource.http ?? resource.HTTP ?? {};
    const methods = http.allowedMethods ?? ['GET', 'POST', 'PUT', 'DELETE'];
    const viewMap = Object.fromEntries(views.map((v) => [v.contentType, v]));

    resource.backend(writer);

    this.#compileCrud(routes, root, resource, methods, {
      writer,
      use,
      views: viewMap,
      allowedMethods: methods,
    });

    this.#compileProc(routes, root, resource, http.proc ?? {}, {
      writer,
      use,
      views: viewMap,
      allowedMethods: methods,
    });

    this.#compileRelations(routes, root, resource, http.rel ?? {}, {
      writer,
      use,
      views: viewMap,
      allowedMethods: methods,
    });

    return routes;
  }

  /**
   * Compiles conventional CRUD routes for a resource collection.
   *
   * Generates collection and instance endpoints based on the
   * HTTP methods permitted by the resource.
   * @param {RouteDefinition[]} routes
   * Route list.
   *
   * @param {string} root
   * Root collection path (e.g. `"/feeds"`).
   *
   * @param {typeof Object} resource
   * Resource constructor being instrumented.
   *
   * @param {string[]} methods
   * Allowed HTTP methods for the resource.
   *
   * @param {Object} shared
   * Shared route metadata applied to all generated routes.
   * @returns {void}
   * @see {@link RouteDefinition}
   * @see {@link ResourceTopology}
   */
  #compileCrud(routes, root, resource, methods, shared) {
    if (methods.includes('GET')) {
      routes.push({
        resource,
        method: 'GET',
        path: root,
        pattern: new URLPattern({
          pathname: root,
        }),

        instance: false,

        relation: null,

        proc: null,

        interface: null,

        ...shared,
      });

      routes.push({
        resource,
        method: 'GET',
        path: `${root}/:id`,
        pattern: new URLPattern({
          pathname: `${root}/:id`,
        }),

        instance: true,

        relation: null,

        proc: null,

        interface: null,

        ...shared,
      });
    }

    if (methods.includes('POST')) {
      routes.push({
        resource,
        method: 'POST',
        path: root,
        pattern: new URLPattern({
          pathname: root,
        }),

        instance: false,

        relation: null,

        proc: null,

        interface: null,

        ...shared,
      });
    }

    if (methods.includes('PUT')) {
      routes.push({
        resource,
        method: 'PUT',
        path: `${root}/:id`,
        pattern: new URLPattern({
          pathname: `${root}/:id`,
        }),

        instance: true,

        relation: null,

        proc: null,

        interface: null,

        ...shared,
      });
    }

    if (methods.includes('DELETE')) {
      routes.push({
        resource,
        method: 'DELETE',
        path: `${root}/:id`,
        pattern: new URLPattern({
          pathname: `${root}/:id`,
        }),

        instance: true,

        relation: null,

        proc: null,

        interface: null,

        ...shared,
      });
    }
  }

  /**
   * Compiles domain procedures into executable route definitions.
   *
   * Procedures represent behaviors exposed by a resource or relation
   * and map HTTP methods to object methods without affecting URL shape.
   *
   * @param {RouteDefinition[]} routes
   * Route list.
   *
   * @param {string} root
   * Resource path against which procedures are instrumented.
   *
   * @param {typeof Object} resource
   * Resource constructor being instrumented.
   *
   * @param {Object.<string, ProcedureDefinition>} proc
   * Procedure metadata keyed by object method name.
   *
   * @param {Object} shared
   * Shared route metadata applied to all generated routes.
   *
   * @returns {void}
   * @see {@link ProcedureDefinition}
   * @see {@link RouteDefinition}
   * @see {@link RelationDefinition}
  */
  #compileProc(routes, root, resource, proc, shared) {
    for (const [operation, definition] of Object.entries(proc)) {
      routes.push({
        resource,

        method: definition.method,

        path: root,

        pattern: new URLPattern({
          pathname: root,
        }),

        instance: !!definition.instance,

        relation: shared.relation ?? null,

        relationName: shared.relationName ?? null,

        proc: operation,

        interface: definition.interface ?? null,

        ...shared,
      });
    }
  }

  /**
   * Compiles relationship metadata into a recursive resource topology.
   *
   * Generates collection nodes, optional instance nodes, attaches
   * procedures to existing relation resources, and recursively
   * instruments nested relations.
   *
   * @param {RouteDefinition[]} routes
   * Route list.
   *
   * @param {string} root
   * Root path from which relation routes are generated.
   *
   * @param {typeof Object} resource
   * Resource constructor being instrumented.
   *
   * @param {Object.<string, RelationDefinition>} relations
   * Relation metadata keyed by relation name.
   *
   * @param {Object} shared
   * Shared route metadata applied to all generated routes.
   *
   * @returns {void}
   *
   * @see {@link RelationDefinition}
   * @see {@link RouteDefinition}
   * @see {@link ResourceInstance}
   * @see {@link ProcedureDefinition}
   */
  #compileRelations(routes, root, resource, relations, shared) {
    for (const [name, definition] of Object.entries(relations)) {
      //
      // Collection node
      //
      const collectionRoot = `${root}/:id/${name}`;

      routes.push({
        resource,

        method: 'GET',

        path: collectionRoot,

        pattern: new URLPattern({
          pathname: collectionRoot,
        }),

        instance: false,

        relation: definition,

        relationName: name,

        proc: null,

        interface: null,

        ...shared,
      });

      //
      // Instance node
      //
      let instanceRoot = null;

      if (definition.hasInstances) {
        const param = definition.id ?? `${name}Id`;

        instanceRoot = `${collectionRoot}/:${param}`;

        routes.push({
          resource,

          method: 'GET',

          path: instanceRoot,

          pattern: new URLPattern({
            pathname: instanceRoot,
          }),

          instance: true,

          relation: definition,

          relationName: name,

          proc: null,

          interface: null,

          ...shared,
        });
      }

      //
      // Procedures attach to existing topology.
      //
      for (const [operation, proc] of Object.entries(definition.proc ?? {})) {
        this.#compileProc(
          routes,

          proc.instance ? instanceRoot : collectionRoot,

          resource,

          {
            [operation]: proc,
          },

          {
            ...shared,

            relation: definition,

            relationName: name,
          }
        );
      }

      //
      // Nested relations recurse from the instance node
      //
      if (definition.rel && instanceRoot) {
        this.#compileRelations(
          routes,
          instanceRoot,
          resource,
          definition.rel,
          shared
        );
      }
    }
  }

  /**
   * Executes a middleware pipeline and ultimately invokes the
   * terminal route handler.
   *
   * Middleware is executed sequentially and receives a shared
   * {@link RequestContext} along with a `next()` callback used
   * to advance pipeline execution.
   *
   * Exceptions raised by middleware or route invocation are
   * converted into `500 Internal Error` responses.
   *
   * @param {Middleware[]} middleware
   * Ordered middleware chain.
   *
   * @param {RequestContext} ctx
   * Request execution context.
   *
   * @param {function(): Promise<Response>} terminal
   * Terminal route invocation executed once middleware has
   * completed.
   *
   * @returns {Promise<Response>}
   * @see {@link RequestContext}
   * @see {@link Middleware}
   * @see {@link RouteDefinition}
   */
  async #pipeline(middleware, ctx, terminal) {
    let index = -1;

    const run = async (i) => {
      if (i <= index) {
        throw new Error('next() called multiple times');
      }

      index = i;

      if (i === middleware.length) {
        try {
          return terminal();
        } catch(ex) {
          console.error(`INTERNAL ERROR (Pistachio): **EXCEPTION ENCOUNTERED** during route invocation (${ctx.route.path}) See details -> ${ex.message}`);
          return new Response('INTERNAL ERROR', {
            status: 500,
          });
        }
      }

      const fn = middleware[i];

      try {
        return await fn(ctx, () => run(i + 1));
      } catch (ex) {
        console.error(`INTERNAL ERROR (Pistachio): **EXCEPTION ENCOUNTERED** while executing the route (${ctx.route.path}) See details -> ${ex.message}`);

        return new Response('INTERNAL ERROR', {
          status: 500,
        });
      }
    };

    return run(0);
  }

  /**
   * Parses a request body when present.
   *
   * Requests that cannot legally contain a body, or explicitly
   * indicate an empty payload, resolve to `null`.
   *
   * @param {Request} req
   * Incoming HTTP request.
   *
   * @returns {Promise<?Object>}
   * Parsed request payload or `null`.
   * 
   * @see {@link RequestContext}
   */
  async #parseBody(req) {
    if (req.method === 'GET') {
      return null;
    }

    const length = req.headers.get('content-length');

    if (length === '0') {
      return null;
    }

    return req.json();
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
  async #invoke(route, ctx) {

    try {
    let result;
    let r;

    //
    // Relation routes
    //
    if (route.relation) {
      const root = await route.resource.findOne({
        id: ctx.params.id,
      });

      if (!root) {
        return new Response('NOT FOUND', {
          status: 404,
        });
      }

      let relation = root[route.relation.accessor];

      if (typeof relation === 'function') {
        relation = await relation.call(root);
      }

      //
      // Collection relation
      //
      if (!route.instance) {
        result = relation;
      }

      //
      // Relation instance
      //
      else {
        const key = route.relation.id || `${route.relationName}Id`;
        result = await route.relation.resolve(relation, ctx.params[key]);
      }

      //
      // Procedure on relation
      //
      if (route.proc) {
        if (!result) {
          return new Response('NOT FOUND', {
            status: 404,
          });
        }

        let args = ctx.body ?? {};

        if (route.interface) {
          const candidate = {
            params: ctx.params ?? {},

            body: ctx.body ?? {},

            query: ctx.query ?? {},

            headers: Object.fromEntries(ctx.request.headers.entries()),
          };

          const patch = computePatch(candidate, route.interface);

          args = jsonpatch.applyPatch({}, patch).newDocument;
        }

        result = await result[route.proc](args, root, root.constructor);
      }
    }

    //
    // Root procedures
    //
    else if (route.proc) {
      const resource = await route.resource.findOne({
        id: ctx.params.id,
      });

      if (!resource) {
        return new Response('NOT FOUND', {
          status: 404,
        });
      }

      let args = ctx.body ?? {};

      if (route.interface) {
        const candidate = {
          params: ctx.params ?? {},

          body: ctx.body ?? {},

          query: ctx.query ?? {},

          headers: Object.fromEntries(ctx.request.headers.entries()),
        };

        const patch = computePatch(candidate, route.interface);

        args = jsonpatch.applyPatch({}, patch).newDocument;
      }

      result = await resource[route.proc](args, root, root.constructor);
    }

    //
    // Collection CRUD
    //
    else if (!route.instance) {
      switch (route.method) {
        case 'GET':
          result = await route.resource.findAll(ctx.query);
          break;

        case 'POST':
          r = await route.resource.of({
            ...ctx.body,
            writer: route.writer,
          });

          result = [r];
          break;
      }
    }

    //
    // Instance CRUD
    //
    else {
      switch (route.method) {
        case 'GET':
          r = await route.resource.findOne({
            id: ctx.params.id,
          });

          result = [r];
          
          break;

        case 'PUT':
          r = await route.resource.updateOne(
            {
              id: ctx.params.id,
            },
            ctx.body
          );

          result = [r];
          break;

        case 'DELETE':
          result = await route.resource.deleteOne({
            id: ctx.params.id,
          });
          break;
      }
    }
    
    if (!result) {
      return new Response('NOT FOUND', {
        status: 404,
      });
    }

    const view = this.#selectView(route, ctx.request);

    if (!view) {
      return new Response('NOT ACCEPTABLE', {
        status: 406,
      });
    }

    return view.render(result);
    } catch(ex) {
      console.error(`INTERNAL ERROR (Pistachio): **EXCEPTION ENCOUNTERED** during route invocation. See details -> ${ex.message} `);
       return new Response('INTERNAL ERROR', {
        status: 500,
      });
    }
   
  }

  /**
   * Selects the most appropriate representation for a request.
   *
   * Uses the request's `Accept` header to perform simple
   * content negotiation, falling back to JSON when no
   * preference is supplied.
   *
   * @param {RouteDefinition} route
   * Compiled route definition.
   *
   * @param {Request} req
   * Incoming HTTP request.
   *
   * @returns {?IResourceView}
   * Selected representation or `null` if no suitable
   * representation exists.
   *
   * @see {@link RouteDefinition}
   * @see {@link IResourceView}
   */
  #selectView(route, req) {
    const accept = req.headers.get('accept');

    if (!accept || accept === '*/*') {
      return route.views['application/json'] ?? null;
    }

    return route.views[accept] ?? route.views['application/json'] ?? null;
  }

  /**
   * Resolves an incoming HTTP request to a compiled route.
   *
   * Performs route matching, method negotiation, and dispatches
   * execution to the middleware and invocation pipeline.
   *
   * Returns appropriate HTTP error responses when no matching
   * resource exists or when the target resource does not support
   * the requested method.
   *
   * @param {Request} req
   * Incoming HTTP request.
   *
   * @returns {Promise<Response>}
   *
   * @see {@link InvocationLifecycle}
   * @see {@link RouteDefinition}
   * @see {@link RequestContext}
   */
  async resolve(req) {
    try {
      const candidates = [];

      for (const route of this.#routes) {
        const match = route.pattern.exec(req.url);

        if (match) {
          candidates.push({
            route,
            match,
          });
        }
      }

      if (candidates.length === 0) {
        return new Response('Not Found', {
          status: 404,
        });
      }

      for (const candidate of candidates) {
        if (candidate.route.method === req.method) {
          return this.#dispatch(candidate.route, req, candidate.match);
        }
      }

      const { allowedMethods } = candidates[0].route;

      return new Response('METHOD NOT ALLOWED', {
        status: 405,

        headers: {
          Allow: allowedMethods.join(', '),
        },
      });
    } catch (ex) {
      console.error(ex);
    }
  }

  /**
   * Constructs a request execution context and dispatches the
   * request through the middleware and invocation pipeline.
   *
   * The dispatch phase materializes transient request state
   * (parameters, query values, body, route metadata) into a
   * {@link RequestContext} instance consumed throughout the
   * remainder of the request lifecycle.
   *
   * @param {RouteDefinition} route
   * Resolved route definition.
   *
   * @param {Request} req
   * Incoming HTTP request.
   *
   * @param {URLPatternResult} match
   * URL pattern match produced during route resolution.
   *
   * @returns {Promise<Response>}
   *
   * @see {@link RequestContext}
   * @see {@link RouteDefinition}
   * @see {@link InvocationLifecycle}
   * @see {@link ResolutionLifecycle}
   */
  async #dispatch(route, req, match) {
    const ctx = {
      request: req,

      params: match.pathname.groups,

      body: await this.#parseBody(req),

      query: Object.fromEntries(new URL(req.url).searchParams.entries()),

      route,
    };

    return this.#pipeline(route.use, ctx, () => this.#invoke(route, ctx));
  }
}

