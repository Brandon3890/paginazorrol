export default function FiltroLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          {/* Breadcrumb skeleton */}
          <div className="h-4 bg-gray-200 rounded w-64 mb-8"></div>
          
          {/* Title skeleton */}
          <div className="h-8 bg-gray-200 rounded w-96 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-full max-w-2xl mb-8"></div>
          
          {/* Products grid skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-md p-4">
                <div className="bg-gray-200 h-48 rounded-lg mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}