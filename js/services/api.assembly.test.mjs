/**
 * Tests — assemblage API + logique session.
 * node js/services/api.assembly.test.mjs
 */
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import vm from 'vm';

const require = createRequire(import.meta.url);

function loadApiInSandbox() {
  const sandbox = {
    window: {},
    localStorage: {
      _data: {},
      getItem(k) { return this._data[k] ?? null; },
      setItem(k, v) { this._data[k] = v; },
      removeItem(k) { delete this._data[k]; },
    },
    fetch: async () => ({ ok: false, status: 401, json: async () => ({}) }),
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000001' },
    document: { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } },
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
  };
  sandbox.window = sandbox;

  const files = [
    'config.js', 'session.js', 'http.js', 'analytics.js', 'onboarding.js',
    'auth.js', 'customer-portal.js', 'admin.js', 'api-notifications.js', 'api.js',
  ];

  for (const f of files) {
    const code = readFileSync(new URL(f, import.meta.url), 'utf8');
    vm.runInNewContext(code, sandbox, { filename: f });
  }

  return sandbox.window.SURO_API;
}

const API = loadApiInSandbox();

const checks = [
  ['SURO_API défini', typeof API === 'function'],
  ['sb présent', typeof API.sb === 'function'],
  ['getSession présent', typeof API.getSession === 'function'],
  ['refreshSession présent', typeof API.refreshSession === 'function'],
  ['login présent', typeof API.login === 'function'],
  ['adminGetApplications présent', typeof API.adminGetApplications === 'function'],
  ['getMyPolicies présent', typeof API.getMyPolicies === 'function'],
  ['track présent', typeof API.track === 'function'],
  ['uuid présent', typeof API.uuid === 'function'],
];

let failed = 0;
let total = 0;
const assert = (label, ok) => {
  total++;
  if (!ok) { console.error('FAIL:', label); failed++; }
  else console.log('ok:', label);
};

for (const [label, ok] of checks) assert(label, ok);

// Session expirée → ensureValidSession retourne null sans refresh_token
API.setSession({ access_token: 'a.b.c', email: 't@test.ma' });
const expired = await API.ensureValidSession();
assert('ensureValidSession sans refresh_token', expired === null);

// Construction des requêtes paginées (sans réseau : on capture les paths passés à sbList).
const paths = [];
let capturedPath = '';
API.sbList = (path) => { capturedPath = path; paths.push(path); return Promise.resolve({ rows: [], total: 0 }); };

// -- Paiements --
assert('adminListPayments présent', typeof API.adminListPayments === 'function');
await API.adminListPayments({ limit: 12, offset: 24, status: 'succeeded', search: 'jean dupont', sortKey: 'amount', sortDir: -1 });
for (const piece of [
  '/rest/v1/suro_payments?',
  'limit=12', 'offset=24',
  'order=amount.desc',
  'or=(status.is.null,status.eq.succeeded)', // 'succeeded' inclut status NULL
  'customer_email=ilike.',                    // recherche déléguée au serveur (mono-colonne)
]) {
  assert(`requête paiements contient « ${piece} »`, capturedPath.includes(piece));
}
await API.adminListPayments({ status: 'pending' });
assert('paiements pending → status=eq.pending', capturedPath.includes('status=eq.pending') && !capturedPath.includes('is.null'));

// -- Contrats (souscriptions) : statusIn + recherche multi-colonnes --
assert('adminListApplications présent', typeof API.adminListApplications === 'function');
await API.adminListApplications({ statusIn: ['active', 'expired'], search: 'foo', sortKey: 'annual_premium', sortDir: 1 });
for (const piece of [
  '/rest/v1/insurance_applications?',
  'status=in.(active,expired)',
  'order=annual_premium.asc',
  'or=(customer_email.ilike.', 'immatriculation.ilike.', // recherche multi-colonnes
]) {
  assert(`requête contrats contient « ${piece} »`, capturedPath.includes(piece));
}

// -- Sinistres : status eq + recherche multi-colonnes --
assert('adminListClaims présent', typeof API.adminListClaims === 'function');
await API.adminListClaims({ status: 'pending', search: 'vol', sortKey: 'claim_type', sortDir: -1 });
for (const piece of [
  '/rest/v1/insurance_claims?',
  'status=eq.pending',
  'order=claim_type.desc',
  'or=(claim_type.ilike.', 'description.ilike.',
]) {
  assert(`requête sinistres contient « ${piece} »`, capturedPath.includes(piece));
}

// -- Compteurs sinistres : une requête count (limit=1) par vue --
assert('adminClaimCounts présent', typeof API.adminClaimCounts === 'function');
paths.length = 0;
const counts = await API.adminClaimCounts();
assert('claimCounts → 5 requêtes count (all + 4 statuts)', paths.length === 5);
assert('claimCounts requêtes bornées (limit=1)', paths.every((p) => p.includes('limit=1')));
assert('claimCounts filtre par statut', paths.some((p) => p.includes('status=eq.pending')));
assert('claimCounts renvoie un objet { all, pending, ... }', counts && typeof counts === 'object' && 'all' in counts && 'pending' in counts);

if (failed) process.exit(1);
console.log(`\n${total - failed}/${total} passed`);
