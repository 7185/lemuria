/// <reference lib="webworker" />

import {BufferAttribute, BufferGeometry} from 'three'
import {MeshBVH} from 'three-mesh-bvh'

addEventListener('message', ({data}) => {
  const {id, position, index} = data as {
    id: number
    position: Float32Array
    index: Uint16Array | Uint32Array
  }
  try {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(position, 3))
    geometry.setIndex(new BufferAttribute(index, 1))
    const bvh = new MeshBVH(geometry)
    const serialized = MeshBVH.serialize(bvh, {cloneBuffers: false})
    const transfer: Transferable[] = [
      position.buffer as ArrayBuffer,
      ...serialized.roots
    ]
    if (serialized.index) {
      transfer.push(serialized.index.buffer as ArrayBuffer)
    }
    postMessage({id, serialized, position}, transfer)
  } catch (error) {
    postMessage({id, error: (error as Error).message})
  }
})
