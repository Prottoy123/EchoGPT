const { execSync } = require('child_process');

console.log('====================================================');
console.log('       EchoGPT Comprehensive System Test Suite       ');
console.log('====================================================\n');

const suites = [
  { name: 'Block 1: Auth & Users (JWT, Argon2, Profile, Quota)', script: 'scripts/test-block1.js' },
  { name: 'Block 2: AI Providers (RBAC, AES-256-GCM Vault, Key CRUD)', script: 'scripts/test-block2.js' },
  { name: 'Block 3: Chat & AI Engine (Routing, History, Limit Rejection)', script: 'scripts/test-block3.js' },
  { name: 'Block 4: Web Search (Queries, Persistence, History, Recent)', script: 'scripts/test-block4.js' },
  { name: 'Extra Features: (Logout, Change Password, Upgrade, Delete, Suggestions, Health)', script: 'scripts/test-extra.js' },
];

let allPassed = true;

for (const suite of suites) {
  console.log(`\n>>> RUNNING: ${suite.name}...`);
  try {
    const output = execSync(`node ${suite.script}`, { encoding: 'utf-8' });
    console.log(output);
    console.log(`[PASS] ${suite.name}`);
  } catch (error) {
    allPassed = false;
    console.error(`[FAIL] ${suite.name}:`, error.stdout || error.message);
  }
}

console.log('\n====================================================');
if (allPassed) {
  console.log('  ALL 5 TEST SUITES PASSED! 100% SUCCESS RATE');
} else {
  console.log('  SOME TESTS FAILED - SEE LOGS ABOVE');
}
console.log('====================================================\n');
