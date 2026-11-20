import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronDown,
  ChevronRight, CircleHelp, Clipboard, Cloud, Code2, Command, Download, FileCode2,
  FileText, FolderKanban, KeyRound, Layers3, LogOut, Menu, Plus, Search, Settings2,
  ShieldCheck, Sparkles, X
} from 'lucide-react'
import { hasSupabaseConfig, supabase } from './lib/supabase'

const PRO_CHECKOUT_URL = import.meta.env.VITE_PRO_CHECKOUT_URL || ''
const LIFETIME_CHECKOUT_URL = import.meta.env.VITE_LIFETIME_CHECKOUT_URL || ''
const LIPA_NAMBA = import.meta.env.VITE_LIPA_NAMBA || ''
const LIPA_NAME = import.meta.env.VITE_LIPA_NAME || ''

const SOURCE_AIS = ['ALL', 'CLAUDE', 'CHATGPT', 'LOVABLE', 'BASE44', 'TRAE', 'QODER', 'GEMINI']
const TARGET_AIS = ['Claude', 'ChatGPT', 'Lovable', 'Base44', 'Trae', 'Qoder', 'Gemini', 'Other']
const DEFAULT_SKILLS = [
  { role_name: 'Backend Architect', instructions: 'Design reliable APIs, data models, authorization and backend services. Explain trade-offs before implementation.', is_default: true },
  { role_name: 'UI Designer', instructions: 'Translate product intent into precise, accessible interfaces. Preserve the existing design system and responsive behavior.', is_default: true },
  { role_name: 'Image Prompt Engineer', instructions: 'Turn the supplied visual direction into detailed, production-ready image generation prompts. Preserve all constraints.', is_default: true }
]

function Reveal({ children, delay = 0, className = '' }) {
  const node = useRef(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = node.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(true); return }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setShown(true); observer.disconnect() }
    }, { threshold: 0.15 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return <div ref={node} className={`reveal ${shown ? 'reveal-visible' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>
}

function Brand({ compact = false }) {
  return <div className="brand-lockup">
    <span className="brand-mark">VV</span>
    {!compact && <span className="brand-word">VIBEVAULT</span>}
  </div>
}

function StatusLine({ children = 'SYSTEM ONLINE' }) {
  return <span className="status-line"><span className="status-pulse" />{children}</span>
}

function Button({ children, variant = 'solid', className = '', ...props }) {
  return <button className={`${variant === 'ghost' ? 'btn-ghost' : 'btn-solid'} ${className}`} {...props}>{children}</button>
}

function Modal({ title, eyebrow, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
    <section className={`modal-panel ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-head"><div><span className="eyebrow">{eyebrow || 'VAULT CONTROL'}</span><h2 className="display modal-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button></div>
      {children}
    </section>
  </div>
}

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [splash, setSplash] = useState(!sessionStorage.getItem('vibevault-splash-seen'))

  useEffect(() => {
    let alive = true
    if (!supabase) { setAuthReady(true); return () => { alive = false } }
    supabase.auth.getSession().then(({ data }) => {
      if (alive) { setSession(data.session); setAuthReady(true) }
    }).catch(() => alive && setAuthReady(true))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
    })
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (session && location.pathname === '/') {
      const pendingPlan = sessionStorage.getItem('vibevault-pending-upgrade')
      if (pendingPlan) {
        sessionStorage.removeItem('vibevault-pending-upgrade')
        navigate('/app', { state: { upgradePlan: pendingPlan } })
      }
    }
  }, [session, location.pathname, navigate])

  useEffect(() => {
    if (!splash) return
    const timer = window.setTimeout(() => {
      setSplash(false)
      sessionStorage.setItem('vibevault-splash-seen', '1')
    }, 1600)
    return () => window.clearTimeout(timer)
  }, [splash])

  const skipSplash = () => {
    setSplash(false)
    sessionStorage.setItem('vibevault-splash-seen', '1')
  }

  let screen
  if (location.pathname.startsWith('/auth')) {
    screen = <AuthPage pendingPlan={location.state?.upgradePlan} onBack={() => navigate('/')} onSuccess={() => navigate('/app', { state: location.state })} />
  } else if (location.pathname.startsWith('/app')) {
    screen = authReady && session
      ? <Dashboard session={session} initialPlan={location.state?.upgradePlan} onSignOut={() => { supabase?.auth.signOut(); navigate('/') }} />
      : <AuthRedirect ready={authReady} onGo={() => navigate('/auth')} />
  } else {
    screen = <Landing onAuth={() => navigate('/auth')} onPlanClick={(plan) => navigate(session ? '/app' : '/auth', { state: { upgradePlan: plan } })} />
  }

  return <>
    {screen}
    {splash && <Splash onSkip={skipSplash} />}
  </>
}

function Splash({ onSkip }) {
  return <div className="splash-screen tactical-grid">
    <button className="splash-skip" onClick={onSkip}>SKIP <ArrowUpRight size={14}/></button>
    <div className="splash-center">
      <div className="splash-pulse" />
      <span className="splash-monogram">VV</span>
      <span className="eyebrow">INITIALIZING NEURAL VAULT</span>
      <h1 className="display splash-title">VIBEVAULT</h1>
      <div className="splash-progress"><span /></div>
      <span className="micro-copy">MEMORY SYSTEM / BUILD 01.01</span>
    </div>
    <div className="splash-bottom"><span>VIBEVAULT / CONTROL SYSTEM</span><span>SECURE SESSION BOOT</span></div>
  </div>
}

