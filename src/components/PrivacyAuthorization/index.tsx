import { useEffect, useRef, useState } from 'react'
import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'

import './PrivacyAuthorization.scss'

type PrivacyResolve = (result: {
  event: 'exposureAuthorization' | 'agree' | 'disagree'
  buttonId?: string
}) => void

const AGREE_BUTTON_ID = 'privacy-agree-button'

export default function PrivacyAuthorization() {
  const resolverRef = useRef<PrivacyResolve | null>(null)
  const [visible, setVisible] = useState(false)
  const [contractName, setContractName] = useState('小程序隐私保护指引')

  useEffect(() => {
    const onNeedPrivacyAuthorization = (Taro as any).onNeedPrivacyAuthorization
    const offNeedPrivacyAuthorization = (Taro as any).offNeedPrivacyAuthorization
    if (!onNeedPrivacyAuthorization) return undefined

    const listener = (resolve: PrivacyResolve) => {
      resolverRef.current = resolve
      setVisible(true)
      resolve({ event: 'exposureAuthorization' })

      const getPrivacySetting = (Taro as any).getPrivacySetting
      if (getPrivacySetting) {
        getPrivacySetting({
          success: (result: { privacyContractName?: string }) => {
            if (result.privacyContractName) setContractName(result.privacyContractName)
          },
        })
      }
    }

    onNeedPrivacyAuthorization(listener)
    return () => offNeedPrivacyAuthorization?.(listener)
  }, [])

  const close = () => {
    resolverRef.current = null
    setVisible(false)
  }

  const disagree = () => {
    resolverRef.current?.({ event: 'disagree' })
    close()
  }

  const agree = () => {
    resolverRef.current?.({ event: 'agree', buttonId: AGREE_BUTTON_ID })
    close()
  }

  if (!visible) return null

  return (
    <View className='privacy-mask' catchMove>
      <View className='privacy-dialog'>
        <Text className='privacy-dialog__title'>隐私保护提示</Text>
        <Text className='privacy-dialog__desc'>
          使用图片、视频选择或保存功能前，需要你阅读并同意《{contractName}》。图片会临时提交微信内容安全检测，检测后删除；图片加工和视频处理在本机完成。
        </Text>
        <View
          className='privacy-dialog__contract'
          onClick={() => (Taro as any).openPrivacyContract?.()}
        >
          查看隐私保护指引
        </View>
        <View className='privacy-dialog__actions'>
          <View className='privacy-dialog__cancel' onClick={disagree}>暂不同意</View>
          <Button
            id={AGREE_BUTTON_ID}
            className='privacy-dialog__agree'
            openType='agreePrivacyAuthorization'
            onAgreePrivacyAuthorization={agree}
          >
            同意并继续
          </Button>
        </View>
      </View>
    </View>
  )
}
