import { html } from 'htm/preact';
import { Empty } from '../components/ui.js';

export function Notifications() {
  return html`
    <h1 class="ops-h1">Notifications</h1>
    <${Empty}>Les notifications cabinet arrivent ici (intégration en cours sur staging).<//>
  `;
}