function Landing({ onAuth, onPlanClick }) {
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  return <main className="landing-page">
    <header className="top-nav">
      <a href="#top" className="nav-brand"><Brand/><StatusLine/></a>
      <nav className="nav-links" aria-label="Main navigation">
        <button onClick={() => scrollTo('relay-loop')}>HOW IT WORKS</button>
        <button onClick={() => scrollTo('subscriptions')}>SUBSCRIPTIONS</button>
        <Button variant="ghost" onClick={onAuth}>SIGN IN</Button>
        <Button onClick={onAuth}>LAUNCH VAULT <ArrowUpRight size={15}/></Button>
      </nav>
      <button className="mobile-menu icon-button" onClick={() => scrollTo('relay-loop')} aria-label="Jump to sections"><Menu size={19}/></button>
    </header>

    <section id="top" className="hero-section">
      <div className="hero-rings" />
      <div className="hero-content">
        <div className="eyebrow hero-eyebrow"><span className="eyebrow-rule"/>CLOUD AI MEMORY & DYNAMIC HANDOFF CONTROL</div>
        <h1 className="display hero-title">STOP TREATING EVERY AI<br/><span className="hero-gradient">LIKE A STRANGER</span></h1>
        <p className="hero-copy">GitHub stores your code. VibeVault stores your exact raw AI conversations, personal coding rules, and role-specific <code>AGENT.md</code> handoffs across Claude, ChatGPT, Lovable, Base44, Trae, and Qoder.</p>
        <div className="hero-actions"><Button onClick={onAuth}>OPEN CONTROL VAULT <ArrowUpRight size={16}/></Button><Button variant="ghost" onClick={() => scrollTo('relay-loop')}>EXPLORE THE RELAY <ArrowDown size={15}/></Button></div>
      </div>
      <div className="hero-strip">
        <div className="hero-metric"><strong>01</strong><span>RAW CONVO VAULT</span></div>
        <div className="hero-metric"><strong>02</strong><span>DYNAMIC AGENT.MD</span></div>
        <div className="hero-metric"><strong>03</strong><span>ZERO CONTEXT LOSS</span></div>
      </div>
    </section>

    <section id="relay-loop" className="section-dark relay-section">
      <div className="section-container">
        <Reveal><div className="eyebrow"><span className="eyebrow-rule"/>EXECUTION PROTOCOL</div><h2 className="display section-title">THREE STEPS. ZERO RE-EXPLAINING.</h2></Reveal>
        <div className="relay-grid">
          {[
            ['01', 'PULL & VAULT RAW CONVOS', 'Save exact, unedited prompts and full chats from Claude, ChatGPT, or Trae before free limits hit or heavy IDEs crash.'],
            ['02', 'ASSIGN AGENT.MD SKILL', 'Pick the exact role for your next move — Backend Architect, UI Designer, Image Prompt Engineer, or a custom skill — and bundle your rules.'],
            ['03', 'IMPORT & FORCE CONFIRMATION', 'Paste into the next AI. VibeVault asks the new model to confirm its assigned role and summarize your raw ideas before writing code.']
          ].map(([number, title, copy], index) => <Reveal key={number} delay={index * 100}><article className="relay-card"><span className="relay-number">{number}</span><h3 className="display relay-card-title">{title}</h3><p>{copy}</p><div className="card-bottom-rule"/></article></Reveal>)}
        </div>
      </div>
    </section>

    <section id="subscriptions" className="band-light pricing-section">
      <div className="section-container">
        <Reveal><div className="eyebrow pricing-eyebrow"><span className="eyebrow-rule"/>ACCESS TIERS</div><h2 className="display pricing-title">OWN YOUR AI BRAIN FOREVER.</h2></Reveal>
        <div className="pricing-grid">
          <Reveal delay={0}><PlanCard name="STARTER VAULT" price="$0" period="FOREVER" features={['1 active project','3 saved raw conversations','3 built-in AGENT.md roles','1-click launch in Claude & ChatGPT']} action="START FREE" onClick={onAuth}/></Reveal>
          <Reveal delay={100}><PlanCard featured name="PRO VIBE-CODER" price="$9" period="MONTH" features={['Unlimited projects & raw conversations','Built-in AI Smart Spec Cleaner','Unlimited custom AGENT.md roles','Priority MCP plugin access']} action="UPGRADE TO PRO" onClick={() => onPlanClick('pro')}/></Reveal>
          <Reveal delay={200}><PlanCard name="FOUNDER LIFETIME" price="$49" period="ONE-TIME" badge="FIRST 50 FOUNDERS" features={['Everything in Pro forever','Zero monthly bills','VIP Founder badge','Direct feature voting']} action="CLAIM FOUNDER LIFETIME" onClick={() => onPlanClick('lifetime')}/></Reveal>
        </div>
        
      </div>
    </section>

    <section className="final-cta">
      <div className="section-container cta-inner"><div><div className="eyebrow"><span className="eyebrow-rule"/>YOUR MEMORY. YOUR RULES.</div><h2 className="display cta-title">YOUR IDEAS BELONG TO YOU.<br/>NOT ONE AI TAB.</h2></div><Button onClick={onAuth}>CREATE FREE VAULT <ArrowUpRight size={16}/></Button></div>
    </section>
    <footer className="site-footer"><div className="footer-brand"><Brand/><StatusLine>MEMORY SYSTEM ACTIVE</StatusLine></div><span>© {new Date().getFullYear()} VIBEVAULT</span><span>KEEP THE CONTEXT. MOVE THE WORK.</span></footer>
  </main>
}

function PlanCard({ name, price, period, features, action, onClick, featured = false, badge = '' }) {
  return <article className={`plan-card ${featured ? 'plan-featured' : ''}`}>
    {(featured || badge) && <span className="popular-badge">{badge || 'MOST POPULAR'}</span>}
    <span className="plan-name">{name}</span>
    <div className="plan-price-row"><strong className="display plan-price">{price}</strong><span> / {period}</span></div>
    <div className="plan-divider"/>
    <ul className="plan-features">{features.map((feature) => <li key={feature}><Check size={15}/><span>{feature}</span></li>)}</ul>
    <Button className="plan-action" onClick={onClick}>{action} <ArrowUpRight size={15}/></Button>
  </article>
}

function AuthRedirect({ ready, onGo }) {
  useEffect(() => { if (ready) onGo() }, [ready, onGo])
  return <div className="auth-redirect"><StatusLine>VAULT ACCESS</StatusLine><h1 className="display">{ready ? 'AUTHENTICATION REQUIRED' : 'RESTORING SESSION'}</h1><p>{ready ? 'Sign in to access your saved projects, conversations and handoff engine.' : 'Checking your secure session.'}</p>{ready && <Button onClick={onGo}>GO TO VAULT ACCESS <ArrowRight size={15}/></Button>}</div>
}

