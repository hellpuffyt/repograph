// Nothing in the project imports this module — a stale helper left behind
// after a refactor. repograph should flag both exports as dead.
export function legacyFormatter(value: string): string {
  return value.toUpperCase();
}

export const DEFAULT_LOCALE = "en-US";
