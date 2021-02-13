import {ElementRef, Injectable, NgZone, OnDestroy} from '@angular/core'
import {
  AmbientLight,
  BoxGeometry, DoubleSide, EdgesGeometry, LineBasicMaterial, LineSegments, LoadingManager, Mesh,
  MeshBasicMaterial, PerspectiveCamera,
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
  private scene: Scene
  private light: AmbientLight

  private tractor: Mesh
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
    this.camera.position.z = 1
    this.camera.position.y = 0.2
    this.scene.add(this.camera)

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

    this.tractor = new Mesh(new BoxGeometry(), new MeshBasicMaterial())
    const three = new Mesh(new BoxGeometry(), new MeshBasicMaterial())
    const three2 = new Mesh(new BoxGeometry(), new MeshBasicMaterial())
    const three3 = new Mesh(new BoxGeometry(), new MeshBasicMaterial())

    const manager = new LoadingManager()
    this.rwxLoader = new RWXLoader(manager)
    this.rwxLoader.setPath(`${RES_PATH}/rwx`).setResourcePath(`${RES_PATH}/textures`).setJSZip(JSZip, JSZipUtils)
    this.loadItem(this.tractor, 'tracteur1.rwx', new Vector3(0, 0, 0))
    this.loadItem(three, 'arbre1.rwx', new Vector3(1, 0, 1))
    this.loadItem(three2, 'arbre10.rwx', new Vector3(2, 0, 0))
    this.loadItem(three3, 'arbre20.rwx', new Vector3(2, 0, 3))
  }

  public loadItem(mesh: Mesh, item: string, pos: Vector3) {
    this.rwxLoader.load(item, (rwx: Mesh) => {
      mesh.geometry.dispose()
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

      this.selectionBox = new LineSegments(edges, new LineBasicMaterial( { color: 0xffff00 } ))
      item.add(this.selectionBox)

    } else {
      // FIXME: actually remove the box
      this.selectionBox.visible = false
      this.scene.remove(this.selectionBox)
      this.selectionBox.geometry.dispose()
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
  }

  public render(): void {
    this.frameId = requestAnimationFrame(() => {
      this.render()
    })

    this.tractor.rotation.y += 0.15
    const d = new Vector3()
    this.tractor.getWorldDirection(d)
    this.tractor.position.addScaledVector(d, -0.05)


    this.moveCamera()
    this.raycaster.setFromCamera(this.mouse, this.camera)

    this.renderer.render(this.scene, this.camera)
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
      if (o.object.name === 'tracteur1.rwx') {
        this.select(this.tractor)
      }
    }
  }
}
