export type Route =
    | { readonly view: 'home' }
    | { readonly view: 'list', readonly collection: string }
    | { readonly view: 'new', readonly collection: string }
    | { readonly view: 'edit', readonly collection: string, readonly id: string }

const HOME: Route = { view: 'home' }

// The parsers, by the number of segments in the hash: "#/posts", "#/posts/new", "#/posts/12".
const parsers: readonly ((segments: readonly string[]) => Route)[] = [
    () => HOME,
    ([collection = '']) => ({ view: 'list', collection }),
    ([collection = '', second = '']) => second === 'new' ? { view: 'new', collection } : { view: 'edit', collection, id: second },
]

const decode = (segment: string): string => {
    try {
        return decodeURIComponent(segment)
    } catch {
        return segment
    }
}

// The route of a location hash. A hash that means nothing is the home route.
export const parseRoute = (hash: string): Route => {
    const segments = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decode)

    return (parsers[segments.length] ?? (() => HOME))(segments)
}

const hrefs: { [V in Route['view']]: (route: Extract<Route, { view: V }>) => string } = {
    home: () => '#/',
    list: ({ collection }) => `#/${encodeURIComponent(collection)}`,
    new: ({ collection }) => `#/${encodeURIComponent(collection)}/new`,
    edit: ({ collection, id }) => `#/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`,
}

export const hrefOf = (route: Route): string => (hrefs[route.view] as (route: Route) => string)(route)
