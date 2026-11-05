import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  Archive, ArrowDownToLine, Bell, CheckCheck, ChevronDown,
  ChevronRight, CircleHelp, File, FileText, Image, Info, LockKeyhole, LogOut,
  MoreHorizontal, Paperclip, Plus, Search, Send, Settings, ShieldCheck,
  Smile, Users, Video, X,
} from 'lucide-react';
import AuthScreen, { type Session } from './AuthScreen';
import { apiFile, apiRequest, type ApiConversation, type ApiMessage, type ApiUser } from './services/api';

type UiFile = { id: string; name: string; size: string; mimeType: string | null; kind: 'pdf' | 'image' | 'file' };
type Message = { id: string; from: 'me' | 'them'; senderId?: string; text?: string; time: string; file?: UiFile };
type Chat = { id: string; name: string; handle: string; memberId?: string; avatar: string; color: string; online: boolean; unread: number; preview: string; time: string; messages: Message[] };

const navItems = [
  { id: 'chats', label: 'Messages', icon: Search },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'files', label: 'Shared files', icon: Archive },
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [activeNav, setActiveNav] = useState('chats');
  const [query, setQuery] = useState('');
  const [messageQuery, setMessageQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [notice, setNotice] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [people, setPeople] = useState<ApiUser[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const [loadingChats, setLoadingChats] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const visibleChats = useMemo(() => chats.filter((chat) => `${chat.name} ${chat.preview}`.toLowerCase().includes(query.toLowerCase())), [chats, query]);
  const activeChat = chats.find((chat) => chat.id === selectedId) ?? chats[0] ?? { id: '', name: 'Your messages', handle: '', avatar: session?.user.displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() ?? 'LS', color: 'mint', online: false, unread: 0, preview: '', time: '', messages: [] };
  const allFiles = chats.flatMap((chat) => chat.messages.filter((message) => message.file).map((message) => ({ chat, message })));

  function mapMessage(message: ApiMessage, userId: string): Message {
    const attachment = message.attachments?.[0];
    const bytes = Number(attachment?.fileSize ?? 0);
    const size = bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
    const mimeType = attachment?.mimeType ?? null;
    return { id: message.id, senderId: message.senderId, from: message.senderId === userId ? 'me' : 'them', text: attachment ? undefined : message.content ?? '', time: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), ...(attachment ? { file: { id: attachment.id, name: attachment.fileName, size, mimeType, kind: mimeType === 'application/pdf' ? 'pdf' as const : mimeType?.startsWith('image/') ? 'image' as const : 'file' as const } } : {}) };
  }

  function mapConversation(conversation: ApiConversation): Chat {
    const other = conversation.members.find((member) => member.id !== session?.user.id);
    const last = conversation.lastMessage;
    const initials = (conversation.name ?? other?.displayName ?? other?.username ?? 'Chat').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    return { id: conversation.id, memberId: other?.id, name: conversation.name ?? other?.displayName ?? other?.username ?? 'Conversation', handle: other ? `@${other.username}` : 'Group conversation', avatar: initials, color: ['peach', 'lilac', 'blue', 'mint'][initials.charCodeAt(0) % 4], online: other?.status === 'online', unread: 0, preview: last ? `${last.sender.displayName || last.sender.username}: ${last.content ?? 'Attachment'}` : 'Start a conversation', time: last ? new Date(last.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '', messages: [] };
  }

  async function loadConversations(token = session?.accessToken) {
    if (!token) return;
    setLoadingChats(true);
    try {
      const result = await apiRequest<{ conversations: ApiConversation[] }>('/api/conversations', token);
      const mapped = result.conversations.map(mapConversation);
      setChats(mapped);
      setSelectedId((current) => mapped.some((chat) => chat.id === current) ? current : mapped[0]?.id ?? '');
      mapped.forEach((chat) => socketRef.current?.emit('conversation:join', { conversationId: chat.id }));
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not load conversations.'); }
    finally { setLoadingChats(false); }
  }

  useEffect(() => {
    if (!session) return;
    void loadConversations(session.accessToken);
    const socket = io(import.meta.env.VITE_API_URL ?? 'http://localhost:3001', { auth: { token: session.accessToken }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect_error', () => setNotice('Live connection was interrupted. Retrying…'));
    socket.on('message:new', (message: ApiMessage) => {
      const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const mappedMessage = mapMessage(message, session.user.id);
      setChats((current) => current.map((chat) => chat.id !== message.conversationId ? chat : { ...chat, preview: `${message.sender.displayName || message.sender.username}: ${mappedMessage.file?.name ?? message.content ?? 'Attachment'}`, time, messages: chat.messages.some((item) => item.id === message.id) ? chat.messages : [...chat.messages, mappedMessage] }));
    });
    socket.on('conversation:new', (payload: { conversationId: string }) => { socket.emit('conversation:join', payload); void loadConversations(session.accessToken); });
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [session?.accessToken]);

  useEffect(() => {
    if (!session || !selectedId) return;
    let cancelled = false;
    void apiRequest<{ messages: ApiMessage[] }>(`/api/conversations/${selectedId}/messages?limit=60`, session.accessToken).then(({ messages }) => {
      if (cancelled) return;
      const mapped = messages.map((message) => mapMessage(message, session.user.id));
      setChats((current) => current.map((chat) => chat.id === selectedId ? { ...chat, messages: mapped } : chat));
    }).catch((error: unknown) => { if (!cancelled) setNotice(error instanceof Error ? error.message : 'Could not load message history.'); });
    return () => { cancelled = true; };
  }, [session?.accessToken, selectedId]);

  useEffect(() => {
    if (!session || peopleQuery.trim().length < 2) { setPeople([]); return; }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void apiRequest<{ users: ApiUser[] }>(`/api/users/search?q=${encodeURIComponent(peopleQuery.trim())}`, session.accessToken).then(({ users }) => { if (!cancelled) setPeople(users); }).catch(() => { if (!cancelled) setPeople([]); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [peopleQuery, session?.accessToken]);

  function updateChat(chatId: string, updater: (chat: Chat) => Chat) {
    setChats((current) => current.map((chat) => chat.id === chatId ? updater(chat) : chat));
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const value = draft.trim();
    if (!value || !activeChat.id || !session) return;
    const clientMessageId = crypto.randomUUID();
    try {
      const { message } = await apiRequest<{ message: ApiMessage }>(`/api/conversations/${activeChat.id}/messages`, session.accessToken, { method: 'POST', body: JSON.stringify({ content: value, clientMessageId }) });
      const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      updateChat(activeChat.id, (chat) => ({ ...chat, preview: `You: ${value}`, time, messages: chat.messages.some((item) => item.id === message.id) ? chat.messages : [...chat.messages, { id: message.id, senderId: session.user.id, from: 'me', text: value, time }] }));
      setDraft('');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Message could not be sent.'); }
  }

  async function downloadFile(file: UiFile) {
    if (!session) return;
    try {
      const blob = await apiFile(`/api/files/${file.id}/download`, session.accessToken);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.name; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not download the file.'); }
  }

  async function previewFileContent(file: UiFile) {
    if (!session) return;
    if (file.kind === 'file') { await downloadFile(file); return; }
    try {
      const blob = await apiFile(`/api/files/${file.id}/download?preview=true`, session.accessToken);
      if (previewFile?.url) URL.revokeObjectURL(previewFile.url);
      setPreviewFile({ name: file.name, url: URL.createObjectURL(blob) });
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not preview the file.'); }
  }

  function attachFiles(files: FileList | null) {
    if (!files?.length) return;
    if (!session || !activeChat.id) return;
    const selected = Array.from(files);
    if (selected.some((file) => file.size > 25 * 1024 * 1024)) { setNotice('Each file must be 25 MB or smaller.'); return; }
    void (async () => {
      for (const file of selected) {
        const form = new FormData(); form.append('file', file);
        try {
          const result = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/api/conversations/${activeChat.id}/files`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
              'Bypass-Tunnel-Reminder': 'true',
              'ngrok-skip-browser-warning': 'true',
            },
            body: form,
          });
          if (!result.ok) { const error = await result.json().catch(() => ({})) as { error?: string }; throw new Error(error.error ?? `Upload failed (${result.status})`); }
          const body = await result.json() as { message: ApiMessage };
          const message = mapMessage(body.message, session.user.id);
          updateChat(activeChat.id, (chat) => ({ ...chat, preview: `You: ${message.file?.name ?? file.name}`, time: message.time, messages: chat.messages.some((item) => item.id === message.id) ? chat.messages : [...chat.messages, message] }));
        } catch (error) { setNotice(error instanceof Error ? error.message : `Could not upload ${file.name}.`); break; }
      }
    })();
    if (fileRef.current) fileRef.current.value = '';
  }

  function startNewChat() {
    setPeopleQuery(''); setPeople([]); setShowNewChat(true);
  }

  async function openConversation(user: ApiUser) {
    if (!session) return;
    try {
      const result = await apiRequest<{ conversationId: string }>('/api/conversations', session.accessToken, { method: 'POST', body: JSON.stringify({ userId: user.id }) });
      socketRef.current?.emit('conversation:join', { conversationId: result.conversationId });
      setSelectedId(result.conversationId); setActiveNav('chats'); setShowNewChat(false);
      await loadConversations(session.accessToken);
      setSelectedId(result.conversationId);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not start conversation.'); }
  }

  function selectChat(id: string) {
    setSelectedId(id);
    updateChat(id, (chat) => ({ ...chat, unread: 0 }));
  }

  async function signOut() {
    if (session) await apiRequest('/api/auth/logout', session.accessToken, { method: 'POST' }).catch(() => undefined);
    socketRef.current?.disconnect(); setSession(null); setChats([]); setSelectedId('');
  }

  function windowControl(action: 'minimize' | 'maximize' | 'close') {
    void window.chaty?.windowControl(action);
  }

  if (!session) return <AuthScreen onLogin={setSession} />;

  return (
    <div className="app-shell">
      <div className="titlebar"><div className="window-brand"><span className="brand-mark small"><LockKeyhole size={13} strokeWidth={2.4} /></span><span>Chaty</span><span className="titlebar-divider">/</span><span className="titlebar-sub">Messenger</span></div><div className="window-actions"><span className="local-chip"><span /> Chaty Messenger</span><button aria-label="Minimize" onClick={() => windowControl('minimize')} className="window-control">−</button><button aria-label="Maximize" onClick={() => windowControl('maximize')} className="window-control">□</button><button aria-label="Close" onClick={() => windowControl('close')} className="window-control close">×</button></div></div>
      <div className="workspace">
        <aside className="rail">
          <button className="brand-mark" aria-label="Chaty home"><LockKeyhole size={18} strokeWidth={2.4} /></button>
          <div className="rail-main">{navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setActiveNav(id)} className={`rail-button ${activeNav === id ? 'active' : ''}`} title={label}><Icon size={19} strokeWidth={1.8} /><span className="rail-label">{label}</span>{id === 'chats' && <i className="rail-dot" />}</button>)}</div>
          <div className="rail-bottom"><button className="rail-button" title="Help" onClick={() => setNotice('Chaty connects to the server configured for this app.')}><CircleHelp size={19} /></button><button className="rail-button" title="Settings" onClick={() => setNotice('Settings will be available after account setup.')}><Settings size={19} /></button><div className="rail-avatar" onClick={() => setProfileOpen(!profileOpen)} role="button" tabIndex={0} aria-label="Open profile">{session.user.displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}<span /></div></div>
        </aside>

        <section className="conversation-list">
          <div className="list-header"><div><p className="eyebrow">YOUR SPACE</p><h1>{activeNav === 'chats' ? 'Messages' : activeNav === 'contacts' ? 'Contacts' : 'Shared files'}</h1></div><button className="icon-button add-chat" onClick={startNewChat} title="New message"><Plus size={18} /></button></div>
          {activeNav !== 'files' && <div className="list-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={activeNav === 'contacts' ? 'Find a contact' : 'Search messages'} /><kbd>⌘ K</kbd></div>}
          {activeNav === 'chats' && <>
            <div className="list-section-heading"><span>Recent</span><button onClick={() => setNotice('Your conversations are up to date.')}>View all</button></div>
            <div className="chat-list">{visibleChats.map((chat) => <button key={chat.id} onClick={() => selectChat(chat.id)} className={`chat-row ${chat.id === selectedId ? 'selected' : ''}`}><Avatar chat={chat} /><div className="chat-copy"><div className="chat-row-top"><strong>{chat.name}</strong><time>{chat.time}</time></div><div className="chat-row-bottom"><span>{chat.preview}</span>{chat.unread > 0 && <i>{chat.unread}</i>}</div></div></button>)}{visibleChats.length === 0 && <div className="empty-small">{loadingChats ? 'Loading conversations…' : 'No conversations yet. Start a message to find someone.'}</div>}</div>
            <div className="list-footer"><ShieldCheck size={15} /><span>Your conversations stay private</span><ChevronRight size={14} /></div>
          </>}
          {activeNav === 'contacts' && <div className="contact-list">{visibleChats.map((chat) => <button key={chat.id} className="contact-row" onClick={() => { selectChat(chat.id); setActiveNav('chats'); }}><Avatar chat={chat} /><span><strong>{chat.name}</strong><small>{chat.online ? 'Online now' : chat.handle}</small></span><ChevronRight size={16} /></button>)}<button className="invite-card" onClick={startNewChat}><span className="invite-icon"><Plus size={17} /></span><span><strong>Start a conversation</strong><small>Find someone on Chaty</small></span></button></div>}
          {activeNav === 'files' && <div className="files-list">{allFiles.map(({ chat, message }) => <button key={message.id} className="shared-file-row" onClick={() => { selectChat(chat.id); setActiveNav('chats'); }}><FileCard file={message.file!} compact /><span className="file-row-copy"><strong>{message.file!.name}</strong><small>{chat.name} · {message.time}</small></span><ArrowDownToLine size={16} /></button>)}{allFiles.length === 0 && <div className="empty-small">Files shared in your chats will appear here.</div>}</div>}
          <div className="account-card"><div className="account-avatar">{session.user.displayName.slice(0, 1).toUpperCase()}</div><div className="account-copy"><strong>{session.user.displayName}</strong><span>@{session.user.username}</span></div><button onClick={() => setProfileOpen(!profileOpen)} aria-label="Account menu"><MoreHorizontal size={19} /></button>{profileOpen && <div className="profile-popover"><div className="profile-popover-heading"><strong>{session.user.displayName}</strong><small>{session.user.username}</small></div><button onClick={() => setNotice('Profile editing will be added next.')}><Settings size={15} /> Profile settings</button><button onClick={() => void signOut()}><LogOut size={15} /> Sign out</button></div>}</div>
        </section>

        <main className="chat-panel">
          <header className="chat-header"><div className="chat-person"><Avatar chat={activeChat} large /><div className="chat-person-copy"><div className="chat-name-line"><h2>{activeChat.name}</h2><span className={`presence-label ${activeChat.online ? 'online' : ''}`}><i />{activeChat.online ? 'Online' : activeChat.handle}</span></div><p>{activeChat.id ? activeChat.online ? 'Usually replies within a few minutes' : 'Private conversation' : 'Find a person to start messaging'}</p></div></div><div className="chat-actions"><button className="icon-button" aria-label="Search in conversation" onClick={() => { setSearchOpen(!searchOpen); setTimeout(() => inputRef.current?.focus(), 0); }}><Search size={18} /></button><button className="icon-button" aria-label="Start video call" onClick={() => setNotice('Calls are not included in the first Chaty release.')}><Video size={18} /></button><span className="action-separator" /><button className={`icon-button ${detailsOpen ? 'pressed' : ''}`} aria-label="Toggle chat details" onClick={() => setDetailsOpen(!detailsOpen)}><Info size={18} /></button><button className="icon-button" aria-label="More chat actions" onClick={() => setNotice('Conversation actions will be available when accounts are connected.')}><MoreHorizontal size={20} /></button></div></header>
          {searchOpen && <div className="chat-search"><Search size={16} /><input ref={inputRef} value={messageQuery} placeholder={`Search in ${activeChat.name}`} onChange={(event) => setMessageQuery(event.target.value)} /><button onClick={() => { setSearchOpen(false); setMessageQuery(''); }}><X size={15} /></button></div>}
          <div className="date-divider"><span /> <p>{new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</p> <span /></div>
          <div className="message-scroll" key={activeChat.id}>
            {activeChat.messages.filter((message) => !messageQuery || (message.text ?? message.file?.name ?? '').toLowerCase().includes(messageQuery.toLowerCase())).map((message, index, displayed) => {
              const previous = displayed[index - 1];
              const grouped = previous?.from === message.from;
              return <div key={message.id} className={`message-line ${message.from === 'me' ? 'mine' : ''} ${grouped ? 'grouped' : ''}`}>
                {message.from === 'them' && !grouped ? <Avatar chat={activeChat} tiny /> : message.from === 'them' ? <div className="avatar-spacer" /> : null}
                <div className="message-content">{message.file ? <FileAttachment file={message.file} onClick={() => void previewFileContent(message.file!)} onDownload={() => void downloadFile(message.file!)} /> : <div className="bubble">{message.text}</div>}<div className="message-meta"><time>{message.time}</time>{message.from === 'me' && <CheckCheck size={14} className="read-check" />}</div></div>
              </div>;
            })}
            {activeChat.messages.length === 0 && <div className="first-message"><div className="first-icon"><Smile size={21} /></div><h3>{activeChat.id ? `Say hello to ${activeChat.name.split(' ')[0]}` : 'Your private messages'}</h3><p>{activeChat.id ? 'This is the start of your conversation.' : 'Start a conversation with someone on Chaty.'}</p>{!activeChat.id && <button className="empty-start-button" onClick={startNewChat}>Find people <ChevronRight size={15}/></button>}</div>}
          </div>
          <div className="composer-wrap"><form className="composer" onSubmit={sendMessage}><button type="button" className="composer-tool" title="Attach a file" onClick={() => fileRef.current?.click()} disabled={!activeChat.id}><Paperclip size={19} /></button><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={activeChat.id ? `Message ${activeChat.name.split(' ')[0]}…` : 'Start a conversation to send a message'} disabled={!activeChat.id} /><button type="button" className="composer-tool emoji-button" onClick={() => setDraft((text) => `${text}${text ? ' ' : ''}🙂`)} title="Add emoji"><Smile size={19} /></button><button type="submit" className="send-button" disabled={!draft.trim() || !activeChat.id} aria-label="Send message"><Send size={17} /></button></form><input ref={fileRef} className="hidden-input" type="file" multiple onChange={(event) => attachFiles(event.target.files)} /><div className="composer-hint"><span><kbd>Enter</kbd> to send</span><span>Private messages · files up to 25 MB</span></div></div>
        </main>

        {detailsOpen && <aside className="details-panel"><div className="details-head"><span>Details</span><button className="icon-button" onClick={() => setDetailsOpen(false)} aria-label="Close details"><X size={17} /></button></div><div className="details-profile"><Avatar chat={activeChat} profile /><h3>{activeChat.name}</h3><p>{activeChat.handle}</p><div className="profile-actions"><button onClick={() => setNotice('Desktop notifications are coming soon.')}><Bell size={16} /></button><button onClick={() => setNotice('Conversation controls are coming with account integration.')}><MoreHorizontal size={18} /></button></div></div><div className="details-divider" /><div className="details-section"><button className="details-section-title" onClick={() => setActiveNav('files')}><span>Shared files</span><span>{activeChat.messages.filter((message) => message.file).length}<ChevronDown size={14} /></span></button>{activeChat.messages.filter((message) => message.file).slice(-3).reverse().map((message) => <button key={message.id} className="detail-file" onClick={() => void previewFileContent(message.file!)}><FileCard file={message.file!} compact /><span><strong>{message.file!.name}</strong><small>{message.file!.size}</small></span></button>)}{activeChat.messages.every((message) => !message.file) && <p className="no-files">No shared files yet</p>}<button className="see-all" onClick={() => setActiveNav('files')}>See all files <ChevronRight size={14} /></button></div><div className="details-divider" /><button className="privacy-note" onClick={() => setNotice('Messages are stored on your Chaty server. Chaty is not end-to-end encrypted.')}><span className="privacy-icon"><LockKeyhole size={15} /></span><span><strong>Privacy matters</strong><small>Learn how Chaty protects your messages</small></span><ChevronRight size={15} /></button><div className="details-bottom"><button onClick={() => setNotice('Chaty connects to the server configured for this app.')}><Info size={15} /> About Chaty</button></div></aside>}
      </div>
      {notice && <div className="toast"><Info size={16} /><span>{notice}</span><button onClick={() => setNotice('')}><X size={15} /></button></div>}
      {showNewChat && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowNewChat(false); }}><div className="people-modal"><div className="people-modal-head"><div><p className="eyebrow">NEW CONVERSATION</p><h2>Find someone</h2></div><button className="icon-button" onClick={() => setShowNewChat(false)}><X size={17}/></button></div><div className="people-search"><Search size={16}/><input autoFocus value={peopleQuery} onChange={(event) => setPeopleQuery(event.target.value)} placeholder="Search by name or username"/><kbd>2+ chars</kbd></div><div className="people-results">{peopleQuery.trim().length < 2 ? <p>Enter at least two characters to search for people.</p> : people.length ? people.map((person) => <button key={person.id} className="person-result" onClick={() => void openConversation(person)}><div className="person-result-avatar">{person.displayName.slice(0, 1).toUpperCase()}</div><span><strong>{person.displayName}</strong><small>@{person.username} · {person.status}</small></span><ChevronRight size={16}/></button>) : <p>No matching accounts found.</p>}</div><div className="people-modal-foot"><ShieldCheck size={14}/> Conversations are private to their members.</div></div></div>}
      {previewFile && <div className="modal-backdrop preview-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { URL.revokeObjectURL(previewFile.url); setPreviewFile(null); } }}><div className="preview-modal"><div className="preview-head"><span><FileText size={17}/>{previewFile.name}</span><button className="icon-button" onClick={() => { URL.revokeObjectURL(previewFile.url); setPreviewFile(null); }} aria-label="Close preview"><X size={17}/></button></div>{previewFile.name.toLowerCase().endsWith('.pdf') ? <iframe title={previewFile.name} src={previewFile.url}/> : <img src={previewFile.url} alt={previewFile.name}/>}</div></div>}
    </div>
  );
}

function Avatar({ chat, large = false, tiny = false, profile = false }: { chat: Chat; large?: boolean; tiny?: boolean; profile?: boolean }) {
  return <div className={`avatar ${chat.color} ${large ? 'large' : ''} ${tiny ? 'tiny' : ''} ${profile ? 'profile' : ''}`}>{chat.avatar}{chat.online && !tiny && <i />}</div>;
}

function FileCard({ file, compact = false }: { file: NonNullable<Message['file']>; compact?: boolean }) {
  return <span className={`file-icon ${file.kind} ${compact ? 'compact' : ''}`}>{file.kind === 'pdf' ? <FileText size={compact ? 17 : 20} /> : file.kind === 'image' ? <Image size={compact ? 17 : 20} /> : <File size={compact ? 17 : 20} />}</span>;
}

function FileAttachment({ file, onClick, onDownload }: { file: UiFile; onClick: () => void; onDownload: () => void }) {
  return <div className="file-attachment"><button className="file-open" onClick={onClick}><FileCard file={file} /><span className="attachment-info"><strong>{file.name}</strong><small>{file.size} <i /> {file.kind === 'pdf' ? 'PDF document' : file.kind === 'image' ? 'Image' : 'File'}</small></span></button><button className="file-download" aria-label={`Download ${file.name}`} onClick={onDownload}><ArrowDownToLine size={17} className="download-icon" /></button></div>;
}
