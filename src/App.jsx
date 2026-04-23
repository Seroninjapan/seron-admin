import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'

const ADMIN_EMAIL = 'seroninjapan@gmail.com'

export default function App() {
  const [session, setSession] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [tab, setTab] = useState('overview')
  const [missions, setMissions] = useState([])
  const [applications, setApplications] = useState([])
  const [clients, setClients] = useState([])
  const [monitors, setMonitors] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) checkAdmin(session.user)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) checkAdmin(session.user)
    })
    return () => subscription.unsubscribe()
  }, [])

  const checkAdmin = async (user) => {
    if (user.email === ADMIN_EMAIL) {
      setIsAdmin(true)
      // adminロールを設定
      await supabase.from('profiles').upsert({
        id: user.id, role: 'admin',
        display_name: user.user_metadata.full_name || user.email,
        email: user.email,
      })
      loadAll()
    } else {
      setIsAdmin(false)
    }
  }

  const loadAll = async () => {
    const [m, a, c, mo] = await Promise.all([
      supabase.from('missions').select('*, clients(venue_name, area, venue_type)').order('created_at', { ascending: false }),
      supabase.from('applications').select('*, missions(title), monitors(profile_id, languages, profiles(display_name, email))').order('applied_at', { ascending: false }),
      supabase.from('clients').select('*, profiles(display_name, email)').order('created_at', { ascending: false }),
      supabase.from('monitors').select('*, profiles(display_name, email, avatar_url)').order('created_at', { ascending: false }),
    ])
    setMissions(m.data || [])
    setApplications(a.data || [])
    setClients(c.data || [])
    setMonitors(mo.data || [])
  }

  const approveMission = async (id) => {
    await supabase.from('missions').update({ status: '公開中' }).eq('id', id)
    showToast('案件を承認しました')
    loadAll()
  }

  const rejectMission = async (id) => {
    await supabase.from('missions').update({ status: '却下' }).eq('id', id)
    showToast('案件を却下しました')
    loadAll()
  }

  const matchApplication = async (id) => {
    await supabase.from('applications').update({ status: 'matched', matched_at: new Date().toISOString() }).eq('id', id)
    showToast('マッチング完了')
    loadAll()
  }

  const rejectApplication = async (id) => {
    await supabase.from('applications').update({ status: 'rejected' }).eq('id', id)
    showToast('応募を却下しました')
    loadAll()
  }

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null); setIsAdmin(false)
  }

  if (loading) return <Loader />
  if (!session) return <LoginScreen onLogin={signInWithGoogle} />
  if (!isAdmin) return (
    <div style={{ maxWidth: 480, margin: '0 auto', background: '#F4F4F2', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>アクセス権限がありません</div>
      <div style={{ fontSize: 14, color: '#999', marginBottom: 24 }}>管理者アカウントでログインしてください</div>
      <button onClick={signOut} style={{ padding: '10px 24px', background: '#2D2D2D', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>別のアカウントでログイン</button>
    </div>
  )

  const pendingMissions = missions.filter(m => m.status === '審査中')
  const pendingApps = applications.filter(a => a.status === 'pending')
  const activeClients = clients.filter(c => c.status === '契約中')

  const tabs = [
    { key: 'overview', label: '概要' },
    { key: 'approve', label: `承認(${pendingMissions.length})` },
    { key: 'matching', label: `応募(${pendingApps.length})` },
    { key: 'missions', label: '案件' },
    { key: 'clients', label: '顧客' },
    { key: 'monitors', label: 'モニター' },
  ]

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', background: '#F4F4F2', minHeight: '100vh', fontFamily: '-apple-system, sans-serif', color: '#1A1A1A' }}>

      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#2D2D2D', color: '#FFF', padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 300 }}>{toast}</div>}

      {/* Header */}
      <div style={{ background: '#2D2D2D', color: '#FFF', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, background: '#1A9E6F', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: 12, fontWeight: 800 }}>S</div>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Seron Admin</span>
        </div>
        <button onClick={signOut} style={{ fontSize: 12, color: '#999', background: 'none', border: 'none', cursor: 'pointer' }}>ログアウト</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, padding: '8px 12px', overflowX: 'auto', background: '#FFF', borderBottom: '1px solid #E8E8E8' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '7px 12px', fontSize: 12, fontWeight: tab === t.key ? 600 : 400,
            background: tab === t.key ? '#2D2D2D' : 'transparent',
            color: tab === t.key ? '#FFF' : '#888',
            border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap'
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: '16px 16px 40px' }}>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { num: pendingMissions.length, label: '承認待ち', color: '#FF8C42', bg: '#FFF3E0' },
                { num: pendingApps.length, label: '応募待ち', color: '#1A9E6F', bg: '#E8F7F0' },
                { num: applications.filter(a => a.status === 'matched').length, label: 'マッチング済', color: '#2D2D2D', bg: '#F0F0F0' },
              ].map((s, i) => (
                <div key={i} style={{ background: s.bg, borderRadius: 10, padding: '14px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.num}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
              {[
                { num: clients.length, label: 'クライアント数' },
                { num: monitors.length, label: '登録モニター' },
                { num: missions.filter(m => m.status === '公開中' || m.status === '進行中').length, label: '進行中案件' },
                { num: missions.filter(m => m.status === '完了').length, label: '完了案件' },
              ].map((s, i) => (
                <div key={i} style={{ background: '#FFF', border: '1px solid #E8E8E8', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{s.num}</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>対応が必要</div>
            {pendingMissions.length > 0 && (
              <div onClick={() => setTab('approve')} style={todoStyle}>
                <span style={{ fontSize: 13 }}>案件承認待ち <b>{pendingMissions.length}件</b></span>
                <span style={{ color: '#CCC' }}>→</span>
              </div>
            )}
            {pendingApps.length > 0 && (
              <div onClick={() => setTab('matching')} style={todoStyle}>
                <span style={{ fontSize: 13 }}>マッチング待ち <b>{pendingApps.length}件</b></span>
                <span style={{ color: '#CCC' }}>→</span>
              </div>
            )}
            {pendingMissions.length === 0 && pendingApps.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#BBB', fontSize: 14 }}>対応が必要な項目はありません ✓</div>
            )}
          </div>
        )}

        {/* APPROVE */}
        {tab === 'approve' && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>案件承認</div>
            {pendingMissions.length === 0 && <Empty text="承認待ちの案件はありません" />}
            {pendingMissions.map(m => (
              <div key={m.id} style={{ background: '#FFF', border: '1px solid #E8E8E8', borderRadius: 10, padding: 16, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{m.title}</div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{m.clients?.venue_name} · {m.clients?.area}</div>
                  </div>
                  <div style={{ fontSize: 11, color: '#999' }}>{new Date(m.created_at).toLocaleDateString('ja-JP')}</div>
                </div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>言語: {m.required_languages?.join(', ')}</div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>質問数: {m.questions?.length}件 · モニター: {m.monitor_count}名</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => approveMission(m.id)} style={{ flex: 1, padding: 9, background: '#1A9E6F', color: '#FFF', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>承認</button>
                  <button onClick={() => rejectMission(m.id)} style={{ flex: 1, padding: 9, background: '#FFF', color: '#E74C3C', border: '1px solid #E74C3C', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>却下</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MATCHING */}
        {tab === 'matching' && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>応募マッチング</div>
            {applications.length === 0 && <Empty text="応募はまだありません" />}
            {applications.map(a => (
              <div key={a.id} style={{ background: '#FFF', border: '1px solid #E8E8E8', borderRadius: 10, padding: '14px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: a.status === 'matched' ? '#E8F7F0' : a.status === 'rejected' ? '#FCEBEB' : '#F0F0F0', color: a.status === 'matched' ? '#1A9E6F' : a.status === 'rejected' ? '#E74C3C' : '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>
                    {a.monitors?.profiles?.display_name?.[0] || 'M'}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{a.monitors?.profiles?.display_name || 'モニター'}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>{a.missions?.title} · {new Date(a.applied_at).toLocaleDateString('ja-JP')}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {a.status === 'pending' ? (
                    <>
                      <button onClick={() => matchApplication(a.id)} style={{ padding: '5px 12px', background: '#1A9E6F', color: '#FFF', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>承認</button>
                      <button onClick={() => rejectApplication(a.id)} style={{ padding: '5px 12px', background: '#FFF', color: '#E74C3C', border: '1px solid #EBB', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>却下</button>
                    </>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 600, color: a.status === 'matched' ? '#1A9E6F' : '#E74C3C' }}>
                      {a.status === 'matched' ? '✓ 承認済' : '✕ 却下'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MISSIONS */}
        {tab === 'missions' && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>案件一覧</div>
            {missions.length === 0 && <Empty text="案件はまだありません" />}
            {missions.map(m => (
              <div key={m.id} style={{ background: '#FFF', border: '1px solid #E8E8E8', borderRadius: 10, padding: '14px 16px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{m.title}</div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{m.clients?.venue_name} · {m.clients?.area}</div>
                  </div>
                  <StatusBadge status={m.status} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CLIENTS */}
        {tab === 'clients' && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>クライアント一覧</div>
            {clients.length === 0 && <Empty text="クライアントはまだいません" />}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E8E8E8' }}>
                  {['店舗名', 'エリア', '業種', 'プラン', '状態'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 6px', fontSize: 11, color: '#999', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map((c, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F0F0F0' }}>
                    <td style={{ padding: '10px 6px', fontWeight: 600, fontSize: 12 }}>{c.venue_name}</td>
                    <td style={{ padding: '10px 6px', color: '#888', fontSize: 12 }}>{c.area}</td>
                    <td style={{ padding: '10px 6px', fontSize: 12 }}>{c.venue_type}</td>
                    <td style={{ padding: '10px 6px', fontSize: 12 }}>
                      {c.plan && c.plan !== 'none' ? (
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: '#E8F7F0', color: '#0E6B4A' }}>{c.plan}</span>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '10px 6px', fontSize: 12 }}>
                      <span style={{ color: c.status === '契約中' ? '#1A9E6F' : '#FF8C42', fontWeight: 600 }}>{c.status || '審査中'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* MONITORS */}
        {tab === 'monitors' && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>モニター一覧</div>
            {monitors.length === 0 && <Empty text="モニターはまだいません" />}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E8E8E8' }}>
                  {['名前', '言語', '完了数', '評価', '状態'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 6px', fontSize: 11, color: '#999', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monitors.map((m, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F0F0F0' }}>
                    <td style={{ padding: '10px 6px', fontWeight: 600, fontSize: 12 }}>{m.profiles?.display_name || 'モニター'}</td>
                    <td style={{ padding: '10px 6px', color: '#888', fontSize: 12 }}>{m.languages?.join(', ') || '-'}</td>
                    <td style={{ padding: '10px 6px', fontSize: 12 }}>{m.total_completed}</td>
                    <td style={{ padding: '10px 6px', fontSize: 12 }}>
                      {m.average_rating > 0 ? (
                        <span style={{ color: m.average_rating >= 4.5 ? '#1A9E6F' : '#1A1A1A', fontWeight: 600 }}>{m.average_rating}</span>
                      ) : <span style={{ color: '#CCC' }}>-</span>}
                    </td>
                    <td style={{ padding: '10px 6px', fontSize: 12 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: m.status === 'active' ? '#E8F7F0' : '#FFF3E0', color: m.status === 'active' ? '#0E6B4A' : '#E65100' }}>
                        {m.status === 'active' ? '稼働中' : '新規'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const todoStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  background: '#FFF', border: '1px solid #E8E8E8', borderRadius: 8,
  padding: '12px 14px', marginBottom: 8, cursor: 'pointer'
}

function StatusBadge({ status }) {
  const styles = {
    '審査中': { bg: '#FFF3E0', color: '#E65100' },
    '公開中': { bg: '#E8F7F0', color: '#0E6B4A' },
    '進行中': { bg: '#E8F0FC', color: '#2471A3' },
    '完了': { bg: '#F0F0F0', color: '#999' },
    '却下': { bg: '#FCEBEB', color: '#E74C3C' },
  }
  const s = styles[status] || styles['審査中']
  return <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{status}</span>
}

function Empty({ text }) {
  return <div style={{ textAlign: 'center', padding: '40px 20px', color: '#BBB', fontSize: 14 }}>{text}</div>
}

function Loader() {
  return <div style={{ background: '#F4F4F2', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#2D2D2D', fontSize: 20, fontWeight: 700 }}>Seron Admin</div></div>
}

function LoginScreen({ onLogin }) {
  return (
    <div style={{ maxWidth: 520, margin: '0 auto', background: '#F4F4F2', minHeight: '100vh', fontFamily: '-apple-system, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px' }}>
      <div style={{ width: 56, height: 56, background: '#2D2D2D', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 26, fontWeight: 800, marginBottom: 20 }}>S</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Seron Admin</div>
      <div style={{ fontSize: 14, color: '#999', textAlign: 'center', marginBottom: 40 }}>管理者専用ページ</div>
      <button onClick={onLogin} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 28px', background: '#FFF', color: '#333', border: '1px solid #DDD', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
        <span style={{ fontSize: 18 }}>G</span>
        Googleでログイン
      </button>
    </div>
  )
}
