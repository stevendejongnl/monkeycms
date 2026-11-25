import type { CollectionConfig, FieldConfig } from '../config/main.ts'


type Rule = (field: FieldConfig, value: unknown) => string | undefined

const isEmpty = (value: unknown): boolean => value === undefined || value === null || value === ''

const rules: readonly Rule[] = [
    // A switch always has a value, so it is never missing.
    (field, value) => field.required === true && field.type !== 'boolean' && isEmpty(value) ? 'This field is required' : undefined,
    (field, value) => field.type === 'number' && !isEmpty(value) && !Number.isFinite(value) ? 'Enter a number' : undefined,
    (field, value) => field.type === 'select' && !isEmpty(value) && !(field.options ?? []).includes(String(value)) ? 'Choose one of the options' : undefined,
]

const firstProblem = (field: FieldConfig, value: unknown): string | undefined =>
    rules.map((rule) => rule(field, value)).find((message) => message !== undefined)

// The problems of an entry, by field name. A field that has no problem is not in the result.
// A read-only field is not checked, because the API does not take it.
export const validateEntry = (fields: CollectionConfig['fields'], values: Readonly<Record<string, unknown>>): Record<string, string> =>
    Object.fromEntries(
        Object.entries(fields)
            .filter(([, field]) => field.readOnly !== true)
            .flatMap(([name, field]) => {
                const problem = firstProblem(field, values[name])

                return problem === undefined ? [] : [[name, problem]]
            })
    )

// The value that a new entry starts with.
export const emptyValue = (field: FieldConfig): unknown => field.type === 'boolean' ? false : undefined

export const emptyEntry = (fields: CollectionConfig['fields']): Record<string, unknown> =>
    Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, emptyValue(field)]))

// Whether two sets of values differ in the fields of the collection. undefined and an empty
// string both mean "nothing entered".
export const hasChanged = (fields: CollectionConfig['fields'], before: Readonly<Record<string, unknown>>, after: Readonly<Record<string, unknown>>): boolean => {
    const clean = (value: unknown): string => JSON.stringify(isEmpty(value) ? null : value)

    return Object.keys(fields).some((name) => clean(before[name]) !== clean(after[name]))
}
