/**
 * Request-scoped state object passed through the
 * middleware and invocation pipeline
 *
 * A request context is materialized during dispatch and
 * subsequently passed through middleware and route
 * invocation phases.
 *
 * @typedef {Object} RequestContext
 *
 * @property {Request} request
 * Original incoming HTTP request.
 *
 * @property {Object.<string, string>} params
 * Route parameters extracted from the matched URL pattern.
 *
 * @property {?Object} body
 * Parsed request payload, or `null` when no payload
 * was supplied.
 *
 * @property {Object.<string, string>} query
 * Query string parameters associated with the request.
 *
 * @property {RouteDefinition} route
 * Route definition currently being executed.
 */

/**
 * Request middleware executed during route dispatch.
 *
 * @callback Middleware
 *
 * @param {RequestContext} ctx
 * @param {function(): Promise<Response>} next
 *
 * @returns {Promise<Response>}
 */

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

