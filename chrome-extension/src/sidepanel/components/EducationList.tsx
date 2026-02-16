import type { LinkedInEducation } from '../../shared/types';
import { GraduationCap } from 'lucide-react';

interface EducationListProps {
  education: LinkedInEducation[];
}

export function EducationList({ education }: EducationListProps) {
  if (education.length === 0) return null;

  return (
    <div className="px-4 pb-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Education
      </h3>
      <div className="space-y-2.5">
        {education.map((edu, i) => (
          <div key={i} className="flex gap-2.5">
            <div className="mt-0.5">
              <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight">{edu.school}</p>
              {(edu.degree || edu.fieldOfStudy) && (
                <p className="text-xs text-muted-foreground">
                  {[edu.degree, edu.fieldOfStudy].filter(Boolean).join(', ')}
                </p>
              )}
              {(edu.startDate || edu.endDate) && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {edu.startDate || '?'} – {edu.endDate || '?'}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
