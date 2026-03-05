// Mapeo estático de imágenes
export const productImages: { [key: string]: string } = {
  // Imágenes por nombre de producto
  'catan': '/uploads/products/catan.jpg',
  'carcassonne': '/uploads/products/carcassonne.jpg', 
  'ticket to ride': '/uploads/products/ticket-to-ride.jpg',
  
  // Imágenes por nombre de archivo
  'catan.jpg': '/uploads/products/catan.jpg',
  'carcassonne.jpg': '/uploads/products/carcassonne.jpg',
  'ticket-to-ride.jpg': '/uploads/products/ticket-to-ride.jpg',
  
  // Por defecto
  'default': '/diverse-products-still-life.png'
};

export const getProductImage = (productName: string, imagePath?: string): string => {
  // Si tenemos un mapeo directo por nombre
  const lowerName = productName.toLowerCase();
  if (productImages[lowerName]) {
    return productImages[lowerName];
  }
  
  // Si tenemos la ruta de imagen, intentar extraer el nombre del archivo
  if (imagePath) {
    const fileName = imagePath.split('/').pop() || '';
    if (fileName && productImages[fileName]) {
      return productImages[fileName];
    }
    
    // Si la ruta ya es válida, usarla
    if (imagePath.startsWith('/') && (imagePath.includes('.jpg') || imagePath.includes('.png'))) {
      return imagePath;
    }
  }
  
  return productImages.default;
};