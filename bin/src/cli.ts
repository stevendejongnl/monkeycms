#!/usr/bin/env node

import { styleText } from 'node:util'
import { help, parse, version } from './helper.js'
import { serve } from './commands/serve.js'
import { build } from './commands/build.js'

const { positionals, values } = parse()
const command = positionals[0]

if (values.version) {
  console.log(version())
} else if (values.help) {
  console.log(help)
} else {
  switch (command) {
    case 'help':
    case 'h':
      console.log(help)
      break
    case 'serve':
    case 's':
      serve()
      break
    case 'build':
    case 'b':
      build()
      break
    case 'test':
    case 't':
      console.log(styleText('green', 'Testing project...'))
      break
    case 'publish':
    case 'p':
      console.log(styleText('green', 'Publishing project...'))
      break
    default:
      console.log(styleText('red', 'Command not found'))
      console.log(help)
      process.exitCode = 1
      break
  }
}
