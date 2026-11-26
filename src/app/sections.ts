import type { CollectionConfig, FieldConfig } from '../config/main.ts'


export interface EditorSection {
    // Empty when the collection has no sections: one group without a title.
    readonly title: string
    readonly fields: readonly (readonly [string, FieldConfig])[]
}

const OTHER = 'Other'

// The groups of fields that the editor shows. A collection without sections is one group
// without a title. With sections, a field that is in none of them goes in a last group.
export const sectionsOf = ({ fields, sections }: Pick<CollectionConfig, 'fields' | 'sections'>): readonly EditorSection[] => {
    if (sections === undefined) {
        return [{ title: '', fields: Object.entries(fields) }]
    }

    const named = new Set(sections.flatMap((section) => section.fields))
    const grouped = sections.map(({ title, fields: names }): EditorSection => ({
        title,
        fields: names.flatMap((name) => fields[name] === undefined ? [] : [[name, fields[name]] as const]),
    }))
    const rest = Object.entries(fields).filter(([name]) => !named.has(name))

    return rest.length === 0 ? grouped : [...grouped, { title: OTHER, fields: rest }]
}
