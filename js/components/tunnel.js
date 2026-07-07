/* 3-Moment Subscription Tunnel */

class SubscriptionTunnel {
  constructor(container) {
    this.container = container;
    this.currentMoment = 1;
    this.data = {
      product: null,
      immatriculation: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      vehicleInfo: null,
      price: 120, // DH/mois - prix fixe
    };
    this.render();
  }

  open(product) {
    this.data.product = product;
    this.currentMoment = 1;
    this.data.immatriculation = '';
    this.container.classList.add('tunnel-open');
    this.render();
  }

  close() {
    this.container.classList.remove('tunnel-open');
    this.currentMoment = 1;
  }

  nextMoment() {
    if (this.currentMoment < 4) {
      this.currentMoment++;
      this.render();
    }
  }

  prevMoment() {
    if (this.currentMoment > 1) {
      this.currentMoment--;
      this.render();
    }
  }

  async submitMoment1() {
    const input = this.container.querySelector('.immatriculation-input');
    if (!input.value.trim()) {
      input.style.borderColor = 'var(--crit)';
      return;
    }
    this.data.immatriculation = input.value.trim();
    // Simulation: fetch vehicle info (in real app, call API)
    this.data.vehicleInfo = {
      brand: 'Toyota',
      model: 'Corolla',
      year: 2022,
      recognized: true
    };
    this.nextMoment();
  }

  submitMoment2() {
    const firstName = this.container.querySelector('.first-name-input').value.trim();
    const lastName = this.container.querySelector('.last-name-input').value.trim();
    const email = this.container.querySelector('.email-input').value.trim();
    const phone = this.container.querySelector('.phone-input').value.trim();

    if (!firstName || !lastName || !email || !phone) {
      alert('Veuillez remplir tous les champs');
      return;
    }

    this.data.firstName = firstName;
    this.data.lastName = lastName;
    this.data.email = email;
    this.data.phone = phone;
    this.nextMoment();
  }

