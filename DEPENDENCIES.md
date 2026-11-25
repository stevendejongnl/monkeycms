# Dependency policy

MonkeyCMS uses as few dependencies as possible, and keeps all of them on the latest version.

## Rules

1. **Platform first.** Use web platform features and Node built-ins before you add a package.
2. **Every dependency needs a reason.** Add it to the table below, with one line that says why the platform or a built-in is not enough.
3. **Latest versions only.** Use the latest stable major of every dependency. Set `engines.node` to the current Node LTS.
4. **No code in config.** This is a security rule, not a dependency rule: MonkeyCMS never runs `eval` or `Function` on a mapping config.
5. **Native CSS.** Use CSS nesting, custom properties and grid. Do not use Sass.
6. **Keep it checked.** A scheduled CI job runs `npm outdated` and `npm audit`, and fails when a package is behind or has a known vulnerability (tracked in MONKY-5).

## Current set

### Runtime

| Package | Reason |
|---------|--------|
| `lit` | Small and stable. It gives templating and reactive properties, so we do not write and test our own rendering code. |

Signals are not a dependency. `src/base/signals/signals.ts` has a small signal, computed and effect. Replace it with the TC39 Signals proposal when browsers ship it.

The decision to keep Lit is provisional. To remove it, replace it with plain custom elements and a small base class in this repository.

### Development

| Package | Reason |
|---------|--------|
| `typescript` | Type checking, and compiling the CLI. |
| `esbuild` | Bundles the browser code and CSS into `dist/`. Plain `tsc` output cannot load `lit` in a browser without an import map. |
| `@playwright/test` | Component tests in Chromium, Firefox and WebKit. |
| `@types/node` | Types for the CLI, the build scripts and the unit tests. |

Logic tests use `node:test`. No other package is needed for tests.

### Linting

There is no ESLint. `typescript-eslint` does not support TypeScript 7 yet (its peer range is `typescript <6.1.0`), and TypeScript 7 is the latest version. For now the strict compiler flags in `tsconfig.json` are the lint step (`npm run typecheck`). Add ESLint back when `typescript-eslint` supports TypeScript 7.

### Replaced by built-ins

| Old package | Replacement |
|-------------|-------------|
| `meow` | `node:util` `parseArgs` |
| `chalk` | `node:util` `styleText` |
| `rimraf` | `node:fs` `rm` |
| `http-server` | `scripts/static-server.mjs`, a small static server on `node:http` |
| `sass` | native CSS |
| `concurrently` | not needed |
| rollup and its plugins, `ts-patch`, `ts-node`, `typescript-transform-paths`, `@web/test-runner` and its plugins, `@open-wc/testing`, `stylelint` | `esbuild`, `tsc`, `node:test` and `@playwright/test` |

Node 26 (the current LTS) is the minimum version, set in `engines`.
