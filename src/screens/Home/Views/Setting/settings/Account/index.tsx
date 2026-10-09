import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { View, Image, TouchableOpacity, ScrollView, Modal, ActivityIndicator } from 'react-native'
import Section from '../../components/Section'
import SubTitle from '../../components/SubTitle'
import Button from '../../components/Button'
import InputItem from '../../components/InputItem'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import {
  getSavedNeteaseAccount,
  saveNeteaseAccount,
  clearNeteaseAccount,
  getQrKey,
  checkQr,
  getNeteaseUserProfile,
  getNeteaseUserPlaylists,
  importNeteasePlaylistToLocal,
  importNeteaseDailyRecommendToLocal,
  type NeteaseAccountInfo,
  type NeteasePlaylist,
} from '@/utils/musicSdk/account/netease'
import {
  getSavedQQAccount,
  saveQQAccount,
  clearQQAccount,
  getQQUserProfile,
  getQQUserPlaylists,
  importQQPlaylistToLocal,
  type QQAccountInfo,
  type QQPlaylist,
} from '@/utils/musicSdk/account/qq'

export default memo(() => {
  const theme = useTheme()

  // 网易云状态
  const [wyAccount, setWyAccount] = useState<NeteaseAccountInfo>({ isLoggedIn: false, cookie: '' })
  const [wyPlaylists, setWyPlaylists] = useState<NeteasePlaylist[]>([])
  const [wyLoading, setWyLoading] = useState(false)
  const [wyQrKey, setWyQrKey] = useState('')
  const [wyQrModal, setWyQrModal] = useState(false)
  const [wyQrStatusText, setWyQrStatusText] = useState('请使用网易云音乐扫码')
  const [wyManualCookie, setWyManualCookie] = useState('')
  const qrTimerRef = useRef<any>(null)

  // QQ 音乐状态
  const [qqAccount, setQqAccount] = useState<QQAccountInfo>({ isLoggedIn: false, uin: '', qm_keyst: '' })
  const [qqPlaylists, setQqPlaylists] = useState<QQPlaylist[]>([])
  const [qqLoading, setQqLoading] = useState(false)
  const [qqInputUin, setQqInputUin] = useState('')
  const [qqInputKeyst, setQqInputKeyst] = useState('')

  // 初始化加载已保存的账号信息
  useEffect(() => {
    void (async() => {
      const savedWy = await getSavedNeteaseAccount()
      setWyAccount(savedWy)
      if (savedWy.isLoggedIn && savedWy.userId) {
        void loadWyPlaylists(savedWy.userId, savedWy.cookie)
      }

      const savedQq = await getSavedQQAccount()
      setQqAccount(savedQq)
      if (savedQq.isLoggedIn && savedQq.uin) {
        void loadQqPlaylists(savedQq.uin, savedQq.qm_keyst)
      }
    })()

    return () => {
      if (qrTimerRef.current) clearInterval(qrTimerRef.current)
    }
  }, [])

  // 加载网易云歌单
  const loadWyPlaylists = async(uid: string | number, cookie: string) => {
    setWyLoading(true)
    try {
      const lists = await getNeteaseUserPlaylists(uid, cookie)
      setWyPlaylists(lists)
    } catch (e: any) {
      toast(`加载歌单失败: ${e.message}`)
    } finally {
      setWyLoading(false)
    }
  }

  // 开始网易云扫码登录
  const handleStartWyQrLogin = async() => {
    try {
      setWyQrStatusText('正在获取登录二维码...')
      setWyQrModal(true)
      const key = await getQrKey()
      setWyQrKey(key)
      setWyQrStatusText('请使用网易云音乐 App 扫一扫授权')

      if (qrTimerRef.current) clearInterval(qrTimerRef.current)
      qrTimerRef.current = setInterval(async() => {
        try {
          const res = await checkQr(key)
          if (res.code === 800) {
            setWyQrStatusText('二维码已过期，请重新点击')
            clearInterval(qrTimerRef.current)
          } else if (res.code === 802) {
            setWyQrStatusText('扫码成功，请在手机上点击确认')
          } else if (res.code === 803) {
            clearInterval(qrTimerRef.current)
            setWyQrStatusText('登录成功！')
            const cookie = res.cookie || ''
            const profile = await getNeteaseUserProfile(cookie)
            const info: NeteaseAccountInfo = {
              isLoggedIn: true,
              cookie,
              userId: profile?.userId,
              nickname: profile?.nickname,
              avatarUrl: profile?.avatarUrl,
            }
            await saveNeteaseAccount(info)
            setWyAccount(info)
            setWyQrModal(false)
            toast(`欢迎，${info.nickname || '网易云音乐用户'}！`)
            if (info.userId) void loadWyPlaylists(info.userId, cookie)
          }
        } catch {}
      }, 2500)
    } catch (e: any) {
      toast(`生成二维码失败: ${e.message}`)
      setWyQrModal(false)
    }
  }

  // 手动输入网易云 Cookie 登录
  const handleManualWyCookieLogin = async() => {
    if (!wyManualCookie.trim()) {
      toast('请输入 Cookie (需含 MUSIC_U)')
      return
    }
    try {
      setWyLoading(true)
      const profile = await getNeteaseUserProfile(wyManualCookie)
      const info: NeteaseAccountInfo = {
        isLoggedIn: true,
        cookie: wyManualCookie.trim(),
        userId: profile?.userId,
        nickname: profile?.nickname,
        avatarUrl: profile?.avatarUrl,
      }
      await saveNeteaseAccount(info)
      setWyAccount(info)
      setWyManualCookie('')
      toast(`网易云登录成功: ${info.nickname || '用户'}`)
      if (info.userId) void loadWyPlaylists(info.userId, info.cookie)
    } catch (e: any) {
      toast(`验证失败: ${e.message}`)
    } finally {
      setWyLoading(false)
    }
  }

  // 网易云注销
  const handleLogoutWy = async() => {
    await clearNeteaseAccount()
    setWyAccount({ isLoggedIn: false, cookie: '' })
    setWyPlaylists([])
    toast('已退出网易云音乐登录')
  }

  // 加载 QQ 音乐歌单
  const loadQqPlaylists = async(uin: string, qm_keyst: string) => {
    setQqLoading(true)
    try {
      const lists = await getQQUserPlaylists(uin, qm_keyst)
      setQqPlaylists(lists)
    } catch (e: any) {
      toast(`加载 QQ 歌单失败: ${e.message}`)
    } finally {
      setQqLoading(false)
    }
  }

  // QQ 音乐登录
  const handleLoginQQ = async() => {
    const uin = qqInputUin.trim()
    const qm_keyst = qqInputKeyst.trim()
    if (!uin || !qm_keyst) {
      toast('请输入 QQ 号与 qm_keyst')
      return
    }
    setQqLoading(true)
    try {
      const profile = await getQQUserProfile(uin, qm_keyst)
      const info: QQAccountInfo = {
        isLoggedIn: true,
        uin,
        qm_keyst,
        nickname: profile.nickname,
        avatarUrl: profile.avatarUrl,
      }
      await saveQQAccount(info)
      setQqAccount(info)
      setQqInputUin('')
      setQqInputKeyst('')
      toast(`QQ 音乐登录成功: ${info.nickname || uin}`)
      void loadQqPlaylists(uin, qm_keyst)
    } catch (e: any) {
      toast(`QQ 登录验证失败: ${e.message}`)
    } finally {
      setQqLoading(false)
    }
  }

  // QQ 音乐注销
  const handleLogoutQQ = async() => {
    await clearQQAccount()
    setQqAccount({ isLoggedIn: false, uin: '', qm_keyst: '' })
    setQqPlaylists([])
    toast('已退出 QQ 音乐登录')
  }

  return (
    <Section title="第三方账号与歌单导入">
      {/* ----------------- 网易云音乐模块 ----------------- */}
      <SubTitle title="网易云音乐 (NetEase)" />
      {wyAccount.isLoggedIn ? (
        <View style={{ ...styles.card, backgroundColor: theme['c-theme-background'] }}>
          <View style={styles.userInfoRow}>
            {wyAccount.avatarUrl ? (
              <Image source={{ uri: wyAccount.avatarUrl }} style={styles.avatar} />
            ) : null}
            <View style={styles.userTextCol}>
              <Text style={styles.userName}>{wyAccount.nickname || '网易云音乐用户'}</Text>
              <Text size={12} color={theme['c-500']}>UID: {wyAccount.userId}</Text>
            </View>
            <Button style={styles.btnSm} onPress={handleLogoutWy}>
              <Text size={12} color={theme['c-primary-font']}>退出</Text>
            </Button>
          </View>

          <View style={styles.btnRow}>
            <Button
              style={styles.actionBtn}
              onPress={() => void importNeteaseDailyRecommendToLocal(wyAccount.cookie)}
            >
              <Text size={13} color={theme['c-primary-font']}>📅 导入今日推荐歌曲</Text>
            </Button>
            <Button
              style={styles.actionBtn}
              onPress={() => wyAccount.userId && void loadWyPlaylists(wyAccount.userId, wyAccount.cookie)}
            >
              <Text size={13} color={theme['c-primary-font']}>🔄 刷新歌单</Text>
            </Button>
          </View>

          {wyLoading ? <ActivityIndicator size="small" color={theme['c-primary']} /> : null}

          <View style={styles.playlistSection}>
            <Text style={styles.sectionHeader}>我的收藏与创建歌单 ({wyPlaylists.length}):</Text>
            {wyPlaylists.map(pl => (
              <View key={pl.id} style={{ ...styles.playlistItem, borderBottomColor: theme['c-border-background'] }}>
                <View style={styles.playlistInfo}>
                  <Text numberOfLines={1} style={styles.playlistName}>{pl.name}</Text>
                  <Text size={12} color={theme['c-500']}>{pl.trackCount} 首歌曲</Text>
                </View>
                <Button
                  style={styles.importBtn}
                  onPress={() => void importNeteasePlaylistToLocal(pl, wyAccount.cookie)}
                >
                  <Text size={12} color={theme['c-primary-font']}>导入本地</Text>
                </Button>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={{ ...styles.card, backgroundColor: theme['c-theme-background'] }}>
          <Text size={13} color={theme['c-500']} style={{ marginBottom: 10 }}>
            登录网易云音乐账号可一键将你的收藏歌单、创建歌单和每日推荐同步导入到本地。
          </Text>
          <Button style={styles.mainActionBtn} onPress={handleStartWyQrLogin}>
            <Text color={theme['c-primary-font']}>📱 网易云音乐 App 扫码登录</Text>
          </Button>

          <View style={{ marginTop: 14 }}>
            <Text size={12} color={theme['c-500']} style={{ marginBottom: 6 }}>或者手动输入 Cookie (MUSIC_U):</Text>
            <InputItem
              value={wyManualCookie}
              onChangeText={setWyManualCookie}
              placeholder="粘贴包含 MUSIC_U 的 Cookie"
            />
            <Button style={{ ...styles.btnSm, marginTop: 8 }} onPress={handleManualWyCookieLogin}>
              <Text size={12} color={theme['c-primary-font']}>保存并登录</Text>
            </Button>
          </View>
        </View>
      )}

      {/* ----------------- QQ 音乐模块 ----------------- */}
      <SubTitle title="QQ 音乐 (Tencent Music)" />
      {qqAccount.isLoggedIn ? (
        <View style={{ ...styles.card, backgroundColor: theme['c-theme-background'] }}>
          <View style={styles.userInfoRow}>
            {qqAccount.avatarUrl ? (
              <Image source={{ uri: qqAccount.avatarUrl }} style={styles.avatar} />
            ) : null}
            <View style={styles.userTextCol}>
              <Text style={styles.userName}>{qqAccount.nickname || qqAccount.uin}</Text>
              <Text size={12} color={theme['c-500']}>QQ: {qqAccount.uin}</Text>
            </View>
            <Button style={styles.btnSm} onPress={handleLogoutQQ}>
              <Text size={12} color={theme['c-primary-font']}>退出</Text>
            </Button>
          </View>

          <View style={styles.btnRow}>
            <Button
              style={styles.actionBtn}
              onPress={() => void loadQqPlaylists(qqAccount.uin, qqAccount.qm_keyst)}
            >
              <Text size={13} color={theme['c-primary-font']}>🔄 刷新歌单</Text>
            </Button>
          </View>

          {qqLoading ? <ActivityIndicator size="small" color={theme['c-primary']} /> : null}

          <View style={styles.playlistSection}>
            <Text style={styles.sectionHeader}>我的自建与收藏歌单 ({qqPlaylists.length}):</Text>
            {qqPlaylists.map(pl => (
              <View key={pl.id} style={{ ...styles.playlistItem, borderBottomColor: theme['c-border-background'] }}>
                <View style={styles.playlistInfo}>
                  <Text numberOfLines={1} style={styles.playlistName}>{pl.name}</Text>
                  <Text size={12} color={theme['c-500']}>{pl.trackCount} 首歌曲</Text>
                </View>
                <Button
                  style={styles.importBtn}
                  onPress={() => void importQQPlaylistToLocal(pl)}
                >
                  <Text size={12} color={theme['c-primary-font']}>导入本地</Text>
                </Button>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={{ ...styles.card, backgroundColor: theme['c-theme-background'] }}>
          <Text size={13} color={theme['c-500']} style={{ marginBottom: 10 }}>
            输入 QQ 号及网页版 Cookie（qm_keyst）以绑定并拉取自建与收藏歌单。
          </Text>
          <InputItem
            value={qqInputUin}
            onChangeText={setQqInputUin}
            placeholder="请输入 QQ 号 (uin)"
          />
          <View style={{ height: 8 }} />
          <InputItem
            value={qqInputKeyst}
            onChangeText={setQqInputKeyst}
            placeholder="请输入 qm_keyst (Cookie)"
          />
          <Button style={{ ...styles.mainActionBtn, marginTop: 10 }} onPress={handleLoginQQ}>
            <Text color={theme['c-primary-font']}>绑定 QQ 音乐并同步</Text>
          </Button>
        </View>
      )}

      {/* ----------------- 网易云扫码 Modal ----------------- */}
      <Modal visible={wyQrModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={{ ...styles.qrBox, backgroundColor: theme['c-content-background'] }}>
            <Text style={styles.qrTitle}>网易云音乐扫码登录</Text>
            {wyQrKey ? (
              <Image
                source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent('https://music.163.com/login?codekey=' + wyQrKey)}` }}
                style={styles.qrImage}
              />
            ) : (
              <ActivityIndicator size="large" color={theme['c-primary']} style={{ marginVertical: 40 }} />
            )}
            <Text style={styles.qrTip}>{wyQrStatusText}</Text>
            <Button
              style={styles.closeBtn}
              onPress={() => {
                if (qrTimerRef.current) clearInterval(qrTimerRef.current)
                setWyQrModal(false)
              }}
            >
              <Text size={13} color={theme['c-primary-font']}>关闭</Text>
            </Button>
          </View>
        </View>
      </Modal>
    </Section>
  )
})

const styles = createStyle({
  card: {
    borderRadius: 12,
    padding: 14,
    marginVertical: 6,
    elevation: 2,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 10,
  },
  userTextCol: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  mainActionBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnSm: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  playlistSection: {
    marginTop: 8,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  playlistInfo: {
    flex: 1,
    marginRight: 10,
  },
  playlistName: {
    fontSize: 14,
    marginBottom: 2,
  },
  importBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrBox: {
    width: 280,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  qrTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 14,
  },
  qrImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },
  qrTip: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  closeBtn: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 8,
  },
})
