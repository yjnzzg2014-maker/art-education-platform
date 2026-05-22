import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import { ErrorBoundary } from './components/ErrorBoundary'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Analysis = lazy(() => import('./pages/Analysis'))
const StudentProfile = lazy(() => import('./pages/StudentProfile'))
const Research = lazy(() => import('./pages/Research'))
const Reports = lazy(() => import('./pages/Reports'))
const ClassReport = lazy(() => import('./pages/ClassReport'))
const Diagnosis = lazy(() => import('./pages/Diagnosis'))
const Students = lazy(() => import('./pages/Students'))
const Growth = lazy(() => import('./pages/Growth'))
const Warning = lazy(() => import('./pages/Warning'))
const Reviews = lazy(() => import('./pages/Reviews'))
const Classes = lazy(() => import('./pages/Classes'))
const Teachers = lazy(() => import('./pages/Teachers'))
const StudentMgmt = lazy(() => import('./pages/StudentMgmt'))
const Help = lazy(() => import('./pages/Help'))
const NotFound = lazy(() => import('./pages/NotFound'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-gray-400">加载中...</div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  return isAuthenticated ? children : <Navigate to="/login" />
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="analysis" element={<Analysis />} />
              <Route path="analysis/:taskId" element={<Analysis />} />
              <Route path="diagnosis" element={<Diagnosis />} />
              <Route path="history" element={<Navigate to="/dashboard" replace />} />
              <Route path="students" element={<Students />} />
              <Route path="students/:id" element={<StudentProfile />} />
              <Route path="growth" element={<Growth />} />
              <Route path="warning" element={<Warning />} />
              <Route path="evidence" element={<Navigate to="/research" replace />} />
              <Route path="reviews" element={<Reviews />} />
              <Route path="research" element={<Research />} />
              <Route path="reports" element={<Reports />} />
              <Route path="class-report" element={<ClassReport />} />
              <Route path="classes" element={<Classes />} />
              <Route path="teachers" element={<Teachers />} />
              <Route path="students-mgmt" element={<StudentMgmt />} />
              <Route path="help" element={<Help />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
