// Makes HTML safe for the rich-text field. The result has only these tags, and no attributes:
// p, h2, h3, ul, ol, li, blockquote, strong, em and br. The page is parsed in an inert
// document (no script runs, no image loads), and the result is built again from the allowed
// parts only. Text is escaped, so nothing from the input is passed on as markup.

const DROP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'HEAD', 'TITLE', 'META', 'LINK', 'TEXTAREA', 'SELECT', 'INPUT', 'BUTTON'])

const BLOCKS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE', 'NAV', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'FIGURE', 'FIGCAPTION', 'FORM', 'FIELDSET', 'DL', 'DT', 'DD', 'ADDRESS', 'HR'])

const escapeText = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const MARKS: Readonly<Record<string, string>> = { B: 'strong', STRONG: 'strong', I: 'em', EM: 'em', CITE: 'em' }

const isElement = (node: Node): node is Element => node.nodeType === Node.ELEMENT_NODE

const trimBreaks = (html: string): string => html.replace(/^(\s|<br>)+|(\s|<br>)+$/g, '')

// The inline content of a node: text, marks and line breaks. A block inside it becomes a line.
const inline = (parent: Node): string => {
    let html = ''

    for (const node of parent.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            html += escapeText((node.textContent ?? '').replace(/[\s ]+/g, ' '))
        } else if (isElement(node) && !DROP.has(node.tagName.toUpperCase())) {
            const tag = node.tagName.toUpperCase()
            const mark = MARKS[tag]
            const inner = inline(node)

            if (tag === 'BR') {
                html += '<br>'
            } else if (BLOCKS.has(tag)) {
                html += trimBreaks(html) === '' ? inner : `<br>${inner}`
            } else if (mark !== undefined) {
                html += inner.trim() === '' ? inner : `<${mark}>${inner}</${mark}>`
            } else {
                html += inner
            }
        }
    }

    return html
}

const block = (tag: string, content: string): string => {
    const inner = trimBreaks(content)

    return inner === '' ? '' : `<${tag}>${inner}</${tag}>`
}

const list = (tag: 'ul' | 'ol', element: Element): string =>
    block(tag, [...element.children]
        .filter((child) => child.tagName.toUpperCase() === 'LI')
        .map((item) => block('li', inline(item)))
        .join(''))

// The blocks of a node. Text and marks that are not in a block go in a paragraph.
const blocks = (parent: Node): string => {
    let html = ''
    let run: Node[] = []

    const flush = (): void => {
        const holder = document.createElement('div')

        holder.append(...run.map((node) => node.cloneNode(true)))
        html += block('p', inline(holder))
        run = []
    }

    for (const node of parent.childNodes) {
        const tag = isElement(node) ? node.tagName.toUpperCase() : ''

        if (isElement(node) && DROP.has(tag)) {
            continue
        }

        if (!isElement(node) || !BLOCKS.has(tag) || tag === 'HR') {
            run.push(node)
            continue
        }

        flush()

        if (/^H[12]$/.test(tag)) {
            html += block('h2', inline(node))
        } else if (/^H[3-6]$/.test(tag)) {
            html += block('h3', inline(node))
        } else if (tag === 'P' || tag === 'PRE') {
            html += block('p', inline(node))
        } else if (tag === 'BLOCKQUOTE') {
            html += block('blockquote', inline(node))
        } else if (tag === 'UL' || tag === 'OL') {
            html += list(tag === 'UL' ? 'ul' : 'ol', node)
        } else {
            html += blocks(node)
        }
    }

    flush()

    return html
}

export const sanitizeHtml = (html: string): string =>
    blocks(new DOMParser().parseFromString(html, 'text/html').body)
