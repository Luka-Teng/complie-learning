export type TokenType = {
  type: string
  match: string
  start: number
  end: number
}

export type TokenRuleType = {
  type: string
  // 表示是否将解析结果计入token流中
  skip?: boolean
  match: RegExp | ((input: string) => string | null)
}

export type TokenRuleListType = TokenRuleType[]

const match = (input: string, ruleList: TokenRuleListType) => {
  for (let rule of ruleList) {
    let match: any = null

    if (rule.match instanceof RegExp) {
      match = input.match(rule.match)
      match = match && match[0]
    }

    if (rule.match instanceof Function) {
      match = rule.match(input)
    }

    if (match) {
      return {
        match,
        type: rule.type,
        skip: rule.skip
      }
    }
  }
  return null
}

/**
 * 分词器
 * 根据正则和方法返回token
 */
export const tokenize = (input: string, ruleList: TokenRuleListType) => {
  let offset = 0
  let matchToken: any = match(input.slice(offset), ruleList)
  const tokens: TokenType[] = []

  // 初始token
  tokens.push({
    type: '^',
    match: '',
    start: 0,
    end: 0
  })
  
  while (matchToken && offset < input.length) {
    if (!matchToken.skip) {
      tokens.push({
        type: matchToken.type,
        match: matchToken.match,
        start: offset,
        end: offset + matchToken.match.length,
      })
    }
    offset += matchToken.match.length
    matchToken = match(input.slice(offset), ruleList)
  }

  // 结尾token
  tokens.push({
    type: '$',
    match: '',
    start: input.length,
    end: input.length
  })

  return tokens
}