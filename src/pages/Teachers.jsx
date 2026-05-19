import { useEffect, useState } from 'react'
import { usersApi } from '../api/users'
import { useToastStore } from '../stores/toastStore'
import StatCard from '../components/StatCard'

export default function Teachers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState({ open: false, mode: 'create', data: null })
  const [roleFilter, setRoleFilter] = useState('')
  const showToast = useToastStore(s => s.show)

  useEffect(() => { loadUsers() }, [roleFilter])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const { data } = await usersApi.list(roleFilter ? { role: roleFilter } : {})
      setUsers(data)
    } catch (err) {
      console.error('Failed to load users:', err)
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => setModal({ open: true, mode: 'create', data: null })
  const openEdit = (user) => setModal({ open: true, mode: 'edit', data: user })
  const closeModal = () => setModal({ open: false, mode: 'create', data: null })

  const handleSaved = () => { closeModal(); loadUsers() }

  const handleDelete = (user) => async (e) => {
    e.preventDefault()
    if (!confirm(`确认删除用户「${user.name}」（${user.username}）？\n此操作不可恢复。`)) return
    try {
      await usersApi.remove(user.id)
      showToast('已删除', 'success')
      loadUsers()
    } catch {}
  }

  if (loading) return <div className="text-gray-500">加载中...</div>

  const teachers = users.filter(u => u.role === 'teacher')
  const admins = users.filter(u => u.role === 'admin')

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">用户管理</h1>
          <p className="text-gray-500 text-sm mt-1">管理员可创建、编辑教师账号</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + 新增用户
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="教师数量" value={teachers.length} unit="人" />
        <StatCard label="管理员数量" value={admins.length} unit="人" />
        <StatCard label="用户总数" value={users.length} unit="人" />
      </div>

      <div className="flex items-center gap-4 mb-4">
        <label className="text-sm text-gray-600">筛选角色:</label>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全部</option>
          <option value="teacher">教师</option>
          <option value="admin">管理员</option>
        </select>
        <span className="text-sm text-gray-500">共 {users.length} 人</span>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">姓名</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">用户名</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">角色</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">学校</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">创建时间</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">暂无数据</td></tr>
            )}
            {users.map(user => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{user.name}</td>
                <td className="px-4 py-3 text-gray-500">{user.username}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 text-xs rounded ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {user.role === 'admin' ? '管理员' : '教师'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{user.school_name || '—'}</td>
                <td className="px-4 py-3 text-gray-400">{user.created_at?.slice(0, 10)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEdit(user)}
                      className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50"
                    >
                      ✎ 编辑
                    </button>
                    {user.role !== 'admin' && (
                      <button
                        onClick={handleDelete(user)}
                        className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-red-50 hover:border-red-200 hover:text-red-500"
                      >
                        ✕ 删除
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal.open && (
        <UserModal
          mode={modal.mode}
          user={modal.data}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

function UserModal({ mode, user, onClose, onSaved }) {
  const [form, setForm] = useState({
    username: user?.username || '',
    password: '',
    name: user?.name || '',
    role: user?.role || 'teacher',
  })
  const [submitting, setSubmitting] = useState(false)
  const showToast = useToastStore(s => s.show)

  const update = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.username.trim() || form.username.trim().length < 2) { showToast('用户名至少2个字符', 'error'); return }
    if (mode === 'create' && form.password.length < 6) { showToast('密码至少6个字符', 'error'); return }
    if (!form.name.trim()) { showToast('姓名不能为空', 'error'); return }

    setSubmitting(true)
    try {
      const payload = {
        username: form.username.trim(),
        name: form.name.trim(),
        role: form.role,
        ...(form.password ? { password: form.password } : {}),
      }
      if (mode === 'edit') {
        await usersApi.update(user.id, payload)
        showToast('已更新', 'success')
      } else {
        await usersApi.create(payload)
        showToast('已创建', 'success')
      }
      onSaved()
    } catch {}
    finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center" onMouseDown={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-[420px] max-w-[90vw] p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">
          {mode === 'edit' ? '编辑用户' : '新增用户'}
        </h2>
        <form onSubmit={submit} className="space-y-4">
          <Field label="用户名" required>
            <input
              value={form.username}
              onChange={update('username')}
              disabled={mode === 'edit'}
              maxLength={32}
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
            />
          </Field>

          <Field label={mode === 'edit' ? '新密码（留空则不变）' : '密码'} required={mode === 'create'}>
            <input
              type="password"
              value={form.password}
              onChange={update('password')}
              maxLength={32}
              placeholder={mode === 'edit' ? '留空保持不变' : '至少6个字符'}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>

          <Field label="姓名" required>
            <input
              value={form.name}
              onChange={update('name')}
              maxLength={50}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>

          <Field label="角色" required>
            <select
              value={form.role}
              onChange={update('role')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="teacher">教师</option>
              <option value="admin">管理员</option>
            </select>
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">取消</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {submitting ? '保存中…' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
