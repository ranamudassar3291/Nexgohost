
export enum BillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  BIANNUAL = 'biannual',
  TRIENNIAL = 'triennial'
}

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  prices: Record<BillingCycle, number>;
  features: string[];
  isPopular?: boolean;
  link: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface Testimonial {
  author: string;
  role: string;
  content: string;
  stars: number;
  date: string;
}
