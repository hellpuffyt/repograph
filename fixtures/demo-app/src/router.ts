import { formatPath } from "./utils/format";

export interface Router {
  register(path: string, handler: () => void): void;
}

export function createRouter(): Router {
  const routes = new Map<string, () => void>();
  return {
    register(path, handler) {
      routes.set(formatPath(path), handler);
    },
  };
}
