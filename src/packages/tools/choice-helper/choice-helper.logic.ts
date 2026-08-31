export function cloneTemplate(options: string[]) { return options.map((item) => `${item}`) }

export function validateChoices(options: string[]) {
  const normalized = options.map((item) => item.trim()).filter(Boolean)
  if (normalized.length < 2) throw new RangeError('至少需要两个选项')
  return normalized
}

export function chooseIndex(length: number, random = Math.random) {
  if (length < 2) throw new RangeError('至少需要两个选项')
  return Math.min(length - 1, Math.floor(random() * length))
}

export function createWheelResult(options: string[], random = Math.random, rounds = 5) {
  const choices = validateChoices(options)
  const index = chooseIndex(choices.length, random)
  return { index, choice: choices[index], finalOffset: (rounds * choices.length + index) * -48 }
}

export function createTimerRegistry() {
  const timers = new Set<ReturnType<typeof setTimeout>>()
  return { add(timer: ReturnType<typeof setTimeout>) { timers.add(timer); return timer }, clear() { timers.forEach(clearTimeout); timers.clear() }, get size() { return timers.size } }
}