function AuthPage({ onBack, onSuccess, pendingPlan }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  const continueWithGithub = async () => {
    setNotice(null)
    if (!hasSupabaseConfig) { setNotice({ type: 'error', text: 'Supabase is not connected yet. Configure your project URL and anon key first.' }); return }
    if (pendingPlan) sessionStorage.setItem('vibevault-pending-upgrade', pendingPlan)
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: window.location.origin } })
      if (error) throw error
    } catch (error) {
      sessionStorage.removeItem('vibevault-pending-upgrade')
      setNotice({ type: 'error', text: error.message || 'GitHub sign-in could not be started.' })
    } finally { setBusy(false) }
  }

  const submit = async (event) => {
    event.preventDefault()
    setNotice(null)
    if (!hasSupabaseConfig) { setNotice({ type: 'error', text: 'Supabase is not connected yet. Add your project URL and anon key to .env, then restart the dev server.' }); return }
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        onSuccess()
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { display_name: displayName.trim() } }
        })
        if (error) throw error
        if (data.session) onSuccess()
        else setNotice({ type: 'success', text: 'Account created. Check your email to confirm your address, then return here to sign in.' })
      }
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'Authentication failed. Please try again.' })
    } finally { setBusy(false) }
  }

  return <main className="auth-screen">
    <div className="auth-top"><button className="back-link" onClick={onBack}><ArrowLeft size={15}/> BACK TO BRIEFING</button><Brand/><StatusLine>ENCRYPTED SESSION</StatusLine></div>
    <div className="auth-layout">
      <aside className="auth-aside tactical-grid"><span className="eyebrow"><span className="eyebrow-rule"/>VAULT ACCESS</span><h1 className="display auth-title">ENTER<br/>CONTROL ROOM.</h1><p>Your conversations are the source material. Your rules are the operating system. Keep both in one place.</p><div className="auth-aside-meta"><span>VV-SECURE / 01</span><span>PERSONAL AI MEMORY</span></div></aside>
      <section className="auth-form-area">
        <div className="auth-form-head"><span className="eyebrow">IDENTITY CHECK</span><h2 className="display">{mode === 'signin' ? 'WELCOME BACK.' : 'BUILD YOUR VAULT.'}</h2><p>{mode === 'signin' ? 'Enter your credentials to restore your working context.' : 'Create an account to start preserving your AI work.'}</p></div>
        <div className="auth-tabs"><button className={mode === 'signin' ? 'active' : ''} onClick={() => { setMode('signin'); setNotice(null) }}>SIGN IN</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setNotice(null) }}>CREATE ACCOUNT</button></div>
        <Button variant="ghost" className="github-auth-btn" type="button" onClick={continueWithGithub} disabled={busy}><Code2 size={17}/> CONTINUE WITH GITHUB</Button>
        <div className="auth-divider"><span>OR CONTINUE WITH EMAIL</span></div>
        <form className="auth-form" onSubmit={submit}>
          {mode === 'signup' && <label className="field-label">DISPLAY NAME<input className="field-input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="How should we address you?" autoComplete="name" required/></label>}
          <label className="field-label">EMAIL ADDRESS<input className="field-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required/></label>
          <label className="field-label">PASSWORD<input className="field-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required/></label>
          {notice && <div className={`notice notice-${notice.type}`} role="status">{notice.type === 'success' ? <CheckCircle2 size={17}/> : <CircleHelp size={17}/>}<span>{notice.text}</span></div>}
          <Button className="auth-submit" disabled={busy}>{busy ? 'PROCESSING...' : mode === 'signin' ? 'INITIALIZE VAULT' : 'CREATE VAULT ACCOUNT'} <ArrowUpRight size={16}/></Button>
        </form>
        <div className="auth-security"><ShieldCheck size={15}/><span>Your data is stored in your own Supabase-backed account. Never share your password.</span></div>
        {!hasSupabaseConfig && <p className="config-hint">SETUP REQUIRED · Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your environment file.</p>}
      </section>
    </div>
    <footer className="auth-footer"><span>VIBEVAULT / ACCESS NODE</span><span>CONTROL IS YOURS</span></footer>
  </main>
}

