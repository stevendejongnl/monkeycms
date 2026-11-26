import type { FieldConfig } from '../config/main.ts'
import { markdownToHtml } from '../richtext/markdown.ts'


type Formatter = (value: unknown, field: FieldConfig) => string

const formatters: Record<string, Formatter> = {
    boolean: (value) => value === true ? 'Yes' : 'No',
    // An ISO date shows its day.
    date: (value) => String(value).slice(0, 10),
    // The text of a rich-text value, without the marks. Each block and line break is a space.
    richtext: (value, { format }) =>
        (format === 'markdown' ? markdownToHtml(String(value)) : String(value))
            .replace(/<br>|<\/(?:p|h2|h3|li|blockquote)>/g, ' ')
            .replace(/<[^>]*>/g, '')
            .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ')
            .trim(),
}

const plain = (value: unknown): string =>
    Array.isArray(value) ? value.map((item) => plain(item)).join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value)

// The text that shows a value in a table cell.
export const displayValue = (field: FieldConfig, value: unknown): string =>
    value === undefined || value === null || value === '' ? '' : (formatters[field.type] ?? plain)(value, field)
