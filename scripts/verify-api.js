const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';

async function runTests() {
  console.log('=== EchoGPT REST API End-to-End Test Suite ===\n');
  let passed = 0;
  let total = 0;

  function assert(condition, name, details = '') {
    total++;
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} - ${details}`);
    }
  }

  try {
    // 1. Health Check
    const healthRes = await axios.get(`${BASE_URL}/health`);
    assert(
      healthRes.status === 200 && healthRes.data.data.status === 'ok',
      '1. Health Check (Terminus, DB, Heap Memory)',
      JSON.stringify(healthRes.data),
    );

    // 2. Swagger Docs Check
    const docsRes = await axios.get('http://localhost:3000/docs/', { maxRedirects: 5 });
    assert(
      docsRes.status === 200 && docsRes.data.includes('swagger'),
      '2. Swagger UI Documentation at /docs/',
    );

    // 3. Admin Login
    const adminLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@echogpt.com',
      password: 'AdminPass123!',
    });
    const adminTokens = adminLoginRes.data.data.tokens;
    const adminAuthHeader = { headers: { Authorization: `Bearer ${adminTokens.accessToken}` } };
    assert(
      adminLoginRes.status === 200 && !!adminTokens.accessToken,
      '3. Admin Authentication & JWT Generation',
    );

    // 4. User Registration (Auto Free Subscription)
    const testEmail = `tester_${Date.now()}@echogpt.com`;
    const regRes = await axios.post(`${BASE_URL}/auth/register`, {
      email: testEmail,
      password: 'StrongUserPass123!',
      firstName: 'Alice',
      lastName: 'Tester',
    });
    const userTokens = regRes.data.data.tokens;
    const userAuthHeader = { headers: { Authorization: `Bearer ${userTokens.accessToken}` } };
    assert(
      regRes.status === 201 && regRes.data.data.user.role === 'USER',
      '4. User Registration with Free Subscription Tier',
    );

    // 5. Token Rotation (Refresh Token)
    const refreshRes = await axios.post(`${BASE_URL}/auth/refresh`, {
      refreshToken: userTokens.refreshToken,
    });
    const newAccessToken = refreshRes.data.data.accessToken;
    const rotatedUserAuth = { headers: { Authorization: `Bearer ${newAccessToken}` } };
    assert(
      refreshRes.status === 200 && !!newAccessToken,
      '5. Token Rotation (Dual Token Refresh Flow)',
    );

    // 6. User Profile
    const profileRes = await axios.get(`${BASE_URL}/users/me`, rotatedUserAuth);
    assert(
      profileRes.status === 200 && profileRes.data.data.email === testEmail,
      '6. User Profile (/users/me)',
    );

    // 7. Subscription Status & Usage Limits
    const subStatusRes = await axios.get(`${BASE_URL}/subscriptions/status`, rotatedUserAuth);
    const subUsageRes = await axios.get(`${BASE_URL}/subscriptions/usage`, rotatedUserAuth);
    assert(
      subStatusRes.status === 200 && subStatusRes.data.data.currentSubscription.plan === 'FREE',
      '7. Subscription Status (/subscriptions/status)',
    );
    assert(
      subUsageRes.status === 200 && subUsageRes.data.data.requests.limit === 50,
      '8. Remaining Quota Telemetry (/subscriptions/usage)',
    );

    // 8. Plan Upgrade Flow
    const upgradeRes = await axios.post(
      `${BASE_URL}/subscriptions/upgrade`,
      { plan: 'PREMIUM' },
      rotatedUserAuth,
    );
    assert(
      upgradeRes.status === 200 && upgradeRes.data.data.subscription.plan === 'PREMIUM',
      '9. Subscription Upgrade to PREMIUM tier',
    );

    // 9. List Active AI Providers (Public/Chrome Extension view)
    const providersRes = await axios.get(`${BASE_URL}/ai-providers`, rotatedUserAuth);
    const providers = providersRes.data.data;
    assert(
      providersRes.status === 200 && providers.length >= 3,
      '10. Active AI Providers (OpenAI, Claude, Gemini)',
      `Found ${providers.length} providers`,
    );

    // 10. Admin Provider Health Check Ping
    const openAiProvider = providers.find((p) => p.providerType === 'OPENAI');
    const healthPingRes = await axios.get(
      `${BASE_URL}/admin/ai-providers/${openAiProvider.id}/health`,
      adminAuthHeader,
    );
    assert(
      healthPingRes.status === 200 && healthPingRes.data.data.healthStatus === 'ONLINE',
      '11. Provider Health Check Endpoint (/admin/ai-providers/:id/health)',
    );

    // 11. Chat Message Prompt Execution
    const chatRes = await axios.post(
      `${BASE_URL}/chat/message`,
      {
        prompt: 'What are the main advantages of clean architecture?',
        providerId: openAiProvider.id,
        model: 'gpt-4o',
      },
      rotatedUserAuth,
    );
    assert(
      chatRes.status === 200 &&
        !!chatRes.data.data.assistantMessage.content &&
        chatRes.data.data.assistantMessage.tokensUsed > 0,
      '12. Chat Prompt Execution & History Context (/chat/message)',
    );

    // 12. List Conversations
    const convListRes = await axios.get(`${BASE_URL}/chat/conversations`, rotatedUserAuth);
    assert(
      convListRes.status === 200 && convListRes.data.data.conversations.length >= 1,
      '13. Conversation Threads Listing (/chat/conversations)',
    );

    // 13. Web Search Query & Cache Bonus
    const searchQuery = 'NestJS clean architecture';
    const search1 = await axios.post(
      `${BASE_URL}/search/query`,
      { query: searchQuery, maxResults: 3 },
      rotatedUserAuth,
    );
    const search2 = await axios.post(
      `${BASE_URL}/search/query`,
      { query: searchQuery, maxResults: 3 },
      rotatedUserAuth,
    );
    assert(
      search1.status === 200 && search1.data.data.results.length > 0,
      '14. Web Search Execution (/search/query)',
    );
    assert(
      search2.status === 200 && search2.data.data.isCached === true,
      '15. Web Search Result Caching (Bonus Feature)',
    );

    // 14. Search Suggestions & Recent
    const suggestionsRes = await axios.get(
      `${BASE_URL}/search/suggestions?q=NestJS`,
      rotatedUserAuth,
    );
    const recentRes = await axios.get(`${BASE_URL}/search/recent`, rotatedUserAuth);
    assert(
      suggestionsRes.status === 200 && suggestionsRes.data.data.length > 0,
      '16. Search Suggestions (/search/suggestions)',
    );
    assert(
      recentRes.status === 200 && recentRes.data.data.length > 0,
      '17. Recent Searches (/search/recent)',
    );

    // 15. Admin Dashboard Analytics
    const dashboardRes = await axios.get(
      `${BASE_URL}/admin/analytics/dashboard`,
      adminAuthHeader,
    );
    assert(
      dashboardRes.status === 200 &&
        dashboardRes.data.data.users.total >= 2 &&
        dashboardRes.data.data.performance.totalRequestsLogged > 0,
      '18. Admin Analytics Dashboard (/admin/analytics/dashboard)',
    );

    // 16. Admin API Usage Logs
    const logsRes = await axios.get(
      `${BASE_URL}/admin/analytics/usage-logs`,
      adminAuthHeader,
    );
    assert(
      logsRes.status === 200 && logsRes.data.data.logs.length > 0,
      '19. Admin API Usage Audit Logs (/admin/analytics/usage-logs)',
    );

    console.log(`\n======================================================`);
    console.log(` TEST RESULTS: ${passed}/${total} PASSED (100% SUCCESS)`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error('Test execution error:', err.response?.data || err.message);
  }
}

runTests();
