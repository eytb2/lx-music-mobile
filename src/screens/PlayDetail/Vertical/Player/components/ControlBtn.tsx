import { TouchableOpacity, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
// import { useIsPlay } from '@/store/player/hook'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { useIsPlay } from '@/store/player/hook'
import { createStyle } from '@/utils/tools'
import { useWindowSize } from '@/utils/hooks'
import { BTN_WIDTH } from './MoreBtn/Btn'
import { useMemo } from 'react'

const PrevBtn = ({ size }: { size: number }) => {
  const theme = useTheme()
  const handlePlayPrev = () => {
    void playPrev()
  }
  const btnSize = size * 0.9
  return (
    <TouchableOpacity
      style={{
        ...styles.controlBtn,
        width: btnSize,
        height: btnSize,
        borderRadius: btnSize / 2,
        backgroundColor: theme['c-primary-light-100-alpha-700'] || 'rgba(0, 0, 0, 0.05)',
      }}
      activeOpacity={0.65}
      onPress={handlePlayPrev}
    >
      <Icon name='prevMusic' color={theme['c-button-font']} rawSize={btnSize * 0.55} />
    </TouchableOpacity>
  )
}
const NextBtn = ({ size }: { size: number }) => {
  const theme = useTheme()
  const handlePlayNext = () => {
    void playNext()
  }
  const btnSize = size * 0.9
  return (
    <TouchableOpacity
      style={{
        ...styles.controlBtn,
        width: btnSize,
        height: btnSize,
        borderRadius: btnSize / 2,
        backgroundColor: theme['c-primary-light-100-alpha-700'] || 'rgba(0, 0, 0, 0.05)',
      }}
      activeOpacity={0.65}
      onPress={handlePlayNext}
    >
      <Icon name='nextMusic' color={theme['c-button-font']} rawSize={btnSize * 0.55} />
    </TouchableOpacity>
  )
}

const TogglePlayBtn = ({ size }: { size: number }) => {
  const theme = useTheme()
  const isPlay = useIsPlay()
  const fabSize = size * 1.18
  return (
    <TouchableOpacity
      style={{
        ...styles.controlBtn,
        width: fabSize,
        height: fabSize,
        borderRadius: fabSize / 2,
        backgroundColor: theme['c-primary'],
        elevation: 6,
        shadowColor: theme['c-primary'],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      }}
      activeOpacity={0.8}
      onPress={togglePlay}
    >
      <Icon name={isPlay ? 'pause' : 'play'} color={theme['c-primary-font']} rawSize={fabSize * 0.52} />
    </TouchableOpacity>
  )
}

const MAX_SIZE = BTN_WIDTH * 1.6
const MIN_SIZE = BTN_WIDTH * 1.2

export default () => {
  const winSize = useWindowSize()
  const maxHeight = Math.max(winSize.height * 0.11, MIN_SIZE)
  const containerStyle = useMemo(() => {
    return {
      ...styles.conatiner,
      maxHeight,
    }
  }, [maxHeight])
  const size = Math.min(Math.max(winSize.width * 0.33 * global.lx.fontSize * 0.4, MIN_SIZE), MAX_SIZE, maxHeight)

  return (
    <View style={containerStyle}>
      <PrevBtn size={size} />
      <TogglePlayBtn size={size}/>
      <NextBtn size={size} />
    </View>
  )
}


const styles = createStyle({
  conatiner: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    flexGrow: 1,
    flexShrink: 1,
    paddingHorizontal: '4%',
    paddingVertical: 22,
    // backgroundColor: 'rgba(0, 0, 0, .1)',
  },
  controlBtn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
})
