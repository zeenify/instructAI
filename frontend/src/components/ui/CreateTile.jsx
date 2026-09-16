import { Plus } from 'lucide-react';

/** Dashed "create something new" tile used at the end of card grids. */
export default function CreateTile({ title, subtitle, onClick }) {
    return (
        <button type="button" className="db-create-tile" onClick={onClick}>
            <span className="db-create-tile-icon">
                <Plus size={24} strokeWidth={2} />
            </span>
            <p className="db-create-tile-title">{title}</p>
            {subtitle && <p className="db-create-tile-sub">{subtitle}</p>}
        </button>
    );
}
