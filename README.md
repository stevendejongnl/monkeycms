# monkeycms

Monkey CMS is a simple, configurable API-based content management system (CMS), deriving its name from the Dutch pronunciation of 'API' as 'aapie'.

> Status: early development. Nothing here is released yet.

## What it is

MonkeyCMS has no backend of its own. It is a front-end CMS, built from web components, that talks to an HTTP API you already have. You describe that API in a mapping config. MonkeyCMS reads the config and builds the screens to list, create, edit and delete content.

The same MonkeyCMS build can work with many different APIs. Only the config changes.

## Principles

- **Data-only config.** The config is JSON. It contains no code, and MonkeyCMS never runs `eval` or `Function` on it. A config from an untrusted source cannot run code.
- **One internal model.** The UI knows only collections, entries and fields. All API details (URLs, body shapes, pagination, auth) live in the mapping.
- **Few dependencies.** Prefer the platform and Node built-ins. Every dependency must have a reason. All dependencies stay on the latest version. See [DEPENDENCIES.md](DEPENDENCIES.md).
- **License.** AGPL-3.0-only.

## Architecture

```
mapping config (JSON)
        |
        v
  config loader + validator   <- reports the path of any bad key
        |
        v
  mapping engine              <- pure functions: paths, templates, request/response mapping,
        |                        pagination, error mapping
        v
  API client                  <- builds requests, sends them with fetch, applies auth,
        |                        returns entries or one internal error shape
        v
  UI components               <- web components: set-up, login, collection list,
                                 entry editor, field inputs
```

| Layer | Job | Knows about the API? |
|-------|-----|----------------------|
| Config loader | Loads the config from the set-up endpoint or an inline attribute. Validates it. Keeps it in a signal store. | No |
| Mapping engine | Turns an internal operation (for example "list collection `posts`, page 2") into a request description, and turns the API response into entries. | Only through the config |
| API client | Sends the request. Adds auth. Handles timeouts, cancel and errors. | Only through the config |
| UI components | Show and edit entries. | No |

### The mapping config

The config says:

- where the API is (`baseUrl`) and how to authenticate;
- which collections exist and which fields each collection has;
- for each collection, the endpoints for list, get, create, update and delete: method, path template, query and body templates;
- how to read each response: where the items, the total and each field are;
- how pagination works: page and limit, offset and limit, cursor, Link header or none;
- where an error response keeps its message.

The config format is described by `src/config/monkeycms.schema.json`.

### Authentication

The `auth` block says how to sign in. It never holds a secret. The person enters the credentials at runtime.

| `type` | The person enters | MonkeyCMS sends |
|--------|-------------------|-----------------|
| `none` | nothing | nothing |
| `bearer` | a token | `Authorization: Bearer <token>` |
| `apiKey` (`name`, `in`: `header` or `query`) | a key | the key in that header or query parameter |
| `basic` | username and password | `Authorization: Basic ...` |
| `cookie` | nothing, or username and password when `path` is set | cookies, with `credentials: "include"` |
| `login` (`path`, `tokenPath`, optional `expiresInPath`, `header`, `scheme`) | username and password | the token from the login answer |

Where the session is kept (`persist`):

- `memory` (default). The session is lost when the tab reloads. No script that runs later can read it from storage.
- `session`. The session is kept in `sessionStorage`, so a reload does not sign the person out. Any script on the same origin can read it, so use it only when you trust all scripts on the page. It is never shared with other tabs and is deleted when the tab closes.

A password is only used for the sign-in request. MonkeyCMS does not keep it. For `login`, a token that has an expiry is dropped on the client when the time is up. With cookie sessions the browser keeps the cookie, so the API must set the correct `SameSite` and CORS headers (`Access-Control-Allow-Credentials`).

### Theming

Every colour, size and font is a CSS custom property, so a theme is a few lines of CSS. Light is the default, and the dark values apply when the system asks for dark. Set a token on `:root`, or on the `monkey-app` element, to change it:

```css
:root {
    --monkey-accent-color: #0f766e;
    --monkey-radius: 0.75rem;
    --monkey-font: 'Source Serif 4', serif;
}
```

| Token | Use |
|-------|-----|
| `--monkey-background-color` | Page background |
| `--monkey-surface-color` | Cards, tables, the sign-in form |
| `--monkey-color` | Body text |
| `--monkey-muted-color` | Hints and table heads |
| `--monkey-border-color` | Dividers and card edges |
| `--monkey-control-border-color` | Input and button borders |
| `--monkey-accent-color` | Primary button, active menu item |
| `--monkey-accent-contrast-color` | Text on the accent. White or dark, chosen from the accent |
| `--monkey-link-color` | Links. The accent, lightened in dark mode |
| `--monkey-error-color` | Error messages and borders |
| `--monkey-radius` | Corner of buttons, inputs and cards |
| `--monkey-gap` | Space between blocks |
| `--monkey-field-gap` | Space between a label and its input |
| `--monkey-padding` | Space in table cells |
| `--monkey-font` | The font of all text |

To force a mode, set `data-theme="light"` or `data-theme="dark"` on the `html` element. Without it, the page follows the system. The link and contrast tokens are worked out from the accent on `:root`, so when you set the accent on the `monkey-app` element instead, set those two as well. For a compact look, make `--monkey-gap` and `--monkey-padding` smaller. The components need `dist/main.css` on the page, because that file defines the tokens.

### Command line

```
monkeycms init [folder]    # writes public/index.html and public/monkey.config.json, and never replaces a file
monkeycms serve [-p 8080]  # serves public/ and dist/ on http://127.0.0.1:8080/public/index.html
monkeycms build            # runs the build script of the project
```

`serve` uses the `dist` folder of the project when it has one, and the built files of MonkeyCMS when it does not. The sample config from `init` talks to the public JSONPlaceholder API, so it runs as it is.

### Out of scope

- A server, database or file storage. Bring your own API.
- Running user code from the config.

## Roadmap

The plan is tracked in the MonkeyCMS project in Plane, in three phases: foundation, core, and CLI and release.

## Development

You need Node 26 or newer.

```
npm install
npm run build        # bundles src/ into dist/ and compiles the CLI in bin/
npm run typecheck    # strict TypeScript check
npm test             # typecheck, build, unit tests (node:test), component tests (Playwright)
npm run serve        # build, then serve http://127.0.0.1:8080/public/index.html
```

Run the component tests for one browser with `npx playwright test --project=chromium`. Install the browsers first with `npx playwright install`.
