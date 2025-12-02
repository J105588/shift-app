'use client'

import { ReactNode } from 'react'
import PwaUpdateListener from '@/components/PwaUpdateListener'
import PushNotificationManager from '@/components/PushNotificationManager'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'
import PwaDebugInfo from '@/components/PwaDebugInfo'
import ToastProvider from '@/components/ToastProvider'

type Props = {
  children: ReactNode
}

export default function ClientProviders({ children }: Props) {
  return (
    <>
      <PwaUpdateListener />
      <PushNotificationManager />
      <PwaInstallPrompt />
      <PwaDebugInfo />
      <ToastProvider />
      {children}
    </>
  )
}

