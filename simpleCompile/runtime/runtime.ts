/**
 * 运行时工具
 * 为ast提供运行环境
 */
import * as chalk from 'chalk'
import Frame from './frame'

// 运行时工具
class Runtime {
  // 变量定义
  private stacks: Frame[] = [new Frame()]

  private get currentFrame () {
    return this.stacks[this.stacks.length - 1]
  }

  // 解析ast
  public evaluate = (node: any) => {
    switch  (node.type) {
      // 跟节点输出最后结果
      case 'root': {
        const result = node.children.map(this.evaluate)
        const length = result.length
        if (length > 0) {
          console.log(chalk.magentaBright(result[length - 1]))
          return
        }
        break;
      }

      // number类型直接返回
      case 'number': {
        return parseInt(node.children)
      }

      // identifier类型需要判断变量是否存在，后返回
      case 'identifier': {
        const id = node.children
        if (this.currentFrame?.hasScopedKey(id)) {
          return this.currentFrame.getScopedValue(id)
        }
        throw new Error(`variable ${id} has not defined`)
      }

      case 'letDeclaration': {
        const letName = node.children[0].children
        // let不能重复声明
        if (this.currentFrame?.hasOwnKey(letName)) {
          throw new Error(`variable ${letName} has been defined`)
        }
        
        const value = node.children[1] ? this.evaluate(node.children[1]) : undefined
        this.currentFrame?.setOwnValue(letName, value)
        return value
      }

      case 'assignStatement': {
        const id = node.children[0].children

        if (!this.currentFrame?.hasScopedKey(id)) {
          throw new Error(`variable ${id} has not defined`)
        }

        const value = this.evaluate(node.children[1])
        this.currentFrame?.setScopedValue(id, value)
        return value
      }

      case 'blockStatement': {
        // 块级作用域
        this.stacks.push(new Frame(this.currentFrame))
        const result = node.children.map(this.evaluate)
        this.stacks.pop()
        return result[result.length - 1]
      }

      case 'ifStatement': {
        const ifValue = this.evaluate(node.children[0])

        if (ifValue) {
          return this.evaluate(node.children[1])
        }

        return undefined
      }

      case 'binaryExpr': {
        const [operator, child1, child2] = node.children

        if (operator === '+') {
          return this.evaluate(child1) + this.evaluate(child2)
        }

        if (operator === '-') {
          return this.evaluate(child1) - this.evaluate(child2)
        }

        if (operator === '*') {
          return this.evaluate(child1) * this.evaluate(child2)
        }

        if (operator === '/') {
          return this.evaluate(child1) / this.evaluate(child2)
        }

        if (operator === '||') {
          return this.evaluate(child1) || this.evaluate(child2)
        }

        if (operator === '&&') {
          return this.evaluate(child1) && this.evaluate(child2)
        }

        if (operator === '===') {
          return this.evaluate(child1) === this.evaluate(child2)
        }

        if (operator === '!==') {
          return this.evaluate(child1) !== this.evaluate(child2)
        }
      }
    }
  }
}

export default Runtime