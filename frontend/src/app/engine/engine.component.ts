import {
  ChangeDetectionStrategy,
  Component,
  inject,
  viewChild,
  ViewEncapsulation
} from '@angular/core'
import type {ElementRef, OnDestroy, OnInit} from '@angular/core'
import {EngineService} from './engine.service'
import {WorldService} from '../world/world.service'

@Component({
  selector: 'app-engine',
  templateUrl: './engine.component.html',
  styleUrl: './engine.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineComponent implements OnInit, OnDestroy {
  rendererCanvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('rendererCanvas')
  labelZone = viewChild.required<ElementRef<HTMLDivElement>>('labelZone')
  labelDesc = viewChild.required<ElementRef<HTMLDivElement>>('labelDesc')

  private readonly engineSvc = inject(EngineService)
  private readonly world = inject(WorldService)

  ngOnInit(): void {
    this.engineSvc.createScene(
      this.rendererCanvas(),
      this.labelZone(),
      this.labelDesc()
    )
    this.world.initWorld()
    this.engineSvc.animate()
  }

  ngOnDestroy(): void {
    this.world.destroyWorld()
    this.engineSvc.clearScene()
    this.engineSvc.cancel()
  }
}
