import type {WritableSignal} from '@angular/core'
import {inject, Injectable, signal} from '@angular/core'
import {
  AxesHelper,
  BoxGeometry,
  BufferGeometry,
  EdgesGeometry,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Vector3
} from 'three'
import type {Object3D, Material, Mesh} from 'three'
import type {PropCtl} from '../world/prop.service'
import {InputSystemService} from './inputsystem.service'
import {X_AXIS, Y_AXIS, Z_AXIS} from '../utils'

@Injectable({
  providedIn: 'root'
})
export class BuildService {
  public buildMode = false
  public selectedProp: Group | null = null
  public selectedCellSignal: WritableSignal<{
    height?: number
    texture?: number
    hole?: boolean
  }> = signal({})
  public selectedPropSignal: WritableSignal<{
    name?: string
    desc?: string
    act?: string
    date?: number
  }> = signal({})
  private axesHelper: AxesHelper | null = null
  private cellSelection: Group | null = null
  private propSelection: Group | null = null
  private propSelectionBox: LineSegments | null = null
  private inputSysSvc = inject(InputSystemService)

  public selectProp(prop: Group, buildNode: Group) {
    if (this.cellSelection != null) {
      this.deselectCell(buildNode)
    }
    if (this.propSelection != null) {
      this.deselectProp(buildNode)
    }
    this.buildMode = true
    this.selectedProp = prop
    this.selectedPropSignal.set({
      name: prop.name,
      desc: prop.userData.desc,
      act: prop.userData.act,
      date: prop.userData.date
    })
    console.log(prop)

    const geometry = new BoxGeometry(
      prop.userData.box.x,
      prop.userData.box.y,
      prop.userData.box.z
    )
    const edges = new EdgesGeometry(geometry)
    this.propSelection = new Group()
    this.propSelectionBox = new LineSegments(
      edges,
      new LineBasicMaterial({color: 0xffff00, depthTest: false})
    )
    this.axesHelper = new AxesHelper(5)
    ;(this.axesHelper.material as Material).depthTest = false
    this.propSelection.add(this.propSelectionBox, this.axesHelper)

    this.updatePropSelectionBox()

    buildNode.add(this.propSelection)
  }

  public deselectProp(buildNode: Group) {
    if (this.propSelectionBox == null) {
      return
    }
    this.selectedProp.parent.userData.bvhUpdate.next()
    this.buildMode = false
    this.selectedProp = null
    this.selectedPropSignal.set({})
    this.propSelectionBox.geometry.dispose()
    ;(this.propSelectionBox.material as Material).dispose()
    this.axesHelper?.dispose()
    buildNode.remove(this.propSelection)
    this.propSelectionBox = null
    this.axesHelper = null
    this.propSelection = null
  }

  public moveProp(action: PropCtl, cameraDirection: Vector3, buildNode: Group) {
    if (action === 'deselect') {
      this.deselectProp(buildNode)
      return
    }
    const allowRotation =
      this.selectedProp.userData.rwx?.axisAlignment === 'none'
    let moveStep = 0.5
    let rotStep = Math.PI / 12
    if (this.inputSysSvc.controls['clip']) {
      moveStep = 0.05
      rotStep = Math.PI / 120
      if (this.inputSysSvc.controls['run']) {
        moveStep = 0.01
        rotStep = Math.PI / 180
      }
    }
    const v = new Vector3()
    if (Math.abs(cameraDirection.x) >= Math.abs(cameraDirection.z)) {
      v.x = Math.sign(cameraDirection.x)
    } else {
      v.z = Math.sign(cameraDirection.z)
    }
    switch (action) {
      case 'up': {
        this.selectedProp.position.add(new Vector3(0, moveStep, 0))
        this.updatePropSelectionBox()
        break
      }
      case 'down': {
        this.selectedProp.position.add(new Vector3(0, -moveStep, 0))
        this.updatePropSelectionBox()
        break
      }
      case 'forward': {
        this.selectedProp.position.add(v.multiplyScalar(moveStep))
        this.updatePropSelectionBox()
        break
      }
      case 'backward': {
        this.selectedProp.position.add(v.multiplyScalar(-moveStep))
        this.updatePropSelectionBox()
        break
      }
      case 'left': {
        this.selectedProp.position.add(
          new Vector3(v.z * moveStep, 0, v.x * -moveStep)
        )
        this.updatePropSelectionBox()
        break
      }
      case 'right': {
        this.selectedProp.position.add(
          new Vector3(v.z * -moveStep, 0, v.x * moveStep)
        )
        this.updatePropSelectionBox()
        break
      }
      case 'rotY': {
        if (allowRotation) {
          this.selectedProp.rotateOnAxis(Y_AXIS, rotStep)
          this.updatePropSelectionBox()
        }
        break
      }
      case 'rotnY': {
        if (allowRotation) {
          this.selectedProp.rotateOnAxis(Y_AXIS, -rotStep)
          this.updatePropSelectionBox()
        }
        break
      }
      case 'rotX': {
        if (allowRotation) {
          this.selectedProp.rotateOnAxis(X_AXIS, rotStep)
          this.updatePropSelectionBox()
        }
        break
      }
      case 'rotnX': {
        if (allowRotation) {
          this.selectedProp.rotateOnAxis(X_AXIS, -rotStep)
          this.updatePropSelectionBox()
        }
        break
      }
      case 'rotZ': {
        if (allowRotation) {
          this.selectedProp.rotateOnAxis(Z_AXIS, rotStep)
          this.updatePropSelectionBox()
        }
        break
      }
      case 'rotnZ': {
        if (allowRotation) {
          this.selectedProp.rotateOnAxis(Z_AXIS, -rotStep)
          this.updatePropSelectionBox()
        }
        break
      }
      case 'snapGrid': {
        this.selectedProp.position.set(
          Math.round(this.selectedProp.position.x * 2) / 2,
          Math.round(this.selectedProp.position.y * 2) / 2,
          Math.round(this.selectedProp.position.z * 2) / 2
        )
        this.updatePropSelectionBox()
        break
      }
      case 'rotReset': {
        if (allowRotation) {
          this.selectedProp.rotation.set(0, 0, 0)
          this.updatePropSelectionBox()
        }
        break
      }
      case 'copy': {
        const {parent} = this.selectedProp
        this.selectedProp = this.selectedProp.clone()
        this.selectedProp.position.add(v.multiplyScalar(moveStep))
        parent.add(this.selectedProp)
        this.updatePropSelectionBox()
        break
      }
      default:
        return
    }
  }

