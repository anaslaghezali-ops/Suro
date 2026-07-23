/* SURO Onboarding Formulaire Multi-Étapes */

class OnboardingForm {
  constructor() {
    this.store = window.SURO_STORE;
    this.api = window.SURO_API;

    // Client déjà connecté ? (souscription/renouvellement depuis l'espace client)
    const session = this.api.getSession ? this.api.getSession() : null;
    this.loggedIn = !!(session && session.access_token);
    this.session = session;

    // Pré-remplissage (renouvellement : on récupère les infos du contrat existant)
    this.applyPrefill();

    this.quoteError = false;
    this.fields = this.getFields();
    this.currentStep = 0;
    this.init();
  }

  applyPrefill() {
    let prefill = null;
    try {
      const raw = localStorage.getItem('suroTunnelPrefill');
      if (raw) prefill = JSON.parse(raw);
    } catch (e) {
      prefill = null;
    }
    localStorage.removeItem('suroTunnelPrefill');

    if (prefill && typeof prefill === 'object') {
      this.isRenewal = !!prefill.__renewal;
      delete prefill.__renewal;
      Object.entries(prefill).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== '') {
          this.store.setState(`onboarding.data.${k}`, v);
        }
      });
    }
  }

  init() {
    this.api.track('tunnel_view', null, { logged_in: this.loggedIn, renewal: !!this.isRenewal });
    this.render();
    this.attachListeners();
  }

  getFields() {
    const vt = this.store.getState('onboarding.data.vehicle_type') || 'voiture';
    const isMoto = vt === 'moto';

    // Champ de tarification adaptatif : CV fiscaux (voiture) ou cylindrée cm³ (moto)
    const ratingField = isMoto
      ? {
          id: 'puissance',
          label: 'Cylindrée (cm³)',
          type: 'number',
          placeholder: 'Ex: 125',
          validate: (value) => {
            if (!value) return 'La cylindrée est nécessaire';
            const cc = parseInt(value, 10);
            if (isNaN(cc) || cc < 25 || cc > 3000) {
              return 'Cylindrée invalide (entre 25 et 3000 cm³)';
            }
            return true;
          },
        }
      : {
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
        };

    const fields = [
      {
        id: 'vehicle_type',
        label: 'Que veux-tu assurer ?',
        sublabel: 'Sélectionne le type de véhicule',
        type: 'choice',
        choices: [
          {
            label: 'Voiture',
            value: 'voiture',
            icon: 'voiture',
          },
          {
            label: 'Moto',
            value: 'moto',
            icon: 'moto',
          },
        ],
        required: true,
      },
      {
        id: 'vehicle',
        label: isMoto ? 'Parle-nous de ta moto' : 'Parle-nous de ton véhicule',
        hint: 'Ces infos nous permettent de calculer ton tarif',
        type: 'group',
        fields: [
          {
            id: 'immatriculation',
            label: 'Immatriculation',
            type: 'text',
            autocomplete: 'off',
            placeholder: 'Ex: 7737-A-76',
            fullWidth: true,
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
            placeholder: isMoto ? 'Ex: Honda, Yamaha, KTM' : 'Ex: Dacia, Renault, Peugeot',
            validate: (value) => {
              if (!value) return 'La marque est nécessaire';
              return true;
            },
          },
          {
            id: 'modele',
            label: 'Modèle',
            type: 'text',
            placeholder: isMoto ? 'Ex: PCX, MT-07, Duke' : 'Ex: Logan, Clio, 208',
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
          ratingField,
        ],
        required: true,
      },
      {
        id: 'coverage',
        label: 'Quel niveau de protection?',
        sublabel: 'Chaque formule affiche son prix annuel TTC — aucun frais caché',
        type: 'choice',
        choices: [
          {
            label: 'Couverture complète',
            value: 'complete',
            tag: 'Recommandé',
            description: 'Vol, Incendie, Responsabilité civile, Assistance 24/7',
            details: ['Vol et vandalisme', 'Dégâts et incendie', 'Tiers illimité', 'Assistance 24/7', 'Pas de franchise']
          },
          {
            label: 'Couverture minimale',
            value: 'minimal',
            tag: 'Essentiel',
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
            autocomplete: 'email',
            placeholder: 'Ex: ton@email.com',
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
            autocomplete: 'new-password',
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
        id: 'contact',
        label: 'Tes coordonnées',
        hint: 'Pour l\'envoi de ta carte verte à domicile et te joindre en cas de sinistre',
        type: 'group',
        fields: [
          {
            id: 'prenom',
            label: 'Prénom',
            type: 'text',
            autocomplete: 'given-name',
            placeholder: 'Ex: Youssef',
            validate: (value) => {
              if (!value || !value.trim()) return 'Le prénom est nécessaire';
              if (value.trim().length < 2) return 'Prénom trop court';
              return true;
            },
          },
          {
            id: 'nom',
            label: 'Nom',
            type: 'text',
            autocomplete: 'family-name',
            placeholder: 'Ex: Benali',
            validate: (value) => {
              if (!value || !value.trim()) return 'Le nom est nécessaire';
              if (value.trim().length < 2) return 'Nom trop court';
              return true;
            },
          },
          {
            id: 'phone',
            label: 'Téléphone',
            type: 'tel',
            autocomplete: 'tel',
            placeholder: 'Ex: +212 6 XX XX XX XX',
            validate: (value) => {
              if (!value) return 'Un numéro de contact est nécessaire';
              if (!/^[\+]?[\d\s\-\(\)]{10,}$/.test(value.replace(/\s/g, ''))) {
                return 'Numéro invalide (ex: +212 6 XX XX XX XX)';
              }
              return true;
            },
          },
          {
            id: 'address',
            label: 'Adresse de livraison (carte verte)',
            inputType: 'textarea',
            autocomplete: 'street-address',
            placeholder: 'Ex: 12 Rue Atlas, Quartier Maârif, Casablanca',
            fullWidth: true,
            validate: (value) => {
              if (!value) return 'L\'adresse de livraison est nécessaire';
              if (value.trim().length < 10) {
                return 'Adresse trop courte — précise la rue et la ville';
              }
              return true;
            },
          },
        ],
        required: true,
      },
    ];

    // Client déjà connecté : pas besoin de recréer un compte
    if (this.loggedIn) {
      return fields.filter((f) => f.id !== 'account');
    }
    return fields;
  }

  getStepLabels() {
    const labels = {
      vehicle_type: 'Type',
      vehicle: 'Véhicule',
      coverage: 'Couverture',
      account: 'Compte',
      contact: 'Coordonnées',
    };
    return this.fields.map((f) => labels[f.id] || f.id);
  }

  getAssetBase() {
    const path = window.location.pathname || '';
    return path.includes('/app') ? '../' : '';
  }

  renderLegalConsentBlock(inputId, variant = 'subscription') {
    const base = this.getAssetBase();
    const copyByVariant = {
      account: `J'ai lu et j'accepte les <a href="${base}conditions.html" target="_blank" rel="noopener">conditions générales d'utilisation et de vente (CGU/CGV)</a> et la <a href="${base}confidentialite.html" target="_blank" rel="noopener">politique de confidentialité</a> de la plateforme SURO.`,
      subscription: `J'ai lu et j'accepte les <a href="${base}conditions.html" target="_blank" rel="noopener">conditions générales d'utilisation et de vente (CGU/CGV)</a> et la <a href="${base}confidentialite.html" target="_blank" rel="noopener">politique de confidentialité</a>. Je reconnais que SURO agit en qualité d'intermédiaire technologique, que le contrat d'assurance est conclu avec <strong>Wafa Assurance</strong> et que SURO n'est pas partie à ce contrat.`,
      payment: `En validant mon paiement, j'accepte les <a href="${base}conditions.html" target="_blank" rel="noopener">conditions générales d'utilisation et de vente (CGU/CGV)</a> et la <a href="${base}confidentialite.html" target="_blank" rel="noopener">politique de confidentialité</a>, ainsi que les conditions contractuelles de l'assureur. Je reconnais que SURO agit en qualité d'intermédiaire technologique et que le contrat d'assurance est conclu avec <strong>Wafa Assurance</strong>.`,
    };
    const copy = copyByVariant[variant] || copyByVariant.subscription;
    return `
      <div class="tunnel-legal-consent" role="group" aria-labelledby="${inputId}-label">
        <label class="tunnel-consent-label" for="${inputId}" id="${inputId}-label">
          <input type="checkbox" id="${inputId}" class="tunnel-consent-input" required aria-required="true" />
          <span>${copy}</span>
        </label>
        <span class="form-error" id="error-${inputId}" role="alert"></span>
      </div>
    `;
  }

  validateLegalConsent(inputId) {
    const consent = document.querySelector(`#${inputId}`);
    if (!consent || !consent.checked) {
      this.setFieldError(inputId, 'Tu dois accepter les conditions pour continuer');
      consent?.focus();
      return false;
    }
    this.clearFieldError(inputId);
    this.store.setState('onboarding.legalConsentAt', new Date().toISOString());
    return true;
  }

  setupPaymentConsentGate() {
    const consent = document.getElementById('payment-consent');
    const buttons = document.querySelectorAll('.payment-method-btn');
    if (!consent || !buttons.length) return;

    const sync = () => {
      const enabled = consent.checked;
      buttons.forEach((btn) => {
        btn.disabled = !enabled;
        btn.classList.toggle('payment-method-btn--disabled', !enabled);
        btn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
      });
    };

    consent.addEventListener('change', sync);
    sync();
  }

  renderChoiceIcon(icon) {
    const icons = {
      voiture: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16h14M6 16l-1-4.5 1.2-3.2A2 2 0 0 1 8.1 7h7.8a2 2 0 0 1 1.9 1.3L19 11.5 18 16"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/><path d="M8 11h8"/></svg>',
      moto: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/><path d="M9 17.5h5.5M6.5 15 9 11h4l2-2h3l1 3h-3"/><path d="M11 11 13.5 7H16"/></svg>',
    };
    return icons[icon] || '';
  }

  render() {
    // Recalcule les étapes : le champ de tarification s'adapte au type choisi
    // (puissance CV pour voiture, cylindrée cm³ pour moto).
    this.fields = this.getFields();
    const field = this.fields[this.currentStep];
    const tunnelWrapper = document.querySelector('.tunnel-wrapper');
    if (!tunnelWrapper) return;

    if (this.lastTrackedStep !== field.id) {
      this.lastTrackedStep = field.id;
      this.api.track('step_view', field.id, { index: this.currentStep + 1 });
    }

    const stepLabels = this.getStepLabels();
    const progressPct = Math.round(((this.currentStep + 1) / this.fields.length) * 100);
    const stepperHTML = stepLabels.map((label, i) => {
      const state = i < this.currentStep ? 'done' : i === this.currentStep ? 'active' : '';
      const ariaCurrent = i === this.currentStep ? ' aria-current="step"' : '';
      return `<div class="stepper-item ${state}" role="listitem"${ariaCurrent}><span class="stepper-dot">${i < this.currentStep ? '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>' : i + 1}</span><span class="stepper-label">${label}</span></div>`;
    }).join('');

    let formHTML = `
      <div class="form-stepper" role="list" aria-label="Étapes du devis">${stepperHTML}</div>
      <div class="form-progress" role="progressbar" aria-valuenow="${this.currentStep + 1}" aria-valuemin="1" aria-valuemax="${this.fields.length}" aria-label="Progression du devis">
        <div class="progress-bar"><div class="progress-fill" style="width: ${progressPct}%"></div></div>
      </div>

      <form class="form-step" id="form-step">
        <h3 class="form-title" id="form-step-title">${field.label}</h3>
        ${field.hint ? `<p class="form-hint-text">${field.hint}</p>` : ''}
    `;

    if (field.type === 'choice') {
      const quote = this.store.getState('onboarding.quote') || {};
      const selectedValue = this.store.getState(`onboarding.data.${field.id}`) || '';
      const hasPrices = field.choices.some((c) => quote[c.value]);
      if (field.id === 'coverage' && !hasPrices && !this.quoteError) {
        formHTML += `<div class="tunnel-info-banner" role="status">Complète les infos de ton véhicule pour afficher ton tarif exact — sans engagement.</div>`;
      }
      if (field.id === 'coverage' && this.quoteError) {
        formHTML += `<div class="tunnel-info-banner tunnel-info-banner--error" role="alert">Impossible d'afficher ton tarif. <button type="button" class="tunnel-inline-link" onclick="window.SURO_FORM.retryQuote()">Réessayer le calcul</button></div>`;
      }
      if (field.id === 'coverage' && hasPrices) {
        formHTML += `<div class="tunnel-info-banner" role="status">Tarif annuel TTC selon ton véhicule — sans engagement à ce stade. Tu confirmes tout avant le paiement.</div>`;
      }
      formHTML += `
        <p class="form-sublabel">${field.sublabel || ''}</p>
        <div class="form-choices" role="radiogroup" aria-labelledby="form-step-title">
          ${field.choices.map((choice) => {
            const price = quote[choice.value];
            const priceHTML = price
              ? `<div class="choice-price">${Number(price).toLocaleString('fr-FR')} <span class="choice-price-unit">DH/an</span></div>`
              : '';
            const selected = selectedValue === choice.value;
            const iconHTML = choice.icon
              ? `<span class="choice-icon choice-icon--${choice.icon}">${this.renderChoiceIcon(choice.icon)}</span>`
              : '';
            const bodyClass = choice.icon ? ' choice-body--with-icon' : '';
            return `
            <button type="button" class="choice-btn choice-card${selected ? ' selected' : ''}" data-value="${choice.value}" role="radio" aria-checked="${selected ? 'true' : 'false'}" tabindex="${selected ? '0' : '-1'}" onclick="window.SURO_FORM.selectChoice('${choice.value}')">
              ${choice.tag ? `<span class="choice-tag">${choice.tag}</span>` : ''}
              <div class="choice-body${bodyClass}">
                ${iconHTML}
                <div class="choice-content">
                  <div class="choice-label">${choice.label}</div>
                  ${priceHTML}
                  ${choice.description ? `<div class="choice-desc">${choice.description}</div>` : ''}
                  ${choice.details ? `<ul class="choice-details">${choice.details.map((d) => `<li>${d}</li>`).join('')}</ul>` : ''}
                </div>
                <span class="choice-radio"></span>
              </div>
            </button>`;
          }).join('')}
        </div>
        <span class="form-error" id="error-${field.id}"></span>
      `;
    } else if (field.type === 'group') {
      const gridClass = (field.id === 'vehicle' || field.id === 'contact') ? ' form-group-fields--grid' : '';
      formHTML += `<div class="form-group-fields${gridClass}">`;
      field.fields.forEach((sub) => {
        const subValue = sub.secret
          ? (this.secrets && this.secrets[sub.id]) || ''
          : this.store.getState(`onboarding.data.${sub.id}`) || '';
        const fullClass = sub.fullWidth ? ' form-subfield--full' : '';
        const inputHTML = sub.inputType === 'textarea'
          ? `<textarea id="field-${sub.id}" class="form-textarea" placeholder="${sub.placeholder}" autocomplete="${sub.autocomplete || 'off'}">${subValue}</textarea>`
          : `<input
              type="${sub.type}"
              id="field-${sub.id}"
              class="form-input"
              placeholder="${sub.placeholder}"
              value="${subValue}"
              autocomplete="${sub.autocomplete || 'off'}"
              ${sub.type === 'number' ? 'inputmode="numeric"' : ''}
            />`;
        formHTML += `
          <div class="form-subfield${fullClass}">
            <label class="form-sublabel" for="field-${sub.id}">${sub.label}</label>
            ${inputHTML}
            <span class="form-error" id="error-${sub.id}"></span>
          </div>
        `;
      });
      formHTML += `</div>`;
      if (field.id === 'account') {
        formHTML += this.renderLegalConsentBlock('account-consent', 'account');
      }
      if (field.id === 'contact') {
        formHTML += this.renderLegalConsentBlock('legal-consent', 'subscription');
      }
    } else {
      const currentValue = this.store.getState(`onboarding.data.${field.id}`) || '';
      formHTML += `
        <input
          type="${field.type}"
          id="field-${field.id}"
          class="form-input"
          placeholder="${field.placeholder}"
          value="${currentValue}"
          autocomplete="${field.autocomplete || 'on'}"
          required="${field.required}"
        />
        <span class="form-error" id="error-${field.id}"></span>
      `;
    }

    formHTML += `
      <div class="form-actions">
        ${this.currentStep > 0 ? `
          <button type="button" class="btn btn-ghost" onclick="window.SURO_FORM.previousStep()">
            Retour
          </button>
        ` : ''}
        <button type="button" class="btn btn-primary btn-block" onclick="window.SURO_FORM.nextStep()">
          ${this.currentStep === this.fields.length - 1 ? 'Finaliser' : 'Continuer'}
        </button>
      </div>
    </form>
    `;

    tunnelWrapper.innerHTML = formHTML;

    if (field.type === 'choice') {
      this.setupChoiceKeyboard();
    }

    // Focus input if not choice
    if (field.type !== 'choice') {
      setTimeout(() => {
        const firstId = field.type === 'group' ? field.fields[0].id : field.id;
        const input = document.querySelector(`#field-${firstId}`);
        if (input) input.focus();
      }, 100);
    }
  }

  openFocusMode() {
    document.body.classList.add('tunnel-focus');
    const card = document.getElementById('tunnel-card');
    if (card) card.scrollTop = 0;
  }

  closeFocusMode() {
    document.body.classList.remove('tunnel-focus');
  }

  isMobileViewport() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  setupMobileFocus() {
    const card = document.getElementById('tunnel-card');
    if (!card || card.dataset.mobileFocusBound) return;
    card.dataset.mobileFocusBound = '1';

    card.addEventListener('pointerdown', (e) => {
      if (!this.isMobileViewport()) return;
      if (document.body.classList.contains('tunnel-focus')) return;
      if (e.target.closest('.tunnel-close')) return;
      this.openFocusMode();
    }, { passive: true });
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


  setFieldError(fieldId, message) {
    const input = document.querySelector(`#field-${fieldId}`);
    const errorEl = document.querySelector(`#error-${fieldId}`);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('show');
      errorEl.setAttribute('role', 'alert');
    }
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', `error-${fieldId}`);
    }
  }

  clearFieldError(fieldId) {
    const input = document.querySelector(`#field-${fieldId}`);
    const errorEl = document.querySelector(`#error-${fieldId}`);
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('show');
      errorEl.removeAttribute('role');
    }
    if (input) {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  }

  async nextStep() {
    const field = this.fields[this.currentStep];

    // Group field: validate and store each sub-field
    if (field.type === 'group') {
      let allValid = true;
      field.fields.forEach((sub) => {
        const input = document.querySelector(`#field-${sub.id}`);
        const val = input ? input.value.trim() : '';
        this.clearFieldError(sub.id);

        const validation = sub.validate ? sub.validate(val) : true;
        if (validation !== true) {
          this.setFieldError(sub.id, validation);
          allValid = false;
          return;
        }
        this.clearFieldError(sub.id);

        if (sub.secret) {
          // Jamais dans le store (persisté en localStorage)
          this.secrets = this.secrets || {};
          this.secrets[sub.id] = val;
        } else {
          this.store.setState(`onboarding.data.${sub.id}`, val);
        }
      });

      if (!allValid) return;

      if (field.id === 'account' && !this.validateLegalConsent('account-consent')) {
        return;
      }

      if (field.id === 'contact' && !this.validateLegalConsent('legal-consent')) {
        return;
      }

      this.api.track('step_complete', field.id);

      // Après l'étape véhicule : calcul du devis (prix affichés à l'étape couverture)
      if (field.id === 'vehicle') {
        const tunnelWrapper = document.querySelector('.tunnel-wrapper');
        if (tunnelWrapper) {
          tunnelWrapper.innerHTML = `
            <div class="tunnel-state">
              <div class="tunnel-spinner"></div>
              <p>Calcul de ton devis…</p>
            </div>`;
        }
        try {
          const quote = await this.api.getQuote({
            annee: this.store.getState('onboarding.data.annee'),
            puissance: this.store.getState('onboarding.data.puissance'),
            marque: this.store.getState('onboarding.data.marque'),
            modele: this.store.getState('onboarding.data.modele'),
            vehicle_type: this.store.getState('onboarding.data.vehicle_type') || 'voiture',
          });
          this.store.setState('onboarding.quote', quote);
          this.quoteError = false;
          this.api.track('quote_shown', 'coverage', quote);
        } catch (e) {
          this.quoteError = true;
          this.api.track('quote_error', 'vehicle');
          this.showQuoteError();
          return;
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
        this.setFieldError(field.id, 'Sélectionne une option');
        return;
      }
      this.clearFieldError(field.id);
    } else {
      const input = document.querySelector(`#field-${field.id}`);
      value = input.value.trim();

      // Validate
      const validation = await this.validateField(field.id, value);
      if (validation !== true) {
        this.setFieldError(field.id, validation);
        return;
      }
      this.clearFieldError(field.id);
    }

    // Store value
    this.store.setState(`onboarding.data.${field.id}`, value);
    this.api.track('step_complete', field.id);

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
      this.setFieldError(subFieldId || fieldId, message);
      const input = document.querySelector(`#field-${subFieldId || fieldId}`);
      if (input) input.focus();
    }, 150);
  }

  selectChoice(value) {
    const field = this.fields[this.currentStep];
    this.store.setState(`onboarding.data.${field.id}`, value);
    this.api.track('choice_selected', field.id, { value });

    document.querySelectorAll('.choice-btn').forEach((btn) => {
      const isSelected = btn.dataset.value === value;
      btn.classList.toggle('selected', isSelected);
      btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      btn.setAttribute('tabindex', isSelected ? '0' : '-1');
    });

    const errorEl = document.querySelector(`#error-${field.id}`);
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('show');
    }

    if (field.id === 'coverage') {
      setTimeout(() => this.nextStep(), 300);
    }
  }

  setupChoiceKeyboard() {
    const buttons = [...document.querySelectorAll('.form-choices .choice-btn')];
    if (!buttons.length) return;

    buttons.forEach((btn, index) => {
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          buttons[(index + 1) % buttons.length].focus();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault();
          buttons[(index - 1 + buttons.length) % buttons.length].focus();
        } else if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          this.selectChoice(btn.dataset.value);
        }
      });
    });
  }

  showQuoteError() {
    const tunnelWrapper = document.querySelector('.tunnel-wrapper');
    if (!tunnelWrapper) return;

    tunnelWrapper.innerHTML = `
      <div class="tunnel-state">
        <div class="tunnel-error-icon">
          <svg viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
        </div>
        <p class="tunnel-error-msg">Impossible de calculer ton devis</p>
        <p class="tunnel-error-hint">Vérifie ta connexion internet et réessaie. Tes informations sont conservées.</p>
        <div class="tunnel-error-actions">
          <button type="button" class="btn btn-primary" onclick="window.SURO_FORM.retryQuote()">Réessayer</button>
          <button type="button" class="btn btn-ghost" onclick="window.SURO_FORM.renderVehicleStep()">Modifier mes infos</button>
        </div>
      </div>
    `;
  }

  renderVehicleStep() {
    this.quoteError = false;
    const vehicleIndex = this.fields.findIndex((f) => f.id === 'vehicle');
    if (vehicleIndex !== -1) this.currentStep = vehicleIndex;
    this.render();
  }

  async retryQuote() {
    const tunnelWrapper = document.querySelector('.tunnel-wrapper');
    if (tunnelWrapper) {
      tunnelWrapper.innerHTML = `
        <div class="tunnel-state">
          <div class="tunnel-spinner"></div>
          <p>Calcul de ton devis…</p>
        </div>`;
    }

    try {
      const quote = await this.api.getQuote({
        annee: this.store.getState('onboarding.data.annee'),
        puissance: this.store.getState('onboarding.data.puissance'),
        marque: this.store.getState('onboarding.data.marque'),
        modele: this.store.getState('onboarding.data.modele'),
        vehicle_type: this.store.getState('onboarding.data.vehicle_type') || 'voiture',
      });
      this.store.setState('onboarding.quote', quote);
      this.quoteError = false;
      this.api.track('quote_shown', 'coverage', quote);
      const coverageIndex = this.fields.findIndex((f) => f.id === 'coverage');
      if (coverageIndex !== -1) this.currentStep = coverageIndex;
      this.render();
    } catch (e) {
      this.quoteError = true;
      this.api.track('quote_error', 'vehicle');
      this.showQuoteError();
    }
  }

  getFullName(data) {
    return [data.prenom, data.nom].filter((v) => v && v.trim()).join(' ').trim();
  }

  async submit() {
    const tunnelWrapper = document.querySelector('.tunnel-wrapper');
    if (!tunnelWrapper) return;

    try {
      tunnelWrapper.innerHTML = `
        <div class="tunnel-state">
          <div class="tunnel-spinner"></div>
          <p>Traitement de ta demande…</p>
        </div>
      `;

      const data = this.store.getState('onboarding.data');
      const fullName = this.getFullName(data);

      // Email : soit celui de la session (client connecté), soit celui saisi
      const email = this.loggedIn && this.session ? this.session.email : data.email;

      // 1. Créer le compte client AVANT le paiement (sauf si déjà connecté)
      // (si le client quitte après avoir payé, son contrat est déjà rattaché à son compte)
      if (this.loggedIn) {
        this.accountStatus = 'logged_in';
        if (fullName) {
          try {
            await this.api.updateUser({
              data: {
                name: fullName,
                prenom: data.prenom || null,
                nom: data.nom || null,
                phone: data.phone || null,
              },
            });
          } catch (e) {
            /* non bloquant */
          }
        }
      } else {
        const password = (this.secrets && this.secrets.password) || '';
        try {
          const result = await this.api.signup(email, password, {
            phone: data.phone || null,
            name: fullName || null,
            prenom: data.prenom || null,
            nom: data.nom || null,
          });
          this.accountStatus = result.session ? 'logged_in' : 'confirmation_required';
          this.api.track('account_created', null, { status: this.accountStatus });
        } catch (accountError) {
          const accMsg = accountError.message || '';
          if (/already registered|already been registered/i.test(accMsg)) {
            // Un compte existe déjà : on tente la connexion avec le mot de passe fourni
            try {
              await this.api.login(email, password);
              this.accountStatus = 'logged_in';
              this.api.track('account_login');
            } catch (loginError) {
              // Mauvais mot de passe pour un compte existant → retour à l'étape compte
              this.api.track('account_password_error');
              this.goToStepWithError(
                'account', 'password',
                'Un compte existe déjà avec cet email — entre ton mot de passe habituel'
              );
              return;
            }
          } else if (/email/i.test(accMsg) && /invalid|valid|format|not allowed/i.test(accMsg)) {
            // Email refusé par Supabase (ex: a@a.com, adresse de test/non délivrable)
            // → on renvoie DIRECTEMENT au champ email, sans rien effacer.
            this.api.track('account_email_error');
            this.goToStepWithError(
              'account', 'email',
              'Cet email n\'est pas accepté — utilise une vraie adresse (ex: prenom.nom@gmail.com).'
            );
            return;
          } else {
            throw accountError;
          }
        }
      }

      // 2. Créer le contrat (rattaché au compte par l'email)
      const application = await this.api.createApplication({
        product_slug: 'automobile',
        vehicle_type: data.vehicle_type || 'voiture',
        immatriculation: data.immatriculation,
        marque: data.marque,
        modele: data.modele,
        annee: data.annee,
        puissance: data.puissance,
        coverage: data.coverage,
        email: email,
        phone: data.phone,
        customer_name: fullName || null,
        address: data.address,
      });

      this.store.setState('onboarding.applicationId', application.application.id);
      this.api.track('application_created', null, { coverage: data.coverage });

      // 3. Choix : payer maintenant, ou enregistrer le devis pour payer plus tard
      this.showPaymentChoice(application.application.id);
    } catch (error) {
      const msg = String(error.message || '');
      this.api.track('tunnel_error', 'submit', { message: msg.slice(0, 200) });

      // Erreur d'email/compte détectée tardivement → retour au champ email,
      // en conservant toutes les infos déjà saisies.
      if (!this.loggedIn && /email/i.test(msg) && /invalid|valid|format|not allowed/i.test(msg)) {
        this.goToStepWithError(
          'account', 'email',
          'Cet email n\'est pas accepté — utilise une vraie adresse (ex: prenom.nom@gmail.com).'
        );
        return;
      }

      // Autre erreur : on GARDE les données saisies et on propose de réessayer
      // sans repartir de zéro.
      tunnelWrapper.innerHTML = `
        <div class="tunnel-state">
          <div class="tunnel-error-icon">
            <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </div>
          <p class="tunnel-error-msg">Erreur : ${error.message}</p>
          <p class="tunnel-error-hint">Tes informations sont conservées.</p>
          <div class="tunnel-error-actions">
            <button class="btn btn-primary" onclick="window.SURO_FORM.retryLastStep()">Réessayer</button>
            <button class="btn btn-ghost" onclick="window.SURO_FORM.reset()">Tout recommencer</button>
          </div>
        </div>
      `;
    }
  }

  // Revient au dernier écran de saisie sans effacer les données déjà remplies
  retryLastStep() {
    this.currentStep = this.fields.length - 1;
    this.render();
  }

  // Écran final : payer maintenant ou enregistrer le devis pour payer plus tard.
  showPaymentChoice(applicationId) {
    const tunnelWrapper = document.querySelector('.tunnel-wrapper');
    if (!tunnelWrapper) return;
    this.api.track('payment_choice_view');

    const quote = this.store.getState('onboarding.quote') || {};
    const coverage = this.store.getState('onboarding.data.coverage');
    const premium = quote[coverage];
    const amountHTML = premium
      ? `<div class="payment-amount">
           <div class="payment-amount-label">Prime annuelle — ${coverage === 'complete' ? 'Couverture complète' : 'Couverture minimale'}</div>
           <div class="payment-amount-value">${Number(premium).toLocaleString('fr-FR')} DH<span>/an</span></div>
         </div>`
      : '';

    tunnelWrapper.innerHTML = `
      <div class="payment-section">
        <h3>Ton contrat est prêt</h3>
        ${amountHTML}
        <p class="payment-legal">Paie maintenant pour l'activer, ou garde ton devis et paie plus tard depuis ton espace client. Le paiement implique l'acceptation des <a href="${this.getAssetBase()}conditions.html" target="_blank" rel="noopener">CGU/CGV</a>.</p>

        <div class="payment-methods">
          <button type="button" class="payment-method-btn" onclick="window.SURO_FORM.payNow('${applicationId}')">
            <span class="payment-method-icon">
              <svg viewBox="0 0 24 24"><path d="M13 2 3 14h7l-1 8 10-12h-7z"/></svg>
            </span>
            <div>
              <div class="payment-method-label">Payer maintenant
                <span style="display:inline-block;background:var(--color-primary,#0F766E);color:#fff;font-size:10px;font-weight:700;padding:1px 7px;border-radius:999px;margin-left:6px;vertical-align:middle;letter-spacing:.02em;">Recommandé</span>
              </div>
              <div class="payment-method-desc">Active ton contrat et reçois ton attestation</div>
            </div>
            <span class="payment-method-arrow">→</span>
          </button>

          <button type="button" class="payment-method-btn" onclick="window.SURO_FORM.payLater('${applicationId}')">
            <span class="payment-method-icon">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            </span>
            <div>
              <div class="payment-method-label">Payer plus tard</div>
              <div class="payment-method-desc">On garde ton devis dans ton espace — paie quand tu veux</div>
            </div>
            <span class="payment-method-arrow">→</span>
          </button>
        </div>
      </div>
    `;
  }

  payNow(applicationId) {
    this.api.track('pay_now_selected');
    this.showPaymentOptions(applicationId);
  }

  payLater(applicationId) {
    this.api.track('pay_later_selected');
    this.showSavedConfirmation();
  }

  // Confirmation « devis enregistré » : le compte/espace existe, le contrat
  // reste en attente de paiement (aucune couverture tant que non payé).
  showSavedConfirmation() {
    const tunnelWrapper = document.querySelector('.tunnel-wrapper');
    if (!tunnelWrapper) return;
    this.api.track('quote_saved_view');

    const email = (this.loggedIn && this.session ? this.session.email : this.store.getState('onboarding.data.email')) || '';
    const quote = this.store.getState('onboarding.quote') || {};
    const coverage = this.store.getState('onboarding.data.coverage');
    const premium = quote[coverage];

    tunnelWrapper.innerHTML = `
      <div class="success-container">
        <div class="success-section">
          <div class="success-icon-wrap">
            <svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>
          </div>
          <h2 class="success-heading">Devis enregistré</h2>
          <p class="success-description">Ton espace client est prêt${premium ? ` — ${Number(premium).toLocaleString('fr-FR')} DH/an` : ''}. Ton devis t'y attend.</p>

          <div class="success-info success-info--warn">
            Ton contrat n'est <strong>pas encore actif</strong> : aucune couverture ni attestation tant que le paiement n'est pas effectué.
          </div>

          <div class="success-info">
            Connecte-toi avec <strong>${email}</strong> et clique sur <strong>Payer</strong> quand tu veux pour activer ton contrat.
          </div>

          <div class="success-actions">
            <button class="btn btn-primary btn-block" onclick="window.SURO_FORM.handleGoToSpace()">
              Aller à mon espace client
            </button>
          </div>
        </div>
      </div>
    `;
  }

  showPaymentOptions(applicationId) {
    const tunnelWrapper = document.querySelector('.tunnel-wrapper');
    if (!tunnelWrapper) return;
    this.api.track('payment_view');

    const quote = this.store.getState('onboarding.quote') || {};
    const coverage = this.store.getState('onboarding.data.coverage');
    const premium = quote[coverage];
    const amountHTML = premium
      ? `<div class="payment-amount">
           <div class="payment-amount-label">Prime annuelle — ${coverage === 'complete' ? 'Couverture complète' : 'Couverture minimale'}</div>
           <div class="payment-amount-value">${Number(premium).toLocaleString('fr-FR')} DH<span>/an</span></div>
         </div>`
      : '';

    tunnelWrapper.innerHTML = `
      <div class="payment-section">
        <h3>Choisir une méthode de paiement</h3>
        ${amountHTML}
        <p class="payment-transparency">Le montant affiché est estimatif TTC selon les informations saisies. La prime définitive est confirmée par Wafa Assurance, assureur du contrat.</p>
        ${this.renderLegalConsentBlock('payment-consent', 'payment')}
        <p class="payment-legal payment-legal--hint">Coche la case ci-dessus pour activer le paiement. Les CGU/CGV sont consultables à tout moment avant validation.</p>

        <div class="payment-methods">
          <button type="button" class="payment-method-btn" onclick="window.SURO_FORM.selectPaymentMethod('card', '${applicationId}')">
            <span class="payment-method-icon">
              <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
            </span>
            <div>
              <div class="payment-method-label">Carte bancaire</div>
              <div class="payment-method-desc">Visa, Mastercard, Amex</div>
            </div>
            <span class="payment-method-arrow">→</span>
          </button>

          <button type="button" class="payment-method-btn" onclick="window.SURO_FORM.selectPaymentMethod('mtn', '${applicationId}')">
            <span class="payment-method-icon">
              <svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
            </span>
            <div>
              <div class="payment-method-label">MTN Mobile Money</div>
              <div class="payment-method-desc">Paiement par SMS</div>
            </div>
            <span class="payment-method-arrow">→</span>
          </button>

          <button type="button" class="payment-method-btn" onclick="window.SURO_FORM.selectPaymentMethod('bank', '${applicationId}')">
            <span class="payment-method-icon">
              <svg viewBox="0 0 24 24"><path d="M3 21h18M4 18h16M6 18V9M10 18V9M14 18V9M18 18V9M2 10l10-5 10 5"/></svg>
            </span>
            <div>
              <div class="payment-method-label">Virement bancaire</div>
              <div class="payment-method-desc">Transfert direct</div>
            </div>
            <span class="payment-method-arrow">→</span>
          </button>
        </div>
      </div>
    `;
    this.setupPaymentConsentGate();
  }

  async selectPaymentMethod(method, applicationId) {
    if (!this.validateLegalConsent('payment-consent')) {
      return;
    }
    this.api.track('payment_method_selected', null, { method });
    const tunnelWrapper = document.querySelector('.tunnel-wrapper');
    tunnelWrapper.innerHTML = `
      <div class="tunnel-state">
        <div class="tunnel-spinner"></div>
        <p>Traitement du paiement...</p>
      </div>
    `;

    try {
      const quote = this.store.getState('onboarding.quote') || {};
      const coverage = this.store.getState('onboarding.data.coverage');
      await this.api.submitPayment(applicationId, {
        method,
        amount: quote[coverage] || null,  // Montant de référence (le prix officiel est calculé côté serveur)
        currency: 'MAD',
      });

      this.api.track('payment_success', null, { method });
      this.showCompletion(applicationId);
    } catch (error) {
      this.api.track('payment_error', null, { method });
      // Le compte et le contrat existent déjà : on réessaie le PAIEMENT
      // (surtout pas un reset() qui créerait un doublon de contrat).
      tunnelWrapper.innerHTML = `
        <div class="tunnel-state">
          <div class="tunnel-error-icon">
            <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </div>
          <p class="tunnel-error-msg">Erreur de paiement</p>
          <p class="tunnel-error-hint">Ton contrat est déjà enregistré, il ne reste que le paiement.</p>
          <div class="tunnel-error-actions">
            <button class="btn btn-primary" onclick="window.SURO_FORM.showPaymentOptions('${applicationId}')">
              Réessayer le paiement
            </button>
          </div>
        </div>
      `;
    }
  }

  showCompletion(applicationId) {
    const tunnelWrapper = document.querySelector('.tunnel-wrapper');
    if (!tunnelWrapper) return;
    this.api.track('completion_view');

    const email = (this.loggedIn && this.session ? this.session.email : this.store.getState('onboarding.data.email')) || '';
    const address = this.store.getState('onboarding.data.address') || '';
    const data = this.store.getState('onboarding.data') || {};
    const holder = (this.getFullName(data) || (email ? email.split('@')[0] : 'CLIENT')).toUpperCase();
    const contractNumber = 'SR-' + String(applicationId).replace(/-/g, '').slice(0, 8).toUpperCase();

    const quote = this.store.getState('onboarding.quote') || {};
    const coverage = this.store.getState('onboarding.data.coverage');
    const premium = quote[coverage];

    tunnelWrapper.innerHTML = `
      <div class="success-container">
        <div class="success-section">
          <div class="success-icon-wrap">
            <svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
          </div>
          <h2 class="success-heading">Paiement confirmé</h2>
          <p class="success-description">Ton contrat est en cours d'activation${premium ? ` — ${Number(premium).toLocaleString('fr-FR')} DH/an` : ''}. Envoie tes 3 pièces pour finaliser le dossier.</p>

          <div class="contract-card">
            <div class="contract-card-header">Référence souscription</div>
            <div class="contract-card-number">${contractNumber}</div>
            <div class="contract-card-holder">${holder}</div>
          </div>

          <div class="success-info success-info--warn">
            Contrat d'assurance souscrit auprès de <strong>Wafa Assurance</strong>. SURO facilite la souscription en qualité d'intermédiaire technologique.
          </div>

          <div class="success-info success-info--warn">
            <strong>3 documents requis</strong> — CIN, permis de conduire et carte grise. Envoie-les pour finaliser ton dossier (validation sous 48 h ouvrées).
          </div>

          <div class="success-info">
            <strong>Tes documents officiels</strong> — télécharge ton attestation dans ton espace client. Ta <strong>carte verte physique</strong> est préparée et expédiée à l'adresse indiquée.
            ${address ? `<br><br>Envoi postal à : <strong>${address}</strong>` : ''}
          </div>

          ${this.accountStatus === 'confirmation_required' ? `
          <div class="success-info success-info--warn">
            Ton compte est créé — <strong>confirme ton email</strong> (lien envoyé à ${email}) pour accéder à ton espace client.
          </div>` : ''}

          <div class="success-actions">
            <button class="btn btn-primary btn-block" onclick="window.SURO_FORM.handleGoToDocuments('${applicationId}')">
              Compléter mon dossier
            </button>
            <button type="button" class="btn btn-ghost btn-block" onclick="window.SURO_FORM.handleGoToSpace()">
              Aller à mon espace
            </button>
          </div>

          <p class="success-foot">
            Questions ? <strong>support@suro.ma</strong>
          </p>
        </div>
      </div>
    `;
  }

  handleGoToDocuments(applicationId) {
    try {
      sessionStorage.setItem('suroPendingDocsAppId', applicationId);
    } catch (_) { /* ignore */ }
    this.handleGoToSpace('documents');
  }

  handleGoToSpace(targetPage) {
    const base = this.getAssetBase();
    if (this.accountStatus === 'logged_in') {
      if (window.location.pathname.includes('/app')) {
        if (window.dashboard) {
          window.dashboard.fetchPolicies(true);
          window.dashboard.navigateTo(targetPage || 'dashboard');
        } else {
          window.location.href = `${base}app/${targetPage ? `#${targetPage}` : ''}`;
        }
      } else {
        window.location.href = `${base}app/${targetPage ? `#${targetPage}` : ''}`;
      }
    } else {
      window.location.href = `${base}customer-login.html`;
    }
  }

  handleDashboard() {
    window.location.href = `${this.getAssetBase()}customer-login.html`;
  }

  attachListeners() {
    this.setupMobileFocus();

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('tunnel-focus')) {
        this.closeFocusMode();
      }
    });

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
    this.quoteError = false;
    this.currentStep = 0;
    this.render();
  }
}

// Export — pas d'auto-init dans l'espace client (tunnel chargé à la demande)
if (typeof window !== 'undefined') {
  window.SURO_OnboardingForm = OnboardingForm;
  const path = window.location.pathname || '';
  const inApp = path.includes('/app');
  if (!inApp) {
    window.SURO_FORM = new OnboardingForm();
  }
}
