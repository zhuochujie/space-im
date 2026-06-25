import type { MessageRow } from '../types'

export function extractMessages(value: unknown): MessageRow[] {
  if (Array.isArray(value)) {
    return value.filter(isMessageRow)
  }
  if (!value || typeof value !== 'object') {
    return []
  }
  const record = value as Record<string, unknown>
  const candidates = [
    record.chatLogs,
    record.messages,
    record.messageList,
    record.msgs,
    record.items,
    record.data,
  ]
  for (const candidate of candidates) {
    const rows = extractMessages(candidate)
    if (rows.length > 0) {
      return rows
    }
  }
  return []
}

export function extractMessageTotal(value: unknown): number | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  const total =
    record.chatLogsNum ??
    record.total ??
    record.totalCount ??
    record.count ??
    record.messageCount
  return typeof total === 'number' && Number.isFinite(total) ? total : null
}

export function previewContent(content: unknown): string {
  if (!content) {
    return '-'
  }
  if (typeof content === 'string') {
    return previewStringContent(content)
  }
  if (typeof content !== 'object') {
    return String(content)
  }
  const record = content as Record<string, unknown>
  const text = record.content ?? record.text ?? record.description
  if (typeof text === 'string') {
    return text
  }
  return JSON.stringify(content)
}

function previewStringContent(content: string): string {
  try {
    return previewContent(JSON.parse(content))
  } catch {
    return content
  }
}

function isMessageRow(value: unknown): value is MessageRow {
  return Boolean(value && typeof value === 'object')
}
