import {Component, ElementRef, OnInit, ViewChild} from '@angular/core'
import {EngineService} from './engine.service'

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

  public constructor(private engServ: EngineService) {
  }

  public ngOnInit(): void {
    this.engServ.createScene(this.rendererCanvas, this.labelZone)
    this.engServ.animate()
  }

}
