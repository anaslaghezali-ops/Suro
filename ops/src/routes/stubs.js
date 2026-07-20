import { html } from 'htm/preact';
import { Stub } from '../components/ui.js';

/* Écrans prévus dans les phases suivantes — placeholders clairs pour que la
   navigation soit complète dès maintenant. */

export function Documents() {
  return html`<div>
    <div class="page-head"><h1>Documents</h1><p>Bibliothèque des documents transmis par les clients.</p></div>
    <${Stub} title="Module Documents — Phase 3">
      Aperçu, téléchargement, validation/refus, filtres et recherche. Le socle base
      (statut, reviewer, motif de refus) est déjà en place.
    <//>
  </div>`;
}

export function Users() {
  return html`<div>
    <div class="page-head"><h1>Utilisateurs</h1><p>Gestion des collaborateurs et de leurs rôles.</p></div>
    <${Stub} title="Module Utilisateurs — Phase 5">
      Inviter/retirer un collaborateur, attribuer un rôle (Super Admin / Admin / Opérations / Support).
      Le modèle RBAC est déjà actif en base.
    <//>
  </div>`;
}

export function Settings() {
  return html`<div>
    <div class="page-head"><h1>Paramètres</h1><p>Configuration de la plateforme.</p></div>
    <${Stub} title="Module Paramètres — Phase 5">
      Informations plateforme, emails & modèles de communication, notifications, contacts support.
      (La configuration tarifaire reste hors de ce portail, inchangée.)
    <//>
  </div>`;
}
