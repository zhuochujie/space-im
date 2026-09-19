import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { getErrorMessage } from '../lib/errors'
import { formatMessageTime } from '../lib/format'
import {
  extractMessages,
  extractMessageTotal,
  previewContent,
} from '../lib/messages'
import type {
  AdminGroup,
  AdminGroupMember,
  GroupInfoResponse,
  GroupListResponse,
  GroupMembersResponse,
  PageProps,
} from '../types'

const GROUP_FILTERS = {
  groupID: '',
  userID: '',
  groupCount: '50',
}

const MEMBER_FILTERS = {
  keyword: '',
  count: '50',
}

const MESSAGE_FILTERS = {
  sendID: '',
  contentType: '',
  count: '50',
}

export function GroupsPage({
  loading,
  request,
  setError,
  setLoading,
  setNotice,
}: PageProps) {
  const [groupFilters, setGroupFilters] = useState(GROUP_FILTERS)
  const [memberFilters, setMemberFilters] = useState(MEMBER_FILTERS)
  const [messageFilters, setMessageFilters] = useState(MESSAGE_FILTERS)
  const [groups, setGroups] = useState<AdminGroup[]>([])
  const [groupTotal, setGroupTotal] = useState<number | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<AdminGroup | null>(null)
  const [members, setMembers] = useState<AdminGroupMember[]>([])
  const [memberTotal, setMemberTotal] = useState<number | null>(null)
  const [rawMessages, setRawMessages] = useState<unknown>(null)
  const [messagePage, setMessagePage] = useState(1)
  const messageRows = useMemo(() => extractMessages(rawMessages), [rawMessages])
  const messageTotal = useMemo(
    () => extractMessageTotal(rawMessages),
    [rawMessages],
  )
  const messagePageSize = parsePositiveInt(messageFilters.count, 50)
  const messageTotalPages =
    messageTotal === null
      ? null
      : Math.max(1, Math.ceil(messageTotal / messagePageSize))
  const canGoPreviousMessagePage = messagePage > 1 && !loading
  const canGoNextMessagePage =
    !loading &&
    (messageTotalPages === null
      ? messageRows.length >= messagePageSize
      : messagePage < messageTotalPages)

  async function searchGroup(event: FormEvent) {
    event.preventDefault()
    const groupID = groupFilters.groupID.trim()
    if (!groupID) {
      setError('请输入群号')
      return
    }
    await loadGroup(groupID)
  }

  async function listJoinedGroups(event: FormEvent) {
    event.preventDefault()
    const userID = groupFilters.userID.trim()
    if (!userID) {
      setError('请输入用户 ID')
      return
    }
    setLoading(true)
    setNotice('')
    try {
      const params = new URLSearchParams({
        userID,
        count: groupFilters.groupCount.trim() || '50',
      })
      const data = await request<GroupListResponse>(
        `/admin/groups?${params.toString()}`,
      )
      setGroups(data.groups)
      setGroupTotal(data.total)
      setNotice('已查询用户加入的群')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function loadGroup(groupID: string) {
    setLoading(true)
    setNotice('')
    try {
      const data = await request<GroupInfoResponse>(
        `/admin/groups/${encodeURIComponent(groupID)}`,
      )
      if (!data.group) {
        setSelectedGroup(null)
        setMembers([])
        setRawMessages(null)
        setError('没有找到这个群')
        return
      }
      setSelectedGroup(data.group)
      setGroupFilters((current) => ({ ...current, groupID: data.group!.groupID }))
      setNotice('群信息查询完成')
      await Promise.all([
        loadMembers(data.group.groupID),
        fetchGroupMessages(data.group.groupID, 1),
      ])
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function refreshMembers(event: FormEvent) {
    event.preventDefault()
    if (!selectedGroup) {
      setError('请先选择群')
      return
    }
    setLoading(true)
    setNotice('')
    try {
      await loadMembers(selectedGroup.groupID)
      setNotice('群成员查询完成')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function refreshMessages(event: FormEvent) {
    event.preventDefault()
    if (!selectedGroup) {
      setError('请先选择群')
      return
    }
    setLoading(true)
    setNotice('')
    try {
      await fetchGroupMessages(selectedGroup.groupID, 1)
      setNotice('群消息查询完成')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function loadMembers(groupID: string) {
    const params = new URLSearchParams()
    if (memberFilters.keyword.trim()) {
      params.set('keyword', memberFilters.keyword.trim())
    }
    params.set('count', memberFilters.count.trim() || '50')
    const data = await request<GroupMembersResponse>(
      `/admin/groups/${encodeURIComponent(groupID)}/members?${params.toString()}`,
    )
    setMembers(data.members)
    setMemberTotal(data.total)
  }

  async function fetchGroupMessages(groupID: string, nextPage: number) {
    const params = new URLSearchParams()
    Object.entries(messageFilters).forEach(([key, value]) => {
      if (value.trim()) {
        params.set(key, value.trim())
      }
    })
    params.set('page', String(nextPage))
    const data = await request<unknown>(
      `/admin/groups/${encodeURIComponent(groupID)}/messages?${params.toString()}`,
    )
    setRawMessages(data)
    setMessagePage(nextPage)
  }

  async function changeMessagePage(nextPage: number) {
    if (!selectedGroup) {
      setError('请先选择群')
      return
    }
    setLoading(true)
    setNotice('')
    try {
      await fetchGroupMessages(selectedGroup.groupID, nextPage)
      setNotice('群消息查询完成')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  function updateGroupFilter(key: keyof typeof GROUP_FILTERS, value: string) {
    setGroupFilters({ ...groupFilters, [key]: value })
  }

  function updateMemberFilter(key: keyof typeof MEMBER_FILTERS, value: string) {
    setMemberFilters({ ...memberFilters, [key]: value })
  }

  function updateMessageFilter(key: keyof typeof MESSAGE_FILTERS, value: string) {
    setMessageFilters({ ...messageFilters, [key]: value })
  }

  return (
    <section className="panel">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Group Audit</p>
          <h2>群管理</h2>
        </div>
      </div>

      <div className="groupTools">
        <form className="filters groupFilters" onSubmit={searchGroup}>
          <input
            value={groupFilters.groupID}
            onChange={(event) => updateGroupFilter('groupID', event.target.value)}
            placeholder="群号"
          />
          <button type="submit" disabled={loading}>
            查看群
          </button>
        </form>

        <form className="filters groupFilters" onSubmit={listJoinedGroups}>
          <input
            value={groupFilters.userID}
            onChange={(event) => updateGroupFilter('userID', event.target.value)}
            placeholder="用户 ID"
          />
          <input
            value={groupFilters.groupCount}
            onChange={(event) =>
              updateGroupFilter('groupCount', event.target.value)
            }
            type="number"
            min="1"
            max="100"
            placeholder="条数"
          />
          <button type="submit" disabled={loading}>
            查询群列表
          </button>
        </form>
      </div>

      {groups.length > 0 && (
        <>
          <div className="resultSummary">
            <span>
              {groupTotal === null ? '当前显示' : `共 ${groupTotal} 个，当前显示`}{' '}
              {groups.length} 个
            </span>
          </div>
          <div className="tableWrap groupList">
            <table>
              <thead>
                <tr>
                  <th>群名称</th>
                  <th>群号</th>
                  <th>群主</th>
                  <th>成员数</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.groupID}>
                    <td>{group.groupName || '-'}</td>
                    <td className="mono">{group.groupID}</td>
                    <td className="mono">{group.ownerUserID || '-'}</td>
                    <td>{group.memberCount ?? '-'}</td>
                    <td>
                      <button
                        className="secondary"
                        type="button"
                        disabled={loading}
                        onClick={() => void loadGroup(group.groupID)}
                      >
                        查看
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selectedGroup ? (
        <GroupDetails group={selectedGroup} />
      ) : (
        <p className="emptyBlock">请输入群号，或先按用户查询已加入的群。</p>
      )}

      {selectedGroup && (
        <div className="groupSections">
          <section className="subPanel">
            <div className="sectionHeader compact">
              <div>
                <p className="eyebrow">Members</p>
                <h3>群成员</h3>
              </div>
              <span className="muted">
                {memberTotal === null ? `当前 ${members.length} 人` : `共 ${memberTotal} 人`}
              </span>
            </div>
            <form className="filters compactFilters" onSubmit={refreshMembers}>
              <input
                value={memberFilters.keyword}
                onChange={(event) =>
                  updateMemberFilter('keyword', event.target.value)
                }
                placeholder="搜索成员"
              />
              <input
                value={memberFilters.count}
                onChange={(event) => updateMemberFilter('count', event.target.value)}
                type="number"
                min="1"
                max="100"
                placeholder="条数"
              />
              <button type="submit" disabled={loading}>
                查询
              </button>
            </form>
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>用户</th>
                    <th>昵称</th>
                    <th>角色</th>
                    <th>入群时间</th>
                    <th>禁言到期</th>
                  </tr>
                </thead>
                <tbody>
                  {members.length > 0 ? (
                    members.map((member) => (
                      <tr key={member.userID}>
                        <td className="mono">{member.userID}</td>
                        <td>{member.nickname || '-'}</td>
                        <td>{groupRoleText(member.roleLevel)}</td>
                        <td>{formatMessageTime(member.joinTime)}</td>
                        <td>{formatMuteTime(member.muteEndTime)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="empty" colSpan={5}>
                        暂无成员数据
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="subPanel">
            <div className="sectionHeader compact">
              <div>
                <p className="eyebrow">Messages</p>
                <h3>群聊天记录</h3>
              </div>
              <span className="muted">
                {messageTotal === null
                  ? `第 ${messagePage} 页，当前 ${messageRows.length} 条`
                  : `共 ${messageTotal} 条，第 ${messagePage}/${messageTotalPages} 页`}
              </span>
            </div>
            <form
              className="filters compactFilters messageGroupFilters"
              onSubmit={refreshMessages}
            >
              <input
                value={messageFilters.sendID}
                onChange={(event) =>
                  updateMessageFilter('sendID', event.target.value)
                }
                placeholder="发送者 userID"
              />
              <input
                value={messageFilters.contentType}
                onChange={(event) =>
                  updateMessageFilter('contentType', event.target.value)
                }
                type="number"
                min="0"
                placeholder="消息类型"
              />
              <input
                value={messageFilters.count}
                onChange={(event) =>
                  updateMessageFilter('count', event.target.value)
                }
                type="number"
                min="1"
                max="100"
                placeholder="条数"
              />
              <button type="submit" disabled={loading}>
                查询
              </button>
            </form>
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>发送者</th>
                    <th>类型</th>
                    <th>内容</th>
                  </tr>
                </thead>
                <tbody>
                  {messageRows.length > 0 ? (
                    messageRows.map((row, index) => (
                      <tr key={row.clientMsgID ?? index}>
                        <td>{formatMessageTime(row.sendTime)}</td>
                        <td className="mono">
                          {row.senderNickname || row.sendID || '-'}
                        </td>
                        <td>{row.contentType ?? '-'}</td>
                        <td>
                          {row.isRevoked ? '已撤回' : previewContent(row.content)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="empty" colSpan={4}>
                        暂无聊天记录
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="pager pagerBottom">
              <button
                className="secondary"
                type="button"
                disabled={!canGoPreviousMessagePage}
                onClick={() => void changeMessagePage(messagePage - 1)}
              >
                上一页
              </button>
              <button
                className="secondary"
                type="button"
                disabled={!canGoNextMessagePage}
                onClick={() => void changeMessagePage(messagePage + 1)}
              >
                下一页
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

function GroupDetails({ group }: { group: AdminGroup }) {
  return (
    <div className="detailsGrid">
      <Detail label="群名称" value={group.groupName || '-'} />
      <Detail label="群号" value={group.groupID} mono />
      <Detail label="群主" value={group.ownerUserID || '-'} mono />
      <Detail label="创建者" value={group.creatorUserID || '-'} mono />
      <Detail label="成员数" value={String(group.memberCount ?? '-')} />
      <Detail label="创建时间" value={formatMessageTime(group.createTime)} />
      <Detail label="状态" value={String(group.status ?? '-')} />
      <Detail label="类型" value={String(group.groupType ?? '-')} />
      <Detail label="群公告" value={group.notification || '-'} wide />
      <Detail label="群介绍" value={group.introduction || '-'} wide />
    </div>
  )
}

function Detail({
  label,
  mono = false,
  value,
  wide = false,
}: {
  label: string
  mono?: boolean
  value: string
  wide?: boolean
}) {
  return (
    <div className={wide ? 'detailItem wide' : 'detailItem'}>
      <span>{label}</span>
      <strong className={mono ? 'mono' : ''}>{value}</strong>
    </div>
  )
}

function groupRoleText(role?: number): string {
  if (role === 100) {
    return '群主'
  }
  if (role === 60) {
    return '管理员'
  }
  if (role === 20) {
    return '成员'
  }
  return role === undefined ? '-' : String(role)
}

function formatMuteTime(value?: number): string {
  if (!value) {
    return '-'
  }
  const now = Date.now()
  const time = value < 10_000_000_000 ? value * 1000 : value
  return time > now ? formatMessageTime(value) : '-'
}

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
