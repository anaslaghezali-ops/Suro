/* SURO Onboarding Formulaire Multi-Étapes */

class OnboardingForm {
  constructor() {
    this.store = window.SURO_STORE;
    this.api = window.SURO_API;
    this.fields = this.getFields();
    this.currentStep = 0;
    this.init();
  }

  init() {
    this.render();
    this.attachListeners();
  }

  getFields() {
    return [
      {
        id: 'immatriculation',
        label: 'Immatriculation du véhicule',
        type: 'text',
        placeholder: 'Ex: ABC-1234-CD',
        required: true,
        validate: (value) => {
          if (!value) return 'Ce champ est requis';
          if (!/^[A-Z]{2,3}-\d{3,4}-[A-Z]{2}$/.test(value)) {
            return 'Format invalide (ex: ABC-1234-CD)';
          }
          return true;
        },
      },
      {
        id: 'coverage',
        label: 'Couverture',
        type: 'choice',
        choices: [
          { label: 'Couverture complète', value: 'complete' },
          { label: 'Couverture minimale', value: 'minimal' },
        ],
        required: true,
      },
      {
        id: 'email',
        label: 'Email',
        type: 'email',
        placeholder: 'Ex: vous@email.com',
        required: true,
        validate: (value) => {
          if (!value) return 'Ce champ est requis';
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            return 'Email invalide';
          }
          return true;
        },
      },
      {
        id: 'phone',
        label: 'Numéro de téléphone',
        type: 'tel',
        placeholder: 'Ex: +212 6 XX XX XX XX',
        required: true,
        validate: (value) => {
          if (!value) return 'Ce champ est requis';
          if (!/^[\+]?[\d\s\-\(\)]{10,}$/.test(value.replace(/\s/g, ''))) {
            return 'Numéro invalide';
          }
          return true;
        },
      },
    ];
  }

  render() {
    const field = this.fields[this.currentStep];
    const tunnelWrapper = document.querySelector('.tunnel-wrapper');
    if (!tunnelWrapper) return;

    const progressPercent = ((this.currentStep + 1) / this.fields.length) * 100;
    let formHTML = `
      <div class="form-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progressPercent}%"></div>
        </div>
        <p class="progress-text">Étape ${this.currentStep + 1} sur ${this.fields.length}</p>
      </div>

      <form class="form-step" id="form-step">
        <h3 class="form-title">${field.label}</h3>
    `;

    if (field.type === 'choice') {
      formHTML += `
        <div class="form-choices">
          ${field.choices.map((choice, idx) => `
            <button type="button" class="choice-btn" data-value="${choice.value}" onclick="window.SURO_FORM.selectChoice('${choice.value}')">
              <span class="choice-radio"></span>
              <span>${choice.label}</span>
            </button>
          `).join('')}
        </div>
      `;
    } else {
      const currentValue = this.store.getState(`onboarding.data.${field.id}`) || '';
      formHTML += `
        <input
          type="${field.type}"
          id="field-${field.id}"
          class="form-input"
          placeholder="${field.placeholder}"
          value="${currentValue}"
          required="${field.required}"
        />
        <span class="form-error" id="error-${field.id}"></span>
      `;
    }

    formHTML += `
      <div class="form-actions">
        ${this.currentStep > 0 ? `
          <button type="button" class="btn btn-ghost" onclick="window.SURO_FORM.previousStep()">
            ← Précédent
          </button>
        ` : ''}
        <button type="button" class="btn btn-primary" onclick="window.SURO_FORM.nextStep()">
          ${this.currentStep === this.fields.length - 1 ? 'Soumettre' : 'Suivant →'}
        </button>
      </div>
    </form>
    `;

    tunnelWrapper.innerHTML = formHTML;

    // Focus input if not choice
    if (field.type !== 'choice') {
      setTimeout(() => {
        const input = document.querySelector(`#field-${field.id}`);
        if (input) input.focus();
      }, 100);
    }

    this.addStyles();
  }

  addStyles() {
    if (document.querySelector('style[data-form-styles]')) return;

    const style = document.createElement('style');
    style.setAttribute('data-form-styles', 'true');
    style.textContent = `
      .form-progress {
        margin-bottom: 32px;
      }

      .progress-bar {
        height: 4px;
        background: var(--color-neutral-200);
        border-radius: 2px;
        overflow: hidden;
        margin-bottom: 12px;
      }

      .progress-fill {
        height: 100%;
        background: var(--color-primary);
        transition: width 300ms ease;
      }

      .progress-text {
        font-size: 12px;
        color: var(--color-neutral-600);
        text-align: center;
      }

      .form-step {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .form-title {
        font-size: 24px;
        font-weight: 600;
        color: var(--color-neutral-900);
        margin: 0;
      }

      .form-input {
        padding: 12px 16px;
        border: 1px solid var(--color-neutral-200);
        border-radius: var(--radius-lg);
        font-size: 16px;
        font-family: var(--font-body);
        transition: all 150ms ease;
      }

      .form-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px var(--color-primary-ghost);
      }

      .form-choices {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .choice-btn {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        border: 1px solid var(--color-neutral-200);
        border-radius: var(--radius-lg);
        background: white;
        cursor: pointer;
        transition: all 150ms ease;
        text-align: left;
        font-size: 16px;
        font-family: var(--font-body);
      }

      .choice-btn:hover {
        border-color: var(--color-primary);
        background: var(--color-primary-ghost);
      }

      .choice-radio {
        width: 20px;
        height: 20px;
        border: 2px solid var(--color-neutral-400);
        border-radius: 50%;
        flex-shrink: 0;
        transition: all 150ms ease;
      }

      .choice-btn.selected .choice-radio {
        border-color: var(--color-primary);
        background: var(--color-primary);
        box-shadow: inset 0 0 0 4px white;
      }

      .form-error {
        font-size: 13px;
        color: var(--color-error);
        display: none;
      }

      .form-error.show {
        display: block;
      }

      .form-actions {
        display: flex;
        gap: 12px;
        margin-top: 24px;
      }

      .form-actions .btn {
        flex: 1;
        height: 44px;
      }

      @media (max-width: 640px) {
        .form-actions {
          flex-direction: column;
        }

        .form-title {
          font-size: 18px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  async validateField(fieldId, value) {
    const field = this.fields.find(f => f.id === fieldId);
    if (!field) return true;

    if (field.validate) {
      const result = field.validate(value);
      return result === true ? true : result;
    }

    return true;
  }

  async handleVehicleLookup(immatriculation) {
    try {
      const vehicle = await this.api.getVehicleInfo(immatriculation);
      this.store.setState('onboarding.data.vehicleInfo', vehicle);
      return true;
    } catch (error) {
      return 'Véhicule non trouvé. Vérifiez l\'immatriculation.';
    }
  }

  async nextStep() {
    const field = this.fields[this.currentStep];
    const errorEl = document.querySelector(`#error-${field.id}`);

    // Get value
    let value;
    if (field.type === 'choice') {
      value = this.store.getState(`onboarding.data.${field.id}`);
      if (!value) {
        if (errorEl) {
          errorEl.textContent = 'Sélectionnez une option';
          errorEl.classList.add('show');
        }
        return;
      }
    } else {
      const input = document.querySelector(`#field-${field.id}`);
      value = input.value.trim();

      // Validate
      const validation = await this.validateField(field.id, value);
      if (validation !== true) {
        if (errorEl) {
          errorEl.textContent = validation;
          errorEl.classList.add('show');
        }
        return;
      }

      // Special: vehicle lookup
      if (field.id === 'immatriculation') {
        const lookupResult = await this.handleVehicleLookup(value);
        if (lookupResult !== true) {
          if (errorEl) {
            errorEl.textContent = lookupResult;
            errorEl.classList.add('show');
          }
          return;
        }
      }
    }

    // Store value
    this.store.setState(`onboarding.data.${field.id}`, value);

    // Move to next step
    if (this.currentStep < this.fields.length - 1) {
      this.currentStep++;
      this.render();
    } else {
      // Submit form
      this.submit();
    }
  }

  previousStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.render();
    }
  }

  selectChoice(value) {
    const field = this.fields[this.currentStep];
    this.store.setState(`onboarding.data.${field.id}`, value);

    // Update UI
    document.querySelectorAll('.choice-btn').forEach(btn => {
      btn.classList.remove('selected');
    });
    document.querySelector(`[data-value="${value}"]`).classList.add('selected');
  }

  async submit() {
    const tunnelWrapper = document.querySelector('.tunnel-wrapper');
    if (!tunnelWrapper) return;

    try {
      tunnelWrapper.innerHTML = `
        <div style="text-align: center; padding: 32px;">
          <div style="font-size: 48px; margin-bottom: 16px;">⏳</div>
          <p style="font-size: 16px; color: var(--color-neutral-600);">Traitement de votre demande...</p>
        </div>
      `;

      const data = this.store.getState('onboarding.data');

      // Submit application
      const application = await this.api.createApplication({
        product_slug: 'automobile',
        immatriculation: data.immatriculation,
        vehicleInfo: data.vehicleInfo,
        coverage: data.coverage,
        email: data.email,
        phone: data.phone,
      });

      this.store.setState('onboarding.applicationId', application.application.id);

      // Show payment options
      this.showPaymentOptions(application.application.id);
    } catch (error) {
      tunnelWrapper.innerHTML = `
        <div style="text-align: center; padding: 32px;">
          <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
          <p style="font-size: 16px; color: var(--color-error);">Erreur: ${error.message}</p>
          <button class="btn btn-primary" onclick="window.SURO_FORM.reset()" style="margin-top: 16px;">
            Recommencer
          </button>
        </div>
      `;
    }
  }

  showPaymentOptions(applicationId) {
    const tunnelWrapper = document.querySelector('.tunnel-wrapper');
    if (!tunnelWrapper) return;

    tunnelWrapper.innerHTML = `
      <div class="payment-section">
        <h3 style="margin-bottom: 24px; text-align: center; font-size: 20px; font-weight: 600;">Choisir une méthode de paiement</h3>
        <p style="text-align: center; color: var(--color-neutral-600); margin-bottom: 24px;">
          Montant à payer: <strong style="color: var(--color-primary); font-size: 18px;">120 DH/mois</strong>
        </p>

        <div class="payment-methods" style="display: grid; gap: 12px; margin-bottom: 24px;">
          <button class="payment-method-btn" onclick="window.SURO_FORM.selectPaymentMethod('card', '${applicationId}')">
            <span style="font-size: 24px;">💳</span>
            <div style="flex: 1;">
              <div style="font-weight: 600;">Carte Bancaire</div>
              <div style="font-size: 12px; opacity: 0.7;">Visa, Mastercard, Amex</div>
            </div>
            <span style="font-size: 20px;">→</span>
          </button>

          <button class="payment-method-btn" onclick="window.SURO_FORM.selectPaymentMethod('mtn', '${applicationId}')">
            <span style="font-size: 24px;">📱</span>
            <div style="flex: 1;">
              <div style="font-weight: 600;">MTN Mobile Money</div>
              <div style="font-size: 12px; opacity: 0.7;">Paiement par SMS</div>
            </div>
            <span style="font-size: 20px;">→</span>
          </button>

          <button class="payment-method-btn" onclick="window.SURO_FORM.selectPaymentMethod('bank', '${applicationId}')">
            <span style="font-size: 24px;">🏦</span>
            <div style="flex: 1;">
              <div style="font-weight: 600;">Virement Bancaire</div>
              <div style="font-size: 12px; opacity: 0.7;">Transfert direct</div>
            </div>
            <span style="font-size: 20px;">→</span>
          </button>
        </div>
      </div>
    `;

    this.addPaymentStyles();
  }

  async selectPaymentMethod(method, applicationId) {
    const tunnelWrapper = document.querySelector('.tunnel-wrapper');
    tunnelWrapper.innerHTML = `
      <div style="text-align: center; padding: 32px;">
        <div style="font-size: 48px; margin-bottom: 16px;">⏳</div>
        <p style="font-size: 16px; color: var(--color-neutral-600);">Traitement du paiement...</p>
      </div>
    `;

    try {
      await this.api.submitPayment(applicationId, {
        method,
        amount: 120,
        currency: 'MAD',
      });

      this.showCompletion(applicationId);
    } catch (error) {
      tunnelWrapper.innerHTML = `
        <div style="text-align: center; padding: 32px;">
          <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
          <p style="font-size: 16px; color: var(--color-error);">Erreur de paiement</p>
          <button class="btn btn-primary" onclick="window.SURO_FORM.reset()" style="margin-top: 16px;">
            Recommencer
          </button>
        </div>
      `;
    }
  }

  showCompletion(applicationId) {
    const tunnelWrapper = document.querySelector('.tunnel-wrapper');
    if (!tunnelWrapper) return;

    const email = this.store.getState('onboarding.data.email');
    const holder = email ? email.split('@')[0].toUpperCase() : 'CLIENT';
    const contractNumber = 'SR-' + Date.now().toString().slice(-8);

    tunnelWrapper.innerHTML = `
      <div class="success-section">
        <div class="success-icon">✓</div>
        <h2 class="success-heading">C'est bon, t'es couvert</h2>
        <p class="success-description">Carte verte générée. Première quittance demain.</p>

        <div class="contract-card">
          <div class="contract-card-header">Carte Verte SURO</div>
          <div class="contract-card-number">${contractNumber}</div>
          <div class="contract-card-holder">${holder}</div>
        </div>

        <div class="success-actions">
          <button class="btn btn-primary" onclick="window.SURO_FORM.handleDownload('${applicationId}')">
            Télécharger ma carte verte
          </button>
          <button class="btn btn-ghost" onclick="window.SURO_FORM.handleDashboard()">
            Mon espace
          </button>
        </div>

        <p style="margin-top: 32px; font-size: 12px; color: var(--color-neutral-600); text-align: center;">
          Questions? On est là → <strong>support@suro.ma</strong>
        </p>
      </div>
    `;
  }

  async handleDownload(applicationId) {
    try {
      const response = await fetch(`/api/applications/${applicationId}/certificate`);
      if (!response.ok) throw new Error('Erreur de génération');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SURO-${applicationId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      alert('Erreur lors du téléchargement');
    }
  }

  handleDashboard() {
    window.location.href = '/dashboard';
  }

  addPaymentStyles() {
    if (document.querySelector('style[data-payment-styles]')) return;

    const style = document.createElement('style');
    style.setAttribute('data-payment-styles', 'true');
    style.textContent = `
      .payment-method-btn {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        border: 1px solid var(--color-neutral-200);
        border-radius: var(--radius-lg);
        background: white;
        cursor: pointer;
        transition: all 150ms ease;
        text-align: left;
      }

      .payment-method-btn:hover {
        border-color: var(--color-primary);
        box-shadow: var(--shadow-md);
        transform: translateY(-2px);
      }
    `;
    document.head.appendChild(style);
  }

  attachListeners() {
    // Keyboard support
    document.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const field = this.fields[this.currentStep];
        if (field && field.type !== 'choice') {
          this.nextStep();
        }
      }
    });
  }

  reset() {
    this.store.reset();
    this.currentStep = 0;
    this.render();
  }
}

// Export
if (typeof window !== 'undefined') {
  window.SURO_FORM = new OnboardingForm();
}
