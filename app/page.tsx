import { Header } from "@/components/header"
import { Banner } from "@/components/banner"
import { ProductGrid } from "@/components/product-grid"
import { Footer } from "@/components/footer"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Banner />
      <main className="container mx-auto px-4 py-8">
        <ProductGrid />
      </main>
      <Footer />
    </div>
  )
}