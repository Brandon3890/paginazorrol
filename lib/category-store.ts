import { create } from 'zustand'

interface Subcategory {
  id: number
  name: string
  slug: string
  category_id: number
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Category {
  id: number
  name: string
  slug: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
  subcategories: Subcategory[]
}

interface CategoryStore {
  categories: Category[]
  loading: boolean
  error: string | null
  
  fetchCategories: () => Promise<void>
  addCategory: (category: Omit<Category, 'id' | 'created_at' | 'updated_at' | 'subcategories'>) => Promise<void>
  updateCategory: (id: number, category: Partial<Category>) => Promise<void>
  deactivateCategory: (id: number) => Promise<void>
  activateCategory: (id: number) => Promise<void>
  deleteCategoryPermanently: (id: number) => Promise<void> // Nueva función
  addSubcategory: (subcategory: Omit<Subcategory, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  updateSubcategory: (id: number, subcategory: Partial<Subcategory>) => Promise<void>
  deactivateSubcategory: (id: number) => Promise<void>
  activateSubcategory: (id: number) => Promise<void>
  deleteSubcategoryPermanently: (id: number) => Promise<void> // Nueva función
  getCategoryById: (id: number) => Category | undefined
}

export const useCategoryStore = create<CategoryStore>((set, get) => ({
  categories: [],
  loading: false,
  error: null,

  fetchCategories: async () => {
    set({ loading: true, error: null })
    try {
      const response = await fetch('/api/categories')
      if (!response.ok) throw new Error('Error fetching categories')
      const categories = await response.json()
      set({ categories, loading: false })
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
    }
  },

  addCategory: async (category) => {
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(category)
      })
      if (!response.ok) throw new Error('Error creating category')
      
      get().fetchCategories()
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  updateCategory: async (id, category) => {
    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(category)
      })
      if (!response.ok) throw new Error('Error updating category')
      
      get().fetchCategories()
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  deactivateCategory: async (id) => {
    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Error deactivating category')
      
      get().fetchCategories()
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  activateCategory: async (id) => {
    try {
      const response = await fetch(`/api/categories/${id}/activate`, {
        method: 'PUT'
      })
      if (!response.ok) throw new Error('Error activating category')
      
      get().fetchCategories()
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  deleteCategoryPermanently: async (id) => {
    try {
      const response = await fetch(`/api/categories/${id}/permanent`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Error deleting category permanently')
      
      get().fetchCategories()
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  addSubcategory: async (subcategory) => {
    try {
      const response = await fetch('/api/subcategories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subcategory)
      })
      if (!response.ok) throw new Error('Error creating subcategory')
      
      get().fetchCategories()
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  updateSubcategory: async (id, subcategory) => {
    try {
      const response = await fetch(`/api/subcategories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subcategory)
      })
      if (!response.ok) throw new Error('Error updating subcategory')
      
      get().fetchCategories()
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  deactivateSubcategory: async (id) => {
    try {
      const response = await fetch(`/api/subcategories/${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Error deactivating subcategory')
      
      get().fetchCategories()
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  activateSubcategory: async (id) => {
    try {
      const response = await fetch(`/api/subcategories/${id}/activate`, {
        method: 'PUT'
      })
      if (!response.ok) throw new Error('Error activating subcategory')
      
      get().fetchCategories()
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  deleteSubcategoryPermanently: async (id) => {
    try {
      const response = await fetch(`/api/subcategories/${id}/permanent`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Error deleting subcategory permanently')
      
      get().fetchCategories()
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  getCategoryById: (id) => {
    return get().categories.find(cat => cat.id === id)
  }
}))