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
    
    // Core States
    const [lesson, setLesson] = useState(null);
    const [blocks, setBlocks] = useState([]);
    const [title, setTitle] = useState('');
    const [isPublished, setIsPublished] = useState(false);
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
        toast.success("Block removed");
    };

    const handleSave = async (publishStatus = isPublished) => {
        setSaving(true);
        try {
            await api.put(`/teacher/lessons/${id}`, {
                title,
                content: blocks,
                is_published: publishStatus
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
        <div className="h-screen bg-[#030014] flex items-center justify-center">
            <Loader2 className="animate-spin text-purple-500" size={40} />
        </div>
    );

    if (!lesson) return null;

    return (
        <div className="max-w-5xl mx-auto px-4">
            <style>{`
                .ProseMirror ul { list-style-type: disc !important; padding-left: 1.5rem !important; margin: 1rem 0 !important; }
                .ProseMirror ol { list-style-type: decimal !important; padding-left: 1.5rem !important; margin: 1rem 0 !important; }
                .ProseMirror p.is-editor-empty:first-child::before {
                    content: attr(data-placeholder);
                    float: left;
                    color: #475569;
                    pointer-events: none;
                    height: 0;
                    font-style: italic;
                }
                .ProseMirror:focus { outline: none; }
            `}</style>

            {/* STICKY CONTROL BAR */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-16 sticky top-0 z-40 bg-[#030014]/90 backdrop-blur-xl py-6 border-b border-white/5">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button 
                        onClick={() => navigate(-1)} 
                        className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-all border-none bg-transparent cursor-pointer"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div className="flex flex-col flex-grow">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500 mb-1">Architecture Mode</span>
                        <input 
                            value={title || ""} 
                            onChange={(e) => setTitle(e.target.value)} 
                            className="bg-transparent border-none outline-none text-2xl font-bold text-white w-full placeholder:text-slate-800" 
                            placeholder="Unit Title..." 
                        />
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button loading={saving} onClick={() => handleSave()} className="px-8 py-3 text-xs uppercase tracking-widest font-black" variant="primary">
                        Sync Changes
                    </Button>
                    <button 
                        onClick={() => handleSave(!isPublished)} 
                        className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest border-none cursor-pointer transition-all ${isPublished ? 'bg-slate-800 text-slate-400' : 'bg-gradient-to-r from-purple-600 to-accent text-white shadow-lg shadow-purple-500/20'}`}
                    >
                        {isPublished ? 'Return to Draft' : 'Publish Content'}
                    </button>
                </div>
            </div>

            {/* DRAGGABLE CANVAS */}
            <div className="max-w-3xl mx-auto pb-60">
                <Reorder.Group axis="y" values={blocks} onReorder={setBlocks} className="space-y-12 list-none p-0">
                    {blocks.map((block) => (
                        <Reorder.Item key={block.id} value={block} className="group relative">
                            {/* BLOCK SIDEBAR CONTROLS (Restored Delete Confirm) */}
                            <div className="absolute -left-16 top-0 h-full hidden lg:flex flex-col items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                <div className="cursor-grab active:cursor-grabbing p-2 text-slate-700 hover:text-purple-400 transition-colors">
                                    <GripVertical size={20} />
                                </div>
                                <AnimatePresence mode="wait">
                                    {confirmDeleteId === block.id ? (
                                        <motion.button 
                                            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                                            onClick={() => removeBlock(block.id)}
                                            className="p-2 bg-red-500 rounded-full text-white border-none cursor-pointer shadow-lg shadow-red-500/40"
                                        >
                                            <Check size={16} />
                                        </motion.button>
                                    ) : (
                                        <button 
                                            onClick={() => setConfirmDeleteId(block.id)}
                                            className="p-2 text-slate-700 hover:text-red-500 transition-colors border-none bg-transparent cursor-pointer"
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
                <div className="mt-24">
                    <div className="flex items-center gap-4 mb-10">
                        <div className="h-[1px] flex-grow bg-white/5" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-700">Add Element</span>
                        <div className="h-[1px] flex-grow bg-white/5" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
    );
}

function BlockElement({ block, update, isUploading, setUploading, clearUploading }) {
    const getYoutubeId = (url) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url?.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    switch (block.type) {
        case 'h1': return (
            <textarea
                className="w-full bg-transparent border-none outline-none text-4xl font-black text-white placeholder:text-slate-900 tracking-tight resize-none overflow-hidden"
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
                <div className="p-8 rounded-[40px] bg-white/[0.02] border border-white/5 space-y-6">
                    <div className="flex items-center gap-3 text-red-500">
                        <Video size={20} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Video Instruction</span>
                    </div>
                    {ytId ? (
                        <div className="aspect-video w-full rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-black">
                            <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${ytId}`} frameBorder="0" allowFullScreen />
                        </div>
                    ) : (
                        <div className="h-48 bg-white/5 rounded-3xl flex flex-col items-center justify-center border border-dashed border-white/10 group">
                            <Play className="text-white/10 group-hover:text-red-500 transition-colors mb-3" size={48} />
                            <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Paste YouTube Link Below</p>
                        </div>
                    )}
                    <input className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-sm text-white outline-none focus:border-red-500/50 transition-all" placeholder="YouTube URL..." value={block.data.url || ""} onChange={(e) => update(block.id, { url: e.target.value })} />
                </div>
            );
        case 'link': return (
            <div className="p-6 rounded-[32px] bg-white/[0.02] border border-white/5 flex items-center gap-6 group/link transition-all hover:bg-white/[0.04]">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover/link:scale-110 transition-transform"><ExternalLink size={28} /></div>
                <div className="flex-grow space-y-1">
                    <input className="w-full bg-transparent border-none outline-none text-lg text-white font-black placeholder:text-slate-800" placeholder="Resource Title..." value={block.data.title || ""} onChange={(e) => update(block.id, { title: e.target.value })} />
                    <input className="w-full bg-transparent border-none outline-none text-[10px] text-slate-500 font-mono tracking-widest uppercase" placeholder="https://..." value={block.data.url || ""} onChange={(e) => update(block.id, { url: e.target.value })} />
                </div>
            </div>
        );
        case 'image': return (
            <div className="relative rounded-[32px] overflow-hidden border border-white/5 bg-white/[0.01] p-4 min-h-[300px] flex flex-col items-center justify-center transition-all">
                <AnimatePresence>
                    {isUploading && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-10 bg-[#030014]/90 backdrop-blur-xl flex flex-col items-center justify-center gap-4">
                            <Loader2 className="animate-spin text-purple-500" size={32} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400 text-center px-4">Relaying to Cloudinary...</span>
                        </motion.div>
                    )}
                </AnimatePresence>
                {block.data.url ? (
                    <div className="w-full space-y-4">
                        <img src={block.data.url} className="w-full rounded-2xl shadow-2xl border border-white/5" alt="" />
                        <input className="w-full bg-transparent border-none outline-none text-center text-sm text-slate-600 font-bold uppercase tracking-widest" placeholder="Add Caption..." value={block.data.caption || ""} onChange={(e) => update(block.id, { caption: e.target.value })} />
                        <button onClick={() => update(block.id, { url: '' })} className="absolute top-8 right-8 p-2 bg-red-500 rounded-full text-white border-none cursor-pointer"><Trash2 size={16} /></button>
                    </div>
                ) : (
                    <label className="flex flex-col items-center gap-6 cursor-pointer group/upload">
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
            <div className="p-10 rounded-[40px] bg-[#020202] border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="flex justify-between items-center mb-10">
                    <div className="flex bg-white/5 p-1 rounded-xl">
                        {['playground', 'challenge'].map(m => (
                            <button key={m} onClick={() => update(block.id, { mode: m })} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase transition-all border-none cursor-pointer ${block.data.mode === m ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' : 'text-slate-600 hover:text-slate-400'}`}>{m}</button>
                        ))}
                    </div>
                    <button 
                        onClick={() => update(block.id, { code: 'public class Main {\n    public static void main(String[] args) {\n        // Code here\n    }\n}' })}
                        className="text-[9px] font-bold text-purple-400 bg-transparent border-none cursor-pointer"
                    >
                        + Java Template
                    </button>
                </div>
                <div className="rounded-2xl border border-white/5 overflow-hidden mb-6">
                    <CodeMirror value={block.data.code || ""} height="300px" theme="dark" extensions={[java()]} onChange={(val) => update(block.id, { code: val })} />
                </div>
                {block.data.mode === 'challenge' && (
                    <div className="mt-8 pt-8 border-t border-white/5 text-cyan-500 flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest">Required Output</label>
                        <input className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-sm font-mono text-cyan-400" value={block.data.expected || ""} onChange={(e) => update(block.id, { expected: e.target.value })} />
                    </div>
                )}
            </div>
        );
        default: return null;
    }
}

function RichTextEditor({ content, onChange }) {
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
                <div className="absolute -top-14 left-0 flex items-center gap-1 bg-slate-900 border border-white/10 p-1 rounded-2xl shadow-2xl z-50">
                    <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`p-2.5 rounded-xl border-none cursor-pointer ${editor.isActive('bold') ? 'text-purple-400 bg-white/5 shadow-lg' : 'text-slate-500 bg-transparent'}`}><Bold size={16}/></button>
                    <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-2.5 rounded-xl border-none cursor-pointer ${editor.isActive('italic') ? 'text-purple-400 bg-white/5 shadow-lg' : 'text-slate-500 bg-transparent'}`}><Italic size={16}/></button>
                    <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-2.5 rounded-xl border-none cursor-pointer ${editor.isActive('underline') ? 'text-purple-400 bg-white/5 shadow-lg' : 'text-slate-500 bg-transparent'}`}><Underline size={16}/></button>
                    
                    <div className="w-[1px] h-4 bg-white/10 mx-1" />
                    
                    {!showLinkInput ? (
                        <button type="button" onClick={() => { setLinkUrl(editor.getAttributes('link').href || ''); setShowLinkInput(true); }} className={`p-2.5 rounded-xl border-none cursor-pointer ${editor.isActive('link') ? 'text-purple-400' : 'text-slate-500 bg-transparent'}`}><LinkIcon size={16}/></button>
                    ) : (
                        <div className="flex items-center gap-2 bg-black rounded-xl px-2 py-1 ml-1 border border-purple-500/30">
                            <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="bg-transparent border-none outline-none text-[10px] text-white w-32 font-mono" placeholder="URL..." onKeyDown={(e) => e.key === 'Enter' && setLink()} />
                            <button onClick={setLink} className="text-purple-400 p-1 border-none bg-transparent cursor-pointer"><Check size={14}/></button>
                            <button onClick={() => setShowLinkInput(false)} className="text-slate-600 p-1 border-none bg-transparent cursor-pointer"><X size={14}/></button>
                        </div>
                    )}
                </div>
            )}

            {/* SIDEBAR BLOCK ACTIONS (VISIBLE ON HOVER) */}
            <div className="flex gap-2 mb-4 opacity-0 group-hover/editor:opacity-100 transition-opacity">
                <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-2 px-3 rounded-lg border-none cursor-pointer flex items-center gap-2 transition-all ${editor.isActive('bulletList') ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-white/5 text-slate-500 hover:text-slate-300'}`}><List size={16} /> <span className="text-[10px] font-black uppercase tracking-widest">Bullets</span></button>
                <button onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} className="p-2 px-3 rounded-lg border-none bg-white/5 text-slate-500 hover:text-red-400 cursor-pointer flex items-center gap-2 transition-all"><Eraser size={16} /> <span className="text-[10px] font-black uppercase tracking-widest">Clear Formatting</span></button>
            </div>
            
            <EditorContent editor={editor} className="prose prose-invert max-w-none text-xl text-slate-300 leading-relaxed min-h-[40px]" />
        </div>
    );
}

function AddBlockBtn({ icon: Icon, label, onClick }) {
    return (
        <button onClick={onClick} className="flex flex-col items-center gap-4 p-8 rounded-[32px] bg-white/[0.01] border border-white/5 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all border-none cursor-pointer group shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-slate-600 group-hover:text-purple-400 group-hover:scale-110 transition-all shadow-lg"><Icon size={24} /></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 group-hover:text-slate-300 transition-colors">{label}</span>
        </button>
    );
}