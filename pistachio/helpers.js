const findPath = (obj, key, current = '') => {
  if (!obj || typeof obj !== 'object') {
    return null;
  }

  if (Object.hasOwn(obj, key)) {
    return `${current}/${key}`;
  }

  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'object') {
      const result = findPath(v, key, `${current}/${k}`);

      if (result) {
        return result;
      }
    }
  }

  return null;
};

export const computePatch = (candidate, schema) => {
  const patch = [];

  for (const key of Object.keys(schema.properties)) {
    const from = findPath(candidate, key);

    if (!from) {
      continue;
    }

    patch.push({
      op: 'copy',
      from,
      path: `/${key}`,
    });
  }

  return patch;
};
