import { NextResponse } from 'next/server';

export async function POST(
  _request: Request,
  { params }: { params: { reportId: string } },
) {
  const { reportId } = params;

  // Call the intelligence API CRM enrichment endpoint
  const apiUrl = process.env.INTELLIGENCE_API_URL || 'http://localhost:3001';
  const apiResponse = await fetch(`${apiUrl}/api/intelligence/crm/enrich`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.INTERNAL_API_KEY || ''}`,
    },
    body: JSON.stringify({ report_id: reportId }),
  });

  if (!apiResponse.ok) {
    return NextResponse.json({ error: 'Failed to send to CRM' }, { status: 500 });
  }

  const result = await apiResponse.json();
  return NextResponse.json(result);
}
