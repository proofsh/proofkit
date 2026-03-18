import { env } from "@/config/env";
import Plunk from "@plunk/node";

export const plunk = new Plunk(env.PLUNK_API_KEY);
