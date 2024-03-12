import { expect, fixture, html } from '@open-wc/testing'
import { MonkeySetUp, SET_UP_STORE } from './set-up.js'


describe('SetUp', () => {
    let setUp: MonkeySetUp
    beforeEach(async () => {
        setUp = await fixture(html`<monkey-set-up get-set-up-endpoint="/get-set-up"></monkey-set-up>`)
    })

    it('should render', () => expect(setUp).to.be.instanceOf(MonkeySetUp))

    it('should store some set-up data', () => {
        const store = localStorage.getItem(SET_UP_STORE) || ''

        expect(JSON.parse(store)).to.deep.equal({
            'some-key': 'some-value'
        })
    })
})
