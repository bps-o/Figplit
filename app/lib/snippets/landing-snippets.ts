export interface LandingSnippet {
  id: string;
  title: string;
  description: string;
  bestFor: string[];
  file: string;
  prompt: string;
}

export const landingSnippetLibrary: LandingSnippet[] = [
  {
    id: 'glass-hero-orbits',
    title: 'Glassmorphism hero',
    description:
      'Frosted hero shell with gradient orbits, layered CTA buttons, and staggered content entrance using framer-motion.',
    bestFor: ['Hero', 'AI SaaS', 'Product launch'],
    file: 'snippets/glass-hero-orbits.tsx',
    prompt:
      'Use the snippet at /snippets/glass-hero-orbits.tsx as the baseline hero and adapt it to the current brand palette, copy, and CTA structure.',
  },
  {
    id: 'metrics-marquee',
    title: 'Metrics marquee reel',
    description:
      'Infinite auto-scrolling marquee highlighting customer logos and success metrics with gradient edge fades.',
    bestFor: ['Social proof', 'Testimonials', 'Case studies'],
    file: 'snippets/metrics-marquee.tsx',
    prompt:
      'Blend the marquee loop from /snippets/metrics-marquee.tsx into the page and customize the data + colors to match our product story.',
  },
  {
    id: 'device-rail',
    title: 'Device showcase rail',
    description:
      '3D-tilting device cards with synced autoplay carousel and subtle reflections to showcase in-product screenshots.',
    bestFor: ['Product demo', 'Feature tour', 'Motion highlight'],
    file: 'snippets/device-rail.tsx',
    prompt:
      'Incorporate the animated rail from /snippets/device-rail.tsx and replace the imagery with our assets while keeping the motion polish.',
  },
];
