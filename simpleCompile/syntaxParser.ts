import lexicalParser from './lexicalParser'

/**
 * 语法解析工具
 * 
 * 文法:
 * root = {[statement]}
 * statement = letDeclaration | assignStatement
 * 
 * 声明语句
 * letDeclaration = 'let', 'identifier', ['=', assignStatement]
 * 
 * 表达式语句
 * exprStatement = orExpr
 * 
 * 赋值语句, 右结合性
 * assignStatement = 'identifier', assignStatement | exprStatement
 * 
 * 由于乘法表达式的优先级高于加法，所以乘法表达式为加法表达式的子表达式
 * addExpr = addExpr, '+', multiExpr | multiExpr
 * multiExpr = multiExpr, '*', number | number
 * 
 * 由于上面表达式会产生左递归问题，所以可以使用循环迭代代替左递归
 * addExpr = multiExpr, {['+', multiExpr]}
 * multiExpr = number, {['*', number]}
 * 
 * or表达式
 * orExpr = orExpr, '||', andExpr | andExpr
 * =>
 * orExpr = andExpr, {['||', andExpr]}
 * 
 * and表达式
 * andExpr = andExpr, '&&', addExpr | addExpr
 * andExpr = addExpr, {['||', addExpr]}
 */

/**
 * 这种写法不如抛错拦截来的舒服，需要调整, 缺点在于要写很多if来判断错误
 * 规定产生回溯的表达式返回null
 * 产生错误的表达式直接抛出错误
 */
