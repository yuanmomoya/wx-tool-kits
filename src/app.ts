import { PropsWithChildren } from 'react'
import Taro from '@tarojs/taro'

import { CLOUD_ENV_ID } from '@/config/cloud'

import './app.scss'

// 内容安全校验通过云函数调用，不能把微信服务端接口放在小程序端直连。
if (Taro.cloud?.init) {
  Taro.cloud.init({
    env: CLOUD_ENV_ID,
    traceUser: true,
  })
}

function App({ children }: PropsWithChildren) {
  return children
}

export default App
