import { defineMiddleware } from "astro:middleware";
import { bypassAuth } from "./lib/auth/bypass";

export const onRequest = defineMiddleware(async (context, next) => {
  const user = await bypassAuth.resolveUser(
    context.request,
    context.locals.runtime.env,
  );

  if (user) {
    context.locals.user = user;
  }

  return next();
});
