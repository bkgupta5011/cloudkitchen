export const metadata = {
  title: 'FoodFi Delivery App',
  description: 'Manage your deliveries and earnings',
  manifest: '/delivery-manifest.json',
  themeColor: '#16a34a',
}

export default function DeliveryLayout({ children }) {
  return (
    <>
      {/* Override manifest + apple-touch-icon for delivery PWA */}
      <link rel="manifest" href="/delivery-manifest.json" />
      <link rel="apple-touch-icon" sizes="180x180" href="/icons/delivery-apple-icon.png" />
      {children}
    </>
  )
}
