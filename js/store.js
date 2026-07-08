/* SURO Store — State Management */

class Store {
  constructor() {
    this.state = {
      onboarding: {
        step: 0,
        data: {
          immatriculation: null,
          vehicleInfo: null,
          coverage: null,
          email: null,
          phone: null,
        },
        loading: false,
        error: null,
      },
      user: {
        isAuth: false,
        profile: null,
      },
      ui: {
        theme: this.getInitialTheme(),
      },
    };

    this.listeners = [];
    this.hydrate();
  }

  getInitialTheme() {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('suro-theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  setState(path, value) {
    const keys = path.split('.');
    let current = this.state;

    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
    this.persist();
    this.listeners.forEach(callback => callback(this.state));
  }

  getState(path = null) {
    if (!path) return this.state;

    return path.split('.').reduce((current, key) => current?.[key], this.state);
  }

  persist() {
    localStorage.setItem('suro-state', JSON.stringify({
      onboarding: this.state.onboarding.data,
    }));
  }

  hydrate() {
    try {
      const saved = localStorage.getItem('suro-state');
      if (saved) {
        const data = JSON.parse(saved);
        this.state.onboarding.data = { ...this.state.onboarding.data, ...data.onboarding };
      }
    } catch (e) {
      console.error('Failed to hydrate state:', e);
    }
  }

  reset() {
    this.state.onboarding = {
      step: 0,
      data: {
        immatriculation: null,
        vehicleInfo: null,
        coverage: null,
        email: null,
        phone: null,
      },
      loading: false,
      error: null,
    };
    localStorage.removeItem('suro-state');
    this.listeners.forEach(callback => callback(this.state));
  }
}

// Export singleton
if (typeof window !== 'undefined') {
  window.SURO_STORE = new Store();
}
