export function normalizeWatermarkText(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 3)
}

export function scaleWatermarkImage(width: number, height: number, maxSide = 4096) {
  if (width <= 0 || height <= 0) throw new RangeError('图片尺寸无效')
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale), scale }
}

export function createWatermarkPlan(width: number, height: number, options: { opacity: number; rotation: number; tiled: boolean; gap?: number }) {
  const opacity = Math.min(1, Math.max(0, options.opacity))
  const gap = Math.max(20, options.gap || Math.min(width, height) / 3)
  const positions = options.tiled
    ? Array.from({ length: Math.ceil(height / gap) + 2 }, (_, row) => Array.from({ length: Math.ceil(width / gap) + 2 }, (_, col) => ({ x: (col - 1) * gap, y: (row - 1) * gap }))).flat()
    : [{ x: width / 2, y: height / 2 }]
  return { opacity, rotationRadians: options.rotation * Math.PI / 180, positions }
}

export function executeWatermarkPlan(ctx: { save(): void; restore(): void; translate(x: number, y: number): void; rotate(value: number): void; fillText(text: string, x: number, y: number): void }, text: string, plan: ReturnType<typeof createWatermarkPlan>) {
  for (const position of plan.positions) { ctx.save(); ctx.translate(position.x, position.y); ctx.rotate(plan.rotationRadians); ctx.fillText(text, 0, 0); ctx.restore() }
}
