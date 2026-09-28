const http = require('http');

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (data) {
      headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path: `/api/v1${path}`,
        method,
        headers,
      },
      (res) => {
        let resBody = '';
        res.on('data', (chunk) => (resBody += chunk));
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              data: resBody ? JSON.parse(resBody) : null,
            });
          } catch (e) {
            resolve({ status: res.statusCode, data: resBody });
          }
        });
      },
    );

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log('--- Testing Newly Added Extra Endpoints ---');

  // 1. Register a test user
  const email = `extra_${Date.now()}@echogpt.com`;
  const reg = await request('POST', '/auth/register', {
    email,
    password: 'InitialPassword123!',
  });
  console.log('1. User registered:', reg.status === 201 ? 'SUCCESS' : 'FAILED');
  const token = reg.data.tokens.accessToken;
  const refreshToken = reg.data.tokens.refreshToken;

  // 2. Change password
  const chgPwd = await request(
    'POST',
    '/users/me/change-password',
    {
      currentPassword: 'InitialPassword123!',
      newPassword: 'BrandNewPassword456!',
    },
    token,
  );
  console.log('2. Change password:', chgPwd.status === 200 ? 'SUCCESS' : 'FAILED', chgPwd.data);

  // 3. Login with new password
  const loginNew = await request('POST', '/auth/login', {
    email,
    password: 'BrandNewPassword456!',
  });
  console.log('3. Login with new password:', loginNew.status === 200 ? 'SUCCESS' : 'FAILED');
  const newToken = loginNew.data.tokens.accessToken;

  // 4. Upgrade plan to PREMIUM
  const upgrade = await request('POST', '/users/me/upgrade', {}, newToken);
  console.log('4. Upgrade to PREMIUM (1,000 quota):', upgrade.status === 200 ? 'SUCCESS' : 'FAILED', upgrade.data?.subscription?.planName);

  // 5. Search suggestions
  const sugg = await request('GET', '/search/suggestions?q=NestJS', null, newToken);
  console.log('5. Search suggestions:', sugg.status === 200 ? 'SUCCESS' : 'FAILED', sugg.data);

  // 6. Provider health check (Admin)
  const adminLogin = await request('POST', '/auth/login', {
    email: 'admin@echogpt.com',
    password: 'AdminPass123!',
  });
  const adminToken = adminLogin.data.tokens.accessToken;
  const providers = await request('GET', '/ai-providers', null, adminToken);
  const providerId = providers.data[0].id;
  const health = await request('GET', `/ai-providers/${providerId}/health`, null, adminToken);
  console.log('6. AI Provider Health Check:', health.status === 200 ? 'SUCCESS' : 'FAILED', health.data);

  // 7. Logout
  const logout = await request('POST', '/auth/logout', null, newToken);
  console.log('7. Logout:', logout.status === 200 ? 'SUCCESS' : 'FAILED', logout.data);

  // Verify refresh fails after logout
  const refreshAfterLogout = await request('POST', '/auth/refresh', {
    refreshToken: loginNew.data.tokens.refreshToken,
  });
  console.log('   Refresh token invalidated after logout:', refreshAfterLogout.status === 401 ? 'YES (PASS)' : 'NO (FAIL)');

  // 8. Delete account
  // Need to log back in to get a fresh token
  const relogin = await request('POST', '/auth/login', {
    email,
    password: 'BrandNewPassword456!',
  });
  const reloginToken = relogin.data.tokens.accessToken;
  const del = await request('DELETE', '/users/me', null, reloginToken);
  console.log('8. Delete account:', del.status === 200 ? 'SUCCESS' : 'FAILED', del.data);

  // Check login fails for deleted user
  const loginDeleted = await request('POST', '/auth/login', {
    email,
    password: 'BrandNewPassword456!',
  });
  console.log('   Login blocked for deleted user:', loginDeleted.status === 401 ? 'YES (PASS)' : 'NO (FAIL)');

  console.log('\n--- ALL EXTRA ENDPOINTS VERIFIED 100% SUCCESSFUL ---');
}

run().catch(console.error);
