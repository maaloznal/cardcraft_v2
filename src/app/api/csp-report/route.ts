/**
 * CSP violation report endpoint (P19.8).
 *
 * Receives Content-Security-Policy violation reports from the browser
 * via the Reporting API. In production this should forward to a monitoring
 * service (Sentry, Datadog, etc). Currently logs to the structured logger.
 *
 * POST /api/csp-report
 * Body: { type: 'csp-violation', body: { documentURL, lineNumber, columnNumber, violatedDirective, ... } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';

const log = createLogger('CSP');

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    // CSP reports contain violation details — log them for monitoring
    const violation = body?.body ?? body;
    log.warn('CSP violation reported', {
      documentURL: violation?.documentURL,
      violatedDirective: violation?.violatedDirective,
      blockedURL: violation?.blockedURL,
      sourceFile: violation?.sourceFile,
      lineNumber: violation?.lineNumber,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error('Failed to parse CSP report', { error: String(err) });
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
