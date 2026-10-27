import { createSerializationAdapter } from "@tanstack/react-router";

// Names the client branches on via `hasErrorName`.
const PUBLIC_ERROR_NAMES = [
  "NotFoundError",
  "ForbiddenError",
  "EventCodeTakenError",
  "ValidationError",
];

// The router's default error plugin sends only `message`, so without this the browser
// would see every server-fn failure as a bare `Error` and `hasErrorName` could never match.
export const errorNameAdapter = createSerializationAdapter({
  key: "app-error",
  test: (value): value is Error =>
    value instanceof Error && PUBLIC_ERROR_NAMES.includes(value.name),
  toSerializable: ({ name, message }) => ({ name, message }),
  fromSerializable: ({ name, message }) => {
    const error = new Error(message);
    error.name = name;
    return error;
  },
});
