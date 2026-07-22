/**
 * Minimal persistence contract required by Pistachio.
 *
 * Storage providers form the collaboration boundary
 * between Networked Objects and underlying storage systems.
 *
 * Implementations may target databases, filesystems,
 * external APIs, object stores, or in-memory structures.
 *
 * Storage providers operate on representations rather than
 * fully constituted entity instances.
 *
 * @typedef {Object} StorageProvider
 * @property {(data: object) => Promise<?Object>} create
 * @property {(id: string) => Promise<?Object>} read
 * @property {(id: string, data: object) => Promise<?Object>} update
 * @property {(id: string) => Promise<void>} delete
 */
