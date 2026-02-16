import { NextResponse } from 'next/server';

export async function POST(
  _request: Request,
  { params }: { params: { reportId: string } },
) {
  const { reportId } = params;

  // Proxy the refresh request to the intelligence API
  const apiUrl = process.env.INTELLIGENCE_API_URL || 'http://localhost:3001';
  const apiResponse = await fetch(`${apiUrl}/api/intelligence/refresh/${reportId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.INTERNAL_API_KEY || ''}`,
    },
  });

  if (!apiResponse.ok) {
    return NextResponse.json({ error: 'Failed to refresh report' }, { status: 500 });
  }

  const result = await apiResponse.json();
  return NextResponse.json(result);
}
