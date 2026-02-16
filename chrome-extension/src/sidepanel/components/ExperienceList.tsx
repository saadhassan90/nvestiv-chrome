import type { LinkedInExperience } from '../../shared/types';
import { Briefcase } from 'lucide-react';

interface ExperienceListProps {
  experiences: LinkedInExperience[];
}

export function ExperienceList({ experiences }: ExperienceListProps) {
  if (experiences.length === 0) return null;

  return (
    <div className="px-4 pb-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Experience
      </h3>
      <div className="space-y-3">
        {experiences.map((exp, i) => (
          <div key={i} className="flex gap-2.5">
            <div className="mt-0.5">
              {exp.companyLogoUrl ? (
                <img
                  src={exp.companyLogoUrl}
                  alt={exp.company}
                  className="w-8 h-8 rounded-md object-cover border border-border"
                />
              ) : (
                <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight">{exp.title}</p>
              <p className="text-xs text-muted-foreground">{exp.company}</p>
              {(exp.startDate || exp.endDate) && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {exp.startDate || '?'} – {exp.isCurrent ? 'Present' : exp.endDate || '?'}
                </p>
              )}
              {exp.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{exp.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
