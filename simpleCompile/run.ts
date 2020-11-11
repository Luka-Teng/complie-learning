import * as chalk from 'chalk'
import * as readline from 'readline'
import * as process from 'process'
import syntaxParser from './syntaxParser'
import Runtime from './runtime/runtime'

// 运行代码
const run = () => {
  const runtime = new Runtime()

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  console.log(chalk.green('runtime start, please input something:'));

  rl.on('line', (input) => {
    try {
      runtime.evaluate(syntaxParser(input))
    } catch (e) {
      console.log(chalk.red(e.message))
    }
  })

  rl.on('close', () => {
    console.log(chalk.green('runtime closed'));
  })
}

run()