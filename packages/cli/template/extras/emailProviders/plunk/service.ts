import Plunk from "@plunk/node";
import { env } from "@/config/env";

export const plunk = new Plunk(env.PLUNK_API_KEY);
