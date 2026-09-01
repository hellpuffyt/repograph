import ts from "typescript";
import type { ExportInfo, ExportKind, ParsedModule, RawImport } from "./types.js";

function scriptKindFor(path: string): ts.ScriptKind {
  if (path.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (path.endsWith(".ts")) return ts.ScriptKind.TS;
  if (path.endsWith(".jsx")) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

function lineOf(sf: ts.SourceFile, node: ts.Node): number {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

function truncate(text: string, max = 100): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

function signatureOf(sf: ts.SourceFile, node: ts.Node): string {
  return truncate(node.getText(sf));
}

/**
 * Parse a single source file's text into its import and export facts.
 * This is a syntactic pass only (no type checker, no cross-file resolution)
 * so it stays fast and works uniformly across .ts/.tsx/.js/.jsx.
 */
export function parseModule(path: string, sourceText: string): ParsedModule {
  const sf = ts.createSourceFile(path, sourceText, ts.ScriptTarget.Latest, true, scriptKindFor(path));

  const exports: ExportInfo[] = [];
  const imports: RawImport[] = [];

  function pushImport(specifier: string, node: ts.Node, partial: Partial<RawImport>): void {
    imports.push({
      specifier,
      line: lineOf(sf, node),
      isTypeOnly: false,
      importedNames: [],
      importsDefault: false,
      importsNamespace: false,
      ...partial,
    });
  }

  function kindOfDeclaration(node: ts.Node): ExportKind {
    if (ts.isFunctionDeclaration(node)) return "function";
    if (ts.isClassDeclaration(node)) return "class";
    if (ts.isInterfaceDeclaration(node)) return "interface";
    if (ts.isTypeAliasDeclaration(node)) return "type";
    if (ts.isEnumDeclaration(node)) return "enum";
    return "unknown";
  }

  function visit(node: ts.Node): void {
    // import ... from "specifier"; also covers `import type`
    if (ts.isImportDeclaration(node)) {
      const specifier = ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : "";
      if (!specifier) return;
      const isTypeOnly = !!node.importClause?.isTypeOnly;
      const importedNames: string[] = [];
      let importsDefault = false;
      let importsNamespace = false;
      const clause = node.importClause;
      if (clause) {
        if (clause.name) importsDefault = true;
        const bindings = clause.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings)) {
          importsNamespace = true;
        } else if (bindings && ts.isNamedImports(bindings)) {
          for (const el of bindings.elements) {
            importedNames.push((el.propertyName ?? el.name).text);
          }
        }
      }
      pushImport(specifier, node, { isTypeOnly, importedNames, importsDefault, importsNamespace });
      return;
    }

    // export { a, b } from "specifier";  /  export * from "specifier"; / export * as ns from "specifier"
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      const isTypeOnly = node.isTypeOnly;
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        const importedNames = node.exportClause.elements.map((el) => (el.propertyName ?? el.name).text);
        pushImport(specifier, node, { isTypeOnly, importedNames });
        for (const el of node.exportClause.elements) {
          exports.push({
            name: el.name.text,
            kind: "unknown",
            line: lineOf(sf, el),
            signature: signatureOf(sf, node),
            isDefault: el.name.text === "default",
          });
        }
      } else {
        // export * from "x" — re-export everything; conservatively mark as a namespace-ish dependency.
        pushImport(specifier, node, { isTypeOnly, importsNamespace: true });
      }
      return;
    }

    // export { a, b };  (local re-export, no module specifier)
    if (ts.isExportDeclaration(node) && !node.moduleSpecifier && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const el of node.exportClause.elements) {
        exports.push({
          name: el.name.text,
          kind: "unknown",
          line: lineOf(sf, el),
          signature: signatureOf(sf, node),
          isDefault: el.name.text === "default",
        });
      }
      return;
    }

    // export default <expr | function | class>;
    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      exports.push({
        name: "default",
        kind: ts.isFunctionExpression(node.expression) || ts.isArrowFunction(node.expression)
          ? "function"
          : ts.isClassExpression(node.expression)
            ? "class"
            : "unknown",
        line: lineOf(sf, node),
        signature: signatureOf(sf, node),
        isDefault: true,
      });
      return;
    }

    // export function/class/interface/type/enum NAME ...
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    const isExported = !!modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const isDefaultMod = !!modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
    if (isExported) {
      if (
        ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isEnumDeclaration(node)
      ) {
        const name = node.name?.text ?? "default";
        exports.push({
          name: isDefaultMod ? "default" : name,
          kind: kindOfDeclaration(node),
          line: lineOf(sf, node),
          signature: signatureOf(sf, node),
          isDefault: isDefaultMod,
        });
      } else if (ts.isVariableStatement(node)) {
        const kind: ExportKind = node.declarationList.flags & ts.NodeFlags.Const
          ? "const"
          : node.declarationList.flags & ts.NodeFlags.Let
            ? "let"
            : "var";
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            exports.push({
              name: decl.name.text,
              kind,
              line: lineOf(sf, decl),
              signature: signatureOf(sf, decl),
              isDefault: false,
            });
          }
        }
      }
    }

    // require("specifier") and dynamic import("specifier") anywhere in the file.
    if (ts.isCallExpression(node)) {
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      if ((isRequire || isDynamicImport) && node.arguments.length > 0) {
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteral(arg)) {
          pushImport(arg.text, node, {});
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sf);

  return {
    path,
    exports,
    imports,
    lineCount: sourceText.split("\n").length,
  };
}
