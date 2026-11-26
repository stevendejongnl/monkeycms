import { styleText } from 'node:util'
import { checkConfig, probe, readConfigFile } from './check.ts'
import type { Line } from './check.ts'


const print = (lines: readonly Line[], indent: string): void =>
    lines.forEach(({ ok, text }) => console.log(`${indent}${ok ? styleText('green', '✓') : styleText('red', '✗')} ${text}`))

// Runs the check and writes the report. It returns the exit code: 0 when everything is fine.
export const runCheck = async (file: string, withProbe: boolean): Promise<number> => {
    let input: unknown

    try {
        input = await readConfigFile(file)
    } catch (error) {
        console.error(styleText('red', (error as Error).message))

        return 1
    }

    const { config, lines } = checkConfig(input)

    print(lines, '')

    if (config === undefined) {
        return 1
    }

    if (!withProbe) {
        return 0
    }

    const probes = await probe(config)

    probes.forEach(({ collection, lines: found }) => {
        console.log(`\n${collection}`)
        print(found, '  ')
    })

    return probes.flatMap(({ lines: found }) => found).every(({ ok }) => ok) ? 0 : 1
}
