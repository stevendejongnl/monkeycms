import { getPath } from './path.ts'
import { MappingError } from './mapping-error.ts'


const PLACEHOLDER = /\{([^{}]+)\}/g

const isText = (value: unknown): value is string | number | boolean =>
    ['string', 'number', 'boolean'].includes(typeof value)

const fail = (message: string): never => {
    throw new MappingError(message)
}

const textOf = (value: unknown, name: string, template: string): string =>
    value === undefined || value === null
        ? fail(`Missing variable "${name}" in template "${template}"`)
        : isText(value)
            ? String(value)
            : fail(`Variable "${name}" in template "${template}" is not a string, number or boolean`)

// Replaces {name} and {nested.name} with values from vars. A missing variable is an error,
// and so is a value that is not a string, number or boolean.
export const interpolate = (template: string, vars: Record<string, unknown>, encode = false): string =>
    template.replace(PLACEHOLDER, (_match, rawName: string) => {
        const name = rawName.trim()
        const text = textOf(getPath(vars, name), name, template)

        return encode ? encodeURIComponent(text) : text
    })

const originOf = (url: string): string => new URL(url).origin

const sameOrigin = (a: string, b: string): boolean => originOf(a) === originOf(b)

export const isUnderBaseUrl = (url: string, baseUrl: string): boolean => {
    try {
        return sameOrigin(url, baseUrl)
    } catch {
        return false
    }
}

const queryOf = (templates: Record<string, string>, vars: Record<string, unknown>): Record<string, string> =>
    Object.fromEntries(Object.entries(templates).map(([key, template]) => [key, interpolate(template, vars)]))

// Builds the full URL. The path is always placed under baseUrl, and variables in the path
// are URL-encoded, so a value cannot change the host or add path segments.
export const buildUrl = (
    baseUrl: string,
    pathTemplate: string,
    vars: Record<string, unknown> = {},
    queryTemplates: Record<string, string> = {},
    extraQuery: Record<string, string> = {}
): string => {
    const path = interpolate(pathTemplate.replace(/^\/+/, ''), vars, true)
    const url = new URL(`${baseUrl.replace(/\/+$/, '')}/${path}`)

    return isUnderBaseUrl(url.href, baseUrl)
        ? Object.assign(url, { search: new URLSearchParams({ ...queryOf(queryTemplates, vars), ...extraQuery }).toString() }).href
        : fail(`URL "${url.href}" is not under the base URL "${baseUrl}"`)
}
