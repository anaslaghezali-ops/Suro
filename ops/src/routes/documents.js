import { html } from 'htm/preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { DataTable } from '../components/DataTable.js';
import { SavedViews } from '../components/SavedViews.js';
import { SlideOver, Badge, Spinner, Empty, toast } from '../components/ui.js';
import { can } from '../lib/permissions.js';
import { fmtDate, docStatus, vehicleLabel } from '../lib/format.js';

const Kyc = () => window.SuroKyc;

const DOC_VIEWS = [
  { id: '', label: 'Tous', match: (d) => !Kyc().isKycDocument(d) },
  { id: 'pending', label: 'À vérifier', attn: true, match: (d) => !Kyc().isKycDocument(d) && (d.status || 'pending') === 'pending' },
  { id: 'approved', label: 'Validés', match: (d) => !Kyc().isKycDocument(d) && d.status === 'approved' },
  { id: 'rejected', label: 'Refusés', match: (d) => !Kyc().isKycDocument(d) && d.status === 'rejected' },
];

const KYC_DOSSIER_VIEWS = [
  { id: '', label: 'Tous les dossiers', match: () => true },
  { id: 'pending', label: 'À traiter', attn: true, match: (row) => row.pendingCount > 0 },
  { id: 'incomplete', label: 'Incomplets', match: (row) => !row.summary.complete && row.summary.received < Kyc().KYC_SLOT_COUNT },
  { id: 'complete', label: 'Complets', match: (row) => row.summary.complete },
];

function Preview({ doc }) {
  const [state, setState] = useState({ loading: true, url: null, type: '', error: null });
  useEffect(() => {
    let revoked = false; let objUrl = null;
    setState({ loading: true, url: null, type: '', error: null });
    api.documentBlobUrl(doc.storage_path)
      .then(({ url, type }) => { if (!revoked) { objUrl = url; setState({ loading: false, url, type, error: null }); } })
      .catch((e) => { if (!revoked) setState({ loading: false, url: null, type: '', error: e.message || 'Erreur' }); });
    return () => { revoked = true; if (objUrl) URL.revokeObjectURL(objUrl); };
  }, [doc.id]);

  if (state.loading) return html`<div style="padding:20px;text-align:center"><${Spinner}/></div>`;
  if (state.error) return html`<${Empty}>Aperçu indisponible.<//>`;

  const isImg = (state.type || '').startsWith('image') || /\.(png|jpe?g|gif|webp)$/i.test(doc.name || '');
  const isPdf = (state.type || '').includes('pdf') || /\.pdf$/i.test(doc.name || '');
  if (isImg) return html`<img src=${state.url} alt=${doc.name} style="max-width:100%;border:1px solid var(--color-neutral-200);border-radius:8px" />`;
  if (isPdf) return html`<iframe src=${state.url} style="width:100%;height:360px;border:1px solid var(--color-neutral-200);border-radius:8px"></iframe>`;
  return html`<${Empty}>Aperçu non disponible.<//>`;
}

function SlotReview({ doc, caps, onReviewed }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const canReview = can(caps, 'document.review');
  const st = docStatus(doc.status);

  const review = async (status) => {
    if (status === 'rejected' && !reason.trim()) { toast('Indiquez un motif de refus', 'err'); return; }
    setBusy(true);
    try {
      await api.reviewDocument(doc.id, status, status === 'rejected' ? reason.trim() : null);
      toast(status === 'approved' ? 'Face validée' : 'Face refusée', 'ok');
      onReviewed();
    } catch (e) { toast('Échec : ' + (e.message || ''), 'err'); }
    finally { setBusy(false); }
  };

  return html`
    <div class="kyc-slot-card">
      <div class="kyc-slot-head">
        <strong>${Kyc().kycDocShortLabel(doc.document_type, doc.document_side)}</strong>
        <${Badge} tone=${st.tone}>${st.label}<//>
      </div>
      <${Preview} doc=${doc} />
      <div class="kyc-slot-meta muted">${doc.name} · ${fmtDate(doc.created_at)}</div>
      ${doc.reject_reason ? html`<div class="kyc-slot-reject">Motif : ${doc.reject_reason}</div>` : null}
      <button class="btn-o sm" onClick=${() => api.downloadDocument(doc.storage_path, doc.name)}>⤓ Télécharger</button>
      ${canReview && (doc.status || 'pending') === 'pending' ? html`
        <textarea class="ops-input" rows="2" placeholder="Motif de refus…" value=${reason}
          onInput=${(e) => setReason(e.target.value)} style="margin-top:10px"></textarea>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn-o primary sm" disabled=${busy} onClick=${() => review('approved')}>✓ Valider</button>
          <button class="btn-o danger sm" disabled=${busy} onClick=${() => review('rejected')}>✕ Refuser</button>
        </div>
      ` : null}
    </div>
  `;
}

