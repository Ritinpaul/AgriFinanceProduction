const { Web3Storage, File: Web3File } = require('web3.storage');

function isConfigured() {
  return Boolean(process.env.WEB3_STORAGE_TOKEN);
}

function getClient() {
  if (!isConfigured()) {
    throw new Error('WEB3_STORAGE_TOKEN is not set');
  }
  return new Web3Storage({ token: process.env.WEB3_STORAGE_TOKEN });
}

async function uploadBuffer(buffer, filename, contentType = 'application/octet-stream') {
  const client = getClient();
  const file = new Web3File([buffer], filename, { type: contentType });
  const cid = await client.put([file], { wrapWithDirectory: false });
  return { cid, uri: `ipfs://${cid}`, gatewayUrl: `https://w3s.link/ipfs/${cid}`, provider: 'web3.storage' };
}

async function uploadJson(jsonObject, filename = 'metadata.json') {
  const buffer = Buffer.from(JSON.stringify(jsonObject, null, 2));
  return uploadBuffer(buffer, filename, 'application/json');
}

module.exports = {
  uploadBuffer,
  uploadJson,
  isConfigured,
};


