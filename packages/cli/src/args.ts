/** Minimal, dependency-free CLI argument parsing tailored to repograph's few flags. */
export interface ParsedArgs {
  command: string | undefined;
  positionals: string[];
  flags: Map<string, string | boolean>;
}

const VALUE_FLAGS = new Set(["--out", "--entry", "--depth", "--port", "--file"]);

export function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const positionals: string[] = [];
  const flags = new Map<string, string | boolean>();

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i]!;
    if (token.startsWith("--")) {
      if (VALUE_FLAGS.has(token)) {
        const value = rest[i + 1];
        if (value === undefined || value.startsWith("--")) {
          throw new Error(`Flag ${token} requires a value.`);
        }
        flags.set(token, value);
        i += 1;
      } else {
        flags.set(token, true);
      }
    } else {
      positionals.push(token);
    }
  }

  return { command, positionals, flags };
}

export function getStringFlag(args: ParsedArgs, name: string): string | undefined {
  const value = args.flags.get(name);
  return typeof value === "string" ? value : undefined;
}

export function getBoolFlag(args: ParsedArgs, name: string): boolean {
  return args.flags.get(name) === true;
}
