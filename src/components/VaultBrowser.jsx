import React, { useMemo, useState } from 'react'
import { ArrowUpRight, Clock3, FolderKanban, GitBranch, Plus, Search, Workflow } from 'lucide-react'
import { GitHubConnect } from './GitHubConnect'

const ago = value => {
  if (!value) return 'Not updated'
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000))
  return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : days + ' days ago'
}
const category = vault => (vault.tags || []).find(tag => String(tag).startsWith('category:'))?.slice(9) || 'Development'
const agent = vault => (vault.tags || []).find(tag => String(tag).startsWith('ai:'))?.slice(3) || 'No agent selected'

export function VaultBrowser({ vaults = [], loading = false, error = '', firstName = 'there', greeting = 'day', showRecent = true, onOpenVault, onHandoff, onNewVault, onRefresh }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const categories = ['All', 'Development', 'Design', 'Business', 'Research', 'Personal']
  const filtered = useMemo(() => vaults.filter(vault => {
    const text = [vault.title, vault.description, ...(vault.tags || [])].join(' ').toLowerCase()
    return text.includes(query.trim().toLowerCase()) && (filter === 'All' || category(vault).toLowerCase() === filter.toLowerCase())
  }), [vaults, query, filter])
  return <div className="vv-vault-browser-page">
    <header className="vv-browser-heading">
      <div><span className="vv-browser-eyebrow">VIBEVAULT / WORKSPACE</span><h1>Good {greeting}, {firstName}.</h1><p>Your projects, conversations and agent handoffs — organized in one place.</p></div>
      <div className="vv-browser-actions"><GitHubConnect compact/><button className="vv-browser-primary" onClick={onNewVault}><Plus size={15}/> New Vault</button></div>
    </header>
    <label className="vv-browser-search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search vaults, projects, agents…"/>{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">×</button>}<kbd>⌘ K</kbd></label>
    {showRecent && <section className="vv-browser-section">
      <div className="vv-browser-section-heading"><div><span>YOUR LATEST WORK</span><h2>Recent Vaults</h2></div><button className="vv-browser-link" onClick={onRefresh}>Refresh <ArrowUpRight size={13}/></button></div>
      {error && <div className="vv-browser-error">{error}</div>}
      {loading ? <div className="vv-browser-loading">Loading vaults…</div> : vaults.length ? <div className="vv-recent-grid">
        {vaults.slice(0,3).map((vault,index) => <article className={'vv-recent-card vv-recent-card-' + index} key={vault.id}>
          <div className="vv-recent-card-top"><span className="vv-vault-symbol"><FolderKanban size={18}/></span><span className="vv-private-status"><i/> PRIVATE VAULT</span></div>
          <div className="vv-recent-copy"><h3>{vault.title}</h3><p>{vault.description || 'A dedicated space for project conversations and working context.'}</p></div>
          <div className="vv-recent-meta"><span>{agent(vault)}</span><span><Clock3 size={11}/>{ago(vault.updated_at || vault.created_at)}</span></div>
          {vault.github_full_name && <div className="vv-recent-repo"><GitBranch size={11}/>{vault.github_full_name}</div>}
          <div className="vv-recent-actions"><button onClick={() => onOpenVault(vault)}>Open Vault <ArrowUpRight size={13}/></button><button onClick={() => onHandoff(vault)}><Workflow size={13}/> Handoff</button></div>
        </article>)}
      </div> : <div className="vv-browser-empty"><FolderKanban size={22}/><div><strong>Your recent vaults will appear here.</strong><p>Create a vault or connect a project to start collecting your AI work.</p></div><button onClick={onNewVault}>Create vault <ArrowUpRight size={13}/></button></div>}
    </section>}
    <section className="vv-browser-section">
      <div className="vv-browser-section-heading"><div><span>YOUR PROJECT LIBRARY</span><h2>Browse Vaults</h2></div><span className="vv-vault-count">{filtered.length} VAULTS</span></div>
      <div className="vv-browser-tabs" role="tablist" aria-label="Vault categories">{categories.map(item => <button key={item} role="tab" aria-selected={filter === item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div>
      {loading ? <div className="vv-browser-loading">Loading vaults…</div> : filtered.length ? <div className="vv-vault-grid">
        {filtered.map(vault => <article className="vv-vault-browser-card" key={vault.id}>
          <div className="vv-vault-card-head"><span className="vv-vault-symbol"><FolderKanban size={18}/></span><span className="vv-vault-category">{category(vault)}</span></div>
          <h3>{vault.title}</h3><p>{vault.description || 'Project memory, conversations and decisions in one place.'}</p>
          <div className="vv-vault-tags"><span>{agent(vault)}</span>{vault.github_full_name && <span><GitBranch size={10}/>{vault.github_full_name}</span>}</div>
          <footer><small>{ago(vault.updated_at || vault.created_at)}</small><div><button onClick={() => onOpenVault(vault)}>Open <ArrowUpRight size={12}/></button><button aria-label={'Handoff ' + vault.title} onClick={() => onHandoff(vault)}><Workflow size={13}/></button></div></footer>
        </article>)}
      </div> : <div className="vv-browser-empty"><Search size={21}/><div><strong>{query || filter !== 'All' ? 'No vaults match this view.' : 'No vaults yet.'}</strong><p>{query || filter !== 'All' ? 'Try another search or category.' : 'Create your first vault to give your project a permanent home.'}</p></div><button onClick={query || filter !== 'All' ? () => { setQuery(''); setFilter('All') } : onNewVault}>{query || filter !== 'All' ? 'Clear filters' : 'Create vault'} <ArrowUpRight size={13}/></button></div>}
    </section>
  </div>
}
