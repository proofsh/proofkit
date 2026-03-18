import { registryFetch } from "./http.js";

export async function listItems() {
  const { data: items, error } = await registryFetch("@get/");
  if (error) {
    throw new Error(`Failed to fetch items from registry: ${error.message}`);
  }
  return items;
}
