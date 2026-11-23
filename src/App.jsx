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
import { VaultBrowser } from './components/VaultBrowser'
import { VaultWorkspace } from './components/VaultWorkspace'

const PRO_CHECKOUT_URL = import.meta.env.VITE_PRO_CHECKOUT_URL || ''
const LIFETIME_CHECKOUT_URL = import.meta.env.VITE_LIFETIME_CHECKOUT_URL || ''
const LIPA_NAMBA = import.meta.env.VITE_LIPA_NAMBA || ''
const LIPA_NAME = import.meta.env.VITE_LIPA_NAME || ''

// Make it obvious when the isolated Cloudflare feature preview is open.
const IS_FEATURE_PREVIEW_HOST = typeof window !== 'undefined' && /^(?:feature-professional-workspace-redesign|feature-vault-browser-github-connect|[a-f0-9]{8})-vibevault\.vibevault-hq\.workers\.dev$/i.test(window.location.hostname)

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
  const [vaults, setVaults] = useState([])
  const [vaultsLoading, setVaultsLoading] = useState(true)
  const [vaultSearch, setVaultSearch] = useState('')
  const [vaultTitle, setVaultTitle] = useState('')
  const [vaultDescription, setVaultDescription] = useState('')
  const [savingVault, setSavingVault] = useState(false)
  const [selectedVault, setSelectedVault] = useState(null)
  const [handoffVault, setHandoffVault] = useState(null)
  const [handoffConversations, setHandoffConversations] = useState([])
  const [handoffLoading, setHandoffLoading] = useState(false)
  const [handoffError, setHandoffError] = useState('')
  const [handoffCopied, setHandoffCopied] = useState(false)
  const [vaultConversations, setVaultConversations] = useState([])
  const [vaultConversationsLoading, setVaultConversationsLoading] = useState(false)
  const [vaultError, setVaultError] = useState('')
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

  useEffect(() => {
    let active = true
    const loadVaults = async () => {
      if (!supabase) {
        if (active) {
          setVaults([])
          setVaultError('Connect Supabase to load your saved vaults.')
          setVaultsLoading(false)
        }
        return
      }
      setVaultsLoading(true)
      const { data, error } = await supabase
        .from('projects')
        .select('id,title,description,tags,created_at,updated_at,github_repository_id,github_full_name,github_html_url,github_default_branch,github_private,github_description,github_language,github_linked_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
      if (!active) return
      if (error) {
        setVaultError(error.message)
        setVaults([])
      } else {
        setVaultError('')
        setVaults(data || [])
      }
      setVaultsLoading(false)
    }
    loadVaults()
    return () => { active = false }
  }, [user.id])

  useEffect(() => { setActiveModelIndex(0) }, [modelSearch])

  const firstName = (displayName || fallbackName).trim().split(/\s+/)[0] || 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  const filteredModels = aiModels.filter(model => (model.name + ' ' + model.descriptor).toLowerCase().includes(modelSearch.trim().toLowerCase()))
  const activeModel = filteredModels[activeModelIndex] || filteredModels[0] || null
  const filteredVaults = vaults.filter(vault =>
    (vault.title + ' ' + (vault.description || '')).toLowerCase().includes(vaultSearch.trim().toLowerCase())
  )
  const selectedVaultAI = selectedVault?.tags?.find(tag => tag.startsWith('ai:'))?.slice(3) || chosenModel?.name || 'AI not selected'
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
  const chooseModel = async () => {
    if (!activeModel) return
    setChosenModel(activeModel)
    if (modelIntent === 'handoff') {
      setHandoffError('')
      setHandoffCopied(false)
      if (handoffConversations.length) {
        setActivePage('handoff-review')
      } else if (handoffVault) {
        await selectHandoffVault(handoffVault)
      } else {
        setActivePage('handoff-source')
      }
      return
    }
    setActivePage('model-selected')
  }
  const selectHandoffVault = async vault => {
    if (!supabase || handoffLoading) return
    setHandoffVault(vault)
    setHandoffLoading(true)
    setHandoffError('')
    setHandoffCopied(false)
    const { data, error } = await supabase
      .from('conversations')
      .select('id,title,source_ai,created_at,cleaned_spec,raw_content,image_urls,capture_metadata,tags')
      .eq('project_id', vault.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (error) {
      setHandoffError(error.message)
      setHandoffConversations([])
    } else {
      setHandoffConversations(data || [])
      setActivePage('handoff-review')
    }
    setHandoffLoading(false)
  }
  const copyHandoffPackage = async () => {
    if (!handoffVault || !chosenModel) return
    const threads = handoffConversations.map((conversation, index) => [
      '### Thread ' + (index + 1) + ': ' + conversation.title,
      'Conversation ID: ' + conversation.id,
      'Original AI: ' + (conversation.source_ai || 'Not specified'),
      conversation.cleaned_spec ? String(conversation.cleaned_spec) : (conversation.raw_content || 'No conversation content was saved.'),
      (conversation.image_urls || []).length ? 'Attachment object paths: ' + conversation.image_urls.join(', ') : 'Attachments: none'
    ].join('\n')).join('\n\n')
    const handoffText = [
      '# VibeVault handoff',
      'Project: ' + handoffVault.title,
      'Description: ' + (handoffVault.description || 'No project description provided.'),
      'GitHub repository: ' + (handoffVault.github_full_name || 'Not linked'),
      'Repository URL: ' + (handoffVault.github_html_url || 'Not linked'),
      'Default branch: ' + (handoffVault.github_default_branch || 'Not specified'),
      'Destination AI: ' + chosenModel.name,
      '',
      'You are continuing an existing project. Preserve the decisions and constraints below. First summarize your understanding, identify missing context, and ask before changing established decisions.',
      'When you finish work on a conversation, if VibeVault MCP is connected, call append_conversation_response using the exact conversation_id shown in that thread to save your final response. Never guess another destination.',
      '',
      '## Saved conversation context',
      threads || 'No saved conversations were found in this vault.'
    ].join('\n')
    try {
      await navigator.clipboard.writeText(handoffText)
      setHandoffCopied(true)
    } catch {
      setHandoffError('Clipboard access was blocked. Open this preview in a secure browser context and try again.')
    }
  }
  const goToPage = page => {
    setActivePage(page)
    if (page !== 'model-picker') setModelSearch('')
    if (page === 'vaults') setVaultError('')
  }
  const beginVaultCreation = () => {
    setVaultTitle('')
    setVaultDescription('')
    setVaultError('')
    setChosenModel(null)
    setActivePage('vault-create')
  }
  const createVault = async event => {
    event.preventDefault()
    const title = vaultTitle.trim()
    if (!title || savingVault) return
    if (!supabase) {
      setVaultError('Supabase is not connected. Configure the project URL and anon key first.')
      return
    }
    setSavingVault(true)
    setVaultError('')
    const tags = chosenModel ? [`ai:${chosenModel.name}`] : []
    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        title,
        description: vaultDescription.trim(),
        tags
      })
      .select('id,title,description,tags,created_at,updated_at,github_repository_id,github_full_name,github_html_url,github_default_branch,github_private,github_description,github_language,github_linked_at')
      .single()
    setSavingVault(false)
    if (error) {
      setVaultError(error.message)
      return
    }
    setVaults(current => [data, ...current])
    setSelectedVault(data)
    setVaultConversations([])
    setActivePage('vault-detail')
  }
  const openVault = async vault => {
    setSelectedVault(vault)
    const savedAI = vault.tags?.find(tag => tag.startsWith('ai:'))?.slice(3)
    setChosenModel(aiModels.find(model => model.name === savedAI) || null)
    setModelIntent('create')
    setActivePage('vault-detail')
    setVaultConversationsLoading(true)
    setVaultError('')
    if (!supabase) {
      setVaultError('Supabase is not connected.')
      setVaultConversationsLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('conversations')
      .select('id,title,source_ai,created_at,tags,cleaned_spec,raw_content,image_urls,capture_metadata')
      .eq('project_id', vault.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) setVaultError(error.message)
    else setVaultConversations(data || [])
    setVaultConversationsLoading(false)
  }
  const beginVaultHandoff = vault => {
    setHandoffVault(vault)
    setHandoffConversations([])
    setHandoffError('')
    setHandoffCopied(false)
    setModelIntent('handoff')
    setModelSearch('')
    setActiveModelIndex(0)
    setActivePage('model-picker')
  }
  const beginConversationHandoff = conversation => {
    if (!selectedVault) return
    setHandoffVault(selectedVault)
    setHandoffConversations([conversation])
    setHandoffError('')
    setHandoffCopied(false)
    setModelIntent('handoff')
    setModelSearch('')
    setActiveModelIndex(0)
    setActivePage('model-picker')
  }
  const updateVaultRecord = updated => {
    setSelectedVault(updated)
    setVaults(current => current.map(vault => vault.id === updated.id ? updated : vault))
  }
  const updateConversationRecord = updated => {
    setVaultConversations(current => [updated, ...current.filter(item => item.id !== updated.id)])
  }
  const refreshVaultList = async () => {
    if (!supabase) return
    setVaultsLoading(true)
    const { data, error } = await supabase.from('projects')
      .select('id,title,description,tags,created_at,updated_at,github_repository_id,github_full_name,github_html_url,github_default_branch,github_private,github_description,github_language,github_linked_at')
      .eq('user_id', user.id).order('updated_at', { ascending: false })
    if (error) setVaultError(error.message)
    else { setVaultError(''); setVaults(data || []) }
    setVaultsLoading(false)
  }
  const refreshVaultConversations = async () => {
    if (!supabase || !selectedVault) return
    setVaultConversationsLoading(true)
    const { data, error } = await supabase.from('conversations')
      .select('id,title,source_ai,created_at,tags,cleaned_spec,raw_content,image_urls,capture_metadata')
      .eq('project_id', selectedVault.id).eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) setVaultError(error.message)
    else { setVaultError(''); setVaultConversations(data || []) }
    setVaultConversationsLoading(false)
  }

  const navItems = [
    { id: 'overview', label: 'Vault Browser', hint: 'Recent and saved projects', icon: LayoutDashboard, mark: '01' },
    { id: 'vaults', label: 'All Vaults', hint: 'Your project library', icon: Archive, mark: '02' },
    { id: 'handoff', label: 'Agent Handoffs', hint: 'Choose your next AI', icon: Workflow, mark: '03' }
  ]

  return (
    <main
      className={"vv-workspace-shell " + (['overview', 'vaults'].includes(activePage) ? 'vv-vault-browser-shell' : 'vv-inside-vault-shell') + (chosenModel && ['model-selected', 'vault-create'].includes(activePage) ? ' vv-model-active' : '')}
      style={chosenModel && ['model-selected', 'vault-create'].includes(activePage) ? modelTheme(chosenModel) : undefined}
      onPointerMove={event => {
        if (event.pointerType === 'touch') return
        const root = event.currentTarget
        const bounds = root.getBoundingClientRect()
        root.style.setProperty('--vv-pointer-x', `${event.clientX - bounds.left}px`)
        root.style.setProperty('--vv-pointer-y', `${event.clientY - bounds.top}px`)
      }}
      onPointerLeave={event => {
        const root = event.currentTarget
        root.style.setProperty('--vv-pointer-x', `${root.clientWidth / 2}px`)
        root.style.setProperty('--vv-pointer-y', `${root.clientHeight / 2}px`)
      }}
    >
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
              (item.id === 'overview' && activePage === 'vault-detail') ||
              (item.id === 'vaults' && activePage === 'vault-create') ||
              (item.id === 'handoff' && modelIntent === 'handoff' && ['model-picker', 'model-selected', 'handoff-source', 'handoff-review'].includes(activePage))
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
        {['overview', 'vaults'].includes(activePage) && (
          <VaultBrowser
            vaults={vaults}
            loading={vaultsLoading}
            error={vaultError}
            firstName={firstName}
            greeting={greeting}
            showRecent={activePage === 'overview'}
            onOpenVault={openVault}
            onHandoff={beginVaultHandoff}
            onNewVault={beginVaultCreation}
            onRefresh={() => void refreshVaultList()}
          />
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

        {activePage === 'handoff-source' && chosenModel && (
          <div className="vv-handoff-page">
            <button type="button" className="vv-back-link" onClick={() => goToPage('overview')}><ArrowLeft size={15}/> BACK TO WORKSPACE</button>
            <div className="vv-page-heading">
              <div><span className="vv-welcome-label">HANDOFF VAULT / STEP 02</span><h1>Choose a project</h1><p>Select the saved vault whose context you want to continue with {chosenModel.name}.</p></div>
              <span className="vv-handoff-target"><span>{chosenModel.short}</span> DESTINATION · {chosenModel.name}</span>
            </div>
            {handoffError && <div className="vv-inline-error" role="alert">{handoffError}</div>}
            {vaultsLoading || handoffLoading ? (
              <div className="vv-vaults-loading"><span className="vv-loading-orbit"/><span>{handoffLoading ? 'Loading project conversations...' : 'Loading your vaults...'}</span></div>
            ) : vaults.length ? (
              <div className="vv-handoff-vault-list">
                {vaults.map(vault => {
                  const aiName = vault.tags?.find(tag => tag.startsWith('ai:'))?.slice(3) || 'AI not selected'
                  return <button type="button" className="vv-handoff-vault-option" key={vault.id} onClick={() => selectHandoffVault(vault)}>
                    <span className="vv-handoff-vault-icon"><FolderKanban size={19}/></span>
                    <span className="vv-handoff-vault-copy"><strong>{vault.title}</strong><small>{vault.description || 'Saved project context'} · Original AI: {aiName}</small></span>
                    <ArrowUpRight size={17}/>
                  </button>
                })}
              </div>
            ) : (
              <div className="vv-vaults-empty"><div className="vv-vault-empty-art" aria-hidden="true"><span/><span/><span/><i/></div><span className="vv-welcome-label">NO PROJECTS YET</span><h2>Create a vault before handing off.</h2><p>Your saved project becomes the source context for the next AI.</p><button type="button" className="vv-card-button vv-card-button-primary" onClick={beginVaultCreation}>Create a vault <ArrowUpRight size={16}/></button></div>
            )}
          </div>
        )}

        {activePage === 'handoff-review' && handoffVault && chosenModel && (
          <div className="vv-handoff-page">
            <button type="button" className="vv-back-link" onClick={() => setActivePage('handoff-source')}><ArrowLeft size={15}/> BACK TO PROJECTS</button>
            <div className="vv-page-heading">
              <div><span className="vv-welcome-label">HANDOFF VAULT / STEP 03</span><h1>Review your handoff</h1><p>VibeVault has gathered the saved project notes for your next AI.</p></div>
              <span className="vv-handoff-target"><span>{chosenModel.short}</span> DESTINATION · {chosenModel.name}</span>
            </div>
            <div className="vv-handoff-review-grid">
              <section className="vv-handoff-review-card"><span className="vv-welcome-label">SOURCE PROJECT</span><h2>{handoffVault.title}</h2><p>{handoffVault.description || 'No project description provided.'}</p><div className="vv-handoff-review-meta"><span><Archive size={14}/> {handoffConversations.length} saved conversations</span><span><Bot size={14}/> {handoffVault.tags?.find(tag => tag.startsWith('ai:'))?.slice(3) || 'Multiple / unspecified AI'}</span></div></section>
              <section className="vv-handoff-review-card vv-handoff-destination-card"><span className="vv-welcome-label">NEXT AI</span><div className="vv-handoff-destination-mark">{chosenModel.short}</div><h2>{chosenModel.name}</h2><p>{chosenModel.note}</p></section>
            </div>
            <div className="vv-handoff-thread-list"><div className="vv-handoff-thread-heading"><strong>CONTEXT INCLUDED</strong><span>{handoffConversations.length} THREADS</span></div>
              {handoffConversations.length ? handoffConversations.map((conversation, index) => <div className="vv-handoff-thread" key={conversation.id}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{conversation.title}</strong><small>{conversation.source_ai || 'AI not specified'} · {new Date(conversation.created_at).toLocaleDateString()}</small></div><CheckCircle2 size={16}/></div>) : <p className="vv-handoff-no-threads">This vault has no saved conversations yet. The handoff will include its project name and description only.</p>}
            </div>
            {handoffError && <div className="vv-inline-error" role="alert">{handoffError}</div>}
            <div className="vv-handoff-actions"><p>Copy a structured context package, then paste it into {chosenModel.name}. This fallback works without an MCP connection; it does not automatically open or inject content into the destination AI.</p><button type="button" className="vv-card-button vv-card-button-primary" onClick={copyHandoffPackage}><Clipboard size={16}/>{handoffCopied ? 'Copied — ready to paste' : 'Copy handoff package'} <ArrowUpRight size={16}/></button></div>
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
                {modelIntent === 'create' && <button type="button" className="vv-card-button vv-card-button-primary" onClick={beginVaultCreation}>Create this vault <ArrowUpRight size={16}/></button>}
                <button type="button" className={modelIntent === 'create' ? 'vv-card-button vv-card-button-secondary' : 'vv-card-button vv-card-button-primary'} onClick={() => setActivePage('model-picker')}>Change AI model <ArrowUpRight size={16}/></button>
                <button type="button" className="vv-selected-back" onClick={() => goToPage('overview')}>Back to workspace</button>
              </div>
            </div>
            <span className="vv-selected-wordmark">{chosenModel.name}</span>
          </div>
        )}

        {activePage === 'vault-create' && chosenModel && (
          <div className="vv-create-vault-page" style={modelTheme(chosenModel)}>
            <button type="button" className="vv-back-link" onClick={() => setActivePage('model-selected')}><ArrowLeft size={15}/> BACK TO {chosenModel.name}</button>
            <div className="vv-create-vault-layout">
              <div className="vv-create-vault-intro">
                <span className="vv-selected-eyebrow">NEW PROJECT / PERSONAL MEMORY</span>
                <div className="vv-selected-monogram">{chosenModel.short}</div>
                <h1>Create your<br/>vault.</h1>
                <p>Your conversations with {chosenModel.name} will have a dedicated home. Start with a name that describes the project or idea.</p>
                <div className="vv-create-model-chip"><span>{chosenModel.short}</span><div><strong>{chosenModel.name}</strong><small>Selected AI workspace</small></div></div>
              </div>
              <form className="vv-create-vault-form" onSubmit={createVault}>
                <span className="vv-welcome-label">VAULT DETAILS</span>
                <label className="vv-form-field"><span>Vault name</span><input autoFocus maxLength={120} required value={vaultTitle} onChange={event => setVaultTitle(event.target.value)} placeholder="e.g. VibeVault, SurePesa, ROOM..."/></label>
                <label className="vv-form-field"><span>What are you working on? <small>OPTIONAL</small></span><textarea maxLength={1000} rows={4} value={vaultDescription} onChange={event => setVaultDescription(event.target.value)} placeholder="A short description to help you recognize this project later."/></label>
                <div className="vv-create-vault-meta"><span><i/> PRIVATE TO YOUR ACCOUNT</span><span>AI · {chosenModel?.name || 'Choose later'}</span></div>
                {vaultError && <div className="vv-inline-error" role="alert">{vaultError}</div>}
                <button type="submit" className="vv-card-button vv-card-button-primary vv-create-submit" disabled={savingVault || !vaultTitle.trim()}>{savingVault ? 'Creating vault...' : 'Create vault'} <ArrowUpRight size={16}/></button>
                <button type="button" className="vv-selected-back vv-create-cancel" onClick={() => goToPage('overview')}>Cancel</button>
              </form>
            </div>
          </div>
        )}

        {activePage === 'vault-detail' && selectedVault && (
          <VaultWorkspace
            project={selectedVault}
            conversations={vaultConversations}
            loading={vaultConversationsLoading}
            error={vaultError}
            onBack={() => goToPage('overview')}
            onHandoff={beginConversationHandoff}
            onConversationsChanged={updateConversationRecord}
            onProjectUpdated={updateVaultRecord}
            onReload={refreshVaultConversations}
          />
        )}
      </section>
    </main>
  )
}


export default App
