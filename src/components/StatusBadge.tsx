import { StopStatus } from '@/types/driver';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: StopStatus;
}

const statusConfig: Record<StopStatus, { label: string; className: string }> = {
  reached: {
    label: 'Reached',
    className: 'bg-success text-success-foreground',
  },
  current: {
    label: 'Current',
    className: 'bg-accent text-accent-foreground animate-pulse-subtle',
  },
  pending: {
    label: 'Pending',
    className: 'bg-pending/20 text-pending',
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-md text-sm font-medium',
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
