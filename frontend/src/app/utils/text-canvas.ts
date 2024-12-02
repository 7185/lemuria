/**
 * Displays text on an HTML canvas element
 *
 * @param text The text to display
 * @param ratio The canvas ratio
 * @param color The text color
 * @param bcolor The background color
 * @returns An HTML canvas element
 */
export function textCanvas(
  text: string,
  color: {r: number; g: number; b: number},
  bcolor: {r: number; g: number; b: number},
  ratio = 1
) {
  const canvas = document.createElement('canvas')
  const canvasWidth = ratio > 1 ? 256 : 256 * ratio
  const canvasHeight = ratio > 1 ? 256 / ratio : 256

  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = `rgb(${bcolor.r},${bcolor.g},${bcolor.b})`
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`
  ctx.textBaseline = 'middle'

  let fontSize = 128
  let fontFit = false

  // Find the maximum font size that fits the text without cropping
  while (!fontFit && fontSize > 0) {
    ctx.font = `500 ${fontSize}px Arimo,Arial,sans-serif`
    const lines = breakTextIntoLines(text, ctx, canvasWidth)

    const totalHeight = lines.length * fontSize * 1.2
    const totalWidth = Math.max(
      ...lines.map((line) => ctx.measureText(line).width)
    )

    const heightDifference = totalHeight - canvasHeight
    const widthDifference = totalWidth - canvasWidth
    // Estimate how big the adjustment needs to be in order to avoid too many measureText calls
    const adjustment = Math.trunc(
      Math.max(heightDifference, widthDifference) / fontSize
    )

    if (heightDifference <= 0 && widthDifference <= 0) {
      fontFit = true
    } else {
      // Keep the size even
      fontSize -= adjustment + (adjustment % 2) || 2
    }
  }

  const lines = breakTextIntoLines(text, ctx, canvasWidth)

  ctx.font = `500 ${fontSize}px Arimo,Arial,sans-serif`
  ctx.textBaseline = 'top'

  const lineHeight = fontSize * 1.2
  const startY = (canvasHeight - lines.length * lineHeight) / 2

  lines.forEach((line, index) => {
    const textWidth = ctx.measureText(line).width
    const startX = (canvasWidth - textWidth) / 2
    const y = startY + index * lineHeight
    ctx.fillText(line, startX, y)
  })

  return canvas
}

/**
 * Breaks the text into lines to fit within the given maximum width
 *
 * @param text The text to break into lines
 * @param ctx The canvas rendering context
 * @param maxWidth The maximum width of a line
 * @returns The array of lines
 */
function breakTextIntoLines(
  text: string,
  ctx: CanvasRenderingContext2D,
  maxWidth: number
): string[] {
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
