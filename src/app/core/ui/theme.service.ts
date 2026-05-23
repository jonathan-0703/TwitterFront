import { Injectable, signal, effect } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  readonly isDark = signal<boolean>(true);

  constructor() {
    // Load preference from localStorage or check system preference
    const savedTheme = localStorage.getItem('theme-preference');
    if (savedTheme) {
      this.isDark.set(savedTheme === 'dark');
    } else {
      // Default to dark theme matching standard app styling
      this.isDark.set(true);
    }

    // Apply class to document body on changes
    effect(() => {
      const dark = this.isDark();
      if (dark) {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
        localStorage.setItem('theme-preference', 'dark');
      } else {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        localStorage.setItem('theme-preference', 'light');
      }
    });
  }

  toggleTheme(): void {
    this.isDark.update((dark) => !dark);
  }
}
