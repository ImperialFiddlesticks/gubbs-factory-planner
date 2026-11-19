import Konva from 'konva'

/** Shrink-and-fade a machine or utility on the canvas, then call `done` (e.g. remove it from the store). */
export function animateNodeOut(id: string, done: () => void) {
  const node = Konva.stages.map((s) => s.findOne(`#${id}`)).find(Boolean)
  if (!node) return done()
  node.listening(false)
  node.to({
    scaleX: 0.3,
    scaleY: 0.3,
    opacity: 0,
    duration: 0.18,
    easing: Konva.Easings.EaseIn,
    onFinish: done,
  })
}
