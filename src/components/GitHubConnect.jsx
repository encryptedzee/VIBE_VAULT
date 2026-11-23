import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, ExternalLink, GitBranch, Github, Link2, LoaderCircle, Lock, RefreshCw, Search, Unlink, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function GitHubConnect({ project = null, onProjectUpdated, compact = false }) {
  const [connected, setConnected] = useState(false)
  const [account, setAccount] = useState(null)
  const [repositories, setRepositories] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')

  const loadConnection = useCallback(async () => {
    if (!supabase) { setLoading(false); setError('Supabase is not configured.'); return }
    setLoading(true)
    const { data, error: invokeError } = await supabase.functions.invoke('github-app', { body: { action: 'repositories' } })
    if (invokeError) { setConnected(false); setRepositories([]); setError(invokeError.message || 'Could not load GitHub connection.') }
    else { setConnected(Boolean(data?.connected)); setAccount(data?.account || null); setRepositories(data?.repositories || []); setError(data?.error || '') }
    setLoading(false)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const result = params.get('github')
    if (result === 'connected') setNotice('GitHub connected. Select a repository for this vault.')
    if (result === 'failed') setError(params.get('message') || 'GitHub connection failed.')
    if (result) {
      params.delete('github'); params.delete('message')
      window.history.replaceState({}, '', window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash)
    }
    void loadConnection()
  }, [loadConnection])

  const filtered = useMemo(() => repositories.filter(repo =>
    (repo.full_name + ' ' + (repo.description || '') + ' ' + (repo.language || '')).toLowerCase().includes(query.toLowerCase())
  ), [repositories, query])

  async function connect() {
    if (!supabase) return
    setBusy(true); setError(''); setNotice('')
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('github-app', { body: { action: 'start', return_origin: window.location.origin } })
      if (invokeError) throw invokeError
      if (!data?.install_url) throw new Error(data?.error || 'GitHub App is not configured yet.')
      window.location.assign(data.install_url)
    } catch (caught) { setError(caught.message || 'Could not start GitHub connection.'); setBusy(false) }
  }

  async function attach(repo) {
    if (!project?.id || !supabase) return
    setBusy(true); setError('')
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData?.user) throw new Error('Sign in again before linking a repository.')
      const patch = {
        github_repository_id: String(repo.id), github_full_name: repo.full_name,
        github_html_url: repo.html_url, github_default_branch: repo.default_branch || 'main',
        github_private: Boolean(repo.private), github_description: repo.description || '',
        github_language: repo.language || '', github_linked_at: new Date().toISOString()
      }
      const { data, error: updateError } = await supabase.from('projects').update(patch)
        .eq('id', project.id).eq('user_id', authData.user.id)
        .select('id,title,description,tags,created_at,updated_at,github_repository_id,github_full_name,github_html_url,github_default_branch,github_private,github_description,github_language,github_linked_at').single()
      if (updateError) throw updateError
      onProjectUpdated?.(data); setPickerOpen(false); setNotice('Linked ' + repo.full_name + ' to this vault.')
    } catch (caught) { setError(caught.message || 'Could not attach repository.') }
    setBusy(false)
  }

  async function detach() {
    if (!project?.id || !supabase) return
    setBusy(true); setError('')
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData?.user) throw new Error('Sign in again before changing this link.')
      const { data, error: updateError } = await supabase.from('projects').update({
        github_repository_id: null, github_full_name: null, github_html_url: null,
        github_default_branch: null, github_private: null, github_description: null,
        github_language: null, github_linked_at: null
      }).eq('id', project.id).eq('user_id', authData.user.id)
        .select('id,title,description,tags,created_at,updated_at,github_repository_id,github_full_name,github_html_url,github_default_branch,github_private,github_description,github_language,github_linked_at').single()
      if (updateError) throw updateError
      onProjectUpdated?.(data); setNotice('Repository unlinked from this vault.')
    } catch (caught) { setError(caught.message || 'Could not unlink repository.') }
    setBusy(false)
  }

  async function disconnect() {
    if (!window.confirm('Disconnect the GitHub App installation from VibeVault? This does not uninstall it from GitHub.')) return
    setBusy(true)
    const { error: invokeError } = await supabase.functions.invoke('github-app', { body: { action: 'disconnect' } })
    if (invokeError) setError(invokeError.message)
    else { setConnected(false); setAccount(null); setRepositories([]); setNotice('GitHub disconnected.') }
    setBusy(false)
  }

  return <div className={'vv-github-connect' + (compact ? ' compact' : '')}>
    {project ? <div className="vv-github-project-link">
      <div className="vv-github-project-copy"><span className="vv-github-label"><Github size={13}/> SOURCE REPOSITORY</span>
        {project.github_full_name ? <><strong>{project.github_full_name}</strong><small>{project.github_private ? 'Private repository' : 'Public repository'} · {project.github_default_branch || 'main'}</small></> : <><strong>No repository attached</strong><small>Connect a repository to this vault.</small></>}
      </div>
      {project.github_full_name ? <div className="vv-github-project-actions">
        <a href={project.github_html_url} target="_blank" rel="noreferrer"><ExternalLink size={12}/> Open</a>
        <button onClick={() => { setQuery(''); setPickerOpen(true); void loadConnection() }} disabled={!connected || busy}>Switch</button>
        <button onClick={detach} disabled={busy} aria-label="Unlink repository"><Unlink size={12}/></button>
      </div> : <button className="vv-github-connect-button" onClick={() => connected ? setPickerOpen(true) : void connect()} disabled={busy || loading}>
        {loading || busy ? <LoaderCircle className="vv-spin" size={14}/> : connected ? <Link2 size={14}/> : <Github size={14}/>}
        {loading ? 'Checking…' : connected ? 'Attach repository' : 'Connect GitHub'}
      </button>}
    </div> : <div className="vv-github-toolbar">
      {connected ? <>
        <span className="vv-github-connected"><i/><Github size={14}/>{account?.login || 'GitHub connected'}</span>
        <button className="vv-github-manage-button" onClick={() => setPickerOpen(true)}>Repositories <ChevronRight size={13}/></button>
        {!compact && <button className="vv-github-disconnect" onClick={disconnect} disabled={busy}>Disconnect</button>}
      </> : <button className="vv-github-connect-button" onClick={connect} disabled={busy || loading}>
        {busy || loading ? <LoaderCircle className="vv-spin" size={14}/> : <Github size={14}/>}
        {loading ? 'Checking GitHub…' : 'Connect GitHub'}
      </button>}
    </div>}
    {notice && <div className="vv-github-notice"><Check size={13}/>{notice}</div>}
    {error && <div className="vv-github-error" role="alert">{error}</div>}
    {pickerOpen && <div className="vv-github-picker-backdrop" onMouseDown={event => event.target === event.currentTarget && setPickerOpen(false)}>
      <section className="vv-github-picker" role="dialog" aria-modal="true" aria-label="Choose a GitHub repository">
        <header><div><span>GITHUB / REPOSITORY ACCESS</span><h2>{project ? 'Attach a repository' : 'Connected repositories'}</h2><p>Only repositories selected when you installed the VibeVault GitHub App are available here.</p></div><button onClick={() => setPickerOpen(false)} aria-label="Close"><X size={18}/></button></header>
        <label className="vv-github-picker-search"><Search size={14}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search repositories…"/></label>
        {loading ? <div className="vv-github-picker-empty"><LoaderCircle className="vv-spin"/> Loading repositories…</div> : filtered.length ? <div className="vv-github-repo-list">{filtered.map(repo => <article className="vv-github-repo-row" key={repo.id}>
          <span className="vv-github-repo-icon"><GitBranch size={15}/></span><div className="vv-github-repo-details"><strong>{repo.full_name}</strong><small>{repo.description || 'No description'} · {repo.language || 'Language not detected'}</small></div>
          {repo.private && <span className="vv-github-private"><Lock size={10}/> Private</span>}
          {project ? <button onClick={() => void attach(repo)} disabled={busy}>Attach</button> : <a href={repo.html_url} target="_blank" rel="noreferrer">Open <ExternalLink size={11}/></a>}
        </article>)}</div> : <div className="vv-github-picker-empty">No repositories found for this installation. Check which repositories the GitHub App can access.</div>}
        <footer><span>{repositories.length} repositories available</span><button onClick={() => void loadConnection()} disabled={loading}><RefreshCw size={12}/> Refresh</button></footer>
      </section>
    </div>}
  </div>
}
