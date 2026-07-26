/**
 * Pièces KYC client — CIN, permis, carte grise (recto + verso chacune).
 * CIN et permis sont partagés entre tous les contrats du même client ;
 * la carte grise est spécifique à chaque véhicule.
 */
(function (root) {
  'use strict';

  const KYC_SIDES = ['recto', 'verso'];
  const KYC_SIDE_LABELS = { recto: 'Recto', verso: 'Verso' };

  const KYC_DOC_TYPES = [
    { id: 'cin', short: 'CIN', label: 'Carte d\'identité nationale (CIN)', hint: 'Recto et verso, lisible, en cours de validité.' },
    { id: 'permis', short: 'Permis', label: 'Permis de conduire', hint: 'Recto et verso du permis au nom du souscripteur.' },
    { id: 'carte_grise', short: 'CG', label: 'Carte grise', hint: 'Recto et verso du document du véhicule assuré.' },
  ];

  const KYC_DOC_TYPE_IDS = KYC_DOC_TYPES.map((d) => d.id);
  const KYC_CUSTOMER_TYPES = ['cin', 'permis'];
  const KYC_VEHICLE_TYPES = ['carte_grise'];
  const KYC_SLOT_COUNT = KYC_DOC_TYPE_IDS.length * KYC_SIDES.length;

  function normalizeEmail(email) {
    return (email || '').trim().toLowerCase();
  }

  function isKycDocument(doc) {
    return doc && KYC_DOC_TYPE_IDS.includes(doc.document_type);
  }

  function isCustomerSharedType(type) {
    return KYC_CUSTOMER_TYPES.includes(type);
  }

  function latestDocForSlot(docs, applicationId, type, side) {
    const rows = (docs || [])
      .filter((d) => d.application_id === applicationId
        && d.document_type === type
        && (d.document_side || null) === side)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return rows[0] || null;
  }

  function latestDocForCustomerSlot(docs, customerEmail, type, side) {
    const email = normalizeEmail(customerEmail);
    if (!email) return null;
    const rows = (docs || [])
      .filter((d) => normalizeEmail(d.customer_email) === email
        && d.document_type === type
        && (d.document_side || null) === side)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return rows[0] || null;
  }

  function resolveDocForPolicySlot(docs, applicationId, customerEmail, type, side) {
    if (isCustomerSharedType(type)) {
      return latestDocForCustomerSlot(docs, customerEmail, type, side);
    }
    return latestDocForSlot(docs, applicationId, type, side);
  }

  function typeAggregateStatus(typeEntry) {
    const recto = typeEntry?.recto || null;
    const verso = typeEntry?.verso || null;
    if (!recto && !verso) return 'missing';
    if (recto?.status === 'rejected' || verso?.status === 'rejected') return 'rejected';
    if (recto?.status === 'approved' && verso?.status === 'approved') return 'approved';
    if (recto?.status === 'pending' || verso?.status === 'pending') return 'pending';
    if (recto || verso) return 'partial';
    return 'missing';
  }

  function summarizeKycForPolicy(applicationId, allDocs, customerEmail) {
    const email = normalizeEmail(customerEmail)
      || normalizeEmail((allDocs || []).find((d) => d.application_id === applicationId)?.customer_email);

    const byType = {};
    let received = 0;
    let approved = 0;

    for (const type of KYC_DOC_TYPE_IDS) {
      byType[type] = { recto: null, verso: null };
      for (const side of KYC_SIDES) {
        const doc = resolveDocForPolicySlot(allDocs, applicationId, email, type, side);
        byType[type][side] = doc;
        if (doc) received += 1;
        if (doc?.status === 'approved') approved += 1;
      }
    }

    const missingTypes = KYC_DOC_TYPE_IDS.filter((type) => {
      const agg = typeAggregateStatus(byType[type]);
      return agg === 'missing' || agg === 'rejected' || agg === 'partial';
    });

    const piecesComplete = KYC_DOC_TYPE_IDS.filter(
      (type) => typeAggregateStatus(byType[type]) === 'approved'
    ).length;

    const needsUpload = missingTypes.length > 0;

    const pendingReview = !needsUpload && received === KYC_SLOT_COUNT && approved < KYC_SLOT_COUNT;

    const sharedIdentityComplete = KYC_CUSTOMER_TYPES.every(
      (type) => typeAggregateStatus(byType[type]) === 'approved'
    );

    return {
      byType,
      received,
      approved,
      piecesComplete,
      complete: approved === KYC_SLOT_COUNT,
      needsUpload,
      pendingReview,
      missingTypes,
      onlyCarteGriseMissing: missingTypes.length === 1 && missingTypes[0] === 'carte_grise',
      sharedIdentityComplete,
      totalSlots: KYC_SLOT_COUNT,
      totalPieces: KYC_DOC_TYPE_IDS.length,
    };
  }

  function kycDocLabel(type, side) {
    const def = KYC_DOC_TYPES.find((d) => d.id === type);
    const typeLabel = def ? def.label : (type || 'Document');
    const sideLabel = KYC_SIDE_LABELS[side] || side || '';
    return side ? `${typeLabel} — ${sideLabel}` : typeLabel;
  }

  function kycDocShortLabel(type, side) {
    const def = KYC_DOC_TYPES.find((d) => d.id === type);
    const base = def ? def.short : type;
    return side ? `${base} ${KYC_SIDE_LABELS[side]}` : base;
  }

  root.SuroKyc = {
    KYC_SIDES,
    KYC_SIDE_LABELS,
    KYC_DOC_TYPES,
    KYC_DOC_TYPE_IDS,
    KYC_CUSTOMER_TYPES,
    KYC_VEHICLE_TYPES,
    KYC_SLOT_COUNT,
    isKycDocument,
    isCustomerSharedType,
    latestDocForSlot,
    latestDocForCustomerSlot,
    resolveDocForPolicySlot,
    typeAggregateStatus,
    summarizeKycForPolicy,
    kycDocLabel,
    kycDocShortLabel,
  };
}(typeof window !== 'undefined' ? window : globalThis));