function Dashboard({ session, initialPlan, onSignOut }) {
  const user = session.user
  const [profile, setProfile] = useState(null)
  const [projects, setProjects] = useState([])
  const [conversations, setConversations] = useState([])
  const [skills, setSkills] = useState([])
  const [handoffs, setHandoffs] = useState([])
  const [activeProjectId, setActiveProjectId] = useState(null)
  const [sourceFilter, setSourceFilter] = useState('ALL')
  const [projectSearch, setProjectSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [targetAi, setTargetAi] = useState('Claude')
  const [activeSkillId, setActiveSkillId] = useState('')
  const [modal, setModal] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [detail, setDetail] = useState(null)
  const [detailTab, setDetailTab] = useState('raw')
  const [mobilePanel, setMobilePanel] = useState('vault')
  const [bundleModes, setBundleModes] = useState({})
  const [cleaningId, setCleaningId] = useState(null)
  const [refreshingPlan, setRefreshingPlan] = useState(false)

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0] || null
  const isPro = Boolean(profile?.is_pro)
  const activeSkill = skills.find(skill => skill.id === activeSkillId) || skills[0] || null
  const filteredProjects = projects.filter(p => p.title?.toLowerCase().includes(projectSearch.toLowerCase()))
  const visibleConversations = useMemo(() => conversations.filter(c => {
    const sameProject = !activeProject || c.project_id === activeProject.id
    const sameSource = sourceFilter === 'ALL' || c.source_ai?.toUpperCase() === sourceFilter
    return sameProject && sameSource
  }), [conversations, activeProject, sourceFilter])
  const selectedConversations = conversations.filter(c => selectedIds.includes(c.id))

  useEffect(() => {
    if (initialPlan) setModal({ type: 'upgrade', plan: initialPlan })
  }, [initialPlan])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setBusy(true)
      try {
        const [profileRes, projectRes, convoRes, skillRes, handoffRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          supabase.from('projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('conversations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('agent_skills').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
          supabase.from('handoffs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
        ])
        for (const result of [profileRes, projectRes, convoRes, skillRes, handoffRes]) if (result.error) throw result.error
        if (!mounted) return
        let nextProfile = profileRes.data
        if (!nextProfile) {
          const { data, error } = await supabase.from('profiles').upsert({ id: user.id, email: user.email, display_name: user.user_metadata?.display_name || '' }).select().single()
          if (error) throw error
          nextProfile = data
        }
        setProfile(nextProfile)
        setProjects(projectRes.data || [])
        setConversations(convoRes.data || [])
        let nextSkills = skillRes.data || []
        // Existing accounts created before the default-skill trigger receive the templates on first load.
        if (nextSkills.length === 0) {
          const defaults = DEFAULT_SKILLS.map(skill => ({ ...skill, user_id: user.id }))
          const { data: insertedSkills, error: insertSkillsError } = await supabase.from('agent_skills').insert(defaults).select()
          if (insertSkillsError) throw insertSkillsError
          nextSkills = insertedSkills || []
        }
        setSkills(nextSkills)
        setHandoffs(handoffRes.data || [])
        setActiveProjectId(projectRes.data?.[0]?.id || null)
        setActiveSkillId(nextSkills?.[0]?.id || '')
      } catch (error) { showToast(error.message || 'Could not load vault data.') }
      finally { if (mounted) setBusy(false) }
    }
    load()
    return () => { mounted = false }
  // Initial load per authenticated identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3600)
    return () => window.clearTimeout(timer)
  }, [toast])

  function showToast(message) { setToast(message) }

  async function refreshPlanStatus() {
    setRefreshingPlan(true)
    try {
      const { data, error } = await supabase.from('profiles').select('is_pro').eq('id', user.id).single()
      if (error) throw error
      setProfile(current => ({ ...(current || {}), is_pro: data.is_pro }))
      showToast(data.is_pro ? 'Pro plan confirmed.' : 'Starter plan is active.')
    } catch (error) { showToast(error.message || 'Could not refresh plan status.') }
    finally { setRefreshingPlan(false) }
  }

  function requestCreateProject() {
    if (!isPro && projects.length >= 1) {
      setModal({ type: 'upgrade', plan: 'pro', message: 'Starter Vault limit reached (1/1 Project). Unlock unlimited projects & convos.' })
      return
    }
    setModal({ type: 'project' })
  }

  function requestSaveConversation() {
    if (!isPro && conversations.length >= 3) {
      setModal({ type: 'upgrade', plan: 'pro', message: 'Starter Vault limit reached (3/3 Convos). Upgrade to keep vaulting your AI brain.' })
      return
    }
    setModal({ type: 'conversation' })
  }

  function requestCreateSkill() {
    if (!isPro) {
      setModal({ type: 'upgrade', plan: 'pro', message: 'Unlimited custom AGENT.md roles are included with Pro.' })
      return
    }
    setModal({ type: 'skill' })
  }

  async function createProject(values) {
    if (!isPro && projects.length >= 1) {
      setModal({ type: 'upgrade', plan: 'pro', message: 'Starter Vault limit reached (1/1 Project). Unlock unlimited projects & convos.' })
      return
    }
    const payload = { user_id: user.id, title: values.title.trim(), description: values.description.trim(), project_rules: values.project_rules.trim(), tags: values.tags.split(',').map(s => s.trim()).filter(Boolean) }
    const { data, error } = await supabase.from('projects').insert(payload).select().single()
    if (error) throw error
    setProjects(current => [data, ...current]); setActiveProjectId(data.id); setModal(null); showToast('Project created.')
  }

  async function saveConversation(values) {
    if (!isPro && conversations.length >= 3) {
      setModal({ type: 'upgrade', plan: 'pro', message: 'Starter Vault limit reached (3/3 Convos). Upgrade to keep vaulting your AI brain.' })
      return
    }
    if (!activeProject) throw new Error('Create or select a project before saving a conversation.')
    const payload = { project_id: activeProject.id, user_id: user.id, title: values.title.trim(), source_ai: values.source_ai, raw_content: values.raw_content, cleaned_spec: '', tags: values.tags.split(',').map(s => s.trim()).filter(Boolean), image_urls: [] }
    const { data, error } = await supabase.from('conversations').insert(payload).select().single()
    if (error) throw error
    setConversations(current => [data, ...current]); setModal(null); showToast('Raw conversation saved exactly as submitted.')
  }

  async function createSkill(values) {
    if (!isPro) {
      setModal({ type: 'upgrade', plan: 'pro', message: 'Unlimited custom AGENT.md roles are included with Pro.' })
      return
    }
    const payload = { user_id: user.id, role_name: values.role_name.trim(), instructions: values.instructions.trim(), is_default: false }
    const { data, error } = await supabase.from('agent_skills').insert(payload).select().single()
    if (error) throw error
    setSkills(current => [...current, data]); setActiveSkillId(data.id); setModal(null); showToast('Custom role added.')
  }

  async function updateGlobalStyle(value) {
    const { data, error } = await supabase.from('profiles').upsert({ id: user.id, email: user.email, display_name: profile?.display_name || user.user_metadata?.display_name || '', global_style: value }, { onConflict: 'id' }).select().single()
    if (error) throw error
    setProfile(data); setModal(null); showToast('Global style saved.')
  }

  function makeAgentMd(targetOverride = targetAi) {
    const projectRules = activeProject?.project_rules?.trim() || 'No project-specific rules have been added yet.'
    const style = profile?.global_style?.trim() || 'No global style preferences have been set.'
    const convoContext = selectedConversations.map((conversation, index) => {
      const useClean = isPro && bundleModes[conversation.id] === 'clean' && conversation.cleaned_spec
      const sourceLabel = useClean ? 'CLEANED SPEC' : 'RAW THREAD'
      const body = useClean ? conversation.cleaned_spec : conversation.raw_content
      return `## Conversation ${index + 1}: ${conversation.title}\nSource: ${conversation.source_ai}\nTags: ${(conversation.tags || []).join(', ') || 'None'}\nContext mode: ${sourceLabel}\n\n${body}`
    }).join('\n\n---\n\n')
    return `# AGENT.md — ${activeProject?.title || 'Untitled Project'}\n\n## HANDOFF TARGET\n${targetOverride}\n\n## ASSIGNED ROLE\n${activeSkill?.role_name || 'General Assistant'}\n\n## ROLE INSTRUCTIONS\n${activeSkill?.instructions || 'Act as a careful, context-aware collaborator. Ask before making assumptions.'}\n\n## GLOBAL WORKING STYLE\n${style}\n\n## PROJECT DESCRIPTION\n${activeProject?.description || 'No project description supplied.'}\n\n## PROJECT RULES\n${projectRules}\n\n## BUNDLED SOURCE MATERIAL\n${convoContext || 'No raw conversations selected. Do not invent missing context.'}\n\n## MANDATORY 3-POINT CONFIRMATION — DO THIS BEFORE WRITING CODE\n1. **Confirm the role:** State that you understand and accept the assigned role: ${activeSkill?.role_name || 'General Assistant'}.\n2. **Prove context transfer:** Summarize the supplied raw conversations and identify the user's actual goals, constraints and decisions without silently rewriting the source material.\n3. **Expose uncertainty:** List assumptions, contradictions and missing information. Ask focused questions where needed. Do not write or modify code until the user approves this confirmation.\n\n---\nEnd of handoff. Preserve the user's original intent and ask before changing established decisions.\n`
  }

  async function saveHandoff(copyToClipboard = true, targetOverride = targetAi, contentOverride = null) {
    if (!activeProject) { showToast('Create a project before generating a handoff.'); return }
    if (!activeSkill) { showToast('Create or select an AGENT.md role first.'); return }
    const content = contentOverride || makeAgentMd(targetOverride)
    try {
      if (copyToClipboard) await navigator.clipboard.writeText(content)
      const { data, error } = await supabase.from('handoffs').insert({ project_id: activeProject.id, user_id: user.id, target_ai: targetOverride, role_name: activeSkill.role_name, generated_agent_md: content, confirmed: false }).select().single()
      if (error) throw error
      setHandoffs(current => [data, ...current])
      showToast(copyToClipboard ? 'Handoff copied and logged. The receiving AI must confirm before coding.' : 'Handoff logged.')
    } catch (error) { showToast(error.message || 'Could not save this handoff.') }
  }

  async function openInAI(target) {
    if (!activeProject || !activeSkill) { showToast('Select a project and role before launching an AI handoff.'); return }
    const content = makeAgentMd(target)
    const encoded = encodeURIComponent(content)
    const url = target === 'Claude' ? `https://claude.ai/new?q=${encoded}` : `https://chatgpt.com/?q=${encoded}`
    window.open(url, '_blank', 'noopener,noreferrer')
    await saveHandoff(false, target, content)
  }

  async function downloadHandoff() {
    if (!activeProject || !activeSkill) { showToast('Select a project and role before downloading.'); return }
    const content = makeAgentMd()
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = `${(activeProject.title || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-AGENT.md`
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url)
    const { data, error } = await supabase.from('handoffs').insert({ project_id: activeProject.id, user_id: user.id, target_ai: targetAi, role_name: activeSkill.role_name, generated_agent_md: content, confirmed: false }).select().single()
    if (error) { showToast(`Downloaded, but the handoff log failed: ${error.message}`); return }
    setHandoffs(current => [data, ...current])
    showToast('AGENT.md downloaded and logged.')
  }

  function toggleConversation(id) { setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]) }

  async function markHandoffConfirmed(id) {
    const { data, error } = await supabase.from('handoffs').update({ confirmed: true }).eq('id', id).eq('user_id', user.id).select().single()
    if (error) { showToast(error.message); return }
    setHandoffs(current => current.map(item => item.id === id ? data : item)); showToast('Confirmation marked in the handoff log.')
  }

  const currentPlan = isPro ? 'PRO' : 'STARTER'
  return <main className="dashboard-shell">
    <header className="control-bar">
      <div className="control-brand"><Brand/><StatusLine>VAULT SYNCED</StatusLine><span className="control-project-name">/ {activeProject?.title || 'NO PROJECT SELECTED'}</span></div>
      <div className="control-actions"><span className={`plan-chip ${isPro ? 'pro-chip' : ''}`}>{currentPlan}</span><Button variant="ghost" className="small-ghost" onClick={() => setModal({ type: 'style' })}><Settings2 size={15}/> MY GLOBAL STYLE</Button><Button variant="ghost" className="small-ghost" onClick={onSignOut}><LogOut size={15}/> SIGN OUT</Button></div>
    </header>
    <div className="workspace-mobile-tabs"><button className={mobilePanel === 'projects' ? 'active' : ''} onClick={() => setMobilePanel('projects')}>PROJECTS</button><button className={mobilePanel === 'vault' ? 'active' : ''} onClick={() => setMobilePanel('vault')}>RAW VAULT</button><button className={mobilePanel === 'handoff' ? 'active' : ''} onClick={() => setMobilePanel('handoff')}>HANDOFF</button></div>
    <div className="workspace-grid">
      <aside className={`left-rail workspace-panel ${mobilePanel === 'projects' ? 'mobile-active' : ''}`}>
        <div className="panel-heading"><span className="eyebrow">WORKSPACE</span><span className="panel-count">{String(projects.length).padStart(2, '0')}</span></div>
        <Button className="new-project-btn" onClick={requestCreateProject} disabled={busy}><Plus size={16}/> NEW PROJECT</Button>
        {!isPro && <div className="usage-meter"><div><strong>STARTER: {projects.length}/1 PROJECT · {conversations.length}/3 CONVOS</strong></div><Button variant="ghost" onClick={() => setModal({ type: 'upgrade', plan: 'pro' })}>UPGRADE</Button></div>}
        <label className="search-field"><Search size={15}/><input value={projectSearch} onChange={e => setProjectSearch(e.target.value)} placeholder="Search projects" /></label>
        <div className="project-list">{filteredProjects.map(project => <button key={project.id} className={`project-item ${activeProject?.id === project.id ? 'selected' : ''}`} onClick={() => { setActiveProjectId(project.id); setSelectedIds([]); setMobilePanel('vault') }}><FolderKanban size={15}/><span>{project.title}</span><ChevronRight size={14}/></button>)}{!projects.length && <div className="empty-small">No projects yet. Create one to start your vault.</div>}</div>
        <div className="rail-stats"><div><span>CONVOS SAVED</span><strong>{String(conversations.length).padStart(2, '0')}</strong></div><div><span>HANDOFFS</span><strong>{String(handoffs.length).padStart(2, '0')}</strong></div></div>
        <div className="rail-user"><div className="user-initial">{(profile?.display_name || user.email || 'V').slice(0, 1).toUpperCase()}</div><div><strong>{profile?.display_name || user.user_metadata?.display_name || 'Vault owner'}</strong><span>{user.email}</span></div></div>
      </aside>

      <section className={`center-vault workspace-panel ${mobilePanel === 'vault' ? 'mobile-active' : ''}`}>
        <div className="vault-title-row"><div><span className="eyebrow">RAW CONVERSATION VAULT</span><h1 className="display workspace-title">PRESERVE THE SIGNAL.</h1><p className="workspace-subtitle">{activeProject ? activeProject.description || 'Store the exact thinking behind this project.' : 'Create a project, then save your first raw conversation.'}</p></div><Button onClick={requestSaveConversation} disabled={!activeProject || busy}><Plus size={16}/> SAVE RAW CONVO</Button></div>
        <div className="source-filter-row"><div className="source-filters">{SOURCE_AIS.map(source => <button key={source} className={`filter-chip ${sourceFilter === source ? 'active' : ''}`} onClick={() => setSourceFilter(source)}>{source}</button>)}</div><span className="result-count">{visibleConversations.length} RECORDS</span></div>
        <div className="conversation-list">
          {busy && <div className="empty-state"><span className="loading-line"/><p>SYNCING YOUR VAULT...</p></div>}
          {!busy && !projects.length && <div className="empty-state"><FolderKanban size={25}/><h3 className="display">NO PROJECTS IN THE VAULT.</h3><p>Create your first project to give your conversations a home.</p><Button onClick={requestCreateProject}><Plus size={15}/> NEW PROJECT</Button></div>}
          {!busy && projects.length > 0 && visibleConversations.map(conversation => <article key={conversation.id} className="conversation-card">
            <label className="select-record"><input type="checkbox" checked={selectedIds.includes(conversation.id)} onChange={() => toggleConversation(conversation.id)} aria-label={`Bundle ${conversation.title}`}/><span/></label>
            <button className="conversation-main" onClick={() => { setDetail(conversation); setDetailTab('raw') }}><div className="conversation-meta"><span className="source-badge">{conversation.source_ai}</span><span>{formatDate(conversation.created_at)}</span></div><h3>{conversation.title}</h3><p>{(conversation.raw_content || '').slice(0, 160).replace(/\s+/g, ' ')}{(conversation.raw_content || '').length > 160 ? '…' : ''}</p><div className="tag-row">{(conversation.tags || []).map(tag => <span key={tag} className="tag-pill">{tag}</span>)}</div></button>
            <button className="open-record" onClick={() => { setDetail(conversation); setDetailTab('raw') }} aria-label="Open conversation"><ArrowUpRight size={16}/></button>
          </article>)}
          {!busy && projects.length > 0 && !visibleConversations.length && <div className="empty-state"><FileText size={24}/><h3 className="display">NO MATCHING CONVERSATIONS.</h3><p>Save a raw conversation or change the source filter.</p><Button onClick={requestSaveConversation}><Plus size={15}/> SAVE RAW CONVO</Button></div>}
        </div>
        <div className="vault-footnote"><span><ShieldCheck size={14}/> RAW SOURCE PRESERVATION</span><span>SELECTED FOR HANDOFF: {selectedIds.length}</span></div>
      </section>

      <aside className={`right-handoff workspace-panel ${mobilePanel === 'handoff' ? 'mobile-active' : ''}`}>
        <div className="panel-heading"><span className="eyebrow">DYNAMIC HANDOFF ENGINE</span><FileCode2 size={17}/></div>
        <h2 className="display handoff-title">COMPILE THE<br/>NEXT MOVE.</h2>
        <label className="field-label compact-label">TARGET AI<select className="field-input select-input" value={targetAi} onChange={e => setTargetAi(e.target.value)}>{TARGET_AIS.map(ai => <option key={ai}>{ai}</option>)}</select></label>
        <div className="field-label compact-label">ASSIGNED ROLE</div>
        <div className="skill-select-row"><select className="field-input select-input" value={activeSkillId} onChange={e => setActiveSkillId(e.target.value)}><option value="">Select a role</option>{skills.map(skill => <option key={skill.id} value={skill.id}>{skill.role_name}</option>)}</select><button className="square-add" onClick={requestCreateSkill} aria-label="Create skill" disabled={busy}><Plus size={17}/></button></div>
        <div className="bundle-head"><span className="field-label">BUNDLE CONTEXT RECORDS</span><span>{selectedIds.length} SELECTED</span></div>
        <div className="bundle-list">{visibleConversations.map(conversation => <div key={conversation.id} className="bundle-item-row"><label className="bundle-item"><input type="checkbox" checked={selectedIds.includes(conversation.id)} onChange={() => toggleConversation(conversation.id)}/><span>{conversation.title}</span></label>{selectedIds.includes(conversation.id) && <select className="bundle-mode-select" aria-label={`Context mode for ${conversation.title}`} value={bundleModes[conversation.id] || 'raw'} disabled={!isPro} onChange={e => setBundleModes(current => ({ ...current, [conversation.id]: e.target.value }))}><option value="raw">RAW THREAD</option><option value="clean" disabled={!conversation.cleaned_spec}>CLEANED SPEC</option></select>}</div>)}{!visibleConversations.length && <span className="empty-small">No conversations available for this project.</span>}</div>
        <div className="compiled-preview-head"><span className="field-label">LIVE AGENT.MD PREVIEW</span><span className="live-tag"><span className="status-pulse"/>LIVE</span></div>
        <pre className="compiled-preview">{makeAgentMd()}</pre>
        <div className="confirmation-note"><ShieldCheck size={15}/><span>Every handoff includes the required 3-point confirmation before the receiving AI writes code.</span></div>
        <div className="handoff-actions"><Button onClick={() => saveHandoff(true)} disabled={!activeProject || !activeSkill}><Clipboard size={15}/> COPY HANDOFF</Button><Button variant="ghost" onClick={downloadHandoff} disabled={!activeProject || !activeSkill}><Download size={15}/> DOWNLOAD .MD</Button><Button variant="ghost" onClick={() => openInAI('Claude')} disabled={!activeProject || !activeSkill}>OPEN IN CLAUDE ↗</Button><Button variant="ghost" onClick={() => openInAI('ChatGPT')} disabled={!activeProject || !activeSkill}>OPEN IN CHATGPT ↗</Button></div>
        <div className="handoff-history"><div className="history-head"><span className="field-label">RECENT HANDOFFS</span><span>{handoffs.length}</span></div>{handoffs.slice(0, 4).map(handoff => <div className="history-item" key={handoff.id}><span><strong>{handoff.target_ai}</strong><small>{handoff.role_name} · {formatDate(handoff.created_at)}</small></span>{handoff.confirmed ? <span className="confirmed-label"><CheckCircle2 size={13}/> CONFIRMED</span> : <button onClick={() => markHandoffConfirmed(handoff.id)} className="mark-confirmed">MARK CONFIRMED</button>}</div>)}</div>
      </aside>
    </div>

    {detail && <Modal title={detail.title} eyebrow={`${detail.source_ai} / CONVERSATION RECORD`} onClose={() => setDetail(null)} wide>
      <div className="detail-meta"><span>SAVED {formatDate(detail.created_at)}</span><span>{(detail.raw_content || '').length.toLocaleString()} CHARACTERS</span></div>
      <div className="detail-tabs"><button className={detailTab === 'raw' ? 'active' : ''} onClick={() => setDetailTab('raw')}>RAW UNEDITED THREAD</button><button className={detailTab === 'clean' ? 'active' : ''} onClick={() => setDetailTab('clean')}>AI CLEANED SPEC (PRO)</button></div>
      {detailTab === 'raw' ? <pre className="detail-content">{detail.raw_content}</pre> : isPro ? <div className="clean-spec-panel">{detail.cleaned_spec ? <pre className="detail-content">{detail.cleaned_spec}</pre> : <div className="pro-prompt"><Sparkles size={20}/><h3 className="display">CLEAN THE SIGNAL.</h3><p>Generate a structured specification while preserving the intent and decisions in your original thread.</p></div>}<Button disabled={cleaningId === detail.id} onClick={async () => {
        setCleaningId(detail.id)
        try {
          const { data, error } = await supabase.functions.invoke('clean-spec', { body: { raw_content: detail.raw_content, conversation_id: detail.id } })
          if (error) throw error
          const cleaned = data?.cleaned_spec || data?.cleanedSpec || data?.spec
          if (!cleaned) throw new Error('The cleaner returned no cleaned_spec value.')
          const { data: saved, error: saveError } = await supabase.from('conversations').update({ cleaned_spec: cleaned }).eq('id', detail.id).eq('user_id', user.id).select().single()
          if (saveError) throw saveError
          setConversations(current => current.map(item => item.id === saved.id ? saved : item))
          setDetail(saved)
          showToast('Clean spec generated and saved.')
        } catch (error) { showToast(error.message || 'Could not generate the clean spec.') }
        finally { setCleaningId(null) }
      }}><Sparkles size={15}/>{cleaningId === detail.id ? 'GENERATING...' : 'GENERATE CLEAN SPEC'}</Button></div> : <div className="pro-prompt locked-prompt"><Sparkles size={20}/><h3 className="display">STRUCTURED CLARITY. PRO ACCESS.</h3><p>AI Smart Spec Cleaner turns unstructured raw ideas into a clear, reusable project specification.</p><Button onClick={() => setModal({ type: 'upgrade', plan: 'pro' })}>UPGRADE TO PRO <ArrowUpRight size={14}/></Button></div>}
      <div className="modal-actions"><Button variant="ghost" onClick={() => navigator.clipboard?.writeText(detail.raw_content || '').then(() => showToast('Raw thread copied.'))}><Clipboard size={15}/> COPY RAW THREAD</Button><Button onClick={() => setDetail(null)}>CLOSE RECORD</Button></div>
    </Modal>}

    {modal?.type === 'project' && <ProjectModal onClose={() => setModal(null)} onSave={createProject}/>}
    {modal?.type === 'conversation' && <ConversationModal onClose={() => setModal(null)} onSave={saveConversation}/>}
    {modal?.type === 'skill' && <SkillModal onClose={() => setModal(null)} onSave={createSkill}/>}
    {modal?.type === 'style' && <StyleModal initialValue={profile?.global_style || ''} onClose={() => setModal(null)} onSave={updateGlobalStyle}/>}
    {modal?.type === 'upgrade' && <UpgradeModal plan={modal.plan || 'pro'} message={modal.message} email={user.email} isPro={isPro} onClose={() => setModal(null)} onRefresh={refreshPlanStatus} refreshing={refreshingPlan}/>}
    {toast && <div className="toast" role="status"><CheckCircle2 size={16}/>{toast}</div>}
  </main>
}

