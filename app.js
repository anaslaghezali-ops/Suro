/* SURO App — Minimal Router */

class SuroApp {
  constructor() {
    this.currentSection = 'auto';
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setSection('auto');
  }

  setupEventListeners() {
    // Navigation links
    document.querySelectorAll('[data-section]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = link.dataset.section;
        this.setSection(section);
      });
    });

    // Theme toggle
    const themeToggle = document.querySelector('[data-toggle-theme]');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
      });
    }

    // Load saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }

  setSection(section) {
    this.currentSection = section;

    // Update nav active state
    document.querySelectorAll('[data-section]').forEach(link => {
      if (link.dataset.section === section) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Show relevant section
    document.querySelectorAll('[data-section-target]').forEach(el => {
      if (el.dataset.sectionTarget === section) {
        el.style.display = 'block';
      } else if (el.dataset.sectionTarget !== 'auto-detail') {
        el.style.display = 'none';
      }
    });

    // Handle hero section display
    const heroAuto = document.querySelector('#hero-auto');
    if (heroAuto) {
      heroAuto.style.display = section === 'auto' ? 'block' : 'none';
    }
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.suroApp = new SuroApp();
});
