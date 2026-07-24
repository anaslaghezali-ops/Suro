/* Catalogue marques / modèles (Supabase vehicle_brands + vehicle_models). */
(function (root) {
  'use strict';

  const cache = {
    brands: {},
    models: {},
  };

  root.SURO_VEHICLES = {
    async listBrands(vehicleType) {
      const key = vehicleType || 'voiture';
      if (cache.brands[key]) return cache.brands[key];
      const rows = await root.SURO_HTTP.sb(
        `/rest/v1/vehicle_brands?vehicle_type=eq.${encodeURIComponent(key)}&select=id,name,is_premium&order=sort_order.asc,name.asc`
      );
      cache.brands[key] = rows || [];
      return cache.brands[key];
    },

    async listModels(brandId) {
      if (!brandId) return [];
      if (cache.models[brandId]) return cache.models[brandId];
      const rows = await root.SURO_HTTP.sb(
        `/rest/v1/vehicle_models?brand_id=eq.${encodeURIComponent(brandId)}&select=name&order=sort_order.asc,name.asc`
      );
      cache.models[brandId] = rows || [];
      return cache.models[brandId];
    },

    clearCache() {
      cache.brands = {};
      cache.models = {};
    },
  };
}(typeof window !== 'undefined' ? window : globalThis));
