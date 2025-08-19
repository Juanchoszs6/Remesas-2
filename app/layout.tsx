import type { Metadata } from 'next'
import Head from 'next/head'
import './globals.css'

export const metadata: Metadata = {
  title: 'Remesas Ltda',
  description: 'Siigo-Remesas',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <Head>
        <link rel="icon" href="/favicon.ico" />
        {/* O si usas PNG */}
        {/* <link rel="icon" href="/logo.png" type="image/png" /> */}
      </Head>
      <body>{children}</body>
    </html>
  )
}
