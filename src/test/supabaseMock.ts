import { vi, type Mock } from "vitest";

export type MockResult<T = unknown> = { data: T; error: unknown };

const CHAIN_METHODS = [
  "select",
  "insert",
  "update",
  "upsert",
  "delete",
  "eq",
  "neq",
  "in",
  "order",
  "limit",
  "match",
] as const;

type ChainMethod = (typeof CHAIN_METHODS)[number];

export type QueryBuilder = Record<ChainMethod, Mock> & {
  single: Mock;
  maybeSingle: Mock;
  then: (
    resolve: (value: MockResult) => unknown,
    reject?: (reason: unknown) => unknown
  ) => Promise<unknown>;
};

/**
 * Builds a fake Supabase query-builder chain: every chain method returns
 * itself, and the builder is also thenable (so `await` works whether or
 * not the real call site adds `.single()`/`.maybeSingle()`).
 */
export const createQueryBuilder = (result: MockResult): QueryBuilder => {
  const builder = {} as QueryBuilder;

  for (const method of CHAIN_METHODS) {
    builder[method] = vi.fn(() => builder);
  }

  builder.single = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (
    resolve: (value: MockResult) => unknown,
    reject?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(resolve, reject);

  return builder;
};

export const okResult = <T>(data: T): MockResult<T> => ({ data, error: null });
export const errorResult = (message: string): MockResult<null> => ({
  data: null,
  error: { message },
});
