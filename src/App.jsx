import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Archive, Check, CheckCircle2, ChevronDown,
  ChevronRight, CircleHelp, Clipboard, Cloud, Code2, Command, Download, FileCode2,
  FileJson, FileText, FolderKanban, Inbox, KeyRound, Layers3, LogOut, Menu, Plus, Plug,
  Search, Settings2, ShieldCheck, Sparkles, Upload, X, Activity, Bot, BookOpen, Braces,
  CircleDot, Clock3, Code, File, GitBranch, History, LayoutDashboard, MessageSquareText,
  PanelsTopLeft, Terminal, Workflow, Zap
} from 'lucide-react'
import { hasSupabaseConfig, supabase } from './lib/supabase'

const PRO_CHECKOUT_URL = import.meta.env.VITE_PRO_CHECKOUT_URL || ''
const LIFETIME_CHECKOUT_URL = import.meta.env.VITE_LIFETIME_CHECKOUT_URL || ''
const LIPA_NAMBA = import.meta.env.VITE_LIPA_NAMBA || ''
const LIPA_NAME = import.meta.env.VITE_LIPA_NAME || ''

const SOURCE_AIS = ['ALL', 'CLAUDE', 'CHATGPT', 'GEMINI', 'CURSOR', 'WINDSURF', 'PERPLEXITY', 'DEEPSEEK', 'LOVABLE', 'BASE44', 'TRAE', 'QODER', 'OTHER']
const TARGET_AIS = ['Claude', 'ChatGPT', 'Gemini', 'Cursor', 'Windsurf', 'Perplexity', 'DeepSeek', 'Lovable', 'Base44', 'Trae', 'Qoder', 'Other']
const DEFAULT_SKILLS = [
  { role_name: 'Backend Architect', instructions: 'Design reliable APIs, data models, authorization and backend services. Explain trade-offs before implementation.', is_default: true },
  { role_name: 'UI Designer', instructions: 'Translate product intent into precise, accessible interfaces. Preserve the existing design system and responsive behavior.', is_default: true },
  { role_name: 'Image Prompt Engineer', instructions: 'Turn the supplied visual direction into detailed, production-ready image generation prompts. Preserve all constraints.', is_default: true }
]

