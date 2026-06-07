import './globals.css'
import PWAInstall from './components/PWAInstall'

export const metadata = {
  title: 'FoodFi – Best Food Delivery in Patna | Rajma Chawal, Chole Chawal, Rice Bowls',
  description: 'Order fresh and delicious meals online from FoodFi. Best Rajma Chawal, Chole Chawal, Dal Chawal, Protein Rice Bowls and Roti Combos with fast home delivery in Kankarbagh, Jaganpura, East Laxmi Nagar, Ramkrishna Nagar, Rajendra Nagar and across Patna.',
  manifest: '/manifest.json',
  metadataBase: new URL('https://foodfi.in'),
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
        {/* iOS requires PNG — SVG not supported for apple-touch-icon */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />
      </head>
      <body>
        {children}
        <PWAInstall />
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js')
                .then(reg => { window.__swReg = reg; })
                .catch(err => console.warn('SW error:', err));
            });
          }
        `}} />
        <script dangerouslySetInnerHTML={{ __html: `
          document.addEventListener('contextmenu', function(e){ e.preventDefault(); });
          document.addEventListener('keydown', function(e){
            if (e.key === 'F12') e.preventDefault();
            if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) e.preventDefault();
            if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) e.preventDefault();
          });
        `}} />
      </body>
    </html>
  )
}
