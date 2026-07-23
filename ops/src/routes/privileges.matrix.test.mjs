/**
 * Tests unitaires — logique d'affichage de la matrice des privilèges.
 * node ops/src/routes/privileges.matrix.test.mjs
 */

function buildGrid(matrix, capabilities, roles) {
  const grid = {};
  roles.forEach((role) => {
    grid[role] = {};
    capabilities.forEach((cap) => {
      const row = matrix?.find((m) => m.role === role && m.capability === cap.id);
      grid[role][cap.id] = Boolean(row);
    });
  });
  return grid;
}

function nextAllowed(matrix, role, capId) {
  const current = matrix?.find((row) => row.role === role && row.capability === capId);
  return !current;
}

const matrix = [
  { role: 'admin', capability: 'contract.edit' },
  { role: 'operations', capability: 'claim.handle' },
];

const caps = [{ id: 'contract.edit' }, { id: 'claim.handle' }];
const roles = ['admin', 'operations', 'support'];

const grid = buildGrid(matrix, caps, roles);

const asserts = [
  ['admin contract.edit checked', grid.admin['contract.edit'] === true],
  ['operations claim.handle checked', grid.operations['claim.handle'] === true],
  ['support claim.handle unchecked', grid.support['claim.handle'] === false],
  ['toggle off existing', nextAllowed(matrix, 'admin', 'contract.edit') === false],
  ['toggle on missing', nextAllowed(matrix, 'support', 'claim.handle') === true],
];

let failed = 0;
for (const [label, ok] of asserts) {
  if (!ok) { console.error('FAIL:', label); failed++; }
  else console.log('ok:', label);
}

if (failed) process.exit(1);
console.log(`\n${asserts.length - failed}/${asserts.length} passed`);
