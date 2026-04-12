import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
    ChevronLeft, Save, Rocket, Plus, Trash2, 
    Type, Heading1, Code, Image as ImageIcon, 
    Loader2, GripVertical, Upload, Check, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';
import TeacherLayout from '../../components/layouts/TeacherLayout';
import Button from '../../components/ui/Button';

export default function LessonEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    
    // Core States
    const [blocks, setBlocks] = useState([]);
    const [title, setTitle] = useState('');
    const [isPublished, setIsPublished] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // UX States
    const [uploadingBlockId, setUploadingBlockId] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    useEffect(() => { fetchLesson(); }, [id]);

    const fetchLesson = async () => {
        try {
            const res = await api.get(`/teacher/lessons/${id}`);
            setTitle(res.data.title);
            setBlocks(res.data.content || []);
            setIsPublished(res.data.is_published);
        } catch (err) { toast.error("Failed to load lesson"); }
        finally { setLoading(false); }
    };

    const addBlock = (type) => {
        const newBlock = {
            id: crypto.randomUUID(),
            type,
            data: type === 'code' ? { mode: 'playground', code: '', expected: '' } : 
                  type === 'image' ? { url: '', caption: '' } : { text: '' }
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
            toast.success(publishStatus ? "Lesson Published!" : "Draft Saved");
        } catch (err) { toast.error("Save failed"); }
        finally { setSaving(false); }
    };

    if (loading) return (
        <div className="h-screen bg-[#030014] flex items-center justify-center">
            <Loader2 className="animate-spin text-purple-500" size={40} />
        </div>
    );

    return (
        <TeacherLayout>
            {/* STICKY CONTROL BAR */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-16 sticky top-0 z-40 bg-[#030014]/90 backdrop-blur-xl py-6 border-b border-white/5">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-all border-none bg-transparent cursor-pointer">
                        <ChevronLeft size={24} />
                    </button>
                    <div className="flex flex-col flex-grow">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500 mb-1">Lesson Editor</span>
                        <input 
                            value={title} 
                            onChange={(e) => setTitle(e.target.value)} 
                            className="bg-transparent border-none outline-none text-2xl font-bold text-white w-full placeholder:text-slate-800" 
                            placeholder="Untitled Lesson..." 
                        />
                    </div>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <Button loading={saving} onClick={() => handleSave()} className="px-8 py-3 text-xs uppercase tracking-widest font-black" variant="primary">
                        Save Changes
                    </Button>
                    <button 
                        onClick={() => handleSave(!isPublished)} 
                        className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest border-none cursor-pointer transition-all ${isPublished ? 'bg-slate-800 text-slate-400' : 'bg-gradient-to-r from-purple-600 to-accent text-white shadow-lg shadow-purple-500/20'}`}
                    >
                        {isPublished ? 'Unpublish' : 'Go Live'}
                    </button>
                </div>
            </div>

            {/* DRAGGABLE CANVAS */}
            <div className="max-w-3xl mx-auto pb-60">
                <Reorder.Group axis="y" values={blocks} onReorder={setBlocks} className="space-y-12 list-none p-0">
                    {blocks.map((block) => (
                        <Reorder.Item 
                            key={block.id} 
                            value={block}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="group relative"
                        >
                            {/* BLOCK CONTROLS */}
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

                            {/* THE ACTUAL BLOCK CONTENT */}
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

                {/* EMPTY STATE */}
                {blocks.length === 0 && (
                    <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[40px]">
                        <p className="text-slate-600 font-medium">Your canvas is empty. Add your first block below.</p>
                    </div>
                )}

                {/* INSERTER */}
                <div className="mt-24">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="h-[1px] flex-grow bg-white/5" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Insert Component</span>
                        <div className="h-[1px] flex-grow bg-white/5" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <AddBlockBtn icon={Heading1} label="Heading" onClick={() => addBlock('h1')} />
                        <AddBlockBtn icon={Type} label="Text" onClick={() => addBlock('text')} />
                        <AddBlockBtn icon={Code} label="Code IDE" onClick={() => addBlock('code')} />
                        <AddBlockBtn icon={ImageIcon} label="Visual" onClick={() => addBlock('image')} />
                    </div>
                </div>
            </div>
        </TeacherLayout>
    );
}

function BlockElement({ block, update, isUploading, setUploading, clearUploading }) {
    const handleFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading();
        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await api.post('/teacher/lessons/upload-image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            update(block.id, { url: res.data.url });
            toast.success("Image uploaded");
        } catch (err) {
            toast.error("Upload failed");
        } finally {
            clearUploading();
        }
    };

    switch (block.type) {
        case 'h1': return (
            <input 
                className="w-full bg-transparent border-none outline-none text-4xl font-black text-white placeholder:text-slate-800 tracking-tight" 
                placeholder="Section Heading..." 
                value={block.data.text} 
                onChange={(e) => update(block.id, { text: e.target.value })} 
            />
        );
        case 'text': return (
            <textarea 
                className="w-full bg-transparent border-none outline-none text-xl text-slate-400 leading-relaxed resize-none overflow-hidden placeholder:text-slate-800" 
                placeholder="Start typing your story..." 
                value={block.data.text} 
                onChange={(e) => { 
                    update(block.id, { text: e.target.value }); 
                    e.target.style.height = 'auto'; 
                    e.target.style.height = e.target.scrollHeight + 'px'; 
                }} 
            />
        );
        case 'image': return (
            <div className="relative rounded-[32px] overflow-hidden border border-white/5 bg-white/[0.02] p-4 min-h-[300px] flex flex-col items-center justify-center transition-all group/img">
                <AnimatePresence>
                    {isUploading && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-10 bg-[#030014]/80 backdrop-blur-md flex flex-col items-center justify-center gap-4">
                            <Loader2 className="animate-spin text-purple-500" size={32} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">Uploading to Cloud...</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {block.data.url ? (
                    <div className="w-full space-y-4">
                        <img src={block.data.url} className="w-full rounded-2xl object-cover shadow-2xl" alt="" />
                        <div className="flex items-center gap-4 px-2">
                             <input 
                                className="flex-grow bg-transparent border-none outline-none text-center text-sm text-slate-500 font-medium" 
                                placeholder="Write a caption..." 
                                value={block.data.caption} 
                                onChange={(e) => update(block.id, { caption: e.target.value })} 
                            />
                            <button onClick={() => update(block.id, { url: '' })} className="p-2 text-slate-600 hover:text-red-500 transition-colors border-none bg-transparent cursor-pointer">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <label className="flex flex-col items-center gap-4 cursor-pointer group/upload">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover/upload:scale-110 group-hover/upload:bg-purple-500/10 transition-all">
                            <Upload size={24} className="text-slate-500 group-hover/upload:text-purple-400" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-bold text-slate-300">Upload Media</p>
                            <p className="text-[10px] text-slate-600 font-medium uppercase tracking-widest mt-1">High-Res Assets Preferred</p>
                        </div>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFile} />
                    </label>
                )}
            </div>
        );
        case 'code': return (
            <div className="p-8 rounded-[32px] bg-[#050505] border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex bg-white/5 p-1 rounded-xl">
                        {['playground', 'challenge'].map(m => (
                            <button 
                                key={m} 
                                onClick={() => update(block.id, { mode: m })} 
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border-none cursor-pointer ${block.data.mode === m ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-md">Java Environment</span>
                </div>
                <textarea 
                    className="w-full bg-transparent border-none outline-none font-mono text-sm text-purple-300 min-h-[250px] leading-relaxed" 
                    placeholder="// Initialize your logic here..." 
                    value={block.data.code} 
                    onChange={(e) => update(block.id, { code: e.target.value })} 
                />
                {block.data.mode === 'challenge' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-6 pt-6 border-t border-white/5">
                        <div className="flex items-center gap-2 mb-3">
                            <AlertCircle size={14} className="text-cyan-500" />
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Expected Console Output</label>
                        </div>
                        <input 
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-mono text-cyan-400 outline-none focus:border-cyan-500/50 transition-all" 
                            placeholder="Exact output required to pass..." 
                            value={block.data.expected} 
                            onChange={(e) => update(block.id, { expected: e.target.value })} 
                        />
                    </motion.div>
                )}
            </div>
        );
        default: return null;
    }
}

function AddBlockBtn({ icon: Icon, label, onClick }) {
    return (
        <button onClick={onClick} className="flex flex-col items-center gap-3 p-8 rounded-[24px] bg-white/[0.02] border border-white/5 hover:border-purple-500/40 hover:bg-purple-500/5 transition-all border-none cursor-pointer group">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-slate-500 group-hover:text-purple-400 transition-all shadow-xl">
                <Icon size={24} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover:text-slate-300 transition-colors">{label}</span>
        </button>
    );
}