import type { FieldConfig } from '../config/main.ts'


type Formatter = (value: unknown) => string

const formatters: Record<string, Formatter> = {
    boolean: (value) => value === true ? 'Yes' : 'No',
    // An ISO date shows its day.
    date: (value) => String(value).slice(0, 10),
}

const plain: Formatter = (value) =>
    Array.isArray(value) ? value.map(plain).join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value)

// The text that shows a value in a table cell.
export const displayValue = (field: FieldConfig, value: unknown): string =>
    value === undefined || value === null || value === '' ? '' : (formatters[field.type] ?? plain)(value)
