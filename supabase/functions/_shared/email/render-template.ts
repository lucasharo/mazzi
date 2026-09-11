import {
  EMAIL_TEMPLATE_CONTRACTS,
  EMAIL_TEMPLATE_FILES,
  type EmailTemplateName,
  type EmailTemplateParamsMap,
} from './email-types.ts';
import { EMAIL_TEMPLATE_SOURCES } from './email-template-sources.ts';

declare const Deno: { readTextFile(path: string | URL): Promise<string> };

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;
const RESIDUAL_PLACEHOLDER_PATTERN = /\{\{\s*[a-zA-Z][a-zA-Z0-9_]*\s*\}\}/;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractPlaceholders(source: string): string[] {
  return [...source.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1]);
}

function assertUrl(value: string, parameterName: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`EMAIL_INVALID_URL:${parameterName}`);
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error(`EMAIL_INVALID_URL:${parameterName}`);
  }
}

function assertSensitivePayoutFragment(value: string, parameterName: string): void {
  if (value === 'não informado') return;
  if (parameterName === 'bank_branch_last2' && !/^\d{2}$/.test(value)) {
    throw new Error('EMAIL_BANK_BRANCH_LAST2_REQUIRED');
  }
  if (parameterName === 'bank_account_last4' && !/^\d{4}$/.test(value)) {
    throw new Error('EMAIL_BANK_ACCOUNT_LAST4_REQUIRED');
  }
}

function validateContract(templateName: EmailTemplateName, source: string): string[] {
  const contract = EMAIL_TEMPLATE_CONTRACTS[templateName];
  const placeholders = extractPlaceholders(source);
  const uniquePlaceholders = [...new Set(placeholders)];
  const unknown = uniquePlaceholders.filter((name) => !contract.required.includes(name));
  if (unknown.length > 0) throw new Error(`EMAIL_UNKNOWN_PLACEHOLDER:${unknown.join(',')}`);

  const missingFromTemplate = contract.required.filter((name) => !uniquePlaceholders.includes(name));
  if (missingFromTemplate.length > 0) throw new Error(`EMAIL_TEMPLATE_CONTRACT_MISMATCH:${missingFromTemplate.join(',')}`);
  return uniquePlaceholders;
}

function validateParams(templateName: EmailTemplateName, source: string, params: Record<string, unknown>): string[] {
  const contract = EMAIL_TEMPLATE_CONTRACTS[templateName];
  const placeholders = validateContract(templateName, source);
  const missing = contract.required.filter((name) => typeof params[name] !== 'string' || params[name] === '');
  if (missing.length > 0) throw new Error(`EMAIL_REQUIRED_PARAMETER_MISSING:${missing.join(',')}`);

  for (const name of placeholders) {
    const value = params[name] as string;
    assertSensitivePayoutFragment(value, name);
    if (contract.urls.includes(name)) assertUrl(value, name);
  }
  return placeholders;
}

export function renderTemplate<T extends EmailTemplateName>(
  templateName: T,
  source: string,
  params: EmailTemplateParamsMap[T],
): string {
  const placeholders = validateParams(templateName, source, params as unknown as Record<string, unknown>);
  const values = params as unknown as Record<string, string>;
  const rendered = source.replace(PLACEHOLDER_PATTERN, (_match, name: string) => escapeHtml(values[name]));
  if (RESIDUAL_PLACEHOLDER_PATTERN.test(rendered)) throw new Error('EMAIL_RESIDUAL_PLACEHOLDER');
  // Keep this explicit so a future template cannot silently lose a declared field.
  if (placeholders.some((name) => rendered.includes(`{{${name}}}`))) throw new Error('EMAIL_RESIDUAL_PLACEHOLDER');
  return rendered;
}

export async function loadEmailTemplate(templateName: EmailTemplateName): Promise<string> {
  // Keep the canonical HTML files in the repository, but use TypeScript sources
  // at runtime because the MCP deployment bundle does not include static HTML.
  const filename = EMAIL_TEMPLATE_FILES[templateName];
  if (!filename || !EMAIL_TEMPLATE_SOURCES[templateName]) throw new Error('EMAIL_TEMPLATE_NOT_FOUND');
  return EMAIL_TEMPLATE_SOURCES[templateName];
}

export async function renderEmailTemplate<T extends EmailTemplateName>(
  templateName: T,
  params: EmailTemplateParamsMap[T],
): Promise<string> {
  return renderTemplate(templateName, await loadEmailTemplate(templateName), params);
}
