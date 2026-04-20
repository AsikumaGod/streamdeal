// src/App.jsx
import { useState, useEffect } from 'react'
import {
  supabase,
  signOut,
  getProfile,
  fetchDeals,
  fetchWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from './lib/supabase'
import AuthModal from './components/AuthModal'

const SERVICES = ['All', 'Apple', 'Spotify', 'Netflix', 'Disney+', 'YouTube', 'Amazon', 'Other']

// ── Helpers ──────────────────────────────────────────────────

function daysLeft(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr) - new Date()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

// ── Sub-components ────────────────────────────────────────────

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div style={{
      position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
      background: '#c9a84c', color: '#0a0a14', padding: '12px 24px',
      borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
      fontSize: 14, zIndex: 9999, boxShadow: '0 8px 32px rgba(201,168,76,0.35)',
      animation: 'slideUp 0.3s ease', whiteSpace: 'nowrap',
    }}>
      {message}
    </div>
  )
}

function Chip({ label, color, light }) {
  return (
    <span style={{
      background: light ? color : `${color}22`,
      color: light ? '#ccc' : color,
      fontSize: 11, fontWeight: 600, padding: '4px 10px',
      borderRadius: 20, fontFamily: "'DM Sans', sans-serif",
      border: `1px solid ${light ? 'rgba(255,255,255,0.06)' : `${color}44`}`,
      maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

function PromoCard({ deal, notified, onNotify, onRequireAuth }) {
  const days = daysLeft(deal.expires_at)
  const urgent = days !== null && days <= 14

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16, padding: 24,
      display: 'flex', flexDirection: 'column', gap: 12,
      position: 'relative', overflow: 'hidden',
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = `0 16px 40px rgba(0,0,0,0.4), 0 0 0 1px ${deal.color}44`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}>

      {/* accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: deal.color, borderRadius: '16px 16px 0 0' }} />

      {deal.is_hot && (
        <span style={{
          position: 'absolute', top: 16, right: 16,
          background: '#c9a84c', color: '#0a0a14',
          fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
          padding: '3px 8px', borderRadius: 4, fontFamily: "'DM Sans', sans-serif",
          textTransform: 'uppercase',
        }}>🔥 Hot</span>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 32 }}>{deal.logo}</span>
        <div>
          <div style={{ fontSize: 11, color: deal.color, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>{deal.service}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f0ece0', fontFamily: "'Playfair Display', serif", lineHeight: 1.3 }}>{deal.title}</div>
        </div>
      </div>

      <p style={{ fontSize: 13, color: '#9e9b8e', lineHeight: 1.6, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>{deal.description}</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Chip label={deal.discount} color={deal.color} />
        {deal.eligibility && <Chip label={`👤 ${deal.eligibility}`} color='#4a4a5a' light />}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <span style={{
          fontSize: 12, fontFamily: "'DM Sans', sans-serif",
          color: urgent ? '#ff6b6b' : '#6b6b7e',
          fontWeight: urgent ? 700 : 400,
        }}>
          {days === null ? '⏳ Ongoing' : urgent ? `⚠️ Expires in ${days}d` : `Expires ${deal.expires_at}`}
        </span>

        <div style={{ display: 'flex', gap: 8 }}>
          {deal.link && (
            <button onClick={() => window.open(deal.link, '_blank')} style={{
              background: deal.color, color: '#fff', border: 'none',
              borderRadius: 8, padding: '7px 14px', fontSize: 12,
              fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            }}>
              Claim →
            </button>
          )}
          <button
            onClick={() => onNotify ? onNotify(deal.id) : onRequireAuth()}
            style={{
              background: notified ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.06)',
              color: notified ? '#c9a84c' : '#9e9b8e',
              border: `1px solid ${notified ? '#c9a84c55' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 8, padding: '7px 12px', fontSize: 12,
              fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
              transition: 'all 0.2s',
            }}>
            {notified ? '🔔 Watching' : '🔕 Notify Me'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── AI Deal Finder ────────────────────────────────────────────

function AIDealFinder() {
  const [query, setQuery]     = useState('')
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You are StreamDeal's AI assistant. Help users find streaming service promotions, free trials, and deals.
Answer helpfully and concisely. Describe real known promotions. Note that your knowledge has a cutoff so recommend users verify on official sites.
Keep responses under 200 words. Use bullet points for multiple deals. Be direct and specific about conditions and eligibility.`,
          messages: [{ role: 'user', content: query }],
        }),
      })
      const data = await res.json()
      const text = data.content?.find(b => b.type === 'text')?.text || 'No results found.'
      setResult(text)
    } catch {
      setResult('Sorry, could not reach the AI. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(201,168,76,0.25)',
      borderRadius: 14, padding: 20,
    }}>
      <div style={{ fontSize: 11, color: '#c9a84c', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
        ✦ AI Deal Finder
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder='e.g. "Free Apple Music for students" or "Spotify deals this month"'
          style={{
            flex: 1, background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '10px 14px', color: '#f0ece0',
            fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: 'none',
          }}
        />
        <button onClick={handleSearch} disabled={loading} style={{
          background: '#c9a84c', color: '#0a0a14', border: 'none',
          borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 700,
          cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap',
          opacity: loading ? 0.7 : 1,
        }}>
          {loading ? 'Searching…' : 'Ask AI →'}
        </button>
      </div>
      {result && (
        <div style={{
          marginTop: 14, padding: 14,
          background: 'rgba(201,168,76,0.08)', borderRadius: 8,
          fontSize: 13, color: '#d4d0c0', lineHeight: 1.7,
          borderLeft: '3px solid #c9a84c', whiteSpace: 'pre-wrap',
        }}>
          {result}
        </div>
      )}
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────

export default function App() {
  const [session,   setSession]   = useState(null)
  const [profile,   setProfile]   = useState(null)
  const [deals,     setDeals]     = useState([])
  const [watchlist, setWatchlist] = useState(new Set())
  const [filter,    setFilter]    = useState('All')
  const [toast,     setToast]     = useState(null)
  const [showAuth,  setShowAuth]  = useState(false)
  const [loading,   setLoading]   = useState(true)

  // ── Bootstrap ─────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // load profile + watchlist when session changes
  useEffect(() => {
    if (session?.user) {
      Promise.all([
        getProfile(session.user.id),
        fetchWatchlist(session.user.id),
      ]).then(([prof, wl]) => {
        setProfile(prof)
        setWatchlist(wl)
      }).catch(console.error)
    } else {
      setProfile(null)
      setWatchlist(new Set())
    }
  }, [session])

  // load deals
  useEffect(() => {
    fetchDeals()
      .then(setDeals)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // ── Actions ───────────────────────────────────────────────
  async function handleNotify(dealId) {
    if (!session) { setShowAuth(true); return }
    const watching = watchlist.has(dealId)
    try {
      if (watching) {
        await removeFromWatchlist(session.user.id, dealId)
        setWatchlist(prev => { const n = new Set(prev); n.delete(dealId); return n })
        setToast('Removed from watchlist.')
      } else {
        await addToWatchlist(session.user.id, dealId)
        setWatchlist(prev => new Set([...prev, dealId]))
        const deal = deals.find(d => d.id === dealId)
        setToast(`🔔 Watching "${deal?.title}"`)
      }
    } catch (e) {
      setToast(`Error: ${e.message}`)
    }
  }

  async function handleSignOut() {
    await signOut()
    setToast('Signed out.')
  }

  const filtered = filter === 'All' ? deals : deals.filter(d => d.service === filter)

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a14; }
        @keyframes slideUp { from { opacity:0; transform:translateX(-50%) translateY(12px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        ::placeholder { color: #555 !important; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0a0a14; }
        ::-webkit-scrollbar-thumb { background: #2a2a3a; border-radius: 3px; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#0a0a14', color: '#f0ece0', fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── Navbar ── */}
        <div style={{
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(10,10,20,0.95)', backdropFilter: 'blur(12px)',
          position: 'sticky', top: 0, zIndex: 100, padding: '0 32px',
        }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>💎</span>
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em' }}>
                Stream<span style={{ color: '#c9a84c' }}>Deal</span>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {session ? (
                <>
                  <span style={{ fontSize: 12, color: '#6b6b7e' }}>
                    👋 {profile?.full_name || session.user.email}
                    {watchlist.size > 0 && <span style={{ color: '#c9a84c', marginLeft: 8 }}>🔔 {watchlist.size}</span>}
                  </span>
                  <button onClick={handleSignOut} style={{
                    background: 'rgba(255,255,255,0.06)', color: '#9e9b8e',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                    padding: '7px 14px', fontSize: 12, cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif",
                  }}>Sign Out</button>
                </>
              ) : (
                <button onClick={() => setShowAuth(true)} style={{
                  background: '#c9a84c', color: '#0a0a14', border: 'none',
                  borderRadius: 8, padding: '8px 18px', fontSize: 13,
                  fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                }}>Sign In</button>
              )}
            </div>
          </div>
        </div>

        {/* ── Hero ── */}
        <div style={{ textAlign: 'center', padding: '64px 32px 48px', animation: 'fadeIn 0.6s ease' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#c9a84c', fontWeight: 700, textTransform: 'uppercase', marginBottom: 16 }}>
            Free trials · Limited offers · Hidden promos
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 900, lineHeight: 1.1, marginBottom: 16 }}>
            Never miss a streaming deal<br />
            <span style={{ color: '#c9a84c' }}>again.</span>
          </h1>
          <p style={{ color: '#7a7a8e', fontSize: 16, maxWidth: 480, margin: '0 auto' }}>
            Curated promotions from Apple, Spotify, Netflix, Disney+ and more — all in one place.
          </p>
        </div>

        {/* ── AI Finder ── */}
        <div style={{ maxWidth: 680, margin: '0 auto 48px', padding: '0 24px' }}>
          <AIDealFinder />
        </div>

        {/* ── Filters ── */}
        <div style={{ maxWidth: 1100, margin: '0 auto 32px', padding: '0 24px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {SERVICES.map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              background: filter === s ? '#c9a84c' : 'rgba(255,255,255,0.05)',
              color: filter === s ? '#0a0a14' : '#9e9b8e',
              border: `1px solid ${filter === s ? '#c9a84c' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 20, padding: '7px 16px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s',
            }}>{s}</button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#4a4a5e' }}>
            {loading ? 'Loading…' : `${filtered.length} deal${filtered.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* ── Cards ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#4a4a5e', fontFamily: "'DM Sans', sans-serif" }}>
            Loading deals…
          </div>
        ) : (
          <div style={{
            maxWidth: 1100, margin: '0 auto 80px', padding: '0 24px',
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20,
          }}>
            {filtered.map(deal => (
              <PromoCard
                key={deal.id}
                deal={deal}
                notified={watchlist.has(deal.id)}
                onNotify={session ? handleNotify : null}
                onRequireAuth={() => setShowAuth(true)}
              />
            ))}
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '24px 32px', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#3a3a4e' }}>
            StreamDeal — Always verify deal availability on official service websites. Promos are time-limited and region-specific.
          </p>
        </div>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  )
}