function KycDossierDetail({ app, docs, caps, onClose, onReviewed }) {
  const summary = Kyc().summarizeKycForPolicy(app.id, docs);
  const pendingCount = Kyc().KYC_DOC_TYPE_IDS.reduce((n, type) => {
    return n + Kyc().KYC_SIDES.filter((side) => summary.byType[type][side]?.status === 'pending').length;
  }, 0);

  return html`
    <${SlideOver} open=${true}
      title=${`Dossier KYC — ${vehicleLabel(app)}`}
      subtitle=${html`${app.customer_email} · ${app.immatriculation || '—'} · ${pendingCount ? `${pendingCount} face(s) à vérifier` : 'Aucune face en attente'}`}
      onClose=${onClose}>
      <div class="kyc-dossier-progress">
        <strong>${summary.received}/${summary.totalSlots} faces reçues</strong>
        <span class="muted"> · ${summary.piecesComplete}/${summary.totalPieces} pièces validées (recto + verso)</span>
      </div>
      ${Kyc().KYC_DOC_TYPES.map((def) => {
        const agg = Kyc().typeAggregateStatus(summary.byType[def.id]);
        const tone = agg === 'approved' ? 'green' : agg === 'pending' ? 'amber' : agg === 'rejected' ? 'red' : 'gray';
        return html`
          <section class="kyc-piece-section" key=${def.id}>
            <div class="kyc-piece-head">
              <h3>${def.label}</h3>
              <${Badge} tone=${tone}>${
                agg === 'approved' ? 'Validé' : agg === 'pending' ? 'En vérification' : agg === 'rejected' ? 'À corriger' : agg === 'partial' ? 'Incomplet' : 'Manquant'
              }<//>
            </div>
            <div class="kyc-slots-grid">
              ${Kyc().KYC_SIDES.map((side) => {
                const doc = summary.byType[def.id][side];
                if (!doc) {
                  return html`<div class="kyc-slot-card kyc-slot-card--empty" key=${side}>
                    <strong>${Kyc().KYC_SIDE_LABELS[side]}</strong>
                    <p class="muted">Non reçu</p>
                  </div>`;
                }
                return html`<${SlotReview} key=${doc.id} doc=${doc} caps=${caps} onReviewed=${onReviewed} />`;
              })}
            </div>
          </section>`;
      })}
    <//>
  `;
}

