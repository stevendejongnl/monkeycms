import type { ClientError, ErrorKind } from './types.ts'


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
