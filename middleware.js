/** @type {Middleware} */
export async function logger(ctx, next) {
  const response = await next();
  return response;
}
