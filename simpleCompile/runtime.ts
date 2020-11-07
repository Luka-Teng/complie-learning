/**
 * 运行时工具
 * 为ast提供运行环境
 */
import * as chalk from 'chalk'

// 运行时工具
class Runtime {
  // 变量定义
  private variables: Record<string, any> = {}

  //判断变量是否定义过
  private isDefined = (varName: string) => {
    return this.variables.hasOwnProperty(varName)
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
        if (this.isDefined(id)) {
          return this.variables[id]
        }
        throw new Error(`variable ${id} has not defined`)
      }

      case 'letDeclaration': {
        const letName = node.children[0].children

        // let不能重复声明
        if (this.isDefined(letName)) {
          throw new Error(`variable ${letName} has been defined`)
        }
        
        const value = node.children[1] ? this.evaluate(node.children[1]) : undefined
        this.variables[letName] = value
        return value
      }

      case 'assignStatement': {
        const id = node.children[0].children

        if (!this.isDefined(id)) {
          throw new Error(`variable ${id} has not defined`)
        }

        const value = this.evaluate(node.children[1])
        this.variables[id] = value
        return value
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
      }
    }
  }
}

export default Runtime