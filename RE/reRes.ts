/**
 * 正则表达式的的解析工具
 * regex -> 特定数据结构
 * 支持的正则运算按优先级顺序，使用文法解析可能不是效率最高的一种
 * or = union {[ '|' union ]}
 * union = { multi }
 * multi = (char | group) ['*']
 * group = '(' [or] ')'
 */

const keyWords = ['|', '(', ')', '*']

const reRes = (input: string) => {
	let index = 0
	let longestIndex = 0

	const castError = (msg = '') => {
		const newMsg = msg !== '' ? `parsing error in ${index}: ${msg}` : `parsing error: position ${longestIndex}`
		const error = new Error(newMsg)

		if (msg) {
			error.name = 'dead'
		}

		throw error
	}

  const peek = (step = 0) => {
    const char = input[index + step]
    return char || null
  }

  const read = () => {
		let char = peek()
		
		// 不含转义情况
    if (char && char !== '\\') {
			index++
    }
		
		// 转义情况
		if (char === '\\') {
			const nextChar = peek(1)
			if (nextChar) {
				index = index + 2
				char = char + nextChar
			} else {
				castError('\\不能单独使用')
			}
		}

		if (index > longestIndex) {
      longestIndex = index
    }

		return char || null
	}

	const readChar = (char?: string) => {
		const c = read()

		if (!char && c && !keyWords.includes(c)) {
			return c
		}

		if (c !== char) {
			castError()
		}

		return c
	}
	
	const orRead = (...readings: Function[]) => {
    let node: any = null
    const currentIndex = index

    for (let reading of readings) {
      try {
        node = reading()
        break
      } catch (e) {
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
	
	const existRead = (reading: Function) => {
    let node: any = null
    const currentIndex = index;
    try {
      node = reading()
    } catch (e) {
			if (e.name === 'dead') {
        throw e
      }
      index = currentIndex
    }

    return node
	}
	
	const multiRead = (reading, allowEmpty: boolean = true) => {
    const nodes: any[] = []
    let currentIndex = index;
    try {
      while (index < input.length) {
        nodes.push(reading())
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

	const readRoot = () => {
		const node = readOrExpr()
		if (index < input.length) {
			castError()
		}
		return node
	}
	
	const readOrExpr = () => {
		const firstUnion = readUnionExpr()
		const nextUnions = multiRead(() => {
			readChar('|')

			try {
				return readUnionExpr()
			} catch (e) {
				castError('invalid orExpr')
			}

			return null
		})

		if (nextUnions.length > 0) {
			return {
				type: 'or',
				children: [firstUnion, ...nextUnions]
			}
		}

		return firstUnion
	}

	const readUnionExpr = () => {
		const nodes = multiRead(readMultiExpr)
		return {
			type: 'union',
			children: nodes
		}
	}

	const readMultiExpr = () => {
		const node = orRead(readCharExpr, readGroupExpr)
		const note = existRead(() => readChar('*'))

		if (note) {
			return {
				type: 'multi',
				child: node
			}
		}

		return node
	}

	const readGroupExpr = () => {
		readChar('(')

		try {
			const node = existRead(readOrExpr)
			readChar(')')
			return {
				type: 'group',
				child: node
			}
		} catch (e) {
			castError('invalid group')
		}

		return null
	}

	const readCharExpr = () => {
		const char = readChar()
		return {
			type: 'char',
			child: char
		}
	}

	return readRoot()
}

export default reRes