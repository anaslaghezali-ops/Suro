import { html } from 'htm/preact';
import { api } from '../lib/api.js';
import { useAsync } from '../../../ops/src/lib/useAsync.js';
import { Spinner } from '../components/ui.js';
import { PageHeader, KpiStrip } from '../components/listUi.js';
import { navigate } from '../router.js';

export function Dashboard() {
  const tasks = useAsync(() => api.listTasks(null, 200, 0), []);
  const claims = useAsync(() => api.listClaims(null, 200, 0), []);

  if (tasks.loading) return html`<${Spinner}/>`;

  const open = (tasks.data || []).filter((t) => !['police_emise', 'refuse', 'cloture'].includes(t.status));
  const urgent = open.filter((t) => t.priority === 'urgente' || t.priority === 'haute');
  const openClaims = (claims.data || []).filter((c) => c.broker_status !== 'cloture');
  const newTasks = (tasks.data || []).filter((t) => t.status === 'nouveau').length;

  return html`
    <${PageHeader}
      title="Dashboard"
      subtitle="Vue d'ensemble de votre activité — traitez les dossiers prioritaires en un clic."
    />
    <${KpiStrip} items=${[
      { label: 'Dossiers ouverts', value: open.length },
      { label: 'Priorité haute', value: urgent.length },
      { label: 'Sinistres actifs', value: openClaims.length },
      { label: 'Nouveaux dossiers', value: newTasks },
    ]} />
    <div class="cabinet-panel" style="padding:20px">
      <p style="margin:0 0 14px;font-size:14px;color:var(--color-neutral-600)">
        Objectif : traiter un dossier en moins de 30 secondes par action.
      </p>
      <div class="cabinet-actions">
        <button class="btn-o primary" onClick=${() => navigate('subscriptions')}>Voir les souscriptions</button>
        <button class="btn-o" onClick=${() => navigate('claims')}>Voir les sinistres</button>
      </div>
    </div>
  `;
}
