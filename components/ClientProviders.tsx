'use client'

import { ReactNode } from 'react'
import PwaUpdateListener from '@/components/PwaUpdateListener'
import PushNotificationManager from '@/components/PushNotificationManager'

type Props = {
  children: ReactNode
}

export default function ClientProviders({ children }: Props) {
  return (
    <>
      <PwaUpdateListener />
      <PushNotificationManager />
      {children}
    </>
  )
}

