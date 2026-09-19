import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Keeps one broken pane from taking down the whole studio: if an editor
 * throws, the pane shows a recovery message instead of a blank screen.
 */
export default class StudioErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error) {
        console.error('[Studio pane error]', error);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div
                    className="flex items-center justify-center h-full"
                    style={{ color: 'var(--db-text-2)', padding: 24 }}
                >
                    <div style={{ textAlign: 'center', maxWidth: 420 }}>
                        <AlertTriangle size={28} style={{ color: 'var(--db-amber)', margin: '0 auto 10px' }} />
                        <p style={{ margin: '0 0 8px', fontWeight: 700, color: 'var(--db-text)' }}>
                            This pane hit a snag
                        </p>
                        <p className="gen-note" style={{ marginBottom: 14 }}>
                            Your generated content is saved. Reload the page to bring this pane back.
                        </p>
                        <button type="button" className="gen-btn gen-btn-primary" onClick={() => window.location.reload()}>
                            Reload
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
