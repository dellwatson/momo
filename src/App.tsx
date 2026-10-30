import { useEffect } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { Sheets } from '@/components/sheets'
import { SiteHeader, TabBar } from '@/components/site-header'
import { Toaster } from '@/components/ui/sonner'
import { WatchDock } from '@/components/watch-dock'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ChatPage } from '@/pages/chat'
import { DiaryPage } from '@/pages/diary'
import { ExplorePage } from '@/pages/explore'
import { HomePage } from '@/pages/home'
import { ProductPage } from '@/pages/product'
import { ProfilePage } from '@/pages/profile'
import { ShelfPage } from '@/pages/shelf'
import { LeaderboardPage, MascotsPage, ShopPage } from '@/pages/shop'
import { SkinPage } from '@/pages/skin'

function Layout() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return (
    <div className="min-h-svh">
      <SiteHeader />
      <main>
        <Outlet />
      </main>
      {pathname !== '/chat' && <TabBar />}
      {/* On Home, momo says what it is watching out loud. */}
      {pathname !== '/' && pathname !== '/chat' && <WatchDock />}
      <Sheets />
      {pathname !== '/chat' && pathname !== '/' && (
        <footer className="mx-auto max-w-6xl px-4 pb-24 pt-2 text-xs text-muted-foreground md:py-10">
          momo · a skincare companion, not medical advice · your data stays in this browser
        </footer>
      )}
    </div>
  )
}

export default function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="skin" element={<SkinPage />} />
            <Route path="shelf" element={<ShelfPage />} />
            <Route path="diary" element={<DiaryPage />} />
            <Route path="explore" element={<ExplorePage />} />
            <Route path="explore/reviews/:productId" element={<ProductPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="shop" element={<ShopPage />} />
            <Route path="shop/leaderboard" element={<LeaderboardPage />} />
            <Route path="shop/mascots" element={<MascotsPage />} />
            <Route path="compare" element={<Navigate to="/explore?tab=brands" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}
