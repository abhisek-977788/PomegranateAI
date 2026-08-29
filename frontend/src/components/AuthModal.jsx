import React, { useState } from 'react'
import { X, Lock, Mail, User, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export function AuthModal({ isOpen, onClose }) {
  const { login, register } = useAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isRegister) {
        await register(name, email, password)
      } else {
        await login(email, password)
      }
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-red-600/20 text-red-500 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Lock size={24} />
          </div>
          <h2 className="text-xl font-bold text-white">
            {isRegister ? 'Create an Account' : 'Sign In to PomegranateAI'}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {isRegister
              ? 'Sign up to persist your live conveyor inspections and analytics history'
              : 'Sign in to access your saved batch inspection records and analytics'}
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-950/50 border border-red-500/50 text-red-300 text-xs p-3 rounded-xl">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 text-gray-500" size={18} />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-gray-800 text-white pl-10 pr-4 py-2 rounded-xl border border-gray-700 text-sm focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 text-gray-500" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@orchard.com"
                className="w-full bg-gray-800 text-white pl-10 pr-4 py-2 rounded-xl border border-gray-700 text-sm focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-gray-500" size={18} />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-800 text-white pl-10 pr-4 py-2 rounded-xl border border-gray-700 text-sm focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                {isRegister ? 'Creating Account...' : 'Signing In...'}
              </>
            ) : (
              isRegister ? 'Register Account' : 'Sign In'
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => { setIsRegister(!isRegister); setError('') }}
            className="text-xs text-gray-400 hover:text-red-400 transition-colors"
          >
            {isRegister
              ? 'Already have an account? Sign In'
              : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    </div>
  )
}
