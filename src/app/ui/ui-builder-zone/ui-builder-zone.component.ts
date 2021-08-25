import {Component, OnInit} from '@angular/core'
import {EngineService} from '../../engine/engine.service'

@Component({
  selector: 'app-ui-builder-zone',
  templateUrl: './ui-builder-zone.component.html',
  styleUrls: ['./ui-builder-zone.component.scss']
})
export class UiBuilderZoneComponent implements OnInit {

  public selectedObject: any

  public constructor(private engineSvc: EngineService) {
  }

  trigger(event: MouseEvent, code: string) {
    const downEv = new KeyboardEvent('keydown', {code})
    Object.defineProperty(downEv, 'target', {value: document.body})
    const upEv = new KeyboardEvent('keyup', {code})
    Object.defineProperty(upEv, 'target', {value: document.body})
    window.dispatchEvent(downEv)
    window.dispatchEvent(upEv)
    event.preventDefault()
  }

  public ngOnInit(): void {
    this.engineSvc.selectedObjectSub.asObservable().subscribe((object) => {
      this.selectedObject = object
    })
  }
}
