import React from 'react';

interface ProgressDisplayProps {
  progress: string;
}

const ProgressDisplay: React.FC<ProgressDisplayProps> = ({ progress }) => {
  return (
    <div className="my-4 p-4 bg-slate-800 rounded-lg shadow-inner">
      <p className="text-slate-300 text-lg">{progress}</p>
    </div>
  );
};

export default ProgressDisplay;