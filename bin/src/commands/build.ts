import { spawnSync } from 'node:child_process'
import { styleText } from 'node:util'

export const build = () => {
    console.log(styleText('green', 'Building project...'))
    const { status } = spawnSync('npm', ['run', 'build'], { stdio: 'inherit' })

    process.exitCode = status ?? 1
}
