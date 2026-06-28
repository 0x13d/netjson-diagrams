import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Convert } from './components/Convert';
import { HowItWorks } from './components/HowItWorks';
import { Footer } from './components/Footer';

export function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <Convert />
        <HowItWorks />
      </main>
      <Footer />
    </div>
  );
}
