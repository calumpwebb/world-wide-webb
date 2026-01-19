'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Wifi, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MAX_NAME_LENGTH } from '@/lib/constants/validation'

const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(MAX_NAME_LENGTH),
  email: z.string().email('Please enter a valid email address'),
})

type FormData = z.infer<typeof formSchema>

function GuestLandingForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const macAddress = searchParams.get('mac') || searchParams.get('id') || ''

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/guest/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          macAddress,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        // Provide actionable error messages
        if (response.status === 429) {
          setError(
            result.error || 'Too many attempts. Please wait a few minutes before trying again.'
          )
        } else if (response.status === 503) {
          setError(
            'Network service temporarily unavailable. Please try again in a moment or contact the network administrator.'
          )
        } else {
          setError(
            result.error ||
              'Failed to send verification code. Please check your email address and try again.'
          )
        }
        return
      }

      // Store email in session storage for verification page
      sessionStorage.setItem('verifyEmail', data.email)
      sessionStorage.setItem('verifyName', data.name)
      if (macAddress) {
        sessionStorage.setItem('verifyMac', macAddress)
      }

      router.push('/verify')
    } catch (err) {
      console.error('Network error:', err)
      setError(
        'Unable to connect to the network. Please check your internet connection and try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Wifi className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-semibold">World Wide Webb</CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter your details to connect to the guest WiFi network
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Your name"
                autoComplete="name"
                disabled={isLoading}
                {...register('name')}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                disabled={isLoading}
                {...register('email')}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending code...
                </>
              ) : (
                'Get Verification Code'
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              By connecting, you agree to our acceptable use policy.
              <br />
              Access is valid for 7 days.
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

export default function GuestLandingPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        </main>
      }
    >
      <GuestLandingForm />
    </Suspense>
  )
}
