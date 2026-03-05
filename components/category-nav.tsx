"use client"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import { ChevronDown } from "lucide-react"

const categories = [
  {
    name: "Juegos de Mesa",
    href: "/juegos-mesa",
    subcategories: [
      { name: "Estrategia", href: "/juegos-mesa/estrategia" },
      { name: "Familiar", href: "/juegos-mesa/familiar" },
      { name: "Party Games", href: "/juegos-mesa/party" },
      { name: "Cooperativos", href: "/juegos-mesa/cooperativos" },
      { name: "Abstractos", href: "/juegos-mesa/abstractos" },
      { name: "Temáticos", href: "/juegos-mesa/tematicos" },
    ],
  },
  {
    name: "TCG",
    href: "/tcg",
    subcategories: [
      { name: "Pokémon", href: "/tcg/pokemon" },
      { name: "One Piece", href: "/tcg/one-piece" },
      { name: "Magic: The Gathering", href: "/tcg/magic" },
      { name: "Yu-Gi-Oh!", href: "/tcg/yugioh" },
      { name: "Dragon Ball Super", href: "/tcg/dragon-ball" },
      { name: "Digimon", href: "/tcg/digimon" },
    ],
  },
  {
    name: "Puzzles",
    href: "/puzzles",
    subcategories: [
      { name: "Rompecabezas 2D", href: "/puzzles/rompecabezas" },
      { name: "Puzzles 3D", href: "/puzzles/3d" },
      { name: "Puzzles Mecánicos", href: "/puzzles/mecanicos" },
      { name: "Puzzles Infantiles", href: "/puzzles/infantiles" },
      { name: "Puzzles Artísticos", href: "/puzzles/artisticos" },
    ],
  },
  {
    name: "Rol",
    href: "/rol",
    subcategories: [
      { name: "Dungeons & Dragons", href: "/rol/dnd" },
      { name: "Pathfinder", href: "/rol/pathfinder" },
      { name: "Call of Cthulhu", href: "/rol/cthulhu" },
      { name: "Vampiro", href: "/rol/vampiro" },
      { name: "Cyberpunk", href: "/rol/cyberpunk" },
      { name: "Accesorios", href: "/rol/accesorios" },
    ],
  },
]

export function CategoryNav() {
  return (
    <nav className="bg-background border-b border-border shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center py-3">
          <NavigationMenu>
            <NavigationMenuList className="flex gap-6">
              {categories.map((category) => (
                <NavigationMenuItem key={category.name}>
                  <NavigationMenuTrigger className="bg-transparent hover:bg-primary/10 hover:text-primary data-[state=open]:bg-primary/10 data-[state=open]:text-primary font-medium px-4 py-2 rounded-md transition-colors">
                    {category.name}
                    <ChevronDown className="ml-2 h-4 w-4 transition-transform duration-200" />
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="grid w-[400px] gap-2 p-6 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                      {category.subcategories.map((subcategory) => (
                        <a
                          key={subcategory.name}
                          href={subcategory.href}
                          className="block select-none space-y-1 rounded-lg p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground border border-transparent hover:border-border"
                        >
                          <div className="text-sm font-medium leading-none">{subcategory.name}</div>
                        </a>
                      ))}
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        </div>
      </div>
    </nav>
  )
}
