import Link from "next/link";
import { Container } from "@/components/layout/Container";

export default function NotFound() {
  return (
    <Container className="py-20 text-center">
      <p className="text-5xl mb-4">🚲</p>
      <h1 className="text-2xl font-bold text-zinc-900 mb-2">Side ikke funnet</h1>
      <p className="text-zinc-500 mb-6">
        Vi finner ikke siden du leter etter.
      </p>
      <Link
        href="/"
        className="inline-flex items-center px-5 py-2.5 bg-accent-500 text-white font-semibold rounded-lg hover:bg-accent-600 transition-colors"
      >
        Tilbake til forsiden
      </Link>
    </Container>
  );
}
