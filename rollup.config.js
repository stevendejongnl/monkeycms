import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import swc from '@rollup/plugin-swc'
import { visualizer } from 'rollup-plugin-visualizer'


const swcConfig = {
    minify: true,
    jsc: {
        target: "es2022"
    }
}

const bundleConfig = {
    input: './src/main.ts',
    output: [
        {
            file: './dist/bundle.min.js',
            sourcemap: 'inline',
            format: 'umd',
            name: 'MonkeyCMS',
        }
    ],
    plugins: [
        json(),
        resolve(),
        commonjs(),
        typescript(),
        visualizer({
            filename: './dist/stats.html',
            sourcemap: true
        }),
        swc({
            swc: swcConfig
        }),
    ]
}

export default [
    bundleConfig
]

