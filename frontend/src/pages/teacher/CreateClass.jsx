import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import api from '../../services/api';
import { toast } from 'sonner';
import { LayoutGrid, AlignLeft, ArrowLeft } from 'lucide-react';

export default function CreateClass() {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.post('/teacher/classes', { name, description });
            toast.success("Workspace created successfully!");
            // Navigate to the dashboard or the new class view
            navigate('/dashboard/teacher');
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to create class");
        } finally {
            setLoading(false);
        }
    };

    return (

            <div className="max-w-2xl mx-auto">
                <button 
                    onClick={() => navigate(-1)} 
                    className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors mb-8 border-none bg-transparent cursor-pointer"
                >
                    <ArrowLeft size={16} />
                    <span className="text-sm font-semibold uppercase tracking-widest">Back</span>
                </button>

                <div className="mb-10">
                    <h1 className="text-3xl font-bold mb-2">Create a New Class</h1>
                    <p className="text-slate-400">Establish a new intelligent workspace for your students.</p>
                </div>

                <form onSubmit={handleSubmit} className="stat-card space-y-6">
                    <Input 
                        label="Classroom Name" 
                        icon={LayoutGrid} 
                        placeholder="e.g. Grade 12 - Computer Science" 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        required 
                    />
                    
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <AlignLeft size={14} /> Description
                        </label>
                        <textarea 
                            className="student-link w-full bg-white/[0.03] border border-white/10 rounded-xl py-3.5 px-4 text-white focus:outline-none focus:border-purple-500/50 transition-all h-32"
                            placeholder="Briefly describe the objectives of this class..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    <Button loading={loading} className="w-full py-4 font-bold uppercase tracking-widest">
                        Initialize Classroom
                    </Button>
                </form>
            </div>

    );
}