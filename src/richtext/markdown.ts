// Markdown for the rich-text field. It is the small set that the toolbar can make: headings,
// paragraphs, bullet and numbered lists, quotes, bold and italic. The HTML side is the HTML
// that sanitizeHtml gives: no attributes, and only these tags: p, h2, h3, ul, ol, li,
// blockquote, strong, em and br. Everything else in a Markdown text shows as plain text.

const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const unescapeHtml = (text: string): string => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

const ESCAPABLE = '\\*_#>+-.!'

const BLOCK_TAGS = /<(p|h2|h3|ul|ol|blockquote)>([\s\S]*?)<\/\1>/g

// The text of an HTML fragment as Markdown: the marks become ** and *, br becomes a hard break
// and the characters that Markdown reads are escaped.
const inlineToMarkdown = (html: string, lineBreak: string): string =>
    html.split(/(<\/?(?:strong|em)>|<br>)/).map((part) =>
        part === '<strong>' || part === '</strong>' ? '**'
            : part === '<em>' || part === '</em>' ? '*'
                : part === '<br>' ? lineBreak
                    : unescapeHtml(part).replace(/[\\*_]/g, '\\$&')).join('')

// A line that starts like a block gets a backslash, so it stays a paragraph.
const guardLineStart = (line: string): string => line.replace(/^(\s*)(#|>|[-+](?=\s)|\d+(?=[.)]\s))/, '$1\\$2')

const blockToMarkdown = (tag: string, inner: string): string => {
    if (tag === 'h2' || tag === 'h3') {
        return `${tag === 'h2' ? '##' : '###'} ${inlineToMarkdown(inner, ' ').trim()}`
    }

    if (tag === 'ul' || tag === 'ol') {
        return [...inner.matchAll(/<li>([\s\S]*?)<\/li>/g)]
            .map(([, item = ''], index) => `${tag === 'ul' ? '-' : `${index + 1}.`} ${inlineToMarkdown(item, '  \n  ').trim()}`)
            .join('\n')
    }

    const text = inlineToMarkdown(inner, '  \n').trim()

    return tag === 'blockquote'
        ? text.split('\n').map((line) => `> ${line}`).join('\n')
        : text.split('\n').map(guardLineStart).join('\n')
}

// Markdown from the HTML of sanitizeHtml.
export const htmlToMarkdown = (html: string): string =>
    [...html.matchAll(BLOCK_TAGS)]
        .map(([, tag = '', inner = '']) => blockToMarkdown(tag, inner))
        .filter((block) => block.trim() !== '')
        .join('\n\n')

// Bold and italic, and the hard break. It works on text that has no HTML in it any more.
const inlineToHtml = (markdown: string): string => {
    const escaped: string[] = []
    const kept = markdown
        .replace(new RegExp(`\\\\([${ESCAPABLE.replace(/[\\\]-]/g, '\\$&')}])`, 'g'), (_, character: string) => `${escaped.push(character) - 1}`)

    return escapeHtml(kept)
        .replace(/ {2,}\n/g, '<br>')
        .replace(/\n/g, ' ')
        .replace(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g, '<strong>$2</strong>')
        .replace(/\*(?=\S)(.+?)(?<=\S)\*/g, '<em>$1</em>')
        .replace(/(?<![\w])_(?=\S)(.+?)(?<=\S)_(?!\w)/g, '<em>$1</em>')
        .replace(/(\d+)/g, (_, index: string) => escapeHtml(escaped[Number(index)] ?? ''))
}

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/
const QUOTE = /^>\s?(.*)$/
const BULLET = /^[-*+]\s+(.*)$/
const NUMBER = /^\d+[.)]\s+(.*)$/
const CONTINUATION = /^ {2,}\S/

const startsBlock = (line: string): boolean =>
    HEADING.test(line) || QUOTE.test(line) || BULLET.test(line) || NUMBER.test(line)

// The HTML of a Markdown text. All HTML in the text is escaped, so the result can only have the
// tags that this function writes.
export const markdownToHtml = (markdown: string): string => {
    const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
    const blocks: string[] = []
    let index = 0

    const collect = (keep: (line: string) => boolean): string[] => {
        const taken: string[] = []

        while (index < lines.length && keep(lines[index] ?? '')) {
            taken.push(lines[index] ?? '')
            index += 1
        }

        return taken
    }

    while (index < lines.length) {
        const line = lines[index] ?? ''
        const heading = HEADING.exec(line)

        if (line.trim() === '') {
            index += 1
        } else if (heading !== null) {
            blocks.push(`<${(heading[1] ?? '').length <= 2 ? 'h2' : 'h3'}>${inlineToHtml(heading[2] ?? '')}</${(heading[1] ?? '').length <= 2 ? 'h2' : 'h3'}>`)
            index += 1
        } else if (QUOTE.test(line)) {
            const quoted = collect((next) => QUOTE.test(next)).map((next) => QUOTE.exec(next)?.[1] ?? '')

            blocks.push(`<blockquote>${inlineToHtml(quoted.join('\n').trim())}</blockquote>`)
        } else if (BULLET.test(line) || NUMBER.test(line)) {
            const ordered = NUMBER.test(line)
            const marker = ordered ? NUMBER : BULLET
            const items: string[] = []

            while (index < lines.length && marker.test(lines[index] ?? '')) {
                const item = [marker.exec(lines[index] ?? '')?.[1] ?? '']

                index += 1
                item.push(...collect((next) => CONTINUATION.test(next)).map((next) => next.slice(2)))
                items.push(`<li>${inlineToHtml(item.join('\n').trim())}</li>`)
            }

            blocks.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`)
        } else {
            const text = collect((next) => next.trim() !== '' && !startsBlock(next))

            blocks.push(`<p>${inlineToHtml(text.join('\n').trim())}</p>`)
        }
    }

    return blocks.join('')
}
