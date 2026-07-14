/* SURO Onboarding Tunnel */

class OnboardingTunnel {
  constructor() {
    this.store = window.SURO_STORE;
    this.api = window.SURO_API;
    this.questions = this.getQuestions();
    this.init();
  }

  init() {
    this.render();
    this.attachListeners();
  }

  getQuestions() {
    return [
      {
        id: 'immatriculation',
        question: "Quelle est l'immatriculation de ta voiture?",
        type: 'text',
        placeholder: 'Ex: ABC-1234-CD',
        validate: (value) => /^[A-Z]{2,3}-\d{3,4}-[A-Z]{2}$/.test(value) || 'Format invalide',
      },
      {
        id: 'coverage',
        question: 'Couverture complète? Vol, Incendie, RC, Assistance 24/7.',
        type: 'choice',
        choices: ['Ouais', 'Attends, je veux changer'],
      },
      {
        id: 'email',
        question: 'Ton email? (Pour ta quittance)',
        type: 'email',
        placeholder: 'Ex: rachid@email.com',
      },
      {
        id: 'phone',
        question: 'Et ton numéro? (Pour les urgences)',
        type: 'tel',
        placeholder: 'Ex: 06 XX XX XX XX',
      },
    ];
  }

  async handleAnswer(answer) {
    const currentStep = this.store.getState('onboarding.step');
    const currentQuestion = this.questions[currentStep];

    if (!currentQuestion) return;

    // Validate
    if (currentQuestion.validate) {
      const error = currentQuestion.validate(answer);
      if (error !== true) {
        this.addMessage('error', error);
        return;
      }
    }

    // Add user message
    this.addMessage('user', answer);

    // Update store
    this.store.setState(`onboarding.data.${currentQuestion.id}`, answer);

    // Special handling for immatriculation
    if (currentQuestion.id === 'immatriculation') {
      try {
        this.store.setState('onboarding.loading', true);
        const vehicle = await this.api.getVehicleInfo(answer);
        this.store.setState('onboarding.data.vehicleInfo', vehicle);
        this.addMessage('assistant', `Ah nice! C'est une ${vehicle.brand} ${vehicle.model} ${vehicle.year}, ${vehicle.mileage}km. Couverture complète? Vol, Incendie, RC, Assistance 24/7.`);
        this.store.setState('onboarding.loading', false);
      } catch (error) {
        this.addMessage('error', 'Immatriculation non reconnue, réessaie?');
        this.store.setState('onboarding.loading', false);
        return;
      }
    }

    // Move to next step
    const nextStep = currentStep + 1;
    this.store.setState('onboarding.step', nextStep);

    // Render next question or complete
    if (nextStep >= this.questions.length) {
      this.complete();
    } else {
      this.render();
    }
  }

  async complete() {
    const data = this.store.getState('onboarding.data');

    try {
      this.store.setState('onboarding.loading', true);

      // Submit application to backend
      const application = await this.api.createApplication({
        product_slug: 'automobile',
        immatriculation: data.immatriculation,
        vehicleInfo: data.vehicleInfo,
        coverage: data.coverage,
        email: data.email,
        phone: data.phone,
      });

      this.store.setState('onboarding.applicationId', application.id);
      this.addMessage('assistant', 'Impeccable! C\'est 120 DH/mois. Première quittance demain.');

      // Show success/completion UI
      this.showCompletion(data);
      this.store.setState('onboarding.loading', false);
    } catch (error) {
      this.addMessage('error', 'Erreur lors de la création de l\'application. Réessaie?');
      this.store.setState('onboarding.loading', false);
    }
  }

  addMessage(type, content) {
    const messagesContainer = document.querySelector('.messages');
    if (!messagesContainer) return;

    const message = document.createElement('div');
    message.className = `message ${type}`;

    if (type === 'error') {
      message.className = 'message error';
      message.innerHTML = `<div class="message-avatar">⚠️</div><div class="message-bubble">${content}</div>`;
    } else {
      const avatar = type === 'assistant' ? 'S' : 'T';
      message.innerHTML = `<div class="message-avatar">${avatar}</div><div class="message-bubble">${content}</div>`;
    }

    messagesContainer.appendChild(message);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  render() {
    const currentStep = this.store.getState('onboarding.step');
    const currentQuestion = this.questions[currentStep];

    if (!currentQuestion) return;

    const inputGroup = document.querySelector('.input-group');
    if (!inputGroup) return;

    inputGroup.innerHTML = '';

    if (currentQuestion.type === 'choice') {
      const actionContainer = document.querySelector('.quick-actions');
      if (actionContainer) {
        actionContainer.innerHTML = currentQuestion.choices
          .map(choice => `
            <button class="btn btn-ghost btn-block" onclick="window.SURO_TUNNEL.handleAnswer('${choice}')">
              ${choice}
            </button>
          `)
          .join('');
      }
    } else {
      const input = document.createElement('input');
      input.type = currentQuestion.type;
      input.className = 'input';
      input.placeholder = currentQuestion.placeholder;

      const button = document.createElement('button');
      button.className = 'btn btn-primary';

      // Outcome-focused button text
      if (currentQuestion.id === 'immatriculation') {
        button.textContent = 'Vérifier';
      } else if (currentQuestion.id === 'phone') {
        button.textContent = 'Continuer';
      } else {
        button.textContent = 'Continuer';
      }

      button.onclick = () => {
        if (input.value.trim()) {
          this.handleAnswer(input.value.trim());
          input.value = '';
          input.focus();
        }
      };

      input.onkeypress = (e) => {
        if (e.key === 'Enter') {
          button.click();
        }
      };

      inputGroup.appendChild(input);
      inputGroup.appendChild(button);
      setTimeout(() => input.focus(), 100);
    }

    // Add assistant message
    this.addMessage('assistant', currentQuestion.question);
  }

  showCompletion(data) {
    const tunnelWrapper = document.querySelector('.tunnel-wrapper');
    if (!tunnelWrapper) return;

    const contractNumber = 'SR-' + Date.now().toString().slice(-8);
    const holder = data.email ? data.email.split('@')[0].toUpperCase() : 'CLIENT';

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
          <button class="btn btn-primary" onclick="window.SURO_TUNNEL.handleDownload()">
            Télécharger ma carte verte
          </button>
          <button class="btn btn-ghost" onclick="window.SURO_TUNNEL.handleDashboard()">
            Mon espace
          </button>
        </div>

        <p style="margin-top: 32px; font-size: 12px; color: var(--color-neutral-600); text-align: center;">
          Questions? On est là → <strong>support@suro.ma</strong>
        </p>
      </div>
    `;
  }

  async handleDownload() {
    try {
      const applicationId = this.store.getState('onboarding.applicationId');
      if (!applicationId) {
        this.addMessage('error', 'Impossible de télécharger. Application non trouvée.');
        return;
      }

      this.addMessage('assistant', 'Voilà! Télécharge ta carte verte. Elle est valide à partir de demain.');

      // TODO: Implement actual PDF download from /api/applications/:id/certificate
      // For now, simulate success
      setTimeout(() => {
        this.addMessage('assistant', 'Merci d\'avoir choisi SURO! 🎉');
      }, 1000);
    } catch (error) {
      this.addMessage('error', 'Erreur lors du téléchargement. Réessaie?');
    }
  }

  handleDashboard() {
    // Redirect to dashboard
    window.location.href = '/dashboard';
  }

  reset() {
    this.store.reset();
    window.location.href = '/';
  }
}

// Export
if (typeof window !== 'undefined') {
  window.SURO_TUNNEL = new OnboardingTunnel();
}
