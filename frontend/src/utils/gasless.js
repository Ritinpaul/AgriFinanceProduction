// Minimal gasless transaction wrapper placeholder
// Integrate with a paymaster/relayer (e.g., Biconomy/Pimlico) later

export class GaslessClient {
  constructor(config = {}) {
    this.relayerUrl = config.relayerUrl || null;
    this.apiKey = config.apiKey || null;
  }

  isConfigured() {
    return Boolean(this.relayerUrl && this.apiKey);
  }

  // For demo, we just throw if not configured and ask caller to fallback
  async sendTransaction(request) {
    if (!this.isConfigured()) {
      throw new Error('Gasless relayer not configured');
    }

    const res = await fetch(this.relayerUrl + '/relay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error('Relayer error: ' + text);
    }

    return await res.json();
  }
}

export const gaslessClient = new GaslessClient({
  relayerUrl: import.meta.env.VITE_GASLESS_RELAYER_URL,
  apiKey: import.meta.env.VITE_GASLESS_API_KEY,
});


