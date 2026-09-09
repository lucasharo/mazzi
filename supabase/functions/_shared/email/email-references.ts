const PUBLIC_REFERENCE_PATTERN = /^MAZZI-[A-Z]+-[A-Z0-9]{8,}$/;

export function assertPublicReference(value: string, fieldName: string): string {
  const reference = value.trim().toUpperCase();
  if (!PUBLIC_REFERENCE_PATTERN.test(reference) || reference.includes('-00000000')) {
    throw new Error(`EMAIL_PUBLIC_REFERENCE_INVALID:${fieldName}`);
  }
  return reference;
}

export function buildEmailIdempotencyKey(input: {
  eventType: string;
  templateName: string;
  businessEntityId: string;
  recipientUserId: string;
}): string {
  return [input.eventType, input.templateName, input.businessEntityId, input.recipientUserId].join(':');
}
