import {ElementRef, Injectable, NgZone, OnDestroy} from '@angular/core'
import {
  AmbientLight,
  BoxGeometry, DoubleSide, EdgesGeometry, LineBasicMaterial, LineSegments, LoadingManager, Mesh,
  MeshBasicMaterial, Object3D, PerspectiveCamera,
  PlaneGeometry,
  Raycaster, RepeatWrapping, Scene,
  TextureLoader, Vector2, Vector3,
  WebGLRenderer
} from 'three'
import {config} from '../app.config'
import {RWXLoader} from '../utils/rwxloader'
import * as JSZip from 'jszip'
import JSZipUtils from 'jszip-utils'

export const RES_PATH = config.url.resource
export const enum key { UP = 0, RIGHT, DOWN, LEFT, PGUP, PGDOWN, PLUS, MINUS, CTRL, SHIFT }

@Injectable({providedIn: 'root'})
export class EngineService implements OnDestroy {
  private canvas: HTMLCanvasElement
  private renderer: WebGLRenderer
  private camera: PerspectiveCamera
  private thirdCamera: PerspectiveCamera
  private activeCamera: PerspectiveCamera
  private scene: Scene
  private light: AmbientLight
  private avatar: Mesh

  private frameId: number = null

  private rwxLoader: any
  private selectionBox: LineSegments
  private controls: boolean[] = Array(9).fill(false)

  private mouse = new Vector2()
  private raycaster = new Raycaster()

  public constructor(private ngZone: NgZone) {
  }

  public ngOnDestroy(): void {
    if (this.frameId != null) {
      cancelAnimationFrame(this.frameId)
    }
  }

