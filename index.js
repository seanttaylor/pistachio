export class Pistachio {
  /**
   * @type {RouteDefinition[]}
   */
  #routes = [];

  /**
   * Registers a resource.
   *
   * @param {string} path
   * @param {Object} resource
   * @param {Object} options
   * @returns {RouteDefinition[]}
   */
  resource(path, resource, options = {}) {
    const routes = this.#compileResource(path, resource, options);

    this.#routes.push(...routes);

    return routes;
  }

  /**
   * Compiles a resource into route definitions.
   *
   * @param {string} path
   * @param {Object} resource
   * @param {Object} options
   * @returns {RouteDefinition[]}
   */
  #compileResource(
    path,
    resource,
    { collection = false, allowedMethods = [], use = [], views = [] } = {}
  ) {
    const routes = [];
    const methods =
      allowedMethods.length > 0
        ? allowedMethods
        : ['GET', 'POST', 'PUT', 'DELETE'];
    const viewMap = Object.fromEntries(
      views.map((view) => [view.contentType, view])
    );

    //
    // Collection routes.
    //
    if (collection) {
      const collectionOperations = {
        POST: {
          path,
          resource,
          use,
          views: viewMap,
          allowedMethods: methods,
          collection: true,
          operation: 'create',
          pattern: new URLPattern({ pathname: path }),
          rel: 'create',
        },

        GET: {
          path,
          resource,
          use,
          views: viewMap,
          allowedMethods: methods,
          collection: true,
          operation: 'read',
          pattern: new URLPattern({ pathname: path }),
          rel: 'read',
        },

        PUT: {
          path,
          resource,
          use,
          views: viewMap,
          allowedMethods: methods,
          collection: true,
          operation: 'update',
          pattern: new URLPattern({ pathname: path }),
          rel: 'update',
        },

        DELETE: {
          path,
          resource,
          use,
          views: viewMap,
          allowedMethods: methods,
          collection: true,
          operation: 'delete',
          pattern: new URLPattern({ pathname: path }),
          rel: 'delete',
        },
      };

      for (const method of methods) {
        const definition = collectionOperations[method];

        if (!definition) {
          continue;
        }

        routes.push({
          method,
          ...definition,
        });

        //
        // GET gets both collection and member routes.
        //
        if (method === 'GET') {
          routes.push({
            resource,
            use,
            allowedMethods: methods,
            views: viewMap,
            method: 'GET',
            operation: 'read',
            path: `${path}/:id`,
            pattern: new URLPattern({ pathname: `${path}/:id` }),
            rel: 'read',
          });
        }
      }
    }

    //
    // Resource-defined routes.
    //
    const definitions = resource.constructor.HTTP ?? {};

    for (const [operation, definition] of Object.entries(definitions)) {
      routes.push({
        resource,
        operation,
        use,
        views: viewMap,
        allowedMethods: methods,
        method: definition.method,
        path: `${path}/:id${definition.path}`,
        pattern: new URLPattern({ pathname: `${path}/:id${definition.path}` }),
        rel: definition.rel,
      });
    }

    return routes;
  }

  /**
   * Selects the most appropriate resource view for the request.
   *
   * @param {RouteDefinition} route
   * @param {Request} req
   * @returns {?IResourceView}
   */
  #selectView(route, req) {
    const accept = req.headers.get('accept');

    if (!accept || accept === '*/*') {
      return route.views['application/json'] ?? null;
    }

    return route.views[accept] ?? route.views['application/json'] ?? null;
  }

  async #dispatch(route, req, match) {
    const ctx = {
      request: req,
      params: match.pathname.groups,
      body: await this.#parseBody(req),
      route,
    };

    return this.#pipeline(route.use, ctx, () => this.#invoke(route, ctx));
  }

  /**
   * Executes a middleware pipeline.
   *
   * @param {Function[]} middleware
   * @param {Object} ctx
   * @param {Function} terminal
   * @returns {Promise<Response>}
   */
  async #pipeline(middleware, ctx, terminal) {
    let index = -1;

    const run = async (i) => {
      if (i <= index) {
        throw new Error('next() called multiple times');
      }

      index = i;

      if (i === middleware.length) {
        return terminal();
      }

      const fn = middleware[i];

      try {
        return await fn(ctx, () => run(i + 1));
      } catch (ex) {
        console.error(
          `INTERNAL ERROR (Pistachio): ***EXCEPTION ENCOUNTERED*** while executing middleware (${fn.name}). See details -> ${ex.message}`
        );

        return new Response('{}', {
          status: 500,
          statusText: 'INTERNAL ERROR',
        });
      }
    };

    return run(0);
  }

  /**
   * Parses a request body when present.
   *
   * @param {Request} req
   * @returns {Promise<?Object>}
   */
  async #parseBody(req) {
    if (req.method === 'GET') {
      return null;
    }

    const contentLength = req.headers.get('content-length');

    if (contentLength === '0') {
      return null;
    }

    return req.json();
  }

  async #invoke(route, ctx) {
    const result = await route.resource[route.operation]({
      //params: ctx.params,
      ...ctx.body,
      //request: ctx.request,
    });

    const record = await route.resource[route.rel](result);
    const view = this.#selectView(route, ctx.request);

    if (!view) {
      return new Response('Not Acceptable', {
        status: 406,
        statusText: 'NOT ACCEPTABLE',
      });
    }

    return view.render(record);
  }

  /**
   * Resolves an incoming request to a route.
   *
   * @param {Request} req
   * @returns {Promise<Response>}
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

      //
      // No matching resource.
      //
      if (candidates.length === 0) {
        return new Response('Not Found', {
          status: 404,
          statusText: 'NOT FOUND',
        });
      }

      //
      // Matching resource and method.
      //
      for (const candidate of candidates) {
        if (candidate.route.method === req.method) {
          return this.#dispatch(candidate.route, req, candidate.match);
        }
      }

      //
      // Matching resource, unsupported method.
      //
      const { allowedMethods } = candidates[0].route;

      return new Response('Method Not Allowed', {
        status: 405,
        statusText: 'METHOD NOT ALLOWED',
        headers: {
          Allow: allowedMethods.join(', '),
        },
      });
    } catch (ex) {
      console.error(
        `INTERNAL ERROR (Pistachio): ***EXCEPTION ENCOUNTERED*** while resolving request. See details -> ${ex.message}`
      );
    }
  }
}

/**
 * A compiled route definition produced by {@link Pistachio#resource}.
 *
 * Route definitions are the internal representation of HTTP resources.
 * They are generated once during resource registration and consumed by the
 * request resolver and dispatcher at runtime.
 *
 * @typedef {Object} RouteDefinition
 *
 * @property {string} method
 * The HTTP method handled by this route (e.g. `"GET"`, `"POST"`).
 *
 * @property {string} path
 * The route template used when registering the resource.
 *
 * @property {URLPattern} pattern
 * Compiled URL pattern used during request resolution.
 *
 * @property {Object} resource
 * The resource instance responsible for handling the request.
 *
 * @property {string} operation
 * The resource method invoked when this route is dispatched.
 *
 * @property {string} rel
 * The CRUD relationship describing how the result of the domain operation
 * should be persisted. This corresponds to a persistence method exposed by
 * the resource (typically `create`, `read`, `update`, `delete`, or `noop`).
 *
 * @property {boolean} [collection=false]
 * Indicates that the route was automatically generated as part of a
 * collection resource.
 *
 * @property {string[]} allowedMethods
 * The HTTP methods permitted for the resource. Used to determine whether
 * requests should result in `405 Method Not Allowed` responses and to
 * generate the `Allow` response header.
 *
 * @property {Function[]} use
 * Middleware executed before the route is invoked.
 *
 * @property {Object.<string, IResourceView>} views
 * Resource representations keyed by MIME type (for example
 * `"application/json"`). Used during content negotiation.
 */