const syntaxParser = (input: string) => {
  const tokens = lexicalParser(input)
  let index = 0
  let longestIndex = 0

  /**
   * 抛出错误
   * @param { string } msg 错误信息
   */
  const castError = (msg?: string) => {
    const newMsg = msg ? `parsing error in ${tokens[index].end}: ${msg}` : `parsing error: position ${tokens[longestIndex].start}`
    throw new Error(newMsg)
  }

  /**
   * 创建节点
   * @param {string} type 节点类型
   * @param {any} children 子元素
   */
  const createNode = (type: string, children: any = null) => {
    return {
      type,
      children
    }
  }

  // 预读token
  const peek = (step = 0) => {
    const token = tokens[index + step]

    if (token && index > longestIndex) {
      longestIndex = index
    }

    return token || null
  }

  // 读取token
  const read = () => {
    const token = peek()
    if (token) {
      index++
    }
    return token
  }

  /**
   * 判断下个token是否符合预期
   * @param {string} type token类型
   * @param {string} match token具体值
   */
  const readToken = (type: string, match?: string) => {
    const token = peek()

    if (token === null || token.type !== type || (match && token.match !== match)) {
      return null
    }

    read()
    return token.match
  }

  // 读取number
  const readNumber = () => {
    const number = readToken('number')
    if (number) {
      return createNode('number', number)
    }
    return null
  }

  // 读取Identifier
  const readIdentifier = () => {
    const id = readToken('identifier')
    if (id) {
      return createNode('identifier', id)
    }
    return null
  }

  /**
   * 读取一个表达式n次，直到return null
   * 对应表达式expr1 = {[expr2]} 或者 expr1 = {expr2}
   * @param {Function} reading 表达式
   * @param {boolean} allowEmpty 是否允许为空
   */
  const multiRead = (reading: Function, allowEmpty = true) => {
    const statements: any[] = []
    let currentIndex = index

    while (index < tokens.length) {
      const node = reading()
      if (node) {
        currentIndex = index
        statements.push(node)
      } else {
        index = currentIndex
        break
      }
    }

    if (!allowEmpty && statements.length === 0) {
      return null
    }

    return statements
  }

  /**
   * 回溯多个表达式
   * 对应表达式expr1 = expr2 | expr3
   */
  const orRead = (...readings: Function[]) => {
    let node: any = null
    const currentIndex = index

    for (let reading of readings) {
      node = reading()

      if (!node) {
        index = currentIndex
      } else {
        break
      }
    }

    return node
  }

  /**
   * 是否存在表达式
   * 对应表达式expr1 = [expr2]
   */
  const existRead = (reading: Function) => {
    const currentIndex = index
    const node = reading()

    if (node) {
      return node
    }

    index = currentIndex
    return null
  }

  /**
   * 读取根节点
   * root = {[letDeclaration | assignStatement ]}
   */
  const readRoot = () => {
    readToken('^')
    const node = {
      type: 'root',
      children: multiRead(() => orRead(readLetDeclaration, readAssignStatement))
    }

    const end = readToken('$')
    if (!end) {
      castError()
    }

    return node
  }

  /**
   * 左结合性公式
   * 读取expr = expr, {['token', expr]}形式
   * @param {'left' | 'right'} associativity 结合性
   */
  const readAssociativeExpr = (
    symbol: Function,
    expr: Function,
    nodeName: string,
    associativity: 'left' | 'right' = 'left',
    errorMsg?: string,
  ) => {
    const first = expr()

    if (first) {
      // 读取{['token', expr]}形式
      const nextNodes = multiRead(() => {
        const _symbol = symbol()

        if (_symbol) {
          const node = expr()
          if (!node) {
            castError(errorMsg)
          }
          return node
        }

        return null
      }) as any[]

      if (nextNodes.length > 0) {
        if (associativity === 'left') {
          return [first, ...nextNodes].reduce((firstNode, secondNode) => createNode(nodeName, [firstNode, secondNode]))
        }

        if (associativity === 'right') {
          return [first, ...nextNodes].reverse().reduce((firstNode, secondNode) => createNode(nodeName, [secondNode, firstNode]))
        }
      }
    }

    return first
  }

  /**
   * 声明语句
   * letDeclaration = 'let', 'identifier', ['=', assignStatement]
   */
  const readLetDeclaration = () => {
    if (readToken('let')) {
      const id = readToken('identifier')
      if (id) {
        const assignNode = existRead(() => {
          if (readToken('equal')) {
            const assignNode = readAssignStatement()
            if (assignNode) {
              return assignNode
            }
            castError('invalid letDeclaration')
          }
          return null
        })

        return {
          type: 'letDeclaration',
          children: assignNode ? [id, assignNode] : [id]
        }
      }
      castError('invalid letDeclaration')
    }

    return null
  }

  /**
   * 读取赋值表达式, 右结合性
   * assignStatement = 'identifier', '=', assignStatement | exprStatement
   */
  const readAssignStatement = () => {
    return orRead(() => {
      const id = readIdentifier()

      if (id) {
        const equal = readToken('equal')
        if (equal) {
          const node = readAssignStatement()

          if (node) {
            return createNode('assign', [id, node])
          }

          castError('invalid assignExpr')
        }
      }
      
      return null
    }, readExprStatement)
  }

  // 表达式语句
  const readExprStatement = () => {
    return readOrExpr()
  }

  /**
   * 读取or表达式
   * andExpr = addExpr, {['&&', addExpr]}
   */
  const readOrExpr = () => readAssociativeExpr(
    () => readToken('or'),
    readAndExpr,
    'or',
    'left',
    'invalid orExpr'
  )

  /**
   * 读取and表达式
   * andExpr = addExpr, {['&&', addExpr]}
   */
  const readAndExpr = () => readAssociativeExpr(
    () => readToken('and'),
    readAddExpr,
    'and',
    'left',
    'invalid andExpr'
  )

  /**
   * 读取加法表达式
   * addExpr = multiExpr, {['+' multiExpr]}
   * 这边为了保证左结合性，需要手动迭代去生成节点
   */
  const readAddExpr = () => readAssociativeExpr(
    () => readToken('operator', '+'),
    readMultiExpr,
    'add',
    'left',
    'invalid addExpr'
  )

  /**
   * 读取乘法表达式
   * multiExpr = number, {['*', number]}
   */
  const readMultiExpr = () => readAssociativeExpr(
    () => readToken('operator', '*'),
    () => orRead(readNumber, readIdentifier),
    'multi',
    'left',
    'invalid multiExpr'
  )

  return readRoot()
}

console.log(JSON.stringify(syntaxParser('let a = aaa')))