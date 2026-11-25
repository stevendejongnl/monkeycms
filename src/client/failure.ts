import type { ClientError, ErrorKind, Result } from './types.ts'


// Thrown inside the client, and turned into a Result before it leaves.
export class Failure extends Error {
    override name = 'Failure'
    readonly error: ClientError

    constructor(error: ClientError) {
        super(error.message)
        this.error = error
    }
}

export const failure = (kind: ErrorKind, message: string, status = 0, fieldErrors: Record<string, string> = {}): Failure =>
    new Failure({ kind, status, message, fieldErrors })

// Turns a Failure into the error of a Result. Any other error is a bug, not an API problem,
// so it is not hidden.
export const toResult = async <T>(work: () => Promise<T>): Promise<Result<T>> => {
    try {
        return { ok: true, value: await work() }
    } catch (error) {
        if (error instanceof Failure) {
            return { ok: false, error: error.error }
        }

        throw error
    }
}
