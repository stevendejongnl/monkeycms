import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { htmlToMarkdown, markdownToHtml } from './markdown.ts'


describe('markdownToHtml', () => {
    it('should make headings, paragraphs and quotes', () => {
        assert.equal(markdownToHtml('# One\n\n### Three\n\nText\nmore\n\n> quoted\n> lines'),
            '<h2>One</h2><h3>Three</h3><p>Text more</p><blockquote>quoted lines</blockquote>')
    })

    it('should make bullet and numbered lists, with a line break inside an item', () => {
        assert.equal(markdownToHtml('- a\n- b  \n  c\n\n1. x\n2) y'), '<ul><li>a</li><li>b<br>c</li></ul><ol><li>x</li><li>y</li></ol>')
    })

    it('should make bold and italic, with * and with _', () => {
        assert.equal(markdownToHtml('**b** *i* __b__ _i_ snake_case_name'), '<p><strong>b</strong> <em>i</em> <strong>b</strong> <em>i</em> snake_case_name</p>')
    })

    it('should make a hard break from two spaces at the end of a line', () => {
        assert.equal(markdownToHtml('a  \nb'), '<p>a<br>b</p>')
    })

    it('should escape all HTML, so the text cannot add markup', () => {
        assert.equal(markdownToHtml('<script>alert(1)</script> & <img src=x onerror=y>'),
            '<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &lt;img src=x onerror=y&gt;</p>')
        assert.equal(markdownToHtml('[a](javascript:x) `c`'), '<p>[a](javascript:x) `c`</p>')
    })

    it('should read a backslash as an escape', () => {
        assert.equal(markdownToHtml('\\*not italic\\* \\# \\> end'), '<p>*not italic* # &gt; end</p>')
    })

    it('should give nothing for an empty text', () => {
        assert.equal(markdownToHtml(''), '')
        assert.equal(markdownToHtml('\n\n  \n'), '')
    })
})

describe('htmlToMarkdown', () => {
    it('should write each block', () => {
        assert.equal(htmlToMarkdown('<h2>One</h2><h3>Three</h3><p>Text <strong>bold</strong> and <em>it</em></p><blockquote>q</blockquote>'),
            '## One\n\n### Three\n\nText **bold** and *it*\n\n> q')
        assert.equal(htmlToMarkdown('<ul><li>a</li><li>b<br>c</li></ul><ol><li>x</li><li>y</li></ol>'), '- a\n- b  \n  c\n\n1. x\n2. y')
    })

    it('should decode entities and escape what Markdown reads', () => {
        assert.equal(htmlToMarkdown('<p>1 &lt; 2 &amp; *a* _b_</p>'), '1 < 2 & \\*a\\* \\_b\\_')
    })

    it('should keep a paragraph that looks like a block a paragraph', () => {
        assert.equal(htmlToMarkdown('<p># not a heading</p><p>- not a list</p><p>1. not a list</p>'), '\\# not a heading\n\n\\- not a list\n\n\\1. not a list')
    })

    it('should give nothing for no blocks', () => {
        assert.equal(htmlToMarkdown(''), '')
        assert.equal(htmlToMarkdown('<p></p>'), '')
    })
})

describe('round trip', () => {
    const texts = [
        '## Title\n\nSome **bold** and *italic* text.\n\n- one\n- two\n\n1. first\n2. second\n\n> a quote',
        'a  \nb',
        '\\# literal\n\n\\- literal\n\n\\*stars\\* and \\_under\\_',
        '- a  \n  b\n- c',
    ]

    for (const text of texts) {
        it(`should keep ${JSON.stringify(text.slice(0, 20))}`, () => {
            assert.equal(htmlToMarkdown(markdownToHtml(text)), text)
        })
    }
})
