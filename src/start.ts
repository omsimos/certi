import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";

import { errorNameAdapter } from "@/lib/error-adapter";
import { sanitizeError } from "@/server/sanitize-error";

const errorMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  try {
    return await next();
  } catch (err) {
    throw sanitizeError(err);
  }
});

export const startInstance = createStart(() => ({
  serializationAdapters: [errorNameAdapter],
  // Registering a start instance replaces the framework's default request middleware,
  // so the server-fn CSRF check it would otherwise apply has to be restated here.
  requestMiddleware: [createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" })],
  functionMiddleware: [errorMiddleware],
}));
