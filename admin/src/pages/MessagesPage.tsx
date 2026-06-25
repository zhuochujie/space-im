import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { getErrorMessage } from '../lib/errors'
import { formatMessageTime } from '../lib/format'
import {
  extractMessages,
  extractMessageTotal,
  previewContent,
} from '../lib/messages'
import type { PageProps } from '../types'

const EMPTY_FILTERS = {
  sendID: '',
  recvID: '',
  groupID: '',
  keyword: '',
  count: '50',
}

export function MessagesPage({
  loading,
  request,
  setError,
  setLoading,
  setNotice,
}: PageProps) {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [rawResult, setRawResult] = useState<unknown>(null)
  const rows = useMemo(() => extractMessages(rawResult), [rawResult])
  const total = useMemo(() => extractMessageTotal(rawResult), [rawResult])
  const hasSearched = rawResult !== null

  async function searchMessages(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setNotice('')
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value.trim()) {
          params.set(key, value.trim())
        }
      })
      const data = await request<unknown>(
        `/admin/messages?${params.toString()}`,
      )
      setRawResult(data)
      setNotice('聊天记录查询完成')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  function updateFilter(key: keyof typeof EMPTY_FILTERS, value: string) {
    setFilters({ ...filters, [key]: value })
  }

  return (
    <section className="panel">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Message Audit</p>
          <h2>聊天记录</h2>
        </div>
      </div>

      <form className="filters messageFilters" onSubmit={searchMessages}>
        <input
          value={filters.sendID}
          onChange={(event) => updateFilter('sendID', event.target.value)}
          placeholder="发送者 userID"
        />
        <input
          value={filters.recvID}
          onChange={(event) => updateFilter('recvID', event.target.value)}
          placeholder="接收者 userID"
        />
        <input
          value={filters.groupID}
          onChange={(event) => updateFilter('groupID', event.target.value)}
          placeholder="群 ID"
        />
        <input
          value={filters.keyword}
          onChange={(event) => updateFilter('keyword', event.target.value)}
          placeholder="关键词"
        />
        <input
          value={filters.count}
          onChange={(event) => updateFilter('count', event.target.value)}
          type="number"
          min="1"
          max="100"
          placeholder="条数"
        />
        <button type="submit" disabled={loading}>
          查询
        </button>
      </form>

      {hasSearched && (
        <div className="resultSummary">
          <span>
            {total === null ? '当前显示' : `共 ${total} 条，当前显示`}{' '}
            {rows.length} 条
          </span>
          {total !== null && total > 0 && rows.length === 0 && (
            <span className="muted">
              OpenIM 返回了总数，但当前页没有聊天记录，请调整分页或筛选条件后重试
            </span>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>发送者</th>
                <th>接收者/群</th>
                <th>类型</th>
                <th>内容</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.clientMsgID ?? index}>
                  <td>{formatMessageTime(row.sendTime)}</td>
                  <td className="mono">{row.sendID || '-'}</td>
                  <td className="mono">{row.groupID || row.recvID || '-'}</td>
                  <td>{row.contentType ?? '-'}</td>
                  <td>{previewContent(row.content)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <pre className="rawJson">
        {rawResult ? JSON.stringify(rawResult, null, 2) : '暂无查询结果'}
      </pre>
    </section>
  )
}
