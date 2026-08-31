export function createPatternHistory(initial: number[], maxEntries = 20) {
  let current = [...initial]
  const undoStack: number[][] = []
  const redoStack: number[][] = []
  return {
    get cells() { return [...current] },
    get canUndo() { return undoStack.length > 0 },
    get canRedo() { return redoStack.length > 0 },
    apply(next: number[]) { undoStack.push([...current]); if (undoStack.length > maxEntries) undoStack.shift(); current = [...next]; redoStack.length = 0; return [...current] },
    undo() { if (!undoStack.length) return [...current]; redoStack.push([...current]); current = undoStack.pop()!; return [...current] },
    redo() { if (!redoStack.length) return [...current]; undoStack.push([...current]); current = redoStack.pop()!; return [...current] },
  }
}
