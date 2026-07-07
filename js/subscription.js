/**
 * Subscription Controller
 * Manages the subscription flow and UI interactions
 */

class SubscriptionController {
  constructor() {
    this.currentProduct = null;
    this.currentStep = 0;
    this.totalSteps = 0;
    this.applicationId = null;
    this.answers = {};
    this.formConfig = null;
    this.init();
  }

  init() {
    if (document.getElementById('subscription')) {
      this.setupEventListeners();
      this.loadProducts();
    }
  }

  setupEventListeners() {
    // Product selection
    document.addEventListener('click', (e) => {
      if (e.target.closest('.product-card')) {
        const slug = e.target.closest('.product-card').dataset.slug;
        this.selectProduct(slug);
      }
    });

    // Back buttons
    document.getElementById('backBtn')?.addEventListener('click', () => this.backToProducts());
    document.getElementById('backFromSummaryBtn')?.addEventListener('click', () => this.backToForm());

    // Form navigation
    document.getElementById('prevBtn')?.addEventListener('click', () => this.prevStep());
    document.getElementById('nextBtn')?.addEventListener('click', () => this.nextStep());

    // Edit button
    document.getElementById('editBtn')?.addEventListener('click', () => this.editAnswers());

    // Submit button
    document.getElementById('submitBtn')?.addEventListener('click', () => this.submitApplication());

    // Home button on confirmation
    document.getElementById('homeBtn')?.addEventListener('click', () => this.returnHome());

    // Form submission
    document.getElementById('stepForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.nextStep();
    });
  }

  /**
   * Load products from API
   */
  async loadProducts() {
    const grid = document.getElementById('productGrid');
    if (!grid) return;

    try {
      const products = getAllProducts();
      grid.innerHTML = products.map(product => `
        <div class="product-card" data-slug="${product.slug}">
          <div class="product-icon">${product.icon}</div>
          <h3>${product.name}</h3>
          <p>${product.description}</p>
        </div>
      `).join('');
    } catch (error) {
      console.error('Error loading products:', error);
    }
  }

  /**
   * Select a product and start the subscription flow
   */
  async selectProduct(slug) {
    this.currentProduct = slug;
    this.formConfig = getProductConfig(slug);
    this.currentStep = 0;
    this.answers = {};
    this.totalSteps = this.formConfig.steps.length;

    // Create a new application
    try {
      const appData = await subscriptionService.createApplication(
        // We need to get product ID from the API
        // For now, use a placeholder - will be handled by backend
        null,
        {
          name: '',
          email: app?.user?.email || '',
          phone: ''
        }
      );
      this.applicationId = appData.id;
    } catch (error) {
      console.error('Error creating application:', error);
      // Continue anyway - we can create it on submit
    }

    this.showScreen('formScreen');
    this.renderStep();
    this.updateProgress();
  }

  /**
   * Render the current step's form fields
   */
  renderStep() {
    const step = this.formConfig.steps[this.currentStep];
    const container = document.getElementById('formFields');
    const title = document.getElementById('productTitle');
    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');

    title.textContent = this.formConfig.name;

    // Show/hide navigation buttons
    prevBtn.style.display = this.currentStep > 0 ? 'block' : 'none';
    nextBtn.textContent = this.currentStep === this.totalSteps - 1 ? 'Voir résumé' : 'Suivant →';

    // Render fields for this step
    container.innerHTML = '';

    if (step.fields.length === 0) {
      // Empty step - skip to next
      container.innerHTML = '<p>Étape complète, veuillez continuer...</p>';
      return;
    }

    step.fields.forEach(field => {
      const value = this.answers[field.key] || '';
      let fieldHTML = '';

      if (field.type === 'select') {
        fieldHTML = `
          <div class="form-field">
            <label>${field.label}${field.required ? ' *' : ''}</label>
            <select name="${field.key}" ${field.required ? 'required' : ''}>
              <option value="">Sélectionner...</option>
              ${field.options.map(opt => `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`).join('')}
            </select>
          </div>
        `;
      } else if (field.type === 'checkbox') {
        fieldHTML = `
          <div class="form-field">
            <label class="checkbox-item">
              <input type="checkbox" name="${field.key}" ${value === 'on' || value === true ? 'checked' : ''}>
              <span>${field.label}${field.required ? ' *' : ''}</span>
            </label>
          </div>
        `;
      } else {
        fieldHTML = `
          <div class="form-field">
            <label>${field.label}${field.required ? ' *' : ''}</label>
            <input
              type="${field.type}"
              name="${field.key}"
              placeholder="${field.placeholder || ''}"
              value="${value}"
              ${field.required ? 'required' : ''}
            >
          </div>
        `;
      }

      container.insertAdjacentHTML('beforeend', fieldHTML);
    });

    // Add event listeners for inputs to auto-save
    container.querySelectorAll('input, select').forEach(input => {
      input.addEventListener('change', (e) => {
        const key = e.target.name;
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        this.answers[key] = value;
        this.saveAnswers();
      });
    });
  }

  /**
   * Save current answers to localStorage and API
   */
  async saveAnswers() {
    // Save to localStorage for persistence
    localStorage.setItem(`subscription_answers_${this.currentProduct}`, JSON.stringify(this.answers));

    // Save to API if we have an application ID
    if (this.applicationId) {
      try {
        const answers = Object.entries(this.answers).map(([key, value]) => ({ key, value }));
        await subscriptionService.saveAnswers(this.applicationId, answers);
      } catch (error) {
        console.error('Error saving to API:', error);
      }
    }
  }

  /**
   * Next step
   */
  async nextStep() {
    // Validate current step
    if (!this.validateStep()) return;

    // Save answers
    await this.saveAnswers();

    // Check if we're at the last step
    if (this.currentStep === this.totalSteps - 1) {
      // Show summary
      this.showSummary();
    } else {
      // Go to next step
      this.currentStep++;
      this.renderStep();
      this.updateProgress();
    }
  }

  /**
   * Previous step
   */
  prevStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.renderStep();
      this.updateProgress();
    }
  }

  /**
   * Validate current step's required fields
   */
  validateStep() {
    const inputs = document.querySelectorAll('#formFields input, #formFields select');
    let isValid = true;

    inputs.forEach(input => {
      if (input.hasAttribute('required')) {
        if (input.type === 'checkbox') {
          if (!input.checked) {
            input.style.borderColor = 'var(--danger)';
            isValid = false;
          } else {
            input.style.borderColor = '';
          }
        } else {
          if (!input.value) {
            input.style.borderColor = 'var(--danger)';
            isValid = false;
          } else {
            input.style.borderColor = '';
          }
        }
      }
    });

    if (!isValid) {
      app?.showError('Veuillez remplir tous les champs requis');
    }

    return isValid;
  }

  /**
   * Show summary screen
   */
  showSummary() {
    const summaryContainer = document.getElementById('summaryFields');
    summaryContainer.innerHTML = '';

    // Group answers by step
    this.formConfig.steps.forEach((step, stepIndex) => {
      if (stepIndex === this.totalSteps - 1) return; // Skip confirmation step

      const stepAnswers = step.fields.filter(field => this.answers[field.key] !== undefined);
      if (stepAnswers.length === 0) return;

      let sectionHTML = `<div class="summary-section"><h3>${step.title}</h3>`;

      step.fields.forEach(field => {
        const value = this.answers[field.key];
        if (value !== undefined && value !== '') {
          sectionHTML += `
            <div class="summary-field">
              <span class="field-label">${field.label}</span>
              <span class="field-value">${this.formatValue(value, field.type)}</span>
            </div>
          `;
        }
      });

      sectionHTML += '</div>';
      summaryContainer.insertAdjacentHTML('beforeend', sectionHTML);
    });

    this.showScreen('summaryScreen');
  }

  /**
   * Format values for display
   */
  formatValue(value, type) {
    if (type === 'checkbox') {
      return value ? '✓ Oui' : '✗ Non';
    }
    return value || '-';
  }

  /**
   * Edit answers - go back to form
   */
  editAnswers() {
    this.currentStep = 0;
    this.renderStep();
    this.updateProgress();
    this.showScreen('formScreen');
  }

  /**
   * Submit the application
   */
  async submitApplication() {
    try {
      // Get product ID for the API
      const productData = await subscriptionService.getProductFields(this.currentProduct);
      if (!productData) {
        throw new Error('Product not found');
      }

      // If we haven't created an application yet, create it now
      if (!this.applicationId) {
        const appData = await subscriptionService.createApplication(
          productData.product.id,
          {
            name: this.answers.driver_name || this.answers.traveler_name || this.answers.housing_city || '',
            email: this.answers.driver_email || this.answers.traveler_email || app?.user?.email || '',
            phone: this.answers.driver_phone || ''
          }
        );
        this.applicationId = appData.id;
      }

      // Save all answers
      await this.saveAnswers();

      // Show confirmation
      document.getElementById('applicationNumber').textContent = this.applicationId.substring(0, 8).toUpperCase();
      this.showScreen('confirmationScreen');

      // Show success message
      app?.showSuccess('Demande envoyée avec succès !');
    } catch (error) {
      console.error('Error submitting application:', error);
      app?.showError('Erreur lors de la soumission: ' + error.message);
    }
  }

  /**
   * Back to products
   */
  backToProducts() {
    this.showScreen('productSelector');
    this.currentProduct = null;
    this.applicationId = null;
    this.answers = {};
  }

  /**
   * Back to form from summary
   */
  backToForm() {
    this.currentStep = this.totalSteps - 2; // Go to last real step
    this.renderStep();
    this.updateProgress();
    this.showScreen('formScreen');
  }

  /**
   * Return to home
   */
  returnHome() {
    app?.showPage('home');
  }

  /**
   * Show a specific screen
   */
  showScreen(screenId) {
    document.querySelectorAll('.subscription-screen').forEach(screen => {
      screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
  }

  /**
   * Update progress bar
   */
  updateProgress() {
    const progressFill = document.getElementById('progressFill');
    const stepCounter = document.getElementById('stepCounter');
    const progress = ((this.currentStep + 1) / this.totalSteps) * 100;
    progressFill.style.width = progress + '%';
    stepCounter.textContent = `Étape ${this.currentStep + 1} sur ${this.totalSteps}`;
  }
}

// Initialize the subscription controller when the page loads
let subscriptionController = null;

function initSubscriptionModule() {
  subscriptionController = new SubscriptionController();
}

// Initialize when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSubscriptionModule);
} else {
  initSubscriptionModule();
}
