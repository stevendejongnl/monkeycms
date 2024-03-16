import { spawn } from 'child_process'

export const serve = () => {
    const child = spawn('npx', ['http-server', './public'], { stdio: 'inherit' })
    child!.stdout?.on('data', (data) => {
        console.log(data.toString())
    })
}
