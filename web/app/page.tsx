import { Nav } from "./components/home/Nav";
import { Hero } from "./components/home/Hero";
import { Actors } from "./components/home/Actors";
import { HowItWorks } from "./components/home/HowItWorks";
import { InAction } from "./components/home/InAction";
import { Identity } from "./components/home/Identity";
import { WhyCrypto } from "./components/home/WhyCrypto";
import { Integrations } from "./components/home/Integrations";
import { Roadmap } from "./components/home/Roadmap";
import { Footer } from "./components/home/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-bg text-fg">
      <Nav />
      <Hero />
      <Actors />
      <HowItWorks />
      <InAction />
      <Identity />
      <WhyCrypto />
      <Integrations />
      <Roadmap />
      <Footer />
    </main>
  );
}
