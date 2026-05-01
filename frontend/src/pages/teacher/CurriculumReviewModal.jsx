import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Trash2, Edit3, BookOpen, HelpCircle, AlertCircle } from 'lucide-react';

export default function CurriculumReviewModal({ isOpen, data, onCancel, onConfirm }) {
    const [pendingData, setPendingData] = useState(null);
    
    useEffect(() => {
        if (data) {
            setPendingData(data);
        }
    }, [data]);

    // Safety Guard: Don't render if closed or data is missing
    if (!isOpen || !pendingData || !pendingData.new_modules) return null;

    const removeItem = (mIdx, iIdx) => {
        const newData = JSON.parse(JSON.stringify(pendingData));
        newData.new_modules[mIdx].items.splice(iIdx, 1);
        setPendingData(newData);
    };

    const updateModuleTitle = (mIdx, val) => {
        const newData = JSON.parse(JSON.stringify(pendingData)); // Use deep clone here too
        newData.new_modules[mIdx].title = val;
        setPendingData(newData);
    };

    const updateItemTitle = (mIdx, type, iIdx, val) => {
        const newData = JSON.parse(JSON.stringify(pendingData)); // Use deep clone here too
        newData.new_modules[mIdx][type][iIdx].title = val;
        setPendingData(newData);
    };

    


    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative z-10 w-full max-w-4xl bg-[#030014] border border-white/10 rounded-[40px] shadow-2xl flex flex-col max-h-[90vh]">
                
                <div className="p-8 border-b border-white/5 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Review AI Blueprint</h2>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Fine-tune the generated structure before saving</p>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-white/5 rounded-full border-none bg-transparent cursor-pointer text-slate-500"><X /></button>
                </div>

                <div className="flex-grow overflow-y-auto p-8 space-y-6 custom-scrollbar">
                    {pendingData.new_modules.map((module, mIdx) => (
                        <div key={mIdx} className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-[10px] font-black text-purple-500 bg-purple-500/10 px-2 py-1 rounded">Module {mIdx + 1}</span>
                                <input 
                                    className="bg-transparent border-none outline-none text-xl font-bold text-white w-full focus:text-purple-400 transition-colors"
                                    value={module.title}
                                    onChange={(e) => updateModuleTitle(mIdx, e.target.value)}
                                />
                            </div>

                            {/* Replace the current items.map block with this */}
                            <div className="space-y-2">
                                {/* Map through the unified items list */}
                                {(module.items || []).map((item, iIdx) => (
                                    <div key={iIdx} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 group">
                                        {/* Visual Icon based on type */}
                                        {item.type === 'lesson' ? 
                                            <BookOpen size={16} className="text-purple-500" /> : 
                                            <HelpCircle size={16} className="text-cyan-500" />
                                        }
                                        
                                        <input 
                                            className="flex-grow bg-transparent border-none outline-none text-sm text-white"
                                            value={item.title}
                                            onChange={(e) => {
                                                const newData = JSON.parse(JSON.stringify(pendingData));
                                                newData.new_modules[mIdx].items[iIdx].title = e.target.value;
                                                setPendingData(newData);
                                            }}
                                        />

                                        {/* Remove individual item */}
                                        <button onClick={() => {
                                            const newData = JSON.parse(JSON.stringify(pendingData));
                                            newData.new_modules[mIdx].items.splice(iIdx, 1);
                                            setPendingData(newData);
                                        }} className="p-2 text-slate-600 hover:text-red-500 transition-colors border-none bg-transparent cursor-pointer opacity-0 group-hover:opacity-100">
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                ))}

                                {/* Empty State check */}
                                {(!module.items || module.items.length === 0) && (
                                    <p className="text-[10px] text-center text-slate-600 font-bold uppercase py-2">No items in this module</p>
                                )}
                            </div>
                                                    </div>
                    ))}
                </div>

                <div className="p-8 border-t border-white/5 flex gap-4">
                    <button onClick={onCancel} className="flex-1 py-4 rounded-2xl bg-white/5 text-slate-400 font-bold uppercase text-xs border-none cursor-pointer hover:bg-white/10 transition-all">Discard Changes</button>
                    <button onClick={() => onConfirm(pendingData)} className="flex-[2] px-12 py-4 rounded-2xl bg-purple-600 text-white font-black uppercase text-xs border-none cursor-pointer shadow-lg shadow-purple-500/20 hover:scale-[1.02] active:scale-95 transition-all">Commit to Course Timeline</button>
                </div>
            </motion.div>
        </div>
    );
}