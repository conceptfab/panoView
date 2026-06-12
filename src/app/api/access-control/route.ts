import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import {
  getAccessControl,
  addToWhitelist,
  addToBlacklist,
} from '@/lib/auth/access-control';
import { z } from 'zod';

const addRuleSchema = z.object({
  type: z.enum(['whitelist', 'blacklist']),
  pattern: z.string().min(1),
  notes: z.string().default(''),
});

export async function GET() {
  try {
    await requireAdmin();
    const accessControl = await getAccessControl();
    return NextResponse.json(accessControl);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to fetch access control' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { type, pattern, notes } = addRuleSchema.parse(body);

    const rule =
      type === 'whitelist'
        ? await addToWhitelist(pattern, notes)
        : await addToBlacklist(pattern, notes);

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to add rule' }, { status: 500 });
  }
}
