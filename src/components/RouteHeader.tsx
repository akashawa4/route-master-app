import { Bus, Route } from 'lucide-react';

interface RouteHeaderProps {
  driverName: string;
  busNumber: string;
  routeName: string;
}

export function RouteHeader({ driverName, busNumber, routeName }: RouteHeaderProps) {
  return (
    <header className="bg-card border-b border-border">
      <div className="container py-4">
        <h1 className="text-xl font-bold text-foreground mb-3">
          Welcome, {driverName}
        </h1>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-lg border border-primary/20">
            <Bus className="w-5 h-5" />
            <span className="font-semibold">{busNumber}</span>
          </div>
          <div className="flex items-center gap-2 bg-accent/10 text-accent px-3 py-2 rounded-lg border border-accent/20">
            <Route className="w-5 h-5" />
            <span className="font-semibold">{routeName}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
