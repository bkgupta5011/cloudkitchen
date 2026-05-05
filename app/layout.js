import './globals.css'

export const metadata = {
  title: 'CloudKitchen — Fresh Food Delivered',
  description: 'Order fresh homemade food online. Cash on delivery.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
