import type { LinkedInProfile } from '../../shared/types';
import { ProfileCard } from './ProfileCard';
import { ExperienceList } from './ExperienceList';
import { EducationList } from './EducationList';
import { SkillsList } from './SkillsList';
import { Card, CardContent } from './ui/card';

interface LinkedInPreviewProps {
  profile: LinkedInProfile;
}

export function LinkedInPreview({ profile }: LinkedInPreviewProps) {
  return (
    <div className="space-y-1">
      <ProfileCard profile={profile} />

      {/* About */}
      {profile.about && (
        <div className="px-4 pb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            About
          </h3>
          <Card>
            <CardContent className="p-3">
              <p className="text-sm text-foreground leading-relaxed line-clamp-6">
                {profile.about}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <ExperienceList experiences={profile.experiences} />
      <EducationList education={profile.education} />
      <SkillsList skills={profile.skills} />

      {/* Additional info */}
      {(profile.certifications.length > 0 || profile.languages.length > 0) && (
        <div className="px-4 pb-3 space-y-2">
          {profile.certifications.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Certifications
              </h3>
              <p className="text-xs text-muted-foreground">
                {profile.certifications.join(' · ')}
              </p>
            </div>
          )}
          {profile.languages.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Languages
              </h3>
              <p className="text-xs text-muted-foreground">
                {profile.languages.join(' · ')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
