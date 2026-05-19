export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="text-6xl font-bold text-gray-300 mb-4">404</div>
        <h2 className="text-xl font-semibold text-gray-600 mb-2">页面未找到</h2>
        <p className="text-gray-500">您访问的页面不存在或已被移除</p>
      </div>
    </div>
  )
}
