# monkeycms

Monkey CMS is a simple, configurable API-based content management system (CMS), deriving its name from the Dutch pronunciation of 'API' as 'aapie'.

> Status: early development. Nothing here is released yet.

## What it is

MonkeyCMS has no backend of its own. It is a front-end CMS, built from web components, that talks to an HTTP API you already have. You describe that API in a mapping config. MonkeyCMS reads the config and builds the screens to list, create, edit and delete content.

The same MonkeyCMS build can work with many different APIs. Only the config changes.

## Quick start

MonkeyCMS is not on npm yet, so run it from a clone. You need Node 26 or newer.

```
git clone https://github.com/stevendejongnl/monkeycms
cd monkeycms
npm install
npm run demo        # the app against a mock API, on http://127.0.0.1:8080/
```

The demo needs no API of your own. To point MonkeyCMS at a real API:

```
node bin/dist/cli.js init ../my-cms           # public/index.html and public/monkey.config.json
cd ../my-cms
# edit public/monkey.config.json
node ../monkeycms/bin/dist/cli.js check --probe   # does the config fit the live API?
node ../monkeycms/bin/dist/cli.js serve           # http://127.0.0.1:8080/public/index.html
```

The page is two elements and a script. `monkey-set-up` loads and validates the config, and `monkey-app` draws the screens:

```html
<link rel="stylesheet" href="/dist/main.css">
<monkey-set-up get-set-up-endpoint="/public/monkey.config.json"></monkey-set-up>
<monkey-app></monkey-app>
<script type="module" src="/dist/main.js"></script>
```

Put the config inline with `<monkey-set-up config='{"configVersion": 1, ...}'>` instead of the endpoint when you do not want a second request.

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

