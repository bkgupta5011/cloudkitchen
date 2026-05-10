import './globals.css'

export const metadata = {
  title: 'FoodFi — Fresh Food Delivered',
  description: 'Order fresh homemade food online. Cash on delivery.',
  manifest: '/manifest.json',
  themeColor: '#e85d04',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FoodFi',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="application-name" content="FoodFi" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="FoodFi" />
        <meta name="theme-color" content="#e85d04" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js')
                .then(reg => { window.__swReg = reg; })
                .catch(err => console.warn('SW error:', err));
            });
          }
        `}} />
      </body>
    </html>
  )
}
