import React from 'react';
import NoeHostLayout from './NoeHostLayout';
import Hero from '@/noehost/components/Hero';
import Pricing from '@/noehost/components/Pricing';
import ControlEfficiency from '@/noehost/components/ControlEfficiency';
import FeatureShowcase from '@/noehost/components/FeatureShowcase';
import Promo from '@/noehost/components/Promo';
import Services from '@/noehost/components/Services';
import Features from '@/noehost/components/Features';
import CTA from '@/noehost/components/CTA';
import FAQ from '@/noehost/components/FAQ';
import Testimonials from '@/noehost/components/Testimonials';

export default function Homepage() {
  return (
    <NoeHostLayout>
      <Hero />
      <Pricing />
      <ControlEfficiency />
      <FeatureShowcase />
      <Promo />
      <Services />
      <Features />
      <CTA />
      <FAQ />
      <Testimonials />
    </NoeHostLayout>
  );
}
