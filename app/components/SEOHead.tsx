import { Metadata } from 'next';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  canonicalUrl?: string;
  structuredData?: object;
}

export function generateSEOMetadata({
  title = "moccet - AI that Discovers, Experts who Execute",
  description = "Autonomous intelligence that embeds in your infrastructure, discovers insights without prompting, and deploys world-class operators to execute discoveries.",
  keywords = "autonomous AI, business intelligence, AI discovery, expert execution, artificial intelligence, enterprise AI, automated insights",
  ogImage = "/images/og-image.jpg",
  canonicalUrl = "https://moccet.com",
}: SEOProps): Metadata {
  return {
    title,
    description,
    keywords,
    authors: [{ name: "moccet" }],
    viewport: "width=device-width, initial-scale=1",
    robots: "index, follow",
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "moccet",
      locale: "en_US",
      url: canonicalUrl,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

interface StructuredDataProps {
  data: object;
}

export function StructuredData({ data }: StructuredDataProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data),
      }}
    />
  );
}

// Organization Schema for moccet
export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "moccet",
  "description": "Autonomous intelligence that embeds in your infrastructure, discovers insights without prompting, and deploys world-class operators to execute discoveries.",
  "url": "https://moccet.com",
  "logo": "https://moccet.com/images/logo.png",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+1-707-400-5566",
    "contactType": "sales",
    "availableLanguage": ["English"]
  },
  "sameAs": [
    "https://twitter.com/moccet",
    "https://linkedin.com/company/moccet"
  ],
  "foundingDate": "2024",
  "employees": "51-200",
  "industry": "Artificial Intelligence",
  "keywords": ["artificial intelligence", "business intelligence", "autonomous AI", "enterprise AI", "AI discovery"]
};

// Product Schema for moccet AI Platform
export const productSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "moccet AI Platform",
  "description": "Autonomous intelligence platform that discovers insights and deploys expert operators for execution",
  "brand": {
    "@type": "Brand",
    "name": "moccet"
  },
  "category": "Artificial Intelligence Software",
  "offers": {
    "@type": "Offer",
    "priceCurrency": "USD",
    "price": "50000",
    "priceSpecification": {
      "@type": "PriceSpecification",
      "price": "50000",
      "priceCurrency": "USD",
      "valueAddedTaxIncluded": false,
      "name": "Pilot Program"
    },
    "availability": "https://schema.org/InStock",
    "seller": {
      "@type": "Organization",
      "name": "moccet"
    }
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "150"
  }
};

// Service Schema for different moccet services
export const createServiceSchema = (serviceName: string, description: string, url: string) => ({
  "@context": "https://schema.org",
  "@type": "Service",
  "name": serviceName,
  "description": description,
  "provider": {
    "@type": "Organization",
    "name": "moccet",
    "url": "https://moccet.com"
  },
  "serviceType": "Artificial Intelligence",
  "url": url,
  "areaServed": "Worldwide",
  "availableChannel": {
    "@type": "ServiceChannel",
    "serviceUrl": url,
    "serviceSmsNumber": "+1-707-400-5566"
  }
});