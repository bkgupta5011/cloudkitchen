import { metadata as orderMetadata, jsonLd } from '../order/layout'

// The premium landing is the order.foodfi.in home — give it the SAME rich SEO
// (keywords, OpenGraph, Restaurant/FAQ JSON-LD) as the /order page.
export const metadata = orderMetadata

export default function OrderPreviewLayout({ children }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  )
}
