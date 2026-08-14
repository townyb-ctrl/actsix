/** Anything a `catch` can hand us, plus the `{ error }` shape Supabase returns. */
type MaybeError = unknown;

const errorMessage = (error: MaybeError): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const { message } = error as { message?: unknown };
    return typeof message === "string" ? message : "";
  }
  return "";
};

/** An error whose message our own edge function wrote, so it is safe to show as-is. */
export class EdgeFunctionError extends Error {}

/**
 * Supabase's `functions.invoke` reports every non-2xx as the useless
 * "Edge Function returned a non-2xx status code" and leaves the real
 * `{ error }` body unread in `error.context`. Read it so the user sees the
 * actual cause instead of a generic fallback.
 */
export const edgeFunctionError = async (error: MaybeError): Promise<MaybeError> => {
  const context = (error as { context?: unknown } | null)?.context;
  if (!(context instanceof Response)) return error;

  const payload = await context
    .clone()
    .json()
    .catch(() => null);
  const message = (payload as { error?: unknown } | null)?.error;

  return typeof message === "string" && message ? new EdgeFunctionError(message) : error;
};

const KNOWN_PATTERNS: Array<{ test: RegExp; message: string }> = [
  { test: /duplicate key|already exists/i, message: "That name is already in use. Try a different one." },
  { test: /permission denied|not authorized|row-level security/i, message: "You don't have permission to do that." },
  { test: /violates foreign key|foreign key constraint/i, message: "That item is still linked to something else and can't be removed yet." },
  { test: /network|failed to fetch|fetch failed/i, message: "Couldn't reach the server. Check your connection and try again." },
];

/**
 * Supabase/Postgres error messages are meant for developers, not the ministry
 * leaders using this app. Map known shapes to plain language; fall back to a
 * generic message rather than ever showing raw constraint/SQL text.
 */
export const friendlyErrorMessage = (
  error: MaybeError,
  fallback = "Something went wrong. Please try again."
): string => {
  if (error instanceof EdgeFunctionError) return error.message;

  const raw = errorMessage(error);
  return KNOWN_PATTERNS.find((pattern) => pattern.test.test(raw))?.message || fallback;
};
