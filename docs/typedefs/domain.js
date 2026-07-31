/**
 * Declarative description of a domain procedure exposed as an
 * HTTP operation.
 *
 * Procedures represent behavior rather than state and are
 * attached either to root resources or relations.
 *
 * @typedef {Object} ProcedureDefinition
 *
 * @property {string} method
 * HTTP method used to invoke the procedure.
 *
 * @property {boolean} [instance=false]
 * Indicates whether the procedure operates on a specific
 * resource instance rather than a collection.
 *
 * @property {?Object} [interface=null]
 * Projection describing how request data should be mapped
 * into procedure arguments.
 *
 * @see {@link RouteDefinition}
 * @see {@link RequestContext}
 */