import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
    ChevronLeft, Trash2, Type, Heading1, Code, Image as ImageIcon, 
    Loader2, GripVertical, Upload, Check, AlertCircle,
    Bold, Italic, Underline, List, Link as LinkIcon, 
    Video, ExternalLink, X, Play, Eraser, Save
} from 'lucide-react';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExtension from '@tiptap/extension-underline';
import LinkExtension from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { BubbleMenu as BubbleMenuPlugin } from '@tiptap/extension-bubble-menu';

import { toast } from 'sonner';
import api, { invalidateCache } from '../../services/api';
import Button from '../../components/ui/Button';
import { useTheme } from '../../context/ThemeContext';

import CodeMirror from '@uiw/react-codemirror';
import { java } from '@codemirror/lang-java';

/**
 * TIPTAP CONFIGURATION
 * Defined outside to prevent the "Duplicate extension" warning.
 */
const TIPTAP_EXTENSIONS = [
    StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
    }),
    UnderlineExtension,
    LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-purple-400 underline cursor-pointer' },
    }),
    Placeholder.configure({
        placeholder: 'Begin your instruction here...',
    }),
    BubbleMenuPlugin,
];

export default function LessonEditor() {
    const { classId, id } = useParams(); 
    const navigate = useNavigate();
    const { theme } = useTheme();
    
    // Core States
    const [lesson, setLesson] = useState(null);
    const [blocks, setBlocks] = useState([]);
    const [title, setTitle] = useState('');
    const [isPublished, setIsPublished] = useState(false);
    const [aiEnabled, setAiEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // UX States
    const [uploadingBlockId, setUploadingBlockId] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    useEffect(() => {
        let isMounted = true;
        const fetchLesson = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/teacher/lessons/${id}`);
                if (isMounted) {
                    setLesson(res.data);
                    setTitle(res.data.title);
                    setBlocks(res.data.content || []);
                    setIsPublished(res.data.is_published);
                    setAiEnabled(res.data.ai_enabled || true);
                }
            } catch (err) {
                if (isMounted) {
                    toast.error("Failed to load lesson content.");
                    navigate(-1);
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchLesson();
        return () => { isMounted = false; };
    }, [id, navigate]);

    const addBlock = (type) => {
        const newBlock = {
            id: crypto.randomUUID(),
            type,
            data: type === 'code' ? { mode: 'playground', code: '', expected: '', boilerplate: '' } : 
                  type === 'image' ? { url: '', caption: '' } : 
                  type === 'video' ? { url: '', title: '' } :
                  type === 'link' ? { url: '', title: '' } : { text: '' }
        };
        setBlocks([...blocks, newBlock]);
        setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
    };

    const updateBlock = (blockId, newData) => {
        setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, data: { ...b.data, ...newData } } : b));
    };

    const removeBlock = (blockId) => {
        setBlocks(prev => prev.filter(b => b.id !== blockId));
        setConfirmDeleteId(null);
        toast.warning("Block removed");
    };

    const handleSave = async (publishStatus = isPublished) => {
        setSaving(true);
        try {
            await api.put(`/teacher/lessons/${id}`, {
                title,
                content: blocks,
                is_published: publishStatus,
                ai_enabled: aiEnabled
            });
            setIsPublished(publishStatus);

            // Invalidate cache for this lesson and related courses
            invalidateCache(`/teacher/lessons/${id}`);
            invalidateCache(`/teacher/courses/`);

            toast.success(publishStatus ? "Published to Classroom" : "Draft Saved Successfully");
        } catch (err) {
            toast.error("System sync failed.");
        } finally {
            setSaving(false);
        }
    };

if (loading) return (
        <div style={{ backgroundColor: 'var(--bg-primary)' }} className="h-screen flex items-center justify-center">
            <Loader2 className="animate-spin text-purple-500" size={40} />
        </div>
    );

    if (!lesson) return null;

return (
        <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh', transition: 'all 0.3s ease' }}>
<div className="w-full mx-auto px-8 pb-[500px]">
            <style>{`
                .ProseMirror ul { list-style-type: disc !important; padding-left: 1.5rem !important; margin: 1rem 0 !important; }
                .ProseMirror ol { list-style-type: decimal !important; padding-left: 1.5rem !important; margin: 1rem 0 !important; }
                .ProseMirror p.is-editor-empty:first-child::before {
                    content: attr(data-placeholder);
                    float: left;
                    color: var(--text-tertiary);
                    pointer-events: none;
                    height: 0;
                    font-style: italic;
                }
                .ProseMirror:focus { outline: none; }
            `}</style>

{/* STICKY CONTROL BAR */}
<div style={{ padding: '20px 0', marginBottom: '32px', gap: '24px', backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)' }} className="flex flex-col md:flex-row justify-between items-center sticky top-0 z-40 backdrop-blur-xl">
<div style={{ gap: '16px' }} className="flex items-center w-full md:w-auto">
<button
onClick={() => navigate(-1)}
style={{ padding: '10px 12px' }}
className="hover:bg-var(--bg-tertiary) rounded-full text-slate-500 hover:text-purple-600 transition-all border-none bg-transparent cursor-pointer"
>
<ChevronLeft size={24} />
</button>
<div className="flex flex-col flex-grow">
<span style={{ marginBottom: '4px' }} className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500">Architecture Mode</span>
<input
value={title || ""}
onChange={(e) => setTitle(e.target.value)}
style={{ color: 'var(--text-primary)', width: '100%' }}
className="bg-transparent border-none outline-none text-2xl font-bold placeholder:text-slate-400"
placeholder="Unit Title..."
/>
</div>
</div>
            <div style={{ gap: '12px' }} className="flex items-center">
                <label style={{ backgroundColor: aiEnabled ? 'rgba(168, 85, 247, 0.15)' : 'var(--bg-tertiary)', border: aiEnabled ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid var(--border-color)', color: aiEnabled ? '#c084fc' : 'var(--text-secondary)' }} className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-opacity-90 transition-all cursor-pointer">
                    <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${aiEnabled ? 'bg-purple-600 border-purple-500' : 'border-slate-400 bg-transparent'}`}>
                        {aiEnabled && <Check size={12} className="text-white" />}
                    </div>
                    <input
                        type="checkbox"
                        checked={aiEnabled}
                        onChange={(e) => setAiEnabled(e.target.checked)}
                        className="hidden"
                    />
                    <span>AI Tutor</span>
                </label>
                    <Button loading={saving} onClick={() => handleSave()} style={{ padding: '14px 24px' }} className="text-xs uppercase tracking-widest font-black" variant="primary">
                        Sync Changes
                    </Button>
                    <button
                        onClick={() => handleSave(!isPublished)}
                        disabled={saving}
                        style={{ 
                            padding: '14px 24px',
                            backgroundColor: isPublished ? 'var(--bg-tertiary)' : '#7e22ce',
                            color: isPublished ? 'var(--text-primary)' : 'white',
                            border: isPublished ? '1px solid var(--border-color)' : 'none',
                            opacity: saving ? 0.6 : 1,
                            cursor: saving ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}
                        className="rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm"
                    >
                        {saving ? <Loader2 className="animate-spin" size={16} /> : null}
                        {saving ? (isPublished ? 'Unpublishing...' : 'Publishing...') : (isPublished ? 'Return to Draft' : 'Publish Content')}
                    </button>
                </div>
            </div>

{/* DRAGGABLE CANVAS */}
            <div className="w-full">
                <Reorder.Group axis="y" values={blocks} onReorder={setBlocks} style={{ gap: '32px' }} className="flex flex-col list-none p-0">
                    {blocks.map((block) => (
                        <Reorder.Item key={block.id} value={block} className="group relative">
{/* BLOCK SIDEBAR CONTROLS - Visible on Hover */}
                            <div style={{ gap: '8px', padding: '12px' }} className="absolute -left-20 top-0 flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <div style={{ padding: '10px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }} className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-purple-600 transition-all rounded-lg shadow-sm">
                                    <GripVertical size={18} />
                                </div>
                                <AnimatePresence mode="wait">
                                    {confirmDeleteId === block.id ? (
                                        <motion.button
                                            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                                            onClick={() => removeBlock(block.id)}
                                            style={{ padding: '10px 12px' }}
                                            className="bg-red-500 rounded-lg text-white border-none cursor-pointer shadow-lg shadow-red-500/40 hover:bg-red-600 transition-all"
                                        >
                                            <Check size={16} />
                                        </motion.button>
                                    ) : (
                                        <button
                                            onClick={() => setConfirmDeleteId(block.id)}
                                            style={{ padding: '10px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
                                            className="text-slate-400 hover:text-red-600 border-none cursor-pointer rounded-lg transition-all shadow-sm"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </AnimatePresence>
                            </div>

                            <BlockElement 
                                block={block} 
                                update={updateBlock} 
                                isUploading={uploadingBlockId === block.id}
                                setUploading={() => setUploadingBlockId(block.id)}
                                clearUploading={() => setUploadingBlockId(null)}
                            />
                        </Reorder.Item>
                    ))}
                </Reorder.Group>

                {/* INSERTER HUB */}
<div style={{ marginTop: '48px' }}>
                    <div style={{ gap: '16px', marginBottom: '24px' }} className="flex items-center">
                        <div style={{ backgroundColor: 'var(--border-color)' }} className="h-[1px] flex-grow" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Add Element</span>
                        <div style={{ backgroundColor: 'var(--border-color)' }} className="h-[1px] flex-grow" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                        <AddBlockBtn icon={Heading1} label="H1" onClick={() => addBlock('h1')} />
                        <AddBlockBtn icon={Type} label="Text" onClick={() => addBlock('text')} />
                        <AddBlockBtn icon={Code} label="Sandbox" onClick={() => addBlock('code')} />
                        <AddBlockBtn icon={ImageIcon} label="Media" onClick={() => addBlock('image')} />
                        <AddBlockBtn icon={Video} label="YouTube" onClick={() => addBlock('video')} />
                        <AddBlockBtn icon={LinkIcon} label="Link" onClick={() => addBlock('link')} />
                    </div>
                </div>
            </div>
        </div>
        </div>
    );
}

function BlockElement({ block, update, isUploading, setUploading, clearUploading }) {
    const { theme } = useTheme();
    const getYoutubeId = (url) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url?.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

switch (block.type) {
        case 'h1': return (
            <textarea
                className="w-full bg-transparent border-none outline-none text-4xl font-black tracking-tight resize-none overflow-hidden"
                style={{ color: 'var(--text-primary)' }}
                placeholder="New Section Heading..."
                value={block.data.text || ""}
                onChange={(e) => {
                    update(block.id, { text: e.target.value });
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                }}
                onInput={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                }}
            />
        );
        case 'text': return (
            <RichTextEditor 
                content={block.data.text || ""} 
                onChange={(html) => update(block.id, { text: html })} 
            />
        );
case 'video':
            const ytId = getYoutubeId(block.data.url);
            return (
                <div style={{ padding: '32px 40px', gap: '24px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }} className="rounded-[40px] flex flex-col shadow-sm">
                    <div className="flex items-center gap-3 text-red-500">
                        <Video size={20} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Video Instruction</span>
                    </div>
                    {ytId ? (
                        <div className="aspect-video w-full rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-black">
                            <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${ytId}`} frameBorder="0" allowFullScreen />
                        </div>
                    ) : (
                        <div style={{ gap: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px dashed var(--border-color)' }} className="h-48 rounded-3xl flex flex-col items-center justify-center group">
                            <Play className="text-slate-400 group-hover:text-red-500 transition-colors" size={48} />
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Paste YouTube Link Below</p>
                        </div>
                    )}
                    <input style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} className="w-full rounded-2xl text-sm outline-none focus:border-red-500/50 transition-all" placeholder="YouTube URL..." value={block.data.url || ""} onChange={(e) => update(block.id, { url: e.target.value })} />
                </div>
            );
case 'link': return (
            <div style={{ padding: '24px 28px', gap: '16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }} className="rounded-[32px] flex items-center group/link transition-all hover:bg-var(--bg-tertiary) shadow-sm">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover/link:scale-110 transition-transform"><ExternalLink size={28} /></div>
                <div className="flex-grow flex flex-col" style={{ gap: '4px' }}>
                    <input style={{ color: 'var(--text-primary)' }} className="w-full bg-transparent border-none outline-none text-lg font-black placeholder:text-slate-400" placeholder="Resource Title..." value={block.data.title || ""} onChange={(e) => update(block.id, { title: e.target.value })} />
                    <input className="w-full bg-transparent border-none outline-none text-[10px] text-slate-500 font-mono tracking-widest uppercase" placeholder="https://..." value={block.data.url || ""} onChange={(e) => update(block.id, { url: e.target.value })} />
                </div>
            </div>
        );
        case 'image': return (
            <div style={{ padding: '20px 24px' }} className="relative rounded-[32px] overflow-hidden border border-white/5 bg-white/[0.01] min-h-[300px] flex flex-col items-center justify-center transition-all">
                <AnimatePresence>
                    {isUploading && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ gap: '16px' }} className="absolute inset-0 z-10 bg-[#030014]/90 backdrop-blur-xl flex flex-col items-center justify-center">
                            <Loader2 className="animate-spin text-purple-500" size={32} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400 text-center px-4">Relaying to Cloudinary...</span>
                        </motion.div>
                    )}
                </AnimatePresence>
                {block.data.url ? (
                    <div className="w-full" style={{ gap: '16px' }} className="flex flex-col">
                        <img src={block.data.url} className="w-full rounded-2xl shadow-2xl border border-white/5" alt="" />
                        <input style={{ padding: '10px 12px' }} className="w-full bg-transparent border-none outline-none text-center text-sm text-slate-600 font-bold uppercase tracking-widest" placeholder="Add Caption..." value={block.data.caption || ""} onChange={(e) => update(block.id, { caption: e.target.value })} />
                        <button style={{ padding: '10px 12px' }} onClick={() => update(block.id, { url: '' })} className="absolute top-8 right-8 bg-red-500 rounded-full text-white border-none cursor-pointer"><Trash2 size={16} /></button>
                    </div>
                ) : (
                    <label style={{ gap: '16px' }} className="flex flex-col items-center cursor-pointer group/upload">
                        <Upload size={28} className="text-slate-600 group-hover:text-purple-400" />
                        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Select Image</p>
                        <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                            const file = e.target.files[0];
                            if(!file) return;
                            setUploading();
                            const fd = new FormData(); fd.append('image', file);
                            try {
                                const res = await api.post('/teacher/lessons/upload-image', fd);
                                update(block.id, { url: res.data.url });
                                toast.success("Asset uploaded");
                            } catch (err) { toast.error("Upload failed"); }
                            finally { clearUploading(); }
                        }} />
                    </label>
                )}
            </div>
        );
case 'code': return (
            <div style={{ padding: '32px 40px', backgroundColor: theme === 'dark' ? '#020202' : '#ffffff', border: '1px solid var(--border-color)' }} className="rounded-[40px] shadow-2xl relative overflow-hidden">
                <div style={{ marginBottom: '24px', justifyContent: 'space-between' }} className="flex items-center">
                    <div style={{ padding: '4px', gap: '4px', backgroundColor: 'var(--bg-tertiary)' }} className="flex rounded-xl">
                        {['playground', 'challenge'].map(m => (
                            <button key={m} onClick={() => update(block.id, { mode: m })} style={{ padding: '8px 12px' }} className={`rounded-lg text-[10px] font-black uppercase transition-all border-none cursor-pointer ${block.data.mode === m ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' : 'text-slate-600 hover:text-slate-400'}`}>{m}</button>
                        ))}
                    </div>
                    <button
                        onClick={() => update(block.id, { code: 'public class Main {\n    public static void main(String[] args) {\n        // Code here\n    }\n}' })}
                        className="text-[9px] font-bold text-purple-400 bg-transparent border-none cursor-pointer"
                    >
                        + Java Template
                    </button>
                </div>
<div className="rounded-2xl border border-white/5 overflow-hidden" style={{ marginBottom: '24px' }}>
                    <CodeMirror value={block.data.code || ""} height="300px" theme={theme === 'dark' ? 'dark' : 'light'} extensions={[java()]} onChange={(val) => update(block.id, { code: val })} options={{ fontSize: 16 }} />
                </div>
                {block.data.mode === 'challenge' && (
                    <div style={{ marginTop: '24px', paddingTop: '24px', gap: '12px' }} className="border-t border-white/5 text-cyan-500 flex flex-col">
                        <label className="text-[10px] font-black uppercase tracking-widest">Required Output</label>
                        <input style={{ padding: '10px 12px' }} className="w-full bg-white/5 border border-white/10 rounded-2xl text-sm font-mono text-cyan-400" value={block.data.expected || ""} onChange={(e) => update(block.id, { expected: e.target.value })} />
                    </div>
                )}
            </div>
        );
        default: return null;
    }
}

function RichTextEditor({ content, onChange }) {
    const { theme } = useTheme();
    const [linkUrl, setLinkUrl] = useState('');
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [isTextSelected, setIsTextSelected] = useState(false);

    const editor = useEditor({
        extensions: TIPTAP_EXTENSIONS,
        content: content,
        onUpdate: ({ editor }) => onChange(editor.getHTML()),
        onSelectionUpdate: ({ editor }) => {
            setIsTextSelected(!editor.state.selection.empty);
        },
    });

    if (!editor) return null;

    const setLink = () => {
        if (linkUrl) {
            editor.chain().focus().setLink({ href: linkUrl }).run();
            setLinkUrl('');
            setShowLinkInput(false);
        } else {
            editor.chain().focus().unsetLink().run();
            setShowLinkInput(false);
        }
    };

    return (
        <div className="relative group/editor">
            {/* MANUAL BUBBLE MENU UI (FIX FOR VITE ERROR) */}
            {isTextSelected && (
                <div style={{ gap: '4px', padding: '4px' }} className="absolute -top-14 left-0 flex items-center bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-50">
                    <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} style={{ padding: '10px 12px' }} className={`rounded-xl border-none cursor-pointer ${editor.isActive('bold') ? 'text-purple-400 bg-white/5 shadow-lg' : 'text-slate-500 bg-transparent'}`}><Bold size={16}/></button>
                    <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} style={{ padding: '10px 12px' }} className={`rounded-xl border-none cursor-pointer ${editor.isActive('italic') ? 'text-purple-400 bg-white/5 shadow-lg' : 'text-slate-500 bg-transparent'}`}><Italic size={16}/></button>
                    <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} style={{ padding: '10px 12px' }} className={`rounded-xl border-none cursor-pointer ${editor.isActive('underline') ? 'text-purple-400 bg-white/5 shadow-lg' : 'text-slate-500 bg-transparent'}`}><Underline size={16}/></button>

                    <div className="w-[1px] h-4 bg-white/10 mx-1" />

                    {!showLinkInput ? (
                        <button type="button" onClick={() => { setLinkUrl(editor.getAttributes('link').href || ''); setShowLinkInput(true); }} style={{ padding: '10px 12px' }} className={`rounded-xl border-none cursor-pointer ${editor.isActive('link') ? 'text-purple-400' : 'text-slate-500 bg-transparent'}`}><LinkIcon size={16}/></button>
                    ) : (
                        <div style={{ gap: '8px', padding: '6px 8px' }} className="flex items-center bg-black rounded-xl ml-1 border border-purple-500/30">
                            <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="bg-transparent border-none outline-none text-[10px] text-white w-32 font-mono" placeholder="URL..." onKeyDown={(e) => e.key === 'Enter' && setLink()} />
                            <button onClick={setLink} style={{ padding: '4px 6px' }} className="text-purple-400 border-none bg-transparent cursor-pointer"><Check size={14}/></button>
                            <button onClick={() => setShowLinkInput(false)} style={{ padding: '4px 6px' }} className="text-slate-600 border-none bg-transparent cursor-pointer"><X size={14}/></button>
                        </div>
                    )}
                </div>
            )}

{/* SIDEBAR BLOCK ACTIONS (VISIBLE ON HOVER) */}
            <div style={{ gap: '8px', marginBottom: '12px' }} className="flex opacity-0 group-hover/editor:opacity-100 transition-opacity">
                <button onClick={() => editor.chain().focus().toggleBulletList().run()} style={{ padding: '10px 12px', gap: '8px' }} className={`rounded-lg border-none cursor-pointer flex items-center transition-all ${editor.isActive('bulletList') ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-var(--bg-tertiary) text-slate-500 hover:text-slate-700'}`} />
                <button onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} style={{ padding: '10px 12px', gap: '8px' }} className="rounded-lg border-none bg-var(--bg-tertiary) text-slate-500 hover:text-red-400 cursor-pointer flex items-center transition-all" />
            </div>
            
            <EditorContent editor={editor} className={`prose ${theme === 'dark' ? 'prose-invert' : ''} max-w-none text-xl text-var(--text-secondary) leading-relaxed min-h-[40px]`} />
        </div>
    );
}

function AddBlockBtn({ icon: Icon, label, onClick }) {
    return (
        <button onClick={onClick} style={{ padding: '24px 28px', gap: '12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }} className="flex flex-col items-center rounded-[32px] hover:border-purple-500/50 hover:bg-var(--bg-tertiary) transition-all border-none cursor-pointer group shadow-sm">
            <div style={{ backgroundColor: 'var(--bg-tertiary)' }} className="w-12 h-12 rounded-2xl flex items-center justify-center text-slate-500 group-hover:text-purple-600 group-hover:scale-110 transition-all shadow-sm"><Icon size={24} /></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-700 transition-colors">{label}</span>
        </button>
    );
}