  private updatePropSelectionBox(): void {
    this.selectedProp.updateMatrix()
    const chunkData = this.selectedProp.parent.userData.world.chunk
    const center = new Vector3(
      this.selectedProp.userData.boxCenter.x,
      this.selectedProp.userData.boxCenter.y,
      this.selectedProp.userData.boxCenter.z
    )
    this.propSelectionBox.position.copy(center)
    center.applyAxisAngle(Y_AXIS, this.selectedProp.rotation.y)
    center.applyAxisAngle(Z_AXIS, this.selectedProp.rotation.z)
    center.applyAxisAngle(X_AXIS, this.selectedProp.rotation.x)
    this.propSelection.position.copy(
      new Vector3(
        chunkData.x + this.selectedProp.position.x,
        this.selectedProp.position.y,
        chunkData.z + this.selectedProp.position.z
      )
    )
    this.propSelection.rotation.copy(this.selectedProp.rotation)
    this.propSelection.updateMatrix()
  }

  public selectCell(
    terrainPage: Object3D,
    faceIndex: number,
    buildNode: Group
  ) {
    /**
     * Face indices for a 2x2 page:
     * +--+--+
     * |7/|5/|
     * |/6|/4|  ^
     * +--+--+  N
     * |3/|1/|
     * |/2|/0|
     * +--+--+
     *
     * Face vertices for a cell:
     * nwY---seY
     *  |   / |   ^
     *  | /   |   N
     * seZ---seX
     */
    this.deselectProp(buildNode)
    if (this.cellSelection != null) {
      this.deselectCell(buildNode)
    }

    this.cellSelection = new Group()

    const {position} = (terrainPage as Mesh).geometry.attributes
    const localPos = (terrainPage as Mesh).getWorldPosition(new Vector3())
    const seIndex = faceIndex % 2 === 0 ? faceIndex : faceIndex - 1
    const nwIndex = faceIndex % 2 !== 0 ? faceIndex : faceIndex + 1
    const index = (terrainPage as Mesh).geometry.getIndex()

    if (index == null) {
      return
    }

    const cellSE = localPos
      .clone()
      .add(new Vector3().fromBufferAttribute(position, index.getX(seIndex * 3)))
    const cellNE = localPos
      .clone()
      .add(new Vector3().fromBufferAttribute(position, index.getY(seIndex * 3)))
    const cellSW = localPos
      .clone()
      .add(new Vector3().fromBufferAttribute(position, index.getZ(seIndex * 3)))
    const cellNW = localPos
      .clone()
      .add(new Vector3().fromBufferAttribute(position, index.getY(nwIndex * 3)))

    const square = new Line(
      new BufferGeometry().setFromPoints([
        new Vector3(-0.5, 0, -0.5).add(cellSE),
        new Vector3(-0.5, 0, 0.5).add(cellSE),
        new Vector3(0.5, 0, 0.5).add(cellSE),
        new Vector3(0.5, 0, -0.5).add(cellSE),
        new Vector3(-0.5, 0, -0.5).add(cellSE)
      ]),
      new LineBasicMaterial({color: 0xffff00, depthTest: false})
    )

    const cell = new Line(
      new BufferGeometry().setFromPoints([
        cellSE,
        cellNE,
        cellNW,
        cellSW,
        cellSE
      ]),
      new LineBasicMaterial({color: 0xff0000, depthTest: false})
    )
    this.cellSelection.add(cell, square)
    buildNode.add(this.cellSelection)
    this.selectedCellSignal.set({height: cellSE.y})
  }

  public deselectCell(buildNode: Group) {
    if (this.cellSelection == null) {
      return
    }
    for (const line of this.cellSelection.children as Line[]) {
      line.geometry.dispose()
      ;(line.material as Material).dispose()
    }
    buildNode.remove(this.cellSelection)
    this.cellSelection = null
    this.selectedCellSignal.set({})
  }
}
