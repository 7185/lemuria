import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  viewChild,
  ViewEncapsulation
} from '@angular/core'
import type {ElementRef, OnInit} from '@angular/core'
import {EngineService} from './engine.service'
import {WorldService} from '../world/world.service'

@Component({
  selector: 'app-engine',
  templateUrl: './engine.component.html',
  styleUrl: './engine.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineComponent implements OnInit {
  rendererCanvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('rendererCanvas')
  labelZone = viewChild.required<ElementRef<HTMLDivElement>>('labelZone')
  labelDesc = viewChild.required<ElementRef<HTMLDivElement>>('labelDesc')

  private readonly engineSvc = inject(EngineService)
  private readonly world = inject(WorldService)
  private readonly destroyRef = inject(DestroyRef)

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.world.destroyWorld()
      this.engineSvc.clearScene()
      this.engineSvc.cancel()
    })
  }

  ngOnInit() {
    this.engineSvc.createScene(
      this.rendererCanvas(),
      this.labelZone(),
      this.labelDesc()
    )
    this.world.initWorld()
    this.engineSvc.animate()
  }
}
