import type { User } from "./types";
import { cache } from "../store/state";

export async function fetchUsers(): Promise<User[]> {
  const cached = cache.get("users");
  if (cached) return cached as User[];
  return [];
}