function UpgradeModal({ plan, message, email, isPro, onClose, onRefresh, refreshing }) {
  const [tab, setTab] = useState('global')
  const checkoutUrl = plan === 'lifetime' ? LIFETIME_CHECKOUT_URL : PRO_CHECKOUT_URL
  const price = plan === 'lifetime' ? '125,000 TZS' : '23,000 TZS'
  const label = plan === 'lifetime' ? 'FOUNDER LIFETIME' : 'PRO VIBE-CODER'
  const payOnline = () => {
    if (!checkoutUrl) return
    const separator = checkoutUrl.includes('?') ? '&' : '?'
    window.open(`${checkoutUrl}${separator}customer_email=${encodeURIComponent(email || '')}`, '_blank', 'noopener,noreferrer')
  }
  return <Modal title="UPGRADE YOUR VAULT" eyebrow="PLAN ACCESS / SECURE CHECKOUT" onClose={onClose} wide>
    <div className="upgrade-summary">
      <span className="field-label">SIGNED-IN ACCOUNT</span>
      <strong>{email}</strong>
      <span className="upgrade-plan-name">{label} · {plan === 'lifetime' ? '$49 ONE-TIME' : '$9 / MONTH'}</span>
      {message && <p>{message}</p>}
      {isPro && <p className="upgrade-status">YOUR PROFILE CURRENTLY REPORTS PRO ACCESS.</p>}
    </div>
    <div className="upgrade-tabs">
      <button className={tab === 'global' ? 'active' : ''} onClick={() => setTab('global')}>GLOBAL CARD / POLAR</button>
      <button className={tab === 'mpesa' ? 'active' : ''} onClick={() => setTab('mpesa')}>TANZANIA M-PESA (LIPA NAMBA)</button>
    </div>
    {tab === 'global' ? <div className="checkout-panel">
      <span className="field-label">CARD CHECKOUT</span>
      <p>Continue to the secure payment page for {label}. Your signed-in email will be attached to the checkout link.</p>
      {checkoutUrl ? <Button className="pay-online-btn" onClick={payOnline}>PAY ONLINE NOW <ArrowUpRight size={15}/></Button> : <div className="notice notice-error"><CircleHelp size={17}/><span>Online checkout is not configured yet. Add {plan === 'lifetime' ? 'VITE_LIFETIME_CHECKOUT_URL' : 'VITE_PRO_CHECKOUT_URL'} to your deployment environment.</span></div>}
    </div> : <div className="checkout-panel mpesa-panel">
      <span className="field-label">PAYMENT DETAILS</span>
      <div className="mpesa-price"><strong>{price}</strong><span>{label}</span></div>
      <div className="mpesa-detail"><span>LIPA NAMBA</span><strong>{LIPA_NAMBA || 'NOT CONFIGURED'}</strong></div>
      <div className="mpesa-detail"><span>ACCOUNT NAME</span><strong>{LIPA_NAME || 'NOT CONFIGURED'}</strong></div>
      <p>Use M-Pesa to pay the amount above. In the payment reference / account field, include your VibeVault account email exactly as shown so the payment can be matched to your account.</p>
      {!LIPA_NAMBA && <div className="notice notice-error"><CircleHelp size={17}/><span>Set VITE_LIPA_NAMBA and VITE_LIPA_NAME in your deployment environment to publish your payment details.</span></div>}
    </div>}
    <div className="upgrade-footer">
      <Button variant="ghost" onClick={onRefresh} disabled={refreshing}><CheckCircle2 size={15}/>{refreshing ? 'REFRESHING...' : 'REFRESH PLAN STATUS'}</Button>
      <Button variant="ghost" onClick={onClose}>CLOSE</Button>
    </div>
  </Modal>
}

