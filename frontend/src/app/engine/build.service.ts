import type {BufferAttribute, Material, Mesh, Object3D} from 'three'
import {inject, Service, signal} from '@angular/core'
import {Subject} from 'rxjs'
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
import type {PropCtl} from '../world/prop.service'
import {
  TERRAIN_HOLE_FLAG,
  TERRAIN_PAGE_SIZE,
  X_AXIS,
  Y_AXIS,
  Z_AXIS
} from '../utils/constants'
import {PropActionService} from '../world/prop-action.service'
import {InputSystemService} from './inputsystem.service'

export interface SelectedCell {
  page?: Mesh
  cellX?: number
  cellZ?: number
  height?: number
  texture?: number
  rotation?: number
  hole?: boolean
}

@Service()
export class BuildService {
  buildMode = false
  selectedCell = signal<SelectedCell>({})
  selectedProp = signal<Group>(null)
  cellControl = new Subject<{action: PropCtl; cameraDirection: Vector3}>()
  private axesHelper: AxesHelper | null = null
  private cellBuildNode: Group | null = null
  private cellSelection: Group | null = null
  private propSelection: Group | null = null
  private propSelectionBox: LineSegments | null = null
  private readonly inputSysSvc = inject(InputSystemService)
  private readonly propActionSvc = inject(PropActionService)

  initPropCallbacks(prop: Group) {
    prop.userData.onShow = (shown: () => void) => {
      this.propActionSvc.showProp(prop)
      shown()
    }
    prop.userData.onHide = (hidden: () => void) => {
      this.propActionSvc.hideProp(prop)
      hidden()
    }
    prop.userData.onClick = (clicked: () => void) => {
      this.propActionSvc.clickProp(prop)
      clicked()
    }
    prop.userData.onBump = (bumped: () => void) => {
      this.propActionSvc.bumpProp(prop)
      bumped()
    }
    prop.userData.onUpdate = () => Function.prototype
  }

