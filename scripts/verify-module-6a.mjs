import { readFile } from 'node:fs/promises';

const target = new URL('../assets/js/chatearn-v4-returning.js', import.meta.url);
const source = await readFile(target, 'utf8');

const checks = [
  ['canonical portal RPC is used', /chatearn_get_withdrawal_portal_v5/],
  ['canonical payout account RPC is used', /chatearn_get_payout_accounts_v5/],
  ['canonical submit RPC is used', /chatearn_submit_withdrawal_v5/],
  ['legacy raw account inputs are hidden', /wdAccNo[\s\S]*style\.display\s*=\s*'none'/],
  ['account details are rendered masked', /masked_account/],
  ['payout account id is submitted', /p_payout_account_id/],
  ['idempotency key is generated', /ce_withdrawal_idempotency_key/],
  ['duplicate submissions are blocked', /state\.submitting/],
  ['active withdrawals block resubmission', /activeWithdrawal\(portal\)/],
  ['legacy bank verification is retired', /retiredLegacyBankVerification/],
  ['public withdrawal controller is exposed', /window\.ChatEarnWithdrawalV5/],
  ['no legacy withdrawal RPC remains', /chatearn_v4_get_return_experience|chatearn_v4_claim_return_task|chatearn_v62_(next|open|claim)_chat_reward/]
];

const rows = checks.map(([check_name, pattern], index) => {
  const negative = index === checks.length - 1;
  const matched = pattern.test(source);
  return {
    severity: 'blocking',
    check_name,
    passed: negative ? !matched : matched,
    observed: negative ? (matched ? 'legacy RPC reference found' : 'none found') : (matched ? 'present' : 'missing'),
    expected: negative ? 'none found' : 'present'
  };
});

console.log('severity,check_name,passed,observed,expected');
for (const row of rows) {
  console.log([row.severity, row.check_name, row.passed, row.observed, row.expected]
    .map(value => `"${String(value).replaceAll('"', '""')}"`).join(','));
}

if (rows.some(row => !row.passed)) process.exitCode = 1;
