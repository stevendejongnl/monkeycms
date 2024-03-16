#!/usr/bin/env node

import chalk from 'chalk'
import { helper } from './helper.js'
import { serve } from './commands/serve.js'
import { build } from './commands/build.js'

const command = helper.input[0]

switch (command) {
  case 'help':
  case 'h':
    helper.showHelp()
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
    console.log(chalk.green('Testing project...'))
    break
  case 'publish':
  case 'p':
    console.log(chalk.green('Publishing project...'))
    break
  default:
    console.log(chalk.red('Command not found'))
    helper.showHelp()
    break
}