function ProjectModal({ onClose, onSave }) {
  const [values, setValues] = useState({ title: '', description: '', project_rules: '', tags: '' })
  const [busy, setBusy] = useState(false)
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await onSave(values) } catch (error) { alert(error.message) } finally { setBusy(false) } }
  return <Modal title="CREATE PROJECT" eyebrow="NEW WORKSPACE" onClose={onClose}><form className="modal-form" onSubmit={submit}><label className="field-label">PROJECT TITLE<input className="field-input" required value={values.title} onChange={e => setValues({ ...values, title: e.target.value })} placeholder="e.g. SurePesa"/></label><label className="field-label">DESCRIPTION<textarea className="field-input field-textarea" value={values.description} onChange={e => setValues({ ...values, description: e.target.value })} placeholder="What are you building?"/></label><label className="field-label">PROJECT RULES<textarea className="field-input field-textarea" value={values.project_rules} onChange={e => setValues({ ...values, project_rules: e.target.value })} placeholder="Architecture decisions, constraints, conventions..."/></label><label className="field-label">TAGS<input className="field-input" value={values.tags} onChange={e => setValues({ ...values, tags: e.target.value })} placeholder="fintech, react, backend"/></label><div className="modal-actions"><Button variant="ghost" type="button" onClick={onClose}>CANCEL</Button><Button disabled={busy}>{busy ? 'CREATING...' : 'CREATE PROJECT'}</Button></div></form></Modal>
}

