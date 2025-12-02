'use client'

import { ReactNode } from 'react'
import PwaUpdateListener from '@/components/PwaUpdateListener'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'
import ToastProvider from '@/components/ToastProvider'

type Props = {
  children: ReactNode
}

export default function ClientProviders({ children }: Props) {
  return (
    <>
      <PwaUpdateListener />
      <PwaInstallPrompt />
      <ToastProvider />
      {children}
    </>
  )
}

