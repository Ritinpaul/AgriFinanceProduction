import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const AdminSignUp = () => {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirm: '',
    token: ''
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/signup-open');
        const j = await res.json();
        setAllowed(Boolean(j.allowed));
      } catch {}
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-300">Checking status…</div>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (!allowed) {
      toast.error('Admin signup is closed');
      return;
    }
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(form.token ? { 'x-admin-signup-token': form.token } : {})
        },
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          password: form.password,
          role: 'admin'
        })
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || 'Failed');
        return;
      }
      toast.success('Admin created. Please sign in.');
      navigate('/signin');
    } catch (e) {
      toast.error('Request failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Create Admin</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">This page is temporary. Close after creating one admin.</p>

        {!allowed && (
          <div className="mb-4 text-red-600 dark:text-red-400 text-sm">Admin signup is currently disabled.</div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input className="form-input" placeholder="First name" value={form.first_name} onChange={e=>setForm({...form, first_name:e.target.value})} required />
            <input className="form-input" placeholder="Last name" value={form.last_name} onChange={e=>setForm({...form, last_name:e.target.value})} required />
          </div>
          <input className="form-input" type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} required />
          <input className="form-input" type="password" placeholder="Password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} required />
          <input className="form-input" type="password" placeholder="Confirm password" value={form.confirm} onChange={e=>setForm({...form, confirm:e.target.value})} required />
          <input className="form-input" placeholder="One-time token (if provided)" value={form.token} onChange={e=>setForm({...form, token:e.target.value})} />
          <button disabled={!allowed} className="w-full bg-green-600 hover:bg-green-700 text-white rounded-lg py-2 disabled:bg-gray-400">Create Admin</button>
        </form>
      </div>
    </div>
  );
};

export default AdminSignUp;


