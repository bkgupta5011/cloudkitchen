export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin', '/login', '/delivery'],
      },
    ],
    sitemap: [
      'https://foodfi.in/sitemap.xml',
      'https://order.foodfi.in/sitemap.xml',
    ],
    host: 'https://order.foodfi.in',
  }
}
