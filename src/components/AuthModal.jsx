// src/components/AuthModal.jsx
import { useState } from 'react'
import { signInWithEmail } from '../lib/supabase'

export default function AuthModal({ onClose }) {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  async function handleSubmit() {
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    try {
      await signInWithEmail(email.trim())
      setSent(true)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(6px)',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#12121f', border: '1px solid rgba(201,168,76,0.2)',
          borderRadius: 20, padding: 36, width: '100%', maxWidth: 400,
          fontFamily: "'DM Sans', sans-serif",
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
          animation: 'fadeIn 0.25s ease',
        }}>

        {/* Close */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 20,
          background: 'none', border: 'none', color: '#555', fontSize: 20,
          cursor: 'pointer', lineHeight: 1,
        }}>✕</button>

        {!sent ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <span style={{ fontSize: 36 }}>💎</span>
              <h2 style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 24, fontWeight: 900, color: '#f0ece0', marginTop: 8,
              }}>Sign in to StreamDeal</h2>
              <p style={{ color: '#6b6b7e', fontSize: 13, marginTop: 6 }}>
                We'll send a magic link to your email — no password needed.
              </p>
            </div>

            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
                padding: '12px 16px', color: '#f0ece0', fontSize: 14,
                fontFamily: "'DM Sans', sans-serif", outline: 'none',
                marginBottom: 12,
              }}
            />

            {error && (
              <p style={{ color: '#ff6b6b', fontSize: 12, marginBottom: 10 }}>{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                width: '100%', background: '#c9a84c', color: '#0a0a14',
                border: 'none', borderRadius: 10, padding: '13px',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                opacity: loading ? 0.7 : 1,
              }}>
              {loading ? 'Sending…' : 'Send Magic Link →'}
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <span style={{ fontSize: 48 }}>📬</span>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 22, color: '#f0ece0', margin: '16px 0 8px',
            }}>Check your inbox!</h2>
            <p style={{ color: '#7a7a8e', fontSize: 13, lineHeight: 1.7 }}>
              We sent a magic link to <strong style={{ color: '#c9a84c' }}>{email}</strong>.
              Click the link to sign in — it expires in 1 hour.
            </p>
            <button onClick={onClose} style={{
              marginTop: 24, background: 'rgba(255,255,255,0.06)',
              color: '#9e9b8e', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '10px 20px', fontSize: 13,
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            }}>Close</button>
          </div>
        )}
      </div>
    </div>
  )
}
