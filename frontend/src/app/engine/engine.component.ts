import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild
} from '@angular/core'
import type {AfterViewInit, OnInit, OnDestroy} from '@angular/core'
import {EngineService} from './engine.service'
import {WorldService} from '../world/world.service'

@Component({
  standalone: true,
  selector: 'app-engine',
  templateUrl: './engine.component.html',
  styleUrls: ['./engine.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('rendererCanvas', {static: true})
  public rendererCanvas: ElementRef<HTMLCanvasElement>
  @ViewChild('labelZone', {static: true})
  public labelZone: ElementRef<HTMLDivElement>
  @ViewChild('labelDesc', {static: true})
  public labelDesc: ElementRef<HTMLDivElement>

  public constructor(
    private engineSvc: EngineService,
    private world: WorldService
  ) {}

  public ngOnInit(): void {
    this.engineSvc.createScene(
      this.rendererCanvas,
      this.labelZone,
      this.labelDesc
    )
  }

  public ngAfterViewInit(): void {
    this.world.initWorld()
    this.engineSvc.animate()
  }

  public ngOnDestroy(): void {
    this.world.destroyWorld()
    this.engineSvc.clearScene()
    this.engineSvc.cancel()
  }
}
