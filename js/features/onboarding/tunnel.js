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
        label: 'Quelle est l\'immatriculation?',
        hint: 'Tu la trouves sur la carte grise ou sur ta plaque',
        type: 'text',
        placeholder: 'Ex: 123-A-456',
        required: true,
        validate: (value) => {
          if (!value) return 'L\'immatriculation est nécessaire pour continuer';
          if (!/^\d+-[A-Z]-\d+$/.test(value)) {
            return 'Format marocain: 123-A-456 (chiffres-lettre-chiffres)';
          }
          return true;
        },
      },
      {
        id: 'coverage',
        label: 'Quel niveau de protection?',
        sublabel: 'Choisir le plan qui te convient',
        type: 'choice',
        choices: [
          {
            label: 'Couverture complète',
            value: 'complete',
            icon: '🛡️',
            description: 'Vol, Incendie, Responsabilité civile, Assistance 24/7',
            badge: '⭐ POPULAIRE',
            details: ['Vol et vandalisme', 'Dégâts et incendie', 'Tiers illimité', 'Assistance 24/7', 'Pas de franchise']
          },
          {
            label: 'Couverture minimale',
            value: 'minimal',
            icon: '✓',
            description: 'Responsabilité civile minimale (légale)',
            details: ['Tiers obligatoire', 'Assistance de base']
          },
        ],
        required: true,
      },
      {
        id: 'email',
        label: 'Ton email? (Pour ta quittance)',
        hint: 'On t\'enverras ta carte verte et tes documents',
        type: 'email',
        placeholder: 'Ex: vous@email.com',
        required: true,
        validate: (value) => {
          if (!value) return 'L\'email est nécessaire pour recevoir tes documents';
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            return 'Adresse email invalide (ex: nom@domaine.com)';
          }
          return true;
        },
      },
      {
        id: 'phone',
        label: 'Et ton numéro? (Pour les urgences)',
        hint: 'On t\'appellera uniquement en cas de sinistre',
        type: 'tel',
        placeholder: 'Ex: +212 6 XX XX XX XX',
        required: true,
        validate: (value) => {
          if (!value) return 'Un numéro de contact est nécessaire';
          if (!/^[\+]?[\d\s\-\(\)]{10,}$/.test(value.replace(/\s/g, ''))) {
            return 'Numéro invalide (ex: +212 6 XX XX XX XX ou 06 XX XX XX XX)';
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
        ${field.hint ? `<p class="form-hint-text">${field.hint}</p>` : ''}
    `;

    if (field.type === 'choice') {
      formHTML += `
        <p style="font-size: 14px; color: var(--color-neutral-600); margin-top: -12px; margin-bottom: 20px;">${field.sublabel || ''}</p>
        <div class="form-choices">
          ${field.choices.map((choice, idx) => `
            <button type="button" class="choice-btn ${choice.icon ? 'choice-card' : ''}" data-value="${choice.value}" onclick="window.SURO_FORM.selectChoice('${choice.value}')">
              ${choice.badge ? `<span class="choice-badge">${choice.badge}</span>` : ''}
              <div style="display: flex; gap: 16px; flex: 1;">
                ${choice.icon ? `<div style="font-size: 32px; line-height: 1;">${choice.icon}</div>` : ''}
                <div style="flex: 1; text-align: left;">
                  <div style="font-weight: 600; font-size: 16px; margin-bottom: 6px;">${choice.label}</div>
                  ${choice.description ? `<div style="font-size: 13px; color: var(--color-neutral-600); margin-bottom: 12px;">${choice.description}</div>` : ''}
                  ${choice.details ? `<div style="font-size: 12px; color: var(--color-neutral-600);">
                    ${choice.details.map(d => `<div style="margin-top: 4px;">✓ ${d}</div>`).join('')}
                  </div>` : ''}
                </div>
              </div>
              <span class="choice-radio" style="margin-left: auto; flex-shrink: 0;"></span>
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
        margin: 0 0 8px 0;
      }

      .form-hint-text {
        font-size: 14px;
        color: var(--color-neutral-600);
        margin: 0 0 20px 0;
        font-weight: 400;
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
        gap: 16px;
      }

      .choice-btn {
        display: flex;
        align-items: flex-start;
        padding: 20px;
        border: 2px solid var(--color-neutral-200);
        border-radius: var(--radius-lg);
        background: white;
        cursor: pointer;
        transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
        text-align: left;
        font-family: var(--font-body);
        position: relative;
        overflow: hidden;
        min-height: 48px;
      }

      .choice-btn.choice-card {
        min-height: auto;
      }

      .choice-btn::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, rgba(15, 118, 110, 0.03) 0%, rgba(249, 115, 22, 0.01) 100%);
        opacity: 0;
        transition: opacity 250ms cubic-bezier(0.4, 0, 0.2, 1);
        pointer-events: none;
      }

      .choice-btn:hover {
        border-color: var(--color-primary);
        box-shadow: 0 8px 16px rgba(15, 118, 110, 0.12);
        transform: translateY(-2px);
      }

      .choice-btn:hover::before {
        opacity: 1;
      }

      .choice-badge {
        position: absolute;
        top: 12px;
        right: 12px;
        background: linear-gradient(135deg, var(--color-accent), #FF9D2D);
        color: white;
        font-size: 11px;
        font-weight: 600;
        padding: 4px 8px;
        border-radius: 4px;
        letter-spacing: 0.05em;
        z-index: 1;
      }

      .choice-radio {
        width: 24px;
        height: 24px;
        min-width: 24px;
        border: 2.5px solid var(--color-neutral-300);
        border-radius: 50%;
        flex-shrink: 0;
        transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
      }

      .choice-btn.selected {
        border-color: var(--color-primary);
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(15, 118, 110, 0.02) 100%);
        box-shadow: 0 8px 16px rgba(15, 118, 110, 0.15), inset 0 0 0 1px var(--color-primary);
      }

      .choice-btn.selected::before {
        opacity: 1;
      }

      .choice-btn.selected .choice-radio {
        border-color: var(--color-primary);
        background: var(--color-primary);
        box-shadow: inset 0 0 0 3px white;
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
          font-size: 20px;
        }

        .form-hint-text {
          font-size: 13px;
        }

        .choice-btn {
          padding: 24px 16px;
          min-height: 60px;
        }

        .choice-btn.choice-card {
          min-height: auto;
        }

        .form-input {
          padding: 14px 16px;
          height: 48px;
          font-size: 16px;
        }

        .form-actions .btn {
          height: 48px;
          font-size: 16px;
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
        <div style="text-align: center; padding: 48px 32px;">
          <div class="loading-spinner"></div>
          <p style="font-size: 16px; color: var(--color-neutral-600); margin-top: 24px;">Traitement de votre demande...</p>
        </div>
      `;
      this.addLoadingStyles();

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
          Choisis ta méthode de paiement
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
      <div style="text-align: center; padding: 48px 32px;">
        <div class="loading-spinner"></div>
        <p style="font-size: 16px; color: var(--color-neutral-600); margin-top: 24px;">Traitement du paiement...</p>
      </div>
    `;
    this.addLoadingStyles();

    try {
      await this.api.submitPayment(applicationId, {
        method,
        amount: null,  // Prix déterminé côté backend selon couverture
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
      <div class="success-container">
        <div class="confetti" id="confetti"></div>
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
              ✓ Télécharger ma carte verte
            </button>
            <button class="btn btn-ghost" onclick="window.SURO_FORM.handleDashboard()">
              Mon espace →
            </button>
          </div>

          <p style="margin-top: 32px; font-size: 12px; color: var(--color-neutral-600); text-align: center;">
            Questions? On est là → <strong>support@suro.ma</strong>
          </p>
        </div>
      </div>
    `;
    this.addSuccessStyles();
    this.triggerConfetti();
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

  addSuccessStyles() {
    if (document.querySelector('style[data-success-styles]')) return;

    const style = document.createElement('style');
    style.setAttribute('data-success-styles', 'true');
    style.textContent = `
      .success-container {
        position: relative;
        overflow: hidden;
      }

      .success-section {
        animation: slideInUp 600ms cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      @keyframes slideInUp {
        from {
          opacity: 0;
          transform: translateY(40px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .success-icon {
        animation: scaleAndBounce 600ms cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      @keyframes scaleAndBounce {
        0% {
          transform: scale(0) rotate(-180deg);
          opacity: 0;
        }
        60% {
          transform: scale(1.1) rotate(20deg);
          opacity: 1;
        }
        80% {
          transform: scale(0.95) rotate(-5deg);
        }
        100% {
          transform: scale(1) rotate(0deg);
          opacity: 1;
        }
      }

      .contract-card {
        animation: scaleIn 500ms 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
      }

      @keyframes scaleIn {
        from {
          opacity: 0;
          transform: scale(0.8);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      .success-actions {
        animation: fadeInUp 500ms 400ms ease both;
      }

      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .confetti {
        position: absolute;
        width: 100%;
        height: 100%;
        top: 0;
        left: 0;
        pointer-events: none;
      }

      .confetti-piece {
        position: absolute;
        width: 8px;
        height: 8px;
        background: var(--color-accent);
        opacity: 1;
      }

      .confetti-piece.blue {
        background: var(--color-primary);
      }

      .confetti-piece.gold {
        background: #FDB022;
      }
    `;
    document.head.appendChild(style);
  }

  triggerConfetti() {
    const confettiContainer = document.getElementById('confetti');
    if (!confettiContainer) return;

    const colors = ['blue', 'gold', 'var(--color-accent)'];
    const pieceCount = 50;

    for (let i = 0; i < pieceCount; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece ' + colors[Math.floor(Math.random() * 3)];

      const startX = Math.random() * 100;
      const delay = Math.random() * 200;
      const duration = 2000 + Math.random() * 1000;
      const angle = (Math.random() - 0.5) * 60 + 90;
      const velocity = 3 + Math.random() * 4;

      piece.style.left = startX + '%';
      piece.style.top = '-10px';
      piece.style.animation = `confettiFall ${duration}ms linear ${delay}ms infinite`;
      piece.style.setProperty('--angle', angle + 'deg');
      piece.style.setProperty('--velocity', velocity);

      confettiContainer.appendChild(piece);
    }

    // Add keyframes for confetti fall
    if (!document.querySelector('style[data-confetti-fall]')) {
      const style = document.createElement('style');
      style.setAttribute('data-confetti-fall', 'true');
      style.textContent = `
        @keyframes confettiFall {
          0% {
            transform: translateY(0) rotateZ(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(600px) rotateZ(720deg);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  addLoadingStyles() {
    if (document.querySelector('style[data-loading-styles]')) return;

    const style = document.createElement('style');
    style.setAttribute('data-loading-styles', 'true');
    style.textContent = `
      .loading-spinner {
        width: 60px;
        height: 60px;
        margin: 0 auto;
        position: relative;
      }

      .loading-spinner::before {
        content: '';
        position: absolute;
        width: 100%;
        height: 100%;
        border: 4px solid var(--color-neutral-200);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        animation: spin 1.2s linear infinite;
      }

      .loading-spinner::after {
        content: '';
        position: absolute;
        width: 80%;
        height: 80%;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        border: 3px solid var(--color-neutral-100);
        border-right-color: var(--color-accent);
        border-radius: 50%;
        animation: spin-reverse 1.8s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      @keyframes spin-reverse {
        to { transform: rotate(-360deg); }
      }
    `;
    document.head.appendChild(style);
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
