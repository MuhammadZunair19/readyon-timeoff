import { hash } from 'crypto';
import { createHmac } from 'crypto';

export function generateHmacSignature(payload: unknown, secret: string): string {
  const payloadStr = JSON.stringify(payload);
  return createHmac('sha256', secret).update(payloadStr).digest('hex');
}
