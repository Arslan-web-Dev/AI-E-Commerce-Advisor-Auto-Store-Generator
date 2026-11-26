/**
 * Minimal loader for Node's built-in TypeScript type stripping.
 * Resolves the project's `@/` aliases and extensionless relative imports to
 * source .ts files so tests can import the real modules without a bundler.
 */
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

registerHooks({
  resolve(specifier, context, nextResolve) {
    let target = null;

    if (specifier === 'server-only') {
      return {
        url: pathToFileURL(path.join(projectRoot, 'tests/helpers/server-only-stub.mjs')).href,
        shortCircuit: true,
      };
    }

    if (specifier.startsWith('@/')) {
      target = path.join(projectRoot, 'src', specifier.slice(2));
    } else if (specifier.startsWith('.') && context.parentURL) {
      target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    }

    if (target) {
      const candidates = [`${target}.ts`, `${target}.tsx`, path.join(target, 'index.ts')];
      const match = candidates.find(existsSync);
      if (match) {
        return { url: pathToFileURL(match).href, shortCircuit: true };
      }
    }

    return nextResolve(specifier, context);
  },
});
