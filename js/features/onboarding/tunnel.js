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
        id: 'vehicle',
        label: 'Parle-nous de ton véhicule',
        hint: 'Ces infos nous permettent de calculer ton tarif',
        type: 'group',
        fields: [
          {
            id: 'immatriculation',
            label: 'Immatriculation',
            type: 'text',
            placeholder: 'Ex: 7737-A-76',
            validate: (value) => {
              if (!value) return 'L\'immatriculation est nécessaire';
              const cleaned = value.replace(/[\s-]/g, '');
              if (!/^\d+[A-Za-z]\d+$/.test(cleaned)) {
                return 'Format: nombre-lettre-nombre (Ex: 7737-A-76)';
              }
              return true;
            },
          },
          {
            id: 'marque',
            label: 'Marque',
            type: 'text',
            placeholder: 'Ex: Dacia, Renault, Peugeot',
            validate: (value) => {
              if (!value) return 'La marque est nécessaire';
              return true;
            },
          },
          {
            id: 'modele',
            label: 'Modèle',
            type: 'text',
            placeholder: 'Ex: Logan, Clio, 208',
            validate: (value) => {
              if (!value) return 'Le modèle est nécessaire';
              return true;
            },
          },
          {
            id: 'annee',
            label: 'Année de mise en circulation',
            type: 'number',
            placeholder: 'Ex: 2018',
            validate: (value) => {
              if (!value) return 'L\'année est nécessaire';
              const year = parseInt(value, 10);
              const currentYear = new Date().getFullYear();
              if (isNaN(year) || year < 1980 || year > currentYear) {
                return `Année invalide (entre 1980 et ${currentYear})`;
              }
              return true;
            },
          },
          {
            id: 'puissance',
            label: 'Puissance fiscale (chevaux)',
            type: 'number',
            placeholder: 'Ex: 6',
            validate: (value) => {
              if (!value) return 'La puissance fiscale est nécessaire';
              const cv = parseInt(value, 10);
              if (isNaN(cv) || cv < 1 || cv > 100) {
                return 'Puissance invalide (entre 1 et 100 CV)';
              }
              return true;
            },
          },
        ],
        required: true,
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
        id: 'account',
        label: 'Crée ton espace client',
        hint: 'Ton compte est créé avant le paiement — tu y retrouveras ton contrat, tes documents et tes sinistres',
        type: 'group',
        fields: [
          {
            id: 'email',
            label: 'Ton email',
            type: 'email',
            placeholder: 'Ex: vous@email.com',
            validate: (value) => {
              if (!value) return 'L\'email est nécessaire pour ton espace client';
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                return 'Adresse email invalide (ex: nom@domaine.com)';
              }
              return true;
            },
          },
          {
            id: 'password',
            label: 'Ton mot de passe',
            type: 'password',
            placeholder: 'Minimum 8 caractères',
            secret: true,
            validate: (value) => {
              if (!value) return 'Un mot de passe est nécessaire pour ton espace client';
              if (value.length < 8) return 'Minimum 8 caractères';
              return true;
            },
          },
        ],
        required: true,
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
      {
        id: 'address',
        label: 'Où veux-tu recevoir tes documents?',
        hint: 'Ta carte verte et tes documents officiels seront envoyés à cette adresse',
        type: 'text',
        placeholder: 'Ex: 12 Rue Atlas, Quartier Maârif, Casablanca',
        required: true,
        validate: (value) => {
          if (!value) return 'L\'adresse de livraison est nécessaire';
          if (value.trim().length < 10) {
            return 'Adresse trop courte — précise la rue et la ville';
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
      const quote = this.store.getState('onboarding.quote') || {};
      formHTML += `
        <p style="font-size: 14px; color: var(--color-neutral-600); margin-top: -12px; margin-bottom: 20px;">${field.sublabel || ''}</p>
        <div class="form-choices">
          ${field.choices.map((choice, idx) => {
            const price = quote[choice.value];
            const priceHTML = price
              ? `<div class="choice-price">${Number(price).toLocaleString('fr-FR')} <span class="choice-price-unit">DH/an</span></div>`
              : '';
            return `
            <button type="button" class="choice-btn ${choice.icon ? 'choice-card' : ''}" data-value="${choice.value}" onclick="window.SURO_FORM.selectChoice('${choice.value}')">
              ${choice.badge ? `<span class="choice-badge">${choice.badge}</span>` : ''}
              <div style="display: flex; gap: 16px; flex: 1;">
                ${choice.icon ? `<div style="font-size: 32px; line-height: 1;">${choice.icon}</div>` : ''}
                <div style="flex: 1; text-align: left;">
                  <div style="font-weight: 600; font-size: 16px; margin-bottom: 6px;">${choice.label}</div>
                  ${priceHTML}
                  ${choice.description ? `<div style="font-size: 13px; color: var(--color-neutral-600); margin-bottom: 12px;">${choice.description}</div>` : ''}
                  ${choice.details ? `<div style="font-size: 12px; color: var(--color-neutral-600);">
                    ${choice.details.map(d => `<div style="margin-top: 4px;">✓ ${d}</div>`).join('')}
                  </div>` : ''}
                </div>
              </div>
              <span class="choice-radio" style="margin-left: auto; flex-shrink: 0;"></span>
            </button>
          `;}).join('')}
        </div>
      `;
    } else if (field.type === 'group') {
      formHTML += `<div class="form-group-fields">`;
      field.fields.forEach((sub) => {
        // Les champs secrets (mot de passe) ne passent jamais par le store persisté
        const subValue = sub.secret
          ? (this.secrets && this.secrets[sub.id]) || ''
          : this.store.getState(`onboarding.data.${sub.id}`) || '';
        formHTML += `
          <div class="form-subfield">
            <label class="form-sublabel" for="field-${sub.id}">${sub.label}</label>
            <input
              type="${sub.type}"
              id="field-${sub.id}"
              class="form-input"
              placeholder="${sub.placeholder}"
              value="${subValue}"
              ${sub.type === 'number' ? 'inputmode="numeric"' : ''}
            />
            <span class="form-error" id="error-${sub.id}"></span>
          </div>
        `;
      });
      formHTML += `</div>`;
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
        const firstId = field.type === 'group' ? field.fields[0].id : field.id;
        const input = document.querySelector(`#field-${firstId}`);
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

      .choice-price {
        font-size: 22px;
        font-weight: 800;
        color: var(--color-primary);
        margin-bottom: 6px;
      }

      .choice-price-unit {
        font-size: 13px;
        font-weight: 500;
        color: var(--color-neutral-600);
      }

      .form-group-fields {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .form-subfield {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .form-subfield .form-input {
        width: 100%;
        box-sizing: border-box;
      }

      .form-sublabel {
        font-size: 14px;
        font-weight: 500;
        color: var(--color-neutral-900);
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


  async nextStep() {
    const field = this.fields[this.currentStep];

    // Group field: validate and store each sub-field
    if (field.type === 'group') {
      let allValid = true;
      field.fields.forEach((sub) => {
        const input = document.querySelector(`#field-${sub.id}`);
        const subErrorEl = document.querySelector(`#error-${sub.id}`);
        const val = input ? input.value.trim() : '';

        if (subErrorEl) {
          subErrorEl.textContent = '';
          subErrorEl.classList.remove('show');
        }

        const validation = sub.validate ? sub.validate(val) : true;
        if (validation !== true) {
          if (subErrorEl) {
            subErrorEl.textContent = validation;
            subErrorEl.classList.add('show');
          }
          allValid = false;
          return;
        }

        if (sub.secret) {
          // Jamais dans le store (persisté en localStorage)
          this.secrets = this.secrets || {};
          this.secrets[sub.id] = val;
        } else {
          this.store.setState(`onboarding.data.${sub.id}`, val);
        }
      });

      if (!allValid) return;

      // Après l'étape véhicule : calcul du devis (prix affichés à l'étape couverture)
      if (field.id === 'vehicle') {
        try {
          const quote = await this.api.getQuote({
            annee: this.store.getState('onboarding.data.annee'),
            puissance: this.store.getState('onboarding.data.puissance'),
            marque: this.store.getState('onboarding.data.marque'),
            modele: this.store.getState('onboarding.data.modele'),
          });
          this.store.setState('onboarding.quote', quote);
        } catch (e) {
          // Devis indisponible : on continue, le prix sera confirmé plus tard
          this.store.setState('onboarding.quote', {});
        }
      }

      if (this.currentStep < this.fields.length - 1) {
        this.currentStep++;
        this.render();
      } else {
        this.submit();
      }
      return;
    }

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

  // Retourne à une étape précise et affiche une erreur sur un de ses champs
  goToStepWithError(fieldId, subFieldId, message) {
    const stepIndex = this.fields.findIndex(f => f.id === fieldId);
    if (stepIndex === -1) return;

    this.currentStep = stepIndex;
    this.render();

    setTimeout(() => {
      const errorEl = document.querySelector(`#error-${subFieldId || fieldId}`);
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('show');
      }
      const input = document.querySelector(`#field-${subFieldId || fieldId}`);
      if (input) input.focus();
    }, 150);
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
      const password = (this.secrets && this.secrets.password) || '';

      // 1. Créer le compte client AVANT le paiement
      // (si le client quitte après avoir payé, son contrat est déjà rattaché à son compte)
      try {
        const result = await this.api.signup(data.email, password, {
          phone: data.phone || null,
        });
        this.accountStatus = result.session ? 'logged_in' : 'confirmation_required';
      } catch (accountError) {
        if (/already registered|already been registered/i.test(accountError.message || '')) {
          // Un compte existe déjà : on tente la connexion avec le mot de passe fourni
          try {
            await this.api.login(data.email, password);
            this.accountStatus = 'logged_in';
          } catch (loginError) {
            // Mauvais mot de passe pour un compte existant → retour à l'étape compte
            this.goToStepWithError(
              'account', 'password',
              'Un compte existe déjà avec cet email — entre ton mot de passe habituel'
            );
            return;
          }
        } else {
          throw accountError;
        }
      }

      // 2. Créer le contrat (rattaché au compte par l'email)
      const application = await this.api.createApplication({
        product_slug: 'automobile',
        immatriculation: data.immatriculation,
        marque: data.marque,
        modele: data.modele,
        annee: data.annee,
        puissance: data.puissance,
        coverage: data.coverage,
        email: data.email,
        phone: data.phone,
        address: data.address,
      });

      this.store.setState('onboarding.applicationId', application.application.id);

      // 3. Paiement
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

    const quote = this.store.getState('onboarding.quote') || {};
    const coverage = this.store.getState('onboarding.data.coverage');
    const premium = quote[coverage];
    const amountHTML = premium
      ? `<div style="text-align: center; margin-bottom: 24px; padding: 16px; background: var(--color-neutral-50, #F9FAFB); border-radius: 12px;">
           <div style="font-size: 13px; color: var(--color-neutral-600);">Prime annuelle — ${coverage === 'complete' ? 'Couverture complète' : 'Couverture minimale'}</div>
           <div style="font-size: 28px; font-weight: 800; color: var(--color-primary);">${Number(premium).toLocaleString('fr-FR')} DH<span style="font-size: 14px; font-weight: 500;">/an</span></div>
         </div>`
      : '';

    tunnelWrapper.innerHTML = `
      <div class="payment-section">
        <h3 style="margin-bottom: 24px; text-align: center; font-size: 20px; font-weight: 600;">Choisir une méthode de paiement</h3>
        ${amountHTML}
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
      const quote = this.store.getState('onboarding.quote') || {};
      const coverage = this.store.getState('onboarding.data.coverage');
      await this.api.submitPayment(applicationId, {
        method,
        amount: quote[coverage] || null,  // Montant de référence (le prix officiel est calculé côté serveur)
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

    const email = this.store.getState('onboarding.data.email') || '';
    const address = this.store.getState('onboarding.data.address') || '';
    const holder = email ? email.split('@')[0].toUpperCase() : 'CLIENT';
    const contractNumber = 'SR-' + String(applicationId).replace(/-/g, '').slice(0, 8).toUpperCase();

    const quote = this.store.getState('onboarding.quote') || {};
    const coverage = this.store.getState('onboarding.data.coverage');
    const premium = quote[coverage];

    tunnelWrapper.innerHTML = `
      <div class="success-container">
        <div class="confetti" id="confetti"></div>
        <div class="success-section">
          <div class="success-icon">✓</div>
          <h2 class="success-heading">C'est bon, t'es couvert</h2>
          <p class="success-description">Ta souscription est confirmée${premium ? ` — ${Number(premium).toLocaleString('fr-FR')} DH/an` : ''}.</p>

          <div class="contract-card">
            <div class="contract-card-header">Contrat SURO</div>
            <div class="contract-card-number">${contractNumber}</div>
            <div class="contract-card-holder">${holder}</div>
          </div>

          <div style="margin-top: 24px; padding: 16px; background: rgba(15, 118, 110, 0.06); border-radius: 12px; font-size: 14px; color: var(--color-neutral-600); text-align: left;">
            <div style="margin-bottom: 8px;">📄 <strong>Tes documents officiels</strong> (carte verte, attestation) seront préparés par nos équipes et mis à disposition dans ton espace client.</div>
            <div>📮 Ils seront aussi envoyés à : <strong>${address}</strong></div>
          </div>

          ${this.accountStatus === 'confirmation_required' ? `
          <div style="margin-top: 12px; padding: 16px; background: rgba(249, 115, 22, 0.08); border-radius: 12px; font-size: 14px; color: var(--color-neutral-600); text-align: left;">
            📬 Ton compte est créé — <strong>confirme ton email</strong> (lien envoyé à ${email}) pour accéder à ton espace client.
          </div>` : ''}

          <div class="success-actions">
            <button class="btn btn-primary" onclick="window.SURO_FORM.handleGoToSpace()">
              Accéder à mon espace client →
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

  handleGoToSpace() {
    if (this.accountStatus === 'logged_in') {
      window.location.href = 'backoffice/customer/';
    } else {
      // Compte créé mais email non confirmé : passage par la connexion
      window.location.href = 'customer-login.html';
    }
  }

  handleDashboard() {
    window.location.href = 'customer-login.html';
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
