import { useEffect, useState } from 'react'
import client from '../api/client'
import { useToastStore } from '../stores/toastStore'

const EMPTY = { name: '', gender: '', class_id: '', student_no: '' }

export default function StudentFormModal({ open, mode, initial, classOptions, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const showToast = useToastStore(s => s.show)

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && initial) {
      setForm({
        name: initial.name || '',
        gender: initial.gender || '',
        class_id: initial.class_id ? String(initial.class_id) : '',
        student_no: initial.student_no || ''
      })
    } else {
      setForm(EMPTY)
    }
  }, [open, mode, initial])

  if (!open) return null

  const update = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return showToast('请填写姓名', 'error')
    if (!form.class_id) return showToast('请选择班级', 'error')

    setSubmitting(true)
    try {
      const payload = {
        name: form.name.trim(),
        gender: form.gender || null,
        class_id: Number(form.class_id),
        student_no: form.student_no.trim() || null
      }
      const res = mode === 'edit'
        ? await client.put(`/students/${initial.id}`, payload)
        : await client.post('/students', payload)
      showToast(mode === 'edit' ? '已更新' : '已新增', 'success')
      onSaved(res.data)
    } catch (err) {
      // Toast already shown by interceptor; nothing more to do
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-xl shadow-xl w-[420px] max-w-[90vw] p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">
          {mode === 'edit' ? '编辑学生' : '新增学生'}
        </h2>
        <form onSubmit={submit} className="space-y-4">
          <Field label="姓名" required>
            <input
              value={form.name}
              onChange={update('name')}
              maxLength={50}
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>

          <Field label="性别">
            <div className="flex gap-4 text-sm">
              {[
                { value: '', label: '未填' },
                { value: 'M', label: '男' },
                { value: 'F', label: '女' }
              ].map(opt => (
                <label key={opt.value || 'none'} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    value={opt.value}
                    checked={form.gender === opt.value}
                    onChange={update('gender')}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </Field>

          <Field label="班级" required>
            <select
              value={form.class_id}
              onChange={update('class_id')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">请选择班级</option>
              {classOptions.map(c => (
                <option key={c.class_id} value={c.class_id}>
                  {c.grade_name} · {c.class_name}
                </option>
              ))}
            </select>
            {classOptions.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">暂无可选班级,请先创建年级与班级</p>
            )}
          </Field>

          <Field label="学号">
            <input
              value={form.student_no}
              onChange={update('student_no')}
              maxLength={32}
              placeholder="可选"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
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
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
