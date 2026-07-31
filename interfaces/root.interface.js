export class IAggregateRoot {
  /**
   * Invoked when one of the aggregate's subordinate
   * objects reports a state change.
   *
   * Concrete aggregate roots determine whether the
   * change requires persistence, publication,
   * projection updates, or other side effects.
   *
   * @param {Object} event
   * @returns {Promise<void>}
   */
  async notify(event) {
    throw new Error('Missing implementation');
  }
}
