import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, ScanLine } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 p-6 text-center">
      <h1 className="text-5xl font-serif text-amber-500 mb-6">Boutique Olfattiva</h1>
      <p className="text-zinc-400 mb-10 max-w-md text-lg">
        Il tuo diario olfattivo aperto e potenziato con la ricerca AI.
      </p>
      
      <div className="flex gap-4 flex-col sm:flex-row">
        <Link href="/collezione">
          <Button className="bg-amber-600 hover:bg-amber-500 text-white w-full sm:w-auto flex gap-2">
            <Sparkles className="w-5 h-5" /> Esplora la Collezione
          </Button>
        </Link>
        <Link href="/scanner">
          <Button variant="outline" className="border-amber-600 text-amber-500 hover:bg-zinc-900 hover:text-amber-400 w-full sm:w-auto flex gap-2">
            <ScanLine className="w-5 h-5" /> Scannerizza Profumo
          </Button>
        </Link>
      </div>
    </div>
  );
}
