import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Subcategory {
  id: number
  name: string
  slug: string
  category_id: number
  is_active: boolean
  display_order: number 
  created_at: string
  updated_at: string
}

type CreateSubcategoryInput = Omit<Subcategory, 'id' | 'created_at' | 'updated_at' | 'display_order'>

type UpdateSubcategoryInput = Partial<Omit<Subcategory, 'id' | 'created_at' | 'updated_at'>>

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
  categoriesLoaded: boolean
  lastFetchTimestamp: number
  
  fetchCategories: (force?: boolean) => Promise<void>
  addCategory: (category: Omit<Category, 'id' | 'created_at' | 'updated_at' | 'subcategories'>) => Promise<void>
  updateCategory: (id: number, category: Partial<Category>) => Promise<void>
  deactivateCategory: (id: number) => Promise<void>
  activateCategory: (id: number) => Promise<void>
  deleteCategoryPermanently: (id: number) => Promise<void> 
  
  addSubcategory: (subcategory: CreateSubcategoryInput) => Promise<void>
  updateSubcategory: (id: number, subcategory: UpdateSubcategoryInput) => Promise<void>
  deactivateSubcategory: (id: number) => Promise<void>
  activateSubcategory: (id: number) => Promise<void>
  deleteSubcategoryPermanently: (id: number) => Promise<void> 
  getCategoryById: (id: number) => Category | undefined
  updateSubcategoryOrder: (id: number, display_order: number) => Promise<void> 
  reorderSubcategories: (categoryId: number, orderedIds: number[]) => Promise<void>
  clearError: () => void
  resetStore: () => void
  forceRefresh: () => Promise<void>
}

export const emitCategoryUpdate = () => {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('categories-updated', {
      detail: { timestamp: Date.now() }
    })
    window.dispatchEvent(event)
    console.log('📢 Evento "categories-updated" emitido')
  }
}

