/// <reference lib="webworker" />

import {Action} from '@lemuria/action-parser'
import {textCanvas} from '../utils/text-canvas'

const actionParser = new Action()

addEventListener('message', async ({data}) => {
  if (data.type === 'textCanvasRequest') {
    try {
      const bitmap = await textCanvas(
        data.text,
        data.color,
        data.bcolor,
        data.ratio
      )
      postMessage({type: 'textCanvasResult', bitmap, id: data.id}, [bitmap])
    } catch (error) {
      postMessage({type: 'textCanvasError', error: error.message, id: data.id})
    }
  }

  if (data.type === 'parseActionRequest') {
    const parsed = actionParser.parse(data.act)
    postMessage({type: 'parseActionResult', parsed, id: data.id})
  }
})
