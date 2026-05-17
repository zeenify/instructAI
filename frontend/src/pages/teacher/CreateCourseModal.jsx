import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookPlus, AlignLeft, Upload, FileText, CheckCircle } from 'lucide-react';
import Button from '../../components/ui/Button';
import api from '../../services/api';
import { toast } from 'sonner';
import './CreateCourseModal.css';

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
                        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
                        className="relative z-10 w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl"
                    >
                        <div className="create-course-modal">
                            <div className="create-course-header">
                                <h2 className="create-course-title">
                                    <BookPlus size={20} /> New Course
                                </h2>
                                <button onClick={onClose} className="create-course-close-btn" type="button">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="create-course-form">
                                <div className="form-group">
                                    <label className="form-label">
                                        <BookPlus size={14} /> Course Title
                                    </label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g. Introduction to Java"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        <AlignLeft size={14} /> Description
                                    </label>
                                    <textarea
                                        className="form-textarea"
                                        placeholder="What will students learn?"
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                    />
                                </div>


                                <div className="form-group">
                                    <label className="form-label">
                                        <FileText size={14} /> Curriculum Document (Optional)
                                    </label>
                                    <p className="form-helper-text">
                                        Upload your syllabus, DLL, or course guide for AI-powered generation
                                    </p>
                                    <div>
                                        <input
                                            type="file"
                                            accept=".pdf,.doc,.docx,.txt"
                                            onChange={handleFileChange}
                                            className="hidden"
                                            id="curriculum-upload"
                                        />
                                        <label
                                            htmlFor="curriculum-upload"
                                            className="file-upload-area"
                                        >
                                            {curriculumFile ? (
                                                <>
                                                    <CheckCircle size={18} className="text-green-400" />
                                                    <span className="file-upload-name">{curriculumFile.name}</span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setCurriculumFile(null);
                                                        }}
                                                        className="file-upload-remove"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <Upload size={18} />
                                                    <span>Choose file (PDF, DOC, DOCX, TXT)</span>
                                                </>
                                            )}
                                        </label>
                                    </div>
                                </div>


                                <Button loading={loading} className="create-course-submit w-full">
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