
import React from 'react';
import { BillingCycle, PricingPlan, FAQItem, Testimonial } from './types';

export const PRIMARY_COLOR = '#6A62FE';

export const PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter Plan',
    description: 'Perfect for small personal websites and blogs.',
    prices: {
      [BillingCycle.MONTHLY]: 1.35,
      [BillingCycle.YEARLY]: 14,
      [BillingCycle.BIANNUAL]: 26,
      [BillingCycle.TRIENNIAL]: 40
    },
    features: [
      '10 Hosted Domains',
      '100 GB NVMe Storage',
      '2 Cores CPU & 2 GB RAM',
      'Unlimited Bandwidth',
      '100 Email Accounts',
      'Free SSL Certificate',
      'Weekly Backups',
      '24/7 WhatsApp Support'
    ],
    link: 'https://admin.noehost.com/index.php?rp=/store/shared-hosting/shared-starter'
  },
  {
    id: 'business',
    name: 'Business Pro',
    description: 'The best value for growing businesses.',
    isPopular: true,
    prices: {
      [BillingCycle.MONTHLY]: 2.35,
      [BillingCycle.YEARLY]: 24,
      [BillingCycle.BIANNUAL]: 48,
      [BillingCycle.TRIENNIAL]: 68
    },
    features: [
      '30 Hosted Domains',
      '300 GB NVMe Storage',
      '2 Cores CPU & 4 GB RAM',
      'Unlimited Bandwidth',
      '300 Email Accounts',
      'Free SSL & Dedicated IP',
      'Daily Backups',
      'Priority 24/7 Support'
    ],
    link: 'https://admin.noehost.com/index.php?rp=/store/shared-hosting/shared-business'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Maximum power for large scale applications.',
    prices: {
      [BillingCycle.MONTHLY]: 3.35,
      [BillingCycle.YEARLY]: 36,
      [BillingCycle.BIANNUAL]: 72,
      [BillingCycle.TRIENNIAL]: 104
    },
    features: [
      '100 Hosted Domains',
      '1000 GB NVMe Storage',
      '4 Cores CPU & 6 GB RAM',
      'Unlimited Bandwidth',
      'Unlimited Email Accounts',
      'Advanced Security Suite',
      'Hourly Backups',
      'Dedicated Account Manager'
    ],
    link: 'https://admin.noehost.com/index.php?rp=/store/shared-hosting/shared-enterprise'
  }
];

export const FAQS: FAQItem[] = [
  {
    question: "Is there a limit on Bandwidth?",
    answer: "No, we provide truly unlimited bandwidth on all Noehost plans, including our Shared, VPS, and Dedicated hosting tiers."
  },
  {
    question: "What types of hosting does Noehost offer?",
    answer: "Noehost provides a full suite of services: Shared NVMe Hosting, Managed VPS, Dedicated Servers, WordPress Optimized Hosting, and Cloud Solutions."
  },
  {
    question: "Do you offer a money-back guarantee?",
    answer: "Yes, we offer a 30-day money-back guarantee on all annual plans. We want you to be 100% satisfied with Noehost."
  },
  {
    question: "How is Noehost optimized for WordPress?",
    answer: "We use enterprise-grade Litespeed Web Servers combined with LSCache and NVMe storage to ensure your WordPress site loads up to 10x faster than traditional hosting."
  }
];

export const TESTIMONIALS: Testimonial[] = [
  {
    author: 'Umer Mustafa',
    role: 'CEO at CreativeFlow',
    content: 'Switching to Noehost was the best decision for our agency. The migration was seamless and our site speed improved by over 200%. High-performance hosting that actually delivers.',
    stars: 5,
    date: '6 days ago'
  },
  {
    author: 'Usman Haider',
    role: 'Full Stack Developer',
    content: 'The support team at Noehost is incredible. I had a complex Node.js configuration issue and they jumped on a call to help me resolve it within minutes. Truly professional service.',
    stars: 5,
    date: '3 days ago'
  },
  {
    author: 'Ahmad Gul',
    role: 'Professional Blogger',
    content: 'I have used Namecheap and Hostinger, but Noehost provides a more personal touch and faster hardware for the price. My SEO rankings improved after moving to their NVMe servers.',
    stars: 5,
    date: '8 days ago'
  }
];
