import createClient from "@fetchkit/ffetch";

// Create a client with timeout, retries, and deduplication
const fetchClient = createClient({
  timeout: 5000,
  retries: 0,
});
