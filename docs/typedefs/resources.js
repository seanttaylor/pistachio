/**
 * Describes a renderable resource representation.
 *
 * Resource representations define how domain objects are
 * serialized into HTTP responses and participate in
 * content negotiation through their MIME type.
 *
 * @typedef {Object} ResourceRepresentation
 *
 * @property {string} name
 * Human-readable representation name.
 *
 * @property {string} contentType
 * MIME type produced by the representation
 * (e.g. `"application/json"`).
 *
 * @property {string} [version]
 * Optional representation version.
 *
 * @property {function(*): Response} [renderFn]
 * Rendering implementation used to transform a resource
 * into an HTTP response.
 */

/**
 * Represents an addressable resource instance within a 
 * {@link ResourceTopology}
 * A resource instance corresponds to a concrete entity
 * identified by an instance identifier (for example
 * `/feeds/:id` or `/feeds/:id/subscriptions/:subId`).
 *
 * Resource instances act as the attachment point for:
 *
 * - Nested {@link RelationDefinition Relations}
 * - {@link ProcedureDefinition Procedures}
 * - Conventional instance CRUD operations
 *
 * The term is conceptual and describes the semantics of a
 * URI segment _rather than_ a concrete runtime object.
 *
 * @typedef {Object} ResourceInstance
 *
 * @property {string} id
 * Unique identifier of the resource instance.
 *
 * @property {string} rel
 * Advisory relationship identifier describing the instance type.
 *
 * @property {Object.<string, *>} [attributes]
 * Arbitrary resource state represented by the instance.
 *
 * @see {@link RelationDefinition}
 * @see {@link ProcedureDefinition}
 */


/**
 * Declarative description of a navigable resource relation.
 *
 * Relations define subordinate resources exposed beneath an
 * aggregate root and may themselves expose procedures and
 * nested relations.
 *
 * @typedef {Object} RelationDefinition
 *
 * @property {string} accessor
 * Property or method used to resolve the relation from the
 * aggregate root.
 *
 * @property {boolean} [hasInstances=false]
 * Indicates whether the relation exposes addressable member
 * resources.
 *
 * @property {string} [id]
 * Name of the URL parameter used to identify relation
 * instances.
 *
 * @property {Function} resolve
 * Function responsible for resolving a relation instance
 * from the relation collection.
 *
 * @property {Object.<string, ProcedureDefinition>} [proc]
 * Procedures exposed by the relation.
 *
 * @property {Object.<string, RelationDefinition>} [rel]
 * Nested relations exposed beneath relation instances.
 *
 * @see {@link ProcedureDefinition}
 */

