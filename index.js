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
          collection: true,
          operation: 'create',
          pattern: new URLPattern({ pathname: `${path}` }),
          rel: 'create',
        },

        GET: {
          path,
          resource,
          use,
          views: viewMap,
          collection: true,
          operation: 'read',
          pattern: new URLPattern({ pathname: `${path}` }),
          rel: 'read',
        },

        PUT: {
          resource,
          use,
          views: viewMap,
          operation: 'update',
          path: `${path}/:id`,
          pattern: new URLPattern({ pathname: `${path}/:id` }),
          rel: 'update',
        },

        DELETE: {
          resource,
          use,
          views: viewMap,
          operation: 'delete',
          path: `${path}/:id`,
          pattern: new URLPattern({ pathname: `${path}/:id` }),
          rel: 'delete',
        },
      };

      for (const method of allowedMethods) {
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
      });
    }

    return view.render(record);
  }

  async resolve(req) {
    try {
      for (const route of this.#routes) {
        if (route.method !== req.method) {
          continue;
        }
        const url = new URL(req.url);
        const match = route.pattern.exec(req.url);

        if (!match) {
          continue;
        }

        return this.#dispatch(route, req, match);
      }

      return new Response('Not Found', {
        status: 404,
      });
    } catch (ex) {
      console.error(
        `INTERNAL ERROR (Pistachio): ***EXCEPTION ENCOUNTERED*** while resolving request. See details -> ${ex.message}`
      );
    }
  }
}
