import { cn } from '@/lib/utils';
import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

type MessageType = 'error' | 'warning' | 'info' | 'success';

interface InlineMessageProps {
  type: MessageType;
  message: string;
}

const messageConfig: Record<MessageType, { icon: typeof AlertCircle; className: string }> = {
  error: {
    icon: AlertCircle,
    className: 'text-destructive',
  },
  warning: {
    icon: AlertTriangle,
    className: 'text-warning',
  },
  info: {
    icon: Info,
    className: 'text-muted-foreground',
  },
  success: {
    icon: CheckCircle2,
    className: 'text-green-600 dark:text-green-400',
  },
};

export function InlineMessage({ type, message }: InlineMessageProps) {
  const config = messageConfig[type];
  const Icon = config.icon;

  const isSuccess = type === 'success';

  return (
    <div className={cn(
      'flex items-center gap-2',
      isSuccess ? 'text-base font-semibold' : 'text-sm',
      config.className
    )}>
      <Icon className={cn('flex-shrink-0', isSuccess ? 'w-5 h-5' : 'w-4 h-4')} />
      <span>{message}</span>
    </div>
  );
}
