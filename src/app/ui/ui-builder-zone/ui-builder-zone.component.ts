import {ObjectService, ObjectAct} from './../../world/object.service'
import {Component, OnInit} from '@angular/core'
import {EngineService} from '../../engine/engine.service'

@Component({
  selector: 'app-ui-builder-zone',
  templateUrl: './ui-builder-zone.component.html',
  styleUrls: ['./ui-builder-zone.component.scss']
})
export class UiBuilderZoneComponent implements OnInit {
  public objectAct = ObjectAct
  public selectedObject: any

  public constructor(private engineSvc: EngineService, private objSvc: ObjectService) {
  }

  trigger(event: MouseEvent, action: number) {
    if (event.button === 0) {
      this.objSvc.objectAction.next(action)
    }
    event.preventDefault()
  }

  public ngOnInit(): void {
    this.engineSvc.selectedObjectSub.asObservable().subscribe((object) => {
      this.selectedObject = object
    })
  }
}
