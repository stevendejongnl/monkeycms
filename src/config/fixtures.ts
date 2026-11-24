import type { MonkeyConfig } from './types.ts'


// A JSON:API-style API: items under "data", fields under "attributes", page and limit.
export const blogConfig: MonkeyConfig = {
    configVersion: 1,
    baseUrl: 'https://api.example.com/v1',
    headers: { 'x-client': 'monkeycms' },
    pagination: { type: 'page', pageParam: 'page', limitParam: 'per_page', pageSize: 20 },
    errors: { messagePath: 'error.message', fieldErrorsPath: 'error.fields' },
    collections: {
        posts: {
            label: 'Posts',
            fields: {
                title: { type: 'text', label: 'Title', required: true, path: 'attributes.title' },
                body: { type: 'longtext', path: 'attributes.body' },
                status: { type: 'select', options: ['draft', 'published'], path: 'attributes.status' },
                tags: { type: 'text', path: 'attributes.tags', transform: { type: 'join', separator: ', ' } },
                createdAt: { type: 'date', path: 'attributes.created_at', transform: 'date', readOnly: true },
            },
            list: { path: '/posts', itemsPath: 'data', totalPath: 'meta.total', query: { sort: '-created_at' } },
            get: { path: '/posts/{id}', itemPath: 'data' },
            create: { path: '/posts', itemPath: 'data', body: { wrap: 'data', static: { 'data.type': 'posts' } } },
            update: { method: 'PATCH', path: '/posts/{id}', itemPath: 'data', body: { wrap: 'data' } },
            delete: { path: '/posts/{id}' },
        },
    },
}
