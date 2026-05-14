import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Search, Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'sonner';
import './IndexingStatsModal.css';

export default function IndexingStatsModal({ courseId, isOpen, onClose }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [reindexing, setReindexing] = useState(false);
    const [reindexSuccess, setReindexSuccess] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadStats();
        }
    }, [isOpen, courseId]);

    const loadStats = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/teacher/courses/${courseId}/indexing-stats`);
            setStats(res.data);
        } catch (err) {
            toast.error('Failed to load indexing stats');
        } finally {
            setLoading(false);
        }
    };

    const handleReindex = async () => {
        setReindexing(true);
        setReindexSuccess(false);
        try {
            const res = await api.post(`/teacher/courses/${courseId}/index`);
            // Reload stats after reindexing
            await loadStats();
            // Show success for 2 seconds
            setReindexSuccess(true);
            setTimeout(() => setReindexSuccess(false), 2000);
            // Clear search results
            setSearchResults(null);
            setSearchQuery('');
        } catch (err) {
            toast.error('Re-indexing failed: ' + (err.response?.data?.error || 'Please try again'));
        } finally {
            setReindexing(false);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setSearching(true);
        try {
            const res = await api.post(`/teacher/courses/${courseId}/test-search`, {
                query: searchQuery,
            });
            setSearchResults(res.data.results);
        } catch (err) {
            console.error('Search error:', err);
            toast.error('Search failed');
        } finally {
            setSearching(false);
        }
    };

    const handleClose = () => {
        // Clear state when closing
        setSearchQuery('');
        setSearchResults(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="indexing-modal"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="modal-header">
                    <div className="flex items-center gap-3">
                        <div className="icon-success">
                            <CheckCircle2 size={24} />
                        </div>
                        <div>
                            <h2 className="modal-title">Course Indexed Successfully</h2>
                            <p className="modal-subtitle">AI Tutor is ready to help students</p>
                        </div>
                    </div>
                    <div className="header-actions">
                        <button
                            onClick={handleReindex}
                            disabled={reindexing}
                            className={`btn-reindex ${reindexSuccess ? 'success' : ''}`}
                            title="Re-index the course to update all changes"
                        >
                            {reindexing ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Re-indexing...</span>
                                </>
                            ) : reindexSuccess ? (
                                <>
                                    <span>✓</span>
                                    <span>Re-indexed</span>
                                </>
                            ) : (
                                <>
                                    <span>⟳</span>
                                    <span>Re-index</span>
                                </>
                            )}
                        </button>
                        <button onClick={handleClose} className="modal-close">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="modal-content custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="animate-spin text-cyan-400" size={32} />
                        </div>
                    ) : stats ? (
                        <>
                            {/* Stats Grid */}
                            <div className="stats-grid">
                                <div className="stat-card">
                                    <div className="stat-value">{stats.lessons_indexed}</div>
                                    <div className="stat-label">Lessons Indexed</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value">{stats.total_chunks}</div>
                                    <div className="stat-label">Total Chunks</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value">{stats.storage_kb} KB</div>
                                    <div className="stat-label">Storage Used</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value flex items-center gap-1">
                                        <Clock size={16} />
                                        {stats.last_updated ? new Date(stats.last_updated).toLocaleDateString() : 'N/A'}
                                    </div>
                                    <div className="stat-label">Last Updated</div>
                                </div>
                            </div>

                            {/* Test Search Section */}
                            <div className="search-section">
                                <h3 className="search-title">🔍 Test Search</h3>
                                <p className="search-description">
                                    Try a sample question to verify the AI tutor can find relevant content
                                </p>

                                <form onSubmit={handleSearch} className="search-form">
                                    <div className="search-input-wrapper">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Ask a sample question..."
                                            className="search-input"
                                            disabled={searching}
                                        />
                                        <button
                                            type="submit"
                                            className="search-button"
                                            disabled={searching || !searchQuery.trim()}
                                        >
                                            {searching ? (
                                                <Loader2 size={18} className="animate-spin" />
                                            ) : (
                                                <Search size={18} />
                                            )}
                                        </button>
                                    </div>
                                </form>

                                {/* Search Results */}
                                {searchResults !== null && (
                                    <div className="search-results">
                                        {searchResults.length > 0 ? (
                                            <>
                                                <div className="results-header">
                                                    Found {searchResults.length} relevant {searchResults.length === 1 ? 'result' : 'results'}
                                                </div>
                                                <div className="results-list">
                                                    {searchResults.map((result, i) => (
                                                        <div key={i} className="result-item">
                                                            <div className="result-similarity">
                                                                <span className="similarity-value">
                                                                    {(result.similarity * 100).toFixed(0)}%
                                                                </span>
                                                                <span className="similarity-label">match</span>
                                                            </div>
                                                            <div className="result-content">
                                                                <p className="result-text">{result.text}</p>
                                                                {result.metadata?.source && (
                                                                    <div className="result-meta">
                                                                        Source: {result.metadata.source}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="empty-results">
                                                <AlertCircle size={20} />
                                                <p>No relevant content found. Check your lessons are properly indexed.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : null}
                </div>

                {/* Footer */}
                <div className="modal-footer">
                    <button onClick={handleClose} className="btn-primary">
                        Done
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
