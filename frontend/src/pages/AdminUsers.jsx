import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import { UserPlus, Pencil, Trash2, Shield, UserCog, User } from 'lucide-react';

const ROLES = [
  { value: 'ADMIN', label: 'Admin', icon: Shield },
  { value: 'KIDEMLI_MUHENDIS', label: 'Kıdemli Teknisyen', icon: UserCog },
  { value: 'SAHA_MUHENDISI', label: 'Teknisyen / Bakımcı', icon: User },
];

export function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    username: '',
    email: '',
    name: '',
    password: '',
    role: 'SAHA_MUHENDISI',
  });

  const loadUsers = async () => {
    try {
      const list = await api.admin.users.list();
      setUsers(list);
    } catch (e) {
      setError(e.message || 'Kullanıcılar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const resetForm = () => {
    setForm({
      username: '',
      email: '',
      name: '',
      password: '',
      role: 'SAHA_MUHENDISI',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (u) => {
    setForm({
      username: u.username,
      email: u.email,
      name: u.name,
      password: '',
      role: u.role,
    });
    setEditingId(u.id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.username?.trim() || !form.email?.trim() || !form.name?.trim()) {
      setError('Kullanıcı adı, e-posta ve ad soyad zorunludur.');
      return;
    }
    if (!editingId && !form.password?.trim()) {
      setError('Yeni kullanıcı için şifre zorunludur.');
      return;
    }
    try {
      if (editingId) {
        await api.admin.users.update(editingId, {
          username: form.username.trim(),
          email: form.email.trim(),
          name: form.name.trim(),
          role: form.role,
          ...(form.password?.trim() ? { password: form.password } : {}),
        });
      } else {
        await api.admin.users.create({
          username: form.username.trim(),
          email: form.email.trim(),
          name: form.name.trim(),
          password: form.password.trim(),
          role: form.role,
        });
      }
      await loadUsers();
      resetForm();
    } catch (e) {
      setError(e.message || 'İşlem başarısız.');
    }
  };

  const handleDelete = async (id, name) => {
    if (id === user?.id) {
      setError('Kendi hesabınızı silemezsiniz.');
      return;
    }
    if (!window.confirm(`"${name}" kullanıcısını silmek istediğinize emin misiniz?`)) return;
    try {
      await api.admin.users.delete(id);
      await loadUsers();
      setError('');
    } catch (e) {
      setError(e.message || 'Silme işlemi başarısız.');
    }
  };

  const getRoleLabel = (role) => ROLES.find((r) => r.value === role)?.label || role;

  if (user?.role !== 'ADMIN') {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700">
          Bu sayfaya erişim yetkiniz yok.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Kullanıcı Yönetimi</h1>
          <p className="text-sm text-slate-500 mt-1">Yeni kullanıcı ekleyin ve mevcut kullanıcıları yönetin.</p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Yeni Kullanıcı
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-medium text-slate-800 mb-4">
            {editingId ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı Ekle'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kullanıcı adı</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="ornek"
                required
                disabled={!!editingId}
              />
              {editingId && (
                <p className="text-xs text-slate-500 mt-1">Kullanıcı adı değiştirilemez.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-posta</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="ornek@factory.local"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ad Soyad</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Örnek Kullanıcı"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Şifre {editingId && '(boş bırakırsanız değişmez)'}
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder={editingId ? '••••••••' : 'En az 6 karakter'}
                required={!editingId}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
              <div className="flex flex-wrap gap-3">
                {ROLES.map((r) => (
                  <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value={r.value}
                      checked={form.role === r.value}
                      onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                      className="rounded-full border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-700">{r.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
              >
                {editingId ? 'Güncelle' : 'Oluştur'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Yükleniyor...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-700">Kullanıcı adı</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-700">Ad Soyad</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-700">E-posta</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-700">Rol</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-700">Durum</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-700">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-slate-800">{u.username}</td>
                    <td className="px-4 py-3 text-slate-700">{u.name}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          'inline-flex px-2 py-0.5 rounded text-xs font-medium ' +
                          (u.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-800'
                            : u.role === 'KIDEMLI_MUHENDIS'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700')
                        }
                      >
                        {getRoleLabel(u.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          'inline-flex px-2 py-0.5 rounded text-xs font-medium ' +
                          (u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')
                        }
                      >
                        {u.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(u)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                          title="Düzenle"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(u.id, u.name)}
                          disabled={u.id === user?.id}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-red-100 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
