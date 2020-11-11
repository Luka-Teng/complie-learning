/**
 * 作用域和栈空间
 * scope是静态作用域，是ast生成时就确定的
 */

class Frame {
    constructor (parentFrame?: Frame) {
      this.parentFrame = parentFrame || null
		}
		
		// 获取含有某个key的最近frame
		static lookUpWithKey = (frame: Frame | null, key: string) => {
			while (frame) {
				if (frame.hasOwnKey(key)) {
					return frame
				}
				frame = frame.parentFrame
			}
			return null
		}

    // 作用域链
    parentFrame: Frame | null = null

    // 活动对象
		playObject: Record<string, any> = {}

    // 获取值
    getOwnValue = (key: string) => {
			return this.playObject[key]
		}

		// 设置值
		setOwnValue = (key: string, value: any) => {
			this.playObject[key] = value
		}
		
		// 是否存在变量
		hasOwnKey = (key: string) => {
			return this.playObject.hasOwnProperty(key)
		}

		// 作用域上是否存在变量
		hasScopedKey = (key: string) => {
			const frame = Frame.lookUpWithKey(this, key)
			return frame ? true : false
		}

		// 获取作用域上的值
		getScopedValue = (key: string) => {
			const frame = Frame.lookUpWithKey(this, key)
			return frame ? frame.getOwnValue(key) : undefined
		}

		// 设置作用域上的值
		setScopedValue = (key: string, value: any) => {
			const frame = Frame.lookUpWithKey(this, key)
			frame ? frame.setOwnValue(key, value) : this.setOwnValue(key, value)
		}
}

export default Frame