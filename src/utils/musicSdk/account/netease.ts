import { weapi } from '../wy/utils/crypto'
import { httpFetch } from '@/utils/request'
import AsyncStorage from '@react-native-async-storage/async-storage'
import wySongList from '../wy/songList'
import { createUserList, addListMusics } from '@/core/list'
import { toast } from '@/utils/tools'

const STORAGE_KEY = '@lx_account_netease'

export interface NeteaseAccountInfo {
  isLoggedIn: boolean
  cookie: string
  userId?: string | number
  nickname?: string
  avatarUrl?: string
}

export interface NeteasePlaylist {
  id: string | number
  name: string
  coverImgUrl: string
  trackCount: number
}

export const getSavedNeteaseAccount = async(): Promise<NeteaseAccountInfo> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY)
    if (data) return JSON.parse(data)
  } catch {}
  return { isLoggedIn: false, cookie: '' }
}

export const saveNeteaseAccount = async(info: NeteaseAccountInfo) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(info))
}

export const clearNeteaseAccount = async() => {
  await AsyncStorage.removeItem(STORAGE_KEY)
}

/**
 * 申请网易云二维码 Unikey
 */
export const getQrKey = async(): Promise<string> => {
  const form = weapi({ type: 1 })
  const res = await httpFetch('https://music.163.com/weapi/login/qrcode/unikey', {
    method: 'post',
    form,
  }).promise
  const body = res.body as any
  if (body?.data?.unikey) {
    return body.data.unikey
  }
  throw new Error(body?.message || '获取二维码Key失败')
}

/**
 * 轮询二维码扫码状态
 * 800: 过期, 801: 等待扫码, 802: 待确认, 803: 授权成功并返回Cookie
 */
export const checkQr = async(key: string): Promise<{ code: number, message: string, cookie?: string }> => {
  const form = weapi({ key, type: 1 })
  const res = await httpFetch('https://music.163.com/weapi/login/qrcode/client/login', {
    method: 'post',
    form,
  }).promise
  const body = res.body as any
  const code = body?.code ?? 801
  const message = body?.message || ''
  let cookie = ''

  if (code === 803) {
    // 提取响应中的 cookie
    cookie = body.cookie || ''
    if (!cookie && res.headers) {
      const setCookie = res.headers['set-cookie'] || res.headers['Set-Cookie']
      if (Array.isArray(setCookie)) cookie = setCookie.join('; ')
      else if (typeof setCookie === 'string') cookie = setCookie
    }
  }

  return { code, message, cookie }
}

/**
 * 获取当前登录用户信息
 */
export const getNeteaseUserProfile = async(cookie: string) => {
  const form = weapi({})
  const res = await httpFetch('https://music.163.com/weapi/w/nuser/account/get', {
    method: 'post',
    headers: {
      Cookie: cookie.includes('MUSIC_U=') ? cookie : `MUSIC_U=${cookie}`,
      Referer: 'https://music.163.com',
    },
    form,
  }).promise
  const body = res.body as any
  if (body?.profile) {
    return {
      userId: body.profile.userId,
      nickname: body.profile.nickname,
      avatarUrl: body.profile.avatarUrl,
    }
  }
  return null
}

/**
 * 获取用户的歌单列表（我喜欢的 + 创建的 + 收藏的）
 */
export const getNeteaseUserPlaylists = async(userId: string | number, cookie: string): Promise<NeteasePlaylist[]> => {
  const form = weapi({ uid: userId, limit: 100, offset: 0 })
  const res = await httpFetch('https://music.163.com/weapi/user/playlist', {
    method: 'post',
    headers: {
      Cookie: cookie.includes('MUSIC_U=') ? cookie : `MUSIC_U=${cookie}`,
      Referer: 'https://music.163.com',
    },
    form,
  }).promise
  const body = res.body as any
  if (Array.isArray(body?.playlist)) {
    return body.playlist.map((item: any) => ({
      id: item.id,
      name: item.name,
      coverImgUrl: item.coverImgUrl,
      trackCount: item.trackCount,
    }))
  }
  return []
}

/**
 * 获取网易云每日推荐歌曲
 */
export const getNeteaseRecommendSongs = async(cookie: string): Promise<LX.Music.MusicInfo[]> => {
  const form = weapi({})
  const res = await httpFetch('https://music.163.com/weapi/v3/discovery/recommend/songs', {
    method: 'post',
    headers: {
      Cookie: cookie.includes('MUSIC_U=') ? cookie : `MUSIC_U=${cookie}`,
      Referer: 'https://music.163.com',
    },
    form,
  }).promise
  const body = res.body as any
  const dailySongs = body?.data?.dailySongs || []
  return dailySongs.map((track: any) => ({
    id: `wy_${track.id}`,
    name: track.name,
    singer: track.ar?.map((a: any) => a.name).join('、') || '未知歌手',
    source: 'wy' as const,
    interval: formatInterval(track.dt),
    meta: {
      songId: track.id,
      albumName: track.al?.name || '',
      picUrl: track.al?.picUrl || '',
      qualitys: [],
      _qualitys: {},
    },
  }))
}

const formatInterval = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

/**
 * 将指定网易云歌单导入到 LX Mobile 的“我的列表”
 */
export const importNeteasePlaylistToLocal = async(playlist: NeteasePlaylist, cookie: string) => {
  try {
    const listId = `user_list_wy_${playlist.id}`
    // 先创建用户歌单
    await createUserList(0, [{
      id: listId,
      name: `[网易云] ${playlist.name}`,
      source: 'wy',
      sourceListId: String(playlist.id),
    }])

    // 抓取歌单歌曲明细并填充
    const playlistIdParam = cookie ? `${playlist.id}###${cookie.replace(/^MUSIC_U=/, '')}` : String(playlist.id)
    const detail = await wySongList.getListDetail(playlistIdParam, 1)
    if (detail && Array.isArray(detail.list) && detail.list.length > 0) {
      await addListMusics(listId, detail.list, 'bottom')
      toast(`成功导入歌单: ${playlist.name} (${detail.list.length}首)`)
    } else {
      toast(`歌单 ${playlist.name} 导入完成`)
    }
  } catch (err: any) {
    toast(`导入失败: ${err.message}`)
  }
}

/**
 * 将每日推荐歌曲导入为本地歌单
 */
export const importNeteaseDailyRecommendToLocal = async(cookie: string) => {
  try {
    const songs = await getNeteaseRecommendSongs(cookie)
    if (!songs || songs.length === 0) {
      toast('未获取到推荐歌曲或需要重新登录')
      return
    }
    const dateStr = new Date().toLocaleDateString()
    const listId = `user_list_wy_daily_${Date.now()}`
    await createUserList(0, [{
      id: listId,
      name: `[网易云] 每日推荐 (${dateStr})`,
      source: 'wy',
      sourceListId: '',
    }])
    await addListMusics(listId, songs, 'bottom')
    toast(`已导入网易云每日推荐 (${songs.length}首)`)
  } catch (err: any) {
    toast(`导入推荐失败: ${err.message}`)
  }
}