const AI_PROVIDERS = [
  { name: 'Claude', logo: 'https://cdn.simpleicons.org/anthropic/D97757', description: 'Development, reasoning and long-form work', role: 'Development partner' },
  { name: 'ChatGPT', logo: 'https://cdn.simpleicons.org/openai/FFFFFF', description: 'Planning, analysis and general assistance', role: 'Research & planning' },
  { name: 'Gemini', logo: 'https://cdn.simpleicons.org/googlegemini/8E75B2', description: 'Research and multimodal workflows', role: 'Research & multimodal' },
  { name: 'Cursor', logo: 'https://cdn.simpleicons.org/cursor/FFFFFF', description: 'Code editing and implementation', role: 'IDE implementation' },
  { name: 'Windsurf', logo: 'https://cdn.simpleicons.org/windsurf/00A3FF', description: 'Agentic coding workflows', role: 'Coding agent' },
  { name: 'Perplexity', logo: 'https://cdn.simpleicons.org/perplexity/20B8CD', description: 'Web research and source discovery', role: 'Web researcher' },
  { name: 'DeepSeek', logo: 'https://cdn.simpleicons.org/deepseek/4D6BFE', description: 'Technical reasoning and problem solving', role: 'Reasoning specialist' },
  { name: 'Lovable', logo: 'https://cdn.simpleicons.org/lovable/FF69B4', description: 'Prompt-to-app product building', role: 'App builder' },
  { name: 'Base44', logo: '', description: 'No-code and AI app building', role: 'App builder' },
  { name: 'Trae', logo: '', description: 'AI-assisted development environment', role: 'Coding assistant' },
  { name: 'Qoder', logo: '', description: 'Agentic software development', role: 'Coding agent' },
  { name: 'Other', logo: '', description: 'A provider not listed here', role: 'General assistant' }
]
const EMPTY_AI_PREFERENCES = { providers: {}, last_target: 'Claude', recommendations: false }

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
        const [profileRes, projectRes, convoRes, skillRes, handoffRes, inboxRes, tokenRes, decisionRes, summaryRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          supabase.from('projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('conversations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('agent_skills').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
          supabase.from('handoffs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
          supabase.from('capture_inbox').select('*').eq('user_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }),
          supabase.from('integration_tokens').select('id,label,scope,created_at,last_used_at,revoked_at').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('project_decisions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(150),
          supabase.from('session_summaries').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100)
        ])
        for (const result of [profileRes, projectRes, convoRes, skillRes, handoffRes, inboxRes, tokenRes, decisionRes, summaryRes]) if (result.error) throw result.error
        if (!mounted) return
        let nextProfile = profileRes.data
        if (!nextProfile) {
          const { data, error } = await supabase.from('profiles').upsert({ id: user.id, email: user.email, display_name: user.user_metadata?.display_name || '' }).select().single()
          if (error) throw error
          nextProfile = data
        }
        setProfile(nextProfile)
        setProviderPreferences(nextProfile.ai_preferences || EMPTY_AI_PREFERENCES)
        setTargetAi(nextProfile.ai_preferences?.last_target || 'Claude')
        if (!nextProfile.onboarding_completed) setModal({ type: 'ai', onboarding: true })
        setIntegrationTokens(tokenRes.data || [])
        setCaptureInbox(inboxRes.data || [])
        setDecisions(decisionRes.data || [])
        setSessionSummaries(summaryRes.data || [])
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

  async function saveImportedConversations(items) {
    if (!activeProject) throw new Error('Create or select a project before importing conversations.')
    if (!isPro && conversations.length + items.length > 3) {
      setModal({ type: 'upgrade', plan: 'pro', message: 'This import exceeds the Starter Vault conversation limit. Upgrade to import the full archive.' })
      return
    }
    const rows = items.map(item => ({
      project_id: activeProject.id, user_id: user.id,
      title: String(item.title || 'Imported conversation').slice(0, 180),
      source_ai: item.source_ai || 'Other', raw_content: item.raw_content || '', cleaned_spec: '',
      tags: item.tags || ['imported'], image_urls: [], source_url: item.source_url || null,
      source_payload: item.source_payload || null,
      capture_metadata: item.capture_metadata || { import_method: 'manual' }
    }))
    const inserted = []
    for (let index = 0; index < rows.length; index += 40) {
      const { data, error } = await supabase.from('conversations').insert(rows.slice(index, index + 40)).select()
      if (error) throw error
      inserted.push(...(data || []))
    }
    setConversations(current => [...inserted, ...current])
    if (inserted[0]) { setActiveConversationId(inserted[0].id); setActivePane('conversation') }
    setModal(null)
    showToast(inserted.length + ' conversation' + (inserted.length === 1 ? '' : 's') + ' imported and preserved.')
  }

  async function importCapture(capture, projectId) {
    if (!projectId) throw new Error('Choose a project for this captured conversation.')
    const project = projects.find(item => item.id === projectId)
    if (!project) throw new Error('The selected project is unavailable.')
    if (!isPro && conversations.length >= 3) {
      setModal({ type: 'upgrade', plan: 'pro', message: 'Starter Vault limit reached (3/3 Convos). Upgrade to import this capture.' })
      return
    }
    const { data, error } = await supabase.from('conversations').insert({
      user_id: user.id, project_id: projectId, title: capture.title || 'Captured conversation',
      source_ai: capture.source_ai || 'Other', raw_content: capture.raw_content,
      tags: ['browser-capture'], source_url: capture.source_url || null,
      capture_metadata: capture.capture_metadata || { import_method: 'browser_extension' }
    }).select().single()
    if (error) throw error
    const { error: updateError } = await supabase.from('capture_inbox').update({
      status: 'imported', project_id: projectId, imported_conversation_id: data.id
    }).eq('id', capture.id).eq('user_id', user.id)
    if (updateError) throw updateError
    setConversations(current => [data, ...current])
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

  async function exportProject() {
    if (!activeProject) { showToast('Select a project before exporting.'); return }
    const [decisionRes, sessionRes] = await Promise.all([
      supabase.from('project_decisions').select('*').eq('project_id', activeProject.id).eq('user_id', user.id).order('created_at', { ascending: true }),
      supabase.from('session_summaries').select('*').eq('project_id', activeProject.id).eq('user_id', user.id).order('created_at', { ascending: true })
    ])
    if (decisionRes.error) throw decisionRes.error
    if (sessionRes.error) throw sessionRes.error
    const bundle = {
      format: 'vibevault-project-export', version: 1, exported_at: new Date().toISOString(),
      project: activeProject, conversations: conversations.filter(item => item.project_id === activeProject.id),
      decisions: decisionRes.data || [], session_summaries: sessionRes.data || [],
      handoffs: handoffs.filter(item => item.project_id === activeProject.id), ai_preferences: providerPreferences
    }
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a')
    anchor.href = url; anchor.download = (activeProject.title || 'vibevault-project').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-vibevault-export.json'
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url)
    showToast('Project export prepared.')
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
    const providerRole = providerPreferences.providers?.[targetOverride]?.role || 'No provider-specific role preference set.'
    const taskSection = taskPrompt.trim() ? '## CURRENT TASK\n' + taskPrompt.trim() + '\n\n' : ''
    const convoContext = selectedConversations.map((conversation, index) => {
      const useClean = isPro && bundleModes[conversation.id] === 'clean' && conversation.cleaned_spec
      const sourceLabel = useClean ? 'CLEANED SPEC' : 'RAW THREAD'
      const body = useClean ? conversation.cleaned_spec : conversation.raw_content
      return `## Conversation ${index + 1}: ${conversation.title}\nSource: ${conversation.source_ai}\nTags: ${(conversation.tags || []).join(', ') || 'None'}\nContext mode: ${sourceLabel}\n\n${body}`
    }).join('\n\n---\n\n')
    return `# AGENT.md — ${activeProject?.title || 'Untitled Project'}\n\n## HANDOFF TARGET\n${targetOverride}\n\n## AI PROVIDER ROLE\n${providerRole}\n\n## ASSIGNED TASK ROLE\n${activeSkill?.role_name || 'General Assistant'}\n\n## ROLE INSTRUCTIONS\n${activeSkill?.instructions || 'Act as a careful, context-aware collaborator. Ask before making assumptions.'}\n\n## GLOBAL WORKING STYLE\n${style}\n\n${taskSection}## PROJECT DESCRIPTION\n${activeProject?.description || 'No project description supplied.'}\n\n## PROJECT RULES\n${projectRules}\n\n## BUNDLED SOURCE MATERIAL\n${convoContext || 'No raw conversations selected. Do not invent missing context.'}\n\n## MANDATORY 3-POINT CONFIRMATION — DO THIS BEFORE WRITING CODE\n1. **Confirm the role:** State that you understand and accept the assigned role: ${activeSkill?.role_name || 'General Assistant'}.\n2. **Prove context transfer:** Summarize the supplied raw conversations and identify the user's actual goals, constraints and decisions without silently rewriting the source material.\n3. **Expose uncertainty:** List assumptions, contradictions and missing information. Ask focused questions where needed. Do not write or modify code until the user approves this confirmation.\n\n---\nEnd of handoff. Preserve the user's original intent and ask before changing established decisions.\n`
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
    await navigator.clipboard?.writeText(content)
    const url = supportedTargets[target]
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
    await saveHandoff(false, target, content)
    showToast(url ? 'Handoff copied. ' + target + ' opened in a new tab.' : 'Handoff copied. Open ' + target + ' and paste the prepared context.')
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
  const projectConversations = activeProject ? conversations.filter(item => item.project_id === activeProject.id) : []
  const activeConversation = projectConversations.find(item => item.id === activeConversationId) || null
  const projectDecisions = activeProject ? decisions.filter(item => item.project_id === activeProject.id) : []
  const projectSummaries = activeProject ? sessionSummaries.filter(item => item.project_id === activeProject.id) : []
  const projectHandoffs = activeProject ? handoffs.filter(item => item.project_id === activeProject.id) : []
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'conversations', label: 'Conversations', icon: MessageSquareText },
    { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
    { id: 'decisions', label: 'Decisions', icon: CircleDot },
    { id: 'handoffs', label: 'Agent runs', icon: Workflow }
  ]
  const setPane = pane => { setActivePane(pane); if (pane !== 'conversation') setActiveConversationId(null) }
  return <main className="ide-shell">
    <header className="ide-topbar">
      <div className="ide-topbar-left">
        <Brand compact/>
        <span className="ide-top-divider"/>
        <div className="ide-workspace-name"><small>WORKSPACE</small><strong>{activeProject?.title || 'No project selected'}</strong></div>
        <span className="ide-top-status"><span className="status-pulse"/> {busy ? 'SYNCING' : 'SAVED'}</span>
      </div>
      <div className="ide-topbar-right">
        <label className="ide-project-picker"><FolderKanban size={14}/><select aria-label="Switch project" value={activeProject?.id || ''} onChange={event => { setActiveProjectId(event.target.value); setActiveConversationId(null); setSelectedIds([]); setActivePane('overview') }}><option value="">Select project</option>{projects.map(project => <option value={project.id} key={project.id}>{project.title}</option>)}</select><ChevronDown size={13}/></label>
        <span className="ide-plan-pill">{currentPlan}</span>
        <button className="ide-top-icon" title="AI workspace settings" onClick={() => setModal({ type: 'ai' })}><Layers3 size={16}/></button>
        <button className="ide-top-icon" title="Connections" onClick={() => { setGeneratedToken(''); setModal({ type: 'integrations' }) }}><Plug size={16}/></button>
        <button className="ide-user-menu" title="Sign out" onClick={onSignOut}>{(profile?.display_name || user.email || 'V').slice(0,1).toUpperCase()}</button>
      </div>
    </header>

    <div className="ide-workbench">
      <nav className="ide-activitybar" aria-label="Workspace tools">
        <button className="active" title="Explorer"><PanelsTopLeft size={19}/></button>
        <button title="Agent runs" onClick={() => setPane('handoffs')}><Workflow size={19}/></button>
        <button title="Conversation vault" onClick={() => setPane('conversations')}><Archive size={19}/></button>
        <button title="Knowledge base" onClick={() => setPane('knowledge')}><BookOpen size={19}/></button>
        <span className="ide-activity-spacer"/>
        <button title="AI connections" onClick={() => setModal({ type: 'integrations' })}><Plug size={18}/></button>
        <button title="Preferences" onClick={() => setModal({ type: 'style' })}><Settings2 size={18}/></button>
      </nav>

      <aside className="ide-explorer">
        <div className="ide-explorer-title"><span>EXPLORER</span><button title="Create project" onClick={requestCreateProject}><Plus size={15}/></button></div>
        <div className="ide-explorer-project-label"><span><ChevronDown size={13}/> PROJECTS</span><button title="New project" onClick={requestCreateProject}><Plus size={14}/></button></div>
        <div className="ide-project-tree">
          {filteredProjects.map(project => <button key={project.id} className={'ide-project-node ' + (activeProject?.id === project.id ? 'selected' : '')} onClick={() => { setActiveProjectId(project.id); setActiveConversationId(null); setSelectedIds([]); setActivePane('overview') }}><FolderKanban size={15}/><span>{project.title}</span><small>{conversations.filter(item => item.project_id === project.id).length}</small></button>)}
          {!projects.length && <div className="ide-sidebar-empty">Your projects will appear here.</div>}
        </div>
        <div className="ide-explorer-section-head"><span><ChevronDown size={13}/> WORKSPACE</span></div>
        <div className="ide-sidebar-nav">
          {navItems.map(item => <button key={item.id} className={'ide-nav-item ' + (activePane === item.id ? 'active' : '')} onClick={() => setPane(item.id)}><item.icon size={15}/><span>{item.label}</span><small>{item.id === 'conversations' ? projectConversations.length : item.id === 'decisions' ? projectDecisions.length : item.id === 'handoffs' ? projectHandoffs.length : ''}</small></button>)}
        </div>
        <div className="ide-explorer-section-head conversation-tree-head"><span><ChevronDown size={13}/> CONVERSATION FILES</span><button title="Import conversation" onClick={requestSaveConversation}><Plus size={14}/></button></div>
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
          <button className="ide-tab-action" title="Export project" disabled={!activeProject} onClick={() => exportProject().catch(error => showToast(error.message))}><Download size={14}/></button>
        </div>
        <div className="ide-breadcrumb"><span>VIBEVAULT</span><ChevronRight size={12}/><span>{activeProject?.title || 'WORKSPACE'}</span><ChevronRight size={12}/><strong>{activePane === 'conversation' ? activeConversation?.title || 'Conversation' : navItems.find(item => item.id === activePane)?.label || 'Overview'}</strong><span className="ide-breadcrumb-spacer"/><span className="ide-branch"><GitBranch size={12}/> PROJECT CONTEXT</span></div>
        <div className="ide-editor-scroll">
          {busy && <div className="ide-loading"><span className="ide-loading-bar"/><p>SYNCING PROJECT FILES…</p></div>}
          {!activeProject && !busy && <div className="ide-empty-workspace"><div className="ide-empty-icon"><FolderKanban size={27}/></div><span className="ide-kicker">VIBEVAULT WORKSPACE</span><h1>Create your first project.</h1><p>Projects keep conversations, decisions and handoffs together. Import your existing AI work and continue from one place.</p><Button onClick={requestCreateProject}><Plus size={15}/> CREATE PROJECT</Button></div>}

          {activeProject && !busy && activePane === 'overview' && <div className="ide-page ide-overview-page">
            <div className="ide-page-heading"><div><span className="ide-kicker">PROJECT WORKSPACE</span><h1>{activeProject.title}</h1><p>{activeProject.description || 'A persistent home for the context, decisions and work behind this project.'}</p></div><div className="ide-heading-actions"><Button variant="ghost" onClick={() => setModal({ type: 'project-edit' })}><Settings2 size={14}/> PROJECT SETTINGS</Button><Button onClick={requestSaveConversation}><Upload size={14}/> IMPORT CONTEXT</Button></div></div>
            <div className="ide-stat-grid">
              <WorkspaceStat icon={MessageSquareText} label="CONVERSATIONS" value={projectConversations.length} detail="preserved threads"/>
              <WorkspaceStat icon={BookOpen} label="KNOWLEDGE RECORDS" value={projectSummaries.length + projectDecisions.length} detail="summaries and decisions"/>
              <WorkspaceStat icon={Workflow} label="AGENT HANDOFFS" value={projectHandoffs.length} detail="recorded transfers"/>
              <WorkspaceStat icon={Plug} label="AI CONNECTIONS" value={integrationTokens.filter(token => !token.revoked_at).length} detail="active tokens"/>
            </div>
            <div className="ide-overview-grid">
              <section className="ide-content-panel">
                <div className="ide-panel-heading"><div><span className="ide-kicker">PROJECT FILES</span><h2>Recent conversations</h2></div><button onClick={() => setPane('conversations')}>VIEW ALL <ArrowUpRight size={13}/></button></div>
                {projectConversations.slice(0,6).map(conversation => <button className="ide-recent-file" key={conversation.id} onClick={() => openConversation(conversation)}><span className="ide-file-icon"><FileText size={16}/></span><span className="ide-file-copy"><strong>{conversation.title}</strong><small>{conversation.source_ai} · {formatDate(conversation.created_at)}</small></span><span className="ide-file-open"><ChevronRight size={15}/></span></button>)}
                {!projectConversations.length && <div className="ide-panel-empty"><MessageSquareText size={20}/><strong>No conversations in this project</strong><span>Import a previous discussion or capture one from your browser extension.</span><Button variant="ghost" onClick={requestSaveConversation}><Upload size={14}/> IMPORT CONVERSATION</Button></div>}
              </section>
              <section className="ide-content-panel">
                <div className="ide-panel-heading"><div><span className="ide-kicker">PROJECT MEMORY</span><h2>Knowledge & decisions</h2></div><button onClick={() => setPane('knowledge')}>OPEN <ArrowUpRight size={13}/></button></div>
                <div className="ide-memory-row"><span className="ide-memory-icon"><BookOpen size={16}/></span><span><strong>Project description</strong><small>{activeProject.description || 'Add a description to establish the project objective.'}</small></span></div>
                <div className="ide-memory-row"><span className="ide-memory-icon"><Braces size={16}/></span><span><strong>Project rules</strong><small>{activeProject.project_rules || 'No project rules have been recorded yet.'}</small></span></div>
                <div className="ide-memory-row"><span className="ide-memory-icon"><CircleDot size={16}/></span><span><strong>Approved decisions</strong><small>{projectDecisions.filter(item => item.status === 'approved').length} approved · {projectDecisions.filter(item => item.status === 'open').length} open questions</small></span></div>
              </section>
            </div>
            <div className="ide-bottom-note"><ShieldCheck size={15}/><span>Original conversation records are preserved independently from generated specifications and summaries.</span></div>
          </div>}

          {activeProject && !busy && activePane === 'conversation' && activeConversation && <div className="ide-conversation-page">
            <div className="ide-document-heading"><div><span className="ide-kicker">CONVERSATION FILE · {activeConversation.source_ai.toUpperCase()}</span><h1>{activeConversation.title}</h1><p>Original discussion preserved in VibeVault. Select text and code as reference for the next agent.</p></div><div className="ide-heading-actions"><Button variant="ghost" onClick={() => navigator.clipboard?.writeText(activeConversation.raw_content || '')}><Clipboard size={14}/> COPY ORIGINAL</Button><Button onClick={() => setSelectedIds(current => current.includes(activeConversation.id) ? current : [...current, activeConversation.id])}><Plus size={14}/> ADD TO CONTEXT</Button></div></div>
            <ConversationEditor conversation={activeConversation} mode={transcriptMode} isPro={isPro} onModeChange={setTranscriptMode} cleaning={cleaningId === activeConversation.id} onClean={() => generateCleanSpec(activeConversation)}/>
          </div>}

          {activeProject && !busy && activePane === 'conversations' && <div className="ide-page">
            <div className="ide-page-heading"><div><span className="ide-kicker">PROJECT HISTORY</span><h1>Conversations</h1><p>Every preserved discussion, searchable and attached to this project.</p></div><Button onClick={requestSaveConversation}><Upload size={14}/> IMPORT</Button></div>
            <div className="ide-filter-row"><div className="source-filters">{SOURCE_AIS.map(source => <button key={source} className={'filter-chip ' + (sourceFilter === source ? 'active' : '')} onClick={() => setSourceFilter(source)}>{source}</button>)}</div><span>{visibleConversations.length} RECORDS</span></div>
            <div className="ide-resource-list">{visibleConversations.map(conversation => <div className="ide-resource-row" key={conversation.id}><label className="ide-context-checkbox"><input type="checkbox" checked={selectedIds.includes(conversation.id)} onChange={() => toggleConversation(conversation.id)}/></label><button className="ide-resource-open" onClick={() => openConversation(conversation)}><FileText size={17}/><span><strong>{conversation.title}</strong><small>{conversation.source_ai} · {formatDate(conversation.created_at)} · {(conversation.raw_content || '').length.toLocaleString()} characters</small></span></button><span className="ide-resource-tags">{(conversation.tags || []).slice(0,2).map(tag => <em key={tag}>{tag}</em>)}</span><button className="ide-row-chevron" onClick={() => openConversation(conversation)}><ChevronRight size={16}/></button></div>)}
            {!visibleConversations.length && <div className="ide-panel-empty"><MessageSquareText size={22}/><strong>No matching conversations</strong><span>Import a conversation to start this project's history.</span></div>}</div>
          </div>}

          {activeProject && !busy && activePane === 'knowledge' && <div className="ide-page">
            <div className="ide-page-heading"><div><span className="ide-kicker">PERSISTENT PROJECT MEMORY</span><h1>Knowledge base</h1><p>The stable information your next AI should understand before continuing work.</p></div><Button variant="ghost" onClick={() => setModal({ type: 'project-edit' })}><Settings2 size={14}/> EDIT PROJECT RULES</Button></div>
            <section className="ide-knowledge-card"><span className="ide-kicker">PROJECT OBJECTIVE</span><h2>{activeProject.title}</h2><RichDocumentBody text={activeProject.description || 'No project objective has been written yet.'}/></section>
            <section className="ide-knowledge-card"><span className="ide-kicker">PROJECT RULES & CONSTRAINTS</span><RichDocumentBody text={activeProject.project_rules || 'No project-specific rules have been recorded.'}/></section>
            <div className="ide-panel-heading"><div><span className="ide-kicker">SESSION MEMORY</span><h2>Saved session summaries</h2></div><span>{projectSummaries.length} RECORDS</span></div>
            {projectSummaries.map(summary => <article className="ide-summary-card" key={summary.id}><header><strong>{summary.title}</strong><small>{summary.source_ai || 'AI session'} · {formatDate(summary.created_at)}</small></header><RichDocumentBody text={summary.summary}/></article>)}
            {!projectSummaries.length && <div className="ide-panel-empty compact"><BookOpen size={18}/><strong>No session summaries yet</strong><span>A connected AI can save useful session outcomes through MCP.</span></div>}
          </div>}

          {activeProject && !busy && activePane === 'decisions' && <div className="ide-page">
            <div className="ide-page-heading"><div><span className="ide-kicker">PROJECT RECORD</span><h1>Decisions & open questions</h1><p>Approved choices stay distinguishable from ideas that still need confirmation.</p></div><span className="ide-record-count">{projectDecisions.length} RECORDS</span></div>
            {projectDecisions.map(decision => <article className="ide-decision-card" key={decision.id}><div className="ide-decision-top"><span className={'ide-decision-state state-' + decision.status}>{decision.status.replace('_',' ')}</span><span>{decision.category === 'open_question' ? 'OPEN QUESTION' : 'PROJECT DECISION'}</span><time>{formatDate(decision.created_at)}</time></div><h3>{decision.title}</h3><RichDocumentBody text={decision.content}/><small>{decision.source_ai || 'VibeVault'}</small></article>)}
            {!projectDecisions.length && <div className="ide-panel-empty"><CircleDot size={22}/><strong>No decisions have been saved</strong><span>MCP-connected AIs can save project decisions and unresolved questions when you ask them to.</span></div>}
          </div>}

          {activeProject && !busy && activePane === 'handoffs' && <div className="ide-page">
            <div className="ide-page-heading"><div><span className="ide-kicker">AGENT ACTIVITY</span><h1>Handoff history</h1><p>Track which AI received project context and which task role was assigned.</p></div><span className="ide-record-count">{projectHandoffs.length} RUNS</span></div>
            {projectHandoffs.map(handoff => <article className="ide-handoff-card" key={handoff.id}><div className="ide-handoff-symbol"><Bot size={18}/></div><div className="ide-handoff-copy"><strong>{handoff.target_ai}</strong><span>{handoff.role_name} · {formatDate(handoff.created_at)}</span><small>{handoff.confirmed ? 'Receiving AI confirmation marked' : 'Context prepared · confirmation not yet marked'}</small></div>{handoff.confirmed ? <span className="ide-handoff-confirmed"><CheckCircle2 size={13}/> CONFIRMED</span> : <Button variant="ghost" onClick={() => markHandoffConfirmed(handoff.id)}>MARK CONFIRMED</Button>}</article>)}
            {!projectHandoffs.length && <div className="ide-panel-empty"><Workflow size={22}/><strong>No handoffs yet</strong><span>Prepare a task in the Agent panel to start your handoff history.</span></div>}
          </div>}
        </div>
        <div className="ide-statusbar"><span><CircleDot size={12}/> {activeProject ? activeProject.title : 'NO PROJECT'}</span><span><GitBranch size={12}/> PROJECT MEMORY</span><span><ShieldCheck size={12}/> PRIVATE WORKSPACE</span><span className="ide-status-spacer"/><span>{projectConversations.length} CONVERSATIONS</span></div>
      </section>

      <aside className="ide-agent-panel">
        <div className="ide-agent-header"><div><span className="ide-kicker">VIBEVAULT AGENT</span><strong>Agent workspace</strong></div><span className="ide-agent-ready"><span/> READY</span></div>
        <div className="ide-agent-scroll">
          <div className="ide-agent-section-title"><span>DESTINATION AI</span><button onClick={() => setModal({ type: 'ai' })}>MANAGE</button></div>
          <button className="ide-agent-provider" onClick={() => setModal({ type: 'ai' })}>
            <span className="ide-agent-logo">{selectedProvider.logo ? <img src={selectedProvider.logo} alt=""/> : selectedProvider.name.slice(0,1)}</span>
            <span><strong>{targetAi}</strong><small>{providerPreferences.providers?.[targetAi]?.role || selectedProvider.role}</small></span>
            <ChevronDown size={15}/>
          </button>
          <label className="ide-agent-field">TASK ROLE<select className="ide-agent-select" value={activeSkillId} onChange={event => setActiveSkillId(event.target.value)}><option value="">Select a task role</option>{skills.map(skill => <option key={skill.id} value={skill.id}>{skill.role_name}</option>)}</select></label>
          <div className="ide-agent-divider"/>
          <label className="ide-agent-field">WHAT SHOULD THE AI DO?<textarea className="ide-task-input" value={taskPrompt} onChange={event => setTaskPrompt(event.target.value)} placeholder="Describe the next task. Example: Review the current architecture and identify the missing API boundaries…"/></label>
          <div className="ide-agent-context-head"><span>CONTEXT ATTACHED</span><strong>{selectedIds.filter(id => projectConversations.some(conversation => conversation.id === id)).length}</strong></div>
          <div className="ide-agent-context-list">
            {projectConversations.slice(0,5).map(conversation => <label className="ide-agent-context-row" key={conversation.id}><input type="checkbox" checked={selectedIds.includes(conversation.id)} onChange={() => toggleConversation(conversation.id)}/><FileText size={13}/><span>{conversation.title}</span></label>)}
            {!projectConversations.length && <span className="ide-context-empty">Import conversations to attach project history.</span>}
          </div>
          <div className="ide-context-summary"><ShieldCheck size={15}/><span>Project rules and saved preferences are included automatically. Original conversations are added only when selected.</span></div>
          <div className="ide-agent-divider"/>
          <div className="ide-agent-section-title"><span>RECENT AGENT RUNS</span><button onClick={() => setPane('handoffs')}>VIEW ALL</button></div>
          {projectHandoffs.slice(0,3).map(handoff => <div className="ide-agent-run-row" key={handoff.id}><span className="ide-run-dot"/><span><strong>{handoff.target_ai}</strong><small>{handoff.role_name} · {formatDate(handoff.created_at)}</small></span><span className={handoff.confirmed ? 'run-status done' : 'run-status'}>{handoff.confirmed ? 'DONE' : 'SENT'}</span></div>)}
          {!projectHandoffs.length && <span className="ide-context-empty">Your handoff history will appear here.</span>}
        </div>
        <div className="ide-agent-footer">
          <div className="ide-agent-footer-meta"><span><span className="status-pulse"/> CONTEXT PREPARED</span><small>{selectedIds.filter(id => projectConversations.some(conversation => conversation.id === id)).length} source records selected</small></div>
          <Button block onClick={() => saveHandoff(true)} disabled={!activeProject || !activeSkill}><Clipboard size={15}/> COPY HANDOFF CONTEXT</Button>
          <Button block variant="ghost" onClick={() => openInAI(targetAi)} disabled={!activeProject || !activeSkill}>OPEN {targetAi.toUpperCase()} <ArrowUpRight size={14}/></Button>
          <button className="ide-advanced-link" onClick={() => setShowTechnicalHandoff(value => !value)}>{showTechnicalHandoff ? 'HIDE TECHNICAL HANDOFF FILE' : 'ADVANCED · VIEW TECHNICAL HANDOFF FILE'}</button>
          {showTechnicalHandoff && <pre className="ide-technical-preview">{makeAgentMd()}</pre>}
        </div>
      </aside>
    </div>

    {modal?.type === 'project' && <ProjectModal onClose={() => setModal(null)} onSave={createProject}/>}
    {modal?.type === 'project-edit' && <ProjectModal initialProject={activeProject} onClose={() => setModal(null)} onSave={updateProject}/>}
    {modal?.type === 'conversation' && <ConversationModal onClose={() => setModal(null)} onSave={saveConversation}/>}
    {modal?.type === 'import' && <ImportModal onClose={() => setModal(null)} onImport={saveImportedConversations}/>}
    {modal?.type === 'inbox' && <InboxModal captures={captureInbox} projects={projects} activeProjectId={activeProject?.id || ''} onClose={() => setModal(null)} onImport={importCapture} onDiscard={discardCapture}/>}
    {modal?.type === 'ai' && <AIWorkspaceModal initialPreferences={providerPreferences} onboarding={Boolean(modal.onboarding)} onClose={() => setModal(null)} onSave={saveAiPreferences}/>}
    {modal?.type === 'integrations' && <IntegrationsModal tokens={integrationTokens} generatedToken={generatedToken} supabaseUrl={import.meta.env.VITE_SUPABASE_URL || ''} anonKey={import.meta.env.VITE_SUPABASE_ANON_KEY || ''} onClose={() => setModal(null)} onCreate={createIntegrationToken} onRevoke={revokeIntegrationToken}/>}
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


function ImportModal({ onClose, onImport }) {
  const [sourceAi, setSourceAi] = useState('ChatGPT')
  const [title, setTitle] = useState('')
  const [rawText, setRawText] = useState('')
  const [filename, setFilename] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [previewCount, setPreviewCount] = useState(0)
  const handleFile = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    setFilename(file.name)
    setError('')
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
    setBusy(true); setError('')
    try {
      const rows = parseImportedConversations(rawText, filename, sourceAi)
      if (rows.length === 1 && title.trim()) rows[0].title = title.trim()
      await onImport(rows)
    } catch (err) { setError(err.message || 'Could not import this conversation.') }
    finally { setBusy(false) }
  }
  return <Modal title="IMPORT CONVERSATIONS" eyebrow="BRING YOUR EXISTING AI WORK" onClose={onClose} wide>
    <form className="modal-form import-form" onSubmit={submit}>
      <div className="import-source-note"><Archive size={18}/><span><strong>Original conversation content is preserved.</strong><small>Import a single thread or a supported JSON conversation archive. ZIP archives must be extracted before selecting the JSON file.</small></span></div>
      <div className="form-two-col">
        <label className="field-label">SOURCE AI<select className="field-input" value={sourceAi} onChange={e => setSourceAi(e.target.value)}>{AI_PROVIDERS.map(provider => <option key={provider.name} value={provider.name}>{provider.name}</option>)}</select></label>
        <label className="field-label">CONVERSATION TITLE<input className="field-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Used for a single text import"/></label>
      </div>
      <label className="import-dropzone"><Upload size={24}/><strong>{filename || 'Choose a conversation file'}</strong><span>JSON, JSONL, TXT or Markdown</span><input type="file" accept=".json,.jsonl,.txt,.md,.markdown" onChange={handleFile}/></label>
      <div className="import-divider"><span>OR PASTE A CONVERSATION</span></div>
      <label className="field-label">CONVERSATION CONTENT<textarea className="field-input field-textarea raw-input" required value={rawText} onChange={e => setRawText(e.target.value)} placeholder="Paste the conversation here, or choose a file above."/></label>
      {previewCount > 0 && <div className="notice notice-success"><CheckCircle2 size={16}/><span>Ready to import {previewCount} conversation{previewCount === 1 ? '' : 's'} from this file.</span></div>}
      {error && <div className="notice notice-error"><CircleHelp size={16}/><span>{error}</span></div>}
      <div className="raw-integrity"><ShieldCheck size={15}/> Imported records stay in the Vault as original source material. Cleaned specifications are stored separately.</div>
      <div className="modal-actions"><Button variant="ghost" type="button" onClick={onClose}>CANCEL</Button><Button disabled={busy || !rawText.trim()}>{busy ? <><span className="vv-spinner"/> IMPORTING...</> : 'IMPORT TO PROJECT'}</Button></div>
    </form>
  </Modal>
}

function InboxModal({ captures, projects, activeProjectId, onClose, onImport, onDiscard }) {
  const [projectForCapture, setProjectForCapture] = useState({})
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const importOne = async capture => {
    setBusyId(capture.id); setError('')
    try { await onImport(capture, projectForCapture[capture.id] || activeProjectId) }
    catch (err) { setError(err.message || 'Could not import this capture.') }
    finally { setBusyId('') }
  }
  const discardOne = async id => {
    setBusyId(id); setError('')
    try { await onDiscard(id) } catch (err) { setError(err.message || 'Could not discard this capture.') }
    finally { setBusyId('') }
  }
  return <Modal title="IMPORT INBOX" eyebrow="BROWSER CAPTURES WAITING FOR A PROJECT" onClose={onClose} wide>
    <div className="inbox-intro"><Inbox size={19}/><span>Captures stay separate until you assign them to a project. Nothing enters your permanent Conversation Vault without your action.</span></div>
    {!captures.length ? <div className="empty-state inbox-empty"><Inbox size={28}/><h3 className="display">YOUR INBOX IS CLEAR.</h3><p>Use the VibeVault browser extension to capture a conversation from a supported AI page.</p></div> : <div className="inbox-capture-list">{captures.map(capture => <article className="inbox-capture-card" key={capture.id}><div className="conversation-meta"><span className="source-badge">{capture.source_ai}</span><span>{formatDate(capture.created_at)}</span></div><h3>{capture.title}</h3><p>{(capture.raw_content || '').slice(0, 220).replace(/\s+/g, ' ')}{(capture.raw_content || '').length > 220 ? '…' : ''}</p><label className="field-label">SAVE INTO PROJECT<select className="field-input" value={projectForCapture[capture.id] || activeProjectId} onChange={e => setProjectForCapture(current => ({ ...current, [capture.id]: e.target.value }))}><option value="">Choose a project</option>{projects.map(project => <option value={project.id} key={project.id}>{project.title}</option>)}</select></label><div className="modal-actions"><Button variant="ghost" onClick={() => discardOne(capture.id)} disabled={busyId === capture.id}>DISCARD</Button><Button onClick={() => importOne(capture)} disabled={busyId === capture.id || !projects.length}>{busyId === capture.id ? 'SAVING...' : 'ADD TO VAULT'}</Button></div></article>)}</div>}
    {error && <div className="notice notice-error"><CircleHelp size={16}/><span>{error}</span></div>}
    <div className="modal-actions"><Button onClick={onClose}>DONE</Button></div>
  </Modal>
}

function AIWorkspaceModal({ initialPreferences, onboarding, onClose, onSave }) {
  const [providers, setProviders] = useState(() => Object.fromEntries(AI_PROVIDERS.map(provider => [provider.name, {
    enabled: Boolean(initialPreferences.providers?.[provider.name]?.enabled),
    role: initialPreferences.providers?.[provider.name]?.role || provider.role
  }])))
  const [lastTarget, setLastTarget] = useState(initialPreferences.last_target || 'Claude')
  const [recommendations, setRecommendations] = useState(Boolean(initialPreferences.recommendations))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const enabledCount = Object.values(providers).filter(item => item.enabled).length
  const submit = async event => {
    event.preventDefault()
    if (!enabledCount) { setError('Select at least one AI provider to continue.'); return }
    setBusy(true); setError('')
    try { await onSave({ providers, last_target: lastTarget, recommendations }) }
    catch (err) { setError(err.message || 'Could not save your AI workspace.') }
    finally { setBusy(false) }
  }
  return <Modal title={onboarding ? 'SET UP YOUR AI WORKSPACE' : 'YOUR AI WORKSPACE'} eyebrow={onboarding ? 'FIRST-TIME SETUP · YOUR CHOICES ARE SAVED' : 'PROVIDERS · PERSONAL ROLES · PREFERENCES'} onClose={onboarding ? undefined : onClose} wide>
    <form className="modal-form ai-workspace-form" onSubmit={submit}>
      <p className="modal-explainer">{onboarding ? 'Choose the AI tools you actually use and assign each one a purpose. You can change these settings later. Choose at least one provider to finish setup.' : 'Select your preferred AI providers and tell VibeVault what you usually use each one for. These preferences guide future handoffs.'}</p>
      <div className="ai-provider-grid">{AI_PROVIDERS.map(provider => {
        const value = providers[provider.name]
        return <article className={'ai-provider-card ' + (value.enabled ? 'selected' : '')} key={provider.name}>
          <label className="ai-provider-top"><input type="checkbox" checked={value.enabled} onChange={e => setProviders(current => ({ ...current, [provider.name]: { ...current[provider.name], enabled: e.target.checked } }))}/><span className="ai-provider-logo">{provider.logo ? <img src={provider.logo} alt={provider.name + ' logo'} onError={event => { event.currentTarget.style.display = 'none' }}/> : provider.name.slice(0, 1)}</span><strong>{provider.name}</strong><span className="ai-selected-mark">{value.enabled ? <CheckCircle2 size={16}/> : <Plus size={15}/>}</span></label>
          <p>{provider.description}</p>
          <label className="field-label">MY USUAL ROLE<input className="field-input" value={value.role} onChange={e => setProviders(current => ({ ...current, [provider.name]: { ...current[provider.name], role: e.target.value } }))} placeholder="What do you use this AI for?"/></label>
        </article>
      })}</div>
      <label className="recommendation-toggle"><input type="checkbox" checked={recommendations} onChange={e => setRecommendations(e.target.checked)}/><span><strong>Suggest a suitable AI for a task</strong><small>Recommendations never override your selection. You remain in control of the destination AI.</small></span></label>
      <label className="field-label">DEFAULT AI FOR HANDOFFS<select className="field-input" value={providers[lastTarget]?.enabled ? lastTarget : (AI_PROVIDERS.find(provider => providers[provider.name]?.enabled)?.name || '')} onChange={e => setLastTarget(e.target.value)}>{AI_PROVIDERS.filter(provider => providers[provider.name]?.enabled).map(provider => <option key={provider.name}>{provider.name}</option>)}</select></label>
      {error && <div className="notice notice-error"><CircleHelp size={16}/><span>{error}</span></div>}
      <div className="modal-actions">{!onboarding && <Button variant="ghost" type="button" onClick={onClose}>CANCEL</Button>}<Button disabled={busy || !enabledCount}>{busy ? <><span className="vv-spinner"/> SAVING PREFERENCES...</> : onboarding ? 'SAVE MY AI WORKSPACE' : 'SAVE PREFERENCES'}</Button></div>
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
