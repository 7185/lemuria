import {Injectable} from '@angular/core'
import {RWXLoader} from '../utils/rwxloader'
import {Group, Mesh, ConeGeometry, LoadingManager, MeshBasicMaterial} from 'three'
import * as JSZip from 'jszip'
import JSZipUtils from 'jszip-utils'
import {config} from '../app.config'

export const RES_PATH = config.url.resource

@Injectable({providedIn: 'root'})
export class ObjectService {

  private errorCone: Group
  private rwxLoader = new RWXLoader(new LoadingManager())
	private objects: Map<string, Promise<any>> = new Map()

  constructor() {
		const cone = new Mesh(new ConeGeometry(0.5, 0.5, 3), new MeshBasicMaterial({color: 0x000000}))
		cone.position.y = 0.5
		this.errorCone = new Group().add(cone)
    this.rwxLoader.setPath(`${RES_PATH}/rwx`).setResourcePath(`${RES_PATH}/textures`).setJSZip(JSZip, JSZipUtils)
	}

	loadObject(name: string): Promise<any> {
		if (this.objects.get(name) !== undefined) {
			return this.objects.get(name)
		} else {
			const promise = new Promise((resolve, reject) => {
				this.rwxLoader.load(name, (rwx: Group) => resolve(rwx.clone()), null, () => resolve(this.errorCone.clone()))
			})
			this.objects.set(name, promise)
			return promise
		}
	}
}
