import { httpFetch } from '@/utils/request'
import AsyncStorage from '@react-native-async-storage/async-storage'
import txSongList from '../tx/songList'
import { createUserList, addListMusics } from '@/core/list'
import { toast } from '@/utils/tools'

const STORAGE_KEY = '@lx_account_qq'

export interface QQAccountInfo {
  isLoggedIn: boolean
  uin: string
  qm_keyst: string
  nickname?: string
  avatarUrl?: string
}

export interface QQPlaylist {
  id: string
  name: string
  coverImgUrl: string
  trackCount: number
}

export const getSavedQQAccount = async(): Promise<QQAccountInfo> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY)
    if (data) return JSON.parse(data)
  } catch {}
  return { isLoggedIn: false, uin: '', qm_keyst: '' }
}

export const saveQQAccount = async(info: QQAccountInfo) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(info))
}

export const clearQQAccount = async() => {
  await AsyncStorage.removeItem(STORAGE_KEY)
}

const buildCookieHeader = (uin: string, qm_keyst: string): string => {
  return `uin=${uin}; qqmusic_uin=${uin}; qm_keyst=${qm_keyst}; euin=${uin};`
}

/**
 * 获取 QQ 音乐用户个人主页信息
 */
export const getQQUserProfile = async(uin: string, qm_keyst: string) => {
  const cookie = buildCookieHeader(uin, qm_keyst)
  const url = `https://c.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg?userid=${uin}&cid=205360838&loginUin=${uin}&hostUin=0&format=json&platform=yqq.json&needNewCode=0`
  const res = await httpFetch(url, {
    headers: {
      Cookie: cookie,
      Referer: 'https://y.qq.com/portal/profile.html',
    },
  }).promise
  const body = res.body as any
  if (body?.data?.creator) {
    return {
      uin,
      nickname: body.data.creator.nick || `QQ用户_${uin}`,
      avatarUrl: body.data.creator.headpic || '',
    }
  }
  return {
    uin,
    nickname: `QQ用户_${uin}`,
    avatarUrl: `http://q1.qlogo.cn/g?b=qq&nk=${uin}&s=100`,
  }
}

/**
 * 获取 QQ 音乐用户创建与收藏的歌单
 */
export const getQQUserPlaylists = async(uin: string, qm_keyst: string): Promise<QQPlaylist[]> => {
  const cookie = buildCookieHeader(uin, qm_keyst)
  const headers = {
    Cookie: cookie,
    Referer: 'https://y.qq.com/portal/profile.html',
  }

  const createdUrl = `https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss?hostuin=${uin}&sin=0&size=100&loginUin=${uin}&format=json&platform=yqq.json`
  const collectUrl = `https://c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg?userid=${uin}&reqtype=3&sin=0&ein=100`

  const playlists: QQPlaylist[] = []

  try {
    const resCreated = await httpFetch(createdUrl, { headers }).promise
    const bodyCreated = resCreated.body as any
    if (Array.isArray(bodyCreated?.data?.disslist)) {
      for (const item of bodyCreated.data.disslist) {
        playlists.push({
          id: String(item.dissid),
          name: item.diss_name,
          coverImgUrl: item.diss_cover,
          trackCount: item.song_cnt,
        })
      }
    }
  } catch (e) {
    console.warn('[QQ] fetch created diss failed:', e)
  }

  try {
    const resCollect = await httpFetch(collectUrl, { headers }).promise
    const bodyCollect = resCollect.body as any
    if (Array.isArray(bodyCollect?.data?.cdlist)) {
      for (const item of bodyCollect.data.cdlist) {
        playlists.push({
          id: String(item.dissid),
          name: item.diss_name,
          coverImgUrl: item.diss_cover,
          trackCount: item.song_cnt,
        })
      }
    }
  } catch (e) {
    console.warn('[QQ] fetch collect diss failed:', e)
  }

  return playlists
}

/**
 * 将 QQ 音乐歌单导入到 LX Mobile 的“我的列表”
 */
export const importQQPlaylistToLocal = async(playlist: QQPlaylist) => {
  try {
    const listId = `user_list_qq_${playlist.id}`
    await createUserList(0, [{
      id: listId,
      name: `[QQ音乐] ${playlist.name}`,
      source: 'tx',
      sourceListId: playlist.id,
    }])

    const detail = await txSongList.getListDetail(playlist.id, 1)
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
