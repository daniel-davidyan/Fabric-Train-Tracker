import { DeploymentStatus } from '../types'

interface StatusBadgeProps {
  status: DeploymentStatus['status']
  size?: 'sm' | 'md' | 'lg'
}

function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'deployed':
        return {
          color: 'bg-green-500',
          text: 'Deployed',
          emoji: '✅',
          animate: false,
        }
      case 'inProgress':
        return {
          color: 'bg-yellow-500',
          text: 'In Progress',
          emoji: '🔄',
          animate: true,
        }
      case 'pending':
        return {
          color: 'bg-blue-500',
          text: 'Pending',
          emoji: '⏳',
          animate: false,
        }
      case 'waitingForTrain':
        return {
          color: 'bg-amber-500',
          text: 'Waiting for Train',
          emoji: '🚂',
          animate: true,
        }
      case 'notDeployed':
        return {
          color: 'bg-slate-500',
          text: 'Not Deployed',
          emoji: '⚪',
          animate: false,
        }
      case 'unknown':
        return {
          color: 'bg-gray-500',
          text: 'Unknown',
          emoji: '❓',
          animate: false,
        }
      default:
        return {
          color: 'bg-slate-600',
          text: 'Unknown',
          emoji: '❓',
          animate: false,
        }
    }
  }

  const config = getStatusConfig()

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2',
  }

  const dotSizes = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium text-white ${sizeClasses[size]}`}
    >
      <span
        className={`${dotSizes[size]} rounded-full ${config.color} ${
          config.animate ? 'animate-pulse' : ''
        }`}
      ></span>
      <span>{config.text}</span>
    </span>
  )
}

export default StatusBadge