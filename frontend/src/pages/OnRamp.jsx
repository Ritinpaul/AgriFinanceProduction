import React, { useState } from 'react';

const api = async (path, opts = {}) => {
    const base = import.meta.env.VITE_API_BASE || '';
	const token = localStorage.getItem('auth_token');
    const res = await fetch(`${base}/api${path}`, {
		method: opts.method || 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: token ? `Bearer ${token}` : undefined,
		},
		body: opts.body ? JSON.stringify(opts.body) : undefined,
	});
	const text = await res.text();
	if (!res.ok) throw new Error(text || 'Request failed');
	try { return JSON.parse(text); } catch { return {}; }
};

export default function OnRamp() {
    const [amount, setAmount] = useState('10');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

	const mint = async () => {
		setMessage(''); setError('');
		if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
			setError('Enter a valid positive amount');
			return;
		}
		setIsSubmitting(true);
		try {
			const wei = (parseFloat(amount || '0') * 1_000_000).toFixed(0);
			const res = await api('/onramp/intent', { method: 'POST', body: { amountWei: wei } });
			setMessage(`Minted ${amount} KRSI. tx: ${res.txHash || 'queued'}`);
		} catch (e) {
			setError(e.message);
		} finally {
			setIsSubmitting(false);
		}
	};

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">On-Ramp (Sandbox)</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Mint test KRSI to explore AgriFinance features end-to-end.</p>
            </div>

            {message && (
                <div className="mb-4 p-4 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                    {message}
                </div>
            )}
            {error && (
                <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Mint KRSI</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="md:col-span-2">
                            <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">Amount (KRSI)</label>
                            <input 
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)} 
                                placeholder="e.g. 50"
                                inputMode="decimal"
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                        </div>
                        <button 
                            onClick={mint} 
                            disabled={isSubmitting}
                            className="px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg transition"
                        >
                            {isSubmitting ? 'Minting…' : 'Mint KRSI'}
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">Testnet-only. Platform signer must be configured in environment.</p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-800 dark:to-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Tips</h3>
                    <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2 list-disc list-inside">
                        <li>Use minted KRSI to buy NFTs and test loans/liquidity.</li>
                        <li>Mint is capped to prevent abuse.</li>
                        <li>If mint fails, verify your session is active.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
