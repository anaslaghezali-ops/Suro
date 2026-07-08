/* SURO API Service */

const API_BASE = '/api';

class API {
  static async call(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API Error');
    }

    return response.json();
  }

  // Onboarding
  static getVehicleInfo(immatriculation) {
    return this.call('/vehicles/info', {
      method: 'POST',
      body: JSON.stringify({ immatriculation }),
    });
  }

  static getCoverage(vehicleType) {
    return this.call(`/products/automobile?type=${vehicleType}`);
  }

  static createApplication(data) {
    return this.call('/applications', {
      method: 'POST',
      body: JSON.stringify({
        product_slug: 'automobile',
        status: 'pending',
        answers: data,
      }),
    });
  }

  static submitPayment(applicationId, paymentData) {
    return this.call(`/applications/${applicationId}/payment`, {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  }

  // Auth
  static login(email, password) {
    return this.call('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  static logout() {
    localStorage.removeItem('suro-token');
    return Promise.resolve();
  }

  // Dashboard
  static getDashboard() {
    return this.call('/me/dashboard');
  }

  static getDocuments() {
    return this.call('/me/documents');
  }

  static declareClaim(claimData) {
    return this.call('/me/claims', {
      method: 'POST',
      body: JSON.stringify(claimData),
    });
  }
}

// Export
if (typeof window !== 'undefined') {
  window.SURO_API = API;
}
