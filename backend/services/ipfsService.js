// Simple IPFS service using Web3.Storage HTTP API
// Requires: WEB3_STORAGE_TOKEN in environment

const fetch = require('node-fetch');

class IPFSService {
	constructor() {
		this.token = process.env.WEB3_STORAGE_TOKEN || '';
		this.endpoint = 'https://api.web3.storage/upload';
	}

	isConfigured() {
		return Boolean(this.token);
	}

	async uploadBuffer(buffer, filename, metadata = {}) {
		if (!this.isConfigured()) {
			throw new Error('WEB3_STORAGE_TOKEN not set');
		}
		const formBoundary = '----agriForm' + Math.random().toString(16).slice(2);
		const dashdash = `--${formBoundary}`;
		const crlf = '\r\n';
		const fileHeader =
			`${dashdash}${crlf}` +
			`Content-Disposition: form-data; name="file"; filename="${filename || 'document.bin'}"${crlf}` +
			`Content-Type: application/octet-stream${crlf}${crlf}`;
		const fileFooter = `${crlf}${dashdash}--${crlf}`;
		const headBuffer = Buffer.from(fileHeader, 'utf8');
		const footBuffer = Buffer.from(fileFooter, 'utf8');
		const bodyBuffer = Buffer.concat([headBuffer, buffer, footBuffer]);

		const res = await fetch(this.endpoint, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.token}`,
				'Content-Type': `multipart/form-data; boundary=${formBoundary}`
			},
			body: bodyBuffer
		});
		if (!res.ok) {
			const text = await res.text();
			throw new Error(`IPFS upload failed: ${res.status} ${text}`);
		}
		const json = await res.json();
		// web3.storage returns { cid: '...' }
		return {
			cid: json.cid,
			url: `ipfs://${json.cid}`,
			gatewayUrl: `https://w3s.link/ipfs/${json.cid}`,
			metadata
		};
	}
}

module.exports = new IPFSService();
