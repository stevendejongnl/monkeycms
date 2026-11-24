import { getPath } from '../mapping/main.ts'


// A validator for the part of JSON Schema that monkeycms.schema.json uses. The schema file
// is the one description of the config: it is published, and this module checks against it.
// Keywords: $ref (local), type, enum, const, pattern, minLength, minimum, minItems,
// minProperties, properties, required, additionalProperties, propertyNames, items, oneOf.
// Other keywords, such as title and description, are ignored.

export type Schema = { readonly [keyword: string]: unknown }

export interface Issue {
    // Dot path of the bad key, for example "collections.posts.list.path". Empty for the root.
    readonly path: string
    readonly message: string
}

interface Context {
    readonly schema: Schema
    readonly value: unknown
    readonly path: string
    readonly root: Schema
}

type Keyword = (argument: any, context: Context) => Issue[]

const issue = (path: string, message: string): Issue[] => [{ path, message }]

const at = (path: string, key: string | number): string =>
    typeof key === 'number' ? `${path}[${key}]` : path === '' ? key : `${path}.${key}`

type JsonType = 'null' | 'array' | 'object' | 'string' | 'number' | 'boolean'

const jsonType = (value: unknown): JsonType =>
    value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value as JsonType

const matchesType = (value: unknown, type: string): boolean =>
    type === 'integer' ? Number.isInteger(value) : jsonType(value) === type

const isObject = (value: unknown): value is Record<string, unknown> => jsonType(value) === 'object'

const show = (value: unknown): string => JSON.stringify(value)

const whenType = (type: JsonType, check: Keyword): Keyword => (argument, context) =>
    jsonType(context.value) === type ? check(argument, context) : []

const validateNode = (schema: Schema, value: unknown, path: string, root: Schema): Issue[] =>
    Object.entries(schema).flatMap(([keyword, argument]) =>
        keywords[keyword]?.(argument, { schema, value, path, root }) ?? [])

const child = (context: Context, schema: unknown, value: unknown, path: string): Issue[] =>
    validateNode(schema as Schema, value, path, context.root)

// Picks the branch that the value is meant to match, so the error talks about one shape.
// A branch is meant when the value has its type and agrees on every "const" key.
const intended = (branches: Schema[], value: unknown): Schema | undefined =>
    branches.find((branch) => {
        const properties = (branch['properties'] ?? {}) as Record<string, Schema>

        return (branch['type'] === undefined || matchesType(value, branch['type'] as string))
            && Object.entries(properties).every(([key, property]) =>
                !('const' in property) || (isObject(value) && value[key] === property['const']))
    })

const keywords: Record<string, Keyword> = {
    $ref: (reference: string, context) =>
        child(context, getPath(context.root, reference.slice(1)), context.value, context.path),

    type: (type: string | string[], { value, path }) =>
        [type].flat().some((name) => matchesType(value, name))
            ? []
            : issue(path, `must be ${[type].flat().map((name) => name === 'integer' ? 'an integer' : `a${'aeiou'.includes(name[0] ?? '') ? 'n' : ''} ${name}`).join(' or ')}`),

    enum: (allowed: unknown[], { value, path }) =>
        allowed.includes(value) ? [] : issue(path, `must be one of: ${allowed.map(show).join(', ')}`),

    const: (expected: unknown, { value, path }) =>
        value === expected ? [] : issue(path, `must be ${show(expected)}`),

    pattern: whenType('string', (pattern: string, { value, path }) =>
        new RegExp(pattern).test(value as string) ? [] : issue(path, `must match the pattern ${pattern}`)),

    minLength: whenType('string', (minimum: number, { value, path }) =>
        (value as string).length >= minimum ? [] : issue(path, minimum === 1 ? 'must not be empty' : `must have at least ${minimum} characters`)),

    minimum: whenType('number', (minimum: number, { value, path }) =>
        (value as number) >= minimum ? [] : issue(path, `must be at least ${minimum}`)),

    minItems: whenType('array', (minimum: number, { value, path }) =>
        (value as unknown[]).length >= minimum ? [] : issue(path, `must have at least ${minimum} item${minimum === 1 ? '' : 's'}`)),

    minProperties: whenType('object', (minimum: number, { value, path }) =>
        Object.keys(value as object).length >= minimum ? [] : issue(path, `must have at least ${minimum} key${minimum === 1 ? '' : 's'}`)),

    properties: whenType('object', (properties: Record<string, Schema>, context) =>
        Object.entries(properties)
            .filter(([key]) => Object.hasOwn(context.value as object, key))
            .flatMap(([key, schema]) => child(context, schema, (context.value as Record<string, unknown>)[key], at(context.path, key)))),

    required: whenType('object', (required: string[], { value, path }) =>
        required.filter((key) => !Object.hasOwn(value as object, key)).flatMap((key) => issue(at(path, key), 'is required'))),

    additionalProperties: whenType('object', (rule: false | Schema, context) =>
        Object.keys(context.value as object)
            .filter((key) => !Object.hasOwn((context.schema['properties'] ?? {}) as object, key))
            .flatMap((key) => rule === false
                ? issue(at(context.path, key), 'is not a known key')
                : child(context, rule, (context.value as Record<string, unknown>)[key], at(context.path, key)))),

    propertyNames: whenType('object', (schema: Schema, context) =>
        Object.keys(context.value as object).flatMap((key) =>
            child(context, schema, key, at(context.path, key)).map(({ path }) => ({ path, message: `the name ${show(key)} is not allowed` })))),

    items: whenType('array', (schema: Schema, context) =>
        (context.value as unknown[]).flatMap((item, index) => child(context, schema, item, at(context.path, index)))),

    oneOf: (branches: Schema[], context) => {
        const matches = branches.some((branch) => child(context, branch, context.value, context.path).length === 0)
        const meant = intended(branches, context.value)

        return matches
            ? []
            : meant === undefined
                ? issue(context.path, 'does not match any allowed shape')
                : child(context, meant, context.value, context.path)
    },
}

export const validateSchema = (schema: Schema, value: unknown): Issue[] => validateNode(schema, value, '', schema)

export const describeIssue = ({ path, message }: Issue): string => `${path === '' ? '(root)' : path} ${message}`
