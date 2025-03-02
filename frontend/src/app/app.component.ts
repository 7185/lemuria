import {ChangeDetectionStrategy, Component, inject} from '@angular/core'
import {RouterOutlet} from '@angular/router'
import {getBrowserLang, TranslocoService} from '@jsverse/transloco'

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  template: `<router-outlet />`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  private readonly translocoSvc = inject(TranslocoService)

  constructor() {
    const browserLang = getBrowserLang() ?? this.translocoSvc.getDefaultLang()

    for (const lang of this.translocoSvc.getAvailableLangs()) {
      if (lang === browserLang) {
        this.translocoSvc.setActiveLang(lang)
        return
      }
    }
  }
}
