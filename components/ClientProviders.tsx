'use client'

import { ReactNode } from 'react'
import PwaUpdateListener from '@/components/PwaUpdateListener'
import PushNotificationManager from '@/components/PushNotificationManager'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'
import VConsole from '@/components/VConsole'

type Props = {
  children: ReactNode
}

export default function ClientProviders({ children }: Props) {
  return (
    <>
      <VConsole />
      <PwaUpdateListener />
      <PushNotificationManager />
      <PwaInstallPrompt />
      {children}
    </>
  )
}

