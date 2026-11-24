# Dependency policy

MonkeyCMS uses as few dependencies as possible, and keeps all of them on the latest version.

## Rules

1. **Platform first.** Use web platform features and Node built-ins before you add a package.
2. **Every dependency needs a reason.** Add it to the table below, with one line that says why the platform or a built-in is not enough.
3. **Latest versions only.** Use the latest stable major of every dependency. Set `engines.node` to the current Node LTS.
4. **No code in config.** This is a security rule, not a dependency rule: MonkeyCMS never runs `eval` or `Function` on a mapping config.
5. **Native CSS.** Use CSS nesting, custom properties and grid. Do not use Sass.
6. **Keep it checked.** A scheduled CI job runs `npm outdated` and `npm audit`, and fails when a package is behind or has a known vulnerability (tracked in MONKY-5).

## Target set

### Runtime

| Package | Reason |
|---------|--------|
| `lit` | Small and stable. It gives templating and reactive properties, so we do not write and test our own rendering code. |

This is the only runtime dependency. The decision to keep Lit is provisional. To remove it, replace it with plain custom elements and a small base class in this repository.

### Development

| Package | Reason |
|---------|--------|
| `typescript` | Type checking and compilation. |
| `@playwright/test` | Component and end-to-end tests in a real browser. |
| `eslint` and `typescript-eslint` | Linting. |
| `esbuild` (only if needed) | A single bundle. Skip it if plain `tsc` output is enough. |

Logic tests use `node:test`. No other package is needed for tests.

### Replaced by built-ins

| Old package | Replacement |
|-------------|-------------|
| `meow` | `node:util` `parseArgs` |
| `chalk` | `node:util` `styleText` |
| `rimraf` | `node:fs` `rm` |
| `http-server` | a small static server on `node:http` |
| `@preact/signals-core` | a small signal module in this repository |
| `sass` | native CSS |
| `concurrently` | not needed |

The packages in the left column are still in `package.json`. MONKY-4 removes them.
