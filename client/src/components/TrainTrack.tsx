import React from 'react';
import { DeploymentStatus } from '../types';

interface Station {
  name: string;
  displayName: string;
}

const STATIONS: Station[] = [
  { name: 'start', displayName: '🚉 Start' },
  { name: 'EDOG', displayName: 'EDOG' },
  { name: 'Daily', displayName: 'Daily' },
  { name: 'DXT', displayName: 'DXT' },
  { name: 'MSIT', displayName: 'MSIT' },
  { name: 'Canary1', displayName: 'Canary1' },
  { name: 'Canary2', displayName: 'Canary2' },
  { name: 'PROD', displayName: '🏁 PROD' },
];

interface TrainTrackProps {
  deployments?: DeploymentStatus[];
  trainPosition?: number; // 0-7 for each station
  isAnimating?: boolean;
}

export const TrainTrack: React.FC<TrainTrackProps> = ({ 
  deployments, 
  trainPosition = 0,
  isAnimating = false 
}) => {
  const getStationStatus = (stationName: string): 'deployed' | 'waiting' | 'none' => {
    if (!deployments) return 'none';
    const dep = deployments.find(d => d.environment === stationName);
    if (!dep) return 'none';
    if (dep.status === 'deployed') return 'deployed';
    if (dep.status === 'waitingForTrain') return 'waiting';
    return 'none';
  };

  return (
    <div className="w-full py-8 px-4">
      {/* Track container */}
      <div className="relative">
        {/* The rail line */}
        <div className="absolute top-1/2 left-0 right-0 h-2 bg-gray-600 -translate-y-1/2 rounded-full">
          {/* Rail ties */}
          <div className="absolute inset-0 flex justify-between px-4">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="w-1 h-4 bg-gray-700 -translate-y-1" />
            ))}
          </div>
        </div>

        {/* Stations */}
        <div className="relative flex justify-between items-center">
          {STATIONS.map((station, index) => {
            const status = getStationStatus(station.name);
            const isCurrentPosition = index === trainPosition;
            
            return (
              <div key={station.name} className="flex flex-col items-center z-10">
                {/* Station marker */}
                <div 
                  className={`
                    w-8 h-8 rounded-full border-4 flex items-center justify-center
                    transition-all duration-500
                    ${status === 'deployed' 
                      ? 'bg-green-500 border-green-300 shadow-lg shadow-green-500/50' 
                      : status === 'waiting'
                      ? 'bg-amber-500 border-amber-300 shadow-lg shadow-amber-500/50 animate-pulse'
                      : 'bg-gray-700 border-gray-500'
                    }
                    ${isCurrentPosition && isAnimating ? 'ring-4 ring-blue-400 ring-opacity-50' : ''}
                  `}
                >
                  {status === 'deployed' && <span className="text-xs">✓</span>}
                  {status === 'waiting' && <span className="text-xs">⏳</span>}
                </div>
                
                {/* Station name */}
                <span className={`
                  mt-2 text-xs font-medium
                  ${status === 'deployed' ? 'text-green-400' : 
                    status === 'waiting' ? 'text-amber-400' : 'text-gray-400'}
                `}>
                  {station.displayName}
                </span>
              </div>
            );
          })}
        </div>

        {/* Train */}
        <div 
          className={`
            absolute top-1/2 -translate-y-1/2 transition-all
            ${isAnimating ? 'duration-1000 ease-in-out' : 'duration-0'}
          `}
          style={{ 
            left: `calc(${(trainPosition / (STATIONS.length - 1)) * 100}% - 20px)`,
          }}
        >
          <div className="text-3xl transform -translate-y-1">
            🚂
          </div>
        </div>
      </div>
    </div>
  );
};
