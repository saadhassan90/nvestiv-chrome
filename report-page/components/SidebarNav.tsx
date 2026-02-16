'use client';

import { useState, useEffect } from 'react';
import type { ReportContent } from '@/lib/types';

interface SidebarNavProps {
  report: ReportContent;
}

export function SidebarNav({ report }: SidebarNavProps) {
  const [activeSection, setActiveSection] = useState('executive-summary');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-100px 0px -60% 0px', threshold: 0 },
    );

    // Observe all section elements
    const sections = document.querySelectorAll('section[id]');
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  const navItems = [
    { id: 'executive-summary', label: 'Executive Summary' },
    ...report.sections.map((s) => ({
      id: s.section_id,
      label: s.title,
    })),
    { id: 'bibliography', label: 'Bibliography' },
  ];

  return (
    <aside className="sidebar-wrapper hidden lg:block w-64 fixed h-[calc(100vh-4rem)] top-16 left-0 border-r border-slate-200 bg-slate-50/50 overflow-y-auto no-print">
      <div className="p-6">
        {/* Outline nav */}
        <div className="mb-8">
          <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-3">
            Outline
          </h5>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`sidebar-nav-link ${activeSection === item.id ? 'active' : ''}`}
                onClick={() => setActiveSection(item.id)}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        {/* Subject info card */}
        <div className="border-t border-slate-200 pt-6 px-3">
          <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Subject
          </h5>
          <div className="flex items-center gap-3">
            {report.subject.profile_photo_url ? (
              <img
                src={report.subject.profile_photo_url}
                alt={report.subject.full_name}
                className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-sm"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600 border border-slate-300 shadow-sm">
                {report.subject.full_name.charAt(0)}
              </div>
            )}
            <div className="leading-tight min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">
                {report.subject.full_name}
              </div>
              {report.subject.current_company && (
                <div className="text-xs text-slate-500 font-medium truncate">
                  {report.subject.current_company}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Source stats */}
        <div className="border-t border-slate-200 mt-6 pt-6 px-3">
          <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Sources
          </h5>
          <div className="text-2xl font-bold text-slate-900">
            {report.bibliography.total_sources}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {Object.entries(report.bibliography.sources_by_type)
              .filter(([, count]) => count > 0)
              .slice(0, 3)
              .map(([type, count]) => `${count} ${type}`)
              .join(' · ')}
          </div>
        </div>
      </div>
    </aside>
  );
}