  async submitMoment3() {
    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_slug: this.data.product,
          status: 'pending',
          answers: {
            immatriculation: this.data.immatriculation,
            firstName: this.data.firstName,
            lastName: this.data.lastName,
            email: this.data.email,
            phone: this.data.phone,
            vehicleInfo: this.data.vehicleInfo,
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        this.data.contractNumber = result.id;
        this.nextMoment();
      }
    } catch (error) {
      console.error('Submission error:', error);
      alert('Erreur lors de la soumission. Veuillez réessayer.');
    }
  }

  render() {
    const html = `
      <div class="tunnel-backdrop" onclick="event.target === this && this.parentElement.tunnelInstance.close()"></div>
      <div class="tunnel-modal">
        <div class="tunnel-header">
          <h2 class="tunnel-title">
            ${this.data.product === 'automobile' ? 'SURO Auto' : 'Sécurisez votre avenir'}
          </h2>
          <button class="tunnel-close-btn" onclick="this.closest('.tunnel-container').tunnelInstance.close()">✕</button>
        </div>

        <div class="tunnel-progress">
          <div class="progress-fill" style="width: ${(this.currentMoment - 1) * 33.33}%"></div>
        </div>

        <div class="tunnel-content">
          ${this.renderMoment()}
        </div>

        <div class="tunnel-footer">
          ${this.currentMoment > 1 && this.currentMoment < 4 ? `
            <button class="btn secondary" onclick="this.closest('.tunnel-container').tunnelInstance.prevMoment()">
              ← Retour
            </button>
          ` : ''}
          ${this.currentMoment === 1 ? `
            <button class="btn primary block" onclick="this.closest('.tunnel-container').tunnelInstance.submitMoment1()">
              Continuer
            </button>
          ` : ''}
          ${this.currentMoment === 2 ? `
            <button class="btn primary block" onclick="this.closest('.tunnel-container').tunnelInstance.submitMoment2()">
              Continuer
            </button>
          ` : ''}
          ${this.currentMoment === 3 ? `
            <button class="btn primary block" onclick="this.closest('.tunnel-container').tunnelInstance.submitMoment3()">
              Confirmer & Payer
            </button>
          ` : ''}
          ${this.currentMoment === 4 ? `
            <button class="btn primary block" onclick="this.closest('.tunnel-container').tunnelInstance.close()">
              Fermer
            </button>
          ` : ''}
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this.container.tunnelInstance = this;

    // Focus first input for accessibility
    setTimeout(() => {
      const firstInput = this.container.querySelector('input');
      if (firstInput) firstInput.focus();
    }, 100);
  }

  renderMoment() {
    switch (this.currentMoment) {
      case 1:
        return `
          <div class="moment moment-1">
            <h3>Votre immatriculation</h3>
            <p class="text-muted">Entrez l'immatriculation pour reconnaître votre véhicule</p>
            <div class="form-field mt-3">
              <input type="text" class="immatriculation-input" placeholder="Ex: ABC-123-CD" maxlength="8" />
            </div>
            ${this.data.vehicleInfo?.recognized ? `
              <div class="info-box success">
                ✓ ${this.data.vehicleInfo.brand} ${this.data.vehicleInfo.model} (${this.data.vehicleInfo.year})
              </div>
            ` : ''}
          </div>
        `;
      case 2:
        return `
          <div class="moment moment-2">
            <h3>Vérifiez vos infos</h3>
            <p class="text-muted">Ces informations seront utilisées pour votre contrat</p>
            <div class="form-fields mt-3">
              <div class="form-field">
                <label>Prénom</label>
                <input type="text" class="first-name-input" value="${this.data.firstName}" />
              </div>
              <div class="form-field">
                <label>Nom</label>
                <input type="text" class="last-name-input" value="${this.data.lastName}" />
              </div>
              <div class="form-field">
                <label>Email</label>
                <input type="email" class="email-input" value="${this.data.email}" />
              </div>
              <div class="form-field">
                <label>Téléphone</label>
                <input type="tel" class="phone-input" value="${this.data.phone}" />
              </div>
            </div>
          </div>
        `;
      case 3:
        return `
          <div class="moment moment-3">
            <h3>Confirmez votre souscription</h3>
            <div class="price-section">
              <div class="price-display">
                <span class="price-value">${this.data.price}</span>
                <span class="price-currency">DH/mois</span>
              </div>
              <p class="price-note">Première quittance prélevée immédiatement</p>
            </div>
            <div class="summary mt-3">
              <div class="summary-item">
                <span>Véhicule</span>
                <strong>${this.data.vehicleInfo?.brand} ${this.data.vehicleInfo?.model}</strong>
              </div>
              <div class="summary-item">
                <span>Couverture</span>
                <strong>Tous Risques</strong>
              </div>
              <div class="summary-item">
                <span>Période</span>
                <strong>12 mois</strong>
              </div>
            </div>
          </div>
        `;
      case 4:
        return `
          <div class="moment moment-4 success-screen">
            <div class="success-icon">✓</div>
            <h3>Bienvenue chez SURO</h3>
            <p>Votre contrat est actif</p>
            <div class="contract-info mt-4">
              <div class="contract-number">
                <span class="label">N° de contrat</span>
                <span class="number">${this.data.contractNumber || 'SR-' + Date.now().toString().slice(-6)}</span>
              </div>
              <div class="contract-card">
                <div class="card-header">SURO Assurance</div>
                <div class="card-title">Carte Verte</div>
                <div class="card-number">0666-${this.data.contractNumber || '000001'}</div>
                <div class="card-holder">${this.data.firstName} ${this.data.lastName}</div>
              </div>
            </div>
            <p class="text-muted mt-4">Tous vos documents ont été envoyés à ${this.data.email}</p>
          </div>
        `;
      default:
        return '';
    }
  }
}
