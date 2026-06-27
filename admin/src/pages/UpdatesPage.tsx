import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { getErrorMessage } from '../lib/errors'
import { formatTime } from '../lib/format'
import type { AdminUpload, AppUpdateInfo, PageProps } from '../types'

interface UpdatesPageProps extends PageProps {
  upload: AdminUpload
}

export function UpdatesPage({
  loading,
  request,
  setError,
  setLoading,
  setNotice,
  upload,
}: UpdatesPageProps) {
  const [latest, setLatest] = useState<AppUpdateInfo | null>(null)
  const [apkFile, setApkFile] = useState<File | null>(null)
  const [versionCode, setVersionCode] = useState('')
  const [versionName, setVersionName] = useState('')
  const [releaseNotes, setReleaseNotes] = useState('')
  const [forceUpdate, setForceUpdate] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

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
    setUploadProgress(0)
    try {
      const params = new URLSearchParams({
        versionCode: String(code),
        versionName: versionName.trim(),
        forceUpdate: String(forceUpdate),
      })
      if (releaseNotes.trim()) {
        params.set('releaseNotes', releaseNotes.trim())
      }
      const data = await upload<AppUpdateInfo>(
        `/admin/app-update/android?${params.toString()}`,
        apkFile,
        setUploadProgress,
      )
      setLatest(data)
      setApkFile(null)
      setNotice('安卓安装包已更新')
    } catch (err) {
      setUploadProgress(null)
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
            onChange={(event) => {
              setApkFile(event.target.files?.[0] ?? null)
              setUploadProgress(null)
            }}
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
          {loading && uploadProgress !== null
            ? uploadProgress === 100
              ? '服务器处理中'
              : `上传中 ${uploadProgress}%`
            : '上传最新版本'}
        </button>
        {uploadProgress !== null && (
          <div className="uploadProgress" aria-live="polite">
            <div className="uploadProgressLabel">
              <span>
                {uploadProgress < 100
                  ? '正在上传 APK'
                  : loading
                    ? '服务器处理中'
                    : '上传完成'}
              </span>
              <strong>{uploadProgress}%</strong>
            </div>
            <progress max="100" value={uploadProgress}>
              {uploadProgress}%
            </progress>
          </div>
        )}
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
