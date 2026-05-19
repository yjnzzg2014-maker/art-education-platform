import { useToastStore } from '../stores/toastStore'

const styles = {
  error: 'bg-red-600',
  success: 'bg-green-600',
  info: 'bg-gray-800'
}

export default function Toast() {
  const { message, type, dismiss } = useToastStore()
  if (!message) return null

  return (
    <div role="alert" className="fixed top-4 right-4 z-50 animate-[fadeIn_0.2s]">
      <div className={`${styles[type] || styles.info} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-sm`}>
        <span className="text-sm">{message}</span>
        <button onClick={dismiss} className="text-white/70 hover:text-white ml-auto">&times;</button>
      </div>
    </div>
  )
}
