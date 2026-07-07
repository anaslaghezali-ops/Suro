/**
 * Form Configuration for Insurance Products
 * Defines the structure and fields for each insurance product
 */

const FORM_CONFIG = {
  automobile: {
    name: 'Assurance Automobile',
    icon: '🚗',
    description: 'Protégez votre véhicule avec notre assurance automobile complète',
    steps: [
      {
        title: 'Véhicule',
        fields: [
          { key: 'vehicle_brand', label: 'Marque', type: 'select', required: true, options: ['Peugeot', 'Renault', 'Citroën', 'Fiat', 'BMW', 'Mercedes', 'Audi', 'Volkswagen', 'Tesla', 'Autre'] },
          { key: 'vehicle_model', label: 'Modèle', type: 'text', required: true, placeholder: 'Ex: 308' },
          { key: 'vehicle_year', label: 'Année', type: 'number', required: true, placeholder: 'Ex: 2022' },
          { key: 'vehicle_energy', label: 'Énergie', type: 'select', required: true, options: ['Essence', 'Diesel', 'Électrique', 'Hybride'] }
        ]
      },
      {
        title: 'Conducteur',
        fields: [
          { key: 'driver_name', label: 'Nom', type: 'text', required: true },
          { key: 'driver_firstname', label: 'Prénom', type: 'text', required: true },
          { key: 'driver_birthdate', label: 'Date de naissance', type: 'date', required: true },
          { key: 'driver_email', label: 'Email', type: 'email', required: true }
        ]
      },
      {
        title: 'Téléphone',
        fields: [
          { key: 'driver_phone', label: 'Téléphone', type: 'tel', required: true, placeholder: 'Ex: +212 6xx xxx xxx' }
        ]
      },
      {
        title: 'Garanties',
        fields: [
          { key: 'guarantee_civil_responsibility', label: 'Responsabilité civile', type: 'checkbox', required: true },
          { key: 'guarantee_all_risks', label: 'Tous risques', type: 'checkbox', required: false },
          { key: 'guarantee_broken_glass', label: 'Bris de glace', type: 'checkbox', required: false },
          { key: 'guarantee_assistance', label: 'Assistance', type: 'checkbox', required: false },
          { key: 'guarantee_theft', label: 'Vol', type: 'checkbox', required: false },
          { key: 'guarantee_fire', label: 'Incendie', type: 'checkbox', required: false }
        ]
      }
    ]
  },

  voyage: {
    name: 'Assurance Voyage',
    icon: '✈️',
    description: 'Voyagez en toute sérénité avec notre assurance voyage complète',
    steps: [
      {
        title: 'Destination',
        fields: [
          { key: 'destination_country', label: 'Destination', type: 'select', required: true, options: ['France', 'Espagne', 'Italie', 'Allemagne', 'Pays-Bas', 'Belgique', 'Suisse', 'Autriche', 'Portugal', 'Grèce', 'Autre Europe', 'Monde'] },
          { key: 'departure_date', label: 'Date de départ', type: 'date', required: true },
          { key: 'return_date', label: 'Date de retour', type: 'date', required: true },
          { key: 'travelers_count', label: 'Nombre de voyageurs', type: 'number', required: true, placeholder: 'Ex: 2' }
        ]
      },
      {
        title: 'Voyageur principal',
        fields: [
          { key: 'traveler_name', label: 'Nom', type: 'text', required: true },
          { key: 'traveler_firstname', label: 'Prénom', type: 'text', required: true },
          { key: 'traveler_email', label: 'Email', type: 'email', required: true }
        ]
      },
      {
        title: 'Confirmation',
        fields: []
      }
    ]
  },

  habitation: {
    name: 'Assurance Habitation',
    icon: '🏠',
    description: 'Sécurisez votre logement avec notre assurance habitation',
    steps: [
      {
        title: 'Type de logement',
        fields: [
          { key: 'housing_type', label: 'Type de logement', type: 'select', required: true, options: ['Appartement', 'Maison', 'Villa', 'Bureau'] }
        ]
      },
      {
        title: 'Informations',
        fields: [
          { key: 'housing_city', label: 'Ville', type: 'text', required: true },
          { key: 'housing_surface', label: 'Surface (m²)', type: 'number', required: true, placeholder: 'Ex: 100' },
          { key: 'housing_value', label: 'Valeur estimée (€)', type: 'number', required: true, placeholder: 'Ex: 250000' }
        ]
      },
      {
        title: 'Garanties',
        fields: [
          { key: 'guarantee_fire', label: 'Incendie', type: 'checkbox', required: true },
          { key: 'guarantee_water_damage', label: 'Dégâts des eaux', type: 'checkbox', required: true },
          { key: 'guarantee_theft', label: 'Vol', type: 'checkbox', required: false },
          { key: 'guarantee_liability', label: 'Responsabilité civile', type: 'checkbox', required: true }
        ]
      },
      {
        title: 'Confirmation',
        fields: []
      }
    ]
  }
};

// Get config for a specific product
function getProductConfig(slug) {
  return FORM_CONFIG[slug] || null;
}

// Get all products for selection
function getAllProducts() {
  return Object.entries(FORM_CONFIG).map(([slug, config]) => ({
    slug,
    name: config.name,
    icon: config.icon,
    description: config.description
  }));
}
