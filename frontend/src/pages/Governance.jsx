import React, { useEffect, useState } from 'react';

const api = async (path, opts = {}) => {
	const token = localStorage.getItem('auth_token');
	const res = await fetch(`/api${path}`, {
		method: opts.method || 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: token ? `Bearer ${token}` : undefined,
		},
		body: opts.body ? JSON.stringify(opts.body) : undefined,
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(text || 'Request failed');
	}
	return res.json();
};

export default function Governance() {
	const [loading, setLoading] = useState(false);
	const [proposals, setProposals] = useState([]);
	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');

	const load = async () => {
		setLoading(true);
		setError('');
		try {
			const data = await api('/dao/proposals');
			setProposals(data.proposals || []);
		} catch (e) {
			setError(e.message);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	const createProposal = async () => {
		if (!title.trim()) {
			setError('Title is required');
			return;
		}
		setLoading(true);
		setError('');
		setSuccess('');
		try {
			await api('/dao/proposals', { method: 'POST', body: { title, description } });
			setTitle('');
			setDescription('');
			setSuccess('Proposal created');
			await load();
		} catch (e) {
			setError(e.message);
		} finally {
			setLoading(false);
		}
	};

	const vote = async (id, support) => {
		setLoading(true);
		setError('');
		setSuccess('');
		try {
			await api(`/dao/proposals/${id}/vote`, { method: 'POST', body: { support } });
			setSuccess('Vote recorded');
			await load();
		} catch (e) {
			setError(e.message);
		} finally {
			setLoading(false);
		}
	};

	const execute = async (id) => {
		setLoading(true);
		setError('');
		setSuccess('');
		try {
			await api(`/dao/proposals/${id}/execute`, { method: 'POST' });
			setSuccess('Proposal executed');
			await load();
		} catch (e) {
			setError(e.message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="max-w-3xl mx-auto p-4">
			<h1 className="text-2xl font-bold mb-4">Governance</h1>
			{error && <div className="mb-3 text-red-600">{error}</div>}
			{success && <div className="mb-3 text-green-600">{success}</div>}

			<div className="bg-white dark:bg-gray-800 rounded border p-4 mb-6">
				<h2 className="font-semibold mb-2">Create Proposal</h2>
				<input
					type="text"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="Title"
					className="w-full border rounded px-3 py-2 mb-2 dark:bg-gray-700"
				/>
				<textarea
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder="Description (optional)"
					className="w-full border rounded px-3 py-2 mb-2 dark:bg-gray-700"
				/>
				<button onClick={createProposal} disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded">
					{loading ? 'Submitting...' : 'Submit Proposal'}
				</button>
			</div>

			<div className="bg-white dark:bg-gray-800 rounded border p-4">
				<h2 className="font-semibold mb-3">Proposals</h2>
				{loading && <div>Loading...</div>}
				{!loading && proposals.length === 0 && <div>No proposals yet.</div>}
				<ul className="space-y-3">
					{proposals.map((p) => (
						<li key={p.id} className="border rounded p-3">
							<div className="flex justify-between items-center">
								<div>
									<div className="font-semibold">{p.title}</div>
									<div className="text-sm text-gray-500">Status: {p.status}</div>
								</div>
								<div className="text-sm">
									For: {p.votes_for || 0} | Against: {p.votes_against || 0}
								</div>
							</div>
							<div className="mt-2 text-sm whitespace-pre-wrap">{p.description}</div>
							<div className="mt-3 flex gap-2">
								<button onClick={() => vote(p.id, true)} disabled={loading} className="px-3 py-1 bg-blue-600 text-white rounded">Vote For</button>
								<button onClick={() => vote(p.id, false)} disabled={loading} className="px-3 py-1 bg-gray-600 text-white rounded">Vote Against</button>
								<button onClick={() => execute(p.id)} disabled={loading || p.status !== 'active'} className="px-3 py-1 bg-purple-600 text-white rounded">Execute</button>
							</div>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
