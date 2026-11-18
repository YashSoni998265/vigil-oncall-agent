import Nav from '@/components/landing/Nav';
import Hero from '@/components/landing/Hero';
import Story from '@/components/landing/Story';
import Numbers from '@/components/landing/Numbers';
import HowItWorks from '@/components/landing/HowItWorks';
import Safety from '@/components/landing/Safety';
import WhyVoice from '@/components/landing/WhyVoice';
import Compare from '@/components/landing/Compare';
import BuiltOn from '@/components/landing/BuiltOn';
import FinalCta from '@/components/landing/FinalCta';
import Footer from '@/components/landing/Footer';
import { RevealObserver } from '@/components/ui/Reveal';

export default function LandingPage() {
  return (
    <>
      {/* Without JavaScript, scroll-reveal content must still be visible. */}
      <noscript>
        <style>{`.reveal{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      <a
        href="#main"
        className="sr-only z-[60] rounded-full bg-ink px-4 py-2 text-sm text-canvas focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <Nav />
      <main id="main" className="overflow-x-clip">
        <Hero />
        <Story />
        <Numbers />
        <HowItWorks />
        <Safety />
        <WhyVoice />
        <Compare />
        <BuiltOn />
        <FinalCta />
      </main>
      <Footer />
      <RevealObserver />
    </>
  );
}
