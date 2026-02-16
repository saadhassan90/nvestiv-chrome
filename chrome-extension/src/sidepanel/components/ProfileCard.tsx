import type { LinkedInProfile } from '../../shared/types';
import { Badge } from './ui/badge';
import { MapPin, Users } from 'lucide-react';

/** LinkedIn "in" badge icon */
function LinkedInBadge() {
  return (
    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-linkedin flex items-center justify-center ring-2 ring-background">
      <svg viewBox="0 0 24 24" fill="white" className="w-3 h-3">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    </div>
  );
}

interface ProfileCardProps {
  profile: LinkedInProfile;
  compact?: boolean;
}

export function ProfileCard({ profile, compact = false }: ProfileCardProps) {
  return (
    <div className={`flex items-start gap-3 ${compact ? 'p-3' : 'p-4'}`}>
      {/* Avatar with LinkedIn badge */}
      <div className="relative shrink-0">
        {profile.photoUrl ? (
          <img
            src={profile.photoUrl}
            alt={profile.fullName}
            className={`${compact ? 'w-11 h-11' : 'w-14 h-14'} rounded-full object-cover border-2 border-border`}
          />
        ) : (
          <div className={`${compact ? 'w-11 h-11' : 'w-14 h-14'} rounded-full bg-brand-light flex items-center justify-center border-2 border-border`}>
            <span className={`${compact ? 'text-base' : 'text-lg'} font-semibold text-brand`}>
              {profile.fullName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <LinkedInBadge />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h2 className={`${compact ? 'text-sm' : 'text-base'} font-semibold truncate`}>{profile.fullName}</h2>
        {profile.headline && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">{profile.headline}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
          {profile.location && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {profile.location}
            </span>
          )}
          {profile.connectionCount && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              {profile.connectionCount}
            </span>
          )}
        </div>
        {profile.currentCompany && (
          <Badge variant="secondary" className="mt-2 text-xs font-normal">
            {profile.currentTitle ? `${profile.currentTitle} at ${profile.currentCompany}` : profile.currentCompany}
          </Badge>
        )}
      </div>
    </div>
  );
}
