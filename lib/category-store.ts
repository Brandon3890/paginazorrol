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
  errorDetails: any | null
  categoriesLoaded: boolean
  
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
  reorderSubcategories: (categoryId: number, orderedIds: number[]) => Promise<void>
  clearError: () => void
}

export const useCategoryStore = create<CategoryStore>()(
  persist(
    (set, get) => ({
      categories: [],
      loading: false,
      error: null,
      errorDetails: null,
      categoriesLoaded: false,

      fetchCategories: async (force = false) => {
        if (get().categoriesLoaded && !force) {
          console.log('📦 Categorías ya cargadas, omitiendo fetch')
          return
        }

        set({ loading: true, error: null, errorDetails: null })
        try {
          console.log('🔄 Fetching categories...')
          const response = await fetch('/api/categories')
          
          if (!response.ok) {
            throw new Error(`Error fetching categories: ${response.status}`)
          }
          
          const data = await response.json()
          
          if (!Array.isArray(data)) {
            console.error('❌ La API no devolvió un array:', data)
            set({ 
              categories: [], 
              loading: false, 
              categoriesLoaded: true,
              error: 'Formato de datos inválido'
            })
            return
          }
          
          const validCategories = data
            .filter((cat: any) => {
              const isValid = cat && typeof cat === 'object' && cat.id && typeof cat.id === 'number'
              if (!isValid) {
                console.warn('⚠️ Categoría inválida:', cat)
              }
              return isValid
            })
            .map((cat: any) => ({
              id: cat.id,
              name: cat.name || 'Sin nombre',
              slug: cat.slug || 'sin-slug',
              description: cat.description || '',
              is_active: Boolean(cat.is_active),
              created_at: cat.created_at || new Date().toISOString(),
              updated_at: cat.updated_at || new Date().toISOString(),
              subcategories: Array.isArray(cat.subcategories) 
                ? cat.subcategories
                    .filter((sub: any) => sub && typeof sub === 'object' && sub.id)
                    .map((sub: any) => ({
                      id: sub.id,
                      name: sub.name || 'Sin nombre',
                      slug: sub.slug || 'sin-slug',
                      category_id: sub.category_id || cat.id,
                      is_active: Boolean(sub.is_active),
                      display_order: sub.display_order || 0,
                      created_at: sub.created_at || new Date().toISOString(),
                      updated_at: sub.updated_at || new Date().toISOString()
                    }))
                    .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
                : []
            }))
          
          console.log(`✅ ${validCategories.length} categorías válidas cargadas`)
          
          set({ 
            categories: validCategories, 
            loading: false, 
            categoriesLoaded: true,
            error: null,
            errorDetails: null
          })
        } catch (error) {
          console.error('❌ Error fetching categories:', error)
          set({ 
            error: (error as Error).message, 
            loading: false,
            categoriesLoaded: true
          })
        }
      },

      clearError: () => {
        set({ error: null, errorDetails: null })
      },

      reorderSubcategories: async (categoryId: number, orderedIds: number[]) => {
        try {
          const response = await fetch(`/api/categories/${categoryId}/subcategories/reorder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ordered_ids: orderedIds })
          })
          
          if (!response.ok) throw new Error('Error reordering subcategories')
          
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
          
          console.log(`✅ Subcategorías reordenadas para categoría ${categoryId}`)
        } catch (error) {
          console.error('Error reordering subcategories:', error)
          set({ error: (error as Error).message })
        }
      },

      addCategory: async (category) => {
        try {
          const response = await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(category)
          })
          
          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Error creating category')
          }
          
          await get().fetchCategories(true)
          console.log('✅ Categoría creada exitosamente')
        } catch (error) {
          console.error('Error creating category:', error)
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
            const errorData = await response.json()
            // Guardar los detalles del error
            set({ errorDetails: errorData })
            throw new Error(errorData.error || 'Error deactivating category')
          }
          
          set(state => ({
            categories: state.categories.map(cat => 
              cat.id === id ? { ...cat, is_active: false } : cat
            )
          }))
          
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
          console.log('✅ Subcategoría creada exitosamente')
        } catch (error) {
          console.error('Error creating subcategory:', error)
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
        categoriesLoaded: state.categoriesLoaded 
      }),
    }
  )
)