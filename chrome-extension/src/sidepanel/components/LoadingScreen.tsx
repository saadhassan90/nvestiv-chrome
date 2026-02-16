import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
import { Loader2 } from 'lucide-react';

export function LoadingScreen() {
  return (
    <div className="flex flex-col gap-4 p-4 animate-fade-in">
      {/* Status indicator */}
      <div className="flex justify-center py-2">
        <Badge variant="secondary" className="gap-1.5 px-3 py-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="text-xs">Checking intelligence status</span>
        </Badge>
      </div>

      {/* Profile header skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>

      {/* Content skeletons */}
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}