function KycDossiersTab({ apps, docs, caps, reload }) {
  const [activeView, setActiveView] = useState('pending');
  const [selected, setSelected] = useState(null);

  const rows = useMemo(() => {
    const paidApps = (apps || []).filter((a) => a.status === 'active' && a.paid_at);
    return paidApps.map((app) => {
      const summary = Kyc().summarizeKycForPolicy(app.id, docs);
      const pendingCount = Kyc().KYC_DOC_TYPE_IDS.reduce((n, type) => {
        return n + Kyc().KYC_SIDES.filter((side) => summary.byType[type][side]?.status === 'pending').length;
      }, 0);
      return { app, summary, pendingCount };
    }).sort((a, b) => b.pendingCount - a.pendingCount || b.summary.received - a.summary.received);
  }, [apps, docs]);

  const views = useMemo(() => KYC_DOSSIER_VIEWS.map((v) => ({
    id: v.id, label: v.label, attn: v.attn, count: rows.filter(v.match).length,
  })), [rows]);

  const activeDef = KYC_DOSSIER_VIEWS.find((v) => v.id === activeView) || KYC_DOSSIER_VIEWS[0];
  const filtered = rows.filter(activeDef.match);

  const columns = [
    { key: 'customer_email', label: 'Client', sortable: true, render: (r) => r.app.customer_email },
    { key: 'vehicle', label: 'Véhicule', sortable: true, render: (r) => vehicleLabel(r.app) },
    { key: 'immat', label: 'Immat.', sortable: true, render: (r) => r.app.immatriculation || '—' },
    { key: 'progress', label: 'Progression', render: (r) => html`${r.summary.received}/${r.summary.totalSlots} faces · ${r.summary.piecesComplete}/3 pièces` },
    { key: 'pending', label: 'À vérifier', render: (r) => r.pendingCount
      ? html`<${Badge} tone="amber">${r.pendingCount}<//>` : html`<span class="muted">—</span>` },
    { key: 'status', label: 'Dossier', render: (r) => {
      if (r.summary.complete) return html`<${Badge} tone="green">Complet<//>`;
      if (r.pendingCount) return html`<${Badge} tone="amber">À traiter<//>`;
      return html`<${Badge} tone="gray">En cours client<//>`;
    } },
  ];

  return html`
    <div class="card">
      <${SavedViews} views=${views} active=${activeView} onChange=${setActiveView} />
      ${filtered.length === 0
        ? html`<${Empty}>Aucun dossier KYC pour cette vue.<//>`
        : html`<${DataTable} key=${activeView} columns=${columns} rows=${filtered}
            searchKeys=${['app.customer_email', 'app.immatriculation']}
            onRowClick=${(r) => setSelected(r.app)} />`}
    </div>
    ${selected ? html`<${KycDossierDetail} app=${selected} docs=${docs} caps=${caps}
      onClose=${() => setSelected(null)}
      onReviewed=${reload} />` : null}
  `;
}

function Detail({ doc, caps, onClose, onReviewed }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const canReview = can(caps, 'document.review');
  const st = docStatus(doc.status);
  const title = Kyc().isKycDocument(doc)
    ? Kyc().kycDocLabel(doc.document_type, doc.document_side)
    : doc.name;

  const review = async (status) => {
    if (status === 'rejected' && !reason.trim()) { toast('Indiquez un motif de refus', 'err'); return; }
    setBusy(true);
    try {
      await api.reviewDocument(doc.id, status, status === 'rejected' ? reason.trim() : null);
      toast(status === 'approved' ? 'Document validé' : 'Document refusé', 'ok');
      onReviewed();
    } catch (e) { toast('Échec : ' + (e.message || ''), 'err'); }
    finally { setBusy(false); }
  };

  return html`
    <${SlideOver} open=${true} title=${title}
      subtitle=${html`${doc.customer_email} · déposé le ${fmtDate(doc.created_at)}`} onClose=${onClose}>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <${Badge} tone=${st.tone}>${st.label}<//>
        ${doc.reject_reason ? html`<span class="muted" style="font-size:12.5px">Motif : ${doc.reject_reason}</span>` : null}
        <button class="btn-o sm" style="margin-left:auto" onClick=${() => api.downloadDocument(doc.storage_path, doc.name)}>⤓ Télécharger</button>
      </div>
      <${Preview} doc=${doc} />
      ${canReview ? html`
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--color-neutral-200)">
          <div style="font-size:12px;font-weight:600;color:var(--color-neutral-600);margin-bottom:8px">DÉCISION</div>
          <textarea class="ops-input" rows="2" placeholder="Motif (obligatoire en cas de refus)…"
            value=${reason} onInput=${(e) => setReason(e.target.value)} style="margin-bottom:10px"></textarea>
          <div style="display:flex;gap:10px">
            <button class="btn-o primary" disabled=${busy} onClick=${() => review('approved')}>✓ Valider</button>
            <button class="btn-o danger" disabled=${busy} onClick=${() => review('rejected')}>✕ Refuser</button>
          </div>
        </div>
      ` : html`<p class="muted" style="margin-top:16px">Lecture seule (votre rôle ne permet pas la validation).</p>`}
    <//>
  `;
}

function OtherDocumentsTab({ docs, caps, reload }) {
  const nonKyc = (docs || []).filter((d) => !Kyc().isKycDocument(d));
  const [activeView, setActiveView] = useState('');
  const [selected, setSelected] = useState(null);

  const views = useMemo(() => DOC_VIEWS.map((v) => ({
    id: v.id, label: v.label, attn: v.attn, count: nonKyc.filter(v.match).length,
  })), [nonKyc]);

  const activeDef = DOC_VIEWS.find((v) => v.id === activeView) || DOC_VIEWS[0];
  const rows = nonKyc.filter(activeDef.match);
  const columns = [
    { key: 'name', label: 'Document', sortable: true, render: (d) => html`${d.name}` },
    { key: 'customer_email', label: 'Client', sortable: true },
    { key: 'status', label: 'Statut', sortable: true, render: (d) => { const s = docStatus(d.status || 'pending'); return html`<${Badge} tone=${s.tone}>${s.label}<//>`; } },
    { key: 'created_at', label: 'Déposé le', sortable: true, render: (d) => fmtDate(d.created_at) },
  ];

  return html`
    <div class="card">
      <${SavedViews} views=${views} active=${activeView} onChange=${setActiveView} />
      <${DataTable} key=${activeView} columns=${columns} rows=${rows} searchKeys=${['name', 'customer_email']}
        onRowClick=${(d) => setSelected(d)} />
    </div>
    ${selected ? html`<${Detail} doc=${selected} caps=${caps}
      onClose=${() => setSelected(null)}
      onReviewed=${() => { setSelected(null); reload(); }} />` : null}
  `;
}