The config format is described by `src/config/monkeycms.schema.json` and, in short, in the [Config reference](#config-reference).

### Config reference

A small config. The full list of keys is in `src/config/monkeycms.schema.json`, and `monkeycms check` reports every key that does not fit it, with its path.

```json
{
  "configVersion": 1,
  "baseUrl": "https://api.example.com",
  "auth": { "type": "bearer" },
  "pagination": { "type": "page", "pageParam": "page", "limitParam": "per_page", "pageSize": 20 },
  "errors": { "messagePath": "message", "fieldErrorsPath": "errors" },
  "collections": {
    "posts": {
      "label": "Posts",
      "fields": {
        "title": { "type": "text", "label": "Title", "required": true },
        "status": { "type": "select", "label": "Status", "options": ["draft", "published"] },
        "tags": { "type": "text", "label": "Tags", "transform": { "type": "join", "separator": ", " } }
      },
      "list": { "path": "/posts", "itemsPath": "data", "totalPath": "meta.total", "searchParam": "q" },
      "get": { "path": "/posts/{id}", "itemPath": "data" },
      "create": { "path": "/posts", "itemPath": "data" },
      "update": { "method": "PATCH", "path": "/posts/{id}", "itemPath": "data" },
      "delete": { "path": "/posts/{id}" }
    }
  }
}
```

**Top level**

| Key | Meaning |
|-----|---------|
| `configVersion` | Always `1`. |
| `baseUrl` | The API. Every endpoint `path` is added to it. |
| `auth` | How to sign in. See [Authentication](#authentication). Without it nothing is sent as a credential. |
| `headers` | Headers sent with every request. |
| `pagination` | The default for every list. A list can set its own. |
| `errors` | How to read an error answer. |
| `collections` | The things you edit, by name. |

**Collection**

| Key | Meaning |
|-----|---------|
| `label` | The name in the menu and the title. Defaults to the key. |
| `idPath` | Where the id is in one API item. Default `id`. |
| `fields` | The fields, by name. |
| `list` | Required. The other four are optional. A screen only offers what you describe: no `create` means no New button, no `delete` means no Delete button. |
| `get`, `create`, `update`, `delete` | Endpoints. |

**Endpoint.** `path` is a template under `baseUrl`, and `{id}` is the id of the entry. `method` defaults to GET for `list` and `get`, POST for `create`, PUT for `update` and DELETE for `delete`. `query` and `headers` are added for this endpoint, and the values in `query` can use `{name}` like the path. For `list`: `itemsPath` (where the array is, leave out when the body is the array), `totalPath`, `pagination` and `searchParam` (the query parameter for a search term; without it there is no search box). For `get`, `create` and `update`: `itemPath` (where the entry is in the answer), and `body` for create and update, with `wrap` (the key that holds the entry in the request, for example `data`) and `static` (constants to add, as API path to value, for example `{ "data.type": "posts" }`).

**Field**

| Key | Meaning |
|-----|---------|
| `type` | `text`, `longtext`, `number`, `boolean`, `date` or `select`. |
| `label` | Defaults to the field name. |
| `required` | The form refuses an empty value. |
| `readOnly` | Shown, but not sent on create and update. |
| `path` | Where the value is in the API item. Default the field name. The same path is used to write the request body. |
| `options` | The choices of a `select`. |
| `transform` | Changes the value between API and form: `"string"`, `"number"`, `"boolean"`, `"date"`, `{ "type": "join", "separator": ", " }` (a list in the API, one text in the form), `{ "type": "split", "separator": ", " }` (the other way) or `{ "type": "default", "value": ... }`. |

**Paths.** Every `...Path` is a dot path (`data.items`, `meta.total`), with list positions as `[0]` or `.0` (`errors[0].detail`). A JSON Pointer (`/data/attributes/title`) also works.

**Pagination**

| `type` | Keys | MonkeyCMS stops when |
|--------|------|----------------------|
| `none` | | there is one page |
| `page` | `pageParam`, `limitParam`, `pageSize`, `startPage` | a page has fewer items than `pageSize`, or the pages passed `totalPath` |
| `offset` | `offsetParam`, `limitParam`, `pageSize` | the same as `page` |
| `cursor` | `cursorParam`, `nextCursorPath`, `pageSize`, `limitParam` | there is no cursor at `nextCursorPath` |
| `link-header` | `pageSize`, `limitParam` | the answer has no `Link` header with `rel="next"`. Only a link to the same host is followed. |

**Errors**

| Key | Meaning |
|-----|---------|
| `messagePath` | Where the message is. Without it, or when it is not there, the message is `HTTP <status>`. |
| `fieldErrorsPath` | An object that maps field names to a message or a list of messages. It can also be an array of errors, see the next two keys. |
| `fieldNamePath`, `fieldMessagePath` | For an array of errors: where the field name and the message are inside each error. The field name is the last part of the value, so the JSON Pointer `/data/attributes/title` gives `title`. |

The five configs in [Examples](#examples) cover these keys for common API styles. Copy the one that looks like your API.

### Examples

`examples/` has a complete config and a mock API for five common API styles. The tests run every config against its mock API: list every page, search, get, create, update, delete and an error answer.

| Folder | API style | Pagination |
|--------|-----------|------------|
| `examples/rest-array` | Plain REST, a JSON array, errors with a message per field | page and limit, no total |
| `examples/envelope` | `data` and `meta.total`, errors in `error.fields` | page and limit, with total |
| `examples/jsonapi` | JSON:API: `attributes`, `data.type`, `page[number]`, `filter[title]` | page and size, with total |
| `examples/cursor` | `items` and an opaque `next_cursor` | cursor |
| `examples/wordpress` | WordPress REST: `{ raw, rendered }` fields, application password | `Link` header |

A mock API is one function from request to response (`examples/mock/mock.ts`), so it runs in a test through a fake fetch and can run behind a real server.

JSON:API reports an error per field as an array with a `source.pointer`. The example reads it with `fieldErrorsPath: "errors"`, `fieldNamePath: "source.pointer"` and `fieldMessagePath: "detail"`: the field name is the last part of the pointer.

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
monkeycms check [config]   # validates a config; default public/monkey.config.json
monkeycms check [config] --probe   # also asks the list endpoint of each collection
```

`check` prints every problem of the config with its path, and exits with 1 when there is one. With `--probe` it sends GET requests to the list endpoint of each collection, without a sign-in, and reports what the mapping found: the items and their ids, how many items have each field, and whether page 2 differs from page 1. An API that needs a sign-in answers 401, and the report says so. Use it to get a new config right before you open the browser.

`serve` uses the `dist` folder of the project when it has one, and the built files of MonkeyCMS when it does not. The sample config from `init` talks to the public JSONPlaceholder API, so it runs as it is.

### Demo

```
npm run demo                  # the rest-array example on http://127.0.0.1:8080/
npm run demo -- jsonapi -p 9000
```

`npm run demo` runs MonkeyCMS against the mock API of one example in `examples/`: `rest-array` (default), `envelope`, `jsonapi`, `cursor` or `wordpress`. The page, the built files and the mock API share one origin. Data lives in memory and resets when you stop the server. The WordPress example asks for a sign-in: use any username and password. `examples/demo.spec.ts` tests the whole flow in a browser.

### Out of scope

- A server, database or file storage. Bring your own API.
- Running user code from the config.

## License

AGPL-3.0-only. See [LICENSE](LICENSE).

## Roadmap

The plan is tracked in the MonkeyCMS project in Plane, in three phases: foundation, core, and CLI and release.

## Development

You need Node 26 or newer.

```
npm install
npm run build        # bundles src/ into dist/ and the CLI in bin/ into bin/dist/cli.js
npm run typecheck    # strict TypeScript check
npm test             # typecheck, build, unit tests (node:test), component tests (Playwright)
npm run serve        # build, then serve http://127.0.0.1:8080/public/index.html
npm run demo         # build, then run the app against a mock API of examples/
```

Imports that leave a folder by more than one level are written from the root of `src/`, like `import { getClient } from 'client/main.ts'`, or from the root of the project for `examples/`. `tsconfig.json` has the `paths`, esbuild reads them, and `npm run test:unit` loads `scripts/root-imports.mjs` so that `node --test` resolves them too. There are no aliases.

Run the component tests for one browser with `npx playwright test --project=chromium`. Install the browsers first with `npx playwright install`.
