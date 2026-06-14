import { Nav } from "./components/home/Nav";
import { Hero } from "./components/home/Hero";
import { Actors } from "./components/home/Actors";
import { HowItWorks } from "./components/home/HowItWorks";
import { Trust } from "./components/home/Trust";
import { DemoSection } from "./components/home/DemoSection";
import { Identity } from "./components/home/Identity";
import { WhyCrypto } from "./components/home/WhyCrypto";
import { Integrations } from "./components/home/Integrations";
import { Roadmap } from "./components/home/Roadmap";
import { Footer } from "./components/home/Footer";
import { RevealObserver } from "./components/home/RevealObserver";

export default function Home() {
  return (
    <main className="min-h-screen bg-bg text-fg">
      <RevealObserver />
      <Nav />
      <Hero />
      <DemoSection />
      <Actors />
      <HowItWorks />
      <Trust />
      <Identity />
      <WhyCrypto />
      <Integrations />
      <Roadmap />
      <Footer />
    </main>
  );
}
