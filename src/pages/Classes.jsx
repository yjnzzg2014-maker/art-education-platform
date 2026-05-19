import { useEffect, useState } from 'react'
import client from '../api/client'
import { gradesApi } from '../api/grades'
import { classesApi } from '../api/classes'
import { useToastStore } from '../stores/toastStore'
import StatCard from '../components/StatCard'

export default function Classes() {
  const [grades, setGrades] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedGrades, setExpandedGrades] = useState({})
  const [modal, setModal] = useState({ open: false, type: null, mode: null, data: null })
  // type: 'grade' | 'class'
  // mode: 'create' | 'edit'
  const showToast = useToastStore(s => s.show)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [gradeRes, teacherRes] = await Promise.all([
        gradesApi.list({ withClasses: 1 }),
        client.get('/auth/teachers')
      ])
      setGrades(gradeRes.data)
      setTeachers(teacherRes.data || [])
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  const openModal = (type, mode, data = null, gradeId = null) => (e) => {
    e?.preventDefault()
    e?.stopPropagation()
    setModal({ open: true, type, mode, data, gradeId })
  }

  const closeModal = () => setModal({ open: false, type: null, mode: null, data: null, gradeId: null })

  const toggleGrade = (id) => setExpandedGrades(prev => ({ ...prev, [id]: !prev[id] }))

  const handleSaved = () => { closeModal(); loadData() }

  if (loading) return <div className="text-gray-500">加载中...</div>

  const totalGrades = grades.length
  const totalClasses = grades.reduce((sum, g) => sum + (g.class_count || 0), 0)
  const totalStudents = grades.reduce((sum, g) => sum + (g.classes || []).reduce((s, c) => s + (c.student_count || 0), 0), 0)

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">年级班级管理</h1>
          <p className="text-gray-500 text-sm mt-1">管理年级与班级,关联班主任</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openModal('grade', 'create')}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + 新增年级
          </button>
          <button
            onClick={openModal('class', 'create')}
            className="px-4 py-2 text-sm border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            + 新增班级
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="年级数量" value={totalGrades} unit="个" />
        <StatCard label="班级数量" value={totalClasses} unit="个" />
        <StatCard label="学生总数" value={totalStudents} unit="人" />
      </div>

      <div className="space-y-3">
        {grades.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            暂无年级数据,点击右上角「新增年级」开始
          </div>
        )}

        {grades.map(grade => (
          <div key={grade.id} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Grade header */}
            <div
              className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
              onClick={() => toggleGrade(grade.id)}
            >
              <div className="flex items-center gap-3">
                <span className="text-gray-400">{expandedGrades[grade.id] ? '▼' : '▶'}</span>
                <span className="font-medium text-gray-800">{grade.name}</span>
                <span className="text-xs text-gray-400">{grade.class_count} 个班级</span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-400">{grade.school_name}</span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={openModal('class', 'create', null, grade.id)}
                  title="在此时级下新增班级"
                  className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-white"
                >
                  + 班级
                </button>
                <button
                  onClick={openModal('grade', 'edit', grade)}
                  title="编辑年级"
                  className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-white"
                >
                  ✎
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (grade.class_count > 0) { showToast('该年级有班级,无法删除', 'error'); return }
                    if (!confirm(`确认删除年级「${grade.name}」?`)) return
                    gradesApi.remove(grade.id)
                      .then(() => { showToast('已删除', 'success'); loadData() })
                      .catch(() => {})
                  }}
                  title="删除年级"
                  className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-red-50 hover:border-red-200 hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Class list */}
            {expandedGrades[grade.id] && grade.classes?.length > 0 && (
              <div className="divide-y divide-gray-100">
                {grade.classes.map(cls => (
                  <div key={cls.id} className="flex items-center justify-between px-6 py-2.5 hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs text-blue-600 font-medium">
                        {cls.name.charAt(0)}
                      </span>
                      <span className="text-sm text-gray-700">{cls.name}</span>
                      {cls.teacher_name && (
                        <span className="text-xs text-gray-400">班主任: {cls.teacher_name}</span>
                      )}
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{cls.student_count || 0} 人</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={openModal('class', 'edit', cls)}
                        title="编辑班级"
                        className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-white"
                      >
                        ✎
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (cls.student_count > 0) { showToast('该班级有学生,无法删除', 'error'); return }
                          if (!confirm(`确认删除班级「${cls.name}」?`)) return
                          classesApi.remove(cls.id)
                            .then(() => { showToast('已删除', 'success'); loadData() })
                            .catch(() => {})
                        }}
                        title="删除班级"
                        className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-red-50 hover:border-red-200 hover:text-red-500"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {expandedGrades[grade.id] && (!grade.classes || grade.classes.length === 0) && (
              <div className="px-6 py-3 text-sm text-gray-400 text-center">该年级下暂无班级</div>
            )}
          </div>
        ))}
      </div>

      {modal.open && (
        <Modal
          {...modal}
          teachers={teachers}
          grades={grades}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

function Modal({ open, type, mode, data, gradeId, teachers, grades, onClose, onSaved }) {
  const [form, setForm] = useState(type === 'grade'
    ? { name: data?.name || '' }
    : { name: data?.name || '', grade_id: data?.grade_id || gradeId || '', teacher_id: data?.teacher_id || '' }
  )
  const [submitting, setSubmitting] = useState(false)
  const showToast = useToastStore(s => s.show)

  useEffect(() => {
    if (type === 'grade') setForm({ name: data?.name || '' })
    else setForm({ name: data?.name || '', grade_id: data?.grade_id || gradeId || '', teacher_id: data?.teacher_id || '' })
  }, [data, gradeId])

  if (!open) return null

  const update = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { showToast('请填写名称', 'error'); return }
    if (type === 'class' && !form.grade_id) { showToast('请选择年级', 'error'); return }

    setSubmitting(true)
    try {
      const payload = type === 'grade'
        ? { name: form.name.trim() }
        : { name: form.name.trim(), grade_id: Number(form.grade_id), teacher_id: form.teacher_id ? Number(form.teacher_id) : null }

      if (mode === 'edit') {
        await (type === 'grade' ? gradesApi : classesApi).update(data.id, payload)
        showToast('已更新', 'success')
      } else {
        await (type === 'grade' ? gradesApi : classesApi).create(payload)
        showToast('已创建', 'success')
      }
      onSaved()
    } catch (err) {
      // toast handled by interceptor
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
          {mode === 'edit' ? `编辑${type === 'grade' ? '年级' : '班级'}` : `新增${type === 'grade' ? '年级' : '班级'}`}
        </h2>
        <form onSubmit={submit} className="space-y-4">
          {type === 'grade' ? (
            <Field label="年级名称" required>
              <input
                value={form.name}
                onChange={update('name')}
                maxLength={50}
                autoFocus
                placeholder="如: 四年级"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>
          ) : (
            <>
              <Field label="年级" required>
                <select
                  value={form.grade_id}
                  onChange={update('grade_id')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">请选择年级</option>
                  {grades.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="班级名称" required>
                <input
                  value={form.name}
                  onChange={update('name')}
                  maxLength={50}
                  autoFocus
                  placeholder="如: 1班"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
              <Field label="班主任">
                <select
                  value={form.teacher_id}
                  onChange={update('teacher_id')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">不指定</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.role === 'admin' ? '管理员' : '教师'})</option>
                  ))}
                </select>
              </Field>
            </>
          )}
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
