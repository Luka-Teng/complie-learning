/**
 * 化学latex语法解析工具
 */
import { tokenize, TokenRuleListType } from './tokenize'

/**
 * 词法规则定义
 */
export const tokenRuleList: TokenRuleListType = [
  {
    type: 'command',
    match: /^\\[a-zA-Z]+/
  },
  {
    type: 'arrow',
    match: /^(<->|<-->|<<=>|<=>>|<=>|<-|->)/
  },
  {
    type: 'bracket',
    match: /^(\[|\])/
  },
  {
    type: 'parentheses',
    match: /^(\{|\})/
  },
  {
    type: 'space',
    match: /^\s+/
  },
  {
    type: 'supscript',
    match: /^\^/
  },
  {
    type: 'subscript',
    match: /^\_/
  },
  {
    type: 'char',
    match: (input: string) => {
      if (input[0] === '\\' && input[1] !== undefined) {
        return '\\' + input[1]
      }

      if (input[0]) {
        return input[0]
      }
      
      return null
    }
  }
]

/**
 * 化学latex的语法规则
 * 可参考扩展巴科斯范式： https://zh.wikipedia.org/zh-sg/%E6%89%A9%E5%B1%95%E5%B7%B4%E7%A7%91%E6%96%AF%E8%8C%83%E5%BC%8F
 * 
 * 符号含义
 * []: 一次或零次
 * {}: 一次或多次
 * {[]}: 零次或多次
 * n * Expr: n个Expr
 * -: 除了/非
 * ,: 连接符号
 * |: 或
 * 
 * Grammar = 'token-^', ChemStatements, 'token-$'
 * ChemStatements = {[ ChemStatement ]}
 * ChemStatement = ChemExpr | MathBlockStatement ｜ MathDollarStatement ｜ chemUnknown
 * ChemBlockStatement = '{' , ChemStatements , '}'
 *
 * ChemExpr = ChemFracExpr | ChemArrowExpr | chemScriptExpr | chemCondenseExpr | chemFloatExpr | chemBondExpr | chemEzfracExpr
 * ChemBracketStatement = '[' , ChemStatements , ']'
 * 
 * 化学的frac表达式
 * ChemFracExpr = '\frac' , 2 * ( charToken |  chemBlockStatement )
 * 
 * 化学的箭头表达式
 * ChemArrowExpr = 'token-arrow' , 2 * [ChemBracketStatement]
 * 
 * 化学的上下标表达式
 * ChemScriptExpr =  chemSubsupscriptExpr | chemSupsubscriptExpr | chemSubscriptExpr | chemSupscriptExpr ｜ chemEzScriptExpr
 * chemSubscriptExpr = '_', ({'token-num'} | 'token-space' | 'token-char' | MathBlockStatement)
 * chemSupscriptExpr = '^', ({'token-num'} | 'token-space' | 'token-char' | MathBlockStatement)
 * chemSubsupscriptExpr = chemSubscriptExpr, chemSupscriptExpr
 * chemSupsubscriptExpr = chemSupscriptExpr, chemSubscriptExpr
 * chemEzScriptExpr = 'token-alpha', ({'token-num'} | {'token-+'} | {'token--'}), [{'token-num'} | {'token-+'} | {'token--'}]
 * 
 * 化学的沉淀符号
 * ChemCondenseExpr = 'token-space', 'v', 'token-space'
 * 
 * 化学的上浮符号
 * ChemFloatExpr = 'token-space', '^', 'token-space'
 * 
 * 化学的连接符号
 * chemBondExpr = '#' ｜ '\bond', '{', '-' | '=' | '#' | '1' | '2' | '3' | '~' | '~-' | '~--' | '~=' | '-~-' | '...' | '....' | '->' | '<-','}'
 * 
 * 简易化学分式
 * chemEzfracExpr = {'token-num'}, '/', {'token-num'}
 * 
 * 化学的未知文本
 * chemUnknown = {'allTokens' -(ChemExpr | MathBlockStatement | MathDollarStatement)}
 *
 * 数学相关语法
 * MathBlockStatement = '{' , MathStatements , '}'
 * MathStatements = {[MathStatement]}
 * -表示except
 * MathStatement = {['allTokens' -( '{' | '}' )]} | MathBlockStatement
 * 
 * MathDollarStatement = '$' , MathDollarStatements , '$'
 * MathDollarStatements = {['allTokens' -'$']}
 */

