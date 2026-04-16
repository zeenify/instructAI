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
import Button from '../../components/ui/Button';

export default function LessonEditor() {
    // Capture both IDs from the new nested URL structure
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
            setLesson(null); // Clear ghost data
            
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
                    if (err.response?.status === 403) {
                        toast.error("Security: Unauthorized access attempt.");
                        navigate('/dashboard/teacher');
                    } else {
                        toast.error("Failed to load lesson content.");
                        navigate(-1);
                    }
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
            data: type === 'code' ? { mode: 'playground', code: '', expected: '' } : 
                  type === 'image' ? { url: '', caption: '' } : { text: '' }
        };
        setBlocks([...blocks, newBlock]);
        // Scroll to bottom after state update
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
            toast.success(publishStatus ? "Published to Classroom" : "Draft Saved Successfully");
        } catch (err) { 
            toast.error("System sync failed. Please try again."); 
        } finally { 
            setSaving(false); 
        }
    };

    if (loading) return (
        <div className="h-screen bg-[#030014] flex items-center justify-center">
            <Loader2 className="animate-spin text-purple-500" size={40} />
        </div>
    );

    // Security Gate: Prevent rendering if data failed to load
    if (!lesson) return null;

    return (
        <div className="max-w-5xl mx-auto">
            {/* STICKY CONTROL BAR */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-16 sticky top-0 z-40 bg-[#030014]/90 backdrop-blur-xl py-6 border-b border-white/5">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button 
                        onClick={() => navigate(`/dashboard/teacher/class/${classId}`)} 
                        className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-all border-none bg-transparent cursor-pointer"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div className="flex flex-col flex-grow">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500 mb-1">Architecture Mode</span>
                        <input 
                            value={title} 
                            onChange={(e) => setTitle(e.target.value)} 
                            className="bg-transparent border-none outline-none text-2xl font-bold text-white w-full placeholder:text-slate-800" 
                            placeholder="Unit Title..." 
                        />
                    </div>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
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
                        <Reorder.Item 
                            key={block.id} 
                            value={block}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="group relative"
                        >
                            {/* BLOCK SIDEBAR CONTROLS */}
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

                {blocks.length === 0 && (
                    <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-[40px]">
                        <p className="text-slate-600 font-medium uppercase tracking-widest text-xs">Blueprint is empty</p>
                    </div>
                )}

                {/* INSERTER HUB */}
                <div className="mt-24">
                    <div className="flex items-center gap-4 mb-10">
                        <div className="h-[1px] flex-grow bg-white/5" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-700">Add Element</span>
                        <div className="h-[1px] flex-grow bg-white/5" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <AddBlockBtn icon={Heading1} label="Headline" onClick={() => addBlock('h1')} />
                        <AddBlockBtn icon={Type} label="Paragraph" onClick={() => addBlock('text')} />
                        <AddBlockBtn icon={Code} label="Sandbox" onClick={() => addBlock('code')} />
                        <AddBlockBtn icon={ImageIcon} label="Media" onClick={() => addBlock('image')} />
                    </div>
                </div>
            </div>
        </div>
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
            toast.success("Cloud asset synchronized");
        } catch (err) {
            toast.error("Upload failed. Verify image type.");
        } finally {
            clearUploading();
        }
    };

    switch (block.type) {
        case 'h1': return (
            <input 
                className="w-full bg-transparent border-none outline-none text-4xl font-black text-white placeholder:text-slate-900 tracking-tight" 
                placeholder="New Section Heading..." 
                value={block.data.text} 
                onChange={(e) => update(block.id, { text: e.target.value })} 
            />
        );
        case 'text': return (
            <textarea 
                className="w-full bg-transparent border-none outline-none text-xl text-slate-400 leading-relaxed resize-none overflow-hidden placeholder:text-slate-900" 
                placeholder="Begin your instruction..." 
                value={block.data.text} 
                onChange={(e) => { 
                    update(block.id, { text: e.target.value }); 
                    e.target.style.height = 'auto'; 
                    e.target.style.height = e.target.scrollHeight + 'px'; 
                }} 
            />
        );
        case 'image': return (
            <div className="relative rounded-[32px] overflow-hidden border border-white/5 bg-white/[0.01] p-4 min-h-[300px] flex flex-col items-center justify-center transition-all group/img">
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
                        <img src={block.data.url} className="w-full rounded-2xl object-cover shadow-2xl border border-white/5" alt="" />
                        <div className="flex items-center gap-4 px-2">
                             <input 
                                className="flex-grow bg-transparent border-none outline-none text-center text-sm text-slate-600 font-bold uppercase tracking-widest" 
                                placeholder="Add Caption..." 
                                value={block.data.caption} 
                                onChange={(e) => update(block.id, { caption: e.target.value })} 
                            />
                            <button onClick={() => update(block.id, { url: '' })} className="p-2 text-slate-700 hover:text-red-500 transition-colors border-none bg-transparent cursor-pointer">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <label className="flex flex-col items-center gap-6 cursor-pointer group/upload">
                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center group-hover/upload:scale-110 group-hover/upload:bg-purple-500/10 group-hover/upload:shadow-[0_0_30px_rgba(167,139,250,0.2)] transition-all">
                            <Upload size={28} className="text-slate-600 group-hover/upload:text-purple-400" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Upload Resource</p>
                            <p className="text-[10px] text-slate-700 font-bold uppercase tracking-widest mt-2">Maximum file size: 10MB</p>
                        </div>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFile} />
                    </label>
                )}
            </div>
        );
        case 'code': return (
            <div className="p-10 rounded-[40px] bg-[#020202] border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="flex justify-between items-center mb-10">
                    <div className="flex bg-white/5 p-1 rounded-xl">
                        {['playground', 'challenge'].map(m => (
                            <button 
                                key={m} 
                                onClick={() => update(block.id, { mode: m })} 
                                className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all border-none cursor-pointer ${block.data.mode === m ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' : 'text-slate-600 hover:text-slate-400'}`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                    <span className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em]">Runtime Engine</span>
                </div>
                <textarea 
                    className="w-full bg-transparent border-none outline-none font-mono text-sm text-purple-300 min-h-[300px] leading-loose" 
                    placeholder="// Define logic parameters..." 
                    value={block.data.code} 
                    onChange={(e) => update(block.id, { code: e.target.value })} 
                />
                {block.data.mode === 'challenge' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-8 pt-8 border-t border-white/5">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertCircle size={16} className="text-cyan-500" />
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Required Output Verification</label>
                        </div>
                        <input 
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-sm font-mono text-cyan-400 outline-none focus:border-cyan-500/50 transition-all shadow-inner" 
                            placeholder="Exact string required to pass..." 
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
        <button onClick={onClick} className="flex flex-col items-center gap-4 p-10 rounded-[32px] bg-white/[0.01] border border-white/5 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all border-none cursor-pointer group shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-slate-600 group-hover:text-purple-400 group-hover:scale-110 transition-all shadow-lg">
                <Icon size={28} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 group-hover:text-slate-300 transition-colors">{label}</span>
        </button>
    );
}