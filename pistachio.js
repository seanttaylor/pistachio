export class Pistachio {
  #routes = [];

  resource(path, resource, { writer, use = [], views = [] } = {}) {
    const routes = this.#compileResource(path, resource, {
      writer,
      use,
      views,
    });

    this.#routes.push(...routes);

    return routes;
  }

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
        return new Response('Not Found', {
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
          return new Response('Not Found', {
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
        return new Response('Not Found', {
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
      return new Response('Not Found', {
        status: 404,
      });
    }

    const view = this.#selectView(route, ctx.request);

    if (!view) {
      return new Response('Not Acceptable', {
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

  #selectView(route, req) {
    const accept = req.headers.get('accept');

    if (!accept || accept === '*/*') {
      return route.views['application/json'] ?? null;
    }

    return route.views[accept] ?? route.views['application/json'] ?? null;
  }

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

      return new Response('Method Not Allowed', {
        status: 405,

        headers: {
          Allow: allowedMethods.join(', '),
        },
      });
    } catch (ex) {
      console.error(ex);
    }
  }

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

/**
 * Parses a request body when present.
 *
 * @param {Request} req
 * @returns {Promise<?Object>}
 */
