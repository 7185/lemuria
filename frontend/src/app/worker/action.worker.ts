/// <reference lib="webworker" />

import {Action} from '@lemuria/action-parser'
import {textCanvas} from '../utils/text-canvas'

const actionParser = new Action()
const actionCache = new Map<string, Record<string, object[]>>()

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
    let parsed = actionCache.get(data.act)
    if (parsed === undefined) {
      if (actionCache.size >= 5000) {
        actionCache.clear()
      }
      parsed = actionParser.parse(data.act)
      actionCache.set(data.act, parsed)
    }
    postMessage({type: 'parseActionResult', parsed, id: data.id})
  }
})
