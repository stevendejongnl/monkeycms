# monkeycms

Monkey CMS is a simple, configurable API-based content management system (CMS), deriving its name from the Dutch pronunciation of 'API' as 'aapie'.

> Status: early development. Nothing here is released yet.

## What it is

MonkeyCMS has no backend of its own. It is a front-end CMS, built from web components, that talks to an HTTP API you already have. You describe that API in a mapping config. MonkeyCMS reads the config and builds the screens to list, create, edit and delete content.

The same MonkeyCMS build can work with many different APIs. Only the config changes.

## Principles

- **Data-only config.** The config is JSON. It contains no code, and MonkeyCMS never runs `eval` or `Function` on it. A config from an untrusted source cannot run code.
- **One internal model.** The UI knows only collections, entries and fields. All API details (URLs, body shapes, pagination, auth) live in the mapping.
- **Few dependencies.** Prefer the platform and Node built-ins. Every dependency must have a reason. All dependencies stay on the latest version.
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

The config format and its schema are planned work. See the roadmap.

### Out of scope

- A server, database or file storage. Bring your own API.
- Running user code from the config.

## Roadmap

The plan is tracked in the MonkeyCMS project in Plane, in three phases: foundation, core, and CLI and release.

## Development

The build, test and CLI setup is being reworked. Until that is done, see `package.json`.