export const useCategoryStore = create<CategoryStore>()(
  persist(
    (set, get) => ({
      categories: [],
      loading: false,
      error: null,
      categoriesLoaded: false,
      lastFetchTimestamp: 0,

      resetStore: () => {
        console.log('🔄 Reseteando store de categorías...')
        set({ 
          categories: [], 
          categoriesLoaded: false,
          loading: false,
          error: null,
          lastFetchTimestamp: 0
        })
        if (typeof window !== 'undefined') {
          localStorage.removeItem('category-storage')
        }
      },

      forceRefresh: async () => {
        console.log('🔄 Forzando refresco de categorías...')
        set({ categoriesLoaded: false, lastFetchTimestamp: 0 })
        await get().fetchCategories(true)
      },

      fetchCategories: async (force = false) => {
        if (force) {
          get().resetStore()
        }

        if (get().categoriesLoaded && !force) {
          console.log('📦 Categorías ya cargadas, omitiendo fetch')
          return
        }

        set({ loading: true, error: null })
        try {
          const timestamp = Date.now()
          console.log(`🔄 Fetching categories con timestamp: ${timestamp}`)
          
          const response = await fetch(`/api/categories?_=${timestamp}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          })
          
          if (!response.ok) {
            throw new Error(`Error fetching categories: ${response.status}`)
          }
          
          const categories = await response.json()
          
          // ✅ CORRECCIÓN: Convertir is_active correctamente a boolean
          const processedCategories = categories.map((cat: any) => ({
            ...cat,
            is_active: cat.is_active === 1 || cat.is_active === true,
            subcategories: Array.isArray(cat.subcategories) 
              ? cat.subcategories.map((sub: any) => ({
                  ...sub,
                  is_active: sub.is_active === 1 || sub.is_active === true
                }))
              : []
          }))
          
          console.log(`✅ ${processedCategories.length} categorías cargadas`)
          console.log('📊 Categorías:', processedCategories.map((c: any) => ({ 
            name: c.name, 
            is_active: c.is_active 
          })))
          
          set({ 
            categories: processedCategories, 
            loading: false, 
            categoriesLoaded: true,
            lastFetchTimestamp: timestamp
          })
        } catch (error) {
          console.error('❌ Error fetching categories:', error)
          set({ 
            error: (error as Error).message, 
            loading: false 
          })
        }
      },

      clearError: () => {
        set({ error: null })
      },

      updateSubcategoryOrder: async (id: number, display_order: number) => {
        try {
          const response = await fetch(`/api/subcategories/${id}/order`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ display_order })
          })
          
          if (!response.ok) throw new Error('Error updating subcategory order')
          
          set(state => ({
            categories: state.categories.map(cat => ({
              ...cat,
              subcategories: cat.subcategories.map(sub => 
                sub.id === id 
                  ? { ...sub, display_order } 
                  : sub
              ).sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
            }))
          }))
          
          emitCategoryUpdate()
        } catch (error) {
          console.error('Error updating subcategory order:', error)
          set({ error: (error as Error).message })
        }
      },

      reorderSubcategories: async (categoryId: number, orderedIds: number[]) => {
        try {
          const response = await fetch(`/api/categories/${categoryId}/subcategories/reorder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ordered_ids: orderedIds })
          })
          
          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Error reordering subcategories')
          }
          
          set(state => ({
            categories: state.categories.map(cat => {
              if (cat.id === categoryId) {
                const reorderedSubs = orderedIds
                  .map(id => cat.subcategories.find(sub => sub.id === id))
                  .filter((sub): sub is Subcategory => sub !== undefined)
                  .map((sub, index) => ({ ...sub, display_order: index }))
                
                return {
                  ...cat,
                  subcategories: reorderedSubs
                }
              }
              return cat
            })
          }))
          
          emitCategoryUpdate()
          console.log(`✅ Subcategorías reordenadas para categoría ${categoryId}`)
        } catch (error) {
          console.error('Error reordering subcategories:', error)
          set({ error: (error as Error).message })
          throw error
        }
      },

      addCategory: async (category) => {
        try {
          const categoryData = {
            name: category.name,
            slug: category.slug,
            description: category.description || '',
            is_active: category.is_active !== undefined ? category.is_active : true
          }

          console.log('📤 Enviando categoría:', categoryData)

          const response = await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(categoryData)
          })
          
          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Error creating category')
          }
          
          await get().fetchCategories(true)
          emitCategoryUpdate()
          console.log('✅ Categoría creada exitosamente')
        } catch (error) {
          console.error('❌ Error creating category:', error)
          set({ error: (error as Error).message })
          throw error
        }
      },

      updateCategory: async (id, category) => {
        try {
          const response = await fetch(`/api/categories/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(category)
          })
          
          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Error updating category')
          }
          
          await get().fetchCategories(true)
          emitCategoryUpdate()
          console.log(`✅ Categoría ${id} actualizada`)
        } catch (error) {
          console.error('Error updating category:', error)
          set({ error: (error as Error).message })
          throw error
        }
      },

      deactivateCategory: async (id) => {
        try {
          const response = await fetch(`/api/categories/${id}`, {
            method: 'DELETE'
          })
          
          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Error deactivating category')
          }
          
          set(state => ({
            categories: state.categories.map(cat => 
              cat.id === id ? { ...cat, is_active: false } : cat
            )
          }))
          
          emitCategoryUpdate()
          console.log(`✅ Categoría ${id} desactivada`)
        } catch (error) {
          console.error('Error deactivating category:', error)
          set({ error: (error as Error).message })
          throw error
        }
      },

      activateCategory: async (id) => {
        try {
          const response = await fetch(`/api/categories/${id}/activate`, {
            method: 'PUT'
          })
          
          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Error activating category')
          }
          
          set(state => ({
            categories: state.categories.map(cat => 
              cat.id === id ? { ...cat, is_active: true } : cat
            )
          }))
          
          emitCategoryUpdate()
          console.log(`✅ Categoría ${id} activada`)
        } catch (error) {
          console.error('Error activating category:', error)
          set({ error: (error as Error).message })
          throw error
        }
      },

      deleteCategoryPermanently: async (id) => {
        try {
          const response = await fetch(`/api/categories/${id}/permanent`, {
            method: 'DELETE'
          })
          
          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Error deleting category')
          }
          
          set(state => ({
            categories: state.categories.filter(cat => cat.id !== id)
          }))
          
          emitCategoryUpdate()
          console.log(`✅ Categoría ${id} eliminada permanentemente`)
        } catch (error) {
          console.error('Error deleting category:', error)
          set({ error: (error as Error).message })
          throw error
        }
      },

      addSubcategory: async (subcategory) => {
        try {
          const response = await fetch('/api/subcategories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subcategory)
          })
          
          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Error creating subcategory')
          }
          
          await get().fetchCategories(true)
          emitCategoryUpdate()
          console.log('✅ Subcategoría creada exitosamente')
        } catch (error) {
          console.error('❌ Error creating subcategory:', error)
          set({ error: (error as Error).message })
          throw error
        }
      },

      updateSubcategory: async (id, subcategory) => {
        try {
          const response = await fetch(`/api/subcategories/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subcategory)
          })
          
          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Error updating subcategory')
          }
          
          await get().fetchCategories(true)
          emitCategoryUpdate()
          console.log(`✅ Subcategoría ${id} actualizada`)
        } catch (error) {
          console.error('Error updating subcategory:', error)
          set({ error: (error as Error).message })
          throw error
        }
      },

      deactivateSubcategory: async (id) => {
        try {
          const response = await fetch(`/api/subcategories/${id}`, {
            method: 'DELETE'
          })
          
          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Error deactivating subcategory')
          }
          
          set(state => ({
            categories: state.categories.map(cat => ({
              ...cat,
              subcategories: cat.subcategories.map(sub => 
                sub.id === id ? { ...sub, is_active: false } : sub
              )
            }))
          }))
          
          emitCategoryUpdate()
          console.log(`✅ Subcategoría ${id} desactivada`)
        } catch (error) {
          console.error('Error deactivating subcategory:', error)
          set({ error: (error as Error).message })
          throw error
        }
      },

      activateSubcategory: async (id) => {
        try {
          const response = await fetch(`/api/subcategories/${id}/activate`, {
            method: 'PUT'
          })
          
          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Error activating subcategory')
          }
          
          set(state => ({
            categories: state.categories.map(cat => ({
              ...cat,
              subcategories: cat.subcategories.map(sub => 
                sub.id === id ? { ...sub, is_active: true } : sub
              )
            }))
          }))
          
          emitCategoryUpdate()
          console.log(`✅ Subcategoría ${id} activada`)
        } catch (error) {
          console.error('Error activating subcategory:', error)
          set({ error: (error as Error).message })
          throw error
        }
      },

      deleteSubcategoryPermanently: async (id) => {
        try {
          const response = await fetch(`/api/subcategories/${id}/permanent`, {
            method: 'DELETE'
          })
          
          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Error deleting subcategory')
          }
          
          set(state => ({
            categories: state.categories.map(cat => ({
              ...cat,
              subcategories: cat.subcategories.filter(sub => sub.id !== id)
            }))
          }))
          
          emitCategoryUpdate()
          console.log(`✅ Subcategoría ${id} eliminada permanentemente`)
        } catch (error) {
          console.error('Error deleting subcategory:', error)
          set({ error: (error as Error).message })
          throw error
        }
      },

      getCategoryById: (id) => {
        return get().categories.find(cat => cat.id === id)
      }
    }),
    {
      name: 'category-storage',
      partialize: (state) => ({ 
        categories: state.categories,
        categoriesLoaded: state.categoriesLoaded,
        lastFetchTimestamp: state.lastFetchTimestamp
      }),
    }
  )
)