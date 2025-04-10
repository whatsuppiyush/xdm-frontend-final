
export function formatSubscriptionId(id: any): string | null {
  if (!id) return null;
  
  // If it's already a string, just return it
  if (typeof id === 'string') {
    // Check if it looks like a timestamp (contains T and Z in ISO format)
    if (id.includes('T') && id.includes(':')) {
      console.error(`Potential timestamp detected in subscription ID: ${id}`);
      return null;
    }
    return id;
  }
  
  // Otherwise convert to string
  return String(id);
} 