import { Badge } from './ui/badge';

interface SkillsListProps {
  skills: string[];
}

export function SkillsList({ skills }: SkillsListProps) {
  if (skills.length === 0) return null;

  return (
    <div className="px-4 pb-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Skills
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {skills.map((skill, i) => (
          <Badge key={i} variant="secondary" className="text-xs font-normal">
            {skill}
          </Badge>
        ))}
      </div>
    </div>
  );
}
