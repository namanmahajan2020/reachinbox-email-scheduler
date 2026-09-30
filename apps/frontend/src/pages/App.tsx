import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import {
  Archive,
  Bold,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Filter,
  Italic,
  LoaderCircle,
  LogOut,
  RefreshCw,
  Search,
  Send,
  Star,
  Strikethrough,
  Trash2,
  Underline,
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { parseLeads } from '../utils/leads';

type Email = {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  status: 'scheduled' | 'processing' | 'sent' | 'failed';
  scheduledAt: string;
  sentAt?: string | null;
  createdAt?: string;
  sender?: { email: string; displayName: string };
  campaign?: { attachments?: { id: string; filename: string; contentType: string; size?: number }[] };
  isStarred?: boolean;
  isArchived?: boolean;
  deletedAt?: string | null;
  htmlBody?: string | null;
};
type User = { name: string; email: string; avatarUrl?: string | null; hasPassword?: boolean };
type Sender = { id: string; email: string; displayName: string };
type Tab = 'scheduled' | 'sent';
type PageInfo = { currentPage: number; pageSize: number; totalCount: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean };
const FORMAT_COMMANDS = ['bold', 'italic', 'underline', 'strikeThrough', 'insertOrderedList', 'insertUnorderedList', 'justifyLeft', 'justifyCenter', 'justifyRight'] as const;

const API = 'http://localhost:4000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}/api${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error?.formErrors?.join(', ') || body.error || `Request failed (${response.status})`);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

function localDateTime(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function uniqueEmails(values: string[]) {
  return [...new Map(values.map((value) => [value.trim().toLowerCase(), value.trim()])).values()];
}

async function fileToBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

function plainText(html: string) {
  const element = document.createElement('div');
  element.innerHTML = html;
  return (element.innerText || element.textContent || '').trim();
}

function formatScheduled(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function formatMessageDate(value?: string | null) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value || Date.now()));
}