  public createScene(canvas: ElementRef<HTMLCanvasElement>): void {
    this.canvas = canvas.nativeElement

    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      alpha: true,    // transparent background
      antialias: true // smooth edges
    })
    this.renderer.setSize(window.innerWidth, window.innerHeight)

    const loader = new TextureLoader()
    const bgTexture = loader.load(`${RES_PATH}/textures/faesky02right.jpg`)

    this.scene = new Scene()
    this.scene.background = bgTexture

    this.camera = new PerspectiveCamera(
      75, window.innerWidth / window.innerHeight, 0.1, 1000
    )
    this.camera.rotation.order = 'YXZ'
    this.camera.position.z = 0
    this.camera.position.y = 0.2
    this.scene.add(this.camera)

    this.thirdCamera = new PerspectiveCamera(
      75, window.innerWidth / window.innerHeight, 0.1, 1000
    )
    this.thirdCamera.rotation.order = 'YXZ'
    this.thirdCamera.position.z = 0.5
    this.thirdCamera.position.y = 0.2
    this.camera.attach(this.thirdCamera)

    this.activeCamera = this.camera

    this.light = new AmbientLight(0x404040)
    this.light.position.z = 10
    this.scene.add(this.light)

    const floorTexture = loader.load(`${RES_PATH}/textures/terrain17.jpg`)
    floorTexture.wrapS = RepeatWrapping
    floorTexture.wrapT = RepeatWrapping
    floorTexture.repeat.set(128, 128)

    // DoubleSide: render texture on both sides of mesh
    const floorMaterial = new MeshBasicMaterial( { map: floorTexture, side: DoubleSide } )
    const floorGeometry = new PlaneGeometry(100, 100, 1, 1)
    const floor = new Mesh(floorGeometry, floorMaterial)
    floor.position.y = 0
    floor.rotation.x = Math.PI / 2
    this.scene.add(floor)

    const manager = new LoadingManager()
    this.rwxLoader = new RWXLoader(manager)
    this.rwxLoader.setPath(`${RES_PATH}/rwx`).setResourcePath(`${RES_PATH}/textures`).setJSZip(JSZip, JSZipUtils)

    this.rwxLoader.load('michel.rwx', (rwx: Mesh) => {
      this.avatar = new Mesh()
      this.avatar.geometry = rwx.geometry
      this.avatar.material = rwx.material
      this.avatar.name = 'avatar'
      this.avatar.position.x = 0
      this.avatar.position.y = 0.12
      this.avatar.position.z = 0
      this.avatar.rotation.y = Math.PI
      this.camera.attach(this.avatar)
    })
  }

  public setWorld(data: any) {
    for (const item of this.scene.children) {
      if (item.name.length > 0) {
        this.scene.remove(item)
      }
    }
    for (const item of data.objects) {
      this.loadItem(item[0], new Vector3(item[1], item[2], item[3]))
    }
  }

  public loadItem(item: string, pos: Vector3) {
    if (!item.endsWith('.rwx')) {
      item += '.rwx'
    }
    this.rwxLoader.load(item, (rwx: Mesh) => {
      const mesh = new Mesh()
      mesh.geometry = rwx.geometry
      mesh.material = rwx.material
      mesh.name = item
      mesh.position.x = pos.x
      mesh.position.y = pos.y
      mesh.position.z = pos.z
      this.scene.add(mesh)
    })
  }

  public select(item: Mesh) {
    if (this.selectionBox == null) {
      const selectMesh = new Mesh(new BoxGeometry(1, 1, 1),
      new MeshBasicMaterial())
      selectMesh.matrixAutoUpdate = false
      selectMesh.visible = false

      const geometry = item.geometry

      if ( geometry.boundingBox === null ) {
        geometry.computeBoundingBox()
      }

      selectMesh.geometry.vertices[0].y = geometry.boundingBox.max.y
      selectMesh.geometry.vertices[0].z = geometry.boundingBox.max.z
      selectMesh.geometry.vertices[1].x = geometry.boundingBox.max.x
      selectMesh.geometry.vertices[1].y = geometry.boundingBox.max.y
      selectMesh.geometry.vertices[1].z = geometry.boundingBox.min.z
      selectMesh.geometry.vertices[2].x = geometry.boundingBox.max.x
      selectMesh.geometry.vertices[2].y = geometry.boundingBox.min.y
      selectMesh.geometry.vertices[2].z = geometry.boundingBox.max.z
      selectMesh.geometry.vertices[3].x = geometry.boundingBox.max.x
      selectMesh.geometry.vertices[3].y = geometry.boundingBox.min.y
      selectMesh.geometry.vertices[3].z = geometry.boundingBox.min.z
      selectMesh.geometry.vertices[4].x = geometry.boundingBox.min.x
      selectMesh.geometry.vertices[4].y = geometry.boundingBox.max.y
      selectMesh.geometry.vertices[0].x = geometry.boundingBox.max.x
      selectMesh.geometry.vertices[4].z = geometry.boundingBox.min.z
      selectMesh.geometry.vertices[5].x = geometry.boundingBox.min.x
      selectMesh.geometry.vertices[5].y = geometry.boundingBox.max.y
      selectMesh.geometry.vertices[5].z = geometry.boundingBox.max.z
      selectMesh.geometry.vertices[6].x = geometry.boundingBox.min.x
      selectMesh.geometry.vertices[6].y = geometry.boundingBox.min.y
      selectMesh.geometry.vertices[6].z = geometry.boundingBox.min.z
      selectMesh.geometry.vertices[7].x = geometry.boundingBox.min.x
      selectMesh.geometry.vertices[7].y = geometry.boundingBox.min.y
      selectMesh.geometry.vertices[7].z = geometry.boundingBox.max.z
      selectMesh.geometry.computeBoundingSphere()
      selectMesh.geometry.verticesNeedUpdate = true
      selectMesh.matrixWorld.copy(item.matrixWorld)

      const edges = new EdgesGeometry(selectMesh.geometry)

      selectMesh.geometry.dispose()
      selectMesh.material.dispose()

      this.selectionBox = new LineSegments(edges, new LineBasicMaterial( { color: 0xffff00, depthTest: false } ))
      edges.dispose()
      item.add(this.selectionBox)

    } else {
      this.selectionBox.visible = false
      this.selectionBox.geometry.dispose()
      this.scene.remove(this.selectionBox)
      this.selectionBox = null
    }
  }

  public animate(): void {
    // We have to run this outside angular zones,
    // because it could trigger heavy changeDetection cycles.
    this.ngZone.runOutsideAngular(() => {
      if (document.readyState !== 'loading') {
        this.render()
      } else {
        window.addEventListener('DOMContentLoaded', () => {
          this.render()
        })
      }
      window.addEventListener('resize', () => {
        this.resize()
      })
      this.canvas.addEventListener('contextmenu', (e) => {
        this.rightClick(e)
      })
      window.addEventListener('keydown', (e: KeyboardEvent) => {
        if ((e.target as HTMLElement).nodeName === 'BODY') {
          this.handleKeys(e.key, true)
          e.preventDefault()
        }
      })
      window.addEventListener('keyup', (e: KeyboardEvent) => {
        if ((e.target as HTMLElement).nodeName === 'BODY') {
          this.handleKeys(e.key, false)
          e.preventDefault()
        }
      })
    })
  }

  private handleKeys(k, value) {
    switch (k) {
      case 'ArrowUp': {
        this.controls[key.UP] = value
        break
      }
      case 'ArrowDown': {
        this.controls[key.DOWN] = value
        break
      }
      case 'ArrowLeft': {
        this.controls[key.LEFT] = value
        break
      }
      case 'ArrowRight': {
        this.controls[key.RIGHT] = value
        break
      }
      case 'PageUp': {
        this.controls[key.PGUP] = value
        break
      }
      case 'PageDown': {
        this.controls[key.PGDOWN] = value
        break
      }
      case '+': {
        this.controls[key.PLUS] = value
        break
      }
      case '-': {
        this.controls[key.MINUS] = value
        break
      }
      case 'Control': {
        this.controls[key.CTRL] = value
        break
      }
      case 'Shift': {
        this.controls[key.SHIFT] = value
        break
      }
      default: {
         break
      }
    }
  }

  private moveCamera() {
    const cameraDirection = new Vector3()
    this.camera.getWorldDirection(cameraDirection)
    if (this.controls[key.UP]) {
      this.camera.position.addScaledVector(cameraDirection, 0.1)
    }
    if (this.controls[key.DOWN]) {
      this.camera.position.addScaledVector(cameraDirection, -0.1)
    }
    if (this.controls[key.LEFT]) {
      this.camera.rotation.y += 0.1
    }
    if (this.controls[key.RIGHT]) {
      this.camera.rotation.y -= 0.1
    }
    if (this.controls[key.PLUS]) {
      this.camera.position.y += 0.1
    }
    if (this.controls[key.MINUS]) {
      this.camera.position.y -= 0.1
    }
  }

  public toggleCamera() {
    this.activeCamera = this.activeCamera === this.camera ? this.thirdCamera : this.camera
  }

  public render(): void {
    this.frameId = requestAnimationFrame(() => {
      this.render()
    })

    const tractor = this.scene.children.find(o => o.name === 'tracteur1.rwx')
    if (tractor) {
      tractor.rotation.y += 0.01
      const d = new Vector3()
      tractor.getWorldDirection(d)
      tractor.position.addScaledVector(d, -0.005)
    }

    this.moveCamera()
    this.raycaster.setFromCamera(this.mouse, this.activeCamera)
    this.renderer.render(this.scene, this.activeCamera)
  }

  public resize(): void {
    const width = window.innerWidth
    const height = window.innerHeight

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()

    this.renderer.setSize(width, height)
  }

  public rightClick(event) {
    event.preventDefault()

    this.mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1
    this.mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1
    const intersects = this.raycaster.intersectObjects(this.scene.children)
    for (const o of intersects) {
      if (o.object.name.length) {
        this.select(o.object as Mesh)
      }
    }
  }
}
