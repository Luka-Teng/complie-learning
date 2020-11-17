import reRes from "./reRes";
/**
 * RE 转化为 NFA
 * 转化为不确定有限自动机的有向图
 * 
 * 算法thompson算法
 * 1. 基础状态：c, epsilon
 * 2. 符合状态：union（ab），or（a|b），multi（a*）
 * 
 * transitions为边
 * node为状态点
 */

type TNode = {
	id: number
	type: 'normal' | 'start' | 'end'
	transitions: TTransition[]
}

type TTransition = {
	value: string
	next: TNode
}

const re2nfa = (input: string) => {
	const reTree = reRes(input)

	// 节点id，随着节点的创建自增
	let id = 0

	const createNode = (type: TNode['type']): TNode => {
		return {
			id: id++,
			type,
			transitions: []
		}
	}

	const createTransition = (value: string, next: TNode): TTransition => {
		return {
			value,
			next
		}
	}

	/**
	 * 连接两个节点的边
	 * value只可能是一个char，或者epsilon
	 */
	const link = (prevNode: TNode, nextNode: TNode, value: string) => {
		prevNode.transitions.push(createTransition(value, nextNode))
	}

	// 深度遍历reTree
	const build = (node: any) => {
		switch (node.type) {
			case 'char':
				return buildChar(node)
			case 'union':
				return buildUnion(node)
			case 'group':
				return buildGroup(node)
			case 'or': 
				return buildOr(node)
			case 'multi':
				return buildMulti(node)
			default:
				throw new Error(`unknown type: ${node.type}`)
		}
	}

	const buildChar = (node: any) => {
		const start = createNode('start')
		const end = createNode('end')
		link(start, end, node.child)
		return [start, end]
	}

	const buildUnion = (node: any) => {
		if (node.children.length > 0) {
			let start: any = null
			let end: any = null
			node.children.reduce((current, n, i) => {
				const [s, e] = build(n) as [TNode, TNode]
				if (i === 0) start = s
				if (i === node.children.length - 1) end = e
				if (current) {
					current.type = 'normal'
					s.type = 'normal'
					link(current, s, 'epsilon')
				}
				return e
			}, start)
			return [start, end]
		} else {
			const start = createNode('start')
			const end = createNode('end')
			link(start, end, 'epsilon')
			return [start, end]
		}
	}

	const buildOr = (node: any) => {
		const start = createNode('start')
		const end = createNode('end')
		
		node.children.forEach(n => {
			const [s, e] = build(n)
			s.type = 'normal'
			e.type = 'normal'
			link(start, s, 'epsilon')
			link(e, end, 'epsilon')
		})

		return [start, end]
	}

	const buildMulti = (node: any) => {
		const start = createNode('start')
		const end = createNode('end')
		const [s, e] = build(node.child)
		s.type = 'normal'
		e.type = 'normal'

		link(e, s, 'epsilon')
		link(start, s, 'epsilon')
		link(e, end, 'epsilon')

		return [start, end]
	}

	const buildGroup = (node: any) => {
		return build(node.child)
	}

	return build(reTree)[0]
}

/**
 * 状态机的运行
 */
const run = (regex: string, input: string) => {
	const start = re2nfa(regex)
	let index = 0
	let inTheEnd = false
	
	const readChar = () => {
		let char = input[index]
		
		// 不含转义情况
    if (char && char !== '\\') {
			index++
    }
		
		// 转义情况
		if (char === '\\') {
			const nextChar = input[index]
			if (nextChar) {
				index = index + 2
				char = char + nextChar
			} else {
				throw new Error('\\不能单独使用')
			}
		}

		return char || null
	}

	const transit = (node: TNode) => {
		if (node.type === 'end') {
			inTheEnd = true
			return
		}

		let currentIndex = index
		// 回溯
		node.transitions.forEach(t => {
			if (inTheEnd) return

			if (t.value === 'epsilon') {
				transit(t.next)
				return
			}

			index = currentIndex
			const char = readChar()
			if (char && t.value === char) {
				transit(t.next)
			} else {
				index = currentIndex
			}
		})
	}

	transit(start)
	return inTheEnd
}

export default run