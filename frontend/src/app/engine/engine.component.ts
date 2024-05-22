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
  }

  ngAfterViewInit(): void {
    this.world.initWorld()
    this.engineSvc.animate()
  }

  ngOnDestroy(): void {
    this.world.destroyWorld()
    this.engineSvc.clearScene()
    this.engineSvc.cancel()
  }
}
