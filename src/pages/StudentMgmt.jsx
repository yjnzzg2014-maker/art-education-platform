import { useEffect, useState } from 'react'
import { studentsApi } from '../api/students'
import { classesApi } from '../api/classes'
import { useAuthStore } from '../stores/authStore'
import { useToastStore } from '../stores/toastStore'
import StatCard from '../components/StatCard'

export default function StudentMgmt() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState({ open: false, mode: 'create', data: null, classId: null })
  const [classFilter, setClassFilter] = useState('')
  const [totalCount, setTotalCount] = useState(0)
  const showToast = useToastStore(s => s.show)

  useEffect(() => { loadData() }, [classFilter])

  const loadData = async () => {
    setLoading(true)
    try {
      const params = { limit: 1000, ...(classFilter ? { classId: classFilter } : {}) }
      const [studentRes, classRes] = await Promise.all([
        studentsApi.list(params),
        classesApi.list()  // 所有人都加载班级，供教师选择
      ])
      setStudents(studentRes.data.data || [])
      setTotalCount(studentRes.data.total || 0)
      setClasses(classRes.data || [])
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  // 教师只能选择自己负责的班级
  const availableClasses = isAdmin ? classes : classes.filter(cls =>
    cls.teacher_ids?.includes(user?.id)
  )

  const openCreate = (classId = null) => (e) => {
    e?.preventDefault()
    // 教师默认选中自己负责的第一个班级
    const defaultClassId = classId || (availableClasses.length > 0 ? availableClasses[0].id : null)
    setModal({ open: true, mode: 'create', data: null, classId: defaultClassId })
  }
  const openEdit = (student) => (e) => {
    e?.preventDefault()
    setModal({ open: true, mode: 'edit', data: student, classId: student.class_id })
  }
  const closeModal = () => setModal({ open: false, mode: 'create', data: null, classId: null })

  const handleSaved = () => { closeModal(); loadData() }

  const handleDelete = (student) => async (e) => {
    e?.preventDefault()
    if (!confirm(`确认删除学生「${student.name}」？\n此操作不可恢复。`)) return
    try {
      await studentsApi.remove(student.id)
      showToast('已删除', 'success')
      loadData()
    } catch {}
  }

  const totalStudents = totalCount

  if (loading) return <div className="text-gray-500">加载中...</div>

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">学生管理</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isAdmin ? '管理员可管理所有学生' : '仅可管理所教班级的学生'}
          </p>
        </div>
        <button
          onClick={openCreate()}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + 新增学生
        </button>
        {availableClasses.length > 0 && (
          <button
            onClick={() => setModal({ open: true, mode: 'batch', data: null, classId: availableClasses[0]?.id })}
            className="px-4 py-2 text-sm border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50"
          >
            + 批量新增
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="学生总数" value={totalStudents} unit="人" />
      </div>

      {isAdmin && (
        <div className="flex items-center gap-4 mb-4">
          <label className="text-sm text-gray-600">筛选班级:</label>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部班级</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
          <span className="text-sm text-gray-500">共 {totalStudents} 人</span>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">姓名</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">学号</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">班级</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">性别</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">作品数</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">暂无数据</td></tr>
            )}
            {students.map(student => (
              <tr key={student.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{student.name}</td>
                <td className="px-4 py-3 text-gray-500">{student.student_no || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{student.class_name || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{student.gender === 'M' ? '男' : student.gender === 'F' ? '女' : '—'}</td>
                <td className="px-4 py-3 text-gray-500">{student.artwork_count || 0}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={openEdit(student)}
                      className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50"
                    >
                      ✎ 编辑
                    </button>
                    {isAdmin && (
                      <button
                        onClick={handleDelete(student)}
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
        <StudentModal
          mode={modal.mode}
          student={modal.data}
          classId={modal.classId}
          classes={availableClasses}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

function StudentModal({ mode, student, classId, classes, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: student?.name || '',
    student_no: student?.student_no || '',
    class_id: student?.class_id || classId || '',
    gender: student?.gender || '',
    birth_date: student?.birth_date || '',
  })
  const [batchText, setBatchText] = useState('')
  const [batchClassId, setBatchClassId] = useState(classId || '')
  const [submitting, setSubmitting] = useState(false)
  const showToast = useToastStore(s => s.show)

  useEffect(() => {
    setForm({
      name: student?.name || '',
      student_no: student?.student_no || '',
      class_id: student?.class_id || classId || '',
      gender: student?.gender || '',
      birth_date: student?.birth_date || '',
    })
    setBatchClassId(classId || '')
  }, [student, classId])

  const update = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { showToast('姓名不能为空', 'error'); return }
    if (!form.class_id) { showToast('请选择班级', 'error'); return }

    setSubmitting(true)
    try {
      const payload = {
        name: form.name.trim(),
        student_no: form.student_no.trim() || null,
        class_id: Number(form.class_id),
        gender: form.gender || null,
        birth_date: form.birth_date || null,
      }
      if (mode === 'edit') {
        await studentsApi.update(student.id, payload)
        showToast('已更新', 'success')
      } else {
        await studentsApi.create(payload)
        showToast('已创建', 'success')
      }
      onSaved()
    } catch {} finally { setSubmitting(false) }
  }

  const submitBatch = async (e) => {
    e.preventDefault()
    if (!batchClassId) { showToast('请选择班级', 'error'); return }
    if (!batchText.trim()) { showToast('请输入学生数据', 'error'); return }

    // 解析数据：格式为 "姓名,学号,性别" 每行一个
    const lines = batchText.trim().split('\n').filter(l => l.trim())
    const students = []
    const errors = []

    lines.forEach((line, idx) => {
      const parts = line.split(',').map(p => p.trim())
      const name = parts[0]
      const student_no = parts[1] || ''
      const genderMap = { '男': 'M', '女': 'F', 'M': 'M', 'F': 'F' }
      const gender = genderMap[parts[2]] || null

      if (!name) {
        errors.push(`第${idx + 1}行：姓名为空`)
        return
      }
      students.push({ name, student_no, gender })
    })

    if (errors.length > 0) {
      showToast(errors[0], 'error')
      return
    }

    if (students.length === 0) {
      showToast('没有有效数据', 'error')
      return
    }

    setSubmitting(true)
    try {
      const result = await studentsApi.batchCreate(students, Number(batchClassId))
      showToast(`成功创建 ${result.data.success} 名学生${result.data.failed > 0 ? `，失败 ${result.data.failed} 名` : ''}`, 'success')
      onSaved()
    } catch {
      showToast('批量创建失败', 'error')
    } finally { setSubmitting(false) }
  }

  // 批量新增模式
  if (mode === 'batch') {
    return (
      <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center" onMouseDown={onClose}>
        <div
          className="bg-white rounded-xl shadow-xl w-[560px] max-w-[90vw] p-6"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-semibold mb-4">批量新增学生</h2>

          <div className="space-y-4">
            <Field label="班级" required>
              <select
                value={batchClassId}
                onChange={(e) => setBatchClassId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">请选择班级</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </Field>

            <Field label="学生数据" required>
              <div className="text-xs text-gray-500 mb-2">
                格式：每行一个学生，格式为「姓名,学号,性别」，用逗号分隔
              </div>
              <div className="text-xs text-gray-400 mb-2 space-y-1">
                <div>示例：</div>
                <div className="bg-gray-50 p-2 rounded font-mono">
                  张三,S001,男<br/>
                  李四,S002,女<br/>
                  王五,S003,
                </div>
              </div>
              <textarea
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                rows={10}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="张三,S001,男&#10;李四,S002,女&#10;王五,S003,"
              />
              <div className="text-xs text-gray-400 mt-1">
                当前 {batchText.trim().split('\n').filter(l => l.trim()).length} 行数据
              </div>
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">取消</button>
            <button type="button" onClick={submitBatch} disabled={submitting} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {submitting ? '创建中…' : '批量创建'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center" onMouseDown={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-[480px] max-w-[90vw] p-6"
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

          <Field label="学号">
            <input
              value={form.student_no}
              onChange={update('student_no')}
              maxLength={32}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>

          <Field label="班级" required>
            <select
              value={form.class_id}
              onChange={update('class_id')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">请选择班级</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="性别">
              <select
                value={form.gender}
                onChange={update('gender')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">未设置</option>
                <option value="M">男</option>
                <option value="F">女</option>
              </select>
            </Field>

            <Field label="出生日期">
              <input
                type="date"
                value={form.birth_date}
                onChange={update('birth_date')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>
          </div>

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