function ConversationModal({ onClose, onSave }) {
  const [values, setValues] = useState({ title: '', source_ai: 'ChatGPT', raw_content: '', tags: '' })
  const [busy, setBusy] = useState(false)
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await onSave(values) } catch (error) { alert(error.message) } finally { setBusy(false) } }
  return <Modal title="SAVE RAW CONVERSATION" eyebrow="PRESERVE ORIGINAL CONTEXT" onClose={onClose} wide><form className="modal-form" onSubmit={submit}><div className="form-two-col"><label className="field-label">RECORD TITLE<input className="field-input" required value={values.title} onChange={e => setValues({ ...values, title: e.target.value })} placeholder="Describe this conversation"/></label><label className="field-label">SOURCE AI<select className="field-input" value={values.source_ai} onChange={e => setValues({ ...values, source_ai: e.target.value })}>{SOURCE_AIS.filter(x => x !== 'ALL').map(ai => <option key={ai} value={ai.charAt(0) + ai.slice(1).toLowerCase()}>{ai}</option>)}</select></label></div><label className="field-label">RAW THREAD<textarea className="field-input field-textarea raw-input" required value={values.raw_content} onChange={e => setValues({ ...values, raw_content: e.target.value })} placeholder="Paste the exact conversation here. VibeVault stores this text without rewriting it."/></label><label className="field-label">TAGS<input className="field-input" value={values.tags} onChange={e => setValues({ ...values, tags: e.target.value })} placeholder="architecture, bug-fix, product-thinking"/></label><div className="raw-integrity"><ShieldCheck size={15}/> The original text is saved as supplied. No automatic cleanup is applied.</div><div className="modal-actions"><Button variant="ghost" type="button" onClick={onClose}>CANCEL</Button><Button disabled={busy}>{busy ? 'SAVING...' : 'SAVE RAW THREAD'}</Button></div></form></Modal>
}

