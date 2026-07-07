/**
 * Subscription Service
 * Handles all API calls related to insurance applications
 */

class SubscriptionService {
  constructor(apiUrl = 'http://localhost:3000/api') {
    this.apiUrl = apiUrl;
  }

  /**
   * Get all products
   */
  async getProducts() {
    try {
      const response = await fetch(`${this.apiUrl}/products`);
      if (!response.ok) throw new Error('Failed to fetch products');
      const data = await response.json();
      return data.products || [];
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  }

  /**
   * Get product details with fields
   */
  async getProductFields(slug) {
    try {
      const response = await fetch(`${this.apiUrl}/products/${slug}/fields`);
      if (!response.ok) throw new Error(`Failed to fetch fields for ${slug}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching product fields:', error);
      return null;
    }
  }

  /**
   * Create a new application
   */
  async createApplication(productId, customerData) {
    try {
      const response = await fetch(`${this.apiUrl}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          customer_name: customerData.name || '',
          customer_email: customerData.email || '',
          customer_phone: customerData.phone || ''
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create application');
      }

      const data = await response.json();
      return data.application;
    } catch (error) {
      console.error('Error creating application:', error);
      throw error;
    }
  }

  /**
   * Save answers for an application
   */
  async saveAnswers(applicationId, answers) {
    try {
      const response = await fetch(`${this.apiUrl}/applications/${applicationId}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: answers.map(a => ({
            field_key: a.key,
            field_value: a.value
          }))
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save answers');
      }

      return await response.json();
    } catch (error) {
      console.error('Error saving answers:', error);
      throw error;
    }
  }

  /**
   * Get application details
   */
  async getApplication(applicationId) {
    try {
      const response = await fetch(`${this.apiUrl}/applications/${applicationId}`);
      if (!response.ok) throw new Error('Failed to fetch application');
      const data = await response.json();
      return data.application;
    } catch (error) {
      console.error('Error fetching application:', error);
      return null;
    }
  }
}

// Global instance
const subscriptionService = new SubscriptionService();
