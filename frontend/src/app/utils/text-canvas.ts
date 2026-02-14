/**
 * Displays text on an HTML canvas element
 *
 * @param text The text to display
 * @param ratio The canvas ratio
 * @param color The text color
 * @param bcolor The background color
 * @returns A Promise with an ImageBitmap
 */
export const textCanvas = async (
  text: string,
  color: {r: number; g: number; b: number},
  bcolor: {r: number; g: number; b: number},
  ratio = 1
) => {
  const canvasWidth = ratio > 1 ? 256 : 256 * ratio
  const canvasHeight = ratio > 1 ? 256 / ratio : 256
  const canvas = new OffscreenCanvas(canvasWidth, canvasHeight)

  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = `rgb(${bcolor.r},${bcolor.g},${bcolor.b})`
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`
  ctx.textBaseline = 'middle'

  let lowIdx = 1
  let highIdx = 64 // 128px max
  let bestSize = 2
  let bestLines: string[] = []

  while (lowIdx <= highIdx) {
    const midIdx = Math.floor((lowIdx + highIdx) / 2)
    const currentSize = midIdx * 2 // Even

    ctx.font = `500 ${currentSize}px Arimo,Arial,sans-serif`
    const lines = breakTextIntoLines(text, ctx, canvasWidth)

    const totalHeight = lines.length * currentSize * 1.2
    const maxWidth =
      lines.length > 0
        ? Math.max(...lines.map((l) => ctx.measureText(l).width))
        : 0

    if (totalHeight <= canvasHeight && maxWidth <= canvasWidth) {
      bestSize = currentSize
      bestLines = lines
      lowIdx = midIdx + 1
    } else {
      highIdx = midIdx - 1
    }
  }

  ctx.font = `500 ${bestSize}px Arimo,Arial,sans-serif`
  ctx.textBaseline = 'top'

  const lineHeight = bestSize * 1.2
  const startY = (canvasHeight - bestLines.length * lineHeight) / 2

  bestLines.forEach((line, index) => {
    const textWidth = ctx.measureText(line).width
    const startX = (canvasWidth - textWidth) / 2
    const y = startY + index * lineHeight
    ctx.fillText(line, startX, y)
  })

  return await createImageBitmap(canvas.transferToImageBitmap(), {
    imageOrientation: 'flipY'
  })
}

/**
 * Breaks the text into lines to fit within the given maximum width
 *
 * @param text The text to break into lines
 * @param ctx The canvas rendering context
 * @param maxWidth The maximum width of a line
 * @returns The array of lines
 */
const breakTextIntoLines = (
  text: string,
  ctx: OffscreenCanvasRenderingContext2D,
  maxWidth: number
): string[] => {
  const lines: string[] = []
  const paragraphs = text.split('\n')

  paragraphs.forEach((paragraph) => {
    const words = paragraph.split(' ')
    let currentLine = ''

    words.forEach((word) => {
      if (word.length === 0) {
        // Skip empty words
        return
      }

      const lineWidth = ctx.measureText(`${currentLine} ${word}`).width

      if (lineWidth < maxWidth || currentLine.length === 0) {
        currentLine += ` ${word}`
      } else {
        lines.push(currentLine.trim())
        currentLine = word
      }
    })

    if (currentLine.length > 0) {
      lines.push(currentLine.trim())
    }
  })

  // Handle empty lines at the end of the text
  const emptyLineCount = [...text].reduceRight((count, char, index) => {
    if (char === '\n' && index === text.length - count - 1) {
      return count + 1
    }
    return count
  }, 0)

  // Add empty lines at the end
  lines.push(...Array(emptyLineCount).fill(''))

  return lines
}
