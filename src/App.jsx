import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Archive, Check, CheckCircle2, ChevronDown,
  ChevronRight, CircleHelp, Clipboard, Cloud, Code2, Command, Download, FileCode2,
  FileJson, FileText, FolderKanban, Inbox, KeyRound, Layers3, LogOut, Menu, Plus, Plug,
  Search, Settings2, ShieldCheck, Sparkles, Upload, X, Activity, Bot, BookOpen, Braces,
  CircleDot, Clock3, Code, File, GitBranch, History, LayoutDashboard, MessageSquareText,
  PanelsTopLeft, Terminal, Workflow, Zap, Github
} from 'lucide-react'
import { hasSupabaseConfig, supabase } from './lib/supabase'

const PRO_CHECKOUT_URL = import.meta.env.VITE_PRO_CHECKOUT_URL || ''
const LIFETIME_CHECKOUT_URL = import.meta.env.VITE_LIFETIME_CHECKOUT_URL || ''
const LIPA_NAMBA = import.meta.env.VITE_LIPA_NAMBA || ''
const LIPA_NAME = import.meta.env.VITE_LIPA_NAME || ''

// Make it obvious when the isolated Cloudflare feature preview is open.
const IS_FEATURE_PREVIEW_HOST = typeof window !== 'undefined' && /^(?:feature-professional-workspace-redesign|[a-f0-9]{8})-vibevault\.vibevault-hq\.workers\.dev$/i.test(window.location.hostname)

const SOURCE_AIS = ['ALL', 'CLAUDE', 'CHATGPT', 'GEMINI', 'CURSOR', 'WINDSURF', 'PERPLEXITY', 'DEEPSEEK', 'LOVABLE', 'BASE44', 'TRAE', 'QODER', 'OTHER']
const TARGET_AIS = ['Claude', 'ChatGPT', 'Gemini', 'Cursor', 'Windsurf', 'Perplexity', 'DeepSeek', 'Lovable', 'Base44', 'Trae', 'Qoder', 'Other']
const DEFAULT_SKILLS = [
  { role_name: 'Backend Architect', instructions: 'Design reliable APIs, data models, authorization and backend services. Explain trade-offs before implementation.', is_default: true },
  { role_name: 'UI Designer', instructions: 'Translate product intent into precise, accessible interfaces. Preserve the existing design system and responsive behavior.', is_default: true },
  { role_name: 'Image Prompt Engineer', instructions: 'Turn the supplied visual direction into detailed, production-ready image generation prompts. Preserve all constraints.', is_default: true }
]

const AI_PROVIDERS = [
  { name: 'Claude', logo: 'https://cdn.simpleicons.org/anthropic', description: 'Reasoning, writing and development', role: 'Development partner' },
  { name: 'ChatGPT', logo: 'https://cdn.simpleicons.org/openai', description: 'Planning, analysis and general assistance', role: 'Research & planning' },
  { name: 'Gemini', logo: 'https://cdn.simpleicons.org/googlegemini', description: 'Research and multimodal workflows', role: 'Research & multimodal' },
  { name: 'Cursor', logo: 'https://cdn.simpleicons.org/cursor', description: 'Code editing and implementation', role: 'IDE implementation' },
  { name: 'Windsurf', logo: 'https://cdn.simpleicons.org/windsurf', description: 'Agentic coding workflows', role: 'Coding agent' },
  { name: 'Perplexity', logo: 'https://cdn.simpleicons.org/perplexity', description: 'Web research and source discovery', role: 'Web researcher' },
  { name: 'DeepSeek', logo: 'https://cdn.simpleicons.org/deepseek', description: 'Technical reasoning and problem solving', role: 'Reasoning specialist' },
  { name: 'Lovable', logo: 'https://cdn.simpleicons.org/lovable', description: 'Prompt-to-app product building', role: 'App builder' },
  { name: 'Base44', logo: '', description: 'No-code and AI app building', role: 'App builder' },
  { name: 'Trae', logo: '', description: 'AI-assisted development environment', role: 'Coding assistant' },
  { name: 'Qoder', logo: '', description: 'Agentic software development', role: 'Coding agent' },
  { name: 'Other', logo: '', description: 'A provider not listed here', role: 'General assistant' }
]
const EMPTY_AI_PREFERENCES = { providers: {}, last_target: 'Claude', recommendations: false, profile: {} }

function readArchiveMessageContent(content) {
  if (typeof content === 'string') return content
  if (!content) return ''
  if (Array.isArray(content)) return content.map(readArchiveMessageContent).filter(Boolean).join('\n')
  if (Array.isArray(content.parts)) return content.parts.map(readArchiveMessageContent).filter(Boolean).join('\n')
  if (typeof content.text === 'string') return content.text
  if (typeof content.value === 'string') return content.value
  return ''
}

