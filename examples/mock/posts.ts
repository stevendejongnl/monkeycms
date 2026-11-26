// The data that all example APIs hold: a few posts in memory.
export interface Post {
    id: number
    title: string
    body: string
    status: 'draft' | 'published'
}

export interface PostInput {
    title?: unknown
    body?: unknown
    status?: unknown
}

export const TITLE_REQUIRED = 'Title is required'

export class Posts {
    private items: Post[]
    private nextId: number

    constructor(count = 25) {
        this.items = Array.from({ length: count }, (_, index) => ({
            id: index + 1,
            title: `Post ${index + 1}`,
            body: `The text of post ${index + 1}.`,
            status: index % 3 === 0 ? 'draft' : 'published',
        }))
        this.nextId = count + 1
    }

    // The posts that match a search term in the title, or all of them.
    search(term: string | null): Post[] {
        const needle = (term ?? '').trim().toLowerCase()

        return needle === '' ? [...this.items] : this.items.filter(({ title }) => title.toLowerCase().includes(needle))
    }

    find(id: string): Post | undefined {
        return this.items.find((post) => String(post.id) === id)
    }

    // The problem with an input, or undefined when it is fine.
    problem({ title }: PostInput): string | undefined {
        return typeof title === 'string' && title.trim() !== '' ? undefined : TITLE_REQUIRED
    }

    add(input: PostInput): Post {
        const post: Post = {
            id: this.nextId++,
            title: String(input.title),
            body: typeof input.body === 'string' ? input.body : '',
            status: input.status === 'published' ? 'published' : 'draft',
        }

        this.items.push(post)

        return post
    }

    change(post: Post, input: PostInput): Post {
        Object.assign(post, {
            ...(typeof input.title === 'string' ? { title: input.title } : {}),
            ...(typeof input.body === 'string' ? { body: input.body } : {}),
            ...(input.status === 'draft' || input.status === 'published' ? { status: input.status } : {}),
        })

        return post
    }

    remove(post: Post): void {
        this.items = this.items.filter((item) => item !== post)
    }
}

// The slice of a list for a page number that starts at 1.
export const slice = <T>(items: readonly T[], page: number, size: number): T[] =>
    items.slice((page - 1) * size, page * size)

// Reads a positive number from a query parameter, with a default for a missing or wrong one.
export const number = (value: string | null, fallback: number): number => {
    const parsed = Number(value)

    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}
