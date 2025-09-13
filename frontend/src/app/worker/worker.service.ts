import {Injectable} from '@angular/core'
import {filter, Subject, take} from 'rxjs'

@Injectable({providedIn: 'root'})
export class WorkerService {
  private worker = new Worker(new URL('./worker', import.meta.url))
  private workerSubject = new Subject<MessageEvent>()
  private messageId = 0

  constructor() {
    this.worker.onmessage = (event) => this.workerSubject.next(event)
  }

  textCanvas(
    text: string,
    color: {r: number; g: number; b: number},
    bcolor: {r: number; g: number; b: number},
    ratio: number
  ): Promise<ImageBitmap> {
    const id = this.messageId++

    this.worker.postMessage({
      type: 'textCanvasRequest',
      text,
      color,
      bcolor,
      ratio,
      id
    })

    return new Promise((resolve, reject) => {
      this.workerSubject
        .pipe(
          filter((event) => event.data.id === id),
          take(1)
        )
        .subscribe((event) => {
          if (event.data.type === 'textCanvasResult') {
            resolve(event.data.bitmap)
          } else if (event.data.type === 'textCanvasError') {
            reject(new Error(event.data.error))
          }
        })
    })
  }

  parseAction(act: string): Promise<any> {
    const id = this.messageId++

    this.worker.postMessage({type: 'parseActionRequest', act, id})

    return new Promise((resolve, reject) => {
      this.workerSubject
        .pipe(
          filter((event) => event.data.id === id),
          take(1)
        )
        .subscribe((event) => {
          if (event.data.type === 'parseActionResult') {
            resolve(event.data.parsed)
          } else {
            reject(new Error('Unexpected error in parseAction'))
          }
        })
    })
  }
}
