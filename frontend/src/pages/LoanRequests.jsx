import React, { useEffect, useState } from 'react';

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

export default function LoanRequests() {
    const [principal, setPrincipal] = useState('500');
    const [requests, setRequests] = useState([]);
    const [score, setScore] = useState(null);
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('');
    const [explain, setExplain] = useState(null);
    const [showExplain, setShowExplain] = useState(false);
    const [loanTermDays, setLoanTermDays] = useState('180');
    const [loanCategory, setLoanCategory] = useState('operations');
    const [reasonText, setReasonText] = useState('');
    const [isAgri, setIsAgri] = useState(true);

    const load = async () => {
        setLoading(true);
        setErr('');
        try {
            const q = filter ? `?status=${encodeURIComponent(filter)}` : '';
            const r = await api(`/loans/requests${q}`);
            setRequests(r.requests || []);
            const s = await api('/credit/score/cached');
            setScore(s.score);
        } catch (e) { setErr(e.message); } finally { setLoading(false); }
    };
    useEffect(() => { load(); }, [filter]);

    const createReq = async () => {
        setMsg(''); setErr('');
        if (!principal || isNaN(Number(principal)) || Number(principal) <= 0) { setErr('Enter valid amount'); return; }
        try {
            const wei = (parseFloat(principal) * 1_000_000).toFixed(0);
            await api('/loans/request-unsecured', { method: 'POST', body: { principalWei: wei, loanTermDays: loanTermDays ? Number(loanTermDays) : null, loanCategory, reasonText, isAgri } });
            setMsg('Request created');
            setPrincipal('');
            await load();
        } catch (e) { setErr(e.message); }
    };

    const finalize = async (id) => {
        setMsg(''); setErr('');
        try {
            await api('/loans/finalize-request', { method: 'POST', body: { requestId: id } });
            setMsg('Finalized');
            await load();
        } catch (e) { setErr(e.message); }
    };

    const loadExplain = async () => {
        setErr('');
        try {
            const data = await api('/credit/score/explain');
            setExplain(data);
            setShowExplain(true);
        } catch (e) { setErr(e.message); }
    };

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Loan Requests</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Create unsecured loan requests and track approvals.</p>
            </div>
            {err && <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">{err}</div>}
            {msg && <div className="mb-4 p-4 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">{msg}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Your Credit Score</h2>
                    {score === null ? (
                        <div className="text-sm text-gray-500 dark:text-gray-400">Loading…</div>
                    ) : (
                        <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{score}</div>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Higher scores may be required to finalize unsecured loans.</p>
                    <button onClick={loadExplain} className="mt-3 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded">Why is my score?</button>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Create Request</h2>
                    <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">Principal (KRSI)</label>
                    <input value={principal} onChange={(e)=>setPrincipal(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"/>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                            <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">Loan Term (days)</label>
                            <input value={loanTermDays} onChange={(e)=>setLoanTermDays(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700"/>
                        </div>
                        <div>
                            <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">Category</label>
                            <select value={loanCategory} onChange={(e)=>setLoanCategory(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 text-gray-800 dark:text-gray-100">
                                <option value="operations">Operations</option>
                                <option value="machinery">Machinery</option>
                                <option value="land">Land</option>
                                <option value="storage">Storage</option>
                                <option value="marketing">Marketing</option>
                                <option value="expansion">Expansion</option>
                            </select>
                        </div>
                    </div>
                    <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300 mt-3">Why do you need this loan? (optional)</label>
                    <textarea value={reasonText} onChange={(e)=>setReasonText(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700" rows={3} />
                    <div className="flex items-center gap-2 mt-3">
                        <input id="isAgri" type="checkbox" checked={isAgri} onChange={(e)=>setIsAgri(e.target.checked)} className="form-checkbox" />
                        <label htmlFor="isAgri" className="text-sm text-gray-700 dark:text-gray-300">Loan for agriculture (eligible for special terms)</label>
                    </div>
                    <button onClick={createReq} className="mt-3 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition">Create</button>
                </div>

                <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Guidance</h2>
                    <ul className="text-sm text-gray-700 dark:text-gray-300 list-disc list-inside space-y-1">
                        <li>Committee approvals and a minimum score are required to finalize.</li>
                        <li>Upload documents and repay on time to increase your score.</li>
                        <li>You can request again if this one is rejected.</li>
                    </ul>
                </div>

                <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Requests</h2>
                        <div className="flex items-center gap-2">
                            <select value={filter} onChange={(e)=>setFilter(e.target.value)} className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-700 text-gray-800 dark:text-gray-100">
                                <option value="">All</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                            </select>
                            <button onClick={load} disabled={loading} className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition">{loading?'Refreshing…':'Refresh'}</button>
                        </div>
                    </div>
                    {requests.length===0 ? (
                        <div className="text-gray-500 dark:text-gray-400 text-sm">No requests yet.</div>
                    ) : (
                        <div className="space-y-3">
                            {requests.map((r)=> (
                                <div key={r.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-between">
                                    <div className="text-sm text-gray-800 dark:text-gray-200">
                                        <div className="font-medium">Request #{r.id} • {r.status}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Principal: {(Number(r.principal_wei)/1_000_000).toLocaleString()} KRSI</div>
                                        {r.loan_term_days && <div className="text-xs text-gray-500 dark:text-gray-400">Term: {r.loan_term_days} days</div>}
                                        {r.loan_category && <div className="text-xs text-gray-500 dark:text-gray-400">Category: {r.loan_category}</div>}
                                        {r.reason_text && <div className="text-xs text-gray-500 dark:text-gray-400">Reason: {r.reason_text}</div>}
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Approvals: {r.approvals} • Rejections: {r.rejections}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {r.status==='pending' && (
                                            <span className="text-xs text-gray-500">Awaiting approvals…</span>
                                        )}
                                        {r.status==='pending' || r.status==='approved' ? (
                                            <button onClick={()=>finalize(r.id)} className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded">Finalize</button>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showExplain && explain && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Score Explanation</h3>
                        <button onClick={()=>setShowExplain(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">✕</button>
                    </div>
                    <div className="text-sm text-gray-800 dark:text-gray-200 space-y-2">
                        <div>Score: <span className="font-semibold">{explain.score}</span></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded bg-gray-50 dark:bg-gray-700/40">
                                <div className="text-xs text-gray-500">Documents</div>
                                <div className="text-sm">{explain.components.docs.count} × w{explain.components.docs.weight}</div>
                            </div>
                            <div className="p-3 rounded bg-gray-50 dark:bg-gray-700/40">
                                <div className="text-xs text-gray-500">Repayments (wei)</div>
                                <div className="text-sm">{explain.components.repayments.amountWei} × w{explain.components.repayments.weight}</div>
                            </div>
                            <div className="p-3 rounded bg-gray-50 dark:bg-gray-700/40">
                                <div className="text-xs text-gray-500">Approvals</div>
                                <div className="text-sm">{explain.components.approvals.count} × w{explain.components.approvals.weight}</div>
                            </div>
                            <div className="p-3 rounded bg-gray-50 dark:bg-gray-700/40">
                                <div className="text-xs text-gray-500">Purchases</div>
                                <div className="text-sm">{explain.components.purchases.count} × w{explain.components.purchases.weight}</div>
                            </div>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">Policy: min score {explain.policy.minScore}, approvals threshold {explain.policy.approvalsThreshold}</div>
                    </div>
                </div>
            </div>
            )}
        </div>
    );
}


