import {ChangeDetectionStrategy, Component, inject} from '@angular/core'
import {RouterOutlet} from '@angular/router'
import type {LangDefinition} from '@jsverse/transloco'
import {getBrowserLang, TranslocoService} from '@jsverse/transloco'
import {SettingsService} from './settings/settings.service'

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  template: `<router-outlet />`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  private readonly translocoSvc = inject(TranslocoService)
  private readonly settings = inject(SettingsService)

  constructor() {
    const browserLang =
      (this.settings.get('lang') as string) ??
      getBrowserLang() ??
      this.translocoSvc.getDefaultLang()

    for (const lang of this.translocoSvc.getAvailableLangs() as LangDefinition[]) {
      if (lang.id === browserLang) {
        this.translocoSvc.setActiveLang(lang.id)
        return
      }
    }
  }
}
