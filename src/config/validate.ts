import schema from './monkeycms.schema.json' with { type: 'json' }
import { parsePath } from '../mapping/main.ts'
import { describeIssue, validateSchema } from './json-schema.ts'
import type { Issue, Schema } from './json-schema.ts'
import type { CollectionConfig, MonkeyConfig } from './types.ts'


export type Validation =
    | { readonly ok: true, readonly config: MonkeyConfig }
    | { readonly ok: false, readonly issues: readonly Issue[] }

type Rule = (config: MonkeyConfig) => Issue[]

const collectionsOf = (config: MonkeyConfig): [string, CollectionConfig][] => Object.entries(config.collections)

const present = <T>(value: T | undefined): value is T => value !== undefined

// Every API path in the config, with the config path where it was written.
const pathsOf = (config: MonkeyConfig): [string, string][] => [
    ...[
        ['auth.tokenPath', config.auth?.type === 'login' ? config.auth.tokenPath : undefined],
        ['auth.expiresInPath', config.auth?.type === 'login' ? config.auth.expiresInPath : undefined],
        ['errors.messagePath', config.errors?.messagePath],
        ['errors.fieldErrorsPath', config.errors?.fieldErrorsPath],
        ['errors.fieldNamePath', config.errors?.fieldNamePath],
        ['errors.fieldMessagePath', config.errors?.fieldMessagePath],
        ['pagination.nextCursorPath', config.pagination?.type === 'cursor' ? config.pagination.nextCursorPath : undefined],
    ] as const,
    ...collectionsOf(config).flatMap(([name, collection]) => [
        [`collections.${name}.idPath`, collection.idPath],
        ...Object.entries(collection.fields).map(([field, { path }]) => [`collections.${name}.fields.${field}.path`, path] as const),
        ['collections.' + name + '.list.itemsPath', collection.list.itemsPath],
        ['collections.' + name + '.list.totalPath', collection.list.totalPath],
        ['collections.' + name + '.list.pagination.nextCursorPath', collection.list.pagination?.type === 'cursor' ? collection.list.pagination.nextCursorPath : undefined],
        ...(['get', 'create', 'update'] as const).flatMap((operation) => [
            [`collections.${name}.${operation}.itemPath`, collection[operation]?.itemPath],
            [`collections.${name}.${operation}.body.wrap`, collection[operation]?.body?.wrap],
        ]),
    ]),
].filter((entry): entry is [string, string] => present(entry[1]))

const syntaxOf = (path: string): string | undefined => {
    try {
        parsePath(path)
        return undefined
    } catch (error) {
        return (error as Error).message
    }
}

const pathSyntax: Rule = (config) =>
    pathsOf(config).flatMap(([where, path]) => {
        const problem = syntaxOf(path)

        return problem === undefined ? [] : [{ path: where, message: `is not a valid path: ${problem}` }]
    })

const baseUrl: Rule = ({ baseUrl: value }) => {
    const url = URL.canParse(value) ? new URL(value) : undefined

    return url !== undefined && ['http:', 'https:'].includes(url.protocol)
        ? []
        : [{ path: 'baseUrl', message: 'must be an http or https URL' }]
}

// get, update and delete work on one entry, so their path needs the id.
const entryPaths: Rule = (config) =>
    collectionsOf(config).flatMap(([name, collection]) =>
        (['get', 'update', 'delete'] as const)
            .filter((operation) => collection[operation] !== undefined && !collection[operation].path.includes('{id}'))
            .map((operation) => ({ path: `collections.${name}.${operation}.path`, message: 'must contain {id}' })))

const selectOptions: Rule = (config) =>
    collectionsOf(config).flatMap(([name, collection]) =>
        Object.entries(collection.fields).flatMap(([field, { type, options }]) =>
            (type === 'select') === (options !== undefined)
                ? []
                : [{
                    path: `collections.${name}.fields.${field}.options`,
                    message: type === 'select' ? 'is required for a select field' : 'is only allowed for a select field',
                }]))

const richtextFormat: Rule = (config) =>
    collectionsOf(config).flatMap(([name, collection]) =>
        Object.entries(collection.fields)
            .filter(([, { type, format }]) => type !== 'richtext' && format !== undefined)
            .map(([field]) => ({ path: `collections.${name}.fields.${field}.format`, message: 'is only allowed for a richtext field' })))

// The status field must be a select field, and the value of Publish one of its choices.
const statusField: Rule = (config) =>
    collectionsOf(config).flatMap(([name, { fields, status }]) => {
        const field = status === undefined ? undefined : fields[status.field]
        const where = `collections.${name}.status`

        if (status === undefined) {
            return []
        }

        if (field?.type !== 'select') {
            return [{ path: `${where}.field`, message: 'must name a select field of the collection' }]
        }

        return status.publish === undefined || field.options?.includes(status.publish)
            ? []
            : [{ path: `${where}.publish`, message: 'must be one of the options of the status field' }]
    })

// Every field in the preview must be a field of the collection.
const previewFields: Rule = (config) =>
    collectionsOf(config).flatMap(([name, { fields, preview }]) =>
        (preview?.fields ?? [])
            .map((field, index) => ({ field, index }))
            .filter(({ field }) => fields[field] === undefined)
            .map(({ index }) => ({ path: `collections.${name}.preview.fields[${index}]`, message: 'must name a field of the collection' })))

// Every field in a section must be a field of the collection, and in one section only.
const sectionFields: Rule = (config) =>
    collectionsOf(config).flatMap(([name, { fields, sections }]) => {
        const seen = new Set<string>()

        return (sections ?? []).flatMap((section, sectionIndex) =>
            section.fields.flatMap((field, index) => {
                const path = `collections.${name}.sections[${sectionIndex}].fields[${index}]`
                const issue = fields[field] === undefined
                    ? [{ path, message: 'must name a field of the collection' }]
                    : seen.has(field) ? [{ path, message: 'is already in another section' }] : []

                seen.add(field)

                return issue
            }))
    })

// The address #/settings is the settings screen, so no collection can have that name.
const reservedNames: Rule = (config) =>
    collectionsOf(config)
        .filter(([name]) => name === 'settings')
        .map(([name]) => ({ path: `collections.${name}`, message: 'is a reserved name, because #/settings is the settings screen' }))

const rules: readonly Rule[] = [baseUrl, pathSyntax, entryPaths, selectOptions, richtextFormat, statusField, previewFields, sectionFields, reservedNames]

// Checks the config against the published schema first. The other rules need a config
// of the right shape, so they run only when the schema check passes.
export const validateConfig = (input: unknown): Validation => {
    const shape = validateSchema(schema as Schema, input)
    const issues = shape.length > 0 ? shape : rules.flatMap((rule) => rule(input as MonkeyConfig))

    return issues.length === 0 ? { ok: true, config: input as MonkeyConfig } : { ok: false, issues }
}

export class ConfigError extends Error {
    override name = 'ConfigError'

    readonly issues: readonly Issue[]

    constructor(issues: readonly Issue[]) {
        super(`Invalid MonkeyCMS config:\n${issues.map((item) => `  ${describeIssue(item)}`).join('\n')}`)
        this.issues = issues
    }
}

// Like validateConfig, but throws a ConfigError that lists every bad key.
export const parseConfig = (input: unknown): MonkeyConfig => {
    const result = validateConfig(input)

    if (!result.ok) {
        throw new ConfigError(result.issues)
    }

    return result.config
}
