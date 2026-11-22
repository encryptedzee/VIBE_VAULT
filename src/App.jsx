import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Archive, Check, CheckCircle2, ChevronDown,
  ChevronRight, CircleHelp, Clipboard, Cloud, Code2, Command, Download, FileCode2,
  FileJson, FileText, FolderKanban, Inbox, KeyRound, Layers3, LogOut, Menu, Plus, Plug,
  Search, Settings2, ShieldCheck, Sparkles, Upload, X, Activity, Bot, BookOpen, Braces,
  CircleDot, Clock3, Code, File, GitBranch, History, LayoutDashboard, MessageSquareText,
  PanelsTopLeft, Terminal, Workflow, Zap, Github, Moon, Sun
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
function Dashboard({ session, onSignOut }) {
  const user = session.user
  const fallbackName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'there'
  const [displayName, setDisplayName] = useState(fallbackName)
  const [activePage, setActivePage] = useState('overview')
  const [modelSearch, setModelSearch] = useState('')
  const [activeModelIndex, setActiveModelIndex] = useState(0)
  const [modelIntent, setModelIntent] = useState('create')
  const [chosenModel, setChosenModel] = useState(null)
  const touchStartX = useRef(null)

  const aiModels = [
    { name: 'Claude', short: 'C', descriptor: 'Anthropic', accent: '#e8a16d', second: '#9b553a', glow: 'rgba(232,161,109,.30)', note: 'Thoughtful reasoning and long-form work' },
    { name: 'ChatGPT', short: 'G', descriptor: 'OpenAI', accent: '#56d6a2', second: '#167e72', glow: 'rgba(86,214,162,.30)', note: 'A versatile AI workspace' },
    { name: 'Gemini', short: 'G', descriptor: 'Google', accent: '#78a9ff', second: '#8668ee', glow: 'rgba(120,169,255,.34)', note: 'Multimodal research and creation' },
    { name: 'Cursor', short: 'Cu', descriptor: 'Cursor', accent: '#c4d0e4', second: '#53657f', glow: 'rgba(196,208,228,.24)', note: 'AI-assisted coding environment' },
    { name: 'Windsurf', short: 'W', descriptor: 'Codeium', accent: '#63d6e5', second: '#277eae', glow: 'rgba(99,214,229,.30)', note: 'Agentic development workspace' },
    { name: 'Perplexity', short: 'P', descriptor: 'Perplexity AI', accent: '#70d3d7', second: '#287c9c', glow: 'rgba(112,211,215,.30)', note: 'Search-led research and answers' },
    { name: 'DeepSeek', short: 'D', descriptor: 'DeepSeek', accent: '#83a8ff', second: '#3452c4', glow: 'rgba(131,168,255,.30)', note: 'Technical reasoning and exploration' },
    { name: 'Lovable', short: 'L', descriptor: 'Lovable', accent: '#f08cb7', second: '#9e477c', glow: 'rgba(240,140,183,.30)', note: 'Prompt-to-product building' },
    { name: 'Base44', short: 'B', descriptor: 'Base44', accent: '#b59cff', second: '#6950c4', glow: 'rgba(181,156,255,.30)', note: 'AI-powered app building' },
    { name: 'Trae', short: 'T', descriptor: 'Trae', accent: '#f3ad72', second: '#a85e36', glow: 'rgba(243,173,114,.30)', note: 'AI development environment' },
    { name: 'Qoder', short: 'Q', descriptor: 'Qoder', accent: '#91a8ff', second: '#4a5db5', glow: 'rgba(145,168,255,.30)', note: 'Agentic software development' }
  ]

  useEffect(() => {
    let active = true
    const loadDisplayName = async () => {
      if (!supabase || !user.id) return
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', user.id)
          .maybeSingle()
        if (active && !error && data?.display_name?.trim()) {
          setDisplayName(data.display_name.trim())
        }
      } catch {
        // Keep the name supplied by the authenticated session as a fallback.
      }
    }
    loadDisplayName()
    return () => { active = false }
  }, [user.id])

  useEffect(() => { setActiveModelIndex(0) }, [modelSearch])

  const firstName = (displayName || fallbackName).trim().split(/\s+/)[0] || 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  const filteredModels = aiModels.filter(model => (model.name + ' ' + model.descriptor).toLowerCase().includes(modelSearch.trim().toLowerCase()))
  const activeModel = filteredModels[activeModelIndex] || filteredModels[0] || null
  const modelTheme = model => ({
    '--model-accent': model.accent,
    '--model-second': model.second,
    '--model-glow': model.glow
  })
  const openModelPicker = intent => {
    setModelIntent(intent)
    setModelSearch('')
    setActiveModelIndex(0)
    setActivePage('model-picker')
  }
  const moveModel = direction => {
    if (!filteredModels.length) return
    setActiveModelIndex(index => (index + direction + filteredModels.length) % filteredModels.length)
  }
  const chooseModel = () => {
    if (!activeModel) return
    setChosenModel(activeModel)
    setActivePage('model-selected')
  }
  const goToPage = page => {
    setActivePage(page)
    if (page !== 'model-picker') setModelSearch('')
  }
  const navItems = [
    { id: 'overview', label: 'Overview', hint: 'Your workspace', icon: LayoutDashboard, mark: '01' },
    { id: 'vaults', label: 'My Vaults', hint: 'Your saved spaces', icon: Archive, mark: '02' },
    { id: 'handoff', label: 'Handoff Vault', hint: 'Choose your next AI', icon: Workflow, mark: '03' }
  ]

  return (
    <main className={"vv-workspace-shell" + (activePage === 'model-selected' && chosenModel ? ' vv-model-active' : '')} style={activePage === 'model-selected' && chosenModel ? modelTheme(chosenModel) : undefined}>
      <aside className="vv-sidebar" aria-label="VibeVault navigation">
        <div className="vv-sidebar-brand">
          <Brand />
          <span className="vv-sidebar-brand-caption">YOUR AI MEMORY SPACE</span>
        </div>

        <div className="vv-sidebar-section-label">WORKSPACE</div>
        <nav className="vv-sidebar-nav">
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = activePage === item.id ||
              (item.id === 'handoff' && ['model-picker', 'model-selected'].includes(activePage))
            return (
              <button
                type="button"
                key={item.id}
                className={'vv-nav-item' + (isActive ? ' active' : '')}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => item.id === 'handoff' ? openModelPicker('handoff') : goToPage(item.id)}
              >
                <span className={'vv-nav-icon vv-nav-icon-' + item.id}><Icon size={17}/></span>
                <span className="vv-nav-copy"><strong>{item.label}</strong><small>{item.hint}</small></span>
                <span className="vv-nav-mark">{item.mark}</span>
              </button>
            )
          })}
        </nav>

        <div className="vv-sidebar-illustration" aria-hidden="true">
          <span className="vv-side-orbit vv-side-orbit-one"/>
          <span className="vv-side-orbit vv-side-orbit-two"/>
          <span className="vv-side-card vv-side-card-back"/>
          <span className="vv-side-card vv-side-card-front"><i/><i/><i/></span>
          <span className="vv-side-glow"/>
        </div>
        <div className="vv-sidebar-account">
          <span className="vv-sidebar-avatar">{firstName.slice(0, 1).toUpperCase()}</span>
          <span className="vv-sidebar-account-copy">
            <strong>{displayName || fallbackName}</strong>
            <small>{user.email || 'VibeVault account'}</small>
          </span>
          <button className="vv-signout-button" type="button" onClick={onSignOut} title="Sign out" aria-label="Sign out"><LogOut size={15}/></button>
        </div>
      </aside>

      <section className="vv-dashboard-canvas" aria-label="Workspace">
        {activePage === 'overview' && (
          <div className="vv-overview-page">
            <div className="vv-welcome-block">
              <span className="vv-welcome-label">YOUR PERSONAL AI SPACE</span>
              <h1>Good {greeting}, {firstName}</h1>
              <p>Your context has a home. Choose where you want to begin.</p>
            </div>

            <div className="vv-action-grid">
              <article className="vv-action-card vv-create-card">
                <div className="vv-action-card-top"><span>01 / CREATE</span><span className="vv-action-pill">START HERE</span></div>
                <div className="vv-card-illustration vv-create-illustration" aria-hidden="true">
                  <span className="vv-create-orbit"/>
                  <span className="vv-create-sheet vv-sheet-one"/>
                  <span className="vv-create-sheet vv-sheet-two"/>
                  <span className="vv-create-sheet vv-sheet-three"/>
                  <span className="vv-create-plus">+</span>
                </div>
                <div className="vv-action-card-copy">
                  <h2>Create a Vault</h2>
                  <p>Choose the AI you are working with before you start saving its conversations.</p>
                  <button type="button" className="vv-card-button vv-card-button-primary" onClick={() => openModelPicker('create')}>Create a Vault <ArrowUpRight size={16}/></button>
                </div>
              </article>

              <article className="vv-action-card vv-handoff-card">
                <div className="vv-action-card-top"><span>02 / CONTINUE</span><span className="vv-action-pill vv-action-pill-cyan">AI TRANSFER</span></div>
                <div className="vv-card-illustration vv-handoff-illustration" aria-hidden="true">
                  <span className="vv-handoff-orbit"/>
                  <span className="vv-handoff-node vv-node-one"/>
                  <span className="vv-handoff-node vv-node-two"/>
                  <span className="vv-handoff-node vv-node-three"/>
                  <span className="vv-handoff-path"/>
                </div>
                <div className="vv-action-card-copy">
                  <h2>Handoff Vault</h2>
                  <p>Choose the AI you are moving your work to. Its identity will shape your handoff space.</p>
                  <button type="button" className="vv-card-button vv-card-button-secondary" onClick={() => openModelPicker('handoff')}>Choose an AI <ArrowUpRight size={16}/></button>
                </div>
              </article>
            </div>
          </div>
        )}

        {activePage === 'vaults' && (
          <div className="vv-empty-page">
            <div className="vv-empty-illustration vv-empty-vault-art" aria-hidden="true"><span/><span/><span/><i>+</i></div>
            <span className="vv-welcome-label">YOUR COLLECTION</span>
            <h1>My Vaults</h1>
            <p>Your saved AI conversations and context spaces will appear here.</p>
            <button type="button" className="vv-card-button vv-card-button-primary" onClick={() => openModelPicker('create')}>Create a Vault <ArrowUpRight size={16}/></button>
          </div>
        )}

        {activePage === 'model-picker' && (
          <div className="vv-ai-picker" style={activeModel ? modelTheme(activeModel) : undefined}>
            <div className="vv-picker-heading">
              <button type="button" className="vv-back-link" onClick={() => goToPage('overview')}><ArrowLeft size={15}/> BACK TO WORKSPACE</button>
              <span className="vv-welcome-label">{modelIntent === 'handoff' ? 'HANDOFF VAULT / STEP 01' : 'NEW VAULT / STEP 01'}</span>
              <h1>Which AI are you using?</h1>
              <p>Search for your AI model or swipe through the cards. Select the one you are working with right now.</p>
              <label className="vv-model-search">
                <Search size={17}/>
                <input value={modelSearch} onChange={event => setModelSearch(event.target.value)} placeholder="Search AI models..." aria-label="Search AI models"/>
                {modelSearch && <button type="button" onClick={() => setModelSearch('')} aria-label="Clear search"><X size={15}/></button>}
              </label>
            </div>

            {activeModel ? (
              <>
                <div className="vv-ai-stage" style={modelTheme(activeModel)}>
                  <div className="vv-ai-stage-art" aria-hidden="true"><span/><span/><span/><i/></div>
                  <div className="vv-ai-stage-copy">
                    <span className="vv-ai-stage-overline">{activeModel.descriptor.toUpperCase()} / AI MODEL</span>
                    <div className="vv-ai-monogram">{activeModel.short}</div>
                    <h2>{activeModel.name}</h2>
                    <p>{activeModel.note}</p>
                  </div>
                  <div className="vv-ai-stage-index">{String(activeModelIndex + 1).padStart(2, '0')} <i/> {String(filteredModels.length).padStart(2, '0')}</div>
                </div>

                <div className="vv-model-carousel-header">
                  <span>SELECT YOUR MODEL</span>
                  <div className="vv-carousel-controls">
                    <button type="button" onClick={() => moveModel(-1)} disabled={filteredModels.length < 2} aria-label="Previous AI model"><ArrowLeft size={16}/></button>
                    <button type="button" onClick={() => moveModel(1)} disabled={filteredModels.length < 2} aria-label="Next AI model"><ArrowRight size={16}/></button>
                  </div>
                </div>
                <div
                  className="vv-model-carousel"
                  onTouchStart={event => { touchStartX.current = event.touches[0]?.clientX ?? null }}
                  onTouchEnd={event => {
                    if (touchStartX.current !== null) {
                      const delta = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
                      if (Math.abs(delta) > 40) moveModel(delta < 0 ? 1 : -1)
                    }
                    touchStartX.current = null
                  }}
                  onKeyDown={event => {
                    if (event.key === 'ArrowRight') { event.preventDefault(); moveModel(1) }
                    if (event.key === 'ArrowLeft') { event.preventDefault(); moveModel(-1) }
                  }}
                  tabIndex={0}
                  aria-label="Swipe or use arrow keys to choose an AI model"
                >
                  {filteredModels.map((model, index) => (
                    <button
                      type="button"
                      key={model.name}
                      className={'vv-model-card' + (index === activeModelIndex ? ' active' : '')}
                      style={modelTheme(model)}
                      onClick={() => setActiveModelIndex(index)}
                      aria-pressed={index === activeModelIndex}
                    >
                      <span className="vv-model-card-symbol">{model.short}</span>
                      <span className="vv-model-card-copy"><strong>{model.name}</strong><small>{model.descriptor}</small></span>
                      <span className="vv-model-card-dot"/>
                    </button>
                  ))}
                </div>
                <div className="vv-picker-footer">
                  <span>Swipe the cards to preview each AI's workspace theme.</span>
                  <button type="button" className="vv-card-button vv-card-button-primary" onClick={chooseModel}>Use {activeModel.name} <ArrowUpRight size={16}/></button>
                </div>
              </>
            ) : (
              <div className="vv-no-models"><strong>No AI model found</strong><span>Try a different name.</span></div>
            )}
          </div>
        )}

        {activePage === 'model-selected' && chosenModel && (
          <div className="vv-ai-selected" style={modelTheme(chosenModel)}>
            <div className="vv-selected-art" aria-hidden="true"><span/><span/><span/><i/></div>
            <div className="vv-selected-copy">
              <span className="vv-selected-eyebrow">{modelIntent === 'handoff' ? 'HANDOFF VAULT / AI SELECTED' : 'NEW VAULT / AI SELECTED'}</span>
              <div className="vv-selected-monogram">{chosenModel.short}</div>
              <h1>{chosenModel.name}</h1>
              <p>{modelIntent === 'handoff' ? 'This AI is selected for your handoff workspace.' : 'This is the AI model selected for your new vault.'}</p>
              <div className="vv-selected-actions">
                <button type="button" className="vv-card-button vv-card-button-primary" onClick={() => setActivePage('model-picker')}>Change AI model <ArrowUpRight size={16}/></button>
                <button type="button" className="vv-selected-back" onClick={() => goToPage('overview')}>Back to workspace</button>
              </div>
            </div>
            <span className="vv-selected-wordmark">{chosenModel.name}</span>
          </div>
        )}
      </section>
    </main>
  )
}


export default App
