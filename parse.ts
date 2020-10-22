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
 * 
 * Grammar = 'token-^', ChemStatements, 'token-$'
 * ChemStatements = {[ ChemStatement ]}
 * ChemStatement = ChemExpr | MathBlockStatement ｜ MathDollarStatement
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
 * 化学的上下标表达式 todo...
 * ChemScriptExpr = chemSubscriptExpr | chemSupscriptExpr | chemSubsupscriptExpr | chemSupsubscriptExpr
 * chemSubscriptExpr = '_', ({'token-num'} | 'token-char' | MathDollarStatement | MathBlockStatement)
 * chemSupscriptExpr = '^', ({'token-num'} | 'token-char' | MathDollarStatement | MathBlockStatement)
 * chemSubsupscriptExpr = chemSubscriptExpr, chemSupscriptExpr
 * chemSupsubscriptExpr = chemSupscriptExpr, chemSubscriptExpr
 * 
 * 化学的沉淀符号
 * ChemCondenseExpr = ('token-^' | 'token-space'), 'v', ('token-$' | 'token-space')
 * 
 * 化学的上浮符号
 * ChemFloatExpr = ('token-^' | 'token-space'), '^', ('token-$' | 'token-space')
 * 
 * 化学的连接符号
 * chemBondExpr = '#' ｜ '\bond', '{', '-' | '=' | '#' | '1' | '2' | '3' | '~' | '~-' | '~--' | '~=' | '-~-' | '...' | '....' | '->' | '<-','}'
 * 
 * 简易化学分式
 * chemEzfracExpr = ['token-char-num'], '/', ['token-char-num']
 *
 * 数学相关语法
 * MathBlockStatement = '{' , MathStatements , '}'
 * MathStatements = MathStatement*
 * -表示except
 * MathStatement = 'allTokens' -( '{' | '}' ) | MathBlockStatement
 * 
 * MathDollarStatement = '$' , MathDollarStatements , '$'
 * MathDollarStatements = {'allTokens' -'$'}
 */

// 语法分析器
const parse = (input: string) => {
  const tokens = tokenize(input, tokenRuleList)
  const tokensLength = tokens.length
  let index = 0

  const castError = (position?: number) => {
    throw new Error(`parsing error: position ${position || tokens[index - 1].start}`)
  }

  // 预读下一个token
  const peek = () => {
    return tokens[index];
  }

  // 消费下一个token
  const read = () => {
    if (index >= tokensLength) {
      return null
    }
    const readToken = tokens[index]
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
    let token: any = null
    const currentIndex = index

    for (let reading of readings) {
      try {
        token = reading()
        break
      } catch (e) {
        index = currentIndex
      }
    }

    if (token === null) {
      castError()
    }

    return token
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
   * {[Expr]}, 表示Expr出现0次或多次
   */
  const multiRead = (reading) => {
    const tokens: any[] = []
    let currentIndex = index;
    try {
      while (index < tokensLength) {
        tokens.push(reading())
        currentIndex = index
      }
    } catch (e) {
      index = currentIndex
    }
    return tokens
  }
  
  // 消耗空格
  const consumeSpace = () => {
    const token = peek()
    if (token.type === 'space') {
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

  const readStatements = () => {    
    return multiRead(readStatement)
  }

  const readStatement = () => {
    return orRead(readExpr, readArrowExpr)
  }

  const readExpr = () => {
    return orRead(readFracExpr)
  }

  const readFracExpr = () => {
    const node: any = {
      type: 'fracCommand',
      children: []
    }
  
    consumeSpace()
    readToken('command', '\\frac')

    consumeSpace()
    node.children.push(orRead(readChar, readBlockStatement))

    consumeSpace()
    node.children.push(orRead(readChar, readBlockStatement))

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

  const readToken = (type: string, match?: string) => {
    const token = read()
    if (!token || token.type !== type || (match && token.match !== match)) {
      castError()
    }
    return token?.match
  }

  const readChar = (char?: string) => {
    return readToken('char', char)
  }

  // 读取{...}
  const readBlockStatement = () => {
    const node: any = {
      type: 'blockStatement',
      statements: []
    }
    
    readToken('parentheses', '{')
    consumeSpace()

    node.statements = readStatements()

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

    node.statements = readStatements()

    consumeSpace()
    readToken('bracket', ']')

    return node
  }

  return readGrammar()
}

console.log(JSON.stringify(parse('\\frac 1 {\\frac 12}->[\\frac12]')))

