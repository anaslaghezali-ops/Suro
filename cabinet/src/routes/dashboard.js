import { html } from 'htm/preact';
import { api } from '../lib/api.js';
import { useAsync } from '../../../ops/src/lib/useAsync.js';
import { Spinner } from '../components/ui.js';

export function Dashboard() {
  const tasks = useAsync(() => api.listTasks(null, 200, 0), []);
  const claims = useAsync(() => api.listClaims(null, 200, 0), []);

  if (tasks.loading) return html`<${Spinner}/>`;

  const open = (tasks.data || []).filter((t) => !['police_emise', 'refuse', 'cloture'].includes(t.status));
  const urgent = open.filter((t) => t.priority === 'urgente' || t.priority === 'haute');
  const openClaims = (claims.data || []).filter((c) => c.broker_status !== 'cloture');

  return html`
    <h1 class="ops-h1">Dashboard</h1>
    <div class="cabinet-kpi-row">
      <div class="cabinet-kpi"><div class="n">${open.length}</div><div class="l">Dossiers ouverts</div></div>
      <div class="cabinet-kpi"><div class="n">${urgent.length}</div><div class="l">Priorité haute</div></div>
      <div class="cabinet-kpi"><div class="n">${openClaims.length}</div><div class="l">Sinistres actifs</div></div>
      <div class="cabinet-kpi"><div class="n">${(tasks.data || []).filter((t) => t.status === 'nouveau').length}</div><div class="l">Nouveaux</div></div>
    </div>
    <p style="color:var(--color-neutral-600);font-size:14px">Traitez un dossier depuis Souscriptions — objectif &lt; 30 secondes par action.</p>
  `;
}
