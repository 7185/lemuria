import {Injectable, signal} from '@angular/core'
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
import {PlayerCollider} from './player-collider'
import {ObjectAct} from '../world/object.service'
import {PressedKey, InputSystemService} from './inputsystem.service'
import {X_AXIS, Y_AXIS, Z_AXIS} from './engine.service'

@Injectable({
  providedIn: 'root'
})
export class BuildService {
  public buildMode = false
  public selectedProp: Group
  public selectedCellSignal = signal({})
  public selectedObjectSignal = signal({})
  private axesHelper: AxesHelper
  private cellSelection: Group
  private propSelection: Group
  private propSelectionBox: LineSegments

  constructor(private inputSysSvc: InputSystemService) {}

  public selectProp(item: Group, buildNode: Group) {
    if (this.cellSelection != null) {
      this.deselectCell(buildNode)
    }
    if (this.propSelection != null) {
      this.deselectProp(buildNode)
    }
    this.buildMode = true
    this.selectedProp = item
    this.selectedObjectSignal.set({
      name: item.name,
      desc: item.userData.desc,
      act: item.userData.act,
      date: item.userData.date
    })
    console.log(item)

    const geometry = new BoxGeometry(
      item.userData.box.x,
      item.userData.box.y,
      item.userData.box.z
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
    PlayerCollider.updateObjectBVH(this.selectedProp)
    this.buildMode = false
    this.selectedProp = null
    this.selectedObjectSignal.set({})
    this.propSelectionBox.geometry.dispose()
    ;(this.propSelectionBox.material as Material).dispose()
    this.axesHelper.dispose()
    buildNode.remove(this.propSelection)
    this.propSelectionBox = null
    this.axesHelper = null
    this.propSelection = null
  }

  public moveProp(
    action: ObjectAct,
    cameraDirection: Vector3,
    buildNode: Group
  ) {
    if (action === ObjectAct.deselect) {
      this.deselectProp(buildNode)
      return
    }
    const allowRotation =
      this.selectedProp.userData.rwx?.axisAlignment === 'none'
    let moveStep = 0.5
    let rotStep = Math.PI / 12
    if (this.inputSysSvc.controls[PressedKey.clip]) {
      moveStep = 0.05
      rotStep = Math.PI / 120
      if (this.inputSysSvc.controls[PressedKey.run]) {
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
      case ObjectAct.up: {
        this.selectedProp.translateY(moveStep)
        this.updatePropSelectionBox()
        break
      }
      case ObjectAct.down: {
        this.selectedProp.translateY(-moveStep)
        this.updatePropSelectionBox()
        break
      }
      case ObjectAct.forward: {
        this.selectedProp.position.add(v.multiplyScalar(moveStep))
        this.updatePropSelectionBox()
        break
      }
      case ObjectAct.backward: {
        this.selectedProp.position.add(v.multiplyScalar(-moveStep))
        this.updatePropSelectionBox()
        break
      }
      case ObjectAct.left: {
        this.selectedProp.position.add(
          new Vector3(v.z * moveStep, 0, v.x * -moveStep)
        )
        this.updatePropSelectionBox()
        break
      }
      case ObjectAct.right: {
        this.selectedProp.position.add(
          new Vector3(v.z * -moveStep, 0, v.x * moveStep)
        )
        this.updatePropSelectionBox()
        break
      }
      case ObjectAct.rotY: {
        if (allowRotation) {
          this.selectedProp.rotateOnAxis(Y_AXIS, rotStep)
          this.updatePropSelectionBox()
        }
        break
      }
      case ObjectAct.rotnY: {
        if (allowRotation) {
          this.selectedProp.rotateOnAxis(Y_AXIS, -rotStep)
          this.updatePropSelectionBox()
        }
        break
      }
      case ObjectAct.rotX: {
        if (allowRotation) {
          this.selectedProp.rotateOnAxis(X_AXIS, rotStep)
          this.updatePropSelectionBox()
        }
        break
      }
      case ObjectAct.rotnX: {
        if (allowRotation) {
          this.selectedProp.rotateOnAxis(X_AXIS, -rotStep)
          this.updatePropSelectionBox()
        }
        break
      }
      case ObjectAct.rotZ: {
        if (allowRotation) {
          this.selectedProp.rotateOnAxis(Z_AXIS, rotStep)
          this.updatePropSelectionBox()
        }
        break
      }
      case ObjectAct.rotnZ: {
        if (allowRotation) {
          this.selectedProp.rotateOnAxis(Z_AXIS, -rotStep)
          this.updatePropSelectionBox()
        }
        break
      }
      case ObjectAct.snapGrid: {
        this.selectedProp.position.set(
          Math.round(this.selectedProp.position.x * 2) / 2,
          Math.round(this.selectedProp.position.y * 2) / 2,
          Math.round(this.selectedProp.position.z * 2) / 2
        )
        this.updatePropSelectionBox()
        break
      }
      case ObjectAct.rotReset: {
        if (allowRotation) {
          this.selectedProp.rotation.set(0, 0, 0)
          this.updatePropSelectionBox()
        }
        break
      }
      case ObjectAct.copy: {
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

    const squareGeom = new BufferGeometry().setFromPoints([
      new Vector3(-0.5, 0, -0.5).add(cellSE),
      new Vector3(-0.5, 0, 0.5).add(cellSE),
      new Vector3(0.5, 0, 0.5).add(cellSE),
      new Vector3(0.5, 0, -0.5).add(cellSE),
      new Vector3(-0.5, 0, -0.5).add(cellSE)
    ])
    const square = new Line(
      squareGeom,
      new LineBasicMaterial({color: 0xffff00, depthTest: false})
    )
    this.cellSelection.add(square)

    const cellGeom = new BufferGeometry().setFromPoints([
      cellSE,
      cellNE,
      cellNW,
      cellSW,
      cellSE
    ])
    const cell = new Line(
      cellGeom,
      new LineBasicMaterial({color: 0xff0000, depthTest: false})
    )
    this.cellSelection.add(cell)
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
