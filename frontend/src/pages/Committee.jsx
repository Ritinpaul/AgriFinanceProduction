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

export default function Committee() {
    const [stakeAmt, setStakeAmt] = useState('100');
    const [members, setMembers] = useState([]);
    const [requests, setRequests] = useState([]);
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);
    const [policy, setPolicy] = useState({ minScore: 0, approvalsThreshold: 2 });
    const [scores, setScores] = useState({});
    const [slashes, setSlashes] = useState([]);

    const load = async () => {
        setLoading(true);
        setErr('');
        try {
            const m = await api('/committee/members');
            setMembers(m.members || []);
            const r = await api('/loans/requests?status=pending');
            setRequests(r.requests || []);
            const pol = await api('/credit/policy');
            setPolicy(pol);
            // fetch scores for borrower_ids
            const scoreEntries = await Promise.all((r.requests||[]).map(async (req)=>{
                try {
                    const s = await api(`/credit/score/${req.borrower_id}`);
                    return [req.borrower_id, s.score];
                } catch { return [req.borrower_id, null]; }
            }));
            setScores(Object.fromEntries(scoreEntries));
            try { const sl = await api('/committee/slashes'); setSlashes(sl.slashes || []);} catch {}
        } catch (e) { setErr(e.message); } finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    const stake = async () => {
        setMsg(''); setErr('');
        if (!stakeAmt || isNaN(Number(stakeAmt)) || Number(stakeAmt) <= 0) { setErr('Enter valid amount'); return; }
        try {
            const wei = (parseFloat(stakeAmt) * 1_000_000).toFixed(0);
            await api('/committee/stake', { method: 'POST', body: { amountWei: wei } });
            setMsg('Staked successfully');
            await load();
        } catch (e) { setErr(e.message); }
    };

    const vote = async (requestId, decision) => {
        setMsg(''); setErr('');
        try {
            await api('/loans/approve-request', { method: 'POST', body: { requestId, decision } });
            setMsg('Vote recorded');
            await load();
        } catch (e) { setErr(e.message); }
    };

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Committee</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Stake, view members, and vote on unsecured loan requests.</p>
            </div>
            {err && <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">{err}</div>}
            {msg && <div className="mb-4 p-4 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">{msg}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Stake</h2>
                    <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">Amount (KRSI)</label>
                    <input value={stakeAmt} onChange={(e)=>setStakeAmt(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"/>
                    <button onClick={stake} className="mt-3 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition">Stake</button>
                </div>

                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Pending Requests</h2>
                        <button onClick={load} disabled={loading} className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition">{loading?'Refreshing…':'Refresh'}</button>
                    </div>
                    {requests.length===0 ? (
                        <div className="text-gray-500 dark:text-gray-400 text-sm">No pending requests.</div>
                    ) : (
                        <div className="space-y-3">
                            {requests.map((r)=> (
                                <div key={r.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-between">
                                    <div className="text-sm text-gray-800 dark:text-gray-200">
                                        <div className="font-medium">Request #{r.id}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Principal: {(Number(r.principal_wei)/1_000_000).toLocaleString()} KRSI</div>
                                        {r.loan_term_days && <div className="text-xs text-gray-500 dark:text-gray-400">Term: {r.loan_term_days} days</div>}
                                        {r.loan_category && <div className="text-xs text-gray-500 dark:text-gray-400">Category: {r.loan_category}</div>}
                                        {r.reason_text && <div className="text-xs text-gray-500 dark:text-gray-400">Reason: {r.reason_text}</div>}
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Approvals: {r.approvals} • Rejections: {r.rejections}</div>
                                        <div className="text-xs mt-1">
                                            <span className={`px-2 py-0.5 rounded ${ (scores[r.borrower_id] ?? 0) >= policy.minScore ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' }`}>
                                                Score {scores[r.borrower_id] ?? '—'} { (scores[r.borrower_id] ?? 0) >= policy.minScore ? '(eligible)' : `(needs ≥ ${policy.minScore})` }
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={()=>vote(r.id,'approve')} className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded">Approve</button>
                                        <button onClick={()=>vote(r.id,'reject')} className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded">Reject</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Members</h2>
                    {members.length===0 ? (
                        <div className="text-gray-500 dark:text-gray-400 text-sm">No members yet.</div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {members.map((m)=> (
                                <div key={m.user_id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                                    <div className="text-sm text-gray-800 dark:text-gray-200 font-medium">{m.user_id}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Staked: {(Number(m.staked_wei)/1_000_000).toLocaleString()} KRSI</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Your Slashing Events</h2>
                    {slashes.length === 0 ? (
                        <div className="text-gray-500 dark:text-gray-400 text-sm">No slashing events.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-500">
                                        <th className="py-2">When</th>
                                        <th className="py-2">Loan</th>
                                        <th className="py-2">Amount</th>
                                        <th className="py-2">Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {slashes.map((s)=> (
                                        <tr key={s.id} className="border-t border-gray-200 dark:border-gray-700">
                                            <td className="py-2">{new Date(s.created_at).toLocaleString()}</td>
                                            <td className="py-2">#{s.loan_id}</td>
                                            <td className="py-2">{(Number(s.amount_wei)/1_000_000).toLocaleString()} KRSI</td>
                                            <td className="py-2">{s.reason}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