export function Documents({ caps }) {
  const { data, loading, error, reload } = useAsync(async () => {
    const [docs, apps] = await Promise.all([
      api.allDocuments().catch(() => []),
      api.applications().catch(() => []),
    ]);
    return { docs: docs || [], apps: apps || [] };
  }, []);
  const [tab, setTab] = useState('kyc');

  // Spinner plein écran uniquement au 1er chargement. Les rechargements (après
  // validation d'une face) se font en arrière-plan pour ne PAS fermer le dossier ouvert.
  if (loading && !data) return html`<div style="padding:40px"><${Spinner}/></div>`;
  if (error) return html`<${Empty}>Erreur : ${error.message}<//>`;

  const kycPending = (data.docs || []).filter((d) => Kyc().isKycDocument(d) && (d.status || 'pending') === 'pending').length;

  return html`
    <div class="page-head">
      <h1>Pièces KYC</h1>
      <p>Validation des pièces clients (CIN, permis, carte grise — recto et verso). Ouvrez un dossier pour prévisualiser chaque face et valider ou refuser avec motif. Le client est notifié automatiquement.</p>
    </div>

    <div class="ops-tabs" style="margin-bottom:16px">
      <button class=${`btn-o sm${tab === 'kyc' ? ' primary' : ''}`} onClick=${() => setTab('kyc')}>
        Dossiers KYC ${kycPending ? html`<span class="ops-tab-badge">${kycPending}</span>` : null}
      </button>
      <button class=${`btn-o sm${tab === 'other' ? ' primary' : ''}`} onClick=${() => setTab('other')}>
        Autres documents
      </button>
    </div>

    ${tab === 'kyc'
      ? html`<${KycDossiersTab} apps=${data.apps} docs=${data.docs} caps=${caps} reload=${reload} />`
      : html`<${OtherDocumentsTab} docs=${data.docs} caps=${caps} reload=${reload} />`}
  `;
}
