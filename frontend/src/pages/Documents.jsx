import React, { useEffect, useState } from 'react';

const api = async (path, opts = {}) => {
    const base = import.meta.env.VITE_API_BASE || '';
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`${base}/api${path}`, {
        method: opts.method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : undefined,
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text || 'Request failed');
    try { return JSON.parse(text); } catch { return {}; }
};

export default function Documents() {
    const [files, setFiles] = useState([]);
    const [title, setTitle] = useState('');
    const [meta, setMeta] = useState('');
    const [file, setFile] = useState(null);
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    const load = async () => {
        setLoading(true);
        setErr('');
        try {
            const data = await api('/docs/mine');
            setFiles(data.documents || []);
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const upload = async () => {
        setMsg(''); setErr('');
        if (!file) { setErr('Choose a file'); return; }
        setUploading(true);
        try {
            const toBase64 = (f) => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve((reader.result || '').toString().split(',').pop());
                reader.onerror = reject;
                reader.readAsDataURL(f);
            });
            const fileBase64 = await toBase64(file);
            let metadataPayload = undefined;
            if (meta) {
                try { metadataPayload = JSON.parse(meta); } catch { metadataPayload = meta; }
            }
            await api('/docs/upload', { 
                method: 'POST', 
                body: { 
                    fileBase64, 
                    filename: file.name, 
                    title, 
                    mimeType: file.type || undefined, 
                    metadata: metadataPayload 
                } 
            });
            setMsg('Uploaded successfully');
            setTitle(''); setMeta(''); setFile(null);
            await load();
        } catch (e) {
            setErr(e.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Documents</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Securely upload and manage your farm and identity documents.</p>
            </div>

            {err && <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">{err}</div>}
            {msg && <div className="mb-4 p-4 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">{msg}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Upload Document</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">Title</label>
                            <input 
                                value={title} 
                                onChange={(e) => setTitle(e.target.value)} 
                                placeholder="e.g. Land Ownership Certificate"
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500" 
                            />
                        </div>
                        <div>
                            <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">Metadata (optional)</label>
                            <input 
                                value={meta} 
                                onChange={(e) => setMeta(e.target.value)} 
                                placeholder='{"type":"land","region":"KA"}'
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500" 
                            />
                        </div>
                        <div>
                            <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">File</label>
                            <input 
                                type="file" 
                                onChange={(e) => setFile(e.target.files?.[0] || null)} 
                                className="w-full text-sm text-gray-700 dark:text-gray-300"
                            />
                        </div>
                        <button 
                            onClick={upload}
                            disabled={uploading}
                            className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg transition"
                        >
                            {uploading ? 'Uploading…' : 'Upload'}
                        </button>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Files are stored via IPFS and linked to your account.</p>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your Documents</h2>
                        <button onClick={load} disabled={loading} className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition">
                            {loading ? 'Refreshing…' : 'Refresh'}
                        </button>
                    </div>
                    {files.length === 0 ? (
                        <div className="text-gray-500 dark:text-gray-400 text-sm">No documents yet.</div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {files.map((doc) => (
                                <div key={doc.id} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{doc.title || 'Untitled'}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">CID: {doc.cid || '—'}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Uploaded: {doc.created_at ? new Date(doc.created_at).toLocaleString() : '—'}</div>
                                    {doc.cid && (
                                        <a 
                                            href={doc.gateway_url || `https://ipfs.io/ipfs/${doc.cid}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-block mt-3 text-xs text-green-700 dark:text-green-400 hover:underline"
                                        >
                                            View on IPFS
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


