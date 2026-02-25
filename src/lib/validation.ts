/**
 * Request/response validation schemas and API envelope helpers.
 *
 * Provides Zod schemas for validating API request bodies (server-side) and
 * parsing API response JSON (client-side). Also exports the `apiSuccess` /
 * `apiError` envelope constructors used by all API routes, and the `fetchApi`
 * typed fetch wrapper used by React islands.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Request schemas (used by API routes to validate incoming JSON bodies)
// ---------------------------------------------------------------------------

/** Schema for `POST /api/v1/diagrams` request body. */
export const CreateDiagramSchema = z.object({
  /** Diagram title. Defaults to "Untitled Diagram" server-side if omitted. */
  title: z.string().min(1).max(255).optional(),
  /** Optional free-text description. */
  description: z.string().max(2000).optional(),
  /** Slug of a blueprint template to clone graph data from. */
  blueprintId: z.string().optional(),
});

/** Schema for `PATCH /api/v1/diagrams/:id` request body. */
export const UpdateDiagramSchema = z.object({
  /** New title for the diagram. */
  title: z.string().min(1).max(255).optional(),
  /** New description. Send `null` to clear. */
  description: z.string().max(2000).nullable().optional(),
});

/** Schema for `PUT /api/v1/diagrams/:id/graph` request body. */
export const SaveGraphSchema = z.object({
  /** Full JSON-serialised React Flow state (nodes, edges, viewport). */
  graphData: z.string(),
});

/** Schema for `POST /api/v1/diagrams/:id/share` request body. */
export const CreateShareSchema = z.object({
  /** Optional TTL in seconds for the share link. Omit for no expiry. */
  expiresIn: z.number().int().positive().optional(),
});

/** Inferred TypeScript type for a create-diagram request. */
export type CreateDiagramInput = z.infer<typeof CreateDiagramSchema>;
/** Inferred TypeScript type for an update-diagram request. */
export type UpdateDiagramInput = z.infer<typeof UpdateDiagramSchema>;
/** Inferred TypeScript type for a save-graph request. */
export type SaveGraphInput = z.infer<typeof SaveGraphSchema>;
/** Inferred TypeScript type for a create-share request. */
export type CreateShareInput = z.infer<typeof CreateShareSchema>;

// ---------------------------------------------------------------------------
// Response envelope (used by API routes to build JSON responses)
// ---------------------------------------------------------------------------

/**
 * Wrap a successful result in the standard API envelope.
 *
 * @param data - The payload to include in the response.
 * @returns `{ ok: true, data }`.
 */
export function apiSuccess<T>(data: T) {
  return { ok: true as const, data };
}

/**
 * Build a standard API error envelope with an HTTP status code.
 *
 * @param code    - Machine-readable error code (e.g. "NOT_FOUND").
 * @param message - Human-readable error description.
 * @param status  - HTTP status code. Defaults to 400.
 * @returns An object with `body` (the JSON envelope) and `status`.
 */
export function apiError(code: string, message: string, status = 400) {
  return {
    body: { ok: false as const, error: { code, message } },
    status,
  };
}

// ---------------------------------------------------------------------------
// Response schemas (used by client-side code to parse and validate responses)
// ---------------------------------------------------------------------------

/** Zod schema for the error half of the API envelope. */
const ApiErrorSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

/**
 * Build a discriminated-union Zod schema for a typed API response.
 *
 * The resulting schema matches either `{ ok: true, data: T }` (success) or
 * `{ ok: false, error: { code, message } }` (failure), allowing callers to
 * narrow the type via the `ok` discriminator.
 *
 * @param dataSchema - Zod schema for the success payload `data` field.
 * @returns A Zod discriminated union schema keyed on `ok`.
 */
function apiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  const success = z.object({ ok: z.literal(true), data: dataSchema });
  return z.discriminatedUnion("ok", [success, ApiErrorSchema]);
}

/** Zod schema for a single diagram row as returned by the API. */
export const DiagramSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  graphData: z.string(),
  thumbnailKey: z.string().nullable(),
  blueprintId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** TypeScript type for a diagram, derived from `DiagramSchema`. */
export type Diagram = z.infer<typeof DiagramSchema>;

/** Response schema for `GET /api/v1/diagrams` (array of diagrams). */
export const DiagramListResponseSchema = apiResponseSchema(
  z.array(DiagramSchema),
);

/** Response schema for single-diagram endpoints (GET, POST, PATCH). */
export const DiagramResponseSchema = apiResponseSchema(DiagramSchema);

/**
 * Discriminated union representing any API response.
 *
 * Check `result.ok` to narrow: if `true`, `result.data` is `T`;
 * if `false`, `result.error` has `code` and `message`.
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

/**
 * Type-safe fetch wrapper that validates response JSON against a Zod schema.
 *
 * Performs a standard `fetch`, parses the JSON body, and validates it through
 * the provided schema. Throws a `ZodError` if the response shape is unexpected,
 * ensuring callers never operate on unvalidated data.
 *
 * @param input  - The URL or `Request` to fetch.
 * @param schema - A Zod schema describing the expected response shape.
 * @param init   - Optional `RequestInit` (method, headers, body, etc.).
 * @returns The parsed and validated API result as a discriminated union.
 * @throws {ZodError} If the response JSON does not match the schema.
 * @throws {TypeError} If the network request fails.
 */
export async function fetchApi<T>(
  input: RequestInfo | URL,
  schema: z.ZodType<ApiResult<T>>,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  const res = await fetch(input, init);
  const json: unknown = await res.json();
  return schema.parse(json);
}
