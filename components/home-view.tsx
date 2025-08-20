"use client";

import { useState, useEffect } from "react";
import type { Machine } from "@prisma/client";
import { MachineCard } from "@/components/machine-card";
import Pretitle from "@/components/ui/pretitle";

// Will build this components in the future
// import Hero from '@/components/Hero';
// import About from '@/components/About';
// import Faq from '@/components/Faq';
// import Testimonials from '@/components/Testimonials';
//also add topbar, header and footer with contact

interface HomeViewProps {
  machines: Machine[];
}

export function HomeView({ machines }: HomeViewProps) {
  const [headerActive, setHeaderActive] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setHeaderActive(window.scrollY > 0);
    };
    // Logic for a future animated header
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <main>
      {/* Header Section */}
      <section className="container mx-auto py-16 text-center xl:py-24">
        <Pretitle text="Our Inventory" center />
        <h1 className="my-3 text-3xl font-bold tracking-tight md:text-4xl">
          Machinery for Rent
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Explore our selections of robust and reliable machines, ready for any
          challenge on your job site.
        </p>
      </section>

      {/* Machine Grid Section */}
      <section
        id="catalog"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
      >
        {machines.map((machine) => (
          <MachineCard key={machine.id} machine={machine} />
        ))}
      </section>

      {/* Future sections like About, FAQ, etc., will be added here */}
    </main>
  );
}
