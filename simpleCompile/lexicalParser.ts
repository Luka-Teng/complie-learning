import { TokenRuleListType, tokenize } from '../tokenize'

/**
 * 词法解析工具
 */

const tokenRuleList: TokenRuleListType = [
  {
    type: 'let',
    match: /^let(?=[^a-zA-Z_0-9$]|$)/
  },
  {
    type: 'if',
    match: /^if(?=[^a-zA-Z_0-9$]|$)/
  },
  {
    type: 'identifier',
    match: /^[\$_a-zA-Z][\$_a-zA-Z0-9]*/
  },
  {
    type: 'literal',
    match: (input: string) => {
      const readUntil = (input: string, end: string) => {
        let str = ''
        let index = 0

        while (index < input.length) {
          const readChar = input[index]

          if (readChar === end) {
            str += readChar
            return str
          }

          if (readChar !== end && readChar === '\\') {
            const nextChar = input[index + 1]
            if (nextChar !== undefined) {
              str = str + readChar + nextChar
              index++
            } else {
              return null
            }
          } else {
            str += readChar
          }

          index++
        }

        return null
      }

      if (input[0] === '\'') {
        const read = readUntil(input.slice(1), '\'')
        if (read !== null) {
          return '\'' + read
        } 
      }

      if (input[0] === '"') {
        const read = readUntil(input.slice(1), '"')
        if (read !== null) {
          return '"' + read
        } 
      }

      return null
    }
  },
  {
    type: 'braces',
    match: /^(\{|\})/
  },
  {
    type: 'parentheses',
    match: /^(\(|\))/
  },
  {
    type: 'number',
    match: /^[0-9]+/
  },
  {
    type: 'operator',
    match: /^(\/|\*|\+|\-)/
  },
  {
    type: 'or',
    match: /^\|\|/
  },
  {
    type: 'and',
    match: /^\&\&/
  },
  {
    type: 'equal',
    match: /^===/
  },
  {
    type: 'unequal',
    match: /^\!==/
  },
  {
    type: 'assign',
    match: /^=/
  },
  {
    type: 'lineEnd',
    match: /^;/
  },
  {
    type: 'space',
    match: /^\s+/,
    skip: true
  }
]

export default (input: string) => tokenize(input, tokenRuleList)
