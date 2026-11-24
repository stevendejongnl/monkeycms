import { getPath } from './path.ts'
import { MappingError } from './mapping-error.ts'


const PLACEHOLDER = /\{([^{}]+)\}/g

// Replaces {name} and {nested.name} with values from vars. A missing variable is an error,
// and so is a value that is not a string, number or boolean.
export const interpolate = (template: string, vars: Record<string, unknown>, encode = false): string =>
    template.replace(PLACEHOLDER, (_match, name: string) => {
        const value = getPath(vars, name.trim())

        if (value === undefined || value === null) {
            throw new MappingError(`Missing variable "${name.trim()}" in template "${template}"`)
        }

        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
            throw new MappingError(`Variable "${name.trim()}" in template "${template}" is not a string, number or boolean`)
        }

        return encode ? encodeURIComponent(String(value)) : String(value)
    })

const sameOrigin = (a: string, b: string): boolean => new URL(a).origin === new URL(b).origin

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

    if (!sameOrigin(url.href, baseUrl)) {
        throw new MappingError(`URL "${url.href}" is not under the base URL "${baseUrl}"`)
    }

    for (const [key, template] of Object.entries(queryTemplates)) {
        url.searchParams.set(key, interpolate(template, vars))
    }

    for (const [key, value] of Object.entries(extraQuery)) {
        url.searchParams.set(key, value)
    }

    return url.href
}

export const isUnderBaseUrl = (url: string, baseUrl: string): boolean => {
    try {
        return sameOrigin(url, baseUrl)
    } catch {
        return false
    }
}
