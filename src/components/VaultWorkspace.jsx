import React, { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowUpRight, File, FileText, MessageSquarePlus, Paperclip, RefreshCw, Search, Sparkles, Trash2, Workflow } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { GitHubConnect } from './GitHubConnect'

const MAX_FILE_BYTES = 25 * 1024 * 1024
const ACCEPTED_TYPES = new Set(['image/jpeg','image/png','image/webp','image/gif','image/avif','video/mp4','video/webm','application/pdf','text/plain','text/markdown','application/json','text/csv'])
const formatBytes = bytes => bytes < 1024 ? bytes + ' B' : bytes < 1048576 ? (bytes / 1024).toFixed(0) + ' KB' : (bytes / 1048576).toFixed(1) + ' MB'
const safeName = value => String(value || 'attachment').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'attachment'

export function VaultWorkspace({ project, conversations = [], loading = false, error = '', onBack, onHandoff, onConversationsChanged, onProjectUpdated, onReload }) {
  const [activeId, setActiveId] = useState(null)
  const [title, setTitle] = useState('')
  const [draft, setDraft] = useState('')
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [response, setResponse] = useState('')
  const [responseAgent, setResponseAgent] = useState('Claude')
  const [savingResponse, setSavingResponse] = useState(false)
  const [assetUrls, setAssetUrls] = useState([])
  const [search, setSearch] = useState('')

  const activeConversation = conversations.find(item => item.id === activeId) || null
  const visible = useMemo(() => conversations.filter(item => (item.title + ' ' + (item.raw_content || '')).toLowerCase().includes(search.toLowerCase())), [conversations, search])

  useEffect(() => {
    setActiveId(null); setTitle(''); setDraft(''); setFiles([]); setSaveError('')
  }, [project.id])

  useEffect(() => {
    let alive = true
    async function resolve() {
      const paths = activeConversation?.image_urls || []
      if (!paths.length || !supabase) { setAssetUrls([]); return }
      const result = await Promise.all(paths.map(async path => {
        const { data } = await supabase.storage.from('vault-attachments').createSignedUrl(path, 3600)
        return { path, url: data?.signedUrl || '' }
      }))
      if (alive) setAssetUrls(result.filter(item => item.url))
    }
    void resolve()
    return () => { alive = false }
  }, [activeConversation?.id, activeConversation?.image_urls])

  function addFiles(list) {
    const incoming = Array.from(list || [])
    const bad = incoming.find(file => file.size > MAX_FILE_BYTES || !ACCEPTED_TYPES.has(file.type))
    if (bad) { setSaveError(bad.size > MAX_FILE_BYTES ? bad.name + ' exceeds the 25 MB limit.' : bad.name + ' has an unsupported file type.'); return }
    setSaveError('')
    setFiles(current => [...current, ...incoming].slice(0, 10))
  }

  async function saveConversation(event) {
    event.preventDefault()
    if (!supabase || saving || !draft.trim()) return
    setSaving(true); setSaveError('')
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) { setSaveError('Your session expired. Sign in again.'); setSaving(false); return }
    const conversationId = crypto.randomUUID()
    const uploaded = []
    try {
      for (const file of files) {
        const path = authData.user.id + '/' + project.id + '/' + conversationId + '/' + crypto.randomUUID() + '-' + safeName(file.name)
        const { error: uploadError } = await supabase.storage.from('vault-attachments').upload(path, file, { cacheControl: '3600', contentType: file.type, upsert: false })
        if (uploadError) throw uploadError
        uploaded.push(path)
      }
      const conversationTitle = (title.trim() || draft.trim().split(/\r?\n/)[0] || 'New conversation').slice(0, 180)
      const { data, error: insertError } = await supabase.from('conversations').insert({
        id: conversationId, user_id: authData.user.id, project_id: project.id,
        title: conversationTitle, source_ai: 'Other', raw_content: draft.trim(),
        tags: ['workspace-created', 'agent-pending'], image_urls: uploaded,
        capture_metadata: { origin: 'inside-vault-workspace', handoff_status: 'not_sent', attachment_names: files.map(file => file.name) }
      }).select('id,title,source_ai,created_at,tags,cleaned_spec,raw_content,image_urls,capture_metadata').single()
      if (insertError) throw insertError
      onConversationsChanged?.(data)
      setActiveId(data.id); setTitle(''); setDraft(''); setFiles([])
    } catch (caught) {
      if (uploaded.length) await supabase.storage.from('vault-attachments').remove(uploaded)
      setSaveError(caught.message || 'Could not save the conversation.')
    }
    setSaving(false)
  }

  async function saveResponse(event) {
    event.preventDefault()
    if (!activeConversation || !response.trim() || savingResponse) return
    setSavingResponse(true); setSaveError('')
    const { data: authData } = await supabase.auth.getUser()
    if (!authData?.user) { setSaveError('Your session expired. Sign in again.'); setSavingResponse(false); return }
    const content = (activeConversation.raw_content || '') + '\n\n---\n\n## Response from ' + responseAgent + '\n\n' + response.trim()
    const tags = Array.from(new Set([...(activeConversation.tags || []), 'agent-response']))
    const { data, error: updateError } = await supabase.from('conversations').update({ raw_content: content, tags })
      .eq('id', activeConversation.id).eq('user_id', authData.user.id)
      .select('id,title,source_ai,created_at,tags,cleaned_spec,raw_content,image_urls,capture_metadata').single()
    if (updateError) setSaveError(updateError.message)
    else { onConversationsChanged?.(data); setResponse('') }
    setSavingResponse(false)
  }

  const images = assetUrls.filter(item => /\.(png|jpe?g|webp|gif|avif)(?:$|[?#])/i.test(item.path))
  const otherFiles = assetUrls.filter(item => !images.includes(item))
  return <div className="vv-inside-vault-workspace">
    <header className="vv-inside-vault-topbar">
      <button className="vv-inside-back" onClick={onBack}><ArrowLeft size={14}/> Vault Browser</button><span className="vv-inside-slash">/</span>
      <div className="vv-inside-project-name"><strong>{project.title}</strong><small>INSIDE THE VAULT</small></div>
      <div className="vv-inside-topbar-spacer"/><GitHubConnect project={project} onProjectUpdated={onProjectUpdated} compact/>
    </header>
    <div className="vv-inside-vault-body">
      <aside className="vv-inside-conversation-rail">
        <div className="vv-inside-rail-title"><span>PROJECT MEMORY</span><span>{conversations.length}</span></div>
        <button className="vv-inside-new-conversation" onClick={() => { setActiveId(null); setSaveError('') }}><MessageSquarePlus size={14}/> New conversation</button>
        <label className="vv-inside-thread-search"><Search size={14}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search conversations…"/></label>
        <div className="vv-inside-thread-list">
          {loading ? <div className="vv-inside-thread-empty">Loading conversations…</div> : visible.length ? visible.map(item => <button key={item.id} className={'vv-inside-thread-item' + (activeId === item.id ? ' active' : '')} onClick={() => { setActiveId(item.id); setSaveError('') }}>
            <MessageSquarePlus size={13}/><span><strong>{item.title}</strong><small>{item.source_ai || 'User draft'} · {new Date(item.created_at).toLocaleDateString()}</small></span>
          </button>) : <div className="vv-inside-thread-empty">No conversations yet. Start the first one here.</div>}
        </div>
        <div className="vv-inside-rail-footer"><span><i/> PRIVATE PROJECT SPACE</span><small>Drafts, handoffs and saved agent responses stay in this vault.</small></div>
      </aside>
      <main className="vv-inside-conversation-canvas">
        {activeConversation ? <div className="vv-inside-thread-detail">
          <div className="vv-inside-thread-heading"><div><span className="vv-inside-kicker">SAVED CONVERSATION</span><h1>{activeConversation.title}</h1><p>{activeConversation.source_ai || 'User draft'} · {new Date(activeConversation.created_at).toLocaleString()}</p></div><button className="vv-inside-handoff-button" onClick={() => onHandoff?.(activeConversation)}><Workflow size={14}/> Handoff to AI <ArrowUpRight size={13}/></button></div>
          <article className="vv-inside-message-card"><div className="vv-inside-message-author"><span>Y</span><div><strong>You</strong><small>Conversation and saved responses</small></div></div><pre>{activeConversation.raw_content || 'No content saved.'}</pre>
            {images.length > 0 && <div className="vv-inside-image-attachments">{images.map(item => <a href={item.url} target="_blank" rel="noreferrer" key={item.path}><img src={item.url} alt="Conversation attachment"/></a>)}</div>}
            {otherFiles.length > 0 && <div className="vv-inside-file-attachments">{otherFiles.map(item => <a href={item.url} target="_blank" rel="noreferrer" key={item.path}><FileText size={13}/>{item.path.split('/').pop()}</a>)}</div>}
            {(activeConversation.tags || []).includes('agent-response') && <span className="vv-inside-response-saved">✓ Agent response saved in this conversation</span>}
          </article>
          <form className="vv-inside-response-form" onSubmit={saveResponse}>
            <div className="vv-inside-response-label"><span>RETURN AN AGENT RESPONSE</span><small>Paste a reply here, or use the VibeVault MCP tool to save it directly.</small></div>
            <div className="vv-inside-response-controls"><select value={responseAgent} onChange={event => setResponseAgent(event.target.value)}>{['Claude','ChatGPT','Gemini','Cursor','Windsurf','Codex','Other'].map(item => <option key={item}>{item}</option>)}</select><button type="button" onClick={() => void onReload?.()}><RefreshCw size={12}/> Refresh</button></div>
            <textarea rows={4} value={response} onChange={event => setResponse(event.target.value)} placeholder="Paste the response from your coding agent to preserve it here…"/>
            {saveError && <div className="vv-inside-error" role="alert">{saveError}</div>}
            <div className="vv-inside-response-submit"><span>ID: {activeConversation.id.slice(0,8)}…</span><button type="submit" disabled={savingResponse || !response.trim()}>{savingResponse ? 'Saving…' : 'Save response'} <ArrowUpRight size={13}/></button></div>
          </form>
        </div> : <div className="vv-inside-new-thread">
          <div className="vv-inside-welcome-mark"><Sparkles size={21}/></div><span className="vv-inside-kicker">A WORKSPACE FOR THIS PROJECT</span>
          <h1>What are we working on?</h1><p>Start here without choosing an AI first. Add screenshots, images or files, save your conversation, then hand it to the agent you prefer.</p>
          <form className="vv-inside-composer" onSubmit={saveConversation}>
            <label><span>Conversation title <small>OPTIONAL</small></span><input value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Improve checkout experience"/></label>
            <textarea rows={6} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Describe what you want to build, explain an issue, or start a new idea…"/>
            <div className="vv-inside-composer-footer"><label className="vv-inside-attach-button"><Paperclip size={14}/> Attach files<input type="file" multiple accept="image/*,video/mp4,video/webm,application/pdf,text/plain,text/markdown,application/json,text/csv" onChange={event => addFiles(event.target.files)}/></label><span>10 files · 25 MB each</span></div>
            {files.length > 0 && <div className="vv-inside-draft-files">{files.map((file,index) => <div key={file.name + index}><File size={13}/><span>{file.name}</span><small>{formatBytes(file.size)}</small><button type="button" onClick={() => setFiles(current => current.filter((_,i) => i !== index))} aria-label={'Remove ' + file.name}><Trash2 size={12}/></button></div>)}</div>}
            {saveError && <div className="vv-inside-error" role="alert">{saveError}</div>}
            <div className="vv-inside-composer-bottom"><span><i/> Saved to this vault before handoff</span><button type="submit" disabled={saving || !draft.trim()}>{saving ? 'Saving…' : 'Save to Vault'} <ArrowUpRight size={14}/></button></div>
          </form>
        </div>}
      </main>
    </div>
    {error && <div className="vv-inside-page-error" role="alert">{error}</div>}
  </div>
}
