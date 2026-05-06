import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookPlus, AlignLeft, Upload, FileText, CheckCircle } from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import api from '../../services/api';
import { toast } from 'sonner';

export default function CreateCourseModal({ isOpen, onClose, classId, onCourseCreated }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [curriculumFile, setCurriculumFile] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file type
            const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
            if (!validTypes.includes(file.type)) {
                toast.error('Please upload a PDF, DOC, DOCX, or TXT file');
                return;
            }
            // Validate file size (10MB max)
            if (file.size > 10 * 1024 * 1024) {
                toast.error('File size must be less than 10MB');
                return;
            }
            setCurriculumFile(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description);
            if (curriculumFile) {
                formData.append('curriculum_file', curriculumFile);
            }

            const res = await api.post(`/teacher/classes/${classId}/courses`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success("Course created as a Draft!");
            setTitle('');
            setDescription('');
            setCurriculumFile(null);
            onCourseCreated(res.data);
            onClose();
        } catch (err) {
            toast.error("Failed to create course");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    />
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative z-10 w-full max-w-lg bg-[#030014] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
                    >
                        <div className="p-8">
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                    <BookPlus className="text-purple-400" /> New Course
                                </h2>
                                <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors bg-transparent border-none cursor-pointer">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <Input 
                                    label="Course Title" 
                                    placeholder="e.g. Introduction to Java" 
                                    value={title} 
                                    onChange={e => setTitle(e.target.value)} 
                                    required 
                                />
                                
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <AlignLeft size={14} /> Description
                                    </label>
                                    <textarea
                                        className="student-link w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500/50 transition-all h-24"
                                        placeholder="What will students learn?"
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <FileText size={14} /> Curriculum Document (Optional)
                                    </label>
                                    <p className="text-xs text-slate-500 ml-1 mb-2">
                                        Upload your syllabus, DLL, or course guide for AI-powered generation
                                    </p>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept=".pdf,.doc,.docx,.txt"
                                            onChange={handleFileChange}
                                            className="hidden"
                                            id="curriculum-upload"
                                        />
                                        <label
                                            htmlFor="curriculum-upload"
                                            className="flex items-center justify-center gap-2 w-full bg-white/[0.03] border border-white/10 hover:border-purple-500/50 rounded-xl py-4 px-4 text-slate-400 hover:text-purple-400 cursor-pointer transition-all"
                                        >
                                            {curriculumFile ? (
                                                <>
                                                    <CheckCircle size={18} className="text-green-400" />
                                                    <span className="text-sm text-white">{curriculumFile.name}</span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setCurriculumFile(null);
                                                        }}
                                                        className="ml-auto text-red-400 hover:text-red-300"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <Upload size={18} />
                                                    <span className="text-sm">Choose file (PDF, DOC, DOCX, TXT)</span>
                                                </>
                                            )}
                                        </label>
                                    </div>
                                </div>

                                <Button loading={loading} className="w-full py-4 uppercase font-bold tracking-widest">
                                    Create Course
                                </Button>
                            </form>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}