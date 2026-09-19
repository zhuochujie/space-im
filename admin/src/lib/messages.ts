import type { MessageRow } from '../types'

export function extractMessages(value: unknown): MessageRow[] {
  if (Array.isArray(value)) {
    return sortMessagesDescending(value.map(unwrapMessageRow).filter(isMessageRow))
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

function sortMessagesDescending(rows: MessageRow[]): MessageRow[] {
  return [...rows].sort((left, right) => {
    const leftTime = normalizeMessageTime(left.sendTime)
    const rightTime = normalizeMessageTime(right.sendTime)
    return rightTime - leftTime
  })
}

function normalizeMessageTime(value?: number): number {
  if (!value) {
    return 0
  }
  return value < 10_000_000_000 ? value * 1000 : value
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
  const text =
    record.text ??
    record.content ??
    record.description ??
    getNestedText(record.textElem) ??
    getNestedText(record.atTextElem) ??
    getNestedText(record.quoteElem)
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

function unwrapMessageRow(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value
  }
  const record = value as Record<string, unknown>
  const chatLog = record.chatLog ?? record.msgData ?? record.message
  if (!chatLog || typeof chatLog !== 'object') {
    return value
  }
  return {
    ...(chatLog as Record<string, unknown>),
    ...(typeof record.isRevoked === 'boolean'
      ? { isRevoked: record.isRevoked }
      : {}),
  }
}

function getNestedText(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }
  const record = value as Record<string, unknown>
  const text = record.content ?? record.text
  return typeof text === 'string' ? text : undefined
}

function isMessageRow(value: unknown): value is MessageRow {
  return Boolean(value && typeof value === 'object')
}
