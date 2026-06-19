export async function logger(ctx, next) {
  const start = Date.now();

  const response = await next();

  console.log(Date.now() - start);

  return response;
}