// 语法分析器
const parse = (input: string) => {
  const tokens = tokenize(input, tokenRuleList)
  const tokensLength = tokens.length
  let index = 0
  let longestIndex = 0
  
  const castError = (msg = '') => {
    const newMsg = msg !== '' ? `parsing error in ${tokens[index].end}: ${msg}` : `parsing error: position ${tokens[longestIndex].start}`
    const error = new Error(newMsg)

    if (msg) {
      error.name = 'dead'
    }

    throw error
  }

  // 预读下一个token
  const peek = (step: number = 0) => {
    return tokens[index + step];
  }

  // 消费下一个token
  const read = () => {
    if (index >= tokensLength) {
      return null
    }
    const readToken = tokens[index]

    if (index > longestIndex) {
      longestIndex = index
    }
    index++
    return readToken
  }

  /**
   * 当存在Expr = Expr1 | Expr2 ｜ Expr3时，必须对Expr1出错时做一下处理
   * 1. 回溯到Expr2
   * 2. 重置index位置
   * 全部出错则表示Expr出错
   */
  const orRead = (...readings: Function[]) => {
    let node: any = null
    const currentIndex = index

    for (let reading of readings) {
      try {
        node = reading()
        break
      } catch (e) {
        // 监测到打断回溯的错误，直接抛错
        if (e.name === 'dead') {
          throw e
        }
        index = currentIndex
      }
    }

    if (node === null) {
      castError()
    }

    return node
  }

  /**
   * [Expr], 表示Expr出现0次或1次
   * 如果读取失败，需要重置index
   */
  const existRead = (reading: Function) => {
    let token: any = null
    const currentIndex = index;
    try {
      token = reading()
    } catch (e) {
      index = currentIndex
    }

    return token
  }

  /**
   * allowEmpty = true, {[Expr]}, 表示Expr出现0次或多次
   * allowEmpty = false, {Expr}, 表示Expr出现多次
   * 对unknown进行特殊处理, 待优化
   */
  const multiRead = (reading, allowEmpty: boolean = true) => {
    const nodes: any[] = []
    let currentIndex = index;
    try {
      while (index < tokensLength) {
        const node = reading()
        const prevNode = nodes[nodes.length - 1]

        if (node.type === 'unknown' && prevNode && prevNode.type === 'unknown') {
          prevNode.value += node.value
        } else {
          nodes.push(node)
        }
        currentIndex = index
      }
    } catch (e) {
      index = currentIndex
      if (e.name === 'dead') {
        throw e
      }
      if (!allowEmpty && nodes.length === 0) {
        castError()
      }
    }
    return nodes
  }
  
  // 消耗空格
  const consumeSpace = () => {
    const token = peek()
    if (token && token.type === 'space') {
      read()
    }
  }

  const readGrammar = () => {
    readToken('^')
    const node: any = {
      type: 'root',
      statements: readStatements()
    }
    readToken('$')
    return node
  }

  const readStatements = (unAllowTokens: [string, string?][] = []) => {    
    return multiRead(() => readStatement(unAllowTokens))
  }

  const readStatement = (unAllowTokens: [string, string?][] = []) => {
    return orRead(
      readExpr, 
      () => { 
        consumeSpace()
        return readMathBlockStatement()
      }, 
      () => {
        consumeSpace()
        return readMathDollarStatement()
      }, 
      () => readUnknown(unAllowTokens)
    )
  }

  const readExpr = () => {
    return orRead(readFracExpr, readArrowExpr, readCondenseExpr, readFloatExpr, readBondExpr, readEzFracExpr, readScriptExpr)
  }

  /**
   * 读取无法识别的token
   * 这是一个保底策略，但是并不是所有的无法识别token都要被打入unknown
   * 需要部分token无法进入，以此保证不会把外层表达式的后缀消耗掉
   */
  const readUnknown = (unAllowTokens: [string, string?][] = []) => {
    const token = peek()
    unAllowTokens.push(['^'], ['$'])

    if (token && unAllowTokens.every(t => t[0] !== token.type || t[1] && t[1] !== token.match)) {
      read()
      return {
        type: 'unknown',
        value: token.match
      }
    } else {
      return castError()
    }
  }

  const readFracExpr = () => {
    const node: any = {
      type: 'fracCommand',
      children: []
    }
  
    consumeSpace()

    readToken('command', '\\frac')
    try {
      consumeSpace()
      node.children.push(orRead(readChar, readBlockStatement))
      consumeSpace()
      node.children.push(orRead(readChar, readBlockStatement))
    } catch (e) {
      castError('not valid \\frac command')
    }
    
    return node
  }

  const readArrowExpr = () => {
    const node: any = {
      type: 'arrowCommand',
      value: '',
      children: []
    }

    consumeSpace()

    const token = readToken('arrow')
    node.value = token?.match

    const child1 = existRead(readBracketStatement)
    if (child1) {
      node.children.push(child1)
      const child2 = existRead(readBracketStatement)
      child2 && node.children.push(child2)
    }

    return node
  }

  const readCondenseExpr = () => {
    const node: any = {
      type: 'condenseCommand'
    }

    readToken('space')
    readChar('v')
    readToken('space')

    return node
  }

  const readFloatExpr = () => {
    const node: any = {
      type: 'floatCommand'
    }
    
    readToken('space')
    readToken('supscript')
    readToken('space')

    return node
  }

  const readBondExpr = () => {
    const readBoundCommand = () => {
      const node: any = {
        type: 'bondCommand',
        value: ''
      }
      consumeSpace()
      readToken('command', '\\bond')
      try {
        readToken('parentheses', '{')
        const genReadings = (strs: string[]) => {
          return strs.map(str => () => readString(str))
        }
        const value = orRead(...genReadings([
          '....',
          '...',
          '-~-',
          '~--',
          '->',
          '<-',
          '~=',
          '~-',
          '~',
          '3',
          '2',
          '1',
          '#',
          '=',
          '-'
        ]))
        node.value = value
        readToken('parentheses', '}')
      } catch (e) {
        castError('invalid \\bond command')
      }
      
      return node
    }

    const readBoundSymbol = () => {
      const node: any = {
        type: 'bond',
        value: '#'
      }

      readToken('char', '#')
      return node
    }

    return orRead(readBoundCommand, readBoundSymbol)
  }
  
  const readEzFracExpr = () => {
    const node: any = {
      type: 'ezFracCommand',
      children: []
    }

    consumeSpace()
    const child1 = multiRead(readNum).join('')

    if (child1 !== '') {
      node.children.push(child1)
      readChar('/')
      const child2 = multiRead(readNum).join('')
      if (child2 !== '') {
        node.children.push(child2)
        return node
      }
    }

    castError()
  }

  const readScriptExpr = () => {
    return orRead(readSubsupscriptExpr, readSupsubscriptExpr, readSubscriptExpr, readSupscriptExpr, readEzScriptExpr)
  }

  const readSubsupscriptExpr = () => {
    const node: any = {
      type: 'subsupscript',
      children: []
    }
    node.children.push(...readSubscriptExpr().children)
    node.children.push(...readSupscriptExpr().children)
    
    return node
  }

  const readSupsubscriptExpr = () => {
    const node: any = {
      type: 'supsubscript',
      children: []
    }
    node.children.push(...readSupscriptExpr().children)
    node.children.push(...readSubscriptExpr().children)
    
    return node
  }

  const readSubscriptExpr = () => {
    const node: any = {
      type: 'subscript',
      children: []
    }

    consumeSpace()
    readToken('subscript', '_')

    let children = orRead(() => multiRead(readNum, false), readChar, readMathBlockStatement, () => readToken('space'))
    if (children instanceof Array) {
      children = children.join('')
    }

    node.children.push(children)

    return node
  }

  const readSupscriptExpr = () => {
    const node: any = {
      type: 'supscript',
      children: []
    }

    consumeSpace()
    readToken('supscript', '^')

    let children = orRead(() => multiRead(readNum, false), readChar, readMathBlockStatement, () => readToken('space'))
    if (children instanceof Array) {
      children = children.join('')
    }

    node.children.push(children)

    return node
  }

  const readEzScriptExpr = () => {
    const node: any = {
      type: 'ezScript',
      children: []
    }

    consumeSpace()
    node.children.push(readAlphabet())

    const child1 = orRead(
      () => multiRead(readNum, false), 
      () => multiRead(() => readToken('char', '+'), false),
      () => multiRead(() => readToken('char', '-'), false)
    ).join('')
    node.children.push(child1)

    const child2 = existRead(() => orRead(
      () => multiRead(readNum, false), 
      () => multiRead(() => readToken('char', '+'), false),
      () => multiRead(() => readToken('char', '-'), false)
    ))
    child2 && node.children.push(child2.join(''))

    return node
  }

  // 表达式式的token读取统一的收拢入口
  const readToken = (type: string, match?: string) => {
    const token = read()
    if (token === null || token.type !== type || (match && token.match !== match)) {
      // token读取错误需要将未知回退
      if (token !== null) {
        index--
      }
      castError()
    }
    return token?.match
  }

  const readChar = (char?: string) => {
    return readToken('char', char)
  }

  const readString = (str: string) => {
    let res = ''
    
    for (let char of str) {
      res += readToken('char', char)
    }

    return res
  }

  const readNum = () => {
    const char = readToken('char')
    if (!/^[0-9]$/.test(char as string)) {
      castError()
    }
    return char
  }

  const readAlphabet = () => {
    const char = readToken('char')
    if (!/^[a-zA-Z]$/.test(char as string)) {
      castError()
    }
    return char
  }

  // 读取{...}
  const readBlockStatement = () => {
    const node: any = {
      type: 'blockStatement',
      statements: []
    }
    
    readToken('parentheses', '{')
    consumeSpace()

    node.statements = readStatements([['parentheses', '}']])

    consumeSpace()
    readToken('parentheses', '}')

    return node
  }

  // 读取[...]
  const readBracketStatement = () => {
    const node: any = {
      type: 'bracketStatement',
      statements: []
    }
    
    readToken('bracket', '[')
    consumeSpace()
    node.statements = readStatements([['bracket', ']']])
    consumeSpace()
    readToken('bracket', ']')
    return node
  }

  const readMathBlockStatement = () => {
    const node: any = {
      type: 'mathBlockStatement',
      statements: []
    }

    readToken('parentheses', '{')
    consumeSpace()

    node.statements = readMathStatements()

    consumeSpace()
    readToken('parentheses', '}')

    return node
  }

  const readMathStatements = () => {
    return multiRead(readMathStatement)
  }

  const readMathStatement = () => {
    return orRead(
      () => readUnknown([['parentheses', '{'], ['parentheses', '}']]),
      readMathBlockStatement
    )
  }

  const readMathDollarStatement = () => {
    const node: any = {
      type: 'mathDollarStatement',
      statements: []
    }

    readChar('$')
    consumeSpace()

    node.value = multiRead(() => readUnknown([['char', '$']])).map(node => node.value).join('')

    consumeSpace()
    readChar('$')

    return node
  }

  return readGrammar()
}

export default parse