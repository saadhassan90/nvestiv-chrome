import { NvestivLogomark } from '@/components/NvestivLogo';

export default function HomePage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center space-y-4">
        <NvestivLogomark className="w-12 h-12 mx-auto" />
        <h1 className="text-2xl font-bold text-slate-900">Nvestiv Intelligence</h1>
        <p className="text-slate-500 text-sm">Report viewer. Access reports via /r/[reportId]</p>
      </div>
    </div>
  );
}
