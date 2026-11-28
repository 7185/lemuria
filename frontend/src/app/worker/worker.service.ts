import {Service} from '@angular/core'
import {BufferAttribute, BufferGeometry} from 'three'
import {MeshBVH} from 'three-mesh-bvh'

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
}

@Service()
export class WorkerService {
  private actionWorker = new Worker(new URL('./action.worker', import.meta.url))
  private bvhWorker = new Worker(new URL('./bvh.worker', import.meta.url))
  private pending = new Map<number, PendingRequest>()
  private messageId = 0

  constructor() {
    this.actionWorker.onmessage = ({data}: MessageEvent) =>
      this.resolveRequest(data.id, () => {
        if (data.type === 'textCanvasResult') return data.bitmap
        if (data.type === 'parseActionResult') return data.parsed
        throw new Error(data.error ?? 'Unexpected worker response')
      })

    this.bvhWorker.onmessage = ({data}: MessageEvent) =>
      this.resolveRequest(data.id, () => {
        if (data.error) throw new Error(data.error)
        const geometry = new BufferGeometry()
        geometry.setAttribute('position', new BufferAttribute(data.position, 3))
        return MeshBVH.deserialize(data.serialized, geometry)
      })
  }

  textCanvas(
    text: string,
    color: {r: number; g: number; b: number},
    bcolor: {r: number; g: number; b: number},
    ratio: number
  ): Promise<ImageBitmap> {
    return this.send(this.actionWorker, {
      type: 'textCanvasRequest',
      text,
      color,
      bcolor,
      ratio
    })
  }

  parseAction(act: string): Promise<Record<string, object[]>> {
    return this.send(this.actionWorker, {type: 'parseActionRequest', act})
  }

  computeBVH(
    position: Float32Array,
    index: Uint16Array | Uint32Array
  ): Promise<MeshBVH> {
    return this.send(this.bvhWorker, {position, index}, [
      position.buffer as ArrayBuffer,
      index.buffer as ArrayBuffer
    ])
  }

  private resolveRequest(id: number, getResult: () => unknown) {
    const req = this.pending.get(id)
    if (!req) {
      return
    }
    this.pending.delete(id)
    try {
      req.resolve(getResult())
    } catch (err) {
      req.reject(err as Error)
    }
  }

  private send<T>(
    worker: Worker,
    payload: Record<string, unknown>,
    transfer?: Transferable[]
  ): Promise<T> {
    const id = this.messageId++
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject
      })
      worker.postMessage({...payload, id}, transfer ?? [])
    })
  }
}
