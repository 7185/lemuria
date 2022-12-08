import {Pipe} from '@angular/core'
import type {PipeTransform} from '@angular/core'
import linkifyStr from 'linkify-string'

@Pipe({name: 'linkify'})
export class LinkifyPipe implements PipeTransform {
  transform(str: string): string {
    return str ? linkifyStr(str, {target: '_blank'}) : str
  }
}
