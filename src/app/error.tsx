'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Root error:', error)
  }, [error])

  return (
    <html lang="en">
      <body className="bg-black">
        <div className="flex min-h-screen items-center justify-center p-4">
          <Card className="w-full max-w-md border-zinc-800 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-white">Something went wrong</CardTitle>
              <CardDescription className="text-zinc-400">
                An unexpected error occurred
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-zinc-400">
                {error.message || 'Please try refreshing the page or returning to the home page.'}
              </p>
              <div className="flex gap-2">
                <Button onClick={reset} variant="outline">
                  Try again
                </Button>
                <Button onClick={() => (window.location.href = '/')} variant="outline">
                  Go home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </body>
    </html>
  )
}