  selectProp(prop: Group, buildNode: Group) {
    if (this.cellSelection != null) {
      this.deselectCell()
    }
    if (this.propSelection != null) {
      this.deselectProp()
    }
    this.buildMode = true
    this.selectedProp.set(prop)
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

  deselectProp() {
    if (this.propSelectionBox == null) {
      return
    }
    this.axesHelper?.dispose()
    this.propSelection?.parent.remove(this.propSelection)
    this.axesHelper = null
    this.propSelection = null
    this.propSelectionBox?.geometry.dispose()
    ;(this.propSelectionBox?.material as Material)?.dispose()
    this.propSelectionBox = null
    const prop = this.selectedProp()
    this.selectedProp.set(null)
    this.buildMode = false
    if (prop == null) {
      return
    }
    // Track the parent chunk in case of prop deletion since the code is async
    const chunk = prop.parent
    this.propActionSvc.parseActions(prop).then(() => {
      this.propActionSvc.showProp(prop)
      chunk.userData.bvhUpdate.next()
    })
  }

  moveProp(action: PropCtl, cameraDirection: Vector3) {
    if (action === 'deselect') {
      this.deselectProp()
      return
    }
    const allowRotation =
      this.selectedProp().userData.rwx?.axisAlignment === 'none'
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
        this.selectedProp().position.add({x: 0, y: moveStep, z: 0})
        break
      }
      case 'down': {
        this.selectedProp().position.add({x: 0, y: -moveStep, z: 0})
        break
      }
      case 'forward': {
        this.selectedProp().position.add(v.multiplyScalar(moveStep))
        break
      }
      case 'backward': {
        this.selectedProp().position.add(v.multiplyScalar(-moveStep))
        break
      }
      case 'left': {
        this.selectedProp().position.add({
          x: v.z * moveStep,
          y: 0,
          z: v.x * -moveStep
        })
        this.updatePropSelectionBox()
        break
      }
      case 'right': {
        this.selectedProp().position.add({
          x: v.z * -moveStep,
          y: 0,
          z: v.x * moveStep
        })
        break
      }
      case 'rotY': {
        if (allowRotation) {
          this.selectedProp().rotateOnAxis(Y_AXIS, rotStep)
        }
        break
      }
      case 'rotnY': {
        if (allowRotation) {
          this.selectedProp().rotateOnAxis(Y_AXIS, -rotStep)
        }
        break
      }
      case 'rotX': {
        if (allowRotation) {
          this.selectedProp().rotateOnAxis(X_AXIS, rotStep)
        }
        break
      }
      case 'rotnX': {
        if (allowRotation) {
          this.selectedProp().rotateOnAxis(X_AXIS, -rotStep)
        }
        break
      }
      case 'rotZ': {
        if (allowRotation) {
          this.selectedProp().rotateOnAxis(Z_AXIS, rotStep)
        }
        break
      }
      case 'rotnZ': {
        if (allowRotation) {
          this.selectedProp().rotateOnAxis(Z_AXIS, -rotStep)
        }
        break
      }
      case 'snapGrid': {
        this.selectedProp().position.set(
          Math.round(this.selectedProp().position.x * 2) / 2,
          Math.round(this.selectedProp().position.y * 2) / 2,
          Math.round(this.selectedProp().position.z * 2) / 2
        )
        break
      }
      case 'rotReset': {
        if (allowRotation) {
          this.selectedProp().rotation.set(0, 0, 0)
        }
        break
      }
      case 'copy': {
        const {parent} = this.selectedProp()
        this.selectedProp.set(this.selectedProp().clone())
        this.initPropCallbacks(this.selectedProp())
        this.selectedProp().position.add(v.multiplyScalar(moveStep))
        parent.add(this.selectedProp())
        break
      }
      default:
        return
    }
    this.updatePropSelectionBox()
  }

  private updatePropSelectionBox(): void {
    this.selectedProp().updateMatrix()
    const chunkData = this.selectedProp().parent.userData.world.chunk
    const center = new Vector3(
      this.selectedProp().userData.boxCenter.x,
      this.selectedProp().userData.boxCenter.y,
      this.selectedProp().userData.boxCenter.z
    )
    this.propSelectionBox.position.copy(center)
    center.applyAxisAngle(Y_AXIS, this.selectedProp().rotation.y)
    center.applyAxisAngle(Z_AXIS, this.selectedProp().rotation.z)
    center.applyAxisAngle(X_AXIS, this.selectedProp().rotation.x)
    this.propSelection.position.set(
      chunkData.x + this.selectedProp().position.x,
      this.selectedProp().position.y,
      chunkData.z + this.selectedProp().position.z
    )
    this.propSelection.rotation.copy(this.selectedProp().rotation)
    this.propSelection.updateMatrix()
  }

  selectCell(terrainPage: Object3D, faceIndex: number, buildNode: Group) {
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
    const mesh = terrainPage as Mesh
    const index = mesh.geometry.getIndex()

    if (index == null) {
      return
    }

    const seVertex = index.getX((faceIndex & ~1) * 3)
    const stride = TERRAIN_PAGE_SIZE + 1
    const cellX = seVertex % stride
    const cellZ = Math.floor(seVertex / stride)
    this.selectCellAt(mesh, cellX, cellZ, buildNode)
  }

  selectCellAt(
    terrainPage: Mesh,
    cellX: number,
    cellZ: number,
    buildNode?: Group
  ) {
    this.deselectProp()
    if (this.cellSelection != null) {
      this.clearCellSelection()
    }
    if (buildNode != null) {
      this.cellBuildNode = buildNode
    }
    if (this.cellBuildNode == null) {
      return
    }

    this.buildMode = true
    this.cellSelection = new Group()

    const {cellSE, cellNE, cellNW, cellSW} = this.getCellCorners(
      terrainPage,
      cellX,
      cellZ
    )

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
    this.cellBuildNode.add(this.cellSelection)

    const stride = TERRAIN_PAGE_SIZE + 1
    const position = terrainPage.geometry.getAttribute(
      'position'
    ) as BufferAttribute
    const height = Math.round(position.getY(cellZ * stride + cellX) * 100) / 100
    const textures = terrainPage.userData.textures as Uint16Array | undefined
    const raw = textures ? textures[cellZ * TERRAIN_PAGE_SIZE + cellX] : 0
    const hole = (raw & TERRAIN_HOLE_FLAG) !== 0
    const texture = raw & 63
    const rotation = (raw >> 6) & 3

    this.selectedCell.set({
      page: terrainPage,
      cellX,
      cellZ,
      height,
      texture,
      rotation,
      hole
    })
  }

  refreshCellSelection() {
    const {page, cellX, cellZ} = this.selectedCell()
    if (
      page == null ||
      cellX == null ||
      cellZ == null ||
      this.cellSelection == null
    ) {
      return
    }
    const {cellSE, cellNE, cellNW, cellSW} = this.getCellCorners(
      page,
      cellX,
      cellZ
    )
    const [cell, square] = this.cellSelection.children as Line[]
    const cellPos = cell.geometry.getAttribute('position') as BufferAttribute
    cellPos.setXYZ(0, cellSE.x, cellSE.y, cellSE.z)
    cellPos.setXYZ(1, cellNE.x, cellNE.y, cellNE.z)
    cellPos.setXYZ(2, cellNW.x, cellNW.y, cellNW.z)
    cellPos.setXYZ(3, cellSW.x, cellSW.y, cellSW.z)
    cellPos.setXYZ(4, cellSE.x, cellSE.y, cellSE.z)
    cellPos.needsUpdate = true

    const squarePos = square.geometry.getAttribute(
      'position'
    ) as BufferAttribute
    squarePos.setXYZ(0, cellSE.x - 0.5, cellSE.y, cellSE.z - 0.5)
    squarePos.setXYZ(1, cellSE.x - 0.5, cellSE.y, cellSE.z + 0.5)
    squarePos.setXYZ(2, cellSE.x + 0.5, cellSE.y, cellSE.z + 0.5)
    squarePos.setXYZ(3, cellSE.x + 0.5, cellSE.y, cellSE.z - 0.5)
    squarePos.setXYZ(4, cellSE.x - 0.5, cellSE.y, cellSE.z - 0.5)
    squarePos.needsUpdate = true
  }

  deselectCell() {
    if (this.cellSelection == null) {
      return
    }
    this.clearCellSelection()
    this.cellBuildNode = null
    this.buildMode = false
    this.selectedCell.set({})
  }

  private clearCellSelection() {
    if (this.cellSelection == null) {
      return
    }
    for (const line of this.cellSelection.children as Line[]) {
      line.geometry.dispose()
      ;(line.material as Material).dispose()
    }
    this.cellSelection.parent?.remove(this.cellSelection)
    this.cellSelection = null
  }

  private getCellCorners(terrainPage: Mesh, cellX: number, cellZ: number) {
    const position = terrainPage.geometry.getAttribute(
      'position'
    ) as BufferAttribute
    const localPos = terrainPage.getWorldPosition(new Vector3())
    const stride = TERRAIN_PAGE_SIZE + 1
    const a = cellZ * stride + cellX
    const b = a + stride
    const c = b + 1
    const d = a + 1

    const cellSE = new Vector3().fromBufferAttribute(position, a).add(localPos)
    const cellNE = new Vector3().fromBufferAttribute(position, b).add(localPos)
    const cellNW = new Vector3().fromBufferAttribute(position, c).add(localPos)
    const cellSW = new Vector3().fromBufferAttribute(position, d).add(localPos)
    return {cellSE, cellNE, cellNW, cellSW}
  }
}
