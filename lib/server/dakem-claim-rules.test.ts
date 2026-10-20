import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canClaimClaim,
  canEditClaim,
  canReleaseClaim,
  getClaimBadge,
  resolveEffectiveOwnerKode,
} from './dakem-claim-rules';

const CABANG_A = { isPusat: false, userId: 'user-a', kodeCabang: 'KC-01' };
const CABANG_B = { isPusat: false, userId: 'user-b', kodeCabang: 'KC-02' };
const PUSAT = { isPusat: true, userId: 'user-p', kodeCabang: null };

test('resolveEffectiveOwnerKode: diklaim → cabang_pemilik_kode; tersedia → kode_cabang (legacy)', () => {
  assert.equal(
    resolveEffectiveOwnerKode({ claim_status: 'diklaim', cabang_pemilik_kode: 'KC-01', kode_cabang: 'KC-09' }),
    'KC-01',
  );
  assert.equal(resolveEffectiveOwnerKode({ claim_status: 'tersedia', kode_cabang: 'KC-09' }), 'KC-09');
});

test('canEditClaim: cabang hanya boleh edit pengajuan miliknya', () => {
  const claim = { claim_status: 'diklaim', cabang_pemilik_kode: 'KC-01', status_proses: 'draft' };
  assert.equal(canEditClaim(claim, CABANG_A).allowed, true);
  assert.equal(canEditClaim(claim, CABANG_B).allowed, false);
});

test('canEditClaim: pusat tidak dibatasi kepemilikan', () => {
  const claim = { claim_status: 'diklaim', cabang_pemilik_kode: 'KC-01', status_proses: 'proses_pusat' };
  assert.equal(canEditClaim(claim, PUSAT).allowed, true);
});

test('canEditClaim: tanpa cabang → hanya pusat', () => {
  const claim = { claim_status: 'tersedia', kode_cabang: null, status_proses: 'draft' };
  assert.equal(canEditClaim(claim, CABANG_A).allowed, false);
});

test('canClaimClaim: tersedia & tahap awal → boleh', () => {
  const claim = { claim_status: 'tersedia', kode_cabang: 'KC-09', status_proses: 'draft' };
  assert.equal(canClaimClaim(claim, CABANG_A).allowed, true);
});

test('canClaimClaim: sudah diklaim cabang lain → ditolak', () => {
  const claim = { claim_status: 'diklaim', cabang_pemilik_kode: 'KC-01', status_proses: 'draft' };
  assert.equal(canClaimClaim(claim, CABANG_B).allowed, false);
});

test('canClaimClaim: sudah milik sendiri → tidak perlu claim lagi', () => {
  const claim = { claim_status: 'diklaim', cabang_pemilik_kode: 'KC-01', status_proses: 'draft' };
  assert.equal(canClaimClaim(claim, CABANG_A).allowed, false);
});

test('canClaimClaim: pengajuan sudah submit ke pusat → tidak dapat diklaim', () => {
  const claim = { claim_status: 'tersedia', kode_cabang: null, status_proses: 'proses_pusat' };
  assert.equal(canClaimClaim(claim, CABANG_A).allowed, false);
});

test('canReleaseClaim: hanya pemilik atau pusat', () => {
  const claim = { claim_status: 'diklaim', cabang_pemilik_kode: 'KC-01', status_proses: 'draft' };
  assert.equal(canReleaseClaim(claim, CABANG_A).allowed, true);
  assert.equal(canReleaseClaim(claim, CABANG_B).allowed, false);
  assert.equal(canReleaseClaim(claim, PUSAT).allowed, true);
  assert.equal(
    canReleaseClaim({ claim_status: 'tersedia', status_proses: 'draft' }, CABANG_A).allowed,
    false,
  );
});

test('getClaimBadge sesuai konteks aktor', () => {
  const claim = { claim_status: 'diklaim', cabang_pemilik_kode: 'KC-01', status_proses: 'draft' };
  assert.equal(getClaimBadge(claim, CABANG_A), 'milik_cabang_sendiri');
  assert.equal(getClaimBadge(claim, CABANG_B), 'diklaim_cabang_lain');
  assert.equal(
    getClaimBadge({ claim_status: 'tersedia', status_proses: 'draft' }, CABANG_A),
    'tersedia',
  );
});
