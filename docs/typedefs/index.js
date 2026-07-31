/**
 * Conceptual representation of the resource graph generated
 * from a resource's HTTP definition.
 *
 * A resource topology consists of:
 *
 * - Aggregate roots
 * - Collection resources
 * - Resource instances
 * - Relations
 * - Nested relations
 * - Procedures attached to any node
 *
 * The topology is compiled into concrete
 * {@link RouteDefinition} instances during resource
 * registration.
 *
 * This typedef exists primarily for documentation purposes
 * and has no direct runtime representation.
 *
 * @typedef {Object} ResourceTopology
 *
 * @see {@link RelationDefinition}
 * @see {@link ProcedureDefinition}
 * @see {@link RouteDefinition}
 */

/**
 * The route invocation phase.
 *
 * Route invocation bridges the HTTP resource model and the
 * underlying object graph.
 *
 * During invocation Pistachio:
 *
 * 1. Resolves the target resource.
 * 2. Traverses relationships when present.
 * 3. Executes domain procedures when specified.
 * 4. Performs CRUD operations when applicable.
 * 5. Selects an appropriate representation.
 * 6. Produces an HTTP response.
 *
 * @typedef {Object} InvocationLifecycle
 */

/**
 * The request resolution lifecycle.
 *
 * During resolution Pistachio:
 *
 * 1. Matches the request URL against the compiled route graph.
 * 2. Determines whether a compatible HTTP method exists.
 * 3. Constructs a {@link RequestContext}.
 * 4. Executes middleware.
 * 5. Invokes the resolved resource behavior.
 * 6. Returns a rendered {@link Response}.
 *
 * @typedef {Object} ResolutionLifecycle
 */

/**
 * An object that acts as the main entry point for
 * accessing and modifying a group of related objects.
 *
 * Changes to related entities are typically coordinated
 * through the aggregate root.
 * 
 * Within Pistachio, aggregate roots commonly become top-level
 * HTTP resources from which nested relations and procedures
 * are exposed.
 *
 * Aggregate roots are a concept from Domain-Driven Design
 * and should _not_ be confused with:
 *
 * - the persistence model,
 * - the object graph,
 * - or the HTTP resource topology.
 *
 * A resource may expose relationships that do not directly
 * correspond to object ownership and vice versa.
 *
 * @typedef {Object} AggregateRoot
 *
 * @property {string} id
 * Unique identifier for the aggregate.
 *
 * @note Think of an aggregate root as the "parent" object
 * responsible for coordinating a set of related objects
 * 
 * @example
 * // Feed is the aggregate root.
 * //
 * // /feeds/:id
 * // /feeds/:id/subscriptions
 * // /feeds/:id/subscriptions/:subId
 *
 * class Feed {
 *   get subscriptions() {
 *     return this.#subscriptions;
 *   }
 * }
 *
 * @see {@link ResourceTopology}
 * @see {@link RelationDefinition}
 * @see {@link ResourceInstance}
 */