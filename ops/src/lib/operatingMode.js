import { api } from './api.js';
import { OPERATING_MODES } from './permissions.js';
import { toast } from '../components/ui.js';

export function readOperatingMode(settings) {
  const by = {};
  (settings || []).forEach((s) => { by[s.key] = s.value; });
  return by.operating_mode === 'courtier' ? 'courtier' : 'intermediaire';
}

export function operatingModeMeta(mode) {
  return OPERATING_MODES[mode] || OPERATING_MODES.intermediaire;
}

/** Bascule via RPC suro_switch_operating_mode uniquement (garde-fous DB). */
export async function applyOperatingMode(mode) {
  const result = await api.switchOperatingMode(mode);
  if (result && result.ok === false) {
    const parts = [result.message || result.error];
    if (result.open_tasks != null) parts.push(`dossiers ouverts : ${result.open_tasks}`);
    if (result.open_claims != null) parts.push(`sinistres ouverts : ${result.open_claims}`);
    if (result.pending_kyc != null) parts.push(`KYC Ops en attente : ${result.pending_kyc}`);
    if (result.pending_claims != null) parts.push(`sinistres Ops en attente : ${result.pending_claims}`);
    const msg = parts.filter(Boolean).join(' — ');
    toast(msg, 'err');
    return { ok: false, message: msg };
  }
  window.dispatchEvent(new CustomEvent('suro-operating-mode-changed', { detail: mode }));
  return { ok: true, result };
}
