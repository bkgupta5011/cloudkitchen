export const metadata = {
  title: 'FoodFi Delivery App',
  description: 'Manage your deliveries and earnings',
  manifest: '/delivery-manifest.json',
  themeColor: '#16a34a',
}

export default function DeliveryLayout({ children }) {
  return (
    <>
      {/* Override manifest for delivery PWA */}
      <link rel="manifest" href="/delivery-manifest.json" />
      {children}
    </>
  )
}
