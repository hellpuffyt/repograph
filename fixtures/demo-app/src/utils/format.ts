export function formatPath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

export function slugify(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, "-");
}
