import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { Spinner, Empty } from '../components/ui.js';

// Étapes du funnel (niveau événement — sessions uniques).
const FUNNEL = [
  { label: 'Visite du tunnel',        key: 'tunnel_view' },
  { label: 'Devis calculé',           key: 'quote_shown' },
  { label: 'Compte créé / connecté',  fn: (b) => (b.account_created || 0) + (b.account_login || 0) },
  { label: 'Demande créée',           key: 'application_created' },
  { label: 'Choix du paiement',       key: 'payment_choice_view' },
  { label: 'Paiement réussi',         key: 'payment_success' },
];

const PERIODS = [
  { id: 7, label: '7 jours' },
  { id: 30, label: '30 jours' },
  { id: 90, label: '90 jours' },
];

function Kpi({ label, value, sub, attn }) {
  return html`
    <div class="kpi ${attn ? 'attn' : ''}">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
      ${sub ? html`<div class="sub">${sub}</div>` : null}
    </div>`;
}

export function Analytics() {
  const [days, setDays] = useState(30);
  const { data, loading, error } = useAsync(() => api.funnelStats(days).catch((e) => { throw e; }), [days]);

  const header = html`
    <div class="page-head">
      <h1>Funnel</h1>
      <p>Suivi des étapes de souscription — sessions uniques sur la période.</p>
    </div>
    <div class="views-bar" style="margin-bottom:16px">
      ${PERIODS.map((p) => html`
        <button class="view-pill ${p.id === days ? 'active' : ''}" onClick=${() => setDays(p.id)}>
          ${p.label}
        </button>`)}
    </div>`;

  if (loading) return html`${header}<div style="padding:40px"><${Spinner}/></div>`;
  if (error) return html`${header}<${Empty}>Accès réservé au staff (${error.message}).<//>`;

  // event -> sessions
  const by = {};
  (data || []).forEach((r) => { by[r.event] = Number(r.sessions) || 0; });

  const base = by.tunnel_view || 0;
  if (!base) return html`${header}<${Empty}>Aucune visite trackée sur cette période.<//>`;

  // Calcule chaque étape + repère le plus gros abandon (transition)
  const rows = FUNNEL.map((s) => {
    const n = s.fn ? s.fn(by) : (by[s.key] || 0);
    return { label: s.label, n, pct: Math.round((n / base) * 100) };
  });
  let worst = { drop: -1, idx: -1 };
  for (let i = 1; i < rows.length; i++) {
    const drop = rows[i - 1].n - rows[i].n;
    if (drop > worst.drop) worst = { drop, idx: i };
  }

  const conversion = Math.round(((by.payment_success || 0) / base) * 100);
  const payNow = by.pay_now_selected || 0;
  const payLater = by.pay_later_selected || 0;
  const choiceTotal = payNow + payLater;

  return html`
    ${header}

    <div class="kpi-grid">
      <${Kpi} label="Visites du tunnel" value=${base} sub=${`${days} derniers jours`} />
      <${Kpi} label="Demandes créées" value=${by.application_created || 0} />
      <${Kpi} label="Paiements réussis" value=${by.payment_success || 0} />
      <${Kpi} label="Conversion globale" value=${conversion + '%'} attn=${conversion < 15} />
    </div>

    <div class="card">
      <div class="card-head"><h3>Entonnoir de conversion</h3></div>
      <div class="card-body">
        <div class="funnel">
          ${rows.map((r, i) => html`
            ${i > 0 && i === worst.idx && worst.drop > 0 ? html`
              <div class="funnel-drop">▼ ${worst.drop} abandons ici (plus gros décrochage)</div>` : null}
            <div class="funnel-row">
              <div class="funnel-label">${r.label}</div>
              <div class="funnel-track">
                <div class="funnel-fill ${i === worst.idx ? 'leak' : ''}" style="width:${Math.min(r.pct, 100)}%"></div>
              </div>
              <div class="funnel-val">${r.n}<span class="funnel-pct">${r.pct}%</span></div>
            </div>`)}
        </div>
        <p class="muted" style="font-size:12px;margin-top:12px">Base = visites du tunnel. Le décrochage le plus important indique où concentrer les efforts.</p>
      </div>
    </div>

    ${choiceTotal > 0 ? html`
      <div class="card">
        <div class="card-head"><h3>À l'écran de paiement : maintenant vs plus tard</h3></div>
        <div class="card-body">
          <div class="funnel">
            <div class="funnel-row">
              <div class="funnel-label">Payer maintenant</div>
              <div class="funnel-track"><div class="funnel-fill" style="width:${Math.round((payNow / choiceTotal) * 100)}%"></div></div>
              <div class="funnel-val">${payNow}<span class="funnel-pct">${Math.round((payNow / choiceTotal) * 100)}%</span></div>
            </div>
            <div class="funnel-row">
              <div class="funnel-label">Payer plus tard</div>
              <div class="funnel-track"><div class="funnel-fill amber" style="width:${Math.round((payLater / choiceTotal) * 100)}%"></div></div>
              <div class="funnel-val">${payLater}<span class="funnel-pct">${Math.round((payLater / choiceTotal) * 100)}%</span></div>
            </div>
          </div>
        </div>
      </div>` : null}
  `;
}
