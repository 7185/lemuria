import {Component, ElementRef, OnInit, ViewChild} from '@angular/core'
import {EngineService} from './engine.service'
import {WorldService} from '../world/world.service'

@Component({
  selector: 'app-engine',
  templateUrl: './engine.component.html',
  styleUrls: ['./engine.component.scss']
})
export class EngineComponent implements OnInit {

  @ViewChild('rendererCanvas', {static: true})
  public rendererCanvas: ElementRef<HTMLCanvasElement>
  @ViewChild('labelZone', {static: true})
  public labelZone: ElementRef<HTMLDivElement>
  @ViewChild('labelDesc', {static: true})
  public labelDesc: ElementRef<HTMLDivElement>

  public constructor(private engServ: EngineService, private world: WorldService) {
  }

  public ngOnInit(): void {
    this.engServ.createScene(this.rendererCanvas, this.labelZone, this.labelDesc)
    this.world.initWorld()
    this.engServ.animate()
  }

}
