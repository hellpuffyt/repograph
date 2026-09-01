import { cache } from "./state";

export interface Action {
  type: string;
}

export function dispatch(action: Action): void {
  cache.set("lastAction", action.type);
}
