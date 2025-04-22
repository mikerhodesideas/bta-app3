import React from 'react';

interface StackedDistributionBarProps {
    distribution: {
        EXACT: number;
        PHRASE: number;
        BROAD: number;
    };
    height?: string; // e.g., 'h-2', 'h-3'
}

// Define colors for each match type (Tailwind classes)
// CORRECTED to match badge colors: Exact (Blue), Phrase (Orange), Broad (Grey)
const colors = {
    EXACT: 'bg-blue-500',    // Blue
    PHRASE: 'bg-orange-500', // Orange
    BROAD: 'bg-gray-500',   // Grey (using 500 for better visibility)
};

const StackedDistributionBar: React.FC<StackedDistributionBarProps> = ({
    distribution,
    height = 'h-2', // Default height
}) => {
    const { EXACT, PHRASE, BROAD } = distribution;
    const total = EXACT + PHRASE + BROAD;

    // Handle case where total is 0 to avoid division by zero
    if (total === 0) {
        return (
            <div className={`${height} w-full bg-gray-200 rounded-full overflow-hidden flex`}>
                <div className="w-full bg-gray-300"></div> {/* Show gray bar if no data */}
            </div>
        );
    }

    // Calculate percentages (ensure they sum close to 100 if needed, though flex handles it)
    const exactWidth = `${(EXACT / total) * 100}%`;
    const phraseWidth = `${(PHRASE / total) * 100}%`;
    const broadWidth = `${(BROAD / total) * 100}%`; // Remaining width

    return (
        <div className={`${height} w-full bg-gray-200 rounded-full overflow-hidden flex`} title={`Exact: ${EXACT}%, Phrase: ${PHRASE}%, Broad: ${BROAD}%`}>
            {EXACT > 0 && <div className={`${colors.EXACT}`} style={{ width: exactWidth }}></div>}
            {PHRASE > 0 && <div className={`${colors.PHRASE}`} style={{ width: phraseWidth }}></div>}
            {BROAD > 0 && <div className={`${colors.BROAD}`} style={{ width: broadWidth }}></div>}
        </div>
    );
};

export default StackedDistributionBar; 