function formatFileSize(size?: number) {
  if (size == null) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function filterDateRange(filter: string, tab: Tab, now = new Date()): { from?: string; to?: string } {
  const startOfDay = (date: Date) => { const value = new Date(date); value.setHours(0, 0, 0, 0); return value; };
  const endOfDay = (date: Date) => { const value = startOfDay(date); value.setDate(value.getDate() + 1); return value; };
  if (filter === 'today') return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
  if (filter === 'yesterday') { const day = new Date(now); day.setDate(day.getDate() - 1); return { from: startOfDay(day).toISOString(), to: endOfDay(day).toISOString() }; }
  if (filter === '7d' || filter === '30d') { const from = new Date(now); from.setDate(from.getDate() - (filter === '7d' ? 7 : 30)); return { from: from.toISOString() }; }
  if (filter.endsWith('h')) { const from = new Date(now); from.setHours(from.getHours() - Number(filter.slice(0, -1))); return { from: from.toISOString() }; }
  if (filter === 'tomorrow') { const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1); return { from: startOfDay(tomorrow).toISOString(), to: endOfDay(tomorrow).toISOString() }; }
  if (filter === '24h') return { from: now.toISOString(), to: new Date(now.getTime() + 24 * 60 * 60_000).toISOString() };
  if (filter === 'week') { const from = startOfDay(now); const day = (from.getDay() + 6) % 7; from.setDate(from.getDate() - day); const to = new Date(from); to.setDate(to.getDate() + 7); return tab === 'scheduled' ? { from: now.toISOString(), to: to.toISOString() } : { from: from.toISOString(), to: to.toISOString() }; }
  return {};
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="google-mark" viewBox="0 0 48 48">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.8-3.5 6.1-8.7 6.1-15Z" />
      <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z" />
      <path fill="#FBBC05" d="M12.6 27.7a12 12 0 0 1 0-7.4V15H5.8a20 20 0 0 0 0 18Z" />
      <path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.9-5.9A19.7 19.7 0 0 0 24 4 20 20 0 0 0 5.8 15l6.8 5.3c1.6-4.8 6.1-8.2 11.4-8.2Z" />
    </svg>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [tab, setTab] = useState<Tab>('scheduled');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Email[] | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [emailFilter, setEmailFilter] = useState<'all' | 'starred' | 'archived' | 'trash'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInfo, setPageInfo] = useState<PageInfo>({ currentPage: 1, pageSize: 50, totalCount: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false });
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [senderOpen, setSenderOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [senderId, setSenderId] = useState('');
  const [recipientDraft, setRecipientDraft] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [startTime, setStartTime] = useState(localDateTime(new Date(Date.now() + 5 * 60_000)));
  const [delaySeconds, setDelaySeconds] = useState('2');
  const [hourlyLimit, setHourlyLimit] = useState('100');
  const [leadFileName, setLeadFileName] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [signUp, setSignUp] = useState(false);
  const [toast, setToast] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const attachmentPreviews = useMemo(() => attachments.map((file) => ({ file, url: file.type.startsWith('image/') ? URL.createObjectURL(file) : '' })), [attachments]);
  useEffect(() => () => attachmentPreviews.forEach((preview) => { if (preview.url) URL.revokeObjectURL(preview.url); }), [attachmentPreviews]);
  const [actionBusy, setActionBusy] = useState(false);
  const [senderBusy, setSenderBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});
  const editorRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef(false);
  const searchGenerationRef = useRef(0);
  const pollFailedRef = useRef(false);

  function notify(message: string) { setToast(message); }

  function syncFormattingState() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    const selectionIsInEditor = !!editor && !!selection?.anchorNode && editor.contains(selection.anchorNode);
    const next = Object.fromEntries(FORMAT_COMMANDS.map((command) => [command, selectionIsInEditor && document.queryCommandState(command)]));
    setActiveFormats((current) => FORMAT_COMMANDS.every((command) => current[command] === next[command]) ? current : next);
  }

  useEffect(() => {
    if (!composeOpen) { setActiveFormats({}); return; }
    const refresh = () => syncFormattingState();
    document.addEventListener('selectionchange', refresh);
    refresh();
    return () => document.removeEventListener('selectionchange', refresh);
  }, [composeOpen]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function loadEmails(page = currentPage) {
    setLoading(true);
    setError('');
    const view = emailFilter === 'all' ? tab : emailFilter;
    const range = filterDateRange(dateFilter, tab);
    const params = new URLSearchParams({ view, page: String(page), limit: '50' });
    if (search.trim()) params.set('q', search.trim());
    if (range.from) params.set('dateFrom', range.from);
    if (range.to) params.set('dateTo', range.to);
    try {
      const path = search.trim() ? `/search?${params}` : `/emails?${params}`;
      const response = await request<{ emails: Email[] } & PageInfo>(path);
      setEmails(response.emails);
      setPageInfo(response);
      setCurrentPage(response.currentPage);
      setSelectedIds([]);
    } catch (cause) { const message = cause instanceof Error ? cause.message : 'Could not load emails'; if (message === 'Authentication required') setUser(null); else setError(message); }
    finally { setLoading(false); }
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const session = await request<{ authenticated: boolean; user?: User }>('/auth/session');
      if (!session.authenticated || !session.user) {
        setUser(null);
        setEmails([]);
        return;
      }
      const [currentEmails, currentSenders] = await Promise.all([
        request<{ emails: Email[] } & PageInfo>(`/emails?view=${emailFilter === 'all' ? tab : emailFilter}&page=${currentPage}&limit=50`),
        request<Sender[]>('/senders'),
      ]);
      setUser(session.user);
      setEmails(currentEmails.emails);
      setPageInfo(currentEmails);
      setSenders(currentSenders);
      setSenderId((current) => current || currentSenders[0]?.id || '');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not load your inbox';
      if (message !== 'Authentication required') setError(message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (user) void loadEmails(currentPage);
  }, [user, currentPage, tab, emailFilter, dateFilter, search]);

  useEffect(() => {
    if (!user || composeOpen || selectedEmail || search.trim()) return;
    let active = true;
    const timer = window.setInterval(async () => {
      if (pollingRef.current) return;
      pollingRef.current = true;
      try {
        const view = emailFilter === 'all' ? tab : emailFilter;
        const query = new URLSearchParams({ view, page: String(currentPage), limit: '50' });
        if (search.trim()) query.set('q', search.trim());
        const dateRange = filterDateRange(dateFilter, tab);
        if (dateRange.from) query.set('dateFrom', dateRange.from);
        if (dateRange.to) query.set('dateTo', dateRange.to);
        const latest = await request<{ emails: Email[] } & PageInfo>(`${search.trim() ? '/search' : '/emails'}?${query}`);
        if (active) { setEmails(latest.emails); setPageInfo(latest); }
        pollFailedRef.current = false;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : '';
        if (message === 'Authentication required') setUser(null);
        else if (!pollFailedRef.current) { pollFailedRef.current = true; notify('Inbox updates are temporarily unavailable.'); }
      }
      finally { pollingRef.current = false; }
    }, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [user, composeOpen, selectedEmail, search, currentPage, tab, emailFilter, dateFilter]);

  useEffect(() => {
    if (!profileOpen && !filterOpen && !scheduleOpen && !senderOpen && !passwordOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest('.account-card, .account-menu')) setProfileOpen(false);
      if (!target?.closest('.filter-anchor')) setFilterOpen(false);
      if (!target?.closest('.schedule-trigger, .schedule-popover')) setScheduleOpen(false);
      if (senderOpen && !target?.closest('.sender-dialog, .inline-add-sender')) setSenderOpen(false);
      if (passwordOpen && !target?.closest('.password-dialog, .set-password-action')) setPasswordOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setProfileOpen(false); setFilterOpen(false); setScheduleOpen(false); setSenderOpen(false); setPasswordOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOnOutside); document.removeEventListener('keydown', closeOnEscape); };
  }, [profileOpen, filterOpen, scheduleOpen, senderOpen, passwordOpen]);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loginBusy) return;
    const form = new FormData(event.currentTarget);
    setLoginBusy(true); setError('');
    try {
      const user = await request<User>(signUp ? '/auth/register' : '/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: form.get('email'), password: form.get('password'), ...(signUp ? { name: form.get('name') } : {}) }),
      });
      setUser(user);
      notify(signUp ? 'Account created.' : 'Login successful.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign in. Please try again.');
    } finally { setLoginBusy(false); }
  }

  async function signOut() {
    try { await request('/auth/logout', { method: 'POST' }); setUser(null); setEmails([]); setProfileOpen(false); setSignUp(false); setError(''); notify('Signed out.'); }
    catch (cause) { notify(cause instanceof Error ? cause.message : 'Could not sign out.'); }
  }

  async function setAccountPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordBusy) return;
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password') ?? '');
    if (password !== data.get('confirmPassword')) { notify('Passwords do not match.'); return; }
    setPasswordBusy(true);
    try {
      await request('/auth/password', { method: 'POST', body: JSON.stringify({ password }) });
      setUser((current) => current ? { ...current, hasPassword: true } : current);
      setPasswordOpen(false); notify('Password updated.');
    } catch (cause) { notify(cause instanceof Error ? cause.message : 'Could not update password.'); }
    finally { setPasswordBusy(false); }
  }

  async function changeEmail(email: Email, action: 'star' | 'archive' | 'unarchive' | 'delete' | 'restore' | 'permanent-delete') {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      if (action === 'star') {
        const isStarred = !email.isStarred;
        setEmails((current) => current.map((item) => item.id === email.id ? { ...item, isStarred } : item));
        setResults((current) => current?.map((item) => item.id === email.id ? { ...item, isStarred } : item) ?? null);
        setSelectedEmail((current) => current?.id === email.id ? { ...current, isStarred } : current);
        try {
          await request(`/emails/${email.id}/star`, { method: 'PATCH', body: JSON.stringify({ starred: isStarred }) });
        } catch (cause) {
          setEmails((current) => current.map((item) => item.id === email.id ? { ...item, isStarred: !isStarred } : item));
          setResults((current) => current?.map((item) => item.id === email.id ? { ...item, isStarred: !isStarred } : item) ?? null);
          setSelectedEmail((current) => current?.id === email.id ? { ...current, isStarred: !isStarred } : current);
          throw cause;
        }
        notify(isStarred ? 'Email starred.' : 'Email unstarred.');
      } else if (action === 'archive' || action === 'unarchive') {
        const isArchived = action === 'archive';
        await request(`/emails/${email.id}/archive`, { method: 'PATCH', ...(isArchived ? {} : { body: JSON.stringify({ archived: false }) }) });
        setEmails((current) => current.map((item) => item.id === email.id ? { ...item, isArchived } : item));
        setResults((current) => current?.map((item) => item.id === email.id ? { ...item, isArchived } : item) ?? null);
        setSelectedEmail(null);
        notify(isArchived ? 'Email archived.' : 'Email unarchived.');
      } else if (action === 'delete') {
        await request(`/emails/${email.id}/trash`, { method: 'PATCH' });
        setEmails((current) => current.filter((item) => item.id !== email.id)); setSelectedEmail(null); notify('Email moved to Trash.');
      } else if (action === 'restore') {
        await request(`/emails/${email.id}/restore`, { method: 'PATCH' });
        setEmails((current) => current.filter((item) => item.id !== email.id)); setSelectedEmail(null); notify('Email restored.');
      } else {
        if (!window.confirm('Delete permanently? This email will be permanently removed and cannot be restored.')) return;
        await request(`/emails/${email.id}/permanent`, { method: 'DELETE' });
        setEmails((current) => current.filter((item) => item.id !== email.id)); setSelectedEmail(null); notify('Email permanently deleted.');
      }
      void loadEmails(currentPage);
    } catch (cause) { notify(cause instanceof Error ? cause.message : 'Email action failed.'); }
    finally { setActionBusy(false); }
  }

  async function bulkAction(action: 'archive' | 'unarchive' | 'star' | 'unstar' | 'trash' | 'restore' | 'permanent-delete') {
    if (!selectedIds.length || actionBusy) return;
    if (action === 'permanent-delete' && !window.confirm(`Delete ${selectedIds.length} email${selectedIds.length === 1 ? '' : 's'} permanently? This cannot be undone.`)) return;
    setActionBusy(true);
    try {
      await request<{ count: number }>('/emails/bulk', { method: 'PATCH', body: JSON.stringify({ ids: selectedIds, action }) });
      const changedIds = new Set(selectedIds);
      if (action === 'star' || action === 'unstar') setEmails((current) => current.map((item) => changedIds.has(item.id) ? { ...item, isStarred: action === 'star' } : item));
      else setEmails((current) => current.filter((item) => !changedIds.has(item.id)));
      setSelectedIds([]);
      notify(action === 'trash' ? 'Emails moved to Trash.' : action === 'restore' ? 'Emails restored.' : action === 'permanent-delete' ? 'Emails permanently deleted.' : 'Bulk action complete.');
      void loadEmails(currentPage);
    } catch (cause) { notify(cause instanceof Error ? cause.message : 'Bulk action failed.'); }
    finally { setActionBusy(false); }
  }

  async function handleAttachments(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    const combined = [...attachments, ...files];
    if (combined.length > 5 || combined.reduce((sum, file) => sum + file.size, 0) > 5 * 1024 * 1024) {
      notify('Choose up to 5 attachments totaling no more than 5 MB.'); return;
    }
    setAttachments(combined); notify(`${files.length} attachment${files.length === 1 ? '' : 's'} added.`);
  }

  function applyFormat(command: string, value?: string) {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (editor && (!selection?.anchorNode || !editor.contains(selection.anchorNode))) editor.focus();
    document.execCommand(command, false, value);
    if (editor) setBody(editor.innerHTML);
    syncFormattingState();
  }

  const visibleEmails = emails;
  const scheduledCount = tab === 'scheduled' ? pageInfo.totalCount : undefined;
  const sentCount = tab === 'sent' ? pageInfo.totalCount : undefined;

  async function find() {
    const query = search.trim();
    setCurrentPage(1);
    setResults(null);
    if (!query) return;
    await loadEmails(1);
  }

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [tab, emailFilter, dateFilter, search]);

  function openCompose() {
    setNotice('');
    setSubject('');
    setBody('');
    setRecipientDraft('');
    setRecipients([]);
    setLeadFileName('');
    setAttachments([]);
    setSenderOpen(false); setProfileOpen(false); setFilterOpen(false);
    setStartTime(localDateTime(new Date(Date.now() + 5 * 60_000)));
    setDelaySeconds('2');
    setHourlyLimit('100');
    setScheduleOpen(false);
    setComposeOpen(true);
  }

  function closeCompose() {
    setComposeOpen(false);
    setScheduleOpen(false);
  }

  function addDraftRecipients() {
    if (!recipientDraft.trim()) return;
    const parsed = parseLeads(recipientDraft);
    if (!parsed.length) { notify('Enter a valid email address or upload a recipient list.'); return; }
    setRecipients((current) => uniqueEmails([...current, ...parsed]));
    setRecipientDraft('');
  }

  function handleRecipientKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addDraftRecipients();
    }
    if (event.key === 'Backspace' && !recipientDraft && recipients.length) {
      setRecipients((current) => current.slice(0, -1));
    }
  }

  async function handleLeadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const parsed = parseLeads(await file.text());
    setRecipients((current) => uniqueEmails([...current, ...parsed]));
    setLeadFileName(file.name);
    event.target.value = '';
  }

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (scheduleBusy) return;
    if (recipientDraft.trim() && !parseLeads(recipientDraft).length) { notify('Check the recipient email address.'); return; }
    const allRecipients = uniqueEmails([...recipients, ...parseLeads(recipientDraft)]);
    if (!allRecipients.length) {
      setNotice('Add at least one valid recipient or upload a lead list.');
      return;
    }
    if (!senderId) {
      setNotice('Add a sender before scheduling a campaign.');
      return;
    }
    if (!plainText(body)) { notify('Write an email message before scheduling.'); return; }
    const scheduleDate = new Date(startTime);
    if (!Number.isFinite(scheduleDate.getTime()) || scheduleDate.getTime() < Date.now() + 60_000) {
      notify('Choose a send time at least one minute in the future.'); return;
    }
    try {
      setScheduleBusy(true);
      const encodedAttachments = await Promise.all(attachments.map(async (file) => ({ filename: file.name, contentType: file.type || 'application/octet-stream', contentBase64: await fileToBase64(file) })));
      const created = await request<{ emails: Email[]; queuePending: number }>('/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          subject,
          body: plainText(body),
          htmlBody: body,
          attachments: encodedAttachments,
          recipients: allRecipients,
          senderId,
          startTime: scheduleDate.toISOString(),
          delayBetweenEmails: Math.max(0, Number(delaySeconds) || 0) * 1000,
          hourlyLimit: Math.max(1, Number(hourlyLimit) || 100),
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      setEmails((current) => [...new Map([...created.emails, ...current].map((email) => [email.id, email])).values()]);
      setTab('scheduled');
      setResults(null);
      closeCompose();
      setNotice(created.queuePending
        ? `${created.emails.length} emails were saved; ${created.queuePending} queue jobs will retry when the API restarts.`
        : `${created.emails.length} emails scheduled successfully.`);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Could not schedule this campaign');
    } finally {
      setScheduleBusy(false);
    }
  }

  async function createSender(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (senderBusy) return;
    const form = new FormData(event.currentTarget);
    try {
      setSenderBusy(true);
      const sender = await request<Sender>('/senders', {
        method: 'POST',
        body: JSON.stringify({ email: form.get('email'), displayName: form.get('displayName') }),
      });
      setSenders((current) => [...current.filter((item) => item.id !== sender.id), sender]);
      setSenderId(sender.id);
      setSenderOpen(false);
      setNotice('Sender added to your workspace.');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Could not add sender');
    } finally { setSenderBusy(false); }
  }

  const tomorrowOptions = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const atNine = new Date(tomorrow);
    atNine.setHours(9, 0, 0, 0);
    return [
      { label: 'Tomorrow', value: localDateTime(atNine) },
      ...[10, 11, 15].map((hour) => {
        const date = new Date(tomorrow);
        date.setHours(hour, 0, 0, 0);
        return {
          label: `Tomorrow, ${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`,
          value: localDateTime(date),
        };
      }),
    ];
  }, []);

  if (loading) {
    return <div className="loader"><LoaderCircle className="spin" size={20} /><span>Loading your inbox</span></div>;
  }

  if (!user) {
    return (
      <main className="login-page">
        <section className="login-card" aria-labelledby="login-title">
          <h1 id="login-title">{signUp ? 'Create account' : 'Login'}</h1>
          {error && <div className="login-error" role="alert">{error}</div>}
          <a className="google-button" href={`${API}/api/auth/google`}><GoogleMark />Login with Google</a>
          <div className="login-divider"><button className="auth-toggle" type="button" onClick={() => { setSignUp((current) => !current); setError(''); }}>{signUp ? 'Already have an account? Login' : 'or sign up through email'}</button></div>
          <form className="login-form" onSubmit={(event) => void submitLogin(event)}>
            {signUp && <input aria-label="Name" name="name" placeholder="Your name" autoComplete="name" required maxLength={100} />}
            <input aria-label="Email ID" name="email" type="email" placeholder="Email ID" autoComplete="email" required maxLength={254} />
            <input aria-label="Password" name="password" type="password" placeholder="Password" autoComplete={signUp ? 'new-password' : 'current-password'} required minLength={signUp ? 8 : 1} maxLength={128} />
            <button className="login-submit" type="submit" disabled={loginBusy}>{loginBusy ? (signUp ? 'Creating account…' : 'Logging in…') : signUp ? 'Create account' : 'Login'}</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <div className="mail-app">
      {!composeOpen && !selectedEmail && (
        <aside className="mail-sidebar">
<div className="wordmark"><img src="/logo.svg" alt="OMG" /></div>
          <button className="account-card" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen}>
            <Avatar user={user} />
            <span className="account-copy"><strong>{user.name}</strong><small>{user.email}</small></span>
            <ChevronDown size={16} />
          </button>
          {profileOpen && (
            <div className="account-menu">
              {!user.hasPassword && <button className="set-password-action" onClick={() => { setProfileOpen(false); setPasswordOpen(true); }}>Set email password</button>}
              <button onClick={() => void signOut()}><LogOut size={14} />Sign out</button>
            </div>
          )}
          <button className="compose-sidebar-button" onClick={openCompose}>Compose</button>
          <nav className="mail-nav" aria-label="Email folders">
            <div className="mail-nav-label">CORE</div>
            <button className={`mail-nav-item ${tab === 'scheduled' ? 'active' : ''}`} onClick={() => { setTab('scheduled'); setEmailFilter('all'); setSearch(''); setResults(null); setProfileOpen(false); setFilterOpen(false); }}>
              <Clock3 size={17} /><span>Scheduled</span><small>{scheduledCount}</small>
            </button>
            <button className={`mail-nav-item ${tab === 'sent' ? 'active' : ''}`} onClick={() => { setTab('sent'); setEmailFilter('all'); setSearch(''); setResults(null); setProfileOpen(false); setFilterOpen(false); }}>
              <Send size={17} /><span>Sent</span><small>{sentCount}</small>
            </button>
            <div className="mail-nav-label">FOLDERS</div>
            <button className={`mail-nav-item ${emailFilter === 'starred' ? 'active' : ''}`} onClick={() => { setEmailFilter('starred'); setSearch(''); setProfileOpen(false); }}><Star size={17} /><span>Starred</span></button>
            <button className={`mail-nav-item ${emailFilter === 'archived' ? 'active' : ''}`} onClick={() => { setEmailFilter('archived'); setSearch(''); setProfileOpen(false); }}><Archive size={17} /><span>Archived</span></button>
            <button className={`mail-nav-item ${emailFilter === 'trash' ? 'active' : ''}`} onClick={() => { setEmailFilter('trash'); setSearch(''); setProfileOpen(false); }}><Trash2 size={17} /><span>Trash</span></button>
          </nav>
        </aside>
      )}

      {composeOpen ? (
        <main className="compose-page">
          <header className="compose-topbar">
            <button className="compose-back" onClick={closeCompose} aria-label="Back to inbox"><ArrowLeft size={23} /><span>Compose New Email</span></button>
            <div className="compose-actions">
              <label className="icon-button attachment-trigger compose-upload" title={`Attach files${attachments.length ? ` (${attachments.length})` : ''}`} aria-label={`Attach files${attachments.length ? `, ${attachments.length} selected` : ''}`}><Upload size={19} />{attachments.length > 0 && <span className="attachment-count">{attachments.length}</span>}<input type="file" multiple onChange={(event) => void handleAttachments(event)} /></label>
              <button className={`icon-button schedule-trigger ${scheduleOpen ? 'is-open' : ''}`} onClick={() => setScheduleOpen((open) => !open)} title="Choose send time" aria-label="Choose send time"><Clock3 size={20} /></button>
              <button className="send-button" type="submit" form="compose-form" disabled={scheduleBusy}>{scheduleBusy ? 'Scheduling…' : new Date(startTime).getTime() > Date.now() + 60_000 ? 'Send Later' : 'Send'}</button>
              {scheduleOpen && (
                <section className="schedule-popover" aria-label="Send later options">
                  <h2>Send Later</h2>
                  <label className="schedule-date"><input type="datetime-local" min={localDateTime(new Date(Date.now() + 60_000))} value={startTime} onChange={(event) => setStartTime(event.target.value)} /><CalendarDays size={16} /></label>
                  <div className="schedule-presets">
                    {tomorrowOptions.map((option) => <button type="button" key={option.label} onClick={() => setStartTime(option.value)}>{option.label}</button>)}
                  </div>
                  <div className="schedule-actions"><button type="button" onClick={() => setScheduleOpen(false)}>Cancel</button><button type="button" className="done-button" onClick={() => setScheduleOpen(false)}>Done</button></div>
                </section>
              )}
            </div>
          </header>
          <form id="compose-form" className="compose-form" onSubmit={(event) => void createCampaign(event)}>
            <div className="compose-row from-row">
              <label htmlFor="sender">From</label>
              <div className="compose-field"><select id="sender" value={senderId} onChange={(event) => setSenderId(event.target.value)}><option value="">Select sender</option>{senders.map((sender) => <option key={sender.id} value={sender.id}>{sender.email}</option>)}</select><ChevronDown size={14} /></div>
              <button type="button" className="inline-add-sender" onClick={() => { setScheduleOpen(false); setSenderOpen(true); }}>Add sender</button>
            </div>
            <div className="compose-row to-row">
              <label htmlFor="recipient-draft">To</label>
              <div className="recipient-field">
                <div className="recipient-chip-list">
                  {recipients.slice(0, 3).map((recipient) => <span className="recipient-chip" key={recipient}>{recipient}<button type="button" onClick={() => setRecipients((current) => current.filter((item) => item !== recipient))} aria-label={`Remove ${recipient}`}><X size={11} /></button></span>)}
                  {recipients.length > 3 && <span className="recipient-overflow">+{recipients.length - 3}</span>}
                  <input id="recipient-draft" type="text" value={recipientDraft} placeholder={recipients.length ? '' : 'recipient@example.com'} onChange={(event) => setRecipientDraft(event.target.value)} onBlur={addDraftRecipients} onKeyDown={handleRecipientKeyDown} />
                </div>
                <label className="upload-list"><Upload size={15} /><span>Upload List</span><input type="file" accept=".csv,.txt,text/plain,text/csv" onChange={(event) => void handleLeadFile(event)} /></label>
              </div>
            </div>
            {leadFileName && <div className="upload-caption">{leadFileName} · {recipients.length} recipients loaded</div>}
            <div className="compose-row subject-row"><label htmlFor="subject">Subject</label><input id="subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" required /></div>
            <div className="sending-limits">
              <label>Delay between 2 emails<input type="number" min="0" max="3600" step="1" required value={delaySeconds} onChange={(event) => setDelaySeconds(event.target.value)} aria-label="Delay between emails, in seconds" /></label>
              <label>Hourly Limit<input type="number" min="1" max="10000" step="1" required value={hourlyLimit} onChange={(event) => setHourlyLimit(event.target.value)} aria-label="Hourly limit" /></label>
            </div>
            <div className="editor-shell">
              <div className="editor-toolbar" aria-label="Text formatting">
                <button type="button" title="Undo" onMouseDown={(event) => event.preventDefault()} onClick={() => applyFormat('undo')}>↶</button><button type="button" title="Redo" onMouseDown={(event) => event.preventDefault()} onClick={() => applyFormat('redo')}>↷</button><i />
                <select aria-label="Font size" title="Font size" defaultValue="" onChange={(event) => { if (event.target.value) applyFormat('fontSize', event.target.value); event.target.value = ''; }}><option value="" disabled>Text</option><option value="2">12</option><option value="3">14</option><option value="4">16</option><option value="5">18</option><option value="6">24</option></select>
                <button type="button" title="Bold" aria-label="Bold" aria-pressed={!!activeFormats.bold} className={activeFormats.bold ? 'is-active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => applyFormat('bold')}><Bold size={16} /></button><button type="button" title="Italic" aria-label="Italic" aria-pressed={!!activeFormats.italic} className={activeFormats.italic ? 'is-active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => applyFormat('italic')}><Italic size={16} /></button><button type="button" title="Underline" aria-label="Underline" aria-pressed={!!activeFormats.underline} className={activeFormats.underline ? 'is-active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => applyFormat('underline')}><Underline size={16} /></button><button type="button" title="Strikethrough" aria-label="Strikethrough" aria-pressed={!!activeFormats.strikeThrough} className={activeFormats.strikeThrough ? 'is-active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => applyFormat('strikeThrough')}><Strikethrough size={16} /></button><i />
                <button type="button" title="Align left" aria-label="Align left" aria-pressed={!!activeFormats.justifyLeft} className={activeFormats.justifyLeft ? 'is-active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => applyFormat('justifyLeft')}>≡</button><button type="button" title="Align center" aria-label="Align center" aria-pressed={!!activeFormats.justifyCenter} className={activeFormats.justifyCenter ? 'is-active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => applyFormat('justifyCenter')}>☰</button><button type="button" title="Align right" aria-label="Align right" aria-pressed={!!activeFormats.justifyRight} className={activeFormats.justifyRight ? 'is-active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => applyFormat('justifyRight')}>≣</button><i />
                <button type="button" title="Numbered list" aria-label="Numbered list" aria-pressed={!!activeFormats.insertOrderedList} className={activeFormats.insertOrderedList ? 'is-active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => applyFormat('insertOrderedList')}>1.</button><button type="button" title="Bulleted list" aria-label="Bulleted list" aria-pressed={!!activeFormats.insertUnorderedList} className={activeFormats.insertUnorderedList ? 'is-active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => applyFormat('insertUnorderedList')}>•</button><button type="button" title="Outdent" onMouseDown={(event) => event.preventDefault()} onClick={() => applyFormat('outdent')}>⇤</button><button type="button" title="Indent" onMouseDown={(event) => event.preventDefault()} onClick={() => applyFormat('indent')}>⇥</button><button type="button" title="Quote" onMouseDown={(event) => event.preventDefault()} onClick={() => applyFormat('formatBlock', 'blockquote')}>❞</button><button type="button" title="Insert link" onMouseDown={(event) => event.preventDefault()} onClick={() => { const url = window.prompt('Link URL'); if (url && /^https?:\/\//i.test(url)) applyFormat('createLink', url); }}>↗</button>
              </div>
              <div className="editor-input" ref={editorRef} contentEditable role="textbox" aria-label="Email message" aria-multiline="true" data-placeholder="Type Your Reply..." onFocus={(event) => event.currentTarget.scrollIntoView({ block: 'end', inline: 'nearest', behavior: 'smooth' })} onInput={(event) => { setBody(event.currentTarget.innerHTML); syncFormattingState(); }} onPaste={(event) => { event.preventDefault(); const text = event.clipboardData.getData('text/plain'); document.execCommand('insertText', false, text); }} />
            </div>
            {attachments.length > 0 && <section className="compose-attachments" aria-label={`${attachments.length} attachments`}>{attachmentPreviews.map(({ file, url }, index) => <article className={`compose-attachment ${url ? 'compose-image' : ''}`} key={`${file.name}-${index}`}>{url ? <img src={url} alt={`Preview of ${file.name}`} /> : <span className="attachment-file-icon" aria-hidden="true">{file.type === 'application/pdf' ? 'PDF' : file.name.split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE'}</span>}<div className="compose-attachment-meta"><strong title={file.name}>{file.name}</strong><small>{formatFileSize(file.size)}</small></div><button type="button" aria-label={`Remove ${file.name}`} onClick={() => { setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index)); notify('Attachment removed.'); }}><X size={14} /></button></article>)}</section>}
          </form>
          {notice && <div className="floating-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={14} /></button></div>}
        </main>
      ) : selectedEmail ? (
        <main className="message-page">
          <header className="message-topbar">
            <button className="message-back" onClick={() => setSelectedEmail(null)} aria-label="Back to inbox"><ArrowLeft size={24} /></button>
            <h1>{selectedEmail.subject || '(no subject)'}<span className="message-id"><span aria-hidden="true"> | </span><strong>{selectedEmail.id}</strong></span></h1>
            <div className="message-tools"><button disabled={actionBusy} className={selectedEmail.isStarred ? 'star-active' : ''} title={selectedEmail.isStarred ? 'Unstar' : 'Star'} aria-label={selectedEmail.isStarred ? 'Unstar email' : 'Star email'} onClick={() => void changeEmail(selectedEmail, 'star')}><Star size={20} fill={selectedEmail.isStarred ? 'currentColor' : 'none'} /></button>{emailFilter === 'trash' ? <><button disabled={actionBusy} title="Restore" aria-label="Restore email" onClick={() => void changeEmail(selectedEmail, 'restore')}><RotateCcw size={18} /></button><button disabled={actionBusy} title="Delete permanently" aria-label="Delete permanently" onClick={() => void changeEmail(selectedEmail, 'permanent-delete')}><Trash2 size={19} /></button></> : <><button disabled={actionBusy} title={selectedEmail.isArchived ? 'Unarchive' : 'Archive'} aria-label={selectedEmail.isArchived ? 'Unarchive email' : 'Archive email'} onClick={() => void changeEmail(selectedEmail, selectedEmail.isArchived ? 'unarchive' : 'archive')}><Archive size={19} /></button><button disabled={actionBusy} title="Move to Trash" aria-label="Move to Trash" onClick={() => void changeEmail(selectedEmail, 'delete')}><Trash2 size={19} /></button></>}</div>
          </header>
          <article className="message-content">
            <div className="message-heading"><div className="sender-avatar">{(selectedEmail.sender?.displayName || selectedEmail.sender?.email || 'S').slice(0, 1).toUpperCase()}</div><div className="sender-lines"><strong>{selectedEmail.sender?.displayName || selectedEmail.sender?.email || 'Sender'}</strong><span>&lt;{selectedEmail.sender?.email || '—'}&gt;</span><small>to {selectedEmail.recipient}</small></div><time>{formatMessageDate(selectedEmail.sentAt || selectedEmail.scheduledAt)}</time></div>
            <div className="message-body">{selectedEmail.body}</div>
            {!!selectedEmail.campaign?.attachments?.length && <section className="message-attachments" aria-label="Attachments">{selectedEmail.campaign.attachments.map((file) => {
              const url = `${API}/api/emails/${selectedEmail.id}/attachments/${file.id}`;
              const image = file.contentType.startsWith('image/');
              return image
                ? <a className="message-attachment image-attachment" key={file.id} href={url} target="_blank" rel="noreferrer" aria-label={`Open ${file.filename}`}><img src={url} alt={file.filename} crossOrigin="use-credentials" /><span className="attachment-metadata"><strong>{file.filename}</strong>{file.size != null && <small>{formatFileSize(file.size)}</small>}</span></a>
                : <a className="message-attachment file-attachment" key={file.id} href={url} download={file.filename}><span className="attachment-file-icon" aria-hidden="true">{file.contentType === 'application/pdf' ? 'PDF' : 'FILE'}</span><span className="attachment-metadata"><strong>{file.filename}</strong>{file.size != null && <small>{formatFileSize(file.size)}</small>}</span></a>;
            })}</section>}
          </article>
        </main>
      ) : (
        <main className="inbox-page">
          <header className="inbox-toolbar">
            <label className="inbox-search"><Search size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setResults(null); searchGenerationRef.current += 1; }} onKeyDown={(event) => event.key === 'Enter' && void find()} placeholder="Search" /><button type="button" className="search-submit" onClick={() => void find()} aria-label="Search"><Search size={15} /></button></label>
            <div className="toolbar-buttons">
              <select className="date-filter" aria-label="Filter by date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}><option value="all">All dates</option><option value="today">Today</option>{emailFilter !== 'all' || tab === 'sent' ? <option value="yesterday">Yesterday</option> : null}<option value="7d">Last 7 days</option>{tab === 'sent' && <option value="30d">Last 30 days</option>}{tab === 'scheduled' && <><option value="tomorrow">Tomorrow</option><option value="24h">Next 24 hours</option><option value="week">This week</option></>}{tab === 'sent' && <><option value="1h">Last hour</option><option value="3h">Last 3 hours</option><option value="6h">Last 6 hours</option><option value="12h">Last 12 hours</option></>}</select>
              <div className="filter-anchor"><button className={`toolbar-icon ${filterOpen ? 'selected' : ''}`} title="Filter messages" aria-label="Filter messages" aria-expanded={filterOpen} onClick={() => setFilterOpen((open) => !open)}><Filter size={17} /></button>{filterOpen && <div className="filter-menu" role="menu">{(['all', 'starred', 'archived', 'trash'] as const).map((value) => <button role="menuitem" aria-pressed={emailFilter === value} key={value} onClick={() => { setEmailFilter(value); setCurrentPage(1); setFilterOpen(false); }}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>}</div>
              <button className="toolbar-icon" title="Refresh" aria-label="Refresh inbox" onClick={() => { setResults(null); void loadEmails(currentPage); }}><RefreshCw size={17} /></button>
            </div>
          </header>
          {notice && <div className="inbox-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={14} /></button></div>}
          {error && <div className="inbox-error" role="alert">{error}<button onClick={() => void loadEmails(currentPage)}>Retry</button></div>}
          <div className="list-controls"><label className="select-page"><input type="checkbox" aria-label="Select all emails on this page" checked={visibleEmails.length > 0 && selectedIds.length === visibleEmails.length} onChange={(event) => setSelectedIds(event.target.checked ? visibleEmails.map((email) => email.id) : [])} />Select page</label>{selectedIds.length > 0 && <div className="bulk-toolbar"><strong>{selectedIds.length} selected</strong>{emailFilter === 'trash' ? <><button onClick={() => void bulkAction('restore')}><RotateCcw size={15} />Restore</button><button className="danger-action" onClick={() => void bulkAction('permanent-delete')}><Trash2 size={15} />Delete permanently</button></> : <><button onClick={() => void bulkAction(emailFilter === 'archived' ? 'unarchive' : 'archive')}><Archive size={15} />{emailFilter === 'archived' ? 'Unarchive' : 'Archive'}</button><button onClick={() => void bulkAction(selectedIds.every((id) => emails.find((email) => email.id === id)?.isStarred) ? 'unstar' : 'star')}><Star size={15} />{selectedIds.every((id) => emails.find((email) => email.id === id)?.isStarred) ? 'Unstar' : 'Star'}</button><button onClick={() => void bulkAction('trash')}><Trash2 size={15} />Trash</button></>}{actionBusy && <LoaderCircle className="spin" size={15} />}</div>}</div>
          <section className="email-list" aria-label={emailFilter === 'trash' ? 'Trashed emails' : emailFilter === 'archived' ? 'Archived emails' : emailFilter === 'starred' ? 'Starred emails' : tab === 'scheduled' ? 'Scheduled emails' : 'Sent emails'}>
            {visibleEmails.map((email) => (
              <article className="email-row" key={email.id} tabIndex={0} aria-label={`Open email to ${email.recipient}: ${email.subject || 'no subject'}`} onClick={() => setSelectedEmail(email)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setSelectedEmail(email); } }}>
                <input className="row-checkbox" type="checkbox" checked={selectedIds.includes(email.id)} aria-label={`Select ${email.subject || email.recipient}`} onClick={(event) => event.stopPropagation()} onChange={(event) => setSelectedIds((ids) => event.target.checked ? [...ids, email.id] : ids.filter((id) => id !== email.id))} />
                <span className="email-recipient">To: {email.recipient}</span>
                {email.status === 'scheduled' || email.status === 'processing' ? <span className="scheduled-badge"><Clock3 size={13} />{formatScheduled(email.scheduledAt)}</span> : <span className={`sent-badge ${email.status === 'failed' ? 'failed' : ''}`}>{email.status === 'failed' ? 'Failed' : 'Sent'}</span>}
                <span className="email-summary"><strong>{email.subject || '(no subject)'}</strong><span> - {email.body?.replace(/\s+/g, ' ').trim()}</span></span>
                {emailFilter === 'trash' ? <span className="trash-row-actions"><button type="button" title="Restore" aria-label="Restore email" onClick={(event) => { event.stopPropagation(); void changeEmail(email, 'restore'); }}><RotateCcw size={15} /></button><button type="button" title="Delete permanently" aria-label="Delete permanently" onClick={(event) => { event.stopPropagation(); void changeEmail(email, 'permanent-delete'); }}><Trash2 size={15} /></button></span> : <button type="button" className={`row-star ${email.isStarred ? 'active' : ''}`} title={email.isStarred ? 'Unstar' : 'Star'} aria-label={email.isStarred ? 'Unstar email' : 'Star email'} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void changeEmail(email, 'star'); }}><Star size={18} fill={email.isStarred ? 'currentColor' : 'none'} /></button>}
              </article>
            ))}
            {!visibleEmails.length && <div className="inbox-empty">{search.trim() ? 'No matching emails.' : emailFilter === 'starred' ? 'No starred emails yet.' : emailFilter === 'archived' ? 'No archived emails yet.' : emailFilter === 'trash' ? 'Trash is empty.' : `No ${tab} emails yet.`}</div>}
            <nav className="pagination" aria-label="Email pages"><span>Showing {pageInfo.totalCount ? `${(pageInfo.currentPage - 1) * pageInfo.pageSize + 1}–${Math.min(pageInfo.currentPage * pageInfo.pageSize, pageInfo.totalCount)}` : '0'} of {pageInfo.totalCount}</span><div><button disabled={!pageInfo.hasPreviousPage || loading} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}><ChevronLeft size={16} />Previous</button>{Array.from({ length: Math.min(pageInfo.totalPages, 5) }, (_, index) => { const first = Math.max(1, Math.min(currentPage - 2, pageInfo.totalPages - 4)); const page = first + index; return <button key={page} className={page === currentPage ? 'page-active' : ''} aria-current={page === currentPage ? 'page' : undefined} onClick={() => setCurrentPage(page)}>{page}</button>; })}<button disabled={!pageInfo.hasNextPage || loading} onClick={() => setCurrentPage((page) => page + 1)}>Next<ChevronRight size={16} /></button></div></nav>
          </section>
        </main>
      )}

      {senderOpen && (
        <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSenderOpen(false)}>
          <form className="sender-dialog" onSubmit={(event) => void createSender(event)}>
            <div className="dialog-title"><h2>Add sender</h2><button type="button" onClick={() => setSenderOpen(false)} aria-label="Close"><X size={18} /></button></div>
            <label>Display name<input name="displayName" placeholder="Your name" required /></label>
            <label>Email address<input name="email" type="email" placeholder="sender@example.com" required /></label>
            <button className="dialog-submit" disabled={senderBusy}><Check size={15} />{senderBusy ? 'Adding…' : 'Add sender'}</button>
          </form>
        </div>
      )}
      {passwordOpen && <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setPasswordOpen(false)}><form className="sender-dialog password-dialog" onSubmit={(event) => void setAccountPassword(event)}><div className="dialog-title"><h2>Set email password</h2><button type="button" onClick={() => setPasswordOpen(false)} aria-label="Close"><X size={18} /></button></div><label>New password<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label><label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label><button className="dialog-submit" disabled={passwordBusy}>{passwordBusy ? 'Saving…' : 'Save password'}</button></form></div>}
      {toast && <div className="app-toast" role="status">{toast}<button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={14} /></button></div>}
    </div>
  );
}

function Avatar({ user }: { user: User }) {
  const [failed, setFailed] = useState(false);
  return user.avatarUrl && !failed
    ? <img className="account-avatar" src={user.avatarUrl} alt="" onError={() => setFailed(true)} />
    : <span className="account-avatar avatar-fallback" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>;
}
