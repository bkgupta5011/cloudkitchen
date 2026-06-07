export const metadata = {
  title: 'FoodFi – Best Food Delivery in Patna | Rajma Chawal, Chole Chawal, Rice Bowls & Roti Combos',
  description: 'Order fresh and delicious meals online from FoodFi. Best Rajma Chawal, Chole Chawal, Dal Chawal, Protein Rice Bowls and Roti Combos with fast home delivery in Kankarbagh, Jaganpura, East Laxmi Nagar, Ramkrishna Nagar, Rajendra Nagar and across Patna. Cash on delivery available.',
  keywords: [
    'food delivery patna','best food delivery patna','cloud kitchen patna',
    'rajma chawal patna','best rajma chawal patna','rajma chawal near me',
    'chole chawal patna','best chole chawal patna','chole chawal near me',
    'healthy food patna','veg food delivery patna','budget meals patna',
    'food delivery kankarbagh','food delivery jaganpura','food delivery east laxmi nagar',
    'food delivery ramkrishna nagar','food delivery rajendra nagar','food delivery lohia nagar',
    'online food order patna','rice bowl patna','protein meal patna',
    'rajma rice bowl patna','dal tadka rice patna','jeera rice patna',
    'lunch delivery patna','dinner delivery patna','homemade food patna',
    'foodfi','foodfi patna','foodfi cloud kitchen',
  ],
  authors: [{ name: 'FoodFi Cloud Kitchen' }],
  creator: 'FoodFi',
  publisher: 'FoodFi',
  category: 'Food Delivery',
  alternates: {
    canonical: 'https://order.foodfi.in',
  },
  openGraph: {
    type: 'website',
    url: 'https://order.foodfi.in',
    siteName: 'FoodFi Cloud Kitchen',
    title: 'FoodFi – Best Food Delivery in Patna | Rajma Chawal, Chole Chawal & More',
    description: 'Order fresh homestyle meals from FoodFi. Rajma Chawal, Chole Chawal, Dal Chawal, Protein Rice Bowls & Roti Combos. Fast delivery in Kankarbagh, Jaganpura, East Laxmi Nagar & across Patna. Cash on delivery.',
    images: [
      {
        url: 'https://order.foodfi.in/icons/icon-512.png',
        width: 512,
        height: 512,
        alt: 'FoodFi Cloud Kitchen – Best Food Delivery in Patna',
      },
    ],
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FoodFi – Best Food Delivery in Patna',
    description: 'Rajma Chawal, Chole Chawal, Protein Rice Bowls & Roti Combos. Fast delivery in Patna. Cash on delivery.',
    images: ['https://order.foodfi.in/icons/icon-512.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  other: {
    'geo.region': 'IN-BR',
    'geo.placename': 'Patna, Bihar',
    'geo.position': '25.57966750;85.15721370',
    'ICBM': '25.57966750, 85.15721370',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': ['Restaurant', 'FoodEstablishment', 'LocalBusiness'],
      '@id': 'https://order.foodfi.in/#restaurant',
      'name': 'FoodFi Cloud Kitchen',
      'alternateName': ['FoodFi', 'FoodFi Patna', 'FoodFi Cloud Kitchen Patna'],
      'description': 'Best cloud kitchen in Patna specializing in Rajma Chawal, Chole Chawal, Protein Rice Bowls, Roti Combos and healthy homestyle veg meals. Fast home delivery across Kankarbagh, Jaganpura, East Laxmi Nagar, Ramkrishna Nagar, Rajendra Nagar and all of Patna.',
      'url': 'https://order.foodfi.in',
      'telephone': '+917546983536',
      'image': 'https://order.foodfi.in/icons/icon-512.png',
      'logo': 'https://order.foodfi.in/icons/icon-512.png',
      'priceRange': '₹',
      'servesCuisine': ['North Indian', 'Indian', 'Vegetarian', 'Veg', 'Rajma Chawal', 'Chole Chawal'],
      'address': {
        '@type': 'PostalAddress',
        'streetAddress': 'Road No 8, East Laxmi Nagar',
        'addressLocality': 'Patna',
        'addressRegion': 'Bihar',
        'postalCode': '800001',
        'addressCountry': 'IN',
      },
      'geo': {
        '@type': 'GeoCoordinates',
        'latitude': 25.57966750,
        'longitude': 85.15721370,
      },
      'openingHoursSpecification': [
        {
          '@type': 'OpeningHoursSpecification',
          'dayOfWeek': ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
          'opens': '09:00',
          'closes': '23:50',
        },
      ],
      'hasMap': 'https://maps.google.com/?q=Road+No+8+East+Laxmi+Nagar+Patna',
      'areaServed': [
        'Patna','Kankarbagh','Jaganpura','East Laxmi Nagar','Ramkrishna Nagar',
        'Rajendra Nagar','Lohia Nagar','Hanuman Nagar','Mithapur','Postal Park',
        'Patrakar Nagar','Ashok Nagar','Bhupatipur','Chitragupta Nagar','Vijay Nagar',
        'RMS Colony','Sipara','Bhootnath Road','Doctor Colony','New Jaganpura',
        'Jai Prakash Nagar','Bankman Colony','Tempo Stand Kankarbagh',
      ],
      'menu': 'https://order.foodfi.in',
      'acceptsReservations': false,
      'hasOfferCatalog': {
        '@type': 'OfferCatalog',
        'name': 'FoodFi Menu',
        'itemListElement': [
          { '@type': 'OfferCatalog', 'name': 'Rice Combos', 'description': 'Rajma Rice Bowl, Classic Chole Rice, Matar Chole Rice, Paneer Chole Rice, Mix Protein Rice Bowl, White Chana Rice Bowl, Dal Tadka Rice, Jeera Rice with Chole' },
          { '@type': 'OfferCatalog', 'name': 'Roti Combos', 'description': '2 Roti and 5 Roti combos with Rajma, Chole, Dal Tadka, Mix Chole, Paneer Chole' },
          { '@type': 'OfferCatalog', 'name': 'Puri Combos', 'description': '6 Puri with Rajma, 6 Puri with Chole' },
          { '@type': 'OfferCatalog', 'name': 'Tadka Specials', 'description': 'Chana Tadka, Rajma Tadka, Dal Tadka, Paneer Tadka, Mix Chole Tadka' },
        ],
      },
      'paymentAccepted': 'Cash, Online Payment',
      'currenciesAccepted': 'INR',
      'sameAs': ['https://foodfi.in'],
      'aggregateRating': {
        '@type': 'AggregateRating',
        'ratingValue': '4.5',
        'reviewCount': '50',
        'bestRating': '5',
        'worstRating': '1',
      },
    },
    {
      '@type': 'FAQPage',
      'mainEntity': [
        {
          '@type': 'Question',
          'name': 'Which areas do you deliver to in Patna?',
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': 'FoodFi delivers across Patna including Kankarbagh, Jaganpura, East Laxmi Nagar, Ramkrishna Nagar, Rajendra Nagar, Lohia Nagar, Hanuman Nagar, Mithapur, Patrakar Nagar, Ashok Nagar, Bhupatipur, Chitragupta Nagar, Postal Park, Vijay Nagar, RMS Colony, Sipara, Doctor Colony, and nearby areas within 4 km of our kitchen.',
          },
        },
        {
          '@type': 'Question',
          'name': 'What is the best food delivery service in Patna?',
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': 'FoodFi is Patna\'s best cloud kitchen for home-style food delivery. We specialize in Rajma Chawal, Chole Chawal, Protein Rice Bowls, Roti Combos and Puri Combos — fresh cooked and delivered in 45 minutes.',
          },
        },
        {
          '@type': 'Question',
          'name': 'Where can I get the best Rajma Chawal in Patna?',
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': 'FoodFi Cloud Kitchen is known for the best Rajma Chawal in Patna. We deliver authentic Rajma Rice Bowls to Kankarbagh, Jaganpura, East Laxmi Nagar, Ramkrishna Nagar and all nearby areas in Patna.',
          },
        },
        {
          '@type': 'Question',
          'name': 'Is Cash on Delivery available?',
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': 'Yes! FoodFi accepts Cash on Delivery (COD) on all orders. No online payment required.',
          },
        },
        {
          '@type': 'Question',
          'name': 'How long does food delivery take in Patna?',
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': 'FoodFi delivers in approximately 30-45 minutes across Patna. We serve Kankarbagh, Jaganpura, East Laxmi Nagar and all nearby areas.',
          },
        },
        {
          '@type': 'Question',
          'name': 'What are the best budget meals in Patna?',
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': 'FoodFi offers the best budget meals in Patna. Our Rajma Chawal, Chole Chawal, Dal Chawal and Roti Combos are affordable, healthy and filling — perfect for daily lunch and dinner delivery.',
          },
        },
      ],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://order.foodfi.in/#website',
      'url': 'https://order.foodfi.in',
      'name': 'FoodFi – Best Food Delivery in Patna',
      'description': 'Order Rajma Chawal, Chole Chawal, Rice Bowls and Roti Combos online. Fast delivery in Patna.',
      'inLanguage': 'en-IN',
    },
  ],
}

export default function OrderLayout({ children }) {
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
