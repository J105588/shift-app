'use client'

import { ReactNode } from 'react'
import PwaUpdateListener from '@/components/PwaUpdateListener'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'
import ToastProvider from '@/components/ToastProvider'
import AlertProvider from '@/components/AlertProvider'

type Props = {
  children: ReactNode
}

export default function ClientProviders({ children }: Props) {
  return (
    <>
      <PwaUpdateListener />
      <PwaInstallPrompt />
      <ToastProvider />
      <AlertProvider />
      {children}
    </>
  )
}

