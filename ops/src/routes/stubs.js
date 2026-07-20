import { html } from 'htm/preact';
import { Stub } from '../components/ui.js';

/* Écrans prévus dans les phases suivantes — placeholders clairs pour que la
   navigation soit complète dès maintenant. */

export function Settings() {
  return html`<div>
    <div class="page-head"><h1>Paramètres</h1><p>Configuration de la plateforme.</p></div>
    <${Stub} title="Module Paramètres — Phase 5">
      Informations plateforme, emails & modèles de communication, notifications, contacts support.
    <//>
    <div style="margin-top:16px" class="card">
      <div class="card-body" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <strong>Configuration tarifaire</strong>
          <div class="muted" style="font-size:12.5px;margin-top:2px">Conservée dans l'admin existant, inchangée (hors périmètre de refonte).</div>
        </div>
        <a class="btn-o" href="../backoffice/#settings" target="_blank" rel="noopener">Ouvrir la config tarifaire ↗</a>
      </div>
    </div>
  </div>`;
}
