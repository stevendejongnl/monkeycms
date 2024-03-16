import chalk from 'chalk'
import { spawn } from 'child_process'

export const build = () => {
    console.log(chalk.green('Remove previous build...'))
    const pre_build = spawn('npx', ['rimraf', '-g', './dist/', './tsconfig.tsbuildinfo'], { stdio: 'inherit' })
    pre_build!.stdout?.on('data', (data) => {
        console.log(data.toString())
    })

    console.log(chalk.green('Transpiling TypeScript'))
    const js_build = spawn('npx', ['tspc', '-b'], { stdio: 'inherit' })
    js_build!.stdout?.on('data', (data) => {
        console.log(data.toString())
    })

    console.log(chalk.green('Transpiling Sass'))
    const css_build = spawn('npx', ['sass', '--no-source-map', './src/main.scss', './dist/main.css'], { stdio: 'inherit' })
    css_build!.stdout?.on('data', (data) => {
        console.log(data.toString())
    })
}
