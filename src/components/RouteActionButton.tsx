import { Button } from '@/components/ui/button';
import { RouteState } from '@/types/driver';
import { Play, CheckCircle, Flag } from 'lucide-react';

interface RouteActionButtonProps {
  routeState: RouteState;
  currentStopName?: string;
  isLastStop?: boolean;
  onStartRoute: () => void;
  onMarkReached: () => void;
}

export function RouteActionButton({
  routeState,
  currentStopName,
  isLastStop = false,
  onStartRoute,
  onMarkReached,
}: RouteActionButtonProps) {
  if (routeState === 'not_started') {
    return (
      <Button
        onClick={onStartRoute}
        size="lg"
        className="w-full h-16 text-lg font-bold gap-3 shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all"
      >
        <Play className="w-6 h-6" />
        START ROUTE
      </Button>
    );
  }

  if (routeState === 'in_progress') {
    if (isLastStop) {
      return (
        <Button
          onClick={onMarkReached}
          size="lg"
          className="w-full h-16 text-lg font-bold gap-3 bg-success hover:bg-success/90 shadow-lg shadow-success/30 hover:shadow-xl hover:shadow-success/40 transition-all animate-pulse"
        >
          <Flag className="w-6 h-6" />
          FINISH ROUTE
        </Button>
      );
    }
    
    return (
      <Button
        onClick={onMarkReached}
        size="lg"
        className="w-full h-16 text-lg font-bold gap-3 bg-success hover:bg-success/90 shadow-lg shadow-success/30 hover:shadow-xl hover:shadow-success/40 transition-all"
      >
        <CheckCircle className="w-6 h-6" />
        MARK CURRENT STOP AS REACHED
      </Button>
    );
  }

  return (
    <Button
      disabled
      size="lg"
      variant="secondary"
      className="w-full h-14 text-lg font-semibold gap-2"
    >
      <Flag className="w-5 h-5" />
      ROUTE COMPLETED
    </Button>
  );
}
