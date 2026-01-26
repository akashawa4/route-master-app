import { Stop } from '@/types/driver';
import { StatusBadge } from './StatusBadge';
import { MapPin } from 'lucide-react';

interface StopsListProps {
  stops: Stop[];
}

export function StopsList({ stops }: StopsListProps) {
  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-3 bg-secondary border-b border-border">
        <h3 className="font-medium text-foreground">Route Stops</h3>
      </div>
      <ul className="divide-y divide-border">
        {stops.map((stop, index) => (
          <li
            key={stop.id}
            className="flex items-center justify-between px-4 py-4 hover:bg-secondary/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-muted-foreground font-medium text-sm">
                {index + 1}
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{stop.name}</span>
              </div>
            </div>
            <StatusBadge status={stop.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
