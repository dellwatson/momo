import { ScanSheet } from '@/components/scan-product'
import { SkinCheckSheet } from '@/components/skin-check'
import { TalkSheet } from '@/components/talk'
import { useSheet } from '@/state/momo'

/** The one full-screen sheet that is open, if any. */
export function Sheets() {
  const sheet = useSheet()
  if (sheet === 'talk') return <TalkSheet />
  if (sheet === 'skin') return <SkinCheckSheet />
  if (sheet === 'scan') return <ScanSheet />
  return null
}
