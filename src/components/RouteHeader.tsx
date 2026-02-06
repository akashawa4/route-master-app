import { Bus, Route } from 'lucide-react';

interface RouteHeaderProps {
  driverName: string;
  busNumber: string;
  routeName: string;
}

export function RouteHeader({ driverName, busNumber, routeName }: RouteHeaderProps) {
  return (
    <header className="bg-card border-b border-border sticky top-0 z-10 shadow-sm safe-area-inset-top">
      <div className="container py-2.5 sm:py-3">
        {/* Driver Welcome */}
        <h1 className="text-base sm:text-lg font-bold text-foreground mb-2 truncate">
          Welcome, {driverName}
        </h1>

        {/* Info Chips - Responsive */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {/* Bus Number Chip */}
          <div className="info-chip bg-primary/10 text-primary border-primary/20 flex-shrink-0">
            <Bus className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            <span>{busNumber}</span>
          </div>

          {/* Route Name Chip - Can grow and truncate */}
          <div className="info-chip bg-accent/10 text-accent border-accent/20 min-w-0 flex-1 max-w-full">
            <Route className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            <span className="truncate">{routeName}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
