import { dispatch } from "./actions";

export const cache = new Map<string, unknown>();

export function seed(): void {
  dispatch({ type: "init" });
}
