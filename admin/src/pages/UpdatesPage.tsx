import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { getErrorMessage } from '../lib/errors'
import { formatTime } from '../lib/format'
import type { AppUpdateInfo, PageProps } from '../types'

export function UpdatesPage({
  loading,
  request,
  setError,
  setLoading,
  setNotice,
}: PageProps) {
  const [latest, setLatest] = useState<AppUpdateInfo | null>(null)
  const [apkFile, setApkFile] = useState<File | null>(null)
  const [versionCode, setVersionCode] = useState('')
  const [versionName, setVersionName] = useState('')
  const [releaseNotes, setReleaseNotes] = useState('')
  const [forceUpdate, setForceUpdate] = useState(false)

  const loadLatest = useCallback(async () => {
    setLoading(true)
    try {
      const data = await request<AppUpdateInfo | null>(
        '/app-update/android/latest',
      )
      setLatest(data)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [request, setError, setLoading])

  useEffect(() => {
    void loadLatest()
  }, [loadLatest])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!apkFile) {
      setError('请选择 APK 文件')
      return
    }
    const code = Number(versionCode)
    if (!Number.isInteger(code) || code <= 0) {
      setError('versionCode 必须是大于 0 的整数')
      return
    }
    if (!versionName.trim()) {
      setError('请输入 versionName')
      return
    }

    setLoading(true)
    setNotice('')
    try {
      const params = new URLSearchParams({
        versionCode: String(code),
        versionName: versionName.trim(),
        forceUpdate: String(forceUpdate),
      })
      if (releaseNotes.trim()) {
        params.set('releaseNotes', releaseNotes.trim())
      }
      const data = await request<AppUpdateInfo>(
        `/admin/app-update/android?${params.toString()}`,
        {
          method: 'PUT',
          headers: {
            'content-type': 'application/vnd.android.package-archive',
          },
          body: apkFile,
        },
      )
      setLatest(data)
      setApkFile(null)
      setNotice('安卓安装包已更新')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="panel">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Android Release</p>
          <h2>App 更新</h2>
        </div>
      </div>

      {latest ? (
        <div className="updateSummary">
          <div>
            <span>当前版本</span>
            <strong>
              {latest.versionName} ({latest.versionCode})
            </strong>
          </div>
          <div>
            <span>安装包大小</span>
            <strong>{formatFileSize(latest.fileSize)}</strong>
          </div>
          <div>
            <span>强制更新</span>
            <strong>{latest.forceUpdate ? '是' : '否'}</strong>
          </div>
          <div>
            <span>更新时间</span>
            <strong>{formatTime(latest.updatedAt)}</strong>
          </div>
        </div>
      ) : (
        <p className="emptyBlock">暂无安卓安装包</p>
      )}

      <form className="updateForm" onSubmit={submit}>
        <label>
          APK 文件
          <input
            accept=".apk,application/vnd.android.package-archive"
            onChange={(event) => setApkFile(event.target.files?.[0] ?? null)}
            type="file"
          />
        </label>
        <label>
          versionCode
          <input
            min="1"
            onChange={(event) => setVersionCode(event.target.value)}
            placeholder="例如 2"
            type="number"
            value={versionCode}
          />
        </label>
        <label>
          versionName
          <input
            onChange={(event) => setVersionName(event.target.value)}
            placeholder="例如 1.0.1"
            value={versionName}
          />
        </label>
        <label className="checkboxLabel">
          <input
            checked={forceUpdate}
            onChange={(event) => setForceUpdate(event.target.checked)}
            type="checkbox"
          />
          强制更新
        </label>
        <label className="notesField">
          更新说明
          <textarea
            onChange={(event) => setReleaseNotes(event.target.value)}
            placeholder="本次更新内容"
            rows={5}
            value={releaseNotes}
          />
        </label>
        <button type="submit" disabled={loading}>
          上传最新版本
        </button>
      </form>
    </section>
  )
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`
  }
  return `${(size / 1024).toFixed(1)} KB`
}
