import { html } from 'htm/preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { DataTable } from '../components/DataTable.js';
import { SavedViews } from '../components/SavedViews.js';
import { SlideOver, Badge, Spinner, Empty, toast } from '../components/ui.js';
import { can } from '../lib/permissions.js';
import { fmtDate, docStatus } from '../lib/format.js';

const DOC_VIEWS = [
  { id: '',         label: 'Tous',       match: () => true },
  { id: 'pending',  label: 'À vérifier', attn: true, match: (d) => (d.status || 'pending') === 'pending' },
  { id: 'approved', label: 'Validés',    match: (d) => d.status === 'approved' },
  { id: 'rejected', label: 'Refusés',    match: (d) => d.status === 'rejected' },
];

/* Aperçu du fichier (image / PDF) via blob authentifié */
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

  if (state.loading) return html`<div style="padding:30px;text-align:center"><${Spinner}/></div>`;
  if (state.error) return html`<${Empty}>Aperçu indisponible (${state.error}).<//>`;

  const isImg = (state.type || '').startsWith('image') || /\.(png|jpe?g|gif|webp)$/i.test(doc.name || '');
  const isPdf = (state.type || '').includes('pdf') || /\.pdf$/i.test(doc.name || '');
  if (isImg) return html`<img src=${state.url} alt=${doc.name} style="max-width:100%;border:1px solid var(--color-neutral-200);border-radius:8px" />`;
  if (isPdf) return html`<iframe src=${state.url} style="width:100%;height:420px;border:1px solid var(--color-neutral-200);border-radius:8px"></iframe>`;
  return html`<${Empty}>Aperçu non disponible pour ce type de fichier. Utilisez « Télécharger ».<//>`;
}

function Detail({ doc, caps, onClose, onReviewed }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const canReview = can(caps, 'document.review');
  const st = docStatus(doc.status);

  const review = async (status) => {
    if (status === 'rejected' && !reason.trim()) { toast('Indiquez un motif de refus', 'err'); return; }
    setBusy(true);
    try {
      await api.reviewDocument(doc.id, status, status === 'rejected' ? reason.trim() : null);
      toast(status === 'approved' ? 'Document validé' : status === 'rejected' ? 'Document refusé' : 'Mis à jour', 'ok');
      onReviewed();
    } catch (e) { toast('Échec : ' + (e.message || ''), 'err'); }
    finally { setBusy(false); }
  };

  return html`
    <${SlideOver} open=${true} title=${doc.name}
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

export function Documents({ caps }) {
  const { data, loading, error, reload } = useAsync(() => api.allDocuments().catch(() => []), []);
  const [activeView, setActiveView] = useState('');
  const [selected, setSelected] = useState(null);

  const views = useMemo(() => DOC_VIEWS.map((v) => ({
    id: v.id, label: v.label, attn: v.attn, count: (data || []).filter(v.match).length,
  })), [data]);

  if (loading) return html`<div style="padding:40px"><${Spinner}/></div>`;
  if (error) return html`<${Empty}>Erreur : ${error.message}<//>`;

  const activeDef = DOC_VIEWS.find((v) => v.id === activeView) || DOC_VIEWS[0];
  const rows = (data || []).filter(activeDef.match);
  const columns = [
    { key: 'name', label: 'Document', sortable: true, render: (d) => html`${d.name}` },
    { key: 'customer_email', label: 'Client', sortable: true },
    { key: 'status', label: 'Statut', sortable: true, render: (d) => { const s = docStatus(d.status || 'pending'); return html`<${Badge} tone=${s.tone}>${s.label}<//>`; } },
    { key: 'created_at', label: 'Déposé le', sortable: true, render: (d) => fmtDate(d.created_at) },
  ];

  return html`
    <div class="page-head">
      <h1>Documents</h1>
      <p>Bibliothèque des documents transmis par les clients. Cliquez pour prévisualiser et valider.</p>
    </div>
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