function parseImportedConversations(raw, filename, fallbackSource = 'ChatGPT') {
  const extension = (filename || '').split('.').pop()?.toLowerCase()
  if (extension === 'json' || extension === 'jsonl' || /^[\s]*[\[{]/.test(raw)) {
    try {
      const parsed = extension === 'jsonl'
        ? raw.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
        : JSON.parse(raw)
      const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.conversations) ? parsed.conversations : [parsed]
      const mapped = records.map((item, index) => {
        const messages = []
        if (item?.mapping && typeof item.mapping === 'object') {
          Object.values(item.mapping).forEach(node => {
            const message = node?.message
            if (!message) return
            const role = message.author?.role || message.author?.name || 'message'
            const body = readArchiveMessageContent(message.content)
            if (body.trim()) messages.push({ role, body, time: message.create_time || 0 })
          })
        } else if (Array.isArray(item?.messages)) {
          item.messages.forEach(message => {
            const role = message.role || message.author?.role || message.author || 'message'
            const body = readArchiveMessageContent(message.content ?? message.text ?? message.parts)
            if (body.trim()) messages.push({ role, body, time: message.timestamp || message.create_time || 0 })
          })
        }
        messages.sort((a, b) => Number(a.time || 0) - Number(b.time || 0))
        if (!messages.length) return null
        const title = String(item.title || item.name || 'Imported conversation ' + (index + 1)).slice(0, 180)
        const transcript = messages.map(message => '## ' + String(message.role).toUpperCase() + '\n' + message.body).join('\n\n')
        return {
          title, source_ai: fallbackSource, raw_content: transcript,
          tags: ['archive-import'], source_payload: item,
          capture_metadata: { import_method: 'json_archive', message_count: messages.length, original_filename: filename || '' }
        }
      }).filter(Boolean)
      if (mapped.length) return mapped
    } catch (error) {
      throw new Error('This JSON file could not be parsed. Export the conversation again or use a plain-text / Markdown file.')
    }
  }
  if (!raw.trim()) throw new Error('The selected file is empty.')
  const name = (filename || 'Imported conversation').replace(/\.[^.]+$/, '').slice(0, 180)
  return [{ title: name || 'Imported conversation', source_ai: fallbackSource, raw_content: raw, tags: ['file-import'], source_payload: null, capture_metadata: { import_method: 'file', original_filename: filename || '' } }]
}

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
  const authEventVersion = useRef(0)
  const [splash, setSplash] = useState(!sessionStorage.getItem('vibevault-splash-seen'))

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return }
    let alive = true
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // A newer auth event wins over the initial getSession result.
      authEventVersion.current += 1
      setSession(nextSession)
      setAuthReady(true)
    })
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive || error) return
      if (authEventVersion.current === 0) setSession(data.session)
      setAuthReady(true)
    }).catch(() => { if (alive) setAuthReady(true) })
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!authReady) return
    if (location.pathname === '/auth/callback') {
      if (session) {
        const pendingPlan = sessionStorage.getItem('vibevault-pending-upgrade') || location.state?.upgradePlan || null
        if (pendingPlan) sessionStorage.removeItem('vibevault-pending-upgrade')
        navigate('/app', { replace: true, state: pendingPlan ? { upgradePlan: pendingPlan } : undefined })
      } else {
        const params = new URLSearchParams(location.search)
        const callbackError = params.get('error_description') || params.get('error') || 'GitHub authorization did not return an active VibeVault session.'
        navigate('/auth?oauth=failed', { replace: true, state: { oauthError: callbackError } })
      }
      return
    }
    if (session && location.pathname === '/') {
      const pendingPlan = sessionStorage.getItem('vibevault-pending-upgrade')
      if (pendingPlan) {
        sessionStorage.removeItem('vibevault-pending-upgrade')
        navigate('/app', { replace: true, state: { upgradePlan: pendingPlan } })
      }
      return
    }
    if (session && location.pathname.startsWith('/auth')) {
      const pendingPlan = sessionStorage.getItem('vibevault-pending-upgrade') || location.state?.upgradePlan || null
      if (pendingPlan) sessionStorage.removeItem('vibevault-pending-upgrade')
      navigate('/app', { replace: true, state: pendingPlan ? { upgradePlan: pendingPlan } : undefined })
    }
  }, [session, authReady, location.pathname, location.search, location.state, navigate])

  useEffect(() => {
    if (!splash) return
    const timer = window.setTimeout(() => {
      setSplash(false)
      sessionStorage.setItem('vibevault-splash-seen', '1')
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [splash])

  const skipSplash = () => {
    setSplash(false)
    sessionStorage.setItem('vibevault-splash-seen', '1')
  }
  const openWorkspace = () => navigate(session ? '/app' : '/auth')
  const openPlan = (plan) => {
    if (plan === 'starter') {
      navigate(session ? '/app' : '/auth', { state: session ? undefined : { authMode: 'signup' } })
      return
    }
    navigate(session ? '/app' : '/auth', { state: { upgradePlan: plan } })
  }
  const signOut = async () => {
    try { await supabase?.auth.signOut() } finally { navigate('/', { replace: true }) }
  }

  let screen
  if (location.pathname === '/auth/callback') {
    screen = session
      ? <AuthRedirect ready={authReady} onGo={() => navigate('/app', { replace: true })}/>
      : <AuthCallbackStatus ready={authReady}/>
  } else if (location.pathname.startsWith('/auth')) {
    screen = session
      ? <AuthRedirect ready={authReady} onGo={() => navigate('/app', { replace: true, state: location.state })}/>
      : <AuthPage initialMode={location.state?.authMode} pendingPlan={location.state?.upgradePlan || sessionStorage.getItem('vibevault-pending-upgrade')} oauthError={location.state?.oauthError} onBack={() => navigate('/')} onSuccess={() => navigate('/app', { state: location.state })}/>
  } else if (location.pathname.startsWith('/app')) {
    screen = authReady && session
      ? <Dashboard session={session} initialPlan={location.state?.upgradePlan} onSignOut={signOut}/>
      : <AuthRedirect ready={authReady} onGo={() => navigate('/auth')}/>
  } else {
    screen = <Landing session={session} onAuth={openWorkspace} onWorkspace={() => navigate('/app')} onPlanClick={openPlan}/>
  }

  return <>
    {screen}
    {splash && <Splash onSkip={skipSplash}/>}
  </>
}

function AuthCallbackStatus({ ready }) {
  return <div className="auth-redirect"><StatusLine>GITHUB AUTHENTICATION</StatusLine><h1 className="display">{ready ? 'FINALIZING ACCESS' : 'RESTORING SESSION'}</h1><p>{ready ? 'Returning to your VibeVault workspace.' : 'Verifying your GitHub identity and restoring your session.'}</p><span className="auth-progress-spinner"/></div>
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

function Landing({ session, onAuth, onWorkspace, onPlanClick }) {
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  return <main className="landing-page">
    <header className="top-nav">
      <a href="#top" className="nav-brand"><Brand/><StatusLine/></a>
      <nav className="nav-links" aria-label="Main navigation">
        <button onClick={() => scrollTo('relay-loop')}>HOW IT WORKS</button>
        <button onClick={() => scrollTo('subscriptions')}>SUBSCRIPTIONS</button>
        <span className={session ? 'visitor-state visitor-signed-in' : 'visitor-state'}>{session ? 'SIGNED IN · ' + (session.user.email || 'ACCOUNT ACTIVE') : 'GUEST SESSION'}</span>
        <Button onClick={session ? onWorkspace : onAuth}>{session ? 'OPEN WORKSPACE' : 'SIGN IN'} <ArrowUpRight size={15}/></Button>
      </nav>
      <button className="mobile-menu icon-button" onClick={() => scrollTo('relay-loop')} aria-label="Jump to sections"><Menu size={19}/></button>
    </header>

    <section id="top" className="hero-section">
      <div className="hero-rings" />
      <div className="hero-content">
        <div className="eyebrow hero-eyebrow"><span className="eyebrow-rule"/>CLOUD AI MEMORY & DYNAMIC HANDOFF CONTROL</div>
        <h1 className="display hero-title">STOP TREATING EVERY AI<br/><span className="hero-gradient">LIKE A STRANGER</span></h1>
        <p className="hero-copy">GitHub stores your code. VibeVault stores your exact raw AI conversations, personal coding rules, and role-specific <code>AGENT.md</code> handoffs across Claude, ChatGPT, Lovable, Base44, Trae, and Qoder.</p>
        <div className="hero-actions"><Button variant="ghost" onClick={() => scrollTo('relay-loop')}>EXPLORE HOW IT WORKS <ArrowDown size={15}/></Button></div>
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
          <Reveal delay={0}><PlanCard name="STARTER VAULT" price="$0" period="FOREVER" features={['1 active project','3 saved raw conversations','3 built-in AGENT.md roles','1-click launch in Claude & ChatGPT']} action={session ? 'OPEN WORKSPACE' : 'START FREE'} onClick={() => onPlanClick('starter')}/></Reveal>
          <Reveal delay={100}><PlanCard featured name="PRO VIBE-CODER" price="$9" period="MONTH" features={['Unlimited projects & raw conversations','Built-in AI Smart Spec Cleaner','Unlimited custom AGENT.md roles','Priority MCP plugin access']} action="UPGRADE TO PRO" onClick={() => onPlanClick('pro')}/></Reveal>
          <Reveal delay={200}><PlanCard name="FOUNDER LIFETIME" price="$49" period="ONE-TIME" badge="FIRST 50 FOUNDERS" features={['Everything in Pro forever','Zero monthly bills','VIP Founder badge','Direct feature voting']} action="CLAIM FOUNDER LIFETIME" onClick={() => onPlanClick('lifetime')}/></Reveal>
        </div>
        
      </div>
    </section>

    <section className="final-cta">
      <div className="section-container cta-inner"><div><div className="eyebrow"><span className="eyebrow-rule"/>YOUR MEMORY. YOUR RULES.</div><h2 className="display cta-title">YOUR IDEAS BELONG TO YOU.<br/>NOT ONE AI TAB.</h2></div><span className="final-cta-note">{session ? 'YOUR PROJECTS AND CONVERSATIONS ARE READY IN THE WORKSPACE.' : 'SIGN IN ONCE TO KEEP YOUR PROJECT CONTEXT AVAILABLE ACROSS SESSIONS.'}</span></div>
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

function AuthPage({ onBack, onSuccess, pendingPlan, oauthError, initialMode }) {
  const [mode, setMode] = useState(initialMode || 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(oauthError ? { type: 'error', text: oauthError } : null)

  useEffect(() => {
    if (pendingPlan) sessionStorage.setItem('vibevault-pending-upgrade', pendingPlan)
  }, [pendingPlan])

  const continueWithGithub = async () => {
    setNotice(null)
    if (!hasSupabaseConfig) { setNotice({ type: 'error', text: 'Supabase is not connected yet. Configure your project URL and anon key first.' }); return }
    if (pendingPlan) sessionStorage.setItem('vibevault-pending-upgrade', pendingPlan)
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: window.location.origin + '/auth/callback' }
      })
      if (error) throw error
      // Leave the loading state visible while the browser redirects to GitHub.
    } catch (error) {
      sessionStorage.removeItem('vibevault-pending-upgrade')
      setBusy(false)
      setNotice({ type: 'error', text: error.message || 'GitHub sign-in could not be started.' })
    }
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
          options: { data: { display_name: displayName.trim() }, emailRedirectTo: window.location.origin + '/auth/callback' }
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
    {IS_FEATURE_PREVIEW_HOST && <div className="auth-preview-notice" role="note"><strong>FEATURE PREVIEW — SIGN-IN ROUTING</strong><span>This preview uses a separate website address. Add this exact callback to Supabase → Authentication → URL Configuration → Redirect URLs to keep GitHub sign-in on this preview:</span><code>{window.location.origin + '/auth/callback'}</code><small>If sign-in returns you to <b>vibevault.vibevault-hq.workers.dev</b>, Supabase sent you to production instead of this preview.</small></div>}<div className="auth-top"><button className="back-link" onClick={onBack}><ArrowLeft size={15}/> BACK TO BRIEFING</button><Brand/><StatusLine>ENCRYPTED SESSION</StatusLine></div>
    <div className="auth-layout">
      <aside className="auth-aside tactical-grid"><span className="eyebrow"><span className="eyebrow-rule"/>VAULT ACCESS</span><h1 className="display auth-title">ENTER<br/>CONTROL ROOM.</h1><p>Your conversations are the source material. Your rules are the operating system. Keep both in one place.</p><div className="auth-aside-meta"><span>VV-SECURE / 01</span><span>PERSONAL AI MEMORY</span></div></aside>
      <section className="auth-form-area">
        <div className="auth-form-head"><span className="eyebrow">IDENTITY CHECK</span><h2 className="display">{mode === 'signin' ? 'WELCOME BACK.' : 'BUILD YOUR VAULT.'}</h2><p>{mode === 'signin' ? 'Enter your credentials to restore your working context.' : 'Create an account to start preserving your AI work.'}</p></div>
        <div className="auth-tabs"><button className={mode === 'signin' ? 'active' : ''} onClick={() => { setMode('signin'); setNotice(null) }}>SIGN IN</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setNotice(null) }}>CREATE ACCOUNT</button></div>
        <div className="auth-provider-block">
          <button className="github-auth-btn" type="button" onClick={continueWithGithub} disabled={busy}>
            <span className="github-auth-icon"><Github size={21}/></span>
            <span className="github-auth-copy"><strong>{busy ? 'CONNECTING TO GITHUB…' : 'Continue with GitHub'}</strong><small>Secure sign-in with your GitHub account</small></span>
            {busy ? <span className="github-auth-spinner"/> : <ArrowUpRight className="github-auth-arrow" size={17}/>}
          </button>
        </div>
        <div className="auth-divider"><span>OR USE EMAIL</span></div>
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


function InlineDocumentText({ text }) {
  const fragments = String(text || '').split(/(\x60[^\x60]+\x60|\*\*[^*]+\*\*)/g)
  return <>{fragments.map((fragment, index) => {
    if (fragment.charCodeAt(0) === 96 && fragment.endsWith(String.fromCharCode(96))) return <code className="inline-code" key={index}>{fragment.slice(1, -1)}</code>
    if (fragment.startsWith('**') && fragment.endsWith('**')) return <strong key={index}>{fragment.slice(2, -2)}</strong>
    return <React.Fragment key={index}>{fragment}</React.Fragment>
  })}</>
}

function EditorCodeBlock({ language, code }) {
  const lines = String(code || '').replace(/\n$/, '').split('\n')
  const copy = async () => {
    try { await navigator.clipboard.writeText(code) } catch { /* Clipboard may be unavailable. */ }
  }
  return <div className="editor-code-block">
    <div className="editor-code-toolbar"><span><Code size={13}/>{language || 'CODE'}</span><button onClick={copy} type="button"><Clipboard size={13}/> COPY</button></div>
    <div className="editor-code-body"><div className="editor-line-numbers">{lines.map((_, index) => <span key={index}>{index + 1}</span>)}</div><pre><code>{lines.join('\n')}</code></pre></div>
  </div>
}

function RichDocumentBody({ text }) {
  const parts = String(text || '').split(/\x60{3}([^\n]*)\n([\s\S]*?)\x60{3}/g)
  return <div className="rich-document-body">{parts.map((part, index) => {
    if (index % 3 === 1) return null
    if (index % 3 === 2) return <EditorCodeBlock key={index} language={parts[index - 1]?.trim()} code={part}/>
    const blocks = part.split(/\n{2,}/).map(value => value.trim()).filter(Boolean)
    return blocks.map((block, blockIndex) => {
      const heading = block.match(/^(#{1,3})\s+(.+)$/)
      if (heading) {
        const Tag = heading[1].length === 1 ? 'h2' : heading[1].length === 2 ? 'h3' : 'h4'
        return <Tag className="document-heading" key={index + '-' + blockIndex}><InlineDocumentText text={heading[2]}/></Tag>
      }
      const listLines = block.split('\n').filter(line => /^\s*[-*]\s+/.test(line))
      if (listLines.length === block.split('\n').length && listLines.length > 0) {
        return <ul className="document-list" key={index + '-' + blockIndex}>{listLines.map((line, itemIndex) => <li key={itemIndex}><InlineDocumentText text={line.replace(/^\s*[-*]\s+/, '')}/></li>)}</ul>
      }
      return <p className="document-paragraph" key={index + '-' + blockIndex}><InlineDocumentText text={block}/></p>
    })
  })}</div>
}

function ConversationEditor({ conversation, mode, isPro, onModeChange, onClean, cleaning }) {
  const content = mode === 'clean' && conversation.cleaned_spec ? conversation.cleaned_spec : conversation.raw_content
  const chunks = String(content || '').split(/(?=^## (?:USER|ASSISTANT|SYSTEM|DEVELOPER)\s*$)/gim).filter(Boolean)
  const rolePattern = /^## (USER|ASSISTANT|SYSTEM|DEVELOPER)\s*\n/i
  return <div className="conversation-editor">
    <div className="document-toolbar">
      <div className="document-toolbar-left">
        <span className="document-provider">{conversation.source_ai}</span>
        <span className="document-meta"><Clock3 size={12}/>{formatDate(conversation.created_at)}</span>
        <span className="document-meta"><FileText size={12}/>{(conversation.raw_content || '').length.toLocaleString()} chars</span>
      </div>
      <div className="document-toolbar-right">
        <div className="document-mode-switch"><button className={mode === 'raw' ? 'active' : ''} onClick={() => onModeChange('raw')}>ORIGINAL</button><button className={mode === 'clean' ? 'active' : ''} onClick={() => onModeChange('clean')}>SPEC</button></div>
        <button className="editor-action" onClick={() => navigator.clipboard?.writeText(content || '')}><Clipboard size={13}/> COPY</button>
        <button className="editor-action" onClick={() => {
          const blob = new Blob([content || ''], { type: 'text/markdown;charset=utf-8' })
          const url = URL.createObjectURL(blob)
          const anchor = document.createElement('a')
          anchor.href = url
          anchor.download = (conversation.title || 'conversation').toLowerCase().replace(/[^a-z0-9]+/g, '-') + (mode === 'clean' ? '-spec.md' : '.md')
          anchor.click()
          URL.revokeObjectURL(url)
        }}><Download size={13}/> EXPORT</button>
      </div>
    </div>
    {mode === 'clean' && !conversation.cleaned_spec && <div className="document-empty-spec"><Sparkles size={19}/><div><strong>No structured specification yet</strong><span>Generate a project brief from the preserved original. The raw conversation will remain unchanged.</span></div><Button onClick={onClean} disabled={!isPro || cleaning}>{cleaning ? 'PROCESSING...' : isPro ? 'GENERATE SPEC' : 'PRO FEATURE'}</Button></div>}
    {mode === 'clean' && !conversation.cleaned_spec && !isPro && <div className="document-pro-note">Upgrade to Pro to generate a structured specification.</div>}
    {(mode === 'raw' || conversation.cleaned_spec) && <div className="transcript-scroll">
      {chunks.map((chunk, index) => {
        const match = chunk.match(rolePattern)
        const role = match?.[1]?.toLowerCase()
        const body = match ? chunk.slice(match[0].length).trim() : chunk.trim()
        if (!body) return null
        return role
          ? <article className={'transcript-turn turn-' + role} key={index}>
              <header className="transcript-turn-head"><span className={'turn-avatar avatar-' + role}>{role === 'assistant' ? <Bot size={14}/> : role === 'user' ? 'U' : <Terminal size={13}/>}</span><strong>{role === 'assistant' ? conversation.source_ai : role.toUpperCase()}</strong><span className="turn-label">{role === 'assistant' ? 'AI RESPONSE' : role === 'user' ? 'PROMPT' : 'SYSTEM CONTEXT'}</span></header>
              <RichDocumentBody text={body}/>
            </article>
          : <article className="transcript-source-section" key={index}><RichDocumentBody text={body}/></article>
      })}
    </div>}
  </div>
}

function WorkspaceStat({ icon: Icon, label, value, detail }) {
  return <div className="workspace-stat"><span className="workspace-stat-icon"><Icon size={16}/></span><span className="workspace-stat-copy"><small>{label}</small><strong>{value}</strong><em>{detail}</em></span></div>
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
  const [captureInbox, setCaptureInbox] = useState([])
  const [integrationTokens, setIntegrationTokens] = useState([])
  const [providerPreferences, setProviderPreferences] = useState(EMPTY_AI_PREFERENCES)
  const [generatedToken, setGeneratedToken] = useState('')
  const [showTechnicalHandoff, setShowTechnicalHandoff] = useState(false)
  const [activePane, setActivePane] = useState('overview')
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [transcriptMode, setTranscriptMode] = useState('raw')
  const [taskPrompt, setTaskPrompt] = useState('')
  const [decisions, setDecisions] = useState([])
  const [sessionSummaries, setSessionSummaries] = useState([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [mobileAgentVisible, setMobileAgentVisible] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0] || null
  const isPro = Boolean(profile?.is_pro)
  const activeSkill = skills.find(skill => skill.id === activeSkillId) || skills[0] || null
  const filteredProjects = projects.filter(p => p.title?.toLowerCase().includes(projectSearch.toLowerCase()))
  const visibleConversations = useMemo(() => conversations.filter(c => {
    const sameProject = !activeProject || c.project_id === activeProject.id
    const sameSource = sourceFilter === 'ALL' || c.source_ai?.toUpperCase() === sourceFilter
    return sameProject && sameSource
  }), [conversations, activeProject, sourceFilter])
  const selectedConversations = conversations.filter(c => c.project_id === activeProject?.id && selectedIds.includes(c.id))
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const entries = [
      ...projects.map(item => ({ kind: 'project', id: item.id, projectId: item.id, title: item.title, detail: item.description || 'Project workspace', searchText: item.project_rules || '' })),
      ...conversations.map(item => ({ kind: 'conversation', id: item.id, projectId: item.project_id, title: item.title, detail: (item.source_ai || 'AI conversation') + ' · ' + formatDate(item.created_at), searchText: item.raw_content || '' })),
      ...decisions.map(item => ({ kind: 'decision', id: item.id, projectId: item.project_id, title: item.title, detail: 'Decision · ' + (item.status || 'record'), searchText: item.content || '' })),
      ...sessionSummaries.map(item => ({ kind: 'summary', id: item.id, projectId: item.project_id, title: item.title, detail: 'Session summary · ' + (item.source_ai || 'AI session'), searchText: item.summary || '' }))
    ]
    const filtered = query
      ? entries.filter(item => (item.title + ' ' + item.detail + ' ' + item.searchText).toLowerCase().includes(query))
      : [
          ...conversations.slice(0, 5).map(item => ({ kind: 'conversation', id: item.id, projectId: item.project_id, title: item.title, detail: (item.source_ai || 'AI conversation') + ' · ' + formatDate(item.created_at) })),
          ...projects.slice(0, 3).map(item => ({ kind: 'project', id: item.id, projectId: item.id, title: item.title, detail: item.description || 'Project workspace' }))
        ]
    return filtered.slice(0, 12)
  }, [searchQuery, projects, conversations, decisions, sessionSummaries])

  useEffect(() => {
    if (initialPlan) setModal({ type: 'upgrade', plan: initialPlan })
  }, [initialPlan])

  useEffect(() => {
    const handleWorkspaceShortcut = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', handleWorkspaceShortcut)
    return () => window.removeEventListener('keydown', handleWorkspaceShortcut)
  }, [])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setBusy(true)
      try {
        // Load the profile first: onboarding must not wait for unrelated workspace tables.
        const profileRes = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
        if (profileRes.error) throw profileRes.error
        let nextProfile = profileRes.data
        if (!nextProfile) {
          const { data, error } = await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email,
            display_name: user.user_metadata?.display_name || ''
          }).select().single()
          if (error) throw error
          nextProfile = data
        }
        if (!mounted) return
        setProfile(nextProfile)
        const preferences = nextProfile.ai_preferences || EMPTY_AI_PREFERENCES
        setProviderPreferences(preferences)
        setTargetAi(preferences.last_target || 'Claude')
        const hasConfiguredProvider = Object.values(preferences.providers || {}).some(provider => provider?.enabled)
        const hasPersonalisedProfile = Boolean(preferences.profile?.focus && preferences.profile?.collaboration)
        // Legacy or incomplete profiles should still receive first-run setup.
        if (!nextProfile.onboarding_completed || !hasConfiguredProvider || !hasPersonalisedProfile) {
          setModal({ type: 'ai', onboarding: true })
        }

        // Secondary workspace data is loaded after onboarding has been scheduled.
        const results = await Promise.allSettled([
          supabase.from('projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('conversations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('agent_skills').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
          supabase.from('handoffs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
          supabase.from('capture_inbox').select('*').eq('user_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }),
          supabase.from('integration_tokens').select('id,label,scope,created_at,last_used_at,revoked_at').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('project_decisions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(150),
          supabase.from('session_summaries').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100)
        ])
        if (!mounted) return
        const data = results.map((result, index) => {
          if (result.status === 'rejected') {
            showToast(result.reason?.message || 'Some workspace data could not be loaded.')
            return []
          }
          if (result.value.error) {
            showToast(result.value.error.message || 'Some workspace data could not be loaded.')
            return []
          }
          return result.value.data || []
        })
        const [projectData, conversationData, skillData, handoffData, inboxData, tokenData, decisionData, summaryData] = data
        setProjects(projectData)
        setConversations(conversationData)
        setHandoffs(handoffData)
        setCaptureInbox(inboxData)
        setIntegrationTokens(tokenData)
        setDecisions(decisionData)
        setSessionSummaries(summaryData)
        let nextSkills = skillData
        if (nextSkills.length === 0) {
          const defaults = DEFAULT_SKILLS.map(skill => ({ ...skill, user_id: user.id }))
          const { data: insertedSkills, error: insertSkillsError } = await supabase.from('agent_skills').insert(defaults).select()
          if (insertSkillsError) showToast(insertSkillsError.message || 'Default agents could not be created.')
          else nextSkills = insertedSkills || []
        }
        if (!mounted) return
        setSkills(nextSkills)
        setActiveProjectId(projectData[0]?.id || null)
        setActiveSkillId(nextSkills[0]?.id || '')
      } catch (error) {
        if (mounted) showToast(error.message || 'Could not load your account profile.')
      } finally {
        if (mounted) setBusy(false)
      }
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

  function openWorkspaceSearchResult(result) {
    setActiveProjectId(result.projectId || null)
    setActiveConversationId(null)
    setSelectedIds([])
    if (result.kind === 'conversation') {
      setActiveConversationId(result.id)
      setSelectedIds([result.id])
      setActivePane('conversation')
    } else if (result.kind === 'decision') setActivePane('decisions')
    else if (result.kind === 'summary') setActivePane('summaries')
    else setActivePane('overview')
    setMobileAgentVisible(false)
    setSearchOpen(false)
    setSearchQuery('')
  }

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
    if (!activeProject) { showToast('Create or select a project before importing a conversation.'); return }
    if (!isPro && conversations.length >= 3) {
      setModal({ type: 'upgrade', plan: 'pro', message: 'Starter Vault limit reached (3/3 Convos). Upgrade to keep vaulting your AI brain.' })
      return
    }
    setModal({ type: 'import' })
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

  async function updateProject(values) {
    if (!activeProject) return
    const payload = {
      title: values.title.trim(),
      description: values.description.trim(),
      project_rules: values.project_rules.trim(),
      tags: values.tags.split(',').map(value => value.trim()).filter(Boolean)
    }
    const { data, error } = await supabase.from('projects').update(payload).eq('id', activeProject.id).eq('user_id', user.id).select().single()
    if (error) throw error
    setProjects(current => current.map(project => project.id === data.id ? data : project))
    setModal(null)
    showToast('Project details updated.')
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

  async function saveImportedConversations(items, transfer) {
    const destination = projects.find(project => project.id === transfer?.projectId)
    if (!destination) throw new Error('Choose an available destination project.')
    if (!isPro && conversations.length + items.length > 3) {
      setModal({ type: 'upgrade', plan: 'pro', message: 'This import exceeds the Starter Vault conversation limit. Upgrade to import the full archive.' })
      return
    }
    const target = transfer?.targetAi || providerPreferences.last_target || 'Claude'
    const savedRole = providerPreferences.providers?.[target]?.role || ''
    const transferContext = { target_ai: target, agent_mode: transfer?.agentMode || 'saved', agent_role: transfer?.agentMode === 'manual' ? transfer.taskPurpose : savedRole, task_purpose: transfer?.taskPurpose || '' }
    const rows = items.map(item => ({
      project_id: destination.id, user_id: user.id,
      title: String(item.title || 'Imported conversation').slice(0, 180),
      source_ai: item.source_ai || 'Other', raw_content: item.raw_content || '', cleaned_spec: '',
      tags: item.tags || ['imported'], image_urls: [], source_url: item.source_url || null,
      source_payload: item.source_payload || null,
      capture_metadata: { ...(item.capture_metadata || { import_method: 'manual' }), transfer_context: transferContext }
    }))
    const inserted = []
    for (let index = 0; index < rows.length; index += 40) {
      const { data, error } = await supabase.from('conversations').insert(rows.slice(index, index + 40)).select()
      if (error) throw error
      inserted.push(...(data || []))
    }
    setConversations(current => [...inserted, ...current]); setActiveProjectId(destination.id); setTargetAi(target)
    if (transfer?.agentMode === 'manual') setTaskPrompt(transfer.taskPurpose)
    if (inserted[0]) { setActiveConversationId(inserted[0].id); setActivePane('conversation') }
    setModal(null)
    showToast(inserted.length + ' conversation' + (inserted.length === 1 ? '' : 's') + ' added to ' + destination.title + '.')
  }

  async function importCapture(capture, projectId, transfer) {
    if (!projectId) throw new Error('Choose a project for this captured conversation.')
    const project = projects.find(item => item.id === projectId)
    if (!project) throw new Error('The selected project is unavailable.')
    if (!isPro && conversations.length >= 3) {
      setModal({ type: 'upgrade', plan: 'pro', message: 'Starter Vault limit reached (3/3 Convos). Upgrade to import this capture.' })
      return
    }
    const target = transfer?.targetAi || providerPreferences.last_target || 'Claude'
    const savedRole = providerPreferences.providers?.[target]?.role || ''
    const transferContext = { target_ai: target, agent_mode: transfer?.agentMode || 'saved', agent_role: transfer?.agentMode === 'manual' ? transfer.taskPurpose : savedRole, task_purpose: transfer?.taskPurpose || '' }
    const { data, error } = await supabase.from('conversations').insert({
      user_id: user.id, project_id: projectId, title: capture.title || 'Captured conversation',
      source_ai: capture.source_ai || 'Other', raw_content: capture.raw_content,
      tags: ['browser-capture'], source_url: capture.source_url || null,
      capture_metadata: { ...(capture.capture_metadata || { import_method: 'browser_extension' }), transfer_context: transferContext }
    }).select().single()
    if (error) throw error
    const { error: updateError } = await supabase.from('capture_inbox').update({
      status: 'imported', project_id: projectId, imported_conversation_id: data.id
    }).eq('id', capture.id).eq('user_id', user.id)
    if (updateError) throw updateError
    setConversations(current => [data, ...current]); setActiveProjectId(projectId); setTargetAi(target)
    if (transfer?.agentMode === 'manual') setTaskPrompt(transfer.taskPurpose)
    setActiveConversationId(data.id); setActivePane('conversation')
    setCaptureInbox(current => current.filter(item => item.id !== capture.id))
    showToast('Captured conversation added to ' + project.title + '.')
  }

  async function discardCapture(captureId) {
    const { error } = await supabase.from('capture_inbox').delete().eq('id', captureId).eq('user_id', user.id)
    if (error) throw error
    setCaptureInbox(current => current.filter(item => item.id !== captureId))
    showToast('Capture discarded.')
  }

  async function saveAiPreferences(nextPreferences) {
    const enabled = Object.entries(nextPreferences.providers || {}).filter(([, value]) => value?.enabled)
    if (!enabled.length) throw new Error('Choose at least one AI provider to continue.')
    const lastTarget = enabled.some(([name]) => name === nextPreferences.last_target) ? nextPreferences.last_target : enabled[0][0]
    const saved = { ...nextPreferences, last_target: lastTarget }
    const { data, error } = await supabase.from('profiles').update({ ai_preferences: saved, onboarding_completed: true }).eq('id', user.id).select().single()
    if (error) throw error
    setProfile(data); setProviderPreferences(saved); setTargetAi(lastTarget); setModal(null)
    showToast('AI workspace preferences saved.')
  }

  async function createIntegrationToken(scope) {
    const random = crypto.getRandomValues(new Uint8Array(32))
    const encoded = btoa(String.fromCharCode(...random)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '')
    const token = 'vv_' + scope + '_' + encoded
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
    const tokenHash = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
    const label = scope === 'capture' ? 'Browser Capture Extension' : 'MCP Server Connection'
    const { data, error } = await supabase.from('integration_tokens').insert({ user_id: user.id, label, scope, token_hash: tokenHash }).select('id,label,scope,created_at,last_used_at,revoked_at').single()
    if (error) throw error
    setIntegrationTokens(current => [data, ...current]); setGeneratedToken(token)
    showToast(label + ' token created. Copy it now; it is only shown once.')
  }

  async function revokeIntegrationToken(tokenId) {
    const revokedAt = new Date().toISOString()
    const { error } = await supabase.from('integration_tokens').update({ revoked_at: revokedAt }).eq('id', tokenId).eq('user_id', user.id)
    if (error) throw error
    setIntegrationTokens(current => current.map(item => item.id === tokenId ? { ...item, revoked_at: revokedAt } : item))
    showToast('Integration token revoked.')
  }

  async function exportProject(options = {}) {
    const project = projects.find(item => item.id === (options.projectId || activeProject?.id))
    if (!project) throw new Error('Choose a project before exporting.')
    const [decisionRes, sessionRes] = await Promise.all([
      supabase.from('project_decisions').select('*').eq('project_id', project.id).eq('user_id', user.id).order('created_at', { ascending: true }),
      supabase.from('session_summaries').select('*').eq('project_id', project.id).eq('user_id', user.id).order('created_at', { ascending: true })
    ])
    if (decisionRes.error) throw decisionRes.error
    if (sessionRes.error) throw sessionRes.error
    const target = options.targetAi || providerPreferences.last_target || 'Claude'
    const agentRole = options.agentMode === 'manual' ? options.taskPurpose : (providerPreferences.providers?.[target]?.role || '')
    const bundle = { format: 'vibevault-project-export', version: 1, exported_at: new Date().toISOString(), project,
      conversations: conversations.filter(item => item.project_id === project.id), decisions: decisionRes.data || [],
      session_summaries: sessionRes.data || [], handoffs: handoffs.filter(item => item.project_id === project.id),
      ai_preferences: providerPreferences, transfer_context: { target_ai: target, agent_mode: options.agentMode || 'saved', agent_role: agentRole, task_purpose: options.taskPurpose || '' } }
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a')
    anchor.href = url; anchor.download = (project.title || 'vibevault-project').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-vibevault-export.json'
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url)
    setActiveProjectId(project.id); setTargetAi(target)
    if (options.agentMode === 'manual') setTaskPrompt(options.taskPurpose)
    setModal(null); showToast('Project export prepared for ' + target + '.')
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

  async function updateDisplayName(value) {
    const displayName = value.trim()
    if (!displayName) throw new Error('Enter a display name.')
    const { data, error } = await supabase.from('profiles').update({ display_name: displayName }).eq('id', user.id).select().single()
    if (error) throw error
    setProfile(data); setModal(null); showToast('Profile updated.')
  }

  async function updateGlobalStyle(value) {
    const { data, error } = await supabase.from('profiles').upsert({ id: user.id, email: user.email, display_name: profile?.display_name || user.user_metadata?.display_name || '', global_style: value }, { onConflict: 'id' }).select().single()
    if (error) throw error
    setProfile(data); setModal(null); showToast('Global style saved.')
  }

  function makeAgentMd(targetOverride = targetAi) {
    const projectRules = activeProject?.project_rules?.trim() || 'No project-specific rules have been added yet.'
    const style = profile?.global_style?.trim() || 'No global style preferences have been set.'
    const destinationAgent = providerPreferences.providers?.[targetOverride] || {}
    const agentName = destinationAgent.agent_name || targetOverride
    const agentModel = destinationAgent.model || 'Not specified'
    const providerRole = destinationAgent.role || 'No provider-specific role preference set.'
    const onboardingProfile = providerPreferences.profile || {}
    const agentBehaviour = onboardingProfile.collaboration === 'guided'
      ? 'Guide the user step by step, explain the plan and check before moving on.'
      : onboardingProfile.collaboration === 'proactive'
        ? 'Take initiative on clearly defined tasks, state assumptions and surface decisions that need user approval.'
        : 'Work collaboratively, explain important choices and ask before major changes.'
    const responseDetail = onboardingProfile.detail === 'concise' ? 'Keep responses concise.' : onboardingProfile.detail === 'deep' ? 'Explain reasoning, alternatives and trade-offs in depth.' : 'Give clear explanations with useful detail.'
    const taskSection = taskPrompt.trim() ? '## CURRENT TASK\n' + taskPrompt.trim() + '\n\n' : ''
    const convoContext = selectedConversations.map((conversation, index) => {
      const useClean = isPro && bundleModes[conversation.id] === 'clean' && conversation.cleaned_spec
      const sourceLabel = useClean ? 'CLEANED SPEC' : 'RAW THREAD'
      const body = useClean ? conversation.cleaned_spec : conversation.raw_content
      return `## Conversation ${index + 1}: ${conversation.title}\nSource: ${conversation.source_ai}\nTags: ${(conversation.tags || []).join(', ') || 'None'}\nContext mode: ${sourceLabel}\n\n${body}`
    }).join('\n\n---\n\n')
    return `# AGENT.md — ${activeProject?.title || 'Untitled Project'}\n\n## RECEIVING AGENT\nName: ${agentName}\nProvider: ${targetOverride}\nModel: ${agentModel}\n\n## AI PROVIDER ROLE\n${providerRole}\n\n## ASSIGNED TASK ROLE\n${activeSkill?.role_name || 'General Assistant'}\n\n## ROLE INSTRUCTIONS\n${activeSkill?.instructions || 'Act as a careful, context-aware collaborator. Ask before making assumptions.'}\n\n## GLOBAL WORKING STYLE\n${style}\n\n## PERSONAL WORKING PREFERENCES\nFocus: ${onboardingProfile.focus || 'not specified'}\nExperience: ${onboardingProfile.experience || 'not specified'}\nAgent behaviour: ${agentBehaviour}\nResponse detail: ${responseDetail}\n\n${taskSection}## PROJECT DESCRIPTION\n${activeProject?.description || 'No project description supplied.'}\n\n## PROJECT RULES\n${projectRules}\n\n## BUNDLED SOURCE MATERIAL\n${convoContext || 'No raw conversations selected. Do not invent missing context.'}\n\n## MANDATORY 3-POINT CONFIRMATION — DO THIS BEFORE WRITING CODE\n1. **Confirm the role:** State that you understand and accept the assigned role: ${activeSkill?.role_name || 'General Assistant'}.\n2. **Prove context transfer:** Summarize the supplied raw conversations and identify the user's actual goals, constraints and decisions without silently rewriting the source material.\n3. **Expose uncertainty:** List assumptions, contradictions and missing information. Ask focused questions where needed. Do not write or modify code until the user approves this confirmation.\n\n---\nEnd of handoff. Preserve the user's original intent and ask before changing established decisions.\n`
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
    if (!activeProject || !activeSkill) { showToast('Select a project and task role before preparing a handoff.'); return }
    const content = makeAgentMd(target)
    const encoded = encodeURIComponent(content)
    const supportedTargets = {
      Claude: 'https://claude.ai/new?q=' + encoded,
      ChatGPT: 'https://chatgpt.com/?q=' + encoded,
      Gemini: 'https://gemini.google.com/app'
    }
    const url = supportedTargets[target]
    // Open synchronously from the click so browser popup protection does not block it after clipboard awaits.
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
    let copied = false
    try { await navigator.clipboard?.writeText(content); copied = Boolean(navigator.clipboard) }
    catch { copied = false }
    await saveHandoff(false, target, content)
    showToast((copied ? 'Handoff copied. ' : 'Handoff prepared; clipboard access was blocked. ') + (url ? target + ' opened in a new tab.' : 'Open ' + target + ' and paste the prepared context.'))
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

  async function generateCleanSpec(conversation) {
    if (!isPro) { setModal({ type: 'upgrade', plan: 'pro' }); return }
    setCleaningId(conversation.id)
    try {
      const { data, error } = await supabase.functions.invoke('clean-spec', { body: { raw_content: conversation.raw_content, conversation_id: conversation.id } })
      if (error) throw error
      const cleaned = data?.cleaned_spec || data?.cleanedSpec || data?.spec
      if (!cleaned) throw new Error('The cleaner returned no cleaned_spec value.')
      const { data: saved, error: saveError } = await supabase.from('conversations').update({ cleaned_spec: cleaned }).eq('id', conversation.id).eq('user_id', user.id).select().single()
      if (saveError) throw saveError
      setConversations(current => current.map(item => item.id === saved.id ? saved : item))
      setTranscriptMode('clean')
      showToast('Project specification generated.')
    } catch (error) { showToast(error.message || 'Could not generate the specification.') }
    finally { setCleaningId(null) }
  }

  function openConversation(conversation) {
    setActiveConversationId(conversation.id)
    setActivePane('conversation')
    setTranscriptMode('raw')
    setSelectedIds(current => current.includes(conversation.id) ? current : [...current, conversation.id])
  }

  const currentPlan = isPro ? 'PRO' : 'STARTER'
  const selectedProvider = AI_PROVIDERS.find(provider => provider.name === targetAi) || AI_PROVIDERS[0]
  const selectedAgentSettings = providerPreferences.providers?.[targetAi] || {}
  const selectedAgentName = selectedAgentSettings.agent_name || targetAi
  const projectConversations = activeProject ? conversations.filter(item => item.project_id === activeProject.id) : []
  const activeConversation = projectConversations.find(item => item.id === activeConversationId) || null
  const projectDecisions = activeProject ? decisions.filter(item => item.project_id === activeProject.id) : []
  const projectSummaries = activeProject ? sessionSummaries.filter(item => item.project_id === activeProject.id) : []
  const projectHandoffs = activeProject ? handoffs.filter(item => item.project_id === activeProject.id) : []
  const selectedContextCharacters = selectedConversations.reduce((total, item) => total + (item.raw_content || '').length, 0)
  const selectedContextCoverage = projectConversations.length ? Math.round((selectedConversations.length / projectConversations.length) * 100) : 0
  const navGroups = [
    { label: 'WORKSPACE', items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'projects', label: 'Projects', icon: FolderKanban }
    ]},
    { label: 'KNOWLEDGE', items: [
      { id: 'conversations', label: 'Conversations', icon: MessageSquareText },
      { id: 'inbox', label: 'Import Inbox', icon: Inbox },
      { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
      { id: 'decisions', label: 'Decisions', icon: CircleDot },
      { id: 'summaries', label: 'Session Summaries', icon: History }
    ]},
    { label: 'AI OPERATIONS', items: [
      { id: 'handoffs', label: 'Agent Handoffs', icon: Workflow },
      { id: 'preferences', label: 'AI Preferences', icon: Layers3 },
      { id: 'connections', label: 'Connections', icon: Plug }
    ]},
    { label: 'ACCOUNT', items: [
      { id: 'subscription', label: 'Subscription', icon: Zap },
      { id: 'profile', label: 'Profile', icon: Bot },
      { id: 'settings', label: 'Settings', icon: Settings2 }
    ]}
  ]
  const navItems = navGroups.flatMap(group => group.items)
  const navCount = item => item.id === 'conversations' ? projectConversations.length : item.id === 'decisions' ? projectDecisions.length : item.id === 'handoffs' ? projectHandoffs.length : item.id === 'inbox' ? captureInbox.length : item.id === 'connections' ? integrationTokens.filter(token => !token.revoked_at).length : ''
  const setPane = pane => { setActivePane(pane); if (pane !== 'conversation') setActiveConversationId(null); setMobileAgentVisible(false); setMobileNavOpen(false) }
  return <main className="ide-shell">
    <header className="ide-topbar">
      <div className="ide-topbar-left">
        <button className="ide-top-icon ide-layout-control" title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'} aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'} onClick={() => setSidebarCollapsed(value => !value)}><Menu size={17}/></button>
        <Brand compact/>
        <span className="ide-top-divider"/>
        <div className="ide-workspace-name"><small>WORKSPACE</small><strong>{activeProject?.title || 'No project selected'}</strong></div>
        <span className="ide-top-status"><span className="status-pulse"/> {busy ? 'SYNCING' : 'SAVED'}</span>
        {IS_FEATURE_PREVIEW_HOST && <span className="ide-feature-preview-badge" title="This is the green-and-white workspace redesign preview">FEATURE PREVIEW · GREEN WORKSPACE</span>}
      </div>
      <div className="ide-topbar-right">
        <button className="ide-global-search-trigger" onClick={() => setSearchOpen(true)} aria-label="Search VibeVault"><Search size={15}/><span>Search projects, conversations, decisions…</span><kbd>Ctrl K</kbd></button>
        <label className="ide-project-picker"><FolderKanban size={14}/><select aria-label="Switch project" value={activeProject?.id || ''} onChange={event => { setActiveProjectId(event.target.value); setActiveConversationId(null); setSelectedIds([]); setActivePane('overview') }}><option value="">Select project</option>{projects.map(project => <option value={project.id} key={project.id}>{project.title}</option>)}</select><ChevronDown size={13}/></label>
        <span className="ide-plan-pill">{currentPlan}</span>
        <button className="ide-top-icon ide-inbox-trigger" title="Import inbox" aria-label="Import inbox" onClick={() => setPane('inbox')}><Inbox size={16}/>{captureInbox.length > 0 && <span>{captureInbox.length}</span>}</button>
        <button className="ide-top-icon" title="AI workspace preferences" onClick={() => setPane('preferences')}><Layers3 size={16}/></button>
        <button className="ide-top-icon" title={inspectorOpen ? 'Hide context inspector' : 'Show context inspector'} aria-label={inspectorOpen ? 'Hide context inspector' : 'Show context inspector'} onClick={() => setInspectorOpen(value => !value)}><PanelsTopLeft size={16}/></button>
        <button className="ide-user-menu" title="Account settings" onClick={() => setPane('settings')}>{(profile?.display_name || user.email || 'V').slice(0,1).toUpperCase()}</button>
      </div>
    </header>

    <div className={'ide-workbench ' + (sidebarCollapsed ? 'sidebar-collapsed ' : '') + (!inspectorOpen ? 'inspector-collapsed ' : '') + (mobileAgentVisible ? 'mobile-agent-visible' : '')}>
      <nav className="ide-activitybar" aria-label="Workspace tools">
        <button className={activePane === 'overview' || activePane === 'projects' ? 'active' : ''} title="Workspace" aria-label="Workspace" aria-current={activePane === 'overview' || activePane === 'projects' ? 'page' : undefined} onClick={() => setPane('overview')}><PanelsTopLeft size={19}/></button>
        <button className={activePane === 'handoffs' ? 'active' : ''} title="Agent handoffs" aria-label="Agent handoffs" aria-current={activePane === 'handoffs' ? 'page' : undefined} onClick={() => setPane('handoffs')}><Workflow size={19}/></button>
        <button className={activePane === 'conversations' || activePane === 'conversation' ? 'active' : ''} title="Conversation vault" aria-label="Conversation vault" aria-current={activePane === 'conversations' || activePane === 'conversation' ? 'page' : undefined} onClick={() => setPane('conversations')}><Archive size={19}/></button>
        <button className={activePane === 'knowledge' || activePane === 'decisions' || activePane === 'summaries' ? 'active' : ''} title="Knowledge" aria-label="Knowledge" aria-current={activePane === 'knowledge' || activePane === 'decisions' || activePane === 'summaries' ? 'page' : undefined} onClick={() => setPane('knowledge')}><BookOpen size={19}/></button>
        <span className="ide-activity-spacer"/>
        <button className={activePane === 'connections' ? 'active' : ''} title="AI connections" aria-label="AI connections" aria-current={activePane === 'connections' ? 'page' : undefined} onClick={() => setPane('connections')}><Plug size={18}/></button>
        <button className={activePane === 'settings' || activePane === 'profile' || activePane === 'subscription' ? 'active' : ''} title="Settings" aria-label="Settings" aria-current={activePane === 'settings' || activePane === 'profile' || activePane === 'subscription' ? 'page' : undefined} onClick={() => setPane('settings')}><Settings2 size={18}/></button>
      </nav>

      <aside className="ide-explorer">
        <div className="ide-explorer-title"><span>EXPLORER</span><button title="Create project" onClick={requestCreateProject}><Plus size={15}/></button></div>
        <div className="ide-explorer-project-label"><span><ChevronDown size={13}/> PROJECTS</span><button title="New project" onClick={requestCreateProject}><Plus size={14}/></button></div>
        <div className="ide-sidebar-search"><Search size={13}/><input aria-label="Filter projects" value={projectSearch} onChange={event => setProjectSearch(event.target.value)} placeholder="Filter projects"/><button type="button" title="Clear project filter" aria-label="Clear project filter" disabled={!projectSearch} onClick={() => setProjectSearch('')}><X size={13}/></button></div>
        <div className="ide-project-tree">
          {filteredProjects.map(project => <button key={project.id} className={'ide-project-node ' + (activeProject?.id === project.id ? 'selected' : '')} aria-pressed={activeProject?.id === project.id} onClick={() => { setActiveProjectId(project.id); setActiveConversationId(null); setSelectedIds([]); setActivePane('overview'); setMobileNavOpen(false) }}><FolderKanban size={15}/><span className="ide-project-node-copy"><strong>{project.title}</strong><small>{project.description || 'Project workspace'}</small></span><em className="ide-project-count">{conversations.filter(item => item.project_id === project.id).length}</em></button>)}
          {!projects.length && <div className="ide-sidebar-empty">Your projects will appear here.</div>}
          {!!projects.length && !filteredProjects.length && <div className="ide-sidebar-empty ide-project-filter-empty">No projects match “{projectSearch}”.<button onClick={() => setProjectSearch('')}>Clear filter</button></div>}
        </div>
        <div className="ide-sidebar-nav">
          {navGroups.map(group => <section className="ide-nav-group" key={group.label}>
            <div className="ide-nav-group-label">{group.label}</div>
            {group.items.map(item => <button key={item.id} className={'ide-nav-item ' + (activePane === item.id || (item.id === 'conversations' && activePane === 'conversation') ? 'active' : '')} aria-current={activePane === item.id || (item.id === 'conversations' && activePane === 'conversation') ? 'page' : undefined} onClick={() => setPane(item.id)}><item.icon size={15}/><span>{item.label}</span>{navCount(item) !== '' && Number(navCount(item)) > 0 && <small>{navCount(item)}</small>}</button>)}
          </section>)}
        </div>
        <div className="ide-explorer-section-head conversation-tree-head"><span><ChevronDown size={13}/> CONVERSATION FILES <small className="ide-tree-count">{projectConversations.length}</small></span><button title="Import conversation" aria-label="Import conversation" onClick={requestSaveConversation}><Plus size={14}/></button></div>
        <div className="ide-conversation-tree">
          {projectConversations.map(conversation => <button key={conversation.id} className={'ide-file-node ' + (activeConversationId === conversation.id ? 'selected' : '')} onClick={() => openConversation(conversation)}><FileText size={14}/><span>{conversation.title}</span>{conversation.cleaned_spec && <span className="ide-spec-dot" title="Specification available"/>}</button>)}
          {!projectConversations.length && <div className="ide-sidebar-empty">No conversation files yet.<button onClick={requestSaveConversation}>Import your first conversation</button></div>}
        </div>
        <div className="ide-explorer-footer">
          {!isPro && <div className="ide-usage-card"><div><span>STARTER USAGE</span><strong>{projects.length}/1 projects · {conversations.length}/3 conversations</strong></div><button onClick={() => setModal({ type: 'upgrade', plan: 'pro' })}>UPGRADE</button></div>}
          <div className="ide-account-row"><span className="ide-account-avatar">{(profile?.display_name || user.email || 'V').slice(0,1).toUpperCase()}</span><span><strong>{profile?.display_name || user.user_metadata?.display_name || 'Vault owner'}</strong><small>{user.email}</small></span><button title="Sign out" onClick={onSignOut}><LogOut size={15}/></button></div>
        </div>
      </aside>

      <section className="ide-editor-area">
        <div className="ide-editor-tabs">
          <button className={activePane === 'overview' ? 'active' : ''} onClick={() => setPane('overview')}><LayoutDashboard size={13}/> {activeProject?.title || 'Overview'}</button>
          {activeConversation && <button className={activePane === 'conversation' ? 'active' : ''} onClick={() => setActivePane('conversation')}><FileText size={13}/>{activeConversation.title}<span className="ide-tab-close" onClick={event => { event.stopPropagation(); setActiveConversationId(null); setActivePane('overview') }}>×</span></button>}
          {activePane !== 'overview' && activePane !== 'conversation' && <button className="active"><span>{navItems.find(item => item.id === activePane)?.label || 'Workspace'}</span></button>}
          <span className="ide-tabs-spacer"/>
          <button className="ide-tab-action" title="Import conversation" onClick={requestSaveConversation}><Upload size={14}/></button>
          <button className="ide-tab-action" title="Export project" disabled={!activeProject} onClick={() => setModal({ type: 'export' })}><Download size={14}/></button>
        </div>
        <div className="ide-breadcrumb"><span>VIBEVAULT</span><ChevronRight size={12}/><span>{activeProject?.title || 'WORKSPACE'}</span><ChevronRight size={12}/><strong>{activePane === 'conversation' ? activeConversation?.title || 'Conversation' : navItems.find(item => item.id === activePane)?.label || 'Overview'}</strong><span className="ide-breadcrumb-spacer"/><span className="ide-branch"><GitBranch size={12}/> PROJECT CONTEXT</span></div>
        <div className="ide-editor-scroll">
          {busy && <div className="ide-loading"><span className="ide-loading-bar"/><p>SYNCING PROJECT FILES…</p></div>}
          {!activeProject && !busy && !['projects','inbox','preferences','connections','subscription','settings'].includes(activePane) && <div className="ide-empty-workspace"><div className="ide-empty-icon"><FolderKanban size={27}/></div><span className="ide-kicker">VIBEVAULT WORKSPACE</span><h1>Create your first project.</h1><p>Projects keep conversations, decisions and handoffs together. Import your existing AI work and continue from one place.</p><Button onClick={requestCreateProject}><Plus size={15}/> CREATE PROJECT</Button></div>}

          {activeProject && !busy && activePane === 'overview' && <div className="ide-page ide-overview-page">
            <div className="ide-page-heading ide-project-heading"><div><span className="ide-kicker">PROJECT WORKSPACE</span><h1>{activeProject.title}</h1><p>{activeProject.description || 'A persistent home for the context, decisions and work behind this project.'}</p>{Array.isArray(activeProject.tags) && activeProject.tags.length > 0 && <div className="ide-project-tags">{activeProject.tags.slice(0,4).map(tag => <span key={tag}>{tag}</span>)}{activeProject.tags.length > 4 && <small>+{activeProject.tags.length - 4} more</small>}</div>}</div><div className="ide-heading-actions"><Button variant="ghost" onClick={() => setModal({ type: 'project-edit' })}><Settings2 size={14}/> PROJECT SETTINGS</Button><Button onClick={requestSaveConversation}><Upload size={14}/> IMPORT CONTEXT</Button></div></div>
            <section className="ide-project-launchpad"><div className="ide-launchpad-copy"><span className="ide-kicker">PROJECT CONTROL</span><strong>Pick up where your work left off.</strong><small>Keep the original context close, then choose the next useful action.</small></div><div className="ide-launchpad-actions"><button onClick={() => setModal({ type: 'handoff' })} disabled={!activeSkill}><Workflow size={17}/><span><strong>Prepare handoff</strong><small>Build an AGENT.md</small></span><ArrowUpRight size={15}/></button><button onClick={requestSaveConversation}><Upload size={17}/><span><strong>Import context</strong><small>Add a conversation</small></span><ArrowUpRight size={15}/></button></div></section>
            <div className="ide-stat-grid">
              <WorkspaceStat icon={MessageSquareText} label="CONVERSATIONS" value={projectConversations.length} detail="preserved threads"/>
              <WorkspaceStat icon={BookOpen} label="KNOWLEDGE RECORDS" value={projectSummaries.length + projectDecisions.length} detail="summaries and decisions"/>
              <WorkspaceStat icon={Workflow} label="AGENT HANDOFFS" value={projectHandoffs.length} detail="recorded transfers"/>
              <WorkspaceStat icon={Plug} label="AI CONNECTIONS" value={integrationTokens.filter(token => !token.revoked_at).length} detail="active tokens"/>
            </div>
            <div className="ide-overview-grid">
              <section className="ide-content-panel">
                <div className="ide-panel-heading"><div><span className="ide-kicker">PROJECT FILES</span><h2>Recent conversations</h2></div><button onClick={() => setPane('conversations')}>VIEW ALL <ArrowUpRight size={13}/></button></div>
                {projectConversations.slice(0,6).map(conversation => <button className="ide-recent-file" key={conversation.id} onClick={() => openConversation(conversation)}><span className="ide-file-icon"><FileText size={16}/></span><span className="ide-file-copy"><strong>{conversation.title}</strong><small>{conversation.source_ai} · {formatDate(conversation.created_at)}</small><em>{(conversation.raw_content || '').replace(/\s+/g, ' ').slice(0,118)}{(conversation.raw_content || '').length > 118 ? '…' : ''}</em></span>{conversation.cleaned_spec && <span className="ide-file-spec">SPEC READY</span>}<span className="ide-file-open"><ChevronRight size={15}/></span></button>)}
                {!projectConversations.length && <div className="ide-panel-empty"><MessageSquareText size={20}/><strong>No conversations in this project</strong><span>Import a previous discussion or capture one from your browser extension.</span><Button variant="ghost" onClick={requestSaveConversation}><Upload size={14}/> IMPORT CONVERSATION</Button></div>}
              </section>
              <section className="ide-content-panel">
                <div className="ide-panel-heading"><div><span className="ide-kicker">PROJECT MEMORY</span><h2>Knowledge & decisions</h2></div><button onClick={() => setPane('knowledge')}>OPEN <ArrowUpRight size={13}/></button></div>
                <div className="ide-memory-row"><span className="ide-memory-icon"><BookOpen size={16}/></span><span><strong>Project description</strong><small>{activeProject.description || 'Add a description to establish the project objective.'}</small></span></div>
                <div className="ide-memory-row"><span className="ide-memory-icon"><Braces size={16}/></span><span><strong>Project rules</strong><small>{activeProject.project_rules || 'No project rules have been recorded yet.'}</small></span></div>
                <div className="ide-memory-row"><span className="ide-memory-icon"><CircleDot size={16}/></span><span><strong>Approved decisions</strong><small>{projectDecisions.filter(item => item.status === 'approved').length} approved · {projectDecisions.filter(item => item.status === 'open').length} open questions</small></span></div>
              </section>
            </div>
            <div className="ide-overview-activity-grid">
              <section className="ide-content-panel"><div className="ide-panel-heading"><div><span className="ide-kicker">RECENT DECISIONS</span><h2>Project decisions</h2></div><button onClick={() => setPane('decisions')}>VIEW ALL <ArrowUpRight size={13}/></button></div>
                {projectDecisions.slice(0,4).map(decision => <button className="ide-overview-record" key={decision.id} onClick={() => setPane('decisions')}><span className={'ide-decision-state state-' + decision.status}>{decision.status}</span><span><strong>{decision.title}</strong><small>{formatDate(decision.created_at)}</small></span></button>)}
                {!projectDecisions.length && <div className="ide-panel-empty compact"><CircleDot size={18}/><strong>No saved decisions</strong><span>Approved decisions and open questions will appear here.</span></div>}
              </section>
              <section className="ide-content-panel"><div className="ide-panel-heading"><div><span className="ide-kicker">RECENT HANDOFFS</span><h2>Agent activity</h2></div><button onClick={() => setPane('handoffs')}>VIEW ALL <ArrowUpRight size={13}/></button></div>
                {projectHandoffs.slice(0,4).map(handoff => <button className="ide-overview-record" key={handoff.id} onClick={() => setPane('handoffs')}><span className="ide-overview-record-icon"><Bot size={14}/></span><span><strong>{handoff.target_ai} · {handoff.role_name}</strong><small>{formatDate(handoff.created_at)} · {handoff.confirmed ? 'Confirmed' : 'Awaiting confirmation'}</small></span></button>)}
                {!projectHandoffs.length && <div className="ide-panel-empty compact"><Workflow size={18}/><strong>No handoffs yet</strong><span>Generated handoff history will appear here.</span></div>}
              </section>
              <section className="ide-content-panel"><div className="ide-panel-heading"><div><span className="ide-kicker">IMPORT ACTIVITY</span><h2>Pending captures</h2></div><button onClick={() => setPane('inbox')}>OPEN INBOX <ArrowUpRight size={13}/></button></div>
                {captureInbox.slice(0,3).map(capture => <button className="ide-overview-record" key={capture.id} onClick={() => setPane('inbox')}><span className="ide-overview-record-icon"><Inbox size={14}/></span><span><strong>{capture.title}</strong><small>{capture.source_ai} · {formatDate(capture.created_at)}</small></span></button>)}
                {!captureInbox.length && <div className="ide-panel-empty compact"><CheckCircle2 size={18}/><strong>No pending captures</strong><span>New browser captures appear here for review.</span></div>}
              </section>
            </div>
            <div className="ide-bottom-note"><ShieldCheck size={15}/><span>Original conversation records are preserved independently from generated specifications and summaries.</span></div>
          </div>}

          {activePane === 'projects' && !busy && <div className="ide-page">
            <div className="ide-page-heading"><div><span className="ide-kicker">YOUR WORKSPACES</span><h1>Projects</h1><p>Keep conversations, decisions, knowledge and handoffs connected to the work they belong to.</p></div><Button onClick={requestCreateProject}><Plus size={14}/> NEW PROJECT</Button></div>
            {projects.length ? <div className="ide-project-grid">{projects.map(project => { const count = conversations.filter(item => item.project_id === project.id).length; const decisionCount = decisions.filter(item => item.project_id === project.id).length; const runCount = handoffs.filter(item => item.project_id === project.id).length; return <article className={'ide-project-card ' + (activeProject?.id === project.id ? 'selected' : '')} key={project.id}>
              <button className="ide-project-card-main" onClick={() => { setActiveProjectId(project.id); setSelectedIds([]); setActiveConversationId(null); setActivePane('overview') }}><span className="ide-project-card-icon"><FolderKanban size={18}/></span><span className="ide-project-card-copy"><strong>{project.title}</strong><small>{project.description || 'No project description yet.'}</small></span><span className="ide-project-card-arrow"><ChevronRight size={16}/></span></button>
              <div className="ide-project-card-meta"><span>{count} conversations</span><span>{decisionCount} decisions</span><span>{runCount} handoffs</span><button onClick={() => { setActiveProjectId(project.id); setModal({ type: 'project-edit' }) }}><Settings2 size={13}/> Settings</button></div>
            </article>})}</div> : <div className="ide-panel-empty"><FolderKanban size={24}/><strong>No projects yet</strong><span>Create a project to give your conversations and decisions a permanent home.</span><Button onClick={requestCreateProject}><Plus size={14}/> CREATE PROJECT</Button></div>}
          </div>}

          {activePane === 'inbox' && !busy && <div className="ide-page">
            <div className="ide-page-heading"><div><span className="ide-kicker">BROWSER CAPTURE REVIEW</span><h1>Import Inbox</h1><p>Review captured conversations before they are added to a permanent project vault.</p></div><Button onClick={() => setModal({ type: 'inbox' })}><Inbox size={14}/> REVIEW INBOX</Button></div>
            <div className="ide-inbox-summary"><span className="ide-inbox-summary-icon"><Inbox size={18}/></span><span><strong>{captureInbox.length} pending capture{captureInbox.length === 1 ? '' : 's'}</strong><small>These records remain in the review inbox until you import or discard them.</small></span></div>
            {captureInbox.length ? <div className="ide-resource-list">{captureInbox.map(capture => <article className="ide-inbox-row" key={capture.id}><div><span className="ide-kicker">{capture.source_ai} · {formatDate(capture.created_at)}</span><strong>{capture.title}</strong><p>{(capture.raw_content || '').slice(0,240).replace(/\s+/g,' ')}{(capture.raw_content || '').length > 240 ? '…' : ''}</p></div><Button variant="ghost" onClick={() => setModal({ type: 'inbox' })}>REVIEW <ChevronRight size={14}/></Button></article>)}</div> : <div className="ide-panel-empty"><CheckCircle2 size={23}/><strong>Your inbox is clear</strong><span>Use Browser Capture on a supported AI conversation to send it here for review.</span><Button variant="ghost" onClick={() => setPane('connections')}><Plug size={14}/> CONNECTION SETUP</Button></div>}
          </div>}

          {activePane === 'conversation' && activeConversation && <div className="ide-conversation-page">
            <div className="ide-document-heading"><div><span className="ide-kicker">CONVERSATION FILE · {activeConversation.source_ai.toUpperCase()}</span><h1>{activeConversation.title}</h1><p>Review the preserved source thread, switch to a structured specification, or attach this conversation to your next agent handoff.</p></div><div className="ide-heading-actions"><Button variant="ghost" onClick={() => navigator.clipboard?.writeText(activeConversation.raw_content || '')}><Clipboard size={14}/> COPY ORIGINAL</Button><Button variant={selectedIds.includes(activeConversation.id) ? 'solid' : 'ghost'} aria-pressed={selectedIds.includes(activeConversation.id)} title={selectedIds.includes(activeConversation.id) ? 'Remove this conversation from the next handoff' : 'Attach this conversation to the next handoff'} onClick={() => toggleConversation(activeConversation.id)}>{selectedIds.includes(activeConversation.id) ? <Check size={14}/> : <Plus size={14}/>} {selectedIds.includes(activeConversation.id) ? 'IN HANDOFF CONTEXT' : 'ADD TO CONTEXT'}</Button></div></div>
            <ConversationEditor conversation={activeConversation} mode={transcriptMode} isPro={isPro} onModeChange={setTranscriptMode} cleaning={cleaningId === activeConversation.id} onClean={() => generateCleanSpec(activeConversation)}/>
          </div>}

          {activeProject && !busy && activePane === 'conversations' && <div className="ide-page">
            <div className="ide-page-heading"><div><span className="ide-kicker">PROJECT HISTORY</span><h1>Conversations</h1><p>Every preserved discussion, searchable and attached to this project.</p></div><Button onClick={requestSaveConversation}><Upload size={14}/> IMPORT</Button></div>
            <div className="ide-filter-row"><div className="source-filters">{SOURCE_AIS.map(source => <button key={source} className={'filter-chip ' + (sourceFilter === source ? 'active' : '')} onClick={() => setSourceFilter(source)}>{source}</button>)}</div><span>{visibleConversations.length} RECORDS</span></div>
            <div className="ide-resource-list">{visibleConversations.map(conversation => <div className="ide-resource-row" key={conversation.id}><label className="ide-context-checkbox"><input type="checkbox" checked={selectedIds.includes(conversation.id)} onChange={() => toggleConversation(conversation.id)}/></label><button className="ide-resource-open" onClick={() => openConversation(conversation)}><FileText size={17}/><span className="ide-resource-copy"><strong>{conversation.title}</strong><small>{conversation.source_ai} · {formatDate(conversation.created_at)} · {(conversation.raw_content || '').length.toLocaleString()} characters</small><em>{(conversation.raw_content || '').replace(/\s+/g, ' ').slice(0,150)}{(conversation.raw_content || '').length > 150 ? '…' : ''}</em></span></button><span className="ide-resource-tags">{(conversation.tags || []).slice(0,2).map(tag => <em key={tag}>{tag}</em>)}{conversation.cleaned_spec && <em className="ide-resource-spec">SPEC READY</em>}</span><button className="ide-row-chevron" onClick={() => openConversation(conversation)}><ChevronRight size={16}/></button></div>)}
            {!visibleConversations.length && <div className="ide-panel-empty"><MessageSquareText size={22}/><strong>No matching conversations</strong><span>Import a conversation to start this project's history.</span></div>}</div>
          </div>}

          {activeProject && !busy && activePane === 'knowledge' && <div className="ide-page">
            <div className="ide-page-heading"><div><span className="ide-kicker">PERSISTENT PROJECT MEMORY</span><h1>Knowledge base</h1><p>The stable information your next AI should understand before continuing work.</p></div><Button variant="ghost" onClick={() => setModal({ type: 'project-edit' })}><Settings2 size={14}/> EDIT PROJECT RULES</Button></div>
            <div className="ide-knowledge-grid">
              <section className="ide-knowledge-card"><header><span className="ide-kicker">PROJECT OBJECTIVE</span><span className="ide-knowledge-kind"><BookOpen size={13}/> NORTH STAR</span></header><h2>{activeProject.title}</h2><RichDocumentBody text={activeProject.description || 'No project objective has been written yet.'}/>{Array.isArray(activeProject.tags) && activeProject.tags.length > 0 && <div className="ide-project-tags">{activeProject.tags.map(tag => <span key={tag}>{tag}</span>)}</div>}</section>
              <section className="ide-knowledge-card"><header><span className="ide-kicker">PROJECT RULES & CONSTRAINTS</span><span className="ide-knowledge-kind"><ShieldCheck size={13}/> GUARDRAILS</span></header><RichDocumentBody text={activeProject.project_rules || 'No project-specific rules have been recorded.'}/></section>
            </div>
            <div className="ide-panel-heading"><div><span className="ide-kicker">SESSION MEMORY</span><h2>Saved session summaries</h2></div><span>{projectSummaries.length} RECORDS</span></div>
            {projectSummaries.map(summary => <article className="ide-summary-card" key={summary.id}><header><strong>{summary.title}</strong><small>{summary.source_ai || 'AI session'} · {formatDate(summary.created_at)}</small></header><RichDocumentBody text={summary.summary}/></article>)}
            {!projectSummaries.length && <div className="ide-panel-empty compact"><BookOpen size={18}/><strong>No session summaries yet</strong><span>A connected AI can save useful session outcomes through MCP.</span></div>}
          </div>}

          {activeProject && !busy && activePane === 'decisions' && <div className="ide-page">
            <div className="ide-page-heading"><div><span className="ide-kicker">PROJECT RECORD</span><h1>Decisions & open questions</h1><p>Approved choices stay distinguishable from ideas that still need confirmation.</p></div><span className="ide-record-count">{projectDecisions.length} RECORDS</span></div>
            {projectDecisions.map(decision => <article className="ide-decision-card" key={decision.id}><div className="ide-decision-top"><span className={'ide-decision-state state-' + decision.status}>{decision.status === 'approved' ? <CheckCircle2 size={12}/> : <CircleHelp size={12}/>} {decision.status.replace('_',' ')}</span><span className="ide-decision-type">{decision.category === 'open_question' ? 'OPEN QUESTION' : 'PROJECT DECISION'}</span><time>{formatDate(decision.created_at)}</time></div><h3>{decision.title}</h3><div className="ide-decision-body"><RichDocumentBody text={decision.content}/></div><div className="ide-decision-footer"><span><Bot size={12}/> {decision.source_ai || 'VibeVault'}</span><span>{decision.category === 'open_question' ? 'Needs resolution' : 'Project memory'}</span></div></article>)}
            {!projectDecisions.length && <div className="ide-panel-empty"><CircleDot size={22}/><strong>No decisions have been saved</strong><span>MCP-connected AIs can save project decisions and unresolved questions when you ask them to.</span></div>}
          </div>}

          {activeProject && !busy && activePane === 'summaries' && <div className="ide-page">
            <div className="ide-page-heading"><div><span className="ide-kicker">PERSISTENT SESSION MEMORY</span><h1>Session Summaries</h1><p>Important outcomes recorded by you or an MCP-connected AI, kept alongside the project that owns them.</p></div><span className="ide-record-count">{projectSummaries.length} RECORDS</span></div>
            {projectSummaries.map(summary => <article className="ide-summary-card" key={summary.id}><header><strong>{summary.title}</strong><small>{summary.source_ai || 'AI session'} · {formatDate(summary.created_at)}</small></header><RichDocumentBody text={summary.summary}/></article>)}
            {!projectSummaries.length && <div className="ide-panel-empty"><History size={22}/><strong>No session summaries yet</strong><span>Ask a connected AI to save a concise record of a completed work session through MCP.</span></div>}
          </div>}

          {activePane === 'preferences' && !busy && <div className="ide-page">
            <div className="ide-page-heading"><div><span className="ide-kicker">PERSONAL AI CONFIGURATION</span><h1>AI Preferences</h1><p>Your default destination, provider roles and working style are included when VibeVault prepares an agent handoff.</p></div><Button onClick={() => setModal({ type: 'ai' })}><Settings2 size={14}/> MANAGE PREFERENCES</Button></div>
            <section className="ide-preference-summary"><div><span className="ide-kicker">DEFAULT DESTINATION</span><strong>{providerPreferences.last_target || 'Not set'}</strong><small>{providerPreferences.providers?.[providerPreferences.last_target]?.role || 'Choose a provider and define its purpose.'}</small></div><div><span className="ide-kicker">WORKING STYLE</span><strong>{providerPreferences.profile?.collaboration || 'Not configured'}</strong><small>{providerPreferences.profile?.detail || 'Response detail not configured'}</small></div></section>
            <div className="ide-panel-heading"><div><span className="ide-kicker">SAVED PROVIDERS</span><h2>AI destinations</h2></div><span>{AI_PROVIDERS.filter(provider => providerPreferences.providers?.[provider.name]?.enabled).length} ENABLED</span></div>
            <div className="ide-provider-grid">{AI_PROVIDERS.filter(provider => providerPreferences.providers?.[provider.name]?.enabled).map(provider => <article className="ide-provider-card" key={provider.name}><AIProviderLogo provider={provider} className="ide-provider-card-logo"/><span><strong>{provider.name}</strong><small>{providerPreferences.providers?.[provider.name]?.role || provider.role}</small></span>{provider.name === providerPreferences.last_target && <em>DEFAULT</em>}</article>)}</div>
            {!AI_PROVIDERS.some(provider => providerPreferences.providers?.[provider.name]?.enabled) && <div className="ide-panel-empty"><Layers3 size={22}/><strong>No AI destinations configured</strong><span>Complete the AI preferences setup to define the tools you use and their roles.</span><Button onClick={() => setModal({ type: 'ai' })}>CONFIGURE AI PREFERENCES</Button></div>}
          </div>}

          {activePane === 'connections' && !busy && <div className="ide-page">
            <div className="ide-page-heading"><div><span className="ide-kicker">EXTENSIONS & EXTERNAL CLIENTS</span><h1>Connections</h1><p>Manage the revocable tokens that connect the browser capture extension and compatible MCP clients to your vault.</p></div><Button onClick={() => { setGeneratedToken(''); setModal({ type: 'integrations' }) }}><Plug size={14}/> MANAGE CONNECTIONS</Button></div>
            <div className="ide-connection-grid"><article className="ide-connection-card"><span className="ide-connection-icon"><Archive size={18}/></span><strong>Browser Capture</strong><p>Capture the conversation you are viewing in ChatGPT, Claude or Gemini. New captures wait in your Import Inbox.</p><small>{integrationTokens.filter(token => token.scope === 'capture' && !token.revoked_at).length} active token(s)</small></article><article className="ide-connection-card"><span className="ide-connection-icon"><Workflow size={18}/></span><strong>MCP Server</strong><p>Let compatible AI clients search project context and save user-approved decisions or session summaries.</p><small>{integrationTokens.filter(token => token.scope === 'mcp' && !token.revoked_at).length} active token(s)</small></article></div>
            <div className="ide-bottom-note"><ShieldCheck size={15}/><span>Tokens are stored as hashes. A newly created token is only displayed once; revoke and replace it if it is lost.</span></div>
          </div>}

          {activePane === 'subscription' && !busy && <div className="ide-page">
            <div className="ide-page-heading"><div><span className="ide-kicker">ACCOUNT ENTITLEMENTS</span><h1>Subscription</h1><p>Review the entitlement currently recorded on your VibeVault profile.</p></div><Button variant="ghost" onClick={refreshPlanStatus} disabled={refreshingPlan}>{refreshingPlan ? 'REFRESHING…' : 'REFRESH PLAN STATUS'}</Button></div>
            <section className="ide-subscription-card"><div><span className="ide-kicker">CURRENT PLAN</span><strong>{isPro ? 'Pro access' : 'Starter Vault'}</strong><small>{isPro ? 'Your profile currently has Pro entitlement.' : 'Starter includes one project, three raw conversations and three built-in role skills.'}</small></div><span className="ide-plan-pill">{currentPlan}</span></section>
            <div className="ide-usage-grid"><div><small>PROJECTS</small><strong>{projects.length}{isPro ? '' : ' / 1'}</strong></div><div><small>CONVERSATIONS</small><strong>{conversations.length}{isPro ? '' : ' / 3'}</strong></div><div><small>CUSTOM SKILLS</small><strong>{skills.filter(skill => !skill.is_default).length}</strong></div></div>
            {!isPro && <div className="ide-bottom-note"><Zap size={15}/><span>Upgrade to Pro for unlimited projects and conversations, custom role skills and AI Smart Spec Cleaner.</span><Button onClick={() => setModal({ type: 'upgrade', plan: 'pro' })}>VIEW PRO</Button></div>}
          </div>}

          {activePane === 'profile' && !busy && <div className="ide-page">
            <div className="ide-page-heading"><div><span className="ide-kicker">YOUR VIBEVAULT IDENTITY</span><h1>Profile</h1><p>Update the name shown across your workspace. Your sign-in email remains managed by Supabase Authentication.</p></div></div>
            <section className="ide-settings-card"><span className="ide-settings-avatar">{(profile?.display_name || user.email || 'V').slice(0,1).toUpperCase()}</span><span><strong>{profile?.display_name || user.user_metadata?.display_name || 'Vault owner'}</strong><small>{user.email}</small></span><Button onClick={() => setModal({ type: 'profile' })}>EDIT PROFILE</Button></section>
          </div>}

          {activePane === 'settings' && !busy && <div className="ide-page">
            <div className="ide-page-heading"><div><span className="ide-kicker">PERSONAL ACCOUNT</span><h1>Settings</h1><p>Manage your saved working preferences and review the account currently signed in.</p></div></div>
            <section className="ide-settings-card"><span className="ide-settings-avatar">{(profile?.display_name || user.email || 'V').slice(0,1).toUpperCase()}</span><span><strong>{profile?.display_name || user.user_metadata?.display_name || 'Vault owner'}</strong><small>{user.email}</small><small>Account ID: {user.id}</small></span><Button variant="ghost" onClick={onSignOut}><LogOut size={14}/> SIGN OUT</Button></section>
            <section className="ide-settings-card"><span className="ide-settings-avatar"><Settings2 size={18}/></span><span><strong>Global working style</strong><small>{profile?.global_style?.trim() || 'No additional global style has been saved.'}</small></span><Button onClick={() => setModal({ type: 'style' })}>EDIT STYLE</Button></section>
          </div>}

          {activeProject && !busy && activePane === 'handoffs' && <div className="ide-page">
            <div className="ide-page-heading"><div><span className="ide-kicker">AGENT ACTIVITY</span><h1>Agent Handoffs</h1><p>Prepare context for the next AI, preserve the exact source threads and track whether the receiving agent confirmed the transfer.</p></div><Button onClick={() => setModal({ type: 'handoff' })} disabled={!activeProject || !activeSkill}><Workflow size={14}/> PREPARE HANDOFF</Button></div>
            {projectHandoffs.map(handoff => <article className="ide-handoff-card" key={handoff.id}><div className="ide-handoff-symbol"><Bot size={18}/></div><div className="ide-handoff-copy"><strong>{handoff.target_ai}</strong><span>{handoff.role_name} · {formatDate(handoff.created_at)}</span><small>{handoff.confirmed ? 'Receiving AI confirmation marked' : 'Context prepared · confirmation not yet marked'}</small></div>{handoff.confirmed ? <span className="ide-handoff-confirmed"><CheckCircle2 size={13}/> CONFIRMED</span> : <Button variant="ghost" onClick={() => markHandoffConfirmed(handoff.id)}>MARK CONFIRMED</Button>}</article>)}
            {!projectHandoffs.length && <div className="ide-panel-empty"><Workflow size={22}/><strong>No handoffs yet</strong><span>Prepare a task in the Agent panel to start your handoff history.</span></div>}
          </div>}
        </div>
        <div className="ide-statusbar"><span><CircleDot size={12}/> {activeProject ? activeProject.title : 'NO PROJECT'}</span><span><GitBranch size={12}/> PROJECT MEMORY</span><span><ShieldCheck size={12}/> PRIVATE WORKSPACE</span><span className="ide-status-spacer"/><span>{projectConversations.length} CONVERSATIONS</span></div>
      </section>

      <aside className="ide-agent-panel">
        <div className="ide-agent-header"><div><span className="ide-kicker">LIVE PROJECT CONTEXT</span><strong>Context inspector</strong></div><button className="ide-inspector-close" title="Collapse inspector" onClick={() => setInspectorOpen(false)}>×</button></div>
        <div className="ide-agent-scroll">
          <section className="ide-inspector-context"><span className="ide-kicker">{activeConversation ? 'SELECTED CONVERSATION' : activePane === 'inbox' ? 'IMPORT ACTIVITY' : activePane === 'handoffs' ? 'AGENT ACTIVITY' : 'ACTIVE PROJECT'}</span><strong>{activeConversation?.title || activeProject?.title || (activePane === 'subscription' ? 'Account plan' : 'Workspace overview')}</strong><p>{activeConversation ? (activeConversation.source_ai || 'AI source') + ' · ' + formatDate(activeConversation.created_at) : activeProject?.description || 'Project context, saved rules and transfer preferences appear here.'}</p>{!activeConversation && Array.isArray(activeProject?.tags) && activeProject.tags.length > 0 && <div className="ide-inspector-tags">{activeProject.tags.slice(0,3).map(tag => <span key={tag}>{tag}</span>)}</div>}<div className="ide-inspector-stats"><span><strong>{projectConversations.length}</strong><small>Threads</small></span><span><strong>{projectDecisions.length}</strong><small>Decisions</small></span><span><strong>{projectHandoffs.length}</strong><small>Handoffs</small></span></div></section>
          <div className="ide-agent-section-title"><span>DESTINATION AI</span><button onClick={() => setPane('preferences')}>MANAGE</button></div>
          <button className="ide-agent-provider" onClick={() => setModal({ type: 'ai' })}>
            <AIProviderLogo provider={selectedProvider} className="ide-agent-logo"/>
            <span><strong>{selectedAgentName}</strong><small>{targetAi} · {selectedAgentSettings.model || 'Model not specified'}</small><small>{selectedAgentSettings.role || selectedProvider.role}</small></span>
            <ChevronDown size={15}/>
          </button>
          <label className="ide-agent-field">TASK ROLE<select className="ide-agent-select" value={activeSkillId} onChange={event => setActiveSkillId(event.target.value)}><option value="">Select a task role</option>{skills.map(skill => <option key={skill.id} value={skill.id}>{skill.role_name}</option>)}</select></label>
          <div className="ide-agent-divider"/>
          <label className="ide-agent-field">WHAT SHOULD THE AI DO?<textarea className="ide-task-input" value={taskPrompt} onChange={event => setTaskPrompt(event.target.value)} placeholder="Describe the next task. Example: Review the current architecture and identify the missing API boundaries…"/></label>
          <div className="ide-agent-context-head"><span>CONTEXT ATTACHED</span><strong>{selectedConversations.length}</strong></div>
          <div className="ide-agent-context-list">
            {projectConversations.slice(0,5).map(conversation => <label className="ide-agent-context-row" key={conversation.id}><input type="checkbox" checked={selectedIds.includes(conversation.id)} onChange={() => toggleConversation(conversation.id)}/><FileText size={13}/><span>{conversation.title}</span></label>)}
            {!projectConversations.length && <span className="ide-context-empty">Import conversations to attach project history.</span>}
          </div>
          <div className="ide-context-coverage"><div><span>SOURCE COVERAGE</span><strong>{selectedContextCoverage}%</strong></div><div className="ide-context-coverage-track"><span style={{ width: selectedContextCoverage + '%' }}/></div><small>{selectedConversations.length} of {projectConversations.length} threads selected · {selectedContextCharacters.toLocaleString()} characters attached</small></div>
          <div className="ide-context-summary"><ShieldCheck size={15}/><span>Project rules and saved preferences are included automatically. Only selected original threads enter the generated handoff.</span></div>
          <div className="ide-agent-divider"/>
          <div className="ide-agent-section-title"><span>RECENT AGENT RUNS</span><button onClick={() => setPane('handoffs')}>VIEW ALL</button></div>
          {projectHandoffs.slice(0,3).map(handoff => <div className="ide-agent-run-row" key={handoff.id}><span className="ide-run-dot"/><span><strong>{providerPreferences.providers?.[handoff.target_ai]?.agent_name || handoff.target_ai}</strong><small>{handoff.target_ai} · {handoff.role_name} · {formatDate(handoff.created_at)}</small></span><span className={handoff.confirmed ? 'run-status done' : 'run-status'}>{handoff.confirmed ? 'DONE' : 'SENT'}</span></div>)}
          {!projectHandoffs.length && <span className="ide-context-empty">Your handoff history will appear here.</span>}
        </div>
        <div className="ide-agent-footer">
          <div className="ide-agent-footer-meta"><span><span className="status-pulse"/> HANDOFF WORKSPACE</span><small>{selectedConversations.length} threads · {selectedContextCharacters.toLocaleString()} characters</small></div>
          <Button block onClick={() => setModal({ type: 'handoff' })} disabled={!activeProject || !activeSkill}><Workflow size={15}/> REVIEW & GENERATE AGENT.MD</Button>
          <Button block variant="ghost" onClick={() => openInAI(targetAi)} disabled={!activeProject || !activeSkill}>OPEN {targetAi.toUpperCase()} <ArrowUpRight size={14}/></Button>
          <button className="ide-advanced-link" onClick={downloadHandoff} disabled={!activeProject || !activeSkill}><Download size={13}/> DOWNLOAD AGENT.MD</button>
          <button className="ide-advanced-link" onClick={() => setShowTechnicalHandoff(value => !value)}>{showTechnicalHandoff ? 'HIDE TECHNICAL HANDOFF FILE' : 'ADVANCED · VIEW TECHNICAL HANDOFF FILE'}</button>
          {showTechnicalHandoff && <pre className="ide-technical-preview">{makeAgentMd()}</pre>}
        </div>
      </aside>
    </div>

    <nav className="ide-mobile-dock" aria-label="Mobile workspace navigation">
      <button className={!mobileAgentVisible && !mobileNavOpen && activePane === 'overview' ? 'active' : ''} aria-current={!mobileAgentVisible && !mobileNavOpen && activePane === 'overview' ? 'page' : undefined} onClick={() => setPane('overview')}><LayoutDashboard size={16}/><span>Overview</span></button>
      <button className={!mobileAgentVisible && !mobileNavOpen && activePane === 'projects' ? 'active' : ''} aria-current={!mobileAgentVisible && !mobileNavOpen && activePane === 'projects' ? 'page' : undefined} onClick={() => setPane('projects')}><FolderKanban size={16}/><span>Projects</span></button>
      <button className={!mobileAgentVisible && !mobileNavOpen && (activePane === 'conversations' || activePane === 'conversation') ? 'active' : ''} aria-current={!mobileAgentVisible && !mobileNavOpen && (activePane === 'conversations' || activePane === 'conversation') ? 'page' : undefined} onClick={() => setPane('conversations')}><MessageSquareText size={16}/><span>Vault</span></button>
      <button className={mobileAgentVisible ? 'active' : ''} aria-pressed={mobileAgentVisible} onClick={() => { setMobileNavOpen(false); setMobileAgentVisible(true) }}><Bot size={16}/><span>Agent</span></button>
      <button className={mobileNavOpen || (!mobileAgentVisible && !['overview','projects','conversations','conversation'].includes(activePane)) ? 'active' : ''} aria-expanded={mobileNavOpen} aria-controls="ide-mobile-more-menu" onClick={() => { setMobileAgentVisible(false); setMobileNavOpen(value => !value) }}><Menu size={16}/><span>More</span></button>
    </nav>
    {mobileNavOpen && <div className="ide-mobile-more-shell">
      <button className="ide-mobile-more-dismiss" aria-label="Close workspace navigation" onClick={() => setMobileNavOpen(false)}/>
      <nav className="ide-mobile-more" id="ide-mobile-more-menu" aria-label="More workspace destinations">
        <div className="ide-mobile-more-header"><span><small>VIBEVAULT</small><strong>Workspace navigation</strong></span><button aria-label="Close menu" onClick={() => setMobileNavOpen(false)}><X size={17}/></button></div>
        {navGroups.map(group => <section className="ide-mobile-more-group" key={group.label}><span>{group.label}</span>{group.items.map(item => <button key={item.id} className={activePane === item.id || (item.id === 'conversations' && activePane === 'conversation') ? 'active' : ''} aria-current={activePane === item.id || (item.id === 'conversations' && activePane === 'conversation') ? 'page' : undefined} onClick={() => setPane(item.id)}><item.icon size={16}/><span>{item.label}</span>{navCount(item) !== '' && Number(navCount(item)) > 0 && <small>{navCount(item)}</small>}</button>)}</section>)}
      </nav>
    </div>}

    {modal?.type === 'handoff' && <HandoffModal projects={projects} activeProjectId={activeProject?.id || ''} conversations={conversations} selectedIds={selectedIds} bundleModes={bundleModes} skills={skills} activeSkillId={activeSkillId} targetAi={targetAi} taskPrompt={taskPrompt} providerPreferences={providerPreferences} isPro={isPro} preview={makeAgentMd()} onProjectChange={projectId => { setActiveProjectId(projectId); setSelectedIds([]); setActiveConversationId(null) }} onToggleConversation={toggleConversation} onModeChange={(id, mode) => setBundleModes(current => ({...current,[id]:mode}))} onSkillChange={setActiveSkillId} onTargetChange={setTargetAi} onTaskChange={setTaskPrompt} onManagePreferences={() => setModal({ type: 'ai' })} onClose={() => setModal(null)} onCopy={() => saveHandoff(true)} onDownload={downloadHandoff} onOpen={openInAI}/>}
    {searchOpen && <div className="ide-search-backdrop" onMouseDown={event => event.target === event.currentTarget && setSearchOpen(false)}><section className="ide-search-dialog" role="dialog" aria-modal="true" aria-label="Search VibeVault"><div className="ide-search-input-wrap"><Search size={18}/><input autoFocus value={searchQuery} onChange={event => setSearchQuery(event.target.value)} onKeyDown={event => event.key === 'Escape' && setSearchOpen(false)} placeholder="Search projects, conversations, decisions and summaries…"/><kbd>ESC</kbd></div><div className="ide-search-results">{searchResults.map(result => <button key={result.kind + result.id} onClick={() => openWorkspaceSearchResult(result)}><span className="ide-search-result-icon">{result.kind === 'project' ? <FolderKanban size={16}/> : result.kind === 'conversation' ? <MessageSquareText size={16}/> : result.kind === 'decision' ? <CircleDot size={16}/> : <History size={16}/>}</span><span><strong>{result.title}</strong><small>{result.detail}</small></span><em>{result.kind}</em></button>)}{!searchResults.length && <div className="ide-search-empty">No matching records. Try a project or conversation title.</div>}</div><div className="ide-search-footer"><span>Searches your saved projects and project records</span><span>ESC to close</span></div></section></div>}

    {modal?.type === 'project' && <ProjectModal onClose={() => setModal(null)} onSave={createProject}/>}
    {modal?.type === 'project-edit' && <ProjectModal initialProject={activeProject} onClose={() => setModal(null)} onSave={updateProject}/>}
    {modal?.type === 'conversation' && <ConversationModal onClose={() => setModal(null)} onSave={saveConversation}/>}
    {modal?.type === 'import' && <ImportModal onClose={() => setModal(null)} onImport={saveImportedConversations} projects={projects} activeProjectId={activeProject?.id || ''} providerPreferences={providerPreferences}/>}
    {modal?.type === 'inbox' && <InboxModal captures={captureInbox} projects={projects} activeProjectId={activeProject?.id || ''} providerPreferences={providerPreferences} onClose={() => setModal(null)} onImport={importCapture} onDiscard={discardCapture}/>}
    {modal?.type === 'ai' && <AIWorkspaceModal initialPreferences={providerPreferences} onboarding={Boolean(modal.onboarding)} onClose={() => setModal(null)} onSave={saveAiPreferences}/>}
    {modal?.type === 'export' && <ExportModal projects={projects} activeProjectId={activeProject?.id || ''} providerPreferences={providerPreferences} onClose={() => setModal(null)} onExport={exportProject}/>}
    {modal?.type === 'integrations' && <IntegrationsModal tokens={integrationTokens} generatedToken={generatedToken} supabaseUrl={import.meta.env.VITE_SUPABASE_URL || ''} anonKey={import.meta.env.VITE_SUPABASE_ANON_KEY || ''} onClose={() => setModal(null)} onCreate={createIntegrationToken} onRevoke={revokeIntegrationToken}/>}
    {modal?.type === 'skill' && <SkillModal onClose={() => setModal(null)} onSave={createSkill}/>}
    {modal?.type === 'style' && <StyleModal initialValue={profile?.global_style || ''} onClose={() => setModal(null)} onSave={updateGlobalStyle}/>}
    {modal?.type === 'profile' && <ProfileModal initialValue={profile?.display_name || user.user_metadata?.display_name || ''} email={user.email || ''} onClose={() => setModal(null)} onSave={updateDisplayName}/>}
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

function ProjectModal({ initialProject = null, onClose, onSave }) {
  const [values, setValues] = useState({
    title: initialProject?.title || '',
    description: initialProject?.description || '',
    project_rules: initialProject?.project_rules || '',
    tags: (initialProject?.tags || []).join(', ')
  })
  const [busy, setBusy] = useState(false)
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await onSave(values) } catch (error) { alert(error.message) } finally { setBusy(false) } }
  return <Modal title={initialProject ? "EDIT PROJECT" : "CREATE PROJECT"} eyebrow={initialProject ? "PROJECT SETTINGS" : "NEW WORKSPACE"} onClose={onClose}><form className="modal-form" onSubmit={submit}><label className="field-label">PROJECT TITLE<input className="field-input" required value={values.title} onChange={e => setValues({ ...values, title: e.target.value })} placeholder="e.g. SurePesa"/></label><label className="field-label">DESCRIPTION<textarea className="field-input field-textarea" value={values.description} onChange={e => setValues({ ...values, description: e.target.value })} placeholder="What are you building?"/></label><label className="field-label">PROJECT RULES<textarea className="field-input field-textarea" value={values.project_rules} onChange={e => setValues({ ...values, project_rules: e.target.value })} placeholder="Architecture decisions, constraints, conventions..."/></label><label className="field-label">TAGS<input className="field-input" value={values.tags} onChange={e => setValues({ ...values, tags: e.target.value })} placeholder="fintech, react, backend"/></label><div className="modal-actions"><Button variant="ghost" type="button" onClick={onClose}>CANCEL</Button><Button disabled={busy}>{busy ? 'SAVING...' : initialProject ? 'SAVE PROJECT SETTINGS' : 'CREATE PROJECT'}</Button></div></form></Modal>
}

function ConversationModal({ onClose, onSave }) {
  const [values, setValues] = useState({ title: '', source_ai: 'ChatGPT', raw_content: '', tags: '' })
  const [busy, setBusy] = useState(false)
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await onSave(values) } catch (error) { alert(error.message) } finally { setBusy(false) } }
  return <Modal title="SAVE RAW CONVERSATION" eyebrow="PRESERVE ORIGINAL CONTEXT" onClose={onClose} wide><form className="modal-form" onSubmit={submit}><div className="form-two-col"><label className="field-label">RECORD TITLE<input className="field-input" required value={values.title} onChange={e => setValues({ ...values, title: e.target.value })} placeholder="Describe this conversation"/></label><label className="field-label">SOURCE AI<select className="field-input" value={values.source_ai} onChange={e => setValues({ ...values, source_ai: e.target.value })}>{AI_PROVIDERS.map(provider => <option key={provider.name} value={provider.name}>{provider.name}</option>)}</select></label></div><label className="field-label">RAW THREAD<textarea className="field-input field-textarea raw-input" required value={values.raw_content} onChange={e => setValues({ ...values, raw_content: e.target.value })} placeholder="Paste the exact conversation here. VibeVault stores this text without rewriting it."/></label><label className="field-label">TAGS<input className="field-input" value={values.tags} onChange={e => setValues({ ...values, tags: e.target.value })} placeholder="architecture, bug-fix, product-thinking"/></label><div className="raw-integrity"><ShieldCheck size={15}/> The original text is saved as supplied. No automatic cleanup is applied.</div><div className="modal-actions"><Button variant="ghost" type="button" onClick={onClose}>CANCEL</Button><Button disabled={busy}>{busy ? 'SAVING...' : 'SAVE RAW THREAD'}</Button></div></form></Modal>
}


function AIProviderLogo({ provider, className = '' }) {
  const [failed, setFailed] = useState(false)
  return <span className={className}>{provider?.logo && !failed
    ? <img src={provider.logo} alt={provider.name + ' official brand mark'} onError={() => setFailed(true)}/>
    : <span className="provider-wordmark">{provider?.name || 'AI'}</span>}</span>
}

function TransferAgentChooser({ preferences, targetAi, setTargetAi, agentMode, setAgentMode, manualTarget, setManualTarget, purpose, setPurpose }) {
  const savedProviders = AI_PROVIDERS.filter(provider => preferences.providers?.[provider.name]?.enabled)
  const savedTarget = savedProviders.some(provider => provider.name === targetAi) ? targetAi : (savedProviders[0]?.name || '')
  return <section className="transfer-agent-card">
    <div className="transfer-card-heading"><span className="transfer-card-icon"><Bot size={17}/></span><span><strong>Choose the receiving AI</strong><small>Set where this context should continue.</small></span></div>
    <div className="transfer-mode-options">
      <label className={'transfer-mode-option ' + (agentMode === 'saved' ? 'selected' : '')}><input type="radio" name="transfer-agent-mode" checked={agentMode === 'saved'} disabled={!savedProviders.length} onChange={() => { setAgentMode('saved'); if (savedTarget) setTargetAi(savedTarget) }}/><span><strong>Use my saved agent</strong><small>Use its saved name and purpose.</small></span></label>
      <label className={'transfer-mode-option ' + (agentMode === 'manual' ? 'selected' : '')}><input type="radio" name="transfer-agent-mode" checked={agentMode === 'manual'} onChange={() => setAgentMode('manual')}/><span><strong>Choose for this transfer</strong><small>Pick another AI and describe its task.</small></span></label>
    </div>
    {agentMode === 'saved' ? <div className="transfer-saved-agent">{savedProviders.length ? <>
      <label className="field-label">SAVED AI AGENT<select className="field-input" value={savedTarget} onChange={event => setTargetAi(event.target.value)}>{savedProviders.map(provider => <option value={provider.name} key={provider.name}>{provider.name}</option>)}</select></label>
      <div className="transfer-agent-identity"><AIProviderLogo provider={AI_PROVIDERS.find(provider => provider.name === savedTarget)} className="transfer-provider-logo"/><span><strong>{preferences.providers?.[savedTarget]?.agent_name || savedTarget}</strong><small>{savedTarget} · {preferences.providers?.[savedTarget]?.model || 'Model not specified'}</small><small>{preferences.providers?.[savedTarget]?.role || 'Purpose not specified'}</small></span><CheckCircle2 size={16}/></div>
    </> : <div className="transfer-no-saved"><span>No saved AI agents yet.</span><small>Choose an agent for this transfer, or complete AI workspace setup first.</small></div>}</div> : <div className="transfer-manual-agent">
      <label className="field-label">AI PROVIDER<select className="field-input" value={manualTarget} onChange={event => setManualTarget(event.target.value)}>{AI_PROVIDERS.map(provider => <option value={provider.name} key={provider.name}>{provider.name}</option>)}</select></label>
      <label className="field-label">WHAT SHOULD THIS AGENT BE USED FOR?<textarea className="field-input field-textarea" value={purpose} onChange={event => setPurpose(event.target.value)} placeholder="For example: review the architecture, identify security gaps, and propose a plan." required/></label>
    </div>}
    <p className="transfer-agent-note"><ShieldCheck size={14}/> This prepares the handoff context. It does not send project data to an AI provider automatically.</p>
  </section>
}

function ImportModal({ onClose, onImport, projects, activeProjectId, providerPreferences }) {
  const [sourceAi, setSourceAi] = useState('ChatGPT')
  const [title, setTitle] = useState('')
  const [rawText, setRawText] = useState('')
  const [filename, setFilename] = useState('')
  const [destinationProjectId, setDestinationProjectId] = useState(activeProjectId || projects[0]?.id || '')
  const [agentMode, setAgentMode] = useState(Object.values(providerPreferences.providers || {}).some(item => item?.enabled) ? 'saved' : 'manual')
  const [targetAi, setTargetAi] = useState(providerPreferences.providers?.[providerPreferences.last_target]?.enabled ? providerPreferences.last_target : (AI_PROVIDERS.find(provider => providerPreferences.providers?.[provider.name]?.enabled)?.name || 'Claude'))
  const [manualTarget, setManualTarget] = useState('Claude')
  const [purpose, setPurpose] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [previewCount, setPreviewCount] = useState(0)
  const handleFile = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    setFilename(file.name); setError('')
    try {
      const text = await file.text()
      setRawText(text)
      const parsed = parseImportedConversations(text, file.name, sourceAi)
      setPreviewCount(parsed.length)
      if (parsed.length === 1 && !title) setTitle(parsed[0].title)
    } catch (err) { setPreviewCount(0); setError(err.message) }
  }
  const submit = async event => {
    event.preventDefault()
    if (!destinationProjectId) { setError('Choose a destination project first.'); return }
    if (agentMode === 'manual' && !purpose.trim()) { setError('Describe what the selected AI should be used for.'); return }
    if (agentMode === 'saved' && !providerPreferences.providers?.[targetAi]?.enabled) { setError('Choose a saved AI agent or switch to manual selection.'); return }
    setBusy(true); setError('')
    try {
      const rows = parseImportedConversations(rawText, filename, sourceAi)
      if (rows.length === 1 && title.trim()) rows[0].title = title.trim()
      await onImport(rows, { projectId: destinationProjectId, targetAi: agentMode === 'saved' ? targetAi : manualTarget, agentMode, taskPurpose: agentMode === 'manual' ? purpose.trim() : '' })
    } catch (err) { setError(err.message || 'Could not import this conversation.') }
    finally { setBusy(false) }
  }
  return <Modal title="Import conversations" eyebrow="ADD CONTEXT TO YOUR PROJECT" onClose={onClose} wide>
    <form className="modal-form import-form transfer-dialog" onSubmit={submit}>
      <div className="transfer-destination-card"><div className="transfer-card-heading"><span className="transfer-card-icon"><FolderKanban size={17}/></span><span><strong>Where should this content go?</strong><small>Choose the project that will own these original conversations.</small></span></div>
        <label className="field-label">DESTINATION PROJECT<select className="field-input" value={destinationProjectId} onChange={event => setDestinationProjectId(event.target.value)} required><option value="">Choose a project</option>{projects.map(project => <option value={project.id} key={project.id}>{project.title}</option>)}</select></label>
        {!projects.length && <div className="transfer-no-saved"><span>No projects yet.</span><small>Create a project before importing conversations.</small></div>}
      </div>
      <TransferAgentChooser preferences={providerPreferences} targetAi={targetAi} setTargetAi={setTargetAi} agentMode={agentMode} setAgentMode={setAgentMode} manualTarget={manualTarget} setManualTarget={setManualTarget} purpose={purpose} setPurpose={setPurpose}/>
      <div className="import-source-note"><Archive size={18}/><span><strong>Your original conversation is preserved.</strong><small>Supported formats: JSON, JSONL, TXT and Markdown. ZIP archives must be extracted first.</small></span></div>
      <div className="form-two-col"><label className="field-label">SOURCE AI<select className="field-input" value={sourceAi} onChange={e => setSourceAi(e.target.value)}>{AI_PROVIDERS.map(provider => <option key={provider.name} value={provider.name}>{provider.name}</option>)}</select></label><label className="field-label">CONVERSATION TITLE<input className="field-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Used for a single text import"/></label></div>
      <label className="import-dropzone"><Upload size={24}/><strong>{filename || 'Choose a conversation file'}</strong><span>JSON, JSONL, TXT or Markdown</span><input type="file" accept=".json,.jsonl,.txt,.md,.markdown" onChange={handleFile}/></label>
      <div className="import-divider"><span>OR PASTE A CONVERSATION</span></div>
      <label className="field-label">CONVERSATION CONTENT<textarea className="field-input field-textarea raw-input" required value={rawText} onChange={e => setRawText(e.target.value)} placeholder="Paste the conversation here, or choose a file above."/></label>
      {previewCount > 0 && <div className="notice notice-success"><CheckCircle2 size={16}/><span>Ready to import {previewCount} conversation{previewCount === 1 ? '' : 's'}.</span></div>}
      {error && <div className="notice notice-error"><CircleHelp size={16}/><span>{error}</span></div>}
      <div className="raw-integrity"><ShieldCheck size={15}/> The saved transcript remains separate from generated specifications and handoff notes.</div>
      <div className="modal-actions"><Button variant="ghost" type="button" onClick={onClose}>Cancel</Button><Button disabled={busy || !rawText.trim() || !projects.length}>{busy ? <><span className="vv-spinner"/> Importing…</> : 'Import to project'}</Button></div>
    </form>
  </Modal>
}

function InboxModal({ captures, projects, activeProjectId, providerPreferences, onClose, onImport, onDiscard }) {
  const [projectForCapture, setProjectForCapture] = useState({})
  const [agentMode, setAgentMode] = useState(Object.values(providerPreferences.providers || {}).some(item => item?.enabled) ? 'saved' : 'manual')
  const [targetAi, setTargetAi] = useState(providerPreferences.providers?.[providerPreferences.last_target]?.enabled ? providerPreferences.last_target : (AI_PROVIDERS.find(provider => providerPreferences.providers?.[provider.name]?.enabled)?.name || 'Claude'))
  const [manualTarget, setManualTarget] = useState('Claude')
  const [purpose, setPurpose] = useState('')
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const importOne = async capture => {
    const destination = projectForCapture[capture.id] || activeProjectId || projects[0]?.id || ''
    if (!destination) { setError('Choose a destination project before importing.'); return }
    if (agentMode === 'manual' && !purpose.trim()) { setError('Describe what the selected AI should be used for.'); return }
    if (agentMode === 'saved' && !providerPreferences.providers?.[targetAi]?.enabled) { setError('Choose a saved AI agent or switch to manual selection.'); return }
    setBusyId(capture.id); setError('')
    const transfer = { targetAi: agentMode === 'saved' ? targetAi : manualTarget, agentMode, taskPurpose: agentMode === 'manual' ? purpose.trim() : '' }
    try { await onImport(capture, destination, transfer) }
    catch (err) { setError(err.message || 'Could not import this capture.') }
    finally { setBusyId('') }
  }
  const discardOne = async id => {
    setBusyId(id); setError('')
    try { await onDiscard(id) } catch (err) { setError(err.message || 'Could not discard this capture.') }
    finally { setBusyId('') }
  }
  return <Modal title="Import inbox" eyebrow="REVIEW BROWSER CAPTURES" onClose={onClose} wide>
    <div className="inbox-intro"><Inbox size={19}/><span>Captured conversations remain here until you assign a destination and add them to a project.</span></div>
    {captures.length > 0 && <TransferAgentChooser preferences={providerPreferences} targetAi={targetAi} setTargetAi={setTargetAi} agentMode={agentMode} setAgentMode={setAgentMode} manualTarget={manualTarget} setManualTarget={setManualTarget} purpose={purpose} setPurpose={setPurpose}/>}
    {!captures.length ? <div className="empty-state inbox-empty"><Inbox size={28}/><h3 className="display">Your inbox is clear.</h3><p>Capture a conversation from a supported AI page to review it here.</p></div> : <div className="inbox-capture-list">{captures.map(capture => <article className="inbox-capture-card transfer-capture-card" key={capture.id}><div className="conversation-meta"><span className="source-badge">{capture.source_ai}</span><span>{formatDate(capture.created_at)}</span></div><h3>{capture.title}</h3><p>{(capture.raw_content || '').slice(0, 220).replace(/\s+/g, ' ')}{(capture.raw_content || '').length > 220 ? '…' : ''}</p><label className="field-label">DESTINATION PROJECT<select className="field-input" value={projectForCapture[capture.id] || activeProjectId || projects[0]?.id || ''} onChange={e => setProjectForCapture(current => ({ ...current, [capture.id]: e.target.value }))}><option value="">Choose a project</option>{projects.map(project => <option value={project.id} key={project.id}>{project.title}</option>)}</select></label><div className="modal-actions"><Button variant="ghost" onClick={() => discardOne(capture.id)} disabled={busyId === capture.id}>Discard</Button><Button onClick={() => importOne(capture)} disabled={busyId === capture.id || !projects.length}>{busyId === capture.id ? 'Saving…' : 'Add to project'}</Button></div></article>)}</div>}
    {error && <div className="notice notice-error"><CircleHelp size={16}/><span>{error}</span></div>}
    <div className="modal-actions"><Button onClick={onClose}>Done</Button></div>
  </Modal>
}

function ExportModal({ projects, activeProjectId, providerPreferences, onClose, onExport }) {
  const [projectId, setProjectId] = useState(activeProjectId || projects[0]?.id || '')
  const [agentMode, setAgentMode] = useState(Object.values(providerPreferences.providers || {}).some(item => item?.enabled) ? 'saved' : 'manual')
  const [targetAi, setTargetAi] = useState(providerPreferences.providers?.[providerPreferences.last_target]?.enabled ? providerPreferences.last_target : (AI_PROVIDERS.find(provider => providerPreferences.providers?.[provider.name]?.enabled)?.name || 'Claude'))
  const [manualTarget, setManualTarget] = useState('Claude')
  const [purpose, setPurpose] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async event => {
    event.preventDefault()
    if (!projectId) { setError('Choose a project to export.'); return }
    if (agentMode === 'manual' && !purpose.trim()) { setError('Describe what the selected AI should be used for.'); return }
    if (agentMode === 'saved' && !providerPreferences.providers?.[targetAi]?.enabled) { setError('Choose a saved AI agent or switch to manual selection.'); return }
    setBusy(true); setError('')
    try { await onExport({ projectId, targetAi: agentMode === 'saved' ? targetAi : manualTarget, agentMode, taskPurpose: agentMode === 'manual' ? purpose.trim() : '' }) }
    catch (err) { setError(err.message || 'Could not export this project.') }
    finally { setBusy(false) }
  }
  return <Modal title="Export project" eyebrow="PREPARE A PORTABLE PROJECT BUNDLE" onClose={onClose} wide>
    <form className="modal-form transfer-dialog" onSubmit={submit}>
      <div className="transfer-destination-card"><div className="transfer-card-heading"><span className="transfer-card-icon"><Download size={17}/></span><span><strong>Choose the project to export</strong><small>The bundle includes original conversations and saved project records.</small></span></div>
        <label className="field-label">PROJECT<select className="field-input" value={projectId} onChange={event => setProjectId(event.target.value)} required><option value="">Choose a project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
      </div>
      <TransferAgentChooser preferences={providerPreferences} targetAi={targetAi} setTargetAi={setTargetAi} agentMode={agentMode} setAgentMode={setAgentMode} manualTarget={manualTarget} setManualTarget={setManualTarget} purpose={purpose} setPurpose={setPurpose}/>
      {error && <div className="notice notice-error"><CircleHelp size={16}/><span>{error}</span></div>}
      <div className="transfer-export-note"><ShieldCheck size={15}/> The selected agent is recorded in export metadata only. Exporting does not send the bundle to that provider.</div>
      <div className="modal-actions"><Button variant="ghost" type="button" onClick={onClose}>Cancel</Button><Button disabled={busy || !projects.length}>{busy ? 'Preparing export…' : 'Export project bundle'}</Button></div>
    </form>
  </Modal>
}


function HandoffModal({ projects, activeProjectId, conversations, selectedIds, bundleModes, skills, activeSkillId, targetAi, taskPrompt, providerPreferences, isPro, preview, onProjectChange, onToggleConversation, onModeChange, onSkillChange, onTargetChange, onTaskChange, onManagePreferences, onClose, onCopy, onDownload, onOpen }) {
  const [step, setStep] = useState(0)
  const providers = AI_PROVIDERS.filter(provider => providerPreferences.providers?.[provider.name]?.enabled)
  const projectConversations = conversations.filter(conversation => conversation.project_id === activeProjectId)
  const selectedCount = projectConversations.filter(conversation => selectedIds.includes(conversation.id)).length
  const activeSkill = skills.find(skill => skill.id === activeSkillId) || skills[0]
  const selectedIndex = Math.max(0, providers.findIndex(provider => provider.name === targetAi))
  const orbitOffsets = providers.length <= 5 ? Array.from({ length: providers.length }, (_, index) => index - Math.floor(providers.length / 2)) : [-2, -1, 0, 1, 2]
  const orbitEntries = providers.length ? orbitOffsets.map(offset => ({ offset, provider: providers[(selectedIndex + offset + providers.length) % providers.length] })) : []
  const selectedAgent = providerPreferences.providers?.[targetAi] || {}
  const selectedAgentName = selectedAgent.agent_name || targetAi
  const selectedProvider = providers.find(provider => provider.name === targetAi) || AI_PROVIDERS.find(provider => provider.name === targetAi)
  const readinessItems = [
    { label: 'Project', ready: Boolean(activeProjectId) },
    { label: 'Task role', ready: Boolean(activeSkill) },
    { label: 'Receiving agent', ready: Boolean(selectedProvider) },
    { label: 'Task brief', ready: Boolean(taskPrompt.trim()) }
  ]
  const readinessCount = readinessItems.filter(item => item.ready).length
  const labels = ['Project & role', 'Source context', 'Receiving AI', 'Review handoff']
  const next = () => {
    if (step === 0 && (!activeProjectId || !activeSkill)) return
    if (step === 2 && !providers.some(provider => provider.name === targetAi)) return
    setStep(current => Math.min(3, current + 1))
  }
  return <Modal title="Agent Handoff Studio" eyebrow="GUIDED CONTEXT TRANSFER" onClose={onClose} wide>
    <div className="handoff-wizard">
      <div className="handoff-progress"><div className="handoff-progress-copy"><span>STEP {step + 1} OF 4</span><strong>{labels[step]}</strong></div><div className="handoff-progress-track"><span style={{width: ((step + 1) * 25) + '%'}}/></div></div>
      {step === 0 && <div className="handoff-step">
        <span className="ide-kicker">01 / DEFINE THE WORKSPACE</span><h3>Choose the project and task role.</h3><p>The handoff always includes project description, project rules, global style and your saved working preferences.</p>
        <label className="field-label">PROJECT<select className="field-input" value={activeProjectId} onChange={event => onProjectChange(event.target.value)} required><option value="">Choose a project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
        <label className="field-label">ASSIGNED AGENT ROLE<select className="field-input" value={activeSkill?.id || ''} onChange={event => onSkillChange(event.target.value)} required>{skills.map(skill => <option key={skill.id} value={skill.id}>{skill.role_name}</option>)}</select></label>
        {activeSkill && <div className="handoff-role-note"><strong>{activeSkill.role_name}</strong><span>{activeSkill.instructions}</span></div>}
      </div>}
      {step === 1 && <div className="handoff-step">
        <span className="ide-kicker">02 / SELECT SOURCE MATERIAL</span><h3>Choose the conversations to carry forward.</h3><p>Original threads are never changed. Choose RAW THREAD or an existing CLEANED SPEC for each selected conversation.</p>
        <div className="handoff-source-list">{projectConversations.map(conversation => <div className="handoff-source-row" key={conversation.id}>
          <label><input type="checkbox" checked={selectedIds.includes(conversation.id)} onChange={() => onToggleConversation(conversation.id)}/><span><strong>{conversation.title}</strong><small>{conversation.source_ai} · {formatDate(conversation.created_at)}</small></span></label>
          <select aria-label={'Context mode for ' + conversation.title} value={bundleModes[conversation.id] || 'raw'} onChange={event => onModeChange(conversation.id,event.target.value)} disabled={!selectedIds.includes(conversation.id)}><option value="raw">RAW THREAD</option><option value="clean" disabled={!isPro || !conversation.cleaned_spec}>CLEANED SPEC{!conversation.cleaned_spec ? ' · NOT GENERATED' : !isPro ? ' · PRO' : ''}</option></select>
        </div>)}{!projectConversations.length && <div className="ide-panel-empty compact"><MessageSquareText size={18}/><strong>No conversations in this project</strong><span>You can still create a handoff using the project rules and your task instructions.</span></div>}</div>
        <div className="handoff-selection-note"><ShieldCheck size={15}/>{selectedCount} conversation{selectedCount === 1 ? '' : 's'} selected. Unselected threads are not included.</div>
      </div>}
      {step === 2 && <div className="handoff-step">
        <span className="ide-kicker">03 / CHOOSE THE RECEIVING AI</span><h3>Where should this context continue?</h3><p>Choose one of the providers enabled in your saved AI preferences.</p>
        {providers.length ? <>
          <div className="handoff-orbit-heading"><strong>{providers.length} SAVED AGENT{providers.length === 1 ? '' : 'S'}</strong><span>Select the agent that should receive this project context.</span></div>
          <div className="handoff-agent-orbit" aria-label="Saved AI agent selector">
            <div className="handoff-orbit-arc" aria-hidden="true"/>
            {orbitEntries.map(({ provider, offset }) => {
              const settings = providerPreferences.providers?.[provider.name] || {}
              const selected = targetAi === provider.name
              return <button type="button" key={provider.name} aria-pressed={selected} aria-label={'Select ' + (settings.agent_name || provider.name) + ', ' + provider.name} data-position={offset} className={'handoff-orbit-card ' + (selected ? 'selected' : '')} style={{ left: 'calc(50% + ' + (offset * 158) + 'px)', top: (14 + Math.abs(offset) * 25) + 'px', zIndex: 5 - Math.abs(offset) }} onClick={() => onTargetChange(provider.name)}>
                <span className="handoff-orbit-topline"><AIProviderLogo provider={provider} className="handoff-orbit-logo"/><span className="handoff-orbit-selected">{selected ? <><CheckCircle2 size={11}/> SELECTED</> : provider.name}</span></span>
                <strong className="handoff-orbit-name">{settings.agent_name || provider.name}</strong>
                <span className="handoff-orbit-provider">{provider.name}</span>
                <span className="handoff-orbit-facts"><span><small>MODEL</small><strong>{settings.model || 'Not specified'}</strong></span><span><small>PURPOSE</small><strong>{settings.role || provider.role}</strong></span></span>
              </button>
            })}
          </div>
          <div className="handoff-selected-agent">
            <div className="handoff-selected-main"><AIProviderLogo provider={selectedProvider} className="handoff-selected-logo"/><span><small>RECEIVING AGENT</small><strong>{selectedAgentName}</strong><em>{targetAi} · {selectedAgent.model || 'Model not specified'}</em></span></div>
            <div className="handoff-selected-purpose"><small>ASSIGNED PURPOSE</small><strong>{selectedAgent.role || selectedProvider?.role || 'Purpose not specified'}</strong></div>
            <button type="button" onClick={onManagePreferences}>EDIT AGENT DETAILS</button>
          </div>
          <div className="handoff-preference-note"><strong>Saved working preferences</strong><span>{providerPreferences.profile?.collaboration || 'balanced'} collaboration · {providerPreferences.profile?.detail || 'clear'} response detail</span><small>Agent name, provider, model and purpose are included in the generated handoff.</small></div>
        </> : <div className="ide-panel-empty"><Layers3 size={20}/><strong>No saved AI providers</strong><span>Configure at least one receiving AI before generating this handoff.</span><Button variant="ghost" onClick={onManagePreferences}>MANAGE AI PREFERENCES</Button></div>}
        <label className="field-label">WHAT SHOULD THE RECEIVING AI DO?<textarea className="field-input field-textarea" value={taskPrompt} onChange={event => onTaskChange(event.target.value)} placeholder="Describe the next task, expected outcome and any boundaries."/></label>
      </div>}
      {step === 3 && <div className="handoff-step handoff-preview-step">
        <span className="ide-kicker">04 / REVIEW BEFORE TRANSFER</span><h3>Review the generated context.</h3><p>Check the selected project, role, saved preferences, task and source material before copying or launching the receiving AI.</p>
        <div className="handoff-preview-meta"><span><strong>{projects.find(project => project.id === activeProjectId)?.title || 'No project'}</strong><small>Project</small></span><span><strong>{activeSkill?.role_name || 'No role'}</strong><small>Assigned role</small></span><span><strong>{selectedAgentName}</strong><small>{targetAi} · {selectedAgent.model || 'Model not specified'}</small></span><span><strong>{selectedCount}</strong><small>Source threads</small></span></div>
        <div className="handoff-readiness"><div className="handoff-readiness-head"><span>HANDOFF READINESS</span><strong>{readinessCount}/4 details ready</strong></div><div className="handoff-readiness-track"><span style={{ width: (readinessCount * 25) + '%' }}/></div><div className="handoff-readiness-items">{readinessItems.map(item => <span className={item.ready ? 'ready' : ''} key={item.label}>{item.ready ? <CheckCircle2 size={12}/> : <CircleHelp size={12}/>} {item.label}</span>)}</div><small>Estimated payload: ~{Math.ceil((preview || '').length / 4).toLocaleString()} tokens. This is a size estimate, not a guarantee of the receiving model's context limit.</small></div>
        <pre className="handoff-preview-code">{preview}</pre>
      </div>}
      <div className="modal-actions handoff-actions">
        {step > 0 && <Button variant="ghost" onClick={() => setStep(current => current - 1)}>BACK</Button>}
        <span className="handoff-actions-spacer"/>
        <Button variant="ghost" onClick={onClose}>CANCEL</Button>
        {step < 3 ? <Button onClick={next} disabled={(step === 0 && (!activeProjectId || !activeSkill)) || (step === 2 && !providers.some(provider => provider.name === targetAi))}>CONTINUE</Button> : <><Button variant="ghost" onClick={onDownload}><Download size={14}/> DOWNLOAD</Button><Button variant="ghost" onClick={() => onOpen(targetAi)}>OPEN {targetAi.toUpperCase()} <ArrowUpRight size={14}/></Button><Button onClick={onCopy}><Clipboard size={14}/> COPY & LOG HANDOFF</Button></>}
      </div>
    </div>
  </Modal>
}

function AIWorkspaceModal({ initialPreferences, onboarding, onClose, onSave }) {
  const [step, setStep] = useState(0)
  const [providers, setProviders] = useState(() => Object.fromEntries(AI_PROVIDERS.map(provider => { const saved = initialPreferences.providers?.[provider.name] || {}; return [provider.name, { enabled: Boolean(saved.enabled), agent_name: saved.agent_name || provider.name, model: saved.model || '', role: saved.role || provider.role }] })))
  const [profile, setProfile] = useState(() => ({ focus: initialPreferences.profile?.focus || 'software', experience: initialPreferences.profile?.experience || 'building', collaboration: initialPreferences.profile?.collaboration || 'balanced', detail: initialPreferences.profile?.detail || 'clear' }))
  const [lastTarget, setLastTarget] = useState(initialPreferences.last_target || 'Claude')
  const [recommendations, setRecommendations] = useState(Boolean(initialPreferences.recommendations))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const enabledProviders = AI_PROVIDERS.filter(provider => providers[provider.name]?.enabled)
  const submit = async event => {
    event.preventDefault()
    if (step < 3) { setStep(current => Math.min(3, current + 1)); return }
    if (!enabledProviders.length) { setStep(2); setError('Choose at least one AI provider.'); return }
    setBusy(true); setError('')
    try { await onSave({ providers, profile, last_target: lastTarget, recommendations }) }
    catch (err) { setError(err.message || 'Could not save your AI workspace.') }
    finally { setBusy(false) }
  }
  const labels = ['Your work', 'Agent behaviour', 'AI tools', 'Defaults']
  return <Modal title={onboarding ? 'Welcome to VibeVault' : 'AI workspace preferences'} eyebrow={onboarding ? 'PERSONALISE YOUR FIRST WORKSPACE' : 'PROVIDERS · AGENT BEHAVIOUR · DEFAULTS'} onClose={onboarding ? undefined : onClose} wide>
    <form className="modal-form setup-wizard" onSubmit={submit}>
      <div className="setup-wizard-progress"><div className="setup-step-label"><span>STEP {step + 1} OF 4</span><strong>{labels[step]}</strong></div><div className="setup-progress-track"><span style={{width: ((step + 1) * 25) + '%'}}/></div></div>
      {step === 0 && <div className="setup-wizard-page"><span className="setup-wizard-kicker">LET'S SET UP YOUR SPACE</span><h3>What brings you to VibeVault?</h3><p>We use this to shape the way your agents organise and return project context.</p>
        <div className="setup-answer-grid">{[['software','Build apps & software','Websites, mobile apps, APIs and code.'],['product','Build products & businesses','Product decisions, operations and planning.'],['learning','Learn & research','Study notes, analysis and investigation.'],['creative','Create content & media','Writing, design, video and creative work.'],['mixed','A bit of everything','Switch between different kinds of projects.']].map(([value,title,description]) => <button type="button" key={value} className={'setup-answer-card ' + (profile.focus === value ? 'selected' : '')} onClick={() => setProfile(current => ({...current,focus:value}))}><strong>{title}</strong><small>{description}</small>{profile.focus === value && <CheckCircle2 size={16}/>}</button>)}</div>
        <label className="field-label">YOUR EXPERIENCE<select className="field-input" value={profile.experience} onChange={event => setProfile(current => ({...current,experience:event.target.value}))}><option value="new">I'm just getting started</option><option value="building">I build things regularly</option><option value="experienced">I'm experienced and want more control</option></select></label>
      </div>}
      {step === 1 && <div className="setup-wizard-page"><span className="setup-wizard-kicker">HOW SHOULD YOUR AGENTS WORK?</span><h3>Choose your working style.</h3><p>These preferences guide agent behaviour. You can change them at any time.</p>
        <div className="setup-behaviour-list">{[['guided','Guide me as we work','Explain the plan, break work into steps and check before moving on.'],['balanced','Work with me','Move work forward, explain important choices and ask before major changes.'],['proactive','Take initiative','Suggest next steps and act on clearly defined tasks while stating assumptions.']].map(([value,title,description]) => <button type="button" key={value} className={'setup-behaviour-card ' + (profile.collaboration === value ? 'selected' : '')} onClick={() => setProfile(current => ({...current,collaboration:value}))}><span><strong>{title}</strong><small>{description}</small></span>{profile.collaboration === value && <CheckCircle2 size={17}/>}</button>)}</div>
        <label className="field-label">ANSWER DETAIL<select className="field-input" value={profile.detail} onChange={event => setProfile(current => ({...current,detail:event.target.value}))}><option value="concise">Concise answers and summaries</option><option value="clear">Clear explanations with useful detail</option><option value="deep">Deep explanations and trade-offs</option></select></label>
      </div>}
      {step === 2 && <div className="setup-wizard-page"><span className="setup-wizard-kicker">YOUR AI TOOLKIT</span><h3>Which AI tools do you use?</h3><p>Select the providers you use, then add the usual purpose for each selected agent.</p>
        <div className="setup-provider-list">{AI_PROVIDERS.map(provider => { const value = providers[provider.name]; return <article className={'setup-provider-row ' + (value.enabled ? 'selected' : '')} key={provider.name}>
          <label className="setup-provider-select"><input type="checkbox" checked={value.enabled} onChange={event => setProviders(current => ({...current,[provider.name]:{...current[provider.name],enabled:event.target.checked}}))}/><AIProviderLogo provider={provider} className="setup-provider-logo"/><span><strong>{provider.name}</strong><small>{provider.description}</small></span><span className="setup-provider-check">{value.enabled ? <CheckCircle2 size={17}/> : <Plus size={15}/>}</span></label>
          {value.enabled && <div className="setup-agent-fields"><label className="field-label">AGENT NAME<input className="field-input" value={value.agent_name} onChange={event => setProviders(current => ({...current,[provider.name]:{...current[provider.name],agent_name:event.target.value}}))} placeholder={'Name your ' + provider.name + ' agent'}/></label><label className="field-label">MODEL<input className="field-input" value={value.model} onChange={event => setProviders(current => ({...current,[provider.name]:{...current[provider.name],model:event.target.value}}))} placeholder="e.g. model or version you use"/></label><label className="field-label setup-role-field">ASSIGNED PURPOSE<input className="field-input" value={value.role} onChange={event => setProviders(current => ({...current,[provider.name]:{...current[provider.name],role:event.target.value}}))} placeholder="e.g. UI implementation, backend review, research"/></label></div>}
        </article>})}</div>
      </div>}
      {step === 3 && <div className="setup-wizard-page"><span className="setup-wizard-kicker">YOUR DEFAULT WORKFLOW</span><h3>Set your preferred agent.</h3><p>VibeVault uses this default when you don't select a different destination.</p>
        <label className="field-label">DEFAULT AI AGENT<select className="field-input" value={enabledProviders.some(provider => provider.name === lastTarget) ? lastTarget : (enabledProviders[0]?.name || '')} onChange={event => setLastTarget(event.target.value)}>{enabledProviders.map(provider => <option key={provider.name} value={provider.name}>{provider.name}</option>)}</select></label>
        {enabledProviders.length > 0 && <div className="setup-default-summary"><AIProviderLogo provider={enabledProviders.find(provider => provider.name === lastTarget) || enabledProviders[0]} className="setup-default-logo"/><span><strong>{providers[lastTarget]?.agent_name || enabledProviders.find(provider => provider.name === lastTarget)?.name || enabledProviders[0].name}</strong><small>{enabledProviders.find(provider => provider.name === lastTarget)?.name || enabledProviders[0].name} · {providers[lastTarget]?.model || 'Model not specified'}</small><small>{providers[lastTarget]?.role || enabledProviders[0].role}</small></span></div>}
        <label className="recommendation-toggle"><input type="checkbox" checked={recommendations} onChange={event => setRecommendations(event.target.checked)}/><span><strong>Suggest a suitable AI for each task</strong><small>Suggestions never change the destination unless you approve them.</small></span></label>
        <div className="setup-review-summary"><strong>Your setup</strong><span>{enabledProviders.length} providers · {profile.collaboration} agent style · {profile.detail} detail</span><small>You can change these settings later.</small></div>
      </div>}
      {error && <div className="notice notice-error"><CircleHelp size={16}/><span>{error}</span></div>}
      <div className="modal-actions setup-wizard-actions">{step > 0 && <Button variant="ghost" type="button" onClick={() => {setStep(current => current - 1);setError('')}}>Back</Button>}{!onboarding && <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>}<Button disabled={busy || (step === 2 && !enabledProviders.length)}>{busy ? 'Saving preferences…' : step === 3 ? 'Finish setup' : 'Continue'}</Button></div>
    </form>
  </Modal>
}

function IntegrationsModal({ tokens, generatedToken, supabaseUrl, anonKey, onClose, onCreate, onRevoke }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const create = async scope => { setBusy(true); setError(''); try { await onCreate(scope) } catch (err) { setError(err.message || 'Could not create this connection token.') } finally { setBusy(false) } }
  const copy = text => navigator.clipboard.writeText(text)
  const edgeBase = supabaseUrl ? supabaseUrl.replace(/\/$/, '') + '/functions/v1/' : ''
  const tokenScope = generatedToken.startsWith('vv_capture_') ? 'capture' : generatedToken.startsWith('vv_mcp_') ? 'mcp' : ''
  return <Modal title="CONNECTIONS" eyebrow="VIBEVAULT INTEGRATIONS" onClose={onClose} wide>
    <div className="integration-intro"><Plug size={20}/><span><strong>Connect your AI workflow to your Vault.</strong><small>Browser Capture saves full page conversations to your review inbox. MCP lets compatible AI apps read project knowledge and save authorized updates.</small></span></div>
    <div className="integration-actions"><article><h3>Browser Capture Extension</h3><p>Capture the conversation open in ChatGPT, Claude or Gemini. Review it in your Import Inbox before it enters a project.</p><Button onClick={() => create('capture')} disabled={busy}>CREATE CAPTURE TOKEN</Button></article><article><h3>MCP Server</h3><p>Connect a compatible AI client to search projects, retrieve context and save session summaries or decisions.</p><Button variant="ghost" onClick={() => create('mcp')} disabled={busy}>CREATE MCP TOKEN</Button></article></div>
    {generatedToken && <div className="generated-token-panel"><span className="field-label">COPY THIS {tokenScope.toUpperCase()} TOKEN NOW · SHOWN ONLY ONCE</span><code>{generatedToken}</code><Button variant="ghost" onClick={() => copy(generatedToken)}><Clipboard size={14}/> COPY TOKEN</Button>{tokenScope === 'capture' ? <div className="extension-config"><p><strong>Extension connection details</strong></p><div><small>SUPABASE PROJECT URL</small><code>{supabaseUrl || 'Set VITE_SUPABASE_URL first'}</code></div><div><small>SUPABASE ANON KEY (PUBLIC)</small><code>{anonKey || 'Set VITE_SUPABASE_ANON_KEY first'}</code></div><p>Load the <a href="https://github.com/encryptedzee/VIBE_VAULT/tree/main/browser-extension" target="_blank" rel="noreferrer">browser-extension folder</a> as an unpacked Chrome extension, then paste these values and this token into its Settings.</p></div> : <div className="extension-config"><p><strong>MCP endpoint</strong></p><code>{edgeBase ? edgeBase + 'mcp' : 'Set VITE_SUPABASE_URL first'}</code><p>Use this URL as the remote MCP server address and the generated token as its Bearer authentication credential. Deploy the MCP Edge Function before connecting.</p></div>}</div>}
    <div className="token-list"><span className="field-label">ACTIVE CONNECTION TOKENS</span>{tokens.map(token => <div className="token-row" key={token.id}><span><strong>{token.label}</strong><small>{token.scope.toUpperCase()} · {formatDate(token.created_at)}</small></span>{token.revoked_at ? <span className="revoked-label">REVOKED</span> : <Button variant="ghost" onClick={() => onRevoke(token.id)}>REVOKE</Button>}</div>)}{!tokens.length && <p className="empty-small">No integration tokens created yet.</p>}</div>
    {error && <div className="notice notice-error"><CircleHelp size={16}/><span>{error}</span></div>}
    <div className="modal-actions"><Button onClick={onClose}>DONE</Button></div>
  </Modal>
}

function SkillModal({ onClose, onSave }) {
  const [values, setValues] = useState({ role_name: '', instructions: '' })
  const [busy, setBusy] = useState(false)
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await onSave(values) } catch (error) { alert(error.message) } finally { setBusy(false) } }
  return <Modal title="CREATE ROLE SKILL" eyebrow="DYNAMIC AGENT.MD" onClose={onClose}><form className="modal-form" onSubmit={submit}><label className="field-label">ROLE NAME<input className="field-input" required value={values.role_name} onChange={e => setValues({ ...values, role_name: e.target.value })} placeholder="e.g. Data Architect"/></label><label className="field-label">ROLE INSTRUCTIONS<textarea className="field-input field-textarea" required value={values.instructions} onChange={e => setValues({ ...values, instructions: e.target.value })} placeholder="Define responsibilities, working style and boundaries..."/></label><div className="modal-actions"><Button variant="ghost" type="button" onClick={onClose}>CANCEL</Button><Button disabled={busy}>{busy ? 'CREATING...' : 'CREATE SKILL'}</Button></div></form></Modal>
}


function ProfileModal({ initialValue, email, onClose, onSave }) {
  const [displayName, setDisplayName] = useState(initialValue)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async event => {
    event.preventDefault()
    if (!displayName.trim()) { setError('Enter a display name.'); return }
    setBusy(true); setError('')
    try { await onSave(displayName) }
    catch (err) { setError(err.message || 'Could not update your profile.') }
    finally { setBusy(false) }
  }
  return <Modal title="Profile" eyebrow="YOUR VIBEVAULT IDENTITY" onClose={onClose}>
    <form className="modal-form" onSubmit={submit}>
      <label className="field-label">DISPLAY NAME<input className="field-input" value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={80} required placeholder="How should VibeVault address you?"/></label>
      <label className="field-label">SIGN-IN EMAIL<input className="field-input" value={email} readOnly/></label>
      {error && <div className="notice notice-error"><CircleHelp size={15}/><span>{error}</span></div>}
      <div className="modal-actions"><Button variant="ghost" type="button" onClick={onClose}>CANCEL</Button><Button disabled={busy}>{busy ? 'SAVING…' : 'SAVE PROFILE'}</Button></div>
    </form>
  </Modal>
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
