/**
 * Generates a version 4 UUID (same helper as before)
 * @returns {String}
 */
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
/**
 *
 */
export class SystemEvent extends CustomEvent {
  constructor(name, payload) {
    super(name, {
      detail: {
        header: {
          id: generateUUID(),
          timestamp: new Date().toISOString(),
          meta: { ...metadata, _open: {} },
          name,
        },
        payload,
      },
    });
  }

  get header() {
    return this.detail.header;
  }

  get payload() {
    return this.detail.payload;
  }
}

/******** EVENT IDENTIFIERS ********/
/**
 * Example enum of supported events
 * @readonly
 * @enum {string}
 */
export const Events = Object.freeze({
  SUBSCRIPTIONS_UPDATE: 'evt.feed.subscriptions.update',
  NOOP_EVENT: 'evt.system.noop',
});
