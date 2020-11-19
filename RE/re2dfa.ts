import { re2nfa, TNode } from './re2nfa'
/**
 * 将nfa转化为dfa，避免在执行过程中产生回溯
 * 算法：子集构造法
 * 注意：子集q是集合的概念，是无序的，判断q1，q2是否相同也是集合的概念
 * 子集构造法的算法思想是，针对一个输入，枚举所有可能状态，针对该输入的所有状态我们称为集合q，只要集合q内存在接受状态，那么集合q就是接收状态
 */

type TQNode = {
    set: Set<TNode>,
    end: boolean,
    validInput: Set<string>,
    id: string,
    transitions: {
        value: string,
        next: TQNode
    }[]
}

const re2dfa = (regExp: string) => {
    // 转化为dfa
    const start = re2nfa(regExp)

    // 获取某个状态的epsilon子集
    const epsilonClosure = (node: TNode) => {
        const clousreSet = new Set<TNode>()

        const dfs = (node: TNode) => {
            clousreSet.add(node)

            node.transitions.forEach(t => {
                if (t.value === 'epsilon' && !clousreSet.has(t.next)) {
                    dfs(t.next)
                }
            })
        }

        dfs(node)

        return clousreSet
    }

    // 创建子集节点
    const buildQNode = (set: Set<TNode>): TQNode => {
        const validInput = new Set<string>()
        let end = false
        
        set.forEach(node => {
            if (node.type === 'end') {
                end = true
            }
            node.transitions.forEach(transition => {
                if (transition.value !== 'epsilon') {
                    validInput.add(transition.value)
                }
            })
        })

        return {
            set,
            transitions: [],
            validInput,
            end,
            id: Array.from(set).map(node => node.id).sort().join('')
        }
    }

    // 从一个子集转化到另一个子集
    const transit = (q: TQNode, c: string): TQNode | null => {
        const nodeSet = new Set<TNode>()
        q.set.forEach(node => {
            node.transitions.forEach(transition => {
                if (transition.value === c) {
                    nodeSet.add(transition.next)
                }
            })
        })

        if (nodeSet.size > 0) {
            const epsilonSet = new Set<TNode>()
            nodeSet.forEach(node => {
                epsilonClosure(node).forEach(n => {
                    epsilonSet.add(n)
                })
            })
            return buildQNode(epsilonSet)
        }

        return null
    }

    const setTransit = (prevNode: TQNode, nextNode: TQNode, value: string) => {
        prevNode.transitions.push({
            value,
            next: nextNode
        })
    }

    // 创建nfa
    const build = () => {
        const startQ: TQNode = buildQNode(epsilonClosure(start))
        const queue = [startQ]
        const workList = [startQ]

        while (workList.length > 0) {
            const q = workList.shift() as TQNode
            q.validInput.forEach(c => {
                const nextQ = transit(q, c)

                if (nextQ === null) return

                const sameQ = queue.find(q => q.id === nextQ.id)

                if (sameQ) {
                    setTransit(q, sameQ, c)
                } else {
                    queue.push(nextQ)
                    workList.push(nextQ)
                    setTransit(q, nextQ, c)
                }
            })
        }

        return startQ
    }

    return build()
}

const run = (regExp: string, input: string) => {
    let current: TQNode | null = re2dfa(regExp)
    let index = 0
    let char: string | null

    const transit = (node: TQNode, char: string) => {
        for (let transition of node.transitions) {
            if (transition.value === char) {
                return transition.next
            }
        }

        return null
    }

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

    while (char = readChar()) {
        let next = transit(current, char)

        if (next) {
            current = next
        } else {
            break
        }
    }

    return current.end
}

export default run