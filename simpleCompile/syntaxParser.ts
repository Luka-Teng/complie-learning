import lexicalParser from './lexicalParser'

/**
 * 语法解析工具
 * 
 * 文法:
 * root = {[statement]}
 * statement = letDeclaration | assignStatement | ifStatement | blockStatement
 * 
 * 块语句
 * blockStatement = '{', {[statement]} ,'}'
 * 
 * if语句
 * ifStatement = 'if', '(', assignStatement, ')', blockStatement
 * 
 * 声明语句
 * letDeclaration = 'let', 'identifier', ['=', assignStatement]
 * 
 * 表达式语句
 * exprStatement = orExpr
 * 
 * 赋值语句, 右结合性
 * assignStatement = 'identifier', '=', assignStatement | exprStatement
 * 
 * addExpr = addExpr, '+', multiExpr | addExpr, '-', multiExpr | multiExpr
 * multiExpr = multiExpr, '*', number | multiExpr, '/', number | number
 * 
 * 由于上面表达式会产生左递归问题，所以可以使用循环迭代代替左递归
 * addExpr = multiExpr, {['+', multiExpr | '-', multiExpr]}
 * multiExpr = number, {['*', number | '/', number]}
 * 
 * or表达式
 * orExpr = orExpr, '||', andExpr | andExpr
 * orExpr = andExpr, {['||', andExpr]}
 * 
 * and表达式
 * andExpr = andExpr, '&&', equalExpr | equalExpr
 * andExpr = equalExpr, {['||', equalExpr]}
 * 
 * ===表达式
 * equalExpr = addExpr, {['===', addExpr | '!==', addExpr]}
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
      children: multiRead(readStatement)
    }

    const end = readToken('$')
    if (!end) {
      castError()
    }

    return node
  }

  const readStatement = () => {
    return orRead(readLetDeclaration, readAssignStatement, readIfStatement, readBlockStatement)
  }

  /**
   * 解析左结合的二元表达式 expr1 operator expr2
   * @param {Function} operator 操作符
   */
  const readBinaryExpr = (
    expr1: Function,
    operator: Function,
    expr2: Function,
  ) => {
    const first = expr1()

    if (first) {
      const nextNodes = multiRead(() => {
        const _operator = operator()

        if (_operator) {
          const node = expr2()
          if (!node) {
            castError(`invalid binaryExpr ${_operator}`)
          }
          return [_operator, node]
        }

        return null
      }) as any[]

      if (nextNodes.length > 0) {
        return [first, ...nextNodes].reduce((firstNode, secondNode) => createNode('binaryExpr', [secondNode[0], firstNode, secondNode[1]]))
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
          if (readToken('assign')) {
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
          children: assignNode ? [createNode('identifier', id), assignNode] : [createNode('identifier', id)]
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
        const assign = readToken('assign')
        if (assign) {
          const node = readAssignStatement()

          if (node) {
            return createNode('assignStatement', [id, node])
          }

          castError('invalid assignStatement')
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
   * andExpr = andExpr, {['&&', andExpr]}
   */
  const readOrExpr = () => readBinaryExpr(
    readAndExpr,
    () => readToken('or'),
    readAndExpr
  )

  /**
   * 读取and表达式
   * andExpr = equalExpr, {['&&', equalExpr]}
   */
  const readAndExpr = () => readBinaryExpr(
    readEqualExpr,
    () => readToken('and'),
    readEqualExpr
  )

  /**
   * 读取等式表达式
   * equalExpr = addExpr, {['===', addExpr | '!==', addExpr]}
   */
  const readEqualExpr = () => readBinaryExpr(
    readAddExpr,
    () => orRead(() => readToken('equal'), () => readToken('unequal')),
    readAddExpr
  )

  /**
   * 读取加法表达式
   * addExpr = multiExpr, {[('+' | '-)', multiExpr]}
   * 这边为了保证左结合性，需要手动迭代去生成节点
   */
  const readAddExpr = () => readBinaryExpr(
    readMultiExpr,
    () => orRead(() => readToken('operator', '+'), () => readToken('operator', '-')),
    readMultiExpr
  )

  /**
   * 读取乘法表达式
   * multiExpr = number, {['*', number | '/', number]}
   */
  const readMultiExpr = () => readBinaryExpr(
    () => orRead(readNumber, readIdentifier),
    () => orRead(() => readToken('operator', '*'), () => readToken('operator', '/')),
    () => orRead(readNumber, readIdentifier)
  )

  /**
   * 读取块语句
   * blockStatement = '{', {[statement]} ,'}'
   */
  const readBlockStatement = () => {
    if (readToken('braces', '{')) {
      const node = createNode('blockStatement', multiRead(readStatement))
      if (readToken('braces', '}')) {
        return node
      }
      castError(`invalid blockStatement`)
    }

    return null
  }

  /**
   * 读取if语句
   * ifStatement = 'if', '(', assignStatement, ')', blockStatement
   * 繁琐语句的情况下，当前的写法及其没有效率，需要改成latex模式
   */
  const readIfStatement = () => {
    if (readToken('if')) {
      if (readToken('parentheses', '(')) {
        const assignment = readAssignStatement()
        if (readToken('parentheses', ')') && assignment) {
          const blockStatement = readBlockStatement()
          if ( blockStatement) {
            return createNode('ifStatement', [assignment, blockStatement])
          }
        }
      }
      castError('invalid ifStatement')
    }
    return null
  }

  return readRoot()
}

export default syntaxParser