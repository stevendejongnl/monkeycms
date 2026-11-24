import { MappingError } from './mapping-error.ts'
import { setPath } from './path.ts'
import { buildUrl, isUnderBaseUrl } from './template.ts'
import { applyTransform } from './transforms.ts'
import type { EndpointMapping, RequestBodyMapping } from './types.ts'


export interface RequestDescription {
    method: string
    url: string
    headers: Record<string, string>
    body?: string
}

export interface BuildRequestOptions {
    baseUrl: string
    endpoint: EndpointMapping
    // Values for {name} in the path and query templates, for example { id: '5', search: 'x' }.
    vars?: Record<string, unknown>
    // The entry values to send, as field name to value. Needs endpoint.body.
    entry?: Record<string, unknown>
    // Extra query parameters, for example from pageQuery().
    extraQuery?: Record<string, string>
    // A full URL to use instead of the endpoint path, for example from a Link header.
    // It must be under baseUrl.
    pageUrl?: string
    headers?: Record<string, string>
}

export const mapEntryToBody = (mapping: RequestBodyMapping, entry: Record<string, unknown>): Record<string, unknown> => {
    const body: Record<string, unknown> = {}

    for (const [name, field] of Object.entries(mapping.fields)) {
        if (!Object.hasOwn(entry, name)) {
            continue
        }

        const path = field.path ?? name

        if (mapping.wrap !== undefined && path.startsWith('/')) {
            throw new MappingError(`Field "${name}" uses a JSON Pointer path, which cannot be combined with wrap`)
        }

        const value = applyTransform(entry[name], field.transform, 'write')

        setPath(body, mapping.wrap === undefined ? path : `${mapping.wrap}.${path}`, value)
    }

    for (const [path, value] of Object.entries(mapping.static ?? {})) {
        setPath(body, path, value)
    }

    return body
}

export const buildRequest = (options: BuildRequestOptions): RequestDescription => {
    const { baseUrl, endpoint, vars, entry, extraQuery, pageUrl, headers } = options

    if (pageUrl !== undefined && !isUnderBaseUrl(pageUrl, baseUrl)) {
        throw new MappingError(`Page URL "${pageUrl}" is not under the base URL "${baseUrl}"`)
    }

    const request: RequestDescription = {
        method: endpoint.method,
        url: pageUrl ?? buildUrl(baseUrl, endpoint.path, vars, endpoint.query, extraQuery),
        headers: { accept: 'application/json', ...headers },
    }

    if (endpoint.body !== undefined) {
        request.body = JSON.stringify(mapEntryToBody(endpoint.body, entry ?? {}))
        request.headers = { 'content-type': 'application/json', ...request.headers }
    }

    return request
}
