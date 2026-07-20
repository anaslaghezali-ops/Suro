import { html } from 'htm/preact';

/* Barre de vues sauvegardées (façon Linear/Gmail) : chaque vue est un raccourci
 * de filtre nommé, avec son compteur. Cliquer une vue filtre la liste en un clic
 * au lieu de reconfigurer un filtre à chaque visite.
 *
 * views: [{ id, label, count, attn? }]  — attn=true = "nécessite attention" (ambre)
 * active: id de la vue sélectionnée ('' = Toutes)
 * onChange(id)
 */
export function SavedViews({ views, active, onChange }) {
  return html`
    <div class="views-bar">
      ${views.map((v) => html`
        <button key=${v.id} class="view-pill ${v.id === active ? 'active' : ''} ${v.attn ? 'attn' : ''}"
          onClick=${() => onChange(v.id)}>
          ${v.label}<span class="n">${v.count}</span>
        </button>`)}
    </div>`;
}
