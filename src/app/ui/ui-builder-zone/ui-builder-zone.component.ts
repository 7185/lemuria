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

  public ngOnInit(): void {
    this.engineSvc.selectedObjectSub.asObservable().subscribe((object) => {
      this.selectedObject = object
    })
  }
}