function SkillModal({ onClose, onSave }) {
  const [values, setValues] = useState({ role_name: '', instructions: '' })
  const [busy, setBusy] = useState(false)
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await onSave(values) } catch (error) { alert(error.message) } finally { setBusy(false) } }
  return <Modal title="CREATE ROLE SKILL" eyebrow="DYNAMIC AGENT.MD" onClose={onClose}><form className="modal-form" onSubmit={submit}><label className="field-label">ROLE NAME<input className="field-input" required value={values.role_name} onChange={e => setValues({ ...values, role_name: e.target.value })} placeholder="e.g. Data Architect"/></label><label className="field-label">ROLE INSTRUCTIONS<textarea className="field-input field-textarea" required value={values.instructions} onChange={e => setValues({ ...values, instructions: e.target.value })} placeholder="Define responsibilities, working style and boundaries..."/></label><div className="modal-actions"><Button variant="ghost" type="button" onClick={onClose}>CANCEL</Button><Button disabled={busy}>{busy ? 'CREATING...' : 'CREATE SKILL'}</Button></div></form></Modal>
}

function StyleModal({ initialValue, onClose, onSave }) {
  const [value, setValue] = useState(initialValue)
  const [busy, setBusy] = useState(false)
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await onSave(value) } catch (error) { alert(error.message) } finally { setBusy(false) } }
  return <Modal title="MY GLOBAL STYLE" eyebrow="PERSONAL OPERATING RULES" onClose={onClose}><form className="modal-form" onSubmit={submit}><p className="modal-explainer">These preferences are attached to every generated handoff, regardless of target AI or selected project.</p><label className="field-label">GLOBAL STYLE & WORKING PREFERENCES<textarea className="field-input field-textarea style-textarea" value={value} onChange={e => setValue(e.target.value)} placeholder="I prefer concepts before code, clear explanations, minimal assumptions..."/></label><div className="modal-actions"><Button variant="ghost" type="button" onClick={onClose}>CANCEL</Button><Button disabled={busy}>{busy ? 'SAVING...' : 'SAVE GLOBAL STYLE'}</Button></div></form></Modal>
}

function formatDate(value) {
  if (!value) return 'JUST NOW'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default App
