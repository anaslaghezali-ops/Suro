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
        question: "L'immatriculation de ta voiture?",
        type: 'text',
        placeholder: 'Ex: ABC-1234-CD',
        validate: (value) => /^[A-Z]{2,3}-\d{3,4}-[A-Z]{2}$/.test(value) || 'Format invalide',
      },
      {
        id: 'coverage',
        question: 'On te propose: Vol, Incendie, Responsabilité, Assistance 24/7. Ça te dit?',
        type: 'choice',
        choices: ['Ouais', 'Attends...'],
      },
      {
        id: 'firstName',
        question: 'Ton prénom?',
        type: 'text',
        placeholder: 'Ex: Rachid',
      },
      {
        id: 'lastName',
        question: 'Ton nom?',
        type: 'text',
        placeholder: 'Ex: Bennani',
      },
      {
        id: 'email',
        question: 'Email?',
        type: 'email',
        placeholder: 'Ex: rachid@email.com',
      },
      {
        id: 'phone',
        question: 'Numéro?',
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
        this.addMessage('assistant', `Nice! C'est une ${vehicle.brand} ${vehicle.model} ${vehicle.year}, ${vehicle.mileage}km, assurée depuis?`);
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

    this.addMessage('assistant', 'Bah voilà, c\'est 120 DH/mois. Tu veux continuer?');

    // Show success/completion UI
    this.showCompletion(data);
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
      button.textContent = 'Envoyer';

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

    tunnelWrapper.innerHTML = `
      <div class="success-section">
        <div class="success-icon">✓</div>
        <h2 class="success-heading">C'est bon, t'es couvert</h2>
        <p class="success-description">Carte verte en pièce jointe. Première quittance demain.</p>

        <div class="contract-card">
          <div class="contract-card-header">Carte Verte SURO</div>
          <div class="contract-card-number">SR-2024-089342</div>
          <div class="contract-card-holder">${data.firstName?.toUpperCase()} ${data.lastName?.toUpperCase()}</div>
        </div>

        <p style="margin-top: 24px; font-size: 12px; color: var(--color-neutral-600);">
          Des questions? On est là → <strong>support@suro.ma</strong>
        </p>

        <button class="btn btn-primary" style="margin-top: 24px;" onclick="window.SURO_TUNNEL.reset()">
          Retour à l'accueil
        </button>
      </div>
    `;
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
