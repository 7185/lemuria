import {
  ChangeDetectionStrategy,
  Component,
  inject,
  viewChild
} from '@angular/core'
import type {AfterViewInit, ElementRef, OnInit, OnDestroy} from '@angular/core'
import {EngineService} from './engine.service'
import {WorldService} from '../world/world.service'

@Component({
  standalone: true,
  selector: 'app-engine',
  templateUrl: './engine.component.html',
  styleUrl: './engine.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineComponent implements OnInit, OnDestroy, AfterViewInit {
  public rendererCanvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('rendererCanvas')
  public labelZone = viewChild.required<ElementRef<HTMLDivElement>>('labelZone')
  public labelDesc = viewChild.required<ElementRef<HTMLDivElement>>('labelDesc')

  private engineSvc = inject(EngineService)
  private world = inject(WorldService)

  public ngOnInit(): void {
    this.engineSvc.createScene(
      this.rendererCanvas(),
      this.labelZone(),
      this.labelDesc()
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
