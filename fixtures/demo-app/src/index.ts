import { createRouter } from "./router";
import { fetchUsers } from "./api/client";

export function main(): void {
  const router = createRouter();
  router.register("/users", () => fetchUsers());
}
