const { fetch } = require('undici');

function getBundlerUrl() {
  // Prefer explicit URL; otherwise derive Polygon Amoy RPC from API key
  const explicit = process.env.ALCHEMY_BUNDLER_URL;
  if (explicit) return explicit;
  const key = process.env.ALCHEMY_API_KEY;
  if (!key) throw new Error('ALCHEMY_API_KEY not set');
  // Polygon Amoy
  return `https://polygon-amoy.g.alchemy.com/v2/${key}`;
}

function isConfigured() {
  return Boolean(process.env.ALCHEMY_API_KEY && process.env.ALCHEMY_GAS_MANAGER_POLICY_ID);
}

async function sendUserOperation({ userOp, entryPoint }) {
  if (!isConfigured()) {
    throw new Error('AA not configured: missing ALCHEMY_API_KEY or ALCHEMY_GAS_MANAGER_POLICY_ID');
  }
  if (!userOp || !entryPoint) {
    throw new Error('userOp and entryPoint are required');
  }
  const url = getBundlerUrl();
  const policyId = process.env.ALCHEMY_GAS_MANAGER_POLICY_ID;
  const body = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'eth_sendUserOperation',
    params: [userOp, entryPoint]
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json',
      'Alchemy-Gas-Policy-ID': policyId
    },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (json.error) {
    const msg = json.error?.message || 'Bundler error';
    const code = json.error?.code;
    const data = json.error?.data;
    throw new Error(`Alchemy bundler error (${code}): ${msg}${data ? ` | ${JSON.stringify(data)}` : ''}`);
  }
  return json.result;
}

module.exports = {
  isConfigured,
  sendUserOperation,
};


