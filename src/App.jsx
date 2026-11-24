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
const IS_FEATURE_PREVIEW_HOST = typeof window !== 'undefined' && /^(?:feature-professional-workspace-redesign|feature-vault-browser-github-connect|feature-vault-browser-preview-reset|[a-f0-9]{8})-vibevault\\.vibevault-hq\\.workers\\.dev$/i.test(window.location.hostname)

const SOURCE_AIS = ['ALL', 'CLAUDE', 'CHATGPT', 'GEMINI', 'CURSOR', 'WINDSURF', 'PERPLEXITY', 'DEEPSEEK', 'LOVABLE', 'BASE44', 'TRAE', 'QODER', 'OTHER']
const TARGET_AIS = ['Claude', 'ChatGPT', 'Gemini', 'Cursor', 'Windsurf', 'Perplexity', 'DeepSeek', 'Lovable', 'Base44', 'Trae', 'Qoder', 'Other